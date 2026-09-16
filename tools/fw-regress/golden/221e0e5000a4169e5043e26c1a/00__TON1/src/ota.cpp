#include "ota.h"
#include "config.h"
#include "mqtt.h"
#include "eth.h"
#include <WiFi.h>
#include <Ethernet.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Update.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <esp_ota_ops.h>

static volatile bool _inProgress = false;

// Rollback automático: estado pós-boot
// Quantas publicações MQTT bem-sucedidas precisamos para declarar este
// firmware "válido" e cancelar o rollback do bootloader.
#ifndef OTA_VALIDATION_PUBS
#define OTA_VALIDATION_PUBS  3
#endif

static bool _otaPendingVerify  = false; // boot atual está em "trial"?
static int  _otaPostBootPubs   = 0;     // contador de publicações OK
static bool _otaConfirmedValid = false; // já marcou como válido?

static void _publishStatus(const char* state, int pct, const char* msg) {
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/ota/status", MQTT_TOPIC_BASE);
    StaticJsonDocument<256> j;
    j["state"]    = state;
    j["progress"] = pct;
    j["version"]  = FIRMWARE_VERSION;
    j["device"]   = DEVICE_ID;
    if (msg) j["msg"] = msg;
    char payload[256];
    serializeJson(j, payload, sizeof(payload));
    mqtt_publish(topic, payload);
}

void ota_init() {
    _inProgress = false;
}

bool ota_in_progress() {
    return _inProgress;
}

// ----- HTTP GET manual via Client genérico (Ethernet/WiFi) -----
// HTTPClient da Arduino-ESP32 só aceita WiFiClient. Para Ethernet (W5500),
// implementamos GET HTTP/1.1 plain manualmente sobre Client&.
//
// Parse simplificado da URL: aceita "http://host[:port]/path".
// Retorna Content-Length lido dos headers (>0) ou -1 em erro.
struct UrlParts { String host; uint16_t port; String path; };
static bool _parseHttpUrl(const char* url, UrlParts& out) {
    if (strncmp(url, "http://", 7) != 0) return false;
    const char* p = url + 7;
    const char* slash = strchr(p, '/');
    String hostPort = slash ? String(p, slash - p) : String(p);
    out.path = slash ? String(slash) : String("/");
    int colon = hostPort.indexOf(':');
    if (colon >= 0) {
        out.host = hostPort.substring(0, colon);
        out.port = (uint16_t) hostPort.substring(colon + 1).toInt();
    } else {
        out.host = hostPort;
        out.port = 80;
    }
    return out.host.length() > 0;
}

// Lê uma linha (até \n), descarta CR. Retorna false se timeout.
static bool _readLine(Client& c, String& line, unsigned long timeoutMs) {
    line = "";
    unsigned long start = millis();
    while (millis() - start < timeoutMs) {
        while (c.available()) {
            int ch = c.read();
            if (ch < 0) break;
            if (ch == '\r') continue;
            if (ch == '\n') return true;
            line += (char) ch;
            if (line.length() > 512) return true; // safety
        }
        delay(2);
    }
    return false;
}

// Faz GET via Client genérico, parseia headers, retorna Content-Length.
// Após retornar, o stream do client está posicionado no início do body.
static int _httpGet(Client& c, const UrlParts& u) {
    if (!c.connect(u.host.c_str(), u.port)) return -1;
    // Request line + headers mínimos
    c.print("GET "); c.print(u.path); c.println(" HTTP/1.1");
    c.print("Host: "); c.println(u.host);
    c.println("User-Agent: NexOn-OTA/1.0");
    c.println("Accept: */*");
    c.println("Connection: close");
    c.println();
    c.flush();

    // Status line
    String line;
    if (!_readLine(c, line, 15000)) return -1;
    int sp1 = line.indexOf(' ');
    int sp2 = line.indexOf(' ', sp1 + 1);
    if (sp1 < 0 || sp2 < 0) return -1;
    int status = line.substring(sp1 + 1, sp2).toInt();
    if (status != 200) return -1 - status;  // codifica status no retorno (negativo)

    // Headers
    int contentLength = -1;
    while (_readLine(c, line, 15000)) {
        if (line.length() == 0) break;  // fim dos headers
        line.toLowerCase();
        if (line.startsWith("content-length:")) {
            contentLength = line.substring(15).toInt();
        }
    }
    return contentLength;
}

