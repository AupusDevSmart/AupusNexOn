// ==============================================================================
// TON3 (TON3) - Gerado pelo NexOn IoT
// ==============================================================================

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>          // WiFi.macAddress() — log de identidade no boot
#include <ArduinoJson.h>
#include <esp_task_wdt.h>

#include "hal.h"
#include "config.h"
#include "inputs.h"
#include "outputs.h"
#include "adc.h"
#include "sd_buffer.h"
#include "diag.h"
#include "eth.h"
#include "relays.h"
#include "mqtt.h"
#include "ota.h"

// Estado / timers
static unsigned long last_input_scan = 0;
static unsigned long last_evt        = 0;  // SOE: drenagem da fila de eventos do rele
static unsigned long last_sample     = 0;  // leitura Modbus RS485 (round-robin)
static unsigned long last_publish    = 0;  // publicacao MQTT RS485 (medias/deltas)
static unsigned long last_sample_tcp = 0;  // leitura Modbus TCP (round-robin via datalogger)
static unsigned long last_publish_tcp = 0; // publicacao MQTT TCP (medias/deltas)
static unsigned long last_evt_tcp    = 0;  // SOE: drenagem de eventos de rele TCP direto

// Publica em TOPIC_BASE/<sub>. Helper para modulos que nao conhecem o prefixo.
static void mqtt_publish_sub(const char* sub, const char* payload) {
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/%s", MQTT_TOPIC_BASE, sub);
    mqtt_publish(topic, payload);
}

// ===== ACK aplicacao-level para comandos =====
// Protocolo:
//   Backend publica em <BASE>/cmd com envelope: {"cmd_id":"<uuid>","cmd": <inner>}
//   <inner> pode ser string ("r1 on") ou objeto ({"device":"X","cmd":"cmd_fechar"})
//   TON publica resposta em <BASE>/cmd/ack: {"cmd_id","status","msg","ts"}
//   status: "ok" | "error" | "duplicate"
// Backward-compat: se nao houver cmd_id, executa sem publicar ack (legado).
// Dedup ring-buffer: tamanho 32 da' folga pra ate ~10s de retries do backend
// (timeout 5s x 3 attempts) e do gateway LoRa (timeout 2s x 3 attempts) sem
// que cmd_ids antigos sejam sobrescritos.
#define CMD_DEDUP_SIZE 32
static char _cmdSeen[CMD_DEDUP_SIZE][40];
static int  _cmdSeenIdx = 0;

static bool _cmd_seen_or_add(const char* cmd_id) {
    for (int i = 0; i < CMD_DEDUP_SIZE; i++) {
        if (_cmdSeen[i][0] && strcmp(_cmdSeen[i], cmd_id) == 0) return true;
    }
    strncpy(_cmdSeen[_cmdSeenIdx], cmd_id, sizeof(_cmdSeen[0]) - 1);
    _cmdSeen[_cmdSeenIdx][sizeof(_cmdSeen[0]) - 1] = 0;
    _cmdSeenIdx = (_cmdSeenIdx + 1) % CMD_DEDUP_SIZE;
    return false;
}

static void _publish_cmd_ack(const char* cmd_id, const char* status, const char* msg) {
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/cmd/ack", MQTT_TOPIC_BASE);
    char payload[256];
    snprintf(payload, sizeof(payload),
             "{\"cmd_id\":\"%s\",\"status\":\"%s\",\"msg\":\"%s\",\"ts\":%lu}",
             cmd_id, status, msg ? msg : "", (unsigned long)(millis() / 1000));
    mqtt_publish(topic, payload);
}

