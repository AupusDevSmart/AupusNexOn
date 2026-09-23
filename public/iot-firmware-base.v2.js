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
// Anti-travamento (C3/C4): confere os reles no I2C; true = sem controle dos reles.
bool relays_io_fault();
void relays_health_tick();

#endif
`,

// ================================================================
// src/relays.cpp
// ================================================================
'src/relays.cpp': `#include "relays.h"
#include <Wire.h>
#include <Adafruit_MCP23X08.h>
#include "hal.h"

#define MCP_OUT_ADDR 0x27
#define RELAY_COUNT  6

static Adafruit_MCP23X08 _mcp;
static bool _ok = false;
static uint8_t _state = 0;

// ---- C3/C4 anti-travamento: rele VERIFICADO + recuperacao do barramento I2C ----
// Os dois MCP23008 (entradas 0x26, reles 0x27) dividem o I2C. Com SDA preso a lib nao
// trava, mas o rele fica no ultimo estado e a escrita "some". Agora toda escrita e'
// conferida (ACK + leitura do registrador GPIO); falhou -> libera o barramento (9 pulsos
// de clock + STOP), reinicializa os MCP e reaplica o estado DESEJADO. Sem sucesso ->
// relays_io_fault() = true (o posto bloqueia e pede reinicio; ver bomba.cpp).
uint32_t diag_i2c_resets = 0;
static bool _ioFault = false;
static unsigned long _lastHealth = 0;
static uint8_t _pinOf(uint8_t num) { return num; }
static uint8_t _bitOf(uint8_t num) { return num; }
// Le o LATCH de saida (OLAT, reg 0x0A do MCP23008): prova que a escrita chegou ao chip.
// Nao usa o nivel do pino (GPIO) para nao dar falso alarme por carga eletrica no rele.
static int _readOlat() {
    Wire.beginTransmission(MCP_OUT_ADDR);
    Wire.write((uint8_t)0x0A);
    if (Wire.endTransmission(false) != 0) return -1;
    if (Wire.requestFrom((uint8_t)MCP_OUT_ADDR, (uint8_t)1) != 1) return -1;
    return Wire.read();
}
static bool _conferir() {
    int olat = _readOlat();
    if (olat < 0) return false;
    uint8_t g = (uint8_t)olat;
    for (uint8_t n = 1; n <= RELAY_COUNT; n++) {
        bool quero = (_state >> _bitOf(n)) & 1;
        if ((bool)((g >> _pinOf(n)) & 1) != quero) return false;
    }
    return true;
}
static void _i2cBusClear() {
    Wire.end();
    pinMode(I2C_SDA, INPUT_PULLUP);
    pinMode(I2C_SCL, OUTPUT_OPEN_DRAIN);
    for (int i = 0; i < 9; i++) {           // um escravo segurando SDA solta com ate 9 clocks
        digitalWrite(I2C_SCL, LOW); delayMicroseconds(5);
        digitalWrite(I2C_SCL, HIGH); delayMicroseconds(5);
        if (digitalRead(I2C_SDA)) break;
    }
    pinMode(I2C_SDA, OUTPUT_OPEN_DRAIN);    // STOP: SDA sobe com SCL alto
    digitalWrite(I2C_SDA, LOW); delayMicroseconds(5);
    digitalWrite(I2C_SCL, HIGH); delayMicroseconds(5);
    digitalWrite(I2C_SDA, HIGH); delayMicroseconds(5);
    Wire.begin(I2C_SDA, I2C_SCL);
}
extern bool inputs_init();
static bool _recuperar() {
    diag_i2c_resets++;
    Serial.println("[I2C] escrita de rele nao conferiu - recuperando o barramento e os MCP");
    _i2cBusClear();
    inputs_init();                           // MCP de entradas (pull-ups) caso tenha resetado
    if (_mcp.begin_I2C(MCP_OUT_ADDR, &Wire)) {
        for (uint8_t n = 1; n <= RELAY_COUNT; n++) {
            _mcp.pinMode(_pinOf(n), OUTPUT);
            _mcp.digitalWrite(_pinOf(n), ((_state >> _bitOf(n)) & 1) ? HIGH : LOW);
        }
    }
    bool ok = _conferir();
    if (ok != !_ioFault) {
        _ioFault = !ok;
        Serial.println(ok ? "[I2C] reles de volta ao estado desejado" : "[I2C] FALHA: reles sem controle (io_falha)");
    }
    return ok;
}
bool relays_io_fault() { return _ioFault; }
// Chamar a cada volta do laco: confere os reles a cada 2 s (1 transacao I2C).
void relays_health_tick() {
    if (!_ok) return;
    if (millis() - _lastHealth < 2000UL) return;
    _lastHealth = millis();
    if (!_conferir()) _recuperar();
    else if (_ioFault) { _ioFault = false; Serial.println("[I2C] reles conferidos: ok"); }
}

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
    // estado DESEJADO primeiro: a recuperacao reaplica o que se quer, nao o que se leu
    if (state) _state |= (1 << _bitOf(num)); else _state &= ~(1 << _bitOf(num));
    _mcp.digitalWrite(_pinOf(num), state ? HIGH : LOW);
    if (!_conferir()) _recuperar();
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