// Streama o body do Client para Update.write em chunks de 1024 bytes.
// Reporta progresso via _publishStatus a cada 5% / 3s.
// Retorna true em sucesso, false em erro (e publica status apropriado).
static bool _streamToUpdate(Client& c, int total) {
    uint8_t buf[1024];
    size_t written = 0;
    int lastReport = -1;
    unsigned long lastProgressMs = 0;
    unsigned long lastDataMs = millis();

    while (c.connected() && written < (size_t) total) {
        esp_task_wdt_reset();
        size_t avail = c.available();
        if (avail) {
            size_t n = c.readBytes(buf, avail > sizeof(buf) ? sizeof(buf) : avail);
            if (Update.write(buf, n) != n) {
                _publishStatus("error", 0, Update.errorString());
                Update.abort();
                return false;
            }
            written += n;
            lastDataMs = millis();

            int pct = (int)((written * 100) / (size_t) total);
            unsigned long now = millis();
            if (pct != lastReport && (pct - lastReport >= 5 || now - lastProgressMs > 3000)) {
                lastReport = pct;
                lastProgressMs = now;
                _publishStatus("downloading", pct, nullptr);
                mqtt_loop();
            }
        } else {
            // Sem dados há 30s = stall
            if (millis() - lastDataMs > 30000) {
                _publishStatus("error", 0, "stream_stalled");
                return false;
            }
            delay(1);
        }
    }
    return written == (size_t) total;
}

