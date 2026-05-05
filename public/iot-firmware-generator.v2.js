/**
 * IoT NexOn - Firmware Generator v2.0
 * Gera projetos PlatformIO a partir do diagrama IoT.
 * Baseado no firmware real TON v1.3.0 testado em hardware.
 *
 * Fluxo: Diagrama → analyze() → generateProject() → ZIP download
 */

var FirmwareGenerator = class FirmwareGenerator {
    constructor(diagramEditor) {
        this.editor = diagramEditor;
    }

    // ================================================================
    // ANALYZE — Percorre o diagrama e extrai specs de cada TON
    // ================================================================
    analyze() {
        const components = this.editor.components;
        const connections = this.editor.connections;
        const tonTypes = ['ton1', 'ton2', 'ton3', 'ton4'];
        const tons = components.filter(c => tonTypes.includes(c.type));
        return tons.map(ton => this._analyzeTon(ton, components, connections));
    }

    _analyzeTon(ton, components, connections) {
        const def = COMPONENT_TYPES[ton.type];
        const result = {
            tonId: ton.id,
            tonType: ton.type,
            name: ton.props.name || def.label,
            hostname: ton.props.ota_hostname || ton.props.name || def.label,
            topicBase: ton.props.mqtt_topic_base || '',
            // Vínculo opcional com equipamento NexOn — usado pelo botão
            // "Implantar OTA" no modal Firmware. Sem este ID o frontend
            // mostra mensagem orientativa em vez de chamar o backend.
            equipamentoId: (ton.props.equipamento_id || '').trim(),
            has_lora: def.has_lora || false,
            has_relays: def.has_relays || false,
            wifi: null,
            mqtt: null,
            rs485_devices: [],
            tcp_devices: [],
            lora: null,
            warnings: [],
        };

        const tonConns = connections.filter(
            c => c.from.componentId === ton.id || c.to.componentId === ton.id
        );

        for (const conn of tonConns) {
            const otherId = conn.from.componentId === ton.id
                ? conn.to.componentId : conn.from.componentId;
            const other = components.find(c => c.id === otherId);
            if (!other) continue;

            if (conn.style === 'wifi' || conn.style === 'ethernet') {
                this._processNetwork(ton, other, result, components, connections);
            } else if (conn.style === 'rs485') {
                this._processRS485(ton, other, result, components, connections);
            } else if (conn.style === 'tcp') {
                this._processTCP(ton, other, result, components, connections);
            } else if (conn.style === 'lora_radio') {
                this._processLoRa(ton, other, result);
            }
        }

        // MQTT config (from broker component or defaults)
        if (result.wifi && result.mqtt) {
            if (!result.mqtt.topic_base && result.topicBase) {
                result.mqtt.topic_base = result.topicBase;
            }
        } else if (result.wifi) {
            result.mqtt = {
                server: '72.60.158.163',
                port: 1883,
                topic_base: result.topicBase || result.name,
            };
        }

        // Warnings
        if (!result.wifi && !result.lora) {
            result.warnings.push('Sem WiFi nem LoRa — não conseguirá enviar dados');
        }
        if (result.rs485_devices.length === 0 && result.tcp_devices.length === 0) {
            result.warnings.push('Sem dispositivos de medição conectados');
        }

        return result;
    }

    _processNetwork(ton, other, result, components, connections) {
        if (other.type === 'wifi_router') {
            result.wifi = {
                ssid: other.props.ssid || '',
                password: other.props.password || '',
            };
            // Check if router connects to broker
            const brokerConns = connections.filter(c =>
                (c.from.componentId === other.id || c.to.componentId === other.id)
            );
            for (const bc of brokerConns) {
                const brokerId = bc.from.componentId === other.id ? bc.to.componentId : bc.from.componentId;
                const broker = components.find(c => c.id === brokerId);
                if (broker && broker.type === 'mqtt_broker') {
                    result.mqtt = {
                        server: broker.props.ip || '72.60.158.163',
                        port: broker.props.port || 1883,
                        topic_base: result.topicBase || result.name,
                    };
                }
            }
        } else if (other.type === 'mqtt_broker') {
            result.mqtt = {
                server: other.props.ip || '72.60.158.163',
                port: other.props.port || 1883,
                topic_base: result.topicBase || result.name,
            };
        }
    }

    _processRS485(ton, other, result, components, connections) {
        const deviceTypes = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];
        if (!deviceTypes.includes(other.type)) return;
        if (result.rs485_devices.find(d => d.componentId === other.id)) return;

        const catalogId = other.props.catalog_id;
        const dev = catalogId && typeof getCatalogDevice === 'function' ? getCatalogDevice(catalogId) : null;

        result.rs485_devices.push({
            componentId: other.id,
            name: other.props.name || COMPONENT_TYPES[other.type].label,
            type: other.type,
            modbus_address: other.props.modbus_address || 1,
            catalog_id: catalogId || null,
            catalog_device: dev,
            registros: dev ? dev.registros : [],
        });

        // Daisy-chain
        const chainConns = connections.filter(c =>
            (c.from.componentId === other.id || c.to.componentId === other.id) &&
            c.style === 'rs485'
        );
        for (const cc of chainConns) {
            const nextId = cc.from.componentId === other.id ? cc.to.componentId : cc.from.componentId;
            if (nextId === ton.id) continue;
            const next = components.find(c => c.id === nextId);
            if (next && deviceTypes.includes(next.type)) {
                this._processRS485(ton, next, result, components, connections);
            }
        }
    }

    _processTCP(ton, other, result, components, connections) {
        const deviceTypes = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];

        // Caso 1: TON ↔ Datalogger (TCP)
        // O datalogger agrupa inversores via RS485. Gerar tcp_devices para cada inversor.
        if (other.type === 'inverter_datalogger') {
            const gateway = {
                name: other.props.name || 'Datalogger',
                modelo: other.props.modelo || 'generico-tcp',
                ip: other.props.ip || '',
                port: other.props.tcp_port || 502,
                timeout_ms: other.props.timeout_ms || 2000,
            };

            // Descobrir inversores ligados ao datalogger via RS485
            if (connections) {
                const dlConns = connections.filter(c =>
                    (c.from.componentId === other.id || c.to.componentId === other.id) &&
                    c.style === 'rs485'
                );
                for (const cc of dlConns) {
                    const invId = cc.from.componentId === other.id ? cc.to.componentId : cc.from.componentId;
                    const inv = components.find(c => c.id === invId);
                    if (!inv || !deviceTypes.includes(inv.type)) continue;
                    if (result.tcp_devices.find(d => d.componentId === inv.id)) continue;

                    const catalogId = inv.props.catalog_id;
                    const dev = catalogId && typeof getCatalogDevice === 'function' ? getCatalogDevice(catalogId) : null;

                    result.tcp_devices.push({
                        componentId: inv.id,
                        name: inv.props.name || COMPONENT_TYPES[inv.type].label,
                        type: inv.type,
                        modbus_address: inv.props.modbus_address || 1,
                        catalog_id: catalogId || null,
                        catalog_device: dev,
                        registros: dev ? dev.registros : [],
                        gateway: gateway,
                    });
                }
            }
            return;
        }

        // Caso 2: TON ↔ Dispositivo TCP direto (sem datalogger)
        if (!deviceTypes.includes(other.type)) return;

        const catalogId = other.props.catalog_id;
        const dev = catalogId && typeof getCatalogDevice === 'function' ? getCatalogDevice(catalogId) : null;

        result.tcp_devices.push({
            componentId: other.id,
            name: other.props.name || COMPONENT_TYPES[other.type].label,
            type: other.type,
            modbus_address: other.props.modbus_address || 1,
            catalog_id: catalogId || null,
            catalog_device: dev,
            registros: dev ? dev.registros : [],
            gateway: null,
        });
    }

    _processLoRa(ton, other, result) {
        const loraTypes = ['ton2', 'ton4'];
        if (!loraTypes.includes(other.type)) return;
        result.lora = {
            mode: ton.props.lora_mode || 'tx',
            peer_name: other.props.name || other.type.toUpperCase(),
            peer_id: other.id,
        };
    }

    // ================================================================
    // CODE GENERATION
    // ================================================================

    generateProject(spec) {
        // Start with base files
        const files = {};
        for (const [path, content] of Object.entries(FIRMWARE_BASE)) {
            files[path] = content;
        }

        // Add/override generated files
        files['include/config.h'] = this._genConfigH(spec);
        files['src/mqtt.h'] = this._genMqttH();
        files['src/mqtt.cpp'] = this._genMqttCpp(spec);
        files['include/eth.h'] = this._genEthH();
        files['src/eth.cpp'] = this._genEthCpp();
        files['include/diag.h'] = this._genDiagH();
        files['src/diag.cpp'] = this._genDiagCpp(spec);
        files['src/main.cpp'] = this._genMainCpp(spec);

        // Modbus RTU (RS485) se ha dispositivos RS485
        if (spec.rs485_devices.length > 0) {
            files['include/modbus_meter.h'] = this._genModbusH(spec);
            files['src/modbus_meter.cpp'] = this._genModbusCpp(spec);
        }

        // Modbus TCP (via Datalogger/Gateway) se ha dispositivos TCP
        if (spec.tcp_devices.length > 0) {
            files['include/inverter_tcp.h'] = this._genInverterTcpH(spec);
            files['src/inverter_tcp.cpp'] = this._genInverterTcpCpp(spec);
        }

        // LoRa if enabled
        if (spec.has_lora) {
            files['src/lora.cpp'] = this._genLoraCpp(spec);
            files['include/lora.h'] = this._genLoraH();
        }

        // OTA depende de WiFi + MQTT_TOPIC_BASE. Sem WiFi, remove do projeto.
        if (!spec.wifi) {
            delete files['src/ota.cpp'];
            delete files['include/ota.h'];
        }

        return { name: spec.name, files, warnings: spec.warnings, spec };
    }

    // ---- inverter_tcp.h ----
    _genInverterTcpH(spec) {
        return `#ifndef INVERTER_TCP_H
#define INVERTER_TCP_H
#include <stdint.h>

struct InverterReading {
    float ger_diaria;      // kWh
    float ger_total;       // kWh
    float pot_ativa;       // W
    float pot_reativa;     // Var
    float pot_aparente;    // VA
    float fp;
    float freq;
    float va, vb, vc;      // V
    float ia, ib, ic;      // A
    float mppt_v[12];      // V
    float mppt_i[12];      // A
    uint16_t estado;
};

void inverter_tcp_init();
bool inverter_tcp_read(uint8_t slave_id, InverterReading &out);

#define TCP_INVERTER_COUNT ${spec.tcp_devices.filter(d => d.type === 'inversor').length}
extern const uint8_t TCP_INVERTER_IDS[];

#endif
`;
    }

    // ---- inverter_tcp.cpp ----
    _genInverterTcpCpp(spec) {
        const invs = spec.tcp_devices.filter(d => d.type === 'inversor' && d.gateway);
        if (invs.length === 0) {
            return `#include "inverter_tcp.h"
void inverter_tcp_init() {}
bool inverter_tcp_read(uint8_t, InverterReading &) { return false; }
const uint8_t TCP_INVERTER_IDS[] = {};
`;
        }

        // Gateway (todos os inversores TCP via datalogger compartilham o mesmo gateway)
        const gw = invs[0].gateway;
        const ids = invs.map(i => i.modbus_address).join(', ');

        return `#include "inverter_tcp.h"
#include "config.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <esp_task_wdt.h>

// Gateway (Datalogger)
#define GATEWAY_IP      "${gw.ip}"
#define GATEWAY_PORT    ${gw.port}
#define GATEWAY_TIMEOUT ${gw.timeout_ms}

const uint8_t TCP_INVERTER_IDS[] = {${ids}};

static WiFiClient _tcpClient;
static uint16_t _txId = 0;

void inverter_tcp_init() {
    Serial.printf("[TCP-INV] Gateway: %s:%d (timeout %dms)\\n",
        GATEWAY_IP, GATEWAY_PORT, GATEWAY_TIMEOUT);
    Serial.printf("[TCP-INV] Inversores: ");
    for (uint8_t i = 0; i < sizeof(TCP_INVERTER_IDS); i++) {
        Serial.printf("ID%d ", TCP_INVERTER_IDS[i]);
    }
    Serial.println();
}

static bool _modbus_tcp_read(uint8_t slave, uint8_t func, uint16_t addr, uint16_t count, uint16_t *out) {
    if (!WiFi.isConnected()) return false;

    if (!_tcpClient.connected()) {
        _tcpClient.setTimeout(GATEWAY_TIMEOUT / 1000);
        if (!_tcpClient.connect(GATEWAY_IP, GATEWAY_PORT)) {
            Serial.println("[TCP-INV] Falha ao conectar no gateway");
            return false;
        }
    }

    _txId++;
    uint8_t req[12];
    // MBAP Header
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;      // Protocol ID = 0
    req[4] = 0; req[5] = 6;      // Length = 6
    req[6] = slave;              // Unit ID
    // PDU
    req[7] = func;               // Function code
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = count >> 8; req[11] = count & 0xFF;

    _tcpClient.write(req, 12);
    _tcpClient.flush();

    // Aguardar resposta
    uint32_t t0 = millis();
    while (_tcpClient.available() < 9 && millis() - t0 < GATEWAY_TIMEOUT) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (_tcpClient.available() < 9) {
        Serial.printf("[TCP-INV] Timeout ID%d func%d addr%d\\n", slave, func, addr);
        return false;
    }

    // Ler MBAP + unit + func + byte count
    uint8_t hdr[9];
    _tcpClient.readBytes(hdr, 9);
    if (hdr[7] & 0x80) {
        Serial.printf("[TCP-INV] Erro Modbus: 0x%02X\\n", hdr[8]);
        // Ler exceção e descartar
        while (_tcpClient.available()) _tcpClient.read();
        return false;
    }

    uint8_t byteCount = hdr[8];
    uint8_t buf[256];
    _tcpClient.readBytes(buf, byteCount);

    for (uint16_t i = 0; i < count; i++) {
        out[i] = (buf[i*2] << 8) | buf[i*2+1];
    }
    return true;
}

bool inverter_tcp_read(uint8_t slave_id, InverterReading &out) {
    memset(&out, 0, sizeof(out));

    // Bloco 1: 5003-5024 (22 regs) - Yields, MPPT 1-3, V/I fases
    uint16_t b1[22];
    if (!_modbus_tcp_read(slave_id, 0x04, 5002, 22, b1)) return false;  // addr - 1

    out.ger_diaria   = b1[0] * 0.1f;
    out.ger_total    = ((uint32_t)b1[1] << 16 | b1[2]);
    out.pot_aparente = ((uint32_t)b1[6] << 16 | b1[7]);
    out.mppt_v[0] = b1[8]  * 0.1f;  out.mppt_i[0] = b1[9]  * 0.1f;
    out.mppt_v[1] = b1[10] * 0.1f;  out.mppt_i[1] = b1[11] * 0.1f;
    out.mppt_v[2] = b1[12] * 0.1f;  out.mppt_i[2] = b1[13] * 0.1f;
    out.va = b1[16] * 0.1f;  out.vb = b1[17] * 0.1f;  out.vc = b1[18] * 0.1f;
    out.ia = b1[19] * 0.1f;  out.ib = b1[20] * 0.1f;  out.ic = b1[21] * 0.1f;

    delay(50);

    // Bloco 2: 5031-5038 (8 regs) - Potencia, FP, Freq, Estado
    uint16_t b2[8];
    if (!_modbus_tcp_read(slave_id, 0x04, 5030, 8, b2)) return false;

    out.pot_ativa   = (int32_t)((uint32_t)b2[0] << 16 | b2[1]);
    out.pot_reativa = (int32_t)((uint32_t)b2[2] << 16 | b2[3]);
    out.fp          = (int16_t)b2[4] * 0.001f;
    out.freq        = b2[5] * 0.1f;
    out.estado      = b2[7];

    return true;
}
`;
    }

    // ---- config.h (variável por projeto) ----
    _genConfigH(spec) {
        let h = `#ifndef CONFIG_H
#define CONFIG_H
#include <stdint.h>

// ============================================================
// CONFIG - ${spec.name} (${spec.tonType.toUpperCase()})
// Gerado pelo NexOn IoT
// ============================================================

#define DEVICE_MODEL        "${spec.tonType.toUpperCase()}"
#define DEVICE_ID           "${spec.hostname}"
#define FIRMWARE_VERSION    "1.0.0"

// I2C
#define I2C_ADDR_RTC        0x68
#define I2C_ADDR_MUX_IN     0x26
#define I2C_ADDR_MUX_OUT    0x27
#define I2C_CLOCK_HZ        100000

// SPI
#define SPI_CLOCK_HZ        8000000

// RS485
#define RS485_UART_NUM      1
#define RS485_BAUD          9600
#define RS485_CONFIG        SERIAL_8N1
`;

        if (spec.has_lora) {
            h += `
// LoRa (E220-900T30D)
#define LORA_UART_NUM       2
#define LORA_BAUD           9600
#define LORA_CONFIG         SERIAL_8N1
#define LORA_MODE           "${(spec.lora?.mode || 'tx').toUpperCase()}"
`;
        }

        // WiFi
        if (spec.wifi) {
            h += `
// WiFi
#define WIFI_SSID           "${spec.wifi.ssid}"
#define WIFI_PASSWORD       "${spec.wifi.password}"
#define WIFI_TIMEOUT_MS     10000
`;
        }

        // MQTT
        if (spec.mqtt) {
            h += `
// MQTT
#define MQTT_SERVER         "${spec.mqtt.server}"
#define MQTT_PORT           ${spec.mqtt.port}
#define MQTT_USER           ""
#define MQTT_PASS           ""
#define MQTT_CLIENT_ID      "${spec.tonType.toUpperCase()}-" DEVICE_ID
#define MQTT_TOPIC_BASE     "${spec.mqtt.topic_base}"
#define MQTT_TOPIC_CMD      MQTT_TOPIC_BASE "/cmd"
#define MQTT_TOPIC_RELAYS   MQTT_TOPIC_BASE "/relays"
#define MQTT_TOPIC_INPUTS   MQTT_TOPIC_BASE "/inputs"
#define MQTT_TOPIC_OUTPUTS  MQTT_TOPIC_BASE "/outputs"
#define MQTT_TOPIC_METER    MQTT_TOPIC_BASE "/meter"
#define MQTT_BUFFER_SIZE    4096
#define DIAG_INTERVAL_MS    60000   // publica diagnostico a cada 60s
#define MQTT_STATUS_MS      60000
#define OTA_DOWNLOAD_TIMEOUT_MS 60000
`;
        }

        // Ethernet
        h += `
// Ethernet W5500
#define ETH_MAC             { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x01 }
#define ETH_DHCP_TIMEOUT_MS 10000
#define ETH_STATIC_IP       "192.168.1.200"
#define ETH_GATEWAY         "192.168.1.1"
#define ETH_SUBNET          "255.255.255.0"
#define ETH_DNS             "8.8.8.8"
`;

        // SD Card
        h += `
// SD Card
#define SD_BUFFER_FILE      "/datalog.csv"
#define SD_MAX_FILE_SIZE    (1024 * 1024)

// PWM
#define PWM_CHANNEL         0
#define PWM_FREQ_HZ         1000
#define PWM_RESOLUTION      8

// ADC
#define ADC_RESOLUTION_BITS 12
#define ADC_ATTEN           ADC_11db
#define ADC_DIVIDER         8.01

// MCP23008 pin mapping
#define MCP_INPUT_COUNT     6

// Timing
#define INPUT_SCAN_MS       50
#define WATCHDOG_TIMEOUT_S  60      // Watchdog mais generoso (60s) para lidar com Modbus lento
`;

        // Modbus devices (RS485 ou TCP)
        if (spec.rs485_devices.length > 0 || spec.tcp_devices.length > 0) {
            h += `
// Medidores Modbus
#define METER_CYCLE_MS      2000
#define PUBLISH_INTERVAL_MS 60000
#define MAX_READINGS        35
`;
        }

        h += `
#endif
`;
        return h;
    }

    // ---- mqtt.h ----
    _genMqttH() {
        return `#ifndef MQTT_H
#define MQTT_H

typedef void (*mqtt_cmd_callback_t)(const char* payload);

void mqtt_init(mqtt_cmd_callback_t callback);
void mqtt_loop();
bool mqtt_publish(const char* topic, const char* payload);
// Publica direto, sem fallback de SD (usado p/ diagnostics — nao faz sentido enfileirar).
bool mqtt_publish_raw(const char* topic, const char* payload);
bool mqtt_connected();
// Retorna nome da interface de rede ativa: "wifi" | "eth" | "none"
const char* mqtt_active_iface();

#endif
`;
    }

    // ---- diag.h ----
    _genDiagH() {
        return `#ifndef DIAG_H
#define DIAG_H
#include <stdint.h>

// Contadores globais de diagnostico (extern). Outros modulos incrementam estes diretamente.
extern uint32_t      diag_modbus_ok;
extern uint32_t      diag_modbus_err;
extern uint32_t      diag_mqtt_pub;
extern uint32_t      diag_publish_fails;
extern uint32_t      diag_wifi_disconnects;
extern uint32_t      diag_mqtt_disconnects;
extern uint32_t      diag_tcp_retries;
extern uint32_t      diag_sd_writes;
extern uint32_t      diag_sd_resends;
extern uint32_t      diag_sd_write_errors;
extern uint32_t      diag_min_free_heap;
extern bool          diag_sd_available;
extern bool          diag_tcp_connected;
extern unsigned long diag_last_successful_read_ms;
extern unsigned long diag_boot_time_ms;

void        diag_init();                  // chamar uma vez no setup()
void        diag_tick();                  // chamar todo loop (atualiza min_free_heap)
const char* diag_reset_reason();          // texto do esp_reset_reason()
void        diag_publish_periodic();      // publica em DIAG_TOPIC se passou DIAG_INTERVAL_MS

#endif
`;
    }

    // ---- diag.cpp ----
    _genDiagCpp(spec) {
        if (!spec.wifi) {
            return `#include "diag.h"
// Sem WiFi: stubs vazios.
uint32_t diag_modbus_ok = 0;          uint32_t diag_modbus_err = 0;
uint32_t diag_mqtt_pub = 0;           uint32_t diag_publish_fails = 0;
uint32_t diag_wifi_disconnects = 0;   uint32_t diag_mqtt_disconnects = 0;
uint32_t diag_tcp_retries = 0;
uint32_t diag_sd_writes = 0;          uint32_t diag_sd_resends = 0;          uint32_t diag_sd_write_errors = 0;
uint32_t diag_min_free_heap = 0xFFFFFFFFu;
bool     diag_sd_available = false;   bool     diag_tcp_connected = false;
unsigned long diag_last_successful_read_ms = 0;  unsigned long diag_boot_time_ms = 0;
void diag_init() {}
void diag_tick() {}
const char* diag_reset_reason() { return "Unknown"; }
void diag_publish_periodic() {}
`;
        }

        return `#include "diag.h"
#include "config.h"
#include "mqtt.h"
#include "ota.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <esp_system.h>

uint32_t diag_modbus_ok = 0;
uint32_t diag_modbus_err = 0;
uint32_t diag_mqtt_pub = 0;
uint32_t diag_publish_fails = 0;
uint32_t diag_wifi_disconnects = 0;
uint32_t diag_mqtt_disconnects = 0;
uint32_t diag_tcp_retries = 0;
uint32_t diag_sd_writes = 0;
uint32_t diag_sd_resends = 0;
uint32_t diag_sd_write_errors = 0;
uint32_t diag_min_free_heap = 0xFFFFFFFFu;
bool     diag_sd_available = false;
bool     diag_tcp_connected = false;
unsigned long diag_last_successful_read_ms = 0;
unsigned long diag_boot_time_ms = 0;

static unsigned long _lastDiagPub = 0;

void diag_init() {
    diag_boot_time_ms = millis();
    diag_min_free_heap = ESP.getFreeHeap();
}

void diag_tick() {
    uint32_t f = ESP.getFreeHeap();
    if (f < diag_min_free_heap) diag_min_free_heap = f;
}

const char* diag_reset_reason() {
    switch (esp_reset_reason()) {
        case ESP_RST_POWERON:  return "Power-on";
        case ESP_RST_SW:       return "Software";
        case ESP_RST_PANIC:    return "Panic";
        case ESP_RST_INT_WDT:
        case ESP_RST_TASK_WDT:
        case ESP_RST_WDT:      return "Watchdog";
        case ESP_RST_BROWNOUT: return "Brownout";
        case ESP_RST_DEEPSLEEP: return "DeepSleep";
        default:               return "Unknown";
    }
}

void diag_publish_periodic() {
    if (!mqtt_connected()) return;
    if (millis() - _lastDiagPub < DIAG_INTERVAL_MS) return;
    _lastDiagPub = millis();

    StaticJsonDocument<1024> doc;
    doc["device"]            = DEVICE_MODEL;
    doc["mac"]               = WiFi.macAddress();
    // IP reportado e' o da interface ATIVA no MQTT (wifi ou eth)
    {
        const char* iface = mqtt_active_iface();
        doc["iface"] = iface;
        if (strcmp(iface, "eth") == 0) {
            extern IPAddress eth_local_ip();
            doc["ip"] = eth_local_ip().toString();
        } else {
            doc["ip"] = WiFi.localIP().toString();
        }
    }
    doc["uptime_sec"]        = (uint32_t)((millis() - diag_boot_time_ms) / 1000);
    doc["free_heap"]         = ESP.getFreeHeap();
    doc["wifi_rssi"]         = WiFi.RSSI();
    doc["tcp_connected"]     = diag_tcp_connected;
    doc["tcp_retries"]       = diag_tcp_retries;
    doc["modbus_ok"]         = diag_modbus_ok;
    doc["modbus_err"]        = diag_modbus_err;
    doc["mqtt_pub"]          = diag_mqtt_pub;
    doc["publish_fails"]     = diag_publish_fails;
    doc["wifi_disconnects"]  = diag_wifi_disconnects;
    doc["mqtt_disconnects"]  = diag_mqtt_disconnects;
    doc["sd_available"]      = diag_sd_available;
    doc["sd_writes"]         = diag_sd_writes;
    doc["sd_resends"]        = diag_sd_resends;
    doc["sd_write_errors"]   = diag_sd_write_errors;
    doc["min_free_heap"]     = diag_min_free_heap;
    doc["reset_reason"]      = diag_reset_reason();
    if (diag_last_successful_read_ms > 0) {
        doc["silence_sec"] = (uint32_t)((millis() - diag_last_successful_read_ms) / 1000);
    } else {
        doc["silence_sec"] = 0;
    }

    char json[1024];
    size_t sz = serializeJson(doc, json, sizeof(json));
    if (sz == 0) return;

    char topic[160];
    snprintf(topic, sizeof(topic), "%s/diagnostics", MQTT_TOPIC_BASE);
    if (mqtt_publish_raw(topic, json)) {
        // Diagnostic gerado e publicado pelo firmware NOVO ao vivo: prova que
        // WiFi+MQTT+JSON+counters estao funcionando. Conta como validacao OTA
        // (cobre o caso patologico de TON sem telemetria periodica via mqtt_publish).
        ota_confirm_valid_if_needed();
        // Heartbeat visual no serial: confirma que o pipe MQTT esta vivo.
        Serial.printf("[MQTT] diag publicado em %s/diagnostics (iface=%s, total_pubs=%lu)\\n",
                      MQTT_TOPIC_BASE, mqtt_active_iface(), (unsigned long)diag_mqtt_pub);
    } else {
        Serial.printf("[MQTT] FALHA ao publicar diagnostics (iface=%s)\\n", mqtt_active_iface());
    }
}
`;
    }

    // ---- mqtt.cpp ----
    _genMqttCpp(spec) {
        if (!spec.wifi) {
            return `#include "mqtt.h"
void mqtt_init(mqtt_cmd_callback_t cb) {}
void mqtt_loop() {}
bool mqtt_publish(const char* t, const char* p) { return false; }
bool mqtt_connected() { return false; }
`;
        }

        return `#include "mqtt.h"
#include "ota.h"
#include "sd_buffer.h"
#include "diag.h"
#include "eth.h"
#include "config.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_task_wdt.h>
#include <string.h>
#include <time.h>

// Janelas de retry/drain — evita saturar o broker ao reconectar.
// Publicacoes sao feitas normalmente em tempo real; a drenagem do SD e gradual.
#define WIFI_RECONNECT_MS   15000UL   // tenta WiFi.reconnect() no maximo a cada 15s
#define MQTT_RECONNECT_MS   5000UL    // tenta mqtt.connect() no maximo a cada 5s
#define SD_DRAIN_INTERVAL_MS 10000UL  // drena no maximo uma vez a cada 10s
#define SD_DRAIN_BATCH       5        // no maximo 5 mensagens retro por ciclo de drain
#define SD_DRAIN_ON_RECONNECT 5       // primeira leva ao reconectar (nao sobrecarrega)
#define NET_EVAL_INTERVAL_MS 30000UL  // re-avalia rede a cada 30s (detecta cabo plugado/perdido)

// Interface ativa para o MQTT (escolhida automaticamente, troca em tempo de execucao)
enum NetIf { NET_NONE=0, NET_WIFI=1, NET_ETH=2 };
static NetIf _activeIf = NET_NONE;

static WiFiClient     _wifiClient;
static PubSubClient _mqtt(_wifiClient);  // PubSubClient::setClient() troca o transport sem recriar
static mqtt_cmd_callback_t _cmdCallback = nullptr;
static unsigned long _lastReconnect = 0;
static unsigned long _lastWifiReconnect = 0;
static unsigned long _lastDrain = 0;
static unsigned long _lastNetEval = 0;
static bool _wasConnected = false;
static bool _timeSynced = false;

// Helpers para identificar/observar a interface ativa
static const char* _ifName(NetIf i) {
    switch (i) { case NET_WIFI: return "wifi"; case NET_ETH: return "eth"; default: return "none"; }
}
static String _ifLocalIp() {
    if (_activeIf == NET_ETH) return eth_local_ip().toString();
    if (_activeIf == NET_WIFI && WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();
    return String("0.0.0.0");
}
const char* mqtt_active_iface() { return _ifName(_activeIf); }

// Garante que o transport do PubSubClient bate com a interface alvo.
// Chama disconnect() antes de trocar (PubSubClient nao gosta de troca em conexao viva).
static void _setActiveIf(NetIf target) {
    if (target == _activeIf) return;
    if (_mqtt.connected()) _mqtt.disconnect();
    if (target == NET_ETH) {
        _mqtt.setClient(eth_get_client());
    } else {
        _mqtt.setClient(_wifiClient);
    }
    Serial.printf("[NET] Trocando interface: %s -> %s\\n", _ifName(_activeIf), _ifName(target));
    _activeIf = target;
    _wasConnected = false;
    diag_tcp_connected = (target == NET_ETH);
}

// Avalia qual interface tem internet "boa" agora e troca se necessario.
// Politica: Ethernet ganha sempre que cabo plugado e tem IP. Se cair, volta WiFi.
// Loga MUDANCAS de estado (link UP/DOWN, IP perdido) sempre, e um heartbeat
// resumido a cada 60s pra confirmar que a avaliacao esta rodando.
static void _evalNetwork() {
    static bool _prevLink   = false;
    static bool _prevHasIp  = false;
    static bool _prevWifiOk = false;
    static unsigned long _lastHeartbeat = 0;

    bool linkUp  = eth_link_up();

    // Loga transicoes do link Ethernet (cabo plugado/desplugado)
    if (linkUp != _prevLink) {
        Serial.printf("[NET] Cabo Ethernet: link %s\\n", linkUp ? "UP" : "DOWN");
        _prevLink = linkUp;
    }

    bool ethReady = false;
    if (linkUp) {
        ethReady = eth_check_dhcp();  // pode pegar IP se cabo acabou de ser plugado
    }
    bool wifiReady = (WiFi.status() == WL_CONNECTED);

    // Loga transicoes de IP/conexao
    if (ethReady != _prevHasIp) {
        Serial.printf("[NET] Ethernet IP: %s\\n", ethReady ? "obtido" : "perdido");
        _prevHasIp = ethReady;
    }
    if (wifiReady != _prevWifiOk) {
        Serial.printf("[NET] WiFi: %s\\n", wifiReady ? "conectado" : "desconectado");
        _prevWifiOk = wifiReady;
    }

    // Decisao de troca
    if (ethReady && _activeIf != NET_ETH) {
        Serial.println("[NET] Cabo Ethernet detectado com IP — preferindo Ethernet");
        _setActiveIf(NET_ETH);
    } else if (!ethReady && _activeIf == NET_ETH && wifiReady) {
        Serial.println("[NET] Cabo Ethernet sem IP/link — voltando para WiFi");
        _setActiveIf(NET_WIFI);
    } else if (_activeIf == NET_NONE) {
        if (ethReady)        _setActiveIf(NET_ETH);
        else if (wifiReady)  _setActiveIf(NET_WIFI);
    }

    // Heartbeat a cada 60s — mostra estado das duas interfaces e quem esta ativa
    if (millis() - _lastHeartbeat > 60000UL) {
        _lastHeartbeat = millis();
        Serial.printf("[NET] estado: ativo=%s | eth=%s/%s%s | wifi=%s%s\\n",
            _ifName(_activeIf),
            linkUp ? "link-UP" : "link-DOWN",
            ethReady ? "ip-OK" : "no-ip",
            (_activeIf == NET_ETH ? " *" : ""),
            wifiReady ? "OK" : "off",
            (_activeIf == NET_WIFI ? " *" : ""));
    }
}

// Forward decl
bool mqtt_publish_raw(const char* topic, const char* payload);

// Sync NTP apos WiFi conectar. Nao bloqueia — apenas arranca o processo.
static void _start_ntp() {
    configTime(-3 * 3600, 0, "pool.ntp.org", "time.google.com");
}

// Salva no SD com timestamp injetado no JSON (se possivel).
// Formato: "{\\"ts\\":<epoch>, ... resto do payload}"
// Se o relogio nao estiver sincronizado, ou o payload nao for JSON,
// salva como esta (sem ts) para nao perder dados.
static void _store_offline(const char* topic, const char* payload) {
    time_t now = time(nullptr);
    bool haveTime = (now > 1700000000);
    if (haveTime) _timeSynced = true;

    if (haveTime && payload && payload[0] == '{' && strstr(payload, "\\"ts\\"") == nullptr) {
        // Cabe ate ~3200 bytes (payload de inversor + overhead do ts)
        char withTs[3200];
        int n = snprintf(withTs, sizeof(withTs), "{\\"ts\\":%lu,%s",
                         (unsigned long)now, payload + 1);
        if (n > 0 && n < (int)sizeof(withTs)) {
            sd_buffer_store(topic, withTs);
            return;
        }
    }
    sd_buffer_store(topic, payload);
}

// Callback unico: despacha OTA (TOPIC_BASE/ota/cmd) antes de entregar o
// restante ao callback de usuario (TOPIC_BASE/cmd).
static void _onMessage(char* topic, byte* payload, unsigned int len) {
    static char buf[1200]; // grande para caber JSON OTA
    if (len >= sizeof(buf)) len = sizeof(buf) - 1;
    memcpy(buf, payload, len);
    buf[len] = 0;

    if (strstr(topic, "/ota/cmd") != nullptr) {
        Serial.printf("[MQTT] OTA cmd recebido (%u bytes)\\n", len);
        ota_handle_command(buf);
        return;
    }

    Serial.printf("[MQTT] Recebido: %s -> %s\\n", topic, buf);
    if (_cmdCallback) _cmdCallback(buf);
}

void mqtt_init(mqtt_cmd_callback_t callback) {
    _cmdCallback = callback;

    // 1) Ethernet (W5500) — tenta primeiro. Se cabo plugado, ganha do WiFi.
    //    Mesmo se nao houver cabo no boot, deixamos o W5500 inicializado para
    //    detectar plug a quente em _evalNetwork().
    eth_hw_init();
    bool ethReady = eth_check_dhcp();   // tenta DHCP se link UP

    // 2) WiFi — sempre liga, mesmo com Ethernet OK (fallback automatico).
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("[WIFI] Conectando a '%s'...\\n", WIFI_SSID);
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < WIFI_TIMEOUT_MS) {
        delay(500); Serial.print(".");
        esp_task_wdt_reset();
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\\n[WIFI] IP: %s\\n", WiFi.localIP().toString().c_str());
        _start_ntp();
    } else {
        Serial.println("\\n[WIFI] FALHOU - continuara tentando em background");
    }

    // 3) Decisao inicial: Ethernet vence se tiver IP, senao WiFi (mesmo se cair, OK).
    if (ethReady) {
        Serial.println("[NET] Usando Ethernet (cabo detectado com IP)");
        _setActiveIf(NET_ETH);
    } else if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[NET] Usando WiFi");
        _setActiveIf(NET_WIFI);
    } else {
        Serial.println("[NET] Sem rede ainda — irei tentando em background");
    }

    // MQTT (PubSubClient — transport ja foi setado por _setActiveIf)
    _mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    bool bufok = _mqtt.setBufferSize(MQTT_BUFFER_SIZE);
    Serial.printf("[MQTT] Buffer %d bytes: %s\\n", MQTT_BUFFER_SIZE, bufok ? "OK" : "FAIL (heap?)");
    _mqtt.setCallback(_onMessage);
}

void mqtt_loop() {
    // Mantem stack do W5500 atualizada (DHCP renew, etc.)
    eth_maintain();

    // Re-avalia interface ativa periodicamente — detecta cabo plugado/perdido a quente.
    if (millis() - _lastNetEval > NET_EVAL_INTERVAL_MS) {
        _lastNetEval = millis();
        _evalNetwork();
    }

    // Detecta queda de WiFi para o contador
    static bool _wifiWasConn = false;
    bool wifiNow = (WiFi.status() == WL_CONNECTED);
    if (_wifiWasConn && !wifiNow) {
        diag_wifi_disconnects++;
        Serial.printf("[ALERTA] WiFi desconectou (#%lu)\\n", (unsigned long)diag_wifi_disconnects);
    }
    _wifiWasConn = wifiNow;

    // Tem alguma rede usavel? (Ethernet com IP OU WiFi conectado)
    bool ethOk = eth_has_ip();
    bool netUp = ethOk || wifiNow;

    if (!netUp) {
        // Sem nenhuma rede. Tenta reconectar WiFi em background (Ethernet eh detectado em _evalNetwork).
        if (millis() - _lastWifiReconnect > WIFI_RECONNECT_MS) {
            _lastWifiReconnect = millis();
            Serial.println("[WIFI] Desconectado — reconectando em background...");
            WiFi.reconnect();
        }
        if (_wasConnected) {
            Serial.println("[MQTT] DESCONECTADO - mensagens irao para o SD (com timestamp)");
            _wasConnected = false;
            diag_mqtt_disconnects++;
        }
        return;
    }

    // Se eh a primeira vez que temos rede, decide a interface inicial.
    if (_activeIf == NET_NONE) {
        _setActiveIf(ethOk ? NET_ETH : NET_WIFI);
    }

    // WiFi OK — inicializar NTP se ainda nao iniciou (caso tenha conectado apos o boot)
    if (!_timeSynced) {
        time_t now = time(nullptr);
        if (now < 1700000000) {
            // Ainda nao sincronizou — rekick periodico
            if (millis() - _lastWifiReconnect > WIFI_RECONNECT_MS) {
                _lastWifiReconnect = millis();
                _start_ntp();
            }
        } else {
            _timeSynced = true;
            Serial.println("[NTP] Tempo sincronizado");
        }
    }

    if (_mqtt.connected()) {
        _mqtt.loop();
        // Drena retroativo aos poucos: no maximo SD_DRAIN_BATCH msgs por SD_DRAIN_INTERVAL_MS.
        // Isto garante que tempo real + retroativo nao sobrecarregue o broker.
        if (millis() - _lastDrain > SD_DRAIN_INTERVAL_MS) {
            _lastDrain = millis();
            int pending = sd_buffer_pending();
            if (pending > 0) {
                Serial.printf("[MQTT] Drenando retroativo (%d pendentes, batch %d)...\\n",
                              pending, SD_DRAIN_BATCH);
                sd_buffer_drain(mqtt_publish_raw, SD_DRAIN_BATCH);
            }
        }
        return;
    }

    // MQTT desconectado (mas WiFi OK) — tentar reconectar
    if (_wasConnected) {
        Serial.println("[MQTT] DESCONECTADO - mensagens irao para o SD (com timestamp)");
        _wasConnected = false;
        diag_mqtt_disconnects++;
    }
    if (millis() - _lastReconnect < MQTT_RECONNECT_MS) return;
    _lastReconnect = millis();

    Serial.printf("[MQTT] Conectando a %s:%d (%s)...\\n", MQTT_SERVER, MQTT_PORT, MQTT_CLIENT_ID);
    // Last Will em TOPIC_BASE/status (QoS 1, retained) -> sinaliza offline se cair
    String willTopic = String(MQTT_TOPIC_BASE) + "/status";
    const char* willMsg = "{\\"online\\":false}";

    bool ok;
    if (strlen(MQTT_USER) > 0) {
        ok = _mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS,
                           willTopic.c_str(), 1, true, willMsg);
    } else {
        ok = _mqtt.connect(MQTT_CLIENT_ID, nullptr, nullptr,
                           willTopic.c_str(), 1, true, willMsg);
    }

    if (ok) {
        Serial.println("[MQTT] Conectado!");
        _wasConnected = true;
        _mqtt.subscribe(MQTT_TOPIC_CMD);
        String otaCmdTopic = String(MQTT_TOPIC_BASE) + "/ota/cmd";
        _mqtt.subscribe(otaCmdTopic.c_str());
        Serial.printf("[MQTT] Inscrito em: %s\\n[MQTT] Inscrito em: %s\\n",
                      MQTT_TOPIC_CMD, otaCmdTopic.c_str());

        // Announce online + identidade (retained). Inclui MAC, IP da interface
        // ativa e qual interface (wifi/eth) — backend usa para auto-discovery.
        char hello[256];
        snprintf(hello, sizeof(hello),
                 "{\\"online\\":true,\\"version\\":\\"%s\\",\\"model\\":\\"%s\\",\\"mac\\":\\"%s\\",\\"ip\\":\\"%s\\",\\"iface\\":\\"%s\\"}",
                 FIRMWARE_VERSION, DEVICE_MODEL,
                 WiFi.macAddress().c_str(),
                 _ifLocalIp().c_str(),
                 _ifName(_activeIf));
        _mqtt.publish(willTopic.c_str(), hello, true);

        // Primeira leva ao reconectar — pequena, so pra confirmar fluxo.
        // O resto sera drenado pelo _lastDrain no mqtt_loop, aos poucos.
        int pending = sd_buffer_pending();
        if (pending > 0) {
            Serial.printf("[MQTT] Reconectado - %d mensagens no SD, iniciando drain gradual...\\n", pending);
            sd_buffer_drain(mqtt_publish_raw, SD_DRAIN_ON_RECONNECT);
            _lastDrain = millis();  // espera SD_DRAIN_INTERVAL_MS antes do proximo lote
        }
    }
}

// Publica direto, sem fallback de SD (usado pela drain para evitar loop)
bool mqtt_publish_raw(const char* topic, const char* payload) {
    if (!_mqtt.connected()) return false;
    bool ok = _mqtt.publish(topic, payload);
    if (ok) diag_mqtt_pub++;
    else    diag_publish_fails++;
    return ok;
}

bool mqtt_publish(const char* topic, const char* payload) {
    if (!_mqtt.connected()) {
        Serial.printf("[MQTT] PUB FAIL (desconectado): %s -> SD\\n", topic);
        diag_publish_fails++;
        _store_offline(topic, payload);
        return false;
    }
    size_t plen = strlen(payload);
    size_t tlen = strlen(topic);
    bool ok = _mqtt.publish(topic, payload);
    if (ok) {
        diag_mqtt_pub++;
        // Sinaliza execucao saudavel: apos N pubs OK pos-OTA,
        // confirma firmware como valido (cancela rollback do bootloader).
        ota_confirm_valid_if_needed();
    } else {
        diag_publish_fails++;
        Serial.printf("[MQTT] PUB FAIL: %s (payload=%u bytes, topic=%u bytes, state=%d) -> SD\\n",
                      topic, (unsigned)plen, (unsigned)tlen, _mqtt.state());
        _store_offline(topic, payload);
    }
    return ok;
}

bool mqtt_connected() { return _mqtt.connected(); }
`;
    }

    // ---- eth.h ----
    _genEthH() {
        return `#ifndef ETH_H
#define ETH_H
#include <Arduino.h>
#include <Ethernet.h>
#include <IPAddress.h>

bool eth_hw_init();           // Inicializa W5500 (so a parte fisica/SPI). Sem DHCP.
bool eth_link_up();           // Cabo plugado e link UP?
bool eth_has_ip();            // Temos IP atribuido (DHCP ou estatico)?
bool eth_check_dhcp();        // Tenta DHCP se link UP e ainda sem IP. true = temos IP no fim.
EthernetClient& eth_get_client();
IPAddress       eth_local_ip();

// Compat antigos
bool eth_init();
bool eth_connected();
void eth_maintain();

#endif
`;
    }

    // ---- eth.cpp ----
    _genEthCpp() {
        return `#include "hal.h"
#include "config.h"
#include <SPI.h>
#include <Ethernet.h>
#include <WiFi.h>   // pra usarmos esp_efuse_mac_get_default

static byte _mac[6];
static bool _hwReady = false;
static bool _hasIp   = false;
static EthernetClient _ethClient;

// Deriva MAC unico da TON a partir do eFuse (MAC WiFi base + 1).
// Evita colisao quando mais de uma TON estao na mesma rede.
static void _deriveMac() {
    uint8_t base[6];
    WiFi.macAddress(base);
    memcpy(_mac, base, 6);
    _mac[0] |= 0x02;  // localmente administrado, evita colisao com OUIs reais
    _mac[5] = (uint8_t)((base[5] + 1) & 0xFF);
}

// Le diretamente o Version Register do W5500 (endereco 0x0039 do bloco Common Register).
// W5500 sempre retorna 0x04 nesse registro. Mesmo metodo do TON-TESTE/main.cpp.
// SPI a 1 MHz (mais confiavel pra diagnostico do que os 14 MHz default).
static uint8_t _w5500_read_version() {
    digitalWrite(W5500_CS, LOW);
    SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
    SPI.transfer(0x00);   // address high byte
    SPI.transfer(0x39);   // address low byte (Version Register)
    SPI.transfer(0x01);   // control: Common Register, Read mode
    uint8_t ver = SPI.transfer(0x00);
    SPI.endTransaction();
    digitalWrite(W5500_CS, HIGH);
    return ver;
}

bool eth_hw_init() {
    if (_hwReady) return true;
    _deriveMac();

    Serial.printf("[ETH] Iniciando W5500 — pinos: CS=%d RST=%d MOSI=%d MISO=%d SCLK=%d\\n",
                  W5500_CS, W5500_RST, SPI2_MOSI_PIN, SPI2_MISO_PIN, SPI2_SCLK_PIN);

    // Mesma sequencia de reset do TON-TESTE (validada em hardware)
    pinMode(W5500_CS, OUTPUT);
    digitalWrite(W5500_CS, HIGH);
    pinMode(W5500_RST, OUTPUT);
    digitalWrite(W5500_RST, LOW); delay(50);
    digitalWrite(W5500_RST, HIGH); delay(500);    // PHY ready (datasheet: >=150ms)

    SPI.begin(SPI2_SCLK_PIN, SPI2_MISO_PIN, SPI2_MOSI_PIN);

    // Le o Version Register direto via SPI — fonte de verdade:
    // 0x04 = W5500 OK | 0x00 ou 0xFF = chip nao responde
    uint8_t ver = _w5500_read_version();
    Serial.printf("[ETH] Version register (0x39): 0x%02X (esperado 0x04)\\n", ver);
    _hwReady = (ver == 0x04);

    if (_hwReady) {
        Ethernet.init(W5500_CS);
        Serial.printf("[ETH] OK — W5500 detectado, MAC %02X:%02X:%02X:%02X:%02X:%02X\\n",
                      _mac[0], _mac[1], _mac[2], _mac[3], _mac[4], _mac[5]);
    } else {
        // Diagnostico extra de MISO em high-Z
        pinMode(SPI2_MISO_PIN, INPUT_PULLUP);
        int misoUp = digitalRead(SPI2_MISO_PIN);
        pinMode(SPI2_MISO_PIN, INPUT_PULLDOWN);
        int misoDown = digitalRead(SPI2_MISO_PIN);
        Serial.printf("[ETH] MISO high-Z: pull-up=%d pull-down=%d "
                      "(ambos seguem o pull = MISO flutuando, chip ausente/desligado)\\n",
                      misoUp, misoDown);
        Serial.println("[ETH] FALHA: W5500 nao respondeu. Cheque solda, 3V3, pinos SPI e RST.");
    }
    return _hwReady;
}

bool eth_link_up() {
    if (!_hwReady) return false;
    return Ethernet.linkStatus() == LinkON;
}

bool eth_has_ip() { return _hwReady && _hasIp; }

// Tenta DHCP se link UP e ainda nao temos IP. Retorna true se temos IP via DHCP.
// IMPORTANTE: NAO faz fallback automatico para IP estatico — se DHCP falhar, retorna false
// e a logica de switching mantem WiFi (rede provavelmente nao serve a TON).
// Para usar IP estatico explicitamente, ative ETH_USE_STATIC_FALLBACK no config.h.
bool eth_check_dhcp() {
    if (!_hwReady) return false;
    if (!eth_link_up()) {
        if (_hasIp) {
            Serial.println("[ETH] Link DOWN — perdemos IP");
            _hasIp = false;
        }
        return false;
    }
    if (_hasIp) return true;

    Serial.printf("[ETH] Link UP, tentando DHCP (timeout %lums)...\\n",
                  (unsigned long)ETH_DHCP_TIMEOUT_MS);
    if (Ethernet.begin(_mac, ETH_DHCP_TIMEOUT_MS) != 0) {
        _hasIp = true;
        Serial.printf("[ETH] DHCP OK -> %s | gw=%s | dns=%s\\n",
                      Ethernet.localIP().toString().c_str(),
                      Ethernet.gatewayIP().toString().c_str(),
                      Ethernet.dnsServerIP().toString().c_str());
        return true;
    }

#ifdef ETH_USE_STATIC_FALLBACK
    // Fallback IP estatico — so se explicitamente habilitado no config.
    // Cuidado: se a rede nao for ETH_STATIC_IP/SUBNET, o broker fica inalcancavel.
    IPAddress ip, gw, sn, dns;
    ip.fromString(ETH_STATIC_IP); gw.fromString(ETH_GATEWAY);
    sn.fromString(ETH_SUBNET); dns.fromString(ETH_DNS);
    Ethernet.begin(_mac, ip, dns, gw, sn);
    _hasIp = (Ethernet.localIP() != IPAddress(0, 0, 0, 0));
    if (_hasIp) {
        Serial.printf("[ETH] DHCP falhou, IP estatico %s\\n", Ethernet.localIP().toString().c_str());
    } else {
        Serial.println("[ETH] Sem IP (DHCP falhou e estatico tambem)");
    }
    return _hasIp;
#else
    Serial.println("[ETH] DHCP falhou — sem IP. Mantendo WiFi.");
    _hasIp = false;
    return false;
#endif
}

EthernetClient& eth_get_client() { return _ethClient; }

IPAddress eth_local_ip() { return Ethernet.localIP(); }

// === Compat: mantidas para nao quebrar quem ja chamava ===
bool eth_init()       { return eth_hw_init() && eth_check_dhcp(); }
bool eth_connected()  { return eth_has_ip(); }
void eth_maintain()   { if (_hwReady) Ethernet.maintain(); }
`;
    }

    // ---- lora.h ----
    _genLoraH() {
        return `#ifndef LORA_H
#define LORA_H
#include <Arduino.h>

void lora_init();
void lora_send(const char* msg);
bool lora_available();
String lora_read();
bool lora_ready();

#endif
`;
    }

    // ---- lora.cpp ----
    _genLoraCpp(spec) {
        return `#include "lora.h"
#include "hal.h"
#include "config.h"
#include <esp_task_wdt.h>

#define LORA_SERIAL Serial2

void lora_init() {
    pinMode(LORA_AUX, INPUT);
    LORA_SERIAL.begin(LORA_BAUD, LORA_CONFIG, UART2_TX, UART2_RX);
    unsigned long t = millis();
    while (!digitalRead(LORA_AUX) && millis() - t < 2000) { delay(10); esp_task_wdt_reset(); }
    Serial.printf("[LORA] E220 AUX=%s\\n", digitalRead(LORA_AUX) ? "OK" : "FALHA");
}

void lora_send(const char* msg) {
    unsigned long t = millis();
    while (!digitalRead(LORA_AUX) && millis() - t < 1000) { delay(1); esp_task_wdt_reset(); }
    LORA_SERIAL.println(msg);
    LORA_SERIAL.flush();
}

bool lora_available() { return LORA_SERIAL.available() > 0; }
String lora_read() {
    if (!LORA_SERIAL.available()) return "";
    LORA_SERIAL.setTimeout(100);
    String msg = LORA_SERIAL.readStringUntil('\\n');
    msg.trim();
    return msg;
}
bool lora_ready() { return digitalRead(LORA_AUX) == HIGH; }
`;
    }

    // ============================================================
    // Modbus dinâmico — gerado a partir de DEVICE_MODELS do catálogo.
    // Suporta: func 0x03 (holding), 0x04 (input), 0x01 (coils), 0x05 (write coil).
    // DataTypes: U16, S16, U32, S32, COSFI, U32_SUM3 (Pextron).
    // ============================================================

    _genModbusH(spec) {
        return `#ifndef MODBUS_METER_H
#define MODBUS_METER_H
#include <stdint.h>

typedef void (*modbus_publish_fn)(const char* subtopic, const char* payload);

void modbus_init();

// Acumulacao + media. Chamar a cada READ_INTERVAL_MS (round-robin 1 device por call)
// Internamente cicla entre os devices.
void modbus_sample_one();

// Publica medias acumuladas e reseta contadores. Chamar a cada PUBLISH_INTERVAL_MS.
void modbus_publish_all(modbus_publish_fn publish);

// Wrapper legado: faz sample de todos e publica imediatamente (sem media).
void modbus_read_all(modbus_publish_fn publish);

// Executa comando BO (write coil). device_name do catalogo, cmd_id conforme bo_map.
bool modbus_exec_command(const char* device_name, const char* cmd_id);

#endif
`;
    }

    _genModbusCpp(spec) {
        const devs = (spec.rs485_devices || []).filter(d => d.catalog_device);

        let cpp = `#include "modbus_meter.h"
#include "hal.h"
#include "config.h"
#include "diag.h"
#include <ModbusMaster.h>
#include <ArduinoJson.h>
#include <string.h>
#include <math.h>
#include <time.h>

static ModbusMaster _mb;
static HardwareSerial _rs485(RS485_UART_NUM);

static void _preTx()  { digitalWrite(RS485_DIR, HIGH); delayMicroseconds(500); }
static void _postTx() { delayMicroseconds(500); digitalWrite(RS485_DIR, LOW); }

static inline void _select(uint8_t addr) {
    _mb.begin(addr, _rs485);
    _mb.preTransmission(_preTx);
    _mb.postTransmission(_postTx);
}

// Decodifica 2 regs 16-bit como IEEE 754 float (32-bit). Usado por dataType='FLOAT'.
static inline float _u32_to_float(uint16_t hi, uint16_t lo) {
    uint32_t u = ((uint32_t)hi << 16) | (uint32_t)lo;
    float f;
    memcpy(&f, &u, sizeof(float));
    return f;
}

// Timestamp formatado "DD/MM/YYYY HH:MM:SS" no timezone local (configurado via configTime).
// Fallback "sem_ntp" se o relogio nao estiver sincronizado.
static String _format_timestamp_str() {
    time_t now = time(nullptr);
    if (now < 1700000000) return String("sem_ntp");
    struct tm* t = localtime(&now);
    char buf[24];
    sprintf(buf, "%02d/%02d/%04d %02d:%02d:%02d",
            t->tm_mday, t->tm_mon + 1, t->tm_year + 1900,
            t->tm_hour, t->tm_min, t->tm_sec);
    return String(buf);
}

// Mapeia codigo de work_state Sungrow -> texto (mesmo do UFV-SOLAR_POWER)
static const char* _work_state_text(uint16_t s) {
    switch (s) {
        case 0x0000: return "Run";
        case 0x8000: return "Stop";
        case 0x1300: return "Key Stop";
        case 0x1500: return "Emergency Stop";
        case 0x1400: return "Standby";
        case 0x1200: return "Initial Standby";
        case 0x1600: return "Starting";
        case 0x9100: return "Alarm Run";
        case 0x8100: return "Derating Run";
        case 0x8200: return "Dispatch Run";
        case 0x5500: return "Fault";
        case 0x2500: return "Communication Fault";
        case 0x1111: return "Uninitialized";
        default:     return "Unknown";
    }
}

void modbus_init() {
    pinMode(RS485_DIR, OUTPUT);
    digitalWrite(RS485_DIR, LOW);
    _rs485.begin(RS485_BAUD, RS485_CONFIG, UART1_RX, UART1_TX);
    Serial.printf("[RS485] TX=%d RX=%d DIR=%d %d baud\\n",
                  UART1_TX, UART1_RX, RS485_DIR, RS485_BAUD);
}

`;

        if (devs.length === 0) {
            cpp += `void modbus_sample_one() {}
void modbus_publish_all(modbus_publish_fn) {}
void modbus_read_all(modbus_publish_fn) {}
bool modbus_exec_command(const char*, const char*) { return false; }
`;
            return cpp;
        }

        // Um bloco de codigo por device
        devs.forEach((dev, idx) => {
            cpp += this._genDeviceReader(dev, idx);
        });

        // Round-robin sample: 1 device por chamada
        cpp += `
static int _rr_idx = 0;
static const int _dev_count = ${devs.length};

void modbus_sample_one() {
    switch (_rr_idx) {
`;
        devs.forEach((_, idx) => {
            cpp += `        case ${idx}: _sample_dev_${idx}(); break;\n`;
        });
        cpp += `    }
    _rr_idx = (_rr_idx + 1) % _dev_count;
}

void modbus_publish_all(modbus_publish_fn publish) {
    if (!publish) return;
`;
        devs.forEach((_, idx) => {
            cpp += `    _publish_dev_${idx}(publish);\n`;
        });
        cpp += `}

// Legado: sample todos + publica (sem media)
void modbus_read_all(modbus_publish_fn publish) {
    if (!publish) return;
`;
        devs.forEach((_, idx) => {
            cpp += `    _sample_dev_${idx}();\n    _publish_dev_${idx}(publish);\n`;
        });
        cpp += `}

bool modbus_exec_command(const char* device_name, const char* cmd_id) {
    if (!device_name || !cmd_id) return false;
`;
        devs.forEach((dev) => {
            const bo = (dev.catalog_device && dev.catalog_device.bo_map) || {};
            const cmds = Object.entries(bo);
            if (cmds.length === 0) return;
            cpp += `    if (strcmp(device_name, "${this._escStr(dev.name)}") == 0) {\n`;
            cpp += `        _select(${dev.modbus_address});\n`;
            cmds.forEach(([cid, m]) => {
                const func = m.func || 0x05;
                if (func === 0x05) {
                    cpp += `        if (strcmp(cmd_id, "${this._escStr(cid)}") == 0) {\n`;
                    cpp += `            return _mb.writeSingleCoil(${m.coil}, true) == _mb.ku8MBSuccess;\n`;
                    cpp += `        }\n`;
                }
            });
            cpp += `        return false;\n    }\n`;
        });
        cpp += `    return false;
}
`;
        return cpp;
    }

    // Gera _sample_dev_<idx>() (acumula) e _publish_dev_<idx>(publish) (processa + reseta)
    _genDeviceReader(dev, idx) {
        const cat = dev.catalog_device;
        const blocks = cat.ai_blocks || [];
        const aiMap = cat.ai_map || {};
        const biBlock = cat.bi_block || null;
        const biMap = cat.bi_map || {};
        const scales = cat.scales || {};
        const topicName = `${dev.name || 'dev'}_${dev.modbus_address}`;
        const deviceName = this._escStr(topicName);

        const blockOffsets = [];
        let acc = 0;
        for (const b of blocks) { blockOffsets.push(acc); acc += b.count; }
        const totalRegs = Math.max(acc, 1);

        // Classificar campos por modo
        const avgFields = [];    // media das amostras
        const lastFields = [];   // ultimo valor
        const deltaFields = [];  // ultimo - primeiro

        const wordOrder = cat.word_order || 'high_first';

        for (const [pid, m] of Object.entries(aiMap)) {
            if (m.block === undefined || m.offset === undefined) continue;
            if (m.block >= blocks.length) continue;
            const base = blockOffsets[m.block];
            const i0 = base + m.offset;
            const scale = this._resolveScale(m.scale, scales);
            let decoder = this._decodeExpr(m.dataType || 'U16', 'buf', i0, scale, m, wordOrder);
            if (!decoder) continue;

            // Aplica fator TP/TC quando configurado no campo (vide cat.tp_tc).
            // Replica comportamento das referências PlatformIO (M-160 LORA_TX_MODBUS,
            // PD666 EV-PD666_USR_MQTT). Variáveis _fTP/_fTC/_fatorEnergia são
            // computadas no início do _sample_dev_${idx}.
            // FLAG DE DIAGNÓSTICO: setar IOT_DISABLE_TP_TC = true desativa toda
            // a feature pra isolar regressões. Default: ativada.
            if (m.apply_factor && !this._tpTcDisabled()) {
                const factorVar = m.apply_factor === 'tp'    ? '_fTP'
                                : m.apply_factor === 'tc'    ? '_fTC'
                                : m.apply_factor === 'tp_tc' ? '_fatorEnergia'
                                : null;
                if (factorVar) decoder = `(${decoder}) * ${factorVar}`;
            }

            const mode = m.mode || 'avg';
            const entry = { pid, decoder, clamp: !!m.clamp_negative, format: m.format || null };
            if (mode === 'last') lastFields.push(entry);
            else if (mode === 'delta') deltaFields.push(entry);
            else avgFields.push(entry);
        }

        const biCount = biBlock && Object.keys(biMap).length > 0 ? Object.keys(biMap).length : 0;

        let cpp = `
// =========================================================================
// ${dev.name} (${cat.fabricante || '?'} ${cat.modelo || cat.tipo || '?'})
// Endereco Modbus: ${dev.modbus_address}
// Modos: ${avgFields.length} avg, ${lastFields.length} last, ${deltaFields.length} delta
// =========================================================================

struct _Dev${idx}State {
    // Acumuladores (somas para media)
    double sum_[${Math.max(avgFields.length, 1)}];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[${Math.max(avgFields.length + lastFields.length + deltaFields.length, 1)}];
    // Primeira amostra de delta (snapshot no inicio do ciclo)
    float first_delta_[${Math.max(deltaFields.length, 1)}];
    bool has_first_delta;
    // Estados BI da ultima leitura
    uint8_t bi_[${Math.max(biCount, 1)}];
    bool valid;
    int fail_streak;  // leituras consecutivas falhas (diagnostico)
};
static _Dev${idx}State _ds${idx} = {};

static bool _read_dev_${idx}_raw(uint16_t *buf) {
    _select(${dev.modbus_address});
`;

        if (cat.handshake) {
            const h = cat.handshake;
            const fn = h.func === 0x04 ? 'readInputRegisters' : 'readHoldingRegisters';
            cpp += `    // Handshake
    _mb.${fn}(${h.register}, ${h.count});
    delay(30);
`;
        }

        blocks.forEach((b, bi) => {
            const fn = b.func === 0x04 ? 'readInputRegisters'
                    : b.func === 0x01 ? 'readCoils'
                    : 'readHoldingRegisters';
            const off = blockOffsets[bi];
            cpp += `    // Bloco ${bi}: reg ${b.start}, count ${b.count}, func 0x${b.func.toString(16).padStart(2,'0')}${b.label ? ' - ' + b.label : ''}
    {
        uint8_t rc = _mb.${fn}(${b.start}, ${b.count});
        if (rc != _mb.ku8MBSuccess) {
            // 1 retry (timeout=0xE2, CRC=0xE3, IllegalAddr=0x02, IllegalFn=0x01, SlaveFail=0x04)
            delay(50);
            rc = _mb.${fn}(${b.start}, ${b.count});
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < ${b.count}; i++) buf[${off} + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] ${topicName} bloco ${bi} FAIL (reg=${b.start} count=${b.count} rc=0x%02X)\\n", rc);
            return false;
        }
    }
    delay(40);
`;
        });

        cpp += `    return true;
}

// Le + acumula. Chamar a cada READ_INTERVAL_MS.
static void _sample_dev_${idx}() {
    uint16_t buf[${totalRegs}];
    if (!_read_dev_${idx}_raw(buf)) {
        _ds${idx}.fail_streak++;
        Serial.printf("[MB] ${topicName}: falha leitura (consecutivas: %d)\\n", _ds${idx}.fail_streak);
        return;
    }
    diag_last_successful_read_ms = millis();
    if (_ds${idx}.fail_streak > 0) {
        Serial.printf("[MB] ${topicName}: OK (apos %d falhas consecutivas)\\n", _ds${idx}.fail_streak);
        _ds${idx}.fail_streak = 0;
    }

`;
        // Bloco TP/TC: lê separadamente do bloco principal e calcula fatores.
        // Defaults 1.0 garantem degrade graceful se a leitura falhar.
        // Comportamento replica referências PlatformIO (regs separados, scale
        // independente). Variáveis usadas pelos decoders via apply_factor.
        // FLAG DE DIAGNÓSTICO: vide _tpTcDisabled() abaixo.
        if (cat.tp_tc && !this._tpTcDisabled()) {
            const t = cat.tp_tc;
            const sTp = (Number(t.scale_tp) || 1).toFixed(1);
            const sTc = (Number(t.scale_tc) || 1).toFixed(1);
            cpp += `    // TP/TC para escalonamento (lido a cada ciclo, replica refs PlatformIO)
    float _fTP = 1.0f, _fTC = 1.0f, _fatorEnergia = 1.0f;
    {
        delay(40);
        uint8_t rc_tptc = _mb.readHoldingRegisters(${t.register}, ${t.count});
        if (rc_tptc == _mb.ku8MBSuccess) {
            uint16_t _tp_raw = _mb.getResponseBuffer(${t.tp_offset});
            uint16_t _tc_raw = _mb.getResponseBuffer(${t.tc_offset});
            _fTP = (float)_tp_raw / ${sTp}f;
            _fTC = (float)_tc_raw / ${sTc}f;
            _fatorEnergia = _fTP * _fTC;
        } else {
            // Mantém defaults 1.0 — energia/potência ficam sem fator (TP=TC=1)
        }
    }

`;
        }

        // Decodificar todos os campos (avg + last + delta) usando 'buf'
        // Acumular 'avg' em sum_
        avgFields.forEach((f, i) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
            cpp += `    _ds${idx}.sum_[${i}] += v_${f.pid};\n`;
        });

        // Guardar 'last' para todos os campos não-avg também (para publicação)
        lastFields.forEach((f) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
        });
        deltaFields.forEach((f, i) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
            cpp += `    if (!_ds${idx}.has_first_delta) { _ds${idx}.first_delta_[${i}] = v_${f.pid}; }\n`;
        });

        if (deltaFields.length > 0) {
            cpp += `    if (!_ds${idx}.has_first_delta) _ds${idx}.has_first_delta = true;\n`;
        }

        // Salvar last_ em ordem (avg + last + delta)
        let lastIdx = 0;
        [...avgFields, ...lastFields, ...deltaFields].forEach(f => {
            cpp += `    _ds${idx}.last_[${lastIdx++}] = v_${f.pid};\n`;
        });

        cpp += `    _ds${idx}.samples++;\n`;

        // Log de debug: mostra os principais campos lidos a cada sample
        cpp += `    // Log de debug — mostra principais valores lidos\n`;
        cpp += `    Serial.printf("[MB] ${topicName} #%d: ", _ds${idx}.samples);\n`;

        // Priorizar campos mais informativos: V, I, P, e alguns "last" tipicos
        const preferredOrder = ['vab', 'vbc', 'vca', 'va', 'vb', 'vc',
                                'ia', 'ib', 'ic',
                                'potencia_ativa', 'pa_total', 'dc_total_power',
                                'freq_rede', 'freq', 'fator_potencia', 'fp', 'fp_total',
                                'mppt1_voltage', 'mppt1_v', 'temp_interna',
                                'daily_yield', 'total_yield', 'work_state',
                                'geracao_diaria', 'geracao_total', 'estado_operacao',
                                'energia_ativa_imp', 'consumo_ativa_imp'];
        const logFields = [];
        // Adicionar até 6 campos na ordem de preferência
        for (const pid of preferredOrder) {
            if (aiMap[pid] && logFields.length < 6) {
                const m = aiMap[pid];
                if (m.block !== undefined && m.offset !== undefined && m.block < blocks.length) {
                    logFields.push(pid);
                }
            }
        }
        logFields.forEach((pid, i) => {
            cpp += `    Serial.printf("${pid}=%.2f${i < logFields.length - 1 ? ' ' : ''}", v_${pid});\n`;
        });
        cpp += `    Serial.println();\n`;

        // BI
        if (biCount > 0) {
            cpp += `
    // BI coils
    if (_mb.readCoils(${biBlock.start}, ${biBlock.count}) == _mb.ku8MBSuccess) {
`;
            let bi = 0;
            for (const [pid, m] of Object.entries(biMap)) {
                if (m.coil === undefined) continue;
                const reg = Math.floor(m.coil / 16);
                const bit = m.coil % 16;
                cpp += `        _ds${idx}.bi_[${bi++}] = (_mb.getResponseBuffer(${reg}) >> ${bit}) & 1;\n`;
            }
            cpp += `    }
`;
        }

        cpp += `    _ds${idx}.valid = true;
}

// Publica JSON (medias + last + delta) e reseta acumuladores. Chamar a cada PUBLISH_INTERVAL_MS.
static void _publish_dev_${idx}(modbus_publish_fn publish) {
    if (!_ds${idx}.valid || _ds${idx}.samples == 0) {
        publish("${deviceName}/status", "{\\"error\\":\\"no_samples\\"}");
        return;
    }

    int n = _ds${idx}.samples;
    StaticJsonDocument<3072> d;
`;

        // --- Resolver path JSON para cada pid (usa DEVICE_POINTS[tipo]) ---
        const tipo = (typeof DEVICE_POINTS !== 'undefined' && cat.tipo) ? DEVICE_POINTS[cat.tipo] : null;
        const tipoAi = tipo ? (tipo.ai || []) : [];
        const tipoBi = tipo ? (tipo.bi || []) : [];

        // Config de publicacao: timestamp_format, timestamp_position, meta_fields
        const pubCfg = (tipo && tipo.publish) || {};
        const tsFormat   = pubCfg.timestamp_format   || 'epoch';
        const tsPosition = pubCfg.timestamp_position || 'first';
        const metaFields = pubCfg.meta_fields || ['inverter_id', 'samples'];
        const tsExpr = (tsFormat === 'datetime')
            ? '_format_timestamp_str()'
            : '(long)time(nullptr)';

        if (tsPosition === 'first') {
            cpp += `    d["timestamp"] = ${tsExpr};\n`;
        }
        if (metaFields.includes('inverter_id')) {
            cpp += `    d["inverter_id"] = ${dev.modbus_address};\n`;
        }
        if (metaFields.includes('samples')) {
            cpp += `    d["samples"] = n;\n`;
        }
        cpp += `\n`;
        const resolveJsonPath = (pid) => {
            const exactAi = tipoAi.find(a => a.id === pid);
            if (exactAi && exactAi.json) return exactAi.json;
            const exactBi = tipoBi.find(a => a.id === pid);
            if (exactBi && exactBi.json) return exactBi.json;
            for (const a of tipoAi) {
                if (a.per_instance && a.prefix && a.suffix) {
                    const re = new RegExp(`^${a.prefix}\\d+${a.suffix}$`);
                    if (re.test(pid)) return `${a.group || 'dc'}.${pid}`;
                }
            }
            return pid;
        };

        // --- Coleta expressoes fonte para cada pid ---
        const fieldSources = {}; // pid -> { expr, format }
        avgFields.forEach((f, i) => {
            fieldSources[f.pid] = { expr: `(float)(_ds${idx}.sum_[${i}] / n)`, format: f.format, raw: false };
        });
        let lastRunIdx = avgFields.length;
        lastFields.forEach((f) => {
            fieldSources[f.pid] = { expr: `_ds${idx}.last_[${lastRunIdx++}]`, format: f.format, raw: false };
        });
        const deltaExprs = {}; // pid -> { lastI, deltaIdx, clamp }
        deltaFields.forEach((f, i) => {
            const lastI = avgFields.length + lastFields.length + i;
            deltaExprs[f.pid] = { lastI, deltaIdx: i, clamp: !!f.clamp, format: f.format };
            // Placeholder — real expr resolvido ao emitir (usa variavel local dv_pid)
            fieldSources[f.pid] = { expr: `dv_${f.pid}`, format: f.format, raw: false };
        });
        if (biCount > 0) {
            let bi = 0;
            for (const [pid, m] of Object.entries(biMap)) {
                if (m.coil === undefined) continue;
                fieldSources[pid] = { expr: `_ds${idx}.bi_[${bi++}]`, format: null, raw: false };
            }
        }

        // --- Agrupar por top-level key do json path ---
        // Pre-popular groups na ordem definida pelo tipo (info, energy, ..., pid)
        // para que o JSON de saida tenha a mesma ordem de campos do UFV-SOLAR_POWER.
        const groups = {};        // topKey -> [{ subKey, pid, src }]
        for (const a of [...tipoAi, ...tipoBi]) {
            if (a.json && a.json.includes('.')) {
                const top = a.json.split('.')[0];
                if (!groups[top]) groups[top] = [];
            } else if (a.group) {
                // per_instance: usa group como top-level
                if (!groups[a.group]) groups[a.group] = [];
            }
        }
        const topLevelFields = []; // flat fields
        for (const [pid, src] of Object.entries(fieldSources)) {
            const path = resolveJsonPath(pid);
            const parts = path.split('.');
            if (parts.length === 1) {
                topLevelFields.push({ key: parts[0], pid, src });
            } else {
                const top = parts[0];
                const rest = parts.slice(1).join('.');
                if (!groups[top]) groups[top] = [];
                groups[top].push({ subKey: rest, pid, src });
            }
        }

        // --- Emitir delta (precisa calcular dv_<pid> antes de usar) ---
        Object.entries(deltaExprs).forEach(([pid, de]) => {
            cpp += `    float dv_${pid} = _ds${idx}.last_[${de.lastI}] - _ds${idx}.first_delta_[${de.deltaIdx}];\n`;
            if (de.clamp) {
                cpp += `    if (dv_${pid} < 0 || fabsf(dv_${pid}) < 1e-6f) dv_${pid} = 0;\n`;
            }
        });

        // --- Ordenar topLevelFields pela ordem do tipo.ai/bi (saida flat consistente) ---
        const aiOrder = new Map();
        [...tipoAi, ...tipoBi].forEach((a, i) => aiOrder.set(a.id, i));
        topLevelFields.sort((a, b) => {
            const ia = aiOrder.has(a.pid) ? aiOrder.get(a.pid) : 999 + a.pid.localeCompare('');
            const ib = aiOrder.has(b.pid) ? aiOrder.get(b.pid) : 999 + b.pid.localeCompare('');
            return ia - ib;
        });

        // --- Emitir top-level fields ---
        topLevelFields.forEach(({ key, src }) => {
            if (src.format === 'hex') {
                cpp += `    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(${src.expr})); d["${this._escStr(key)}"] = String(_h); }\n`;
            } else {
                cpp += `    d["${this._escStr(key)}"] = ${src.expr};\n`;
            }
        });

        // --- Reordenar groups conforme tipo.group_order (se definido) ---
        if (tipo && Array.isArray(tipo.group_order)) {
            const ordered = {};
            for (const g of tipo.group_order) if (groups[g]) ordered[g] = groups[g];
            for (const g of Object.keys(groups)) if (!ordered[g]) ordered[g] = groups[g];
            // sobrescreve
            Object.keys(groups).forEach(k => delete groups[k]);
            Object.assign(groups, ordered);
        }

        // --- Emitir grupos aninhados (pula grupos vazios) ---
        for (const [groupKey, fields] of Object.entries(groups)) {
            if (fields.length === 0 && groupKey !== 'status') continue;
            const gvar = `g_${groupKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            cpp += `    JsonObject ${gvar} = d.createNestedObject("${this._escStr(groupKey)}");\n`;
            fields.forEach(({ subKey, src }) => {
                if (src.format === 'hex') {
                    cpp += `    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(${src.expr})); ${gvar}["${this._escStr(subKey)}"] = String(_h); }\n`;
                } else {
                    cpp += `    ${gvar}["${this._escStr(subKey)}"] = ${src.expr};\n`;
                }
            });
            // status.work_state_text: se o grupo for 'status' e tivermos work_state, adiciona o texto tambem
            if (groupKey === 'status' && fieldSources['work_state']) {
                cpp += `    ${gvar}["work_state_text"] = _work_state_text((uint16_t)${fieldSources['work_state'].expr});\n`;
            }
        }

        // --- Timestamp no fim, se configurado ---
        if (tsPosition === 'last') {
            cpp += `    d["timestamp"] = ${tsExpr};\n`;
        }

        cpp += `
    char payload[3072];
    size_t sz = serializeJson(d, payload, sizeof(payload));
    if (sz > 0) {
        publish("${deviceName}/data", payload);
        Serial.printf("\\n===== PUBLICADO: ${topicName} (%d amostras) =====\\n", n);
        Serial.println(payload);
        Serial.println();
    }

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
`;
        if (deltaFields.length > 0) {
            // Copia o último para primeiro do próximo ciclo (delta continuo)
            deltaFields.forEach((_, i) => {
                const lastI = avgFields.length + lastFields.length + i;
                cpp += `    _ds${idx}.first_delta_[${i}] = _ds${idx}.last_[${lastI}];\n`;
            });
        }
        cpp += `    for (int i = 0; i < ${Math.max(avgFields.length, 1)}; i++) _ds${idx}.sum_[i] = 0;
    _ds${idx}.samples = 0;
}
`;
        return cpp;
    }

    // Traduz dataType + scale em expressao C++ que devolve float
    // wordOrder: 'high_first' (default, big-endian word: reg[N]=high, reg[N+1]=low)
    //         ou 'low_first' (Sungrow: reg[N]=low, reg[N+1]=high)
    _decodeExpr(dataType, buf, idx0, scale, meta, wordOrder = 'high_first') {
        const s = Number(scale) || 1;
        const scaleExpr = s === 1 ? '' : ` / ${s.toFixed(6).replace(/0+$/, '').replace(/\.$/, '.0')}`;
        const hi = wordOrder === 'low_first' ? `${buf}[${idx0}+1]` : `${buf}[${idx0}]`;
        const lo = wordOrder === 'low_first' ? `${buf}[${idx0}]`   : `${buf}[${idx0}+1]`;
        switch (dataType) {
            case 'U16':
                return `(float)${buf}[${idx0}]${scaleExpr}`;
            case 'S16':
                return `(float)(int16_t)${buf}[${idx0}]${scaleExpr}`;
            case 'U32':
                return `(float)(((uint32_t)${hi} << 16) | ${lo})${scaleExpr}`;
            case 'S32':
                return `(float)(int32_t)(((uint32_t)${hi} << 16) | ${lo})${scaleExpr}`;
            case 'FLOAT':
                // IEEE 754 32-bit em 2 regs Modbus. word_order respeitado via hi/lo.
                return `(_u32_to_float(${hi}, ${lo})${scaleExpr})`;
            case 'COSFI':
                return `(float)((${buf}[${idx0}] & 0x8000) ? -1 : 1) * (float)(${buf}[${idx0}] & 0x7FFF)${scaleExpr}`;
            case 'U32_SUM3': {
                const count = Number(meta.count) || 3;
                const regsPer = Number(meta.regs_per) || 2;
                const items = [];
                for (let k = 0; k < count; k++) {
                    const a = `${buf}[${idx0}+${k*regsPer}]`;
                    const b = `${buf}[${idx0}+${k*regsPer+1}]`;
                    items.push(`(int32_t)(((uint32_t)${a} << 16) | ${b})`);
                }
                return `(float)(${items.join(' + ')})${scaleExpr}`;
            }
            default:
                return `(float)${buf}[${idx0}]${scaleExpr}`;
        }
    }

    _resolveScale(scale, scales) {
        if (scale === undefined || scale === null) return 1;
        if (typeof scale === 'number') return scale;
        if (typeof scale === 'string' && scales[scale] !== undefined) return scales[scale];
        return 1;
    }

    // Flag de diagnóstico — quando true, generator NÃO emite leitura de TP/TC
    // nem multiplicação dos decoders. Usado pra isolar regressões da feature.
    // Setar no console do browser: window.IOT_DISABLE_TP_TC = true
    _tpTcDisabled() {
        try { return typeof window !== 'undefined' && window.IOT_DISABLE_TP_TC === true; }
        catch (_) { return false; }
    }

    _escStr(s) {
        return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    // ---- main.cpp ----
    _genMainCpp(spec) {
        let cpp = `// ==============================================================================