// Fila offline de mensagens MQTT no cartao SD (fila SEGMENTADA, rev. 2026-09-23).
// Fonte canonica: AupusNexOn/firmware-libs/sd_queue/ (testada no host: test_sd_queue.cpp).
// As bases V1 e V2 embutem uma COPIA identica (smoke confere byte a byte).

// Monta o cartao (2 tentativas) e prepara a fila. Retorna true se OK.
bool sd_buffer_init();
bool sd_buffer_ready();

// Guarda { topic, payload } no fim da fila. Chamado quando o MQTT falha.
bool sd_buffer_store(const char* topic, const char* payload);

// Drena a fila: publica no maximo max_send mensagens OU ~300 ms, o que vier primeiro.
// publish_fn: retorna true se publicou. Para na primeira falha (resto fica na fila).
// Retorna quantas mensagens sairam.
typedef bool (*sd_buffer_publish_fn)(const char* topic, const char* payload);
int sd_buffer_drain(sd_buffer_publish_fn publish_fn, int max_send);

// Mensagens pendentes. BARATO (contador em memoria; nunca varre o cartao no laco).
// Enquanto a contagem inicial nao termina, devolve o que ja contou (>=1 se houver fila).
int sd_buffer_pending();

// Manutencao nao-bloqueante: contagem inicial em fatias de ~20 ms e remontagem do
// cartao a cada 10 min quando ele falhou. Chamar a cada volta do laco.
void sd_buffer_tick();

// Estado para o diagnostico: "ok" | "sem_cartao" | "falha" ; mensagens descartadas por
// cartao cheio (as mais antigas).
const char* sd_buffer_state();
uint32_t sd_buffer_discarded();