void ota_handle_command(const char* payload) {
    if (_inProgress) {
        _publishStatus("error", 0, "already_in_progress");
        return;
    }
    if (!payload || !*payload) return;

    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (err) { _publishStatus("error", 0, "invalid_json"); return; }

    const char* url            = doc["url"]     | (const char*)nullptr;
    const char* target_version = doc["version"] | "";
    const char* md5            = doc["md5"]     | "";

    if (!url) { _publishStatus("error", 0, "missing_url"); return; }
    if (target_version[0] && strcmp(target_version, FIRMWARE_VERSION) == 0) {
        _publishStatus("skipped", 0, "already_on_version");
        return;
    }

    _inProgress = true;
    _publishStatus("downloading", 0, url);
    mqtt_loop();
    esp_task_wdt_reset();

    // Detecta interface ativa. Quando o TON está em Ethernet (W5500),
    // HTTPClient do Arduino-ESP32 NÃO aceita EthernetClient (overload
    // só existe para WiFiClient), então fazemos HTTP plain manual.
    // Em qualquer caminho a integridade é validada pelo MD5 abaixo.
    bool ethActive  = eth_link_up() && eth_has_ip();
    bool wifiActive = (WiFi.status() == WL_CONNECTED);
    Serial.printf("[OTA] interfaces: eth=%s wifi=%s\n",
                  ethActive  ? "active" : "off",
                  wifiActive ? "active" : "off");

    int total = -1;
    bool ok = false;

    if (ethActive) {
        // ===== Caminho Ethernet: HTTP plain manual via EthernetClient =====
        // Converte https:// → http:// (W5500 não tem TLS confiável)
        String effUrl = url;
        if (strncmp(url, "https://", 8) == 0) {
            effUrl = String("http://") + (url + 8);
            Serial.printf("[OTA] Ethernet sem TLS — usando %s\n", effUrl.c_str());
        }
        UrlParts parts;
        if (!_parseHttpUrl(effUrl.c_str(), parts)) {
            _publishStatus("error", 0, "url_parse_failed");
            _inProgress = false; return;
        }

        EthernetClient ethC;  // socket próprio (separado do MQTT)
        ethC.setTimeout(15000);
        total = _httpGet(ethC, parts);
        esp_task_wdt_reset();
        if (total < 0) {
            char m[32]; snprintf(m, sizeof(m), "eth_http_%d", total);
            _publishStatus("error", 0, m);
            ethC.stop(); _inProgress = false; return;
        }
        if (total == 0) {
            _publishStatus("error", 0, "no_content_length");
            ethC.stop(); _inProgress = false; return;
        }

        if (!Update.begin(total)) {
            _publishStatus("error", 0, Update.errorString());
            ethC.stop(); _inProgress = false; return;
        }
        esp_task_wdt_reset();
        if (md5[0]) Update.setMD5(md5);

        ok = _streamToUpdate(ethC, total);
        ethC.stop();
    } else {
        // ===== Caminho WiFi: HTTPClient como antes =====
        HTTPClient http;
        http.setTimeout(60000);
        http.setConnectTimeout(15000);

        bool isHttps = (strncmp(url, "https://", 8) == 0);
        WiFiClientSecure secureClient;
        WiFiClient plainWifi;

        bool beginOk;
        if (isHttps) {
            // TODO: pinar CA Let's Encrypt em produção (substituir setInsecure)
            secureClient.setInsecure();
            beginOk = http.begin(secureClient, url);
        } else {
            beginOk = http.begin(plainWifi, url);
        }
        if (!beginOk) {
            _publishStatus("error", 0, "http_begin_failed");
            _inProgress = false; return;
        }
        esp_task_wdt_reset();

        int code = http.GET();
        esp_task_wdt_reset();
        if (code != 200) {
            char m[48]; snprintf(m, sizeof(m), "http_%d", code);
            _publishStatus("error", 0, m);
            http.end(); _inProgress = false; return;
        }
        total = http.getSize();
        if (total <= 0) {
            _publishStatus("error", 0, "no_content_length");
            http.end(); _inProgress = false; return;
        }
        if (!Update.begin(total)) {
            _publishStatus("error", 0, Update.errorString());
            http.end(); _inProgress = false; return;
        }
        esp_task_wdt_reset();
        if (md5[0]) Update.setMD5(md5);

        // HTTPClient retorna o stream genérico via getStream() (Stream&)
        ok = _streamToUpdate(http.getStream(), total);
        http.end();
    }

    if (!ok) {
        // _streamToUpdate já publicou o status de erro
        _inProgress = false;
        return;
    }

    if (!Update.end(true)) {
        _publishStatus("error", 0, Update.errorString());
        _inProgress = false; return;
    }

    _publishStatus("success", 100, "rebooting");
    mqtt_loop();
    delay(500);
    ESP.restart();
}

// ================================================================
// Rollback automático
// ================================================================
// Chamar UMA vez no setup() — antes de iniciar WiFi/MQTT já é OK,
// pois lê apenas a partição em execução (não depende de rede).
void ota_check_pending_verify() {
    const esp_partition_t* running = esp_ota_get_running_partition();
    esp_ota_img_states_t state;
    if (esp_ota_get_state_partition(running, &state) == ESP_OK) {
        if (state == ESP_OTA_IMG_PENDING_VERIFY) {
            _otaPendingVerify = true;
            _otaPostBootPubs  = 0;
            Serial.println("[OTA] Boot pos-update: aguardando validacao...");
        } else {
            _otaConfirmedValid = true;  // estado normal — nada a confirmar
        }
    }
}

// Chamar após cada publicação MQTT bem-sucedida (telemetria/status).
// Após N publicações OK, marca a partição como válida e cancela o
// rollback automático do bootloader.
void ota_confirm_valid_if_needed() {
    if (_otaConfirmedValid) return;
    if (!_otaPendingVerify)  return;
    _otaPostBootPubs++;
    if (_otaPostBootPubs >= OTA_VALIDATION_PUBS) {
        if (esp_ota_mark_app_valid_cancel_rollback() == ESP_OK) {
            _otaConfirmedValid = true;
            Serial.printf("[OTA] Firmware confirmado valido apos %d pubs OK — rollback cancelado\n",
                          _otaPostBootPubs);
        } else {
            Serial.println("[OTA] WARN: falha ao marcar firmware valido");
        }
    }
}