#include "bomba.h"   // posto de combustivel: maquina de estados em src/bomba.cpp (lib bomba_posto)
// Executa o comando bruto (sem envelope). Preenche result_msg com descricao curta.
// Retorna true em sucesso, false em erro.
static bool _process_command_inner(const char* raw, char* result_msg, size_t msg_sz) {
    if (!raw || !*raw) { snprintf(result_msg, msg_sz, "empty"); return false; }

    // Comando estruturado: {"device":"X","cmd":"cmd_fechar"}
    if (raw[0] == '{') {
        StaticJsonDocument<256> j;
        DeserializationError jerr = deserializeJson(j, raw);
        if (!jerr) {
            const char* dev = j["device"] | "";
            const char* cid = j["cmd"] | "";
            if (dev[0] && cid[0]) {
                snprintf(result_msg, msg_sz, "no_modbus_in_firmware");
                return false;
            }
        }
    }

    String cmd = String(raw); cmd.trim(); cmd.toLowerCase();
    if (cmd.length() == 0) { snprintf(result_msg, msg_sz, "empty"); return false; }

    if (cmd.length() >= 4 && cmd[0] == 'r' && cmd[1] >= '1' && cmd[1] <= '6') {
        bool on = cmd.indexOf("on") >= 0;
        relay_set(cmd[1] - '0', on);
        snprintf(result_msg, msg_sz, "rele_%c_%s", cmd[1], on ? "on" : "off");
        return true;
    }
    if (cmd.startsWith("tr") && cmd[2] >= '1' && cmd[2] <= '4') {
        bool on = cmd.indexOf("on") >= 0;
        output_set(cmd[2] - '0', on);
        snprintf(result_msg, msg_sz, "tr%c_%s", cmd[2], on ? "on" : "off");
        return true;
    }
    if (bomba_cmd(cmd, result_msg, msg_sz)) return true;   // posto: card <UID> | mat <n> | fluxo <L/min> | status | rearme | net off|on | lista
    if (cmd == "status") {
        Serial.printf("Entradas: %02X  Saidas: %02X\n", inputs_get_state(), outputs_get_state());
        snprintf(result_msg, msg_sz, "status_printed");
        return true;
    }

    snprintf(result_msg, msg_sz, "unknown_cmd");
    return false;
}

// Wrapper publico: detecta envelope com cmd_id, faz dedup e publica ack.
static void process_command(const char* raw) {
    if (!raw) return;

    char cmd_id[40] = {0};
    const char* effective = raw;
    static char inner_buf[512];

    // Detecta envelope: { "cmd_id": "...", "cmd": <inner> }
    if (raw[0] == '{') {
        StaticJsonDocument<512> env;
        if (deserializeJson(env, raw) == DeserializationError::Ok) {
            const char* id = env["cmd_id"] | "";
            if (id[0]) {
                strncpy(cmd_id, id, sizeof(cmd_id) - 1);

                if (_cmd_seen_or_add(cmd_id)) {
                    Serial.printf("[CMD] Duplicate cmd_id=%s ignorado\n", cmd_id);
                    _publish_cmd_ack(cmd_id, "duplicate", "already_seen");
                    return;
                }

                JsonVariantConst inner = env["cmd"];
                // ArduinoJson 7: em JsonVariantConst, is<JsonObject>() retorna false
                // mesmo pra objetos — precisa usar JsonObjectConst. Bug observado em
                // 2026-06-02 (ack "missing_cmd_field" mesmo com {"cmd":{...}} valido).
                if (inner.is<const char*>()) {
                    snprintf(inner_buf, sizeof(inner_buf), "%s", inner.as<const char*>());
                    effective = inner_buf;
                } else if (inner.is<JsonObjectConst>()) {
                    serializeJson(inner, inner_buf, sizeof(inner_buf));
                    effective = inner_buf;
                } else {
                    _publish_cmd_ack(cmd_id, "error", "missing_cmd_field");
                    return;
                }
            }
        }
    }

    char msg[64] = {0};
    bool ok = _process_command_inner(effective, msg, sizeof(msg));
    Serial.printf("[CMD] %s -> %s (%s)\n", effective, ok ? "OK" : "FAIL", msg);

    if (cmd_id[0]) {
        _publish_cmd_ack(cmd_id, ok ? "ok" : "error", msg);
    }
}