#endif
`,

// ================================================================
// src/sd_buffer.cpp - baseado no SUP_PRIME/EV-PD666_USR_MQTT
// Formato linha: "topic\\tpayload\\n"
// ================================================================
'src/sd_buffer.cpp': `// sd_buffer.cpp — fila offline de mensagens MQTT no cartao SD, SEGMENTADA.
//
// Por que (plano anti-travamento 2026-09-23, itens A1..A7):
//  - a versao antiga contava pendentes lendo o arquivo inteiro byte a byte (ate 5 MB) a cada
//    10 s e, para mandar 5 mensagens, regravava o arquivo inteiro: podia estourar o watchdog
//    (reinicio em loop) e uma queda de energia no meio corrompia a fila.
// Como funciona agora:
//  - mensagens vao para segmentos /q/NNNNNNNN.txt de ate SDQ_SEG_MAX bytes (so' append);
//  - um PONTEIRO de leitura (segmento, deslocamento) fica no NVS numa UNICA chave de 64 bits
//    (escrita atomica: queda de energia mantem o valor anterior);
//  - o ponteiro so' avanca DEPOIS do lote publicado -> entrega "pelo menos uma vez":
//    queda no meio pode reenviar ate um lote, nunca perder;
//  - segmento lido ate o fim e' apagado so' depois do ponteiro avancar;
//  - linha incompleta (queda no meio da gravacao) e' descartada, nunca emendada na proxima;
//  - pendentes = contador em memoria; a contagem inicial roda em fatias (sd_buffer_tick);
//  - cartao cheio (SDQ_TOTAL_MAX) descarta o segmento MAIS ANTIGO;
//  - 3 falhas seguidas de abrir/gravar -> cartao marcado em falha, remonta a cada 10 min;
//  - o arquivo antigo /mqtt_buf.txt (ou .tmp) e' migrado para a fila no primeiro boot.
// Sem barra invertida, crase ou cifrao-chave neste arquivo: ele e' embutido literalmente
// num template JS das bases do gerador.

#include "sd_buffer.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

#ifdef SDQ_HOST
#include "sdq_host_shim.h"
#else
#include "hal.h"
#include "diag.h"
#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#define SDQ_WDT() esp_task_wdt_reset()
static SPIClass _spiSD(HSPI);
static bool _sdMountHw() {
    _spiSD.begin(SPI1_SCLK_PIN, SPI1_MISO_PIN, SPI1_MOSI_PIN, SD_CS);
    return SD.begin(SD_CS, _spiSD, 8000000);
}
static void _sdUnmountHw() { SD.end(); }
#endif

#ifndef SDQ_SEG_MAX
#define SDQ_SEG_MAX        65536UL             // bytes por segmento
#endif
#ifndef SDQ_TOTAL_MAX
#define SDQ_TOTAL_MAX      (8UL * 1024UL * 1024UL)   // teto total da fila no cartao
#endif
#define SDQ_DRAIN_BUDGET_MS 300UL
#define SDQ_TICK_BUDGET_MS  20UL
#define SDQ_REMOUNT_MS      600000UL
#define SDQ_FAILS_TO_OFF    3
#define SDQ_LINE_MAX        1400
#define SDQ_DIR            "/q"
#define SDQ_NL             ((char)10)
#define SDQ_TAB            ((char)9)

enum SdqState : uint8_t { SDQ_NOCARD = 0, SDQ_OK, SDQ_FAIL };

static SdqState _st = SDQ_NOCARD;
static bool     _ready = false;
static bool     _everMounted = false;
static uint32_t _rseg = 0, _roff = 0;      // ponteiro de leitura
static uint32_t _wseg = 0, _wsize = 0;     // segmento de escrita
static uint32_t _minSeg = 0;
static uint64_t _total = 0;                // bytes na fila (todos os segmentos)
static int32_t  _pend = 0;                 // pendentes (valido se !_rec)
static bool     _rec = false;              // contagem inicial em andamento
static uint32_t _recSeg = 0, _recOff = 0, _recEndSeg = 0, _recEndOff = 0;
static int32_t  _recCount = 0, _recDelta = 0;
static uint8_t  _fails = 0;
static unsigned long _lastMount = 0;
static uint32_t _discarded = 0;
static char     _line[SDQ_LINE_MAX + 1];

static void _path(uint32_t seg, char* out, size_t n) { snprintf(out, n, SDQ_DIR "/%08lu.txt", (unsigned long)seg); }

static void _loadPtr() {
    Preferences p;
    uint64_t v = 0;
    if (p.begin("sdq", true)) { v = p.getULong64("ptr", 0); p.end(); }
    _rseg = (uint32_t)(v >> 32); _roff = (uint32_t)(v & 0xFFFFFFFFULL);
}
static void _savePtr() {
    Preferences p;
    if (p.begin("sdq", false)) { p.putULong64("ptr", ((uint64_t)_rseg << 32) | (uint64_t)_roff); p.end(); }
}

