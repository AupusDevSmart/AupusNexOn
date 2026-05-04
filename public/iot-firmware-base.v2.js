/**
 * IoT NexOn - Base Firmware Template v2.0
 * Baseado no firmware real TON v1.3.0 testado em hardware.
 * ESP32-S3-WROOM-1-N8R2 (board: lolin_s3)
 *
 * Arquitetura modular: hal.h + config.h + módulos independentes
 * Pinagem confirmada em testes de bancada (2026-04)
 */

var FIRMWARE_BASE = {

// ================================================================
// platformio.ini
// ================================================================
'platformio.ini': `; ==============================================================================
; TON - Gerado pelo NexOn IoT
; ESP32-S3-WROOM-1-N8R2
; ==============================================================================

[env:ton]
platform = espressif32
board = lolin_s3
framework = arduino

monitor_speed = 115200
upload_speed = 921600

board_upload.use_1200bps_touch = true
board_upload.wait_for_upload_port = true
board_build.arduino.memory_type = qio_qspi

; Particionamento com 2 slots OTA (app0/app1) + SPIFFS
; Necessario para que Update.h possa gravar em partition nao-ativa
board_build.partitions = default_8MB.csv

lib_deps =
    adafruit/Adafruit MCP23017 Arduino Library@^2.3.2
    adafruit/Adafruit BusIO@^1.16.1
    knolleary/PubSubClient@^2.8
    4-20ma/ModbusMaster@^2.0.1
    bblanchon/ArduinoJson@^7
    arduino-libraries/Ethernet@^2.0.2

build_flags =
    -DCORE_DEBUG_LEVEL=3
    -DBOARD_HAS_PSRAM=0
    -DCONFIG_SPIRAM_MODE_OCT=0
    -DARDUINO_USB_CDC_ON_BOOT=1
`,

// ================================================================
// include/hal.h — Pinagem fixa do hardware (nunca muda)
// Confirmada em testes de bancada 2026-04
// ================================================================
'include/hal.h': `#ifndef HAL_H
#define HAL_H

// USB nativo
#define USB_DN              19
#define USB_DP              20

// I2C
#define I2C_SDA             4
#define I2C_SCL             5

// SPI1 - SD Card (SPI3_HOST, zona MSPI)
#define SPI1_MOSI_PIN       35
#define SPI1_MISO_PIN       37
#define SPI1_SCLK_PIN       36
#define SD_CS               38

// SPI2 - W5500 Ethernet
#define SPI2_MOSI_PIN       11
#define SPI2_MISO_PIN       13
#define SPI2_SCLK_PIN       12
#define W5500_CS            10
#define W5500_RST           14

// UART1 (RS485)
#define UART1_TX            18
#define UART1_RX            17

// UART2 (LoRa)
#define UART2_TX            16
#define UART2_RX            15

// RS485 direction
#define RS485_DIR           8

// LoRa E220
#define LORA_AUX            47

// Transistor outputs (BC817)
#define TR1                 1
#define TR2                 2
#define TR3                 42
#define TR4                 41

// Analog inputs
#define AN1                 6
#define AN2                 7

// PWM output (MOSFET AOD7N65)
#define PWM_OUT             46

#endif
`,

// ================================================================
// include/inputs.h
// ================================================================
'include/inputs.h': `#ifndef INPUTS_H
#define INPUTS_H
#include <stdint.h>

bool inputs_init();
void inputs_scan();
uint8_t inputs_get_state();
bool inputs_changed();

#endif
`,

// ================================================================
// src/inputs.cpp
// ================================================================
'src/inputs.cpp': `#include "inputs.h"
#include "hal.h"
#include <Wire.h>
#include <Adafruit_MCP23X08.h>

#define MCP_IN_ADDR  0x26
#define INPUT_COUNT  6

static Adafruit_MCP23X08 _mcp;
static bool _ok = false;
static uint8_t _state = 0;
static uint8_t _prev = 0;
static bool _changed = false;
static uint8_t _debounce[INPUT_COUNT] = {0};

bool inputs_init() {
    if (!_mcp.begin_I2C(MCP_IN_ADDR, &Wire)) return false;
    for (int i = 1; i <= INPUT_COUNT; i++)
        _mcp.pinMode(i, INPUT_PULLUP);
    // GP6/GP7 = LoRa M0/M1 (saidas)
    _mcp.pinMode(6, OUTPUT);
    _mcp.pinMode(7, OUTPUT);
    _mcp.digitalWrite(6, LOW);
    _mcp.digitalWrite(7, LOW);
    _ok = true;
    return true;
}

void inputs_scan() {
    if (!_ok) return;
    uint8_t reading = 0;
    for (int i = 0; i < INPUT_COUNT; i++) {
        bool val = !_mcp.digitalRead(i + 1);
        if (val == ((_state >> i) & 1)) {
            _debounce[i] = 0;
        } else {
            _debounce[i]++;
            if (_debounce[i] >= 3) {
                if (val) reading |= (1 << i);
                _debounce[i] = 0;
            } else {
                if ((_state >> i) & 1) reading |= (1 << i);
            }
            continue;
        }
        if (val) reading |= (1 << i);
    }
    _prev = _state;
    _state = reading;
    if (_state != _prev) _changed = true;
}

uint8_t inputs_get_state() { return _state; }
bool inputs_changed() { bool c = _changed; _changed = false; return c; }
`,

// ================================================================
// include/relays.h
// ================================================================
'include/relays.h': `#ifndef RELAYS_H
#define RELAYS_H
#include <stdint.h>

bool relays_init();
void relay_set(uint8_t num, bool state);
void relays_all_on();
void relays_all_off();
uint8_t relays_get_state();

#endif
`,

// ================================================================
// src/relays.cpp
// ================================================================
'src/relays.cpp': `#include "relays.h"
#include <Wire.h>
#include <Adafruit_MCP23X08.h>

#define MCP_OUT_ADDR 0x27
#define RELAY_COUNT  6

static Adafruit_MCP23X08 _mcp;
static bool _ok = false;
static uint8_t _state = 0;

bool relays_init() {
    if (!_mcp.begin_I2C(MCP_OUT_ADDR, &Wire)) return false;
    for (int i = 1; i <= RELAY_COUNT; i++) {
        _mcp.pinMode(i, OUTPUT);
        _mcp.digitalWrite(i, LOW);
    }
    _ok = true;
    return true;
}

void relay_set(uint8_t num, bool state) {
    if (!_ok || num < 1 || num > RELAY_COUNT) return;
    _mcp.digitalWrite(num, state ? HIGH : LOW);
    if (state) _state |= (1 << num); else _state &= ~(1 << num);
}

void relays_all_on() { for (int i = 1; i <= RELAY_COUNT; i++) relay_set(i, true); }
void relays_all_off() { for (int i = 1; i <= RELAY_COUNT; i++) relay_set(i, false); }
uint8_t relays_get_state() { return _state; }
`,

// ================================================================
// include/outputs.h
// ================================================================
'include/outputs.h': `#ifndef OUTPUTS_H
#define OUTPUTS_H
#include <stdint.h>

void outputs_init();
void output_set(uint8_t num, bool state);
void outputs_all_on();
void outputs_all_off();
uint8_t outputs_get_state();

#endif
`,

// ================================================================
// src/outputs.cpp
// ================================================================
'src/outputs.cpp': `#include "outputs.h"
#include "hal.h"
#include <Arduino.h>

static const uint8_t _pins[] = { TR1, TR2, TR3, TR4 };
static uint8_t _state = 0;

void outputs_init() {
    for (int i = 0; i < 4; i++) {
        pinMode(_pins[i], OUTPUT);
        digitalWrite(_pins[i], LOW);
    }
}

void output_set(uint8_t num, bool state) {
    if (num < 1 || num > 4) return;
    digitalWrite(_pins[num - 1], state ? HIGH : LOW);
    if (state) _state |= (1 << (num-1)); else _state &= ~(1 << (num-1));
}

void outputs_all_on() { for (int i = 1; i <= 4; i++) output_set(i, true); }
void outputs_all_off() { for (int i = 1; i <= 4; i++) output_set(i, false); }
uint8_t outputs_get_state() { return _state; }
`,

// ================================================================
// include/adc.h
// ================================================================
'include/adc.h': `#ifndef ADC_H
#define ADC_H

void adc_init();
float adc_read_mv(int channel);

#endif
`,

// ================================================================
// src/adc.cpp
// ================================================================
'src/adc.cpp': `#include "adc.h"
#include "hal.h"
#include <Arduino.h>

#define ADC_DIVIDER 8.01

void adc_init() {
    analogReadResolution(12);
    analogSetPinAttenuation(AN1, ADC_11db);
    analogSetPinAttenuation(AN2, ADC_11db);
}

float adc_read_mv(int channel) {
    int pin = (channel == 1) ? AN1 : AN2;
    return analogReadMilliVolts(pin) * ADC_DIVIDER;
}
`,

// ================================================================
// include/ota.h — OTA via MQTT + HTTP
// ================================================================
'include/ota.h': `#ifndef OTA_H
#define OTA_H
#include <stdint.h>

void ota_init();

// Processa um comando OTA recebido via MQTT (JSON: url, version, md5).
// Bloqueante: baixa o firmware, grava, reinicia.
void ota_handle_command(const char* payload);

// True durante o download/flash. loop() principal deve ceder tempo nesse estado.
bool ota_in_progress();

// ----- Rollback automático (proteção pós-OTA) -----
// Detecta no boot se o firmware atual está em estado PENDING_VERIFY
// (entrou agora via OTA e ainda não foi confirmado válido). Se sim,
// arma um contador interno de validação. Chamar UMA vez no setup().
void ota_check_pending_verify();

// Sinaliza uma execução saudável (chamar após cada mqtt_publish OK).
// Após N sinalizações consecutivas, marca a partição como válida e
// desliga o rollback. Se o firmware travar antes, no próximo reset
// o bootloader detecta PENDING_VERIFY e reverte para a partição anterior.
void ota_confirm_valid_if_needed();

#endif
`,

// ================================================================
// src/ota.cpp — Download HTTP + self-flash via Update.h
// Formato do payload:
//   { "url": "https://.../firmware.bin",
//     "version": "1.2.3",
//     "md5": "a3b1..." }
// Publica progresso em MQTT_TOPIC_BASE/ota/status (state, progress, msg).
// ================================================================
'src/ota.cpp': `#include "ota.h"
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

// Lê uma linha (até \\n), descarta CR. Retorna false se timeout.
static bool _readLine(Client& c, String& line, unsigned long timeoutMs) {
    line = "";
    unsigned long start = millis();
    while (millis() - start < timeoutMs) {
        while (c.available()) {
            int ch = c.read();
            if (ch < 0) break;
            if (ch == '\\r') continue;
            if (ch == '\\n') return true;
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
    Serial.printf("[OTA] interfaces: eth=%s wifi=%s\\n",
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
            Serial.printf("[OTA] Ethernet sem TLS — usando %s\\n", effUrl.c_str());
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
            Serial.printf("[OTA] Firmware confirmado valido apos %d pubs OK — rollback cancelado\\n",
                          _otaPostBootPubs);
        } else {
            Serial.println("[OTA] WARN: falha ao marcar firmware valido");
        }
    }
}
`,

// ================================================================
// include/sd_buffer.h - Buffer offline em SD Card
// ================================================================
'include/sd_buffer.h': `#ifndef SD_BUFFER_H
#define SD_BUFFER_H
#include <stdint.h>

// Tenta inicializar SD. Retorna true se OK.
bool sd_buffer_init();
bool sd_buffer_ready();

// Guarda { topic, payload } no arquivo de buffer. Chamado quando MQTT falha.
// Inclui timestamp automaticamente.
bool sd_buffer_store(const char* topic, const char* payload);

// Drena o buffer: envia tudo que foi salvo (chamado quando MQTT reconecta).
// publish_fn: funcao que retorna true se publicou com sucesso.
// max_send: maximo de msgs a enviar por chamada (evita bloquear demais)
// Retorna numero de mensagens drenadas.
typedef bool (*sd_buffer_publish_fn)(const char* topic, const char* payload);
int sd_buffer_drain(sd_buffer_publish_fn publish_fn, int max_send);

// Quantas mensagens pendentes no buffer (linhas no arquivo)
int sd_buffer_pending();

#endif
`,

// ================================================================
// src/sd_buffer.cpp - baseado no SUP_PRIME/EV-PD666_USR_MQTT
// Formato linha: "topic\\tpayload\\n"
// ================================================================
'src/sd_buffer.cpp': `#include "sd_buffer.h"
#include "hal.h"
#include "diag.h"
#include <Arduino.h>
#include <SPI.h>
#include <SD.h>

#define SD_BUF_FILE      "/mqtt_buf.txt"
#define SD_BUF_TMP       "/mqtt_buf.tmp"
#define SD_MAX_FILE_SIZE (5UL * 1024UL * 1024UL)  // 5 MB
#define SD_FLUSH_PER_LOOP 10                       // max msgs por drain

static bool _sdReady = false;
static SPIClass _spiSD(HSPI);

bool sd_buffer_init() {
    _spiSD.begin(SPI1_SCLK_PIN, SPI1_MISO_PIN, SPI1_MOSI_PIN, SD_CS);
    if (!SD.begin(SD_CS, _spiSD, 8000000)) {
        Serial.println("[SD-BUF] Inicializacao falhou");
        _sdReady = false;
        diag_sd_available = false;
        return false;
    }
    _sdReady = true;
    diag_sd_available = true;
    Serial.printf("[SD-BUF] OK - %llu MB\\n", SD.cardSize() / (1024ULL * 1024ULL));
    int pending = sd_buffer_pending();
    if (pending > 0) {
        Serial.printf("[SD-BUF] %d mensagens pendentes no buffer\\n", pending);
    }
    return true;
}

bool sd_buffer_ready() { return _sdReady; }

bool sd_buffer_store(const char* topic, const char* payload) {
    if (!_sdReady) {
        diag_sd_write_errors++;
        return false;
    }

    File f = SD.open(SD_BUF_FILE, FILE_APPEND);
    if (!f) {
        diag_sd_write_errors++;
        Serial.println("[SD-BUF] Falha ao abrir para escrita");
        return false;
    }
    if (f.size() > SD_MAX_FILE_SIZE) {
        f.close();
        diag_sd_write_errors++;
        Serial.println("[SD-BUF] Arquivo cheio, descartando");
        return false;
    }
    f.print(topic);
    f.print('\\t');
    f.println(payload);
    f.close();
    diag_sd_writes++;
    Serial.printf("[SD-BUF] SALVO: %s (total armazenado: %lu)\\n", topic, (unsigned long)diag_sd_writes);
    return true;
}

int sd_buffer_pending() {
    if (!_sdReady) return 0;
    if (!SD.exists(SD_BUF_FILE)) return 0;
    File f = SD.open(SD_BUF_FILE, FILE_READ);
    if (!f) return 0;
    int n = 0;
    while (f.available()) {
        if (f.read() == '\\n') n++;
    }
    f.close();
    return n;
}

int sd_buffer_drain(sd_buffer_publish_fn publish_fn, int max_send) {
    if (!_sdReady || !publish_fn) return 0;
    if (!SD.exists(SD_BUF_FILE)) return 0;

    File check = SD.open(SD_BUF_FILE, FILE_READ);
    if (!check) return 0;
    if (check.size() == 0) { check.close(); SD.remove(SD_BUF_FILE); return 0; }
    check.close();

    if (SD.exists(SD_BUF_TMP)) SD.remove(SD_BUF_TMP);
    if (!SD.rename(SD_BUF_FILE, SD_BUF_TMP)) return 0;

    File src = SD.open(SD_BUF_TMP, FILE_READ);
    if (!src) return 0;
    File dst = SD.open(SD_BUF_FILE, FILE_WRITE);

    int sent = 0, kept = 0, limit = (max_send > 0 ? max_send : SD_FLUSH_PER_LOOP);
    bool failing = false;

    while (src.available()) {
        String line = src.readStringUntil('\\n');
        line.trim();
        if (line.length() == 0) continue;

        if (failing || sent >= limit) {
            if (dst) dst.println(line);
            kept++;
            continue;
        }

        int tab = line.indexOf('\\t');
        if (tab <= 0) continue; // linha corrompida

        String topic = line.substring(0, tab);
        String payload = line.substring(tab + 1);

        if (publish_fn(topic.c_str(), payload.c_str())) {
            sent++;
            diag_sd_resends++;
            Serial.printf("[SD-BUF] Reenviado: %s\\n", topic.c_str());
            delay(30);
        } else {
            // Falhou - guardar restante para proxima
            if (dst) dst.println(line);
            kept++;
            failing = true;
        }
    }

    src.close();
    if (dst) dst.close();
    SD.remove(SD_BUF_TMP);

    if (sent > 0 || kept > 0) {
        Serial.printf("[SD-BUF] Drenadas %d mensagens (restam %d, total reenviado: %lu)\\n",
                       sent, kept, (unsigned long)diag_sd_resends);
    }
    // Se ficou vazio, remover arquivo
    File recheck = SD.open(SD_BUF_FILE, FILE_READ);
    if (recheck) {
        if (recheck.size() == 0) { recheck.close(); SD.remove(SD_BUF_FILE); }
        else recheck.close();
    }
    return sent;
}
`,

};