static inline void lora_handle_rx(const char*) {}
// Motivo do ultimo reset (diagnostico)
static const char* _resetReason() {
    switch (esp_reset_reason()) {
        case ESP_RST_POWERON:  return "Power-on";
        case ESP_RST_SW:       return "Software";
        case ESP_RST_PANIC:    return "Panic (crash)";
        case ESP_RST_INT_WDT:  return "Watchdog (interrupt)";
        case ESP_RST_TASK_WDT: return "Watchdog (task)";
        case ESP_RST_WDT:      return "Watchdog";
        case ESP_RST_BROWNOUT: return "Brownout (tensao baixa)";
        case ESP_RST_DEEPSLEEP:return "Deep-sleep wake";
        case ESP_RST_EXT:      return "External reset";
        default:               return "Unknown";
    }
}

// Alimentar o watchdog (chamar em loops longos / esperas)
static inline void feedWatchdog() { esp_task_wdt_reset(); }

void setup() {
    Serial.begin(115200);
    delay(2000);
    Serial.printf("\n  %s v%s - %s\n", DEVICE_ID, FIRMWARE_VERSION, DEVICE_MODEL);
    Serial.println("  [BOOT] RS485-fix v1.1: drain RX, flush preTx, retry 0xE0, delays 80/1000us");
    Serial.println("  [BOOT] MQTT-fix v1.2: setKeepAlive(60), setSocketTimeout(30), mqtt_loop entre blocos");
    Serial.println("  [BOOT] Cycle v1.2.1: METER_CYCLE_MS=4000 (era 2000) — menos pressao no Modbus/MQTT");
    Serial.println("  [BOOT] TCPlog v1.2.2: log inclui slave id pra desambiguar inversores TCP");
    Serial.println("  [BOOT] ClientID v1.3.0: MQTT_CLIENT_ID derivado do MAC (unico por hardware)");
    Serial.println("  [BOOT] CmdHR v1.4.0: bo_map suporta func 0x06 (writeSingleRegister) — Schneider VI");
    Serial.println("  [BOOT] CmdEnvFix v1.4.1: envelope {cmd_id, cmd:{...}} agora reconhece objeto aninhado");
    Serial.println("  [BOOT] SBO v1.5.0: bo_map suporta comandos compostos (steps[]) — Schneider Object control");
    Serial.printf("  [BOOT] MAC: %s\n", WiFi.macAddress().c_str());
    Serial.printf("  Motivo do reset: %s\n", _resetReason());
    Serial.printf("  Heap livre: %u bytes\n\n", ESP.getFreeHeap());

    // Diagnosticos: contadores globais (uptime, modbus_ok/err, mqtt_pub, sd_*, etc.)
    diag_init();

    // Watchdog em panic mode: reinicia a placa se travar
    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);
    Serial.printf("[OK] Watchdog %ds (panic=reboot)\n", WATCHDOG_TIMEOUT_S);

    // I2C
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(I2C_CLOCK_HZ);

    // Ethernet W5500: inicializar ANTES do SD Card.
    // Razao: no TON-TESTE de bancada (validado), o W5500 e' inicializado primeiro.
    // Iniciar SD antes do W5500 estava deixando o chip nao-detectado pelo SPI.
    eth_hw_init();

    // Perifericos
    if (inputs_init()) Serial.println("[OK] Entradas (6x optoacopladas)");
    else Serial.println("[FAIL] Entradas");

    if (relays_init()) Serial.println("[OK] Reles (6x ULN2803)");
    else Serial.println("[FAIL] Reles");

    outputs_init();
    Serial.println("[OK] Transistores (TR1-TR4)");

    adc_init();
    bomba_init();   // posto de combustivel: reles desligados, lista/sessao do NVS
    Serial.println("[OK] ADC (AN1/AN2)");

    // SD Card - buffer offline para MQTT
    if (sd_buffer_init()) {
        Serial.println("[OK] SD Buffer");
    } else {
        Serial.println("[WARN] SD nao disponivel - mensagens offline serao perdidas");
    }

    // WiFi + MQTT + OTA
    mqtt_init(process_command);
    ota_init();
    // Detecta boot pos-OTA: se em PENDING_VERIFY, arma contador de validacao.
    // Se travarmos antes de N publicacoes OK, bootloader reverte para anterior.
    ota_check_pending_verify();

    esp_task_wdt_reset();
    Serial.println("\nPronto!");
}