static uint32_t _fileSize(const char* path) {
    File f = SD.open(path, FILE_READ);
    if (!f) return 0;
    uint32_t s = (uint32_t)f.size(); f.close(); return s;
}

// Lista /q: menor e maior segmento, bytes totais. false se a pasta nao abre.
static bool _scan(uint32_t* mn, uint32_t* mx, uint64_t* tot, bool* any) {
    *any = false; *mn = 0xFFFFFFFFUL; *mx = 0; *tot = 0;
    File d = SD.open(SDQ_DIR, FILE_READ);
    if (!d || !d.isDirectory()) return false;
    for (File e = d.openNextFile(); e; e = d.openNextFile()) {
        const char* nm = e.name();
        const char* b = strrchr(nm, '/'); b = b ? b + 1 : nm;
        char* end = nullptr;
        unsigned long seg = strtoul(b, &end, 10);
        if (end && end != b && strcmp(end, ".txt") == 0) {
            *any = true;
            if (seg < *mn) *mn = (uint32_t)seg;
            if (seg > *mx) *mx = (uint32_t)seg;
            *tot += (uint64_t)e.size();
        }
        e.close();
        SDQ_WDT();
    }
    d.close();
    return true;
}

static bool _segExists(uint32_t seg) { char p[32]; _path(seg, p, sizeof(p)); return SD.exists(p); }

// Proximo segmento existente depois de 'seg' (ate _wseg). Buracos vem de descarte.
static uint32_t _nextSeg(uint32_t seg) {
    uint32_t s = seg + 1;
    while (s < _wseg && !_segExists(s)) s++;
    return s;
}

static bool _hasData() {
    if (!_ready) return false;
    if (_rseg < _wseg) return true;
    return _rseg == _wseg && _roff < _wsize;
}

static void _startRecount() {
    _rec = true; _recSeg = _rseg; _recOff = _roff; _recEndSeg = _wseg; _recEndOff = _wsize;
    _recCount = 0; _recDelta = 0;
}

static void _markFail(const char* what) {
    diag_sd_write_errors++;
    if (++_fails >= SDQ_FAILS_TO_OFF && _ready) {
        Serial.printf("[SD-BUF] cartao em FALHA (%s x%u) - desativado, nova tentativa em 10 min", what, (unsigned)_fails);
        Serial.println();
        _ready = false; _st = SDQ_FAIL; diag_sd_available = false;
        _lastMount = millis();
        _sdUnmountHw();
    }
}

// Migra o arquivo da versao antiga. .tmp (sobra de drenagem interrompida) contem tudo.
static void _migrateLegacy(bool dirEmpty) {
    const char* src = nullptr;
    if (SD.exists("/mqtt_buf.tmp")) { src = "/mqtt_buf.tmp"; if (SD.exists("/mqtt_buf.txt")) SD.remove("/mqtt_buf.txt"); }
    else if (SD.exists("/mqtt_buf.txt")) src = "/mqtt_buf.txt";
    if (!src) return;
    char dst[32];
    uint32_t seg = dirEmpty ? 0 : _wseg + 1;
    _path(seg, dst, sizeof(dst));
    if (SD.rename(src, dst)) {
        Serial.printf("[SD-BUF] fila antiga migrada para %s", dst); Serial.println();
        if (dirEmpty) { _rseg = 0; _roff = 0; _savePtr(); }
    } else {
        Serial.println("[SD-BUF] falha ao migrar a fila antiga (mantida)");
    }
}