// ${spec.name} (${spec.tonType.toUpperCase()}) - Gerado pelo NexOn IoT
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
`;

        if (spec.has_relays) cpp += `#include "relays.h"\n`;
        if (spec.wifi) cpp += `#include "mqtt.h"\n#include "ota.h"\n`;
        if (spec.has_lora) cpp += `#include "lora.h"\n`;
        if (spec.rs485_devices.length > 0) cpp += `#include "modbus_meter.h"\n`;
        if (spec.tcp_devices.length > 0) cpp += `#include "inverter_tcp.h"\n`;

        cpp += `
// Estado / timers
static unsigned long last_input_scan = 0;
static unsigned long last_status     = 0;
static unsigned long last_sample     = 0;  // leitura Modbus (round-robin)
static unsigned long last_publish    = 0;  // publicacao MQTT (medias/deltas)

`;

        if (spec.wifi) {
            cpp += `// Publica em TOPIC_BASE/<sub>. Helper para modulos que nao conhecem o prefixo.
static void mqtt_publish_sub(const char* sub, const char* payload) {
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/%s", MQTT_TOPIC_BASE, sub);
    mqtt_publish(topic, payload);
}

`;
        }

        cpp += `// ===== ACK aplicacao-level para comandos =====
// Protocolo:
//   Backend publica em <BASE>/cmd com envelope: {"cmd_id":"<uuid>","cmd": <inner>}
//   <inner> pode ser string ("r1 on") ou objeto ({"device":"X","cmd":"cmd_fechar"})
//   TON publica resposta em <BASE>/cmd/ack: {"cmd_id","status","msg","ts"}
//   status: "ok" | "error" | "duplicate"
// Backward-compat: se nao houver cmd_id, executa sem publicar ack (legado).
#define CMD_DEDUP_SIZE 16
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
             "{\\"cmd_id\\":\\"%s\\",\\"status\\":\\"%s\\",\\"msg\\":\\"%s\\",\\"ts\\":%lu}",
             cmd_id, status, msg ? msg : "", (unsigned long)(millis() / 1000));
    mqtt_publish(topic, payload);
}

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
`;
        if (spec.rs485_devices.length > 0) {
            cpp += `                bool ok = modbus_exec_command(dev, cid);
                snprintf(result_msg, msg_sz, "%s/%s:%s", dev, cid, ok ? "OK" : "FAIL");
                return ok;
`;
        } else {
            cpp += `                snprintf(result_msg, msg_sz, "no_modbus_in_firmware");
                return false;
`;
        }
        cpp += `            }
        }
    }

    String cmd = String(raw); cmd.trim(); cmd.toLowerCase();
    if (cmd.length() == 0) { snprintf(result_msg, msg_sz, "empty"); return false; }

    if (cmd.length() >= 4 && cmd[0] == 'r' && cmd[1] >= '1' && cmd[1] <= '6') {
`;
        if (spec.has_relays) {
            cpp += `        bool on = cmd.indexOf("on") >= 0;
        relay_set(cmd[1] - '0', on);
        snprintf(result_msg, msg_sz, "rele_%c_%s", cmd[1], on ? "on" : "off");
        return true;
`;
        } else {
            cpp += `        snprintf(result_msg, msg_sz, "no_relays_in_model");
        return false;
`;
        }
        cpp += `    }
    if (cmd.startsWith("tr") && cmd[2] >= '1' && cmd[2] <= '4') {
        bool on = cmd.indexOf("on") >= 0;
        output_set(cmd[2] - '0', on);
        snprintf(result_msg, msg_sz, "tr%c_%s", cmd[2], on ? "on" : "off");
        return true;
    }
    if (cmd == "status") {
        Serial.printf("Entradas: %02X  Saidas: %02X\\n", inputs_get_state(), outputs_get_state());
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
                    Serial.printf("[CMD] Duplicate cmd_id=%s ignorado\\n", cmd_id);
                    _publish_cmd_ack(cmd_id, "duplicate", "already_seen");
                    return;
                }

                JsonVariantConst inner = env["cmd"];
                if (inner.is<const char*>()) {
                    snprintf(inner_buf, sizeof(inner_buf), "%s", inner.as<const char*>());
                    effective = inner_buf;
                } else if (inner.is<JsonObject>()) {
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
    Serial.printf("[CMD] %s -> %s (%s)\\n", effective, ok ? "OK" : "FAIL", msg);

    if (cmd_id[0]) {
        _publish_cmd_ack(cmd_id, ok ? "ok" : "error", msg);
    }
}

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
    Serial.printf("\\n  %s v%s - %s\\n", DEVICE_ID, FIRMWARE_VERSION, DEVICE_MODEL);
    Serial.printf("  [BOOT] MAC: %s\\n", WiFi.macAddress().c_str());
    Serial.printf("  Motivo do reset: %s\\n", _resetReason());
    Serial.printf("  Heap livre: %u bytes\\n\\n", ESP.getFreeHeap());

    // Diagnosticos: contadores globais (uptime, modbus_ok/err, mqtt_pub, sd_*, etc.)
    diag_init();

    // Watchdog em panic mode: reinicia a placa se travar
    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);
    Serial.printf("[OK] Watchdog %ds (panic=reboot)\\n", WATCHDOG_TIMEOUT_S);

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
`;

        if (spec.has_relays) {
            cpp += `
    if (relays_init()) Serial.println("[OK] Reles (6x ULN2803)");
    else Serial.println("[FAIL] Reles");
`;
        }

        cpp += `
    outputs_init();
    Serial.println("[OK] Transistores (TR1-TR4)");

    adc_init();
    Serial.println("[OK] ADC (AN1/AN2)");

    // SD Card - buffer offline para MQTT
    if (sd_buffer_init()) {
        Serial.println("[OK] SD Buffer");
    } else {
        Serial.println("[WARN] SD nao disponivel - mensagens offline serao perdidas");
    }
`;

        if (spec.rs485_devices.length > 0) {
            cpp += `
    // RS485 + Modbus (dispositivos vem do catalogo, sem scan no boot)
    modbus_init();
`;
        }

        if (spec.tcp_devices.length > 0) {
            cpp += `
    // Modbus TCP (via Datalogger/Gateway)
    inverter_tcp_init();
`;
        }

        if (spec.has_lora) {
            cpp += `
    // LoRa
    lora_init();
`;
        }

        if (spec.wifi) {
            cpp += `
    // WiFi + MQTT + OTA
    mqtt_init(process_command);
    ota_init();
    // Detecta boot pos-OTA: se em PENDING_VERIFY, arma contador de validacao.
    // Se travarmos antes de N publicacoes OK, bootloader reverte para anterior.
    ota_check_pending_verify();
`;
        }

        cpp += `
    esp_task_wdt_reset();
    Serial.println("\\nPronto!");
}

void loop() {
    esp_task_wdt_reset();
    diag_tick();  // atualiza min_free_heap a cada loop
    unsigned long now = millis();
`;

        if (spec.wifi) {
            cpp += `    mqtt_loop();
    diag_publish_periodic();  // publica MQTT_TOPIC_BASE/diagnostics a cada DIAG_INTERVAL_MS

    // Durante OTA nao fazer mais nada (flash em andamento)
    if (ota_in_progress()) { delay(1); return; }
`;
        }

        cpp += `
    // Entradas (debounce)
    if (now - last_input_scan >= INPUT_SCAN_MS) {
        last_input_scan = now;
        inputs_scan();
        if (inputs_changed()) {
            uint8_t s = inputs_get_state();
            char buf[80];
            snprintf(buf, sizeof(buf), "{\\"d1\\":%d,\\"d2\\":%d,\\"d3\\":%d,\\"d4\\":%d,\\"d5\\":%d,\\"d6\\":%d}",
                s&1, (s>>1)&1, (s>>2)&1, (s>>3)&1, (s>>4)&1, (s>>5)&1);
`;
        if (spec.wifi) cpp += `            mqtt_publish(MQTT_TOPIC_INPUTS, buf);\n`;
        if (spec.has_lora && spec.lora?.mode === 'tx') cpp += `            lora_send(buf);\n`;
        cpp += `        }
    }

    // Status periodico
    if (now - last_status >= MQTT_STATUS_MS) {
        last_status = now;
`;
        if (spec.wifi) {
            cpp += `        // Publicar estado
        uint8_t rs = inputs_get_state();
        char ibuf[80];
        snprintf(ibuf, sizeof(ibuf), "{\\"d1\\":%d,\\"d2\\":%d,\\"d3\\":%d,\\"d4\\":%d,\\"d5\\":%d,\\"d6\\":%d}",
            rs&1, (rs>>1)&1, (rs>>2)&1, (rs>>3)&1, (rs>>4)&1, (rs>>5)&1);
        mqtt_publish(MQTT_TOPIC_INPUTS, ibuf);
`;
            if (spec.has_relays) {
                cpp += `
        uint8_t rl = relays_get_state();
        char rbuf[80];
        snprintf(rbuf, sizeof(rbuf), "{\\"r1\\":%d,\\"r2\\":%d,\\"r3\\":%d,\\"r4\\":%d,\\"r5\\":%d,\\"r6\\":%d}",
            (rl>>1)&1, (rl>>2)&1, (rl>>3)&1, (rl>>4)&1, (rl>>5)&1, (rl>>6)&1);
        mqtt_publish(MQTT_TOPIC_RELAYS, rbuf);
`;
            }
            cpp += `
        uint8_t os = outputs_get_state();
        char obuf[60];
        snprintf(obuf, sizeof(obuf), "{\\"tr1\\":%d,\\"tr2\\":%d,\\"tr3\\":%d,\\"tr4\\":%d}",
            os&1, (os>>1)&1, (os>>2)&1, (os>>3)&1);
        mqtt_publish(MQTT_TOPIC_OUTPUTS, obuf);
`;
        }
        cpp += `    }
`;

        if (spec.rs485_devices.length > 0) {
            const pubCall = spec.wifi
                ? `modbus_publish_all(mqtt_publish_sub);`
                : `modbus_publish_all([](const char* sub, const char* payload){ Serial.printf("[MB] %s %s\\n", sub, payload); });`;
            cpp += `
    // Modbus: sample 1 device por ciclo (round-robin) a cada METER_CYCLE_MS
    if (now - last_sample >= METER_CYCLE_MS) {
        last_sample = now;
        modbus_sample_one();
    }

    // Publicacao periodica: medias + deltas + last a cada PUBLISH_INTERVAL_MS
    if (now - last_publish >= PUBLISH_INTERVAL_MS) {
        last_publish = now;
        ${pubCall}
    }
`;
        }

        // Leitura dos inversores via TCP (datalogger)
        const tcpInvs = (spec.tcp_devices || []).filter(d => d.type === 'inversor');
        if (tcpInvs.length > 0) {
            cpp += `
    // Modbus TCP (Datalogger): le cada inversor e publica em TOPIC_BASE/<name>/data
    if (now - last_publish >= PUBLISH_INTERVAL_MS) {
        last_publish = now;
`;
            tcpInvs.forEach(inv => {
                const nameEsc = this._escStr(inv.name || `inv_${inv.modbus_address}`);
                cpp += `        {
            InverterReading r;
            if (inverter_tcp_read(${inv.modbus_address}, r)) {
                StaticJsonDocument<1024> d;
                d["device"] = "${nameEsc}";
                d["addr"] = ${inv.modbus_address};
                d["ger_diaria"]    = r.ger_diaria;
                d["ger_total"]     = r.ger_total;
                d["pot_ativa"]     = r.pot_ativa;
                d["pot_reativa"]   = r.pot_reativa;
                d["pot_aparente"]  = r.pot_aparente;
                d["fp"]            = r.fp;
                d["freq"]          = r.freq;
                d["va"] = r.va; d["vb"] = r.vb; d["vc"] = r.vc;
                d["ia"] = r.ia; d["ib"] = r.ib; d["ic"] = r.ic;
                d["mppt1_v"] = r.mppt_v[0]; d["mppt1_i"] = r.mppt_i[0];
                d["mppt2_v"] = r.mppt_v[1]; d["mppt2_i"] = r.mppt_i[1];
                d["mppt3_v"] = r.mppt_v[2]; d["mppt3_i"] = r.mppt_i[2];
                d["estado"] = r.estado;
                char payload[1024];
                serializeJson(d, payload, sizeof(payload));
`;
                if (spec.wifi) {
                    cpp += `                mqtt_publish_sub("${nameEsc}/data", payload);
`;
                } else {
                    cpp += `                Serial.printf("[TCP] %s %s\\n", "${nameEsc}", payload);
`;
                }
                cpp += `            } else {
                Serial.printf("[TCP] Falha leitura ID %d\\n", ${inv.modbus_address});
            }
            delay(100);
        }
`;
            });
            cpp += `    }
`;
        }

        cpp += `
    // Serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\\n');
        process_command(cmd.c_str());
    }
`;

        if (spec.has_lora) {
            cpp += `
    // LoRa RX
    if (lora_available()) {
        String msg = lora_read();
        if (msg.length() > 0) {
            Serial.printf("[LORA] RX: %s\\n", msg.c_str());
            process_command(msg.c_str());
        }
    }
`;
        }

        cpp += `}
`;
        return cpp;
    }

    // ================================================================
    // PUBLIC — Generate all TON projects
    // ================================================================
    generateAll() {
        const specs = this.analyze();
        return specs.map(spec => this.generateProject(spec));
    }
};