void loop() {
    esp_task_wdt_reset();
    diag_tick();  // atualiza min_free_heap a cada loop
    unsigned long now = millis();
    mqtt_loop();
    diag_publish_periodic();  // publica MQTT_TOPIC_BASE/diagnostics a cada DIAG_INTERVAL_MS

    // Durante OTA nao fazer mais nada (flash em andamento)
    if (ota_in_progress()) { delay(1); return; }

    // I/O edge-triggered: publica entradas/saidas SOMENTE quando mudam.
    // Estado inicial publicado no boot e republicado apos cada reconexao MQTT
    // (pra o backend nunca ficar sem o estado atual). Substitui o antigo status
    // periodico de ${MQTT_STATUS_MS}ms que poluia o broker com publicacoes redundantes.
    if (now - last_input_scan >= INPUT_SCAN_MS) {
        last_input_scan = now;
        inputs_scan();

        static bool _io_force = true;        // forca publicacao inicial (boot)
        static bool _mqtt_was_up = false;
        static uint8_t _prev_out = 0;
        static uint8_t _prev_rl = 0;

        // Detecta reconexao MQTT (false->true) pra republicar estado atual
        bool _mqtt_up = mqtt_connected();
        if (_mqtt_up && !_mqtt_was_up) _io_force = true;
        _mqtt_was_up = _mqtt_up;

        // Entradas digitais (on-change via debounce de inputs_changed)
        bool _in_changed = inputs_changed();   // sempre chama pra consumir o flag
        if (_io_force || _in_changed) {
            uint8_t s = inputs_get_state();
            char buf[80];
            snprintf(buf, sizeof(buf), "{\"d1\":%d,\"d2\":%d,\"d3\":%d,\"d4\":%d,\"d5\":%d,\"d6\":%d}",
                s&1, (s>>1)&1, (s>>2)&1, (s>>3)&1, (s>>4)&1, (s>>5)&1);
            mqtt_publish_raw(MQTT_TOPIC_INPUTS, buf);
        }

        // Saidas transistor (TR1-4) on-change. Em satellite vai via LoRa.
        uint8_t os = outputs_get_state();
        if (_io_force || os != _prev_out) {
            _prev_out = os;
            char obuf[60];
            snprintf(obuf, sizeof(obuf), "{\"tr1\":%d,\"tr2\":%d,\"tr3\":%d,\"tr4\":%d}",
                os&1, (os>>1)&1, (os>>2)&1, (os>>3)&1);
            mqtt_publish_raw(MQTT_TOPIC_OUTPUTS, obuf);
        }

        // Reles (R1-6) on-change.
        uint8_t rl = relays_get_state();
        if (_io_force || rl != _prev_rl) {
            _prev_rl = rl;
            char rbuf[80];
            snprintf(rbuf, sizeof(rbuf), "{\"r1\":%d,\"r2\":%d,\"r3\":%d,\"r4\":%d,\"r5\":%d,\"r6\":%d}",
                (rl>>1)&1, (rl>>2)&1, (rl>>3)&1, (rl>>4)&1, (rl>>5)&1, (rl>>6)&1);
            mqtt_publish_raw(MQTT_TOPIC_RELAYS, rbuf);
        }
        _io_force = false;
    }

    // Posto de combustivel: le BI/AI, roda a maquina de estados (lib bomba_posto), aplica BO, publica.
    bomba_loop(mqtt_publish_sub);

    // Serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        process_command(cmd.c_str());
    }
}