static bool _open() {
    bool ok = _sdMountHw();
    if (!ok) { SDQ_WDT(); _sdUnmountHw(); ok = _sdMountHw(); }
    if (!ok) return false;
    if (!SD.exists(SDQ_DIR)) SD.mkdir(SDQ_DIR);
    _loadPtr();
    uint32_t mn, mx; uint64_t tot; bool any;
    if (!_scan(&mn, &mx, &tot, &any)) return false;
    _wseg = any ? mx : _rseg;
    _migrateLegacy(!any);
    if (!_scan(&mn, &mx, &tot, &any)) return false;
    _total = tot;
    if (!any) {                                   // fila vazia
        _wseg = _rseg; _wsize = 0; _minSeg = _rseg;
    } else {
        _minSeg = mn;
        if (_rseg < mn) { _rseg = mn; _roff = 0; _savePtr(); }
        // Ponteiro alem do ultimo segmento: tudo foi lido; escrita continua no segmento do ponteiro.
        _wseg = (_rseg > mx) ? _rseg : mx;
        // restos ja' lidos (queda entre salvar o ponteiro e apagar): apaga
        for (uint32_t s = mn; s < _rseg; s++) {
            char p[32]; _path(s, p, sizeof(p));
            if (SD.exists(p)) { _total -= _fileSize(p); SD.remove(p); }
            SDQ_WDT();
        }
        char wp[32]; _path(_wseg, wp, sizeof(wp));
        _wsize = _fileSize(wp);
        // Linha incompleta no fim do segmento de escrita (queda no meio): nao emenda.
        if (_wsize > 0) {
            File f = SD.open(wp, FILE_READ);
            if (f) {
                f.seek(_wsize - 1);
                int c = f.read();
                f.close();
                if (c != SDQ_NL) { _wseg++; _wsize = 0; }
            }
        }
    }
    if (_rseg == _wseg && _roff > _wsize) _roff = _wsize;
    _ready = true; _everMounted = true; _st = SDQ_OK; _fails = 0;
    diag_sd_available = true;
    _startRecount();
    return true;
}

bool sd_buffer_init() {
    _lastMount = millis();
    if (!_open()) {
        Serial.println("[SD-BUF] Inicializacao falhou (sem cartao ou cartao com defeito)");
        _ready = false; _st = SDQ_FAIL; diag_sd_available = false;
        return false;
    }
    Serial.printf("[SD-BUF] OK - fila: leitura %lu:%lu, escrita %lu:%lu, %lu bytes",
                  (unsigned long)_rseg, (unsigned long)_roff, (unsigned long)_wseg,
                  (unsigned long)_wsize, (unsigned long)_total);
    Serial.println();
    return true;
}

bool sd_buffer_ready() { return _ready; }

const char* sd_buffer_state() {
    if (_st == SDQ_OK) return "ok";
    return _everMounted ? "falha" : "sem_cartao";
}

uint32_t sd_buffer_discarded() { return _discarded; }

// Conta linhas de um segmento a partir de 'off' (usado no descarte).
static int32_t _countLines(const char* path, uint32_t off) {
    File f = SD.open(path, FILE_READ);
    if (!f) return 0;
    f.seek(off);
    int32_t n = 0; uint8_t b[256];
    for (;;) {
        int r = f.read(b, sizeof(b));
        if (r <= 0) break;
        for (int i = 0; i < r; i++) if (b[i] == (uint8_t)SDQ_NL) n++;
    }
    f.close();
    return n;
}

static void _pendAdd(int32_t d) {
    if (_rec) _recDelta += d;
    else { _pend += d; if (_pend < 0) _pend = 0; }
}

// Cartao cheio: descarta o segmento mais antigo (o que esta sendo lido).
static bool _dropOldest() {
    if (_rseg >= _wseg) return false;
    char p[32]; _path(_rseg, p, sizeof(p));
    uint32_t sz = _fileSize(p);
    int32_t lines = _countLines(p, _roff);
    uint32_t old = _rseg;
    _rseg = _nextSeg(_rseg); _roff = 0;
    _savePtr();
    SD.remove(p);
    _total = (_total > sz) ? _total - sz : 0;
    _discarded += (uint32_t)lines;
    if (_rec) _startRecount(); else _pendAdd(-lines);
    Serial.printf("[SD-BUF] cartao cheio: segmento %lu descartado (%ld mensagens antigas)", (unsigned long)old, (long)lines);
    Serial.println();
    return true;
}

bool sd_buffer_store(const char* topic, const char* payload) {
    if (!_ready) { diag_sd_write_errors++; return false; }
    size_t lt = strlen(topic), lp = strlen(payload), need = lt + lp + 2;
    if (need > SDQ_LINE_MAX) { diag_sd_write_errors++; Serial.println("[SD-BUF] mensagem grande demais, descartada"); return false; }
    if (_wsize >= SDQ_SEG_MAX) { _wseg++; _wsize = 0; }
    while (_total + need > SDQ_TOTAL_MAX && _dropOldest()) { SDQ_WDT(); }
    char p[32]; _path(_wseg, p, sizeof(p));
    File f = SD.open(p, FILE_APPEND);
    if (!f) { _markFail("abrir"); return false; }
    // Linha montada inteira e gravada numa unica chamada.
    memcpy(_line, topic, lt); _line[lt] = SDQ_TAB; memcpy(_line + lt + 1, payload, lp); _line[lt + 1 + lp] = SDQ_NL;
    size_t w = f.write((const uint8_t*)_line, need);
    f.close();
    if (w != need) {
        if (w > 0) { _wseg++; _wsize = 0; _total += w; }   // linha parcial: fecha o segmento
        _markFail("gravar");
        return false;
    }
    _fails = 0;
    _wsize += (uint32_t)need; _total += need;
    _pendAdd(1);
    diag_sd_writes++;
    return true;
}

int sd_buffer_pending() {
    if (!_hasData()) return 0;
    int32_t n = _rec ? (_recCount + _recDelta) : _pend;
    return n > 0 ? (int)n : 1;
}

void sd_buffer_tick() {
    unsigned long now = millis();
    if (!_ready) {
        if (_st == SDQ_FAIL && now - _lastMount >= SDQ_REMOUNT_MS) {
            _lastMount = now;
            Serial.println("[SD-BUF] tentando remontar o cartao...");
            _sdUnmountHw();
            if (_open()) { Serial.println("[SD-BUF] cartao de volta"); }
            else { _st = SDQ_FAIL; diag_sd_available = false; _sdUnmountHw(); }
        }
        return;
    }
    if (!_rec) return;
    // Contagem inicial em fatias: [ponteiro no inicio da contagem, fim da escrita naquele instante)
    unsigned long t0 = millis();
    while (millis() - t0 < SDQ_TICK_BUDGET_MS) {
        if (_recSeg > _recEndSeg || (_recSeg == _recEndSeg && _recOff >= _recEndOff)) {
            _rec = false; _pend = _recCount + _recDelta; if (_pend < 0) _pend = 0;
            Serial.printf("[SD-BUF] %ld mensagens pendentes na fila", (long)_pend); Serial.println();
            return;
        }
        char p[32]; _path(_recSeg, p, sizeof(p));
        File f = SD.open(p, FILE_READ);
        if (!f) { _recSeg = (_recSeg < _recEndSeg) ? _nextSeg(_recSeg) : _recEndSeg + 1; _recOff = 0; continue; }
        uint32_t lim = (_recSeg == _recEndSeg) ? _recEndOff : (uint32_t)f.size();
        f.seek(_recOff);
        uint8_t b[512];
        bool fim = false;
        while (millis() - t0 < SDQ_TICK_BUDGET_MS) {
            if (_recOff >= lim) { fim = true; break; }
            uint32_t want = lim - _recOff; if (want > sizeof(b)) want = sizeof(b);
            int r = f.read(b, want);
            if (r <= 0) { fim = true; break; }
            for (int i = 0; i < r; i++) if (b[i] == (uint8_t)SDQ_NL) _recCount++;
            _recOff += (uint32_t)r;
        }
        f.close();
        if (fim) {
            if (_recSeg < _recEndSeg) { _recSeg = _nextSeg(_recSeg); _recOff = 0; }
            else { _recSeg = _recEndSeg; _recOff = _recEndOff; }
        }
    }
}

int sd_buffer_drain(sd_buffer_publish_fn publish_fn, int max_send) {
    if (!publish_fn || !_hasData()) return 0;
    unsigned long t0 = millis();
    int limit = max_send > 0 ? max_send : 10;
    int sent = 0;
    bool moved = false, parar = false;
    while (!parar && sent < limit && millis() - t0 < SDQ_DRAIN_BUDGET_MS && _hasData()) {
        char p[32]; _path(_rseg, p, sizeof(p));
        File f = SD.open(p, FILE_READ);
        if (!f) {
            if (_rseg < _wseg) { _rseg = _nextSeg(_rseg); _roff = 0; moved = true; continue; }
            _markFail("ler"); break;
        }
        uint32_t size = (uint32_t)f.size();
        bool segFim = false;
        while (sent < limit && millis() - t0 < SDQ_DRAIN_BUDGET_MS) {
            SDQ_WDT();
            if (_roff >= size) { segFim = true; break; }
            f.seek(_roff);
            int r = f.read((uint8_t*)_line, SDQ_LINE_MAX);
            if (r <= 0) { segFim = true; break; }
            int nl = -1;
            for (int i = 0; i < r; i++) if (_line[i] == SDQ_NL) { nl = i; break; }
            if (nl < 0) {
                if (r >= SDQ_LINE_MAX) { _roff += (uint32_t)r; moved = true; continue; }   // lixo sem quebra: pula
                // Sem quebra no fim do arquivo = linha incompleta (queda no meio da gravacao).
                if (_rseg < _wseg) { _roff = size; moved = true; segFim = true; }
                else parar = true;   // segmento de escrita: nao consome
                break;
            }
            _line[nl] = 0;
            char* tab = strchr(_line, SDQ_TAB);
            if (!tab || tab == _line) { _roff += (uint32_t)nl + 1; moved = true; _pendAdd(-1); continue; }   // corrompida
            *tab = 0;
            if (!publish_fn(_line, tab + 1)) { parar = true; break; }
            _roff += (uint32_t)nl + 1; moved = true; sent++;
            diag_sd_resends++;
            _pendAdd(-1);
        }
        f.close();
        if (segFim && _rseg < _wseg) {
            uint32_t old = _rseg;
            _rseg = _nextSeg(_rseg); _roff = 0;
            _savePtr(); moved = false;               // ponteiro antes de apagar
            char op[32]; _path(old, op, sizeof(op));
            SD.remove(op);
            _total = (_total > size) ? _total - size : 0;
        } else if (segFim) {
            break;                                   // alcancou o fim da escrita
        }
    }
    if (moved) _savePtr();
    if (sent > 0) {
        Serial.printf("[SD-BUF] %d reenviadas (pendentes: %d)", sent, sd_buffer_pending());
        Serial.println();
    }
    return sent;
}

#ifdef SDQ_HOST
// So' no teste de host: simula o reinicio da TON (RAM zera; cartao e NVS ficam).
void sdq_host_reboot() {
    _st = SDQ_NOCARD; _ready = false; _everMounted = false;
    _rseg = _roff = _wseg = _wsize = _minSeg = 0; _total = 0; _pend = 0;
    _rec = false; _recSeg = _recOff = _recEndSeg = _recEndOff = 0; _recCount = _recDelta = 0;
    _fails = 0; _lastMount = 0; _discarded = 0;
}
#endif
`,

};
