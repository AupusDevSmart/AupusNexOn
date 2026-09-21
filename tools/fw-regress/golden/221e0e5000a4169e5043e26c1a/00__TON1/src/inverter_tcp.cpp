#include "inverter_tcp.h"
#include "config.h"
#include "eth.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <string.h>
#include <math.h>
#include <time.h>

// Gateway (Datalogger) — compartilhado por todos os inversores TCP
#define GATEWAY_IP      "192.168.1.77"
#define GATEWAY_PORT    502
#define GATEWAY_TIMEOUT 2000

const uint8_t TCP_INVERTER_IDS[] = {1};

static WiFiClient _wifiTcpClient;
static uint16_t _txId = 0;

// Motivo da ultima falha de leitura TCP (timeout/exception/id_fc/bytecount/incomplete).
// Publicado no payload no_samples pra diagnostico REMOTO (sem serial).
static const char* _tcp_last_fail_reason = "none";

// Helpers locais — duplicados do modbus_meter.cpp para escopo deste arquivo.
// Mantemos copia local porque _publish_tcp_inv_<idx> (gerada abaixo) os usa
// quando o tipo do catalogo declara publish.timestamp_format='datetime' ou
// tem campo work_state no grupo 'status'.

// Timestamp formatado "DD/MM/YYYY HH:MM:SS" no timezone local.
// Fallback "0" (epoch zero) se o relogio nao estiver sincronizado — o ingestion
// trata como timestamp numerico valido e usa now do server como timestamp_dados.
static String _format_timestamp_str() {
    time_t now = time(nullptr);
    if (now < 1700000000) return String("0");
    struct tm* t = localtime(&now);
    char buf[24];
    sprintf(buf, "%02d/%02d/%04d %02d:%02d:%02d",
            t->tm_mday, t->tm_mon + 1, t->tm_year + 1900,
            t->tm_hour, t->tm_min, t->tm_sec);
    return String(buf);
}

// Mapeia codigo de work_state Sungrow -> texto.
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
        default:               return "Unknown";
    }
}

// Retorna ponteiro pro Client correto baseado na interface ativa.
// Antes usava WiFiClient fixo + check WiFi.isConnected() — quebrava quando rodando
// so' por Ethernet (WiFi.mode(OFF) -> isConnected() == false -> retornava sempre falha
// sem nem tentar conectar TCP). Agora funciona em ambas as interfaces.
static Client* _active_tcp_client() {
    if (eth_connected()) return &eth_get_client();
    if (WiFi.isConnected()) return &_wifiTcpClient;
    return nullptr;
}

// 10^e por inteiro (e pode ser negativo). Evita pull de powf; deterministico em FPU/no-FPU.
static inline float _pow10i(int e){ float r=1.0f; if(e>=0){ for(int i=0;i<e;i++) r*=10.0f; } else { for(int i=0;i<-e;i++) r/=10.0f; } return r; }

void inverter_tcp_init() {
    Serial.printf("[TCP-INV] Gateway: %s:%d (timeout %dms)\n",
        GATEWAY_IP, GATEWAY_PORT, GATEWAY_TIMEOUT);
    Serial.printf("[TCP-INV] Inversores: ");
    for (uint8_t i = 0; i < sizeof(TCP_INVERTER_IDS); i++) {
        Serial.printf("ID%d ", TCP_INVERTER_IDS[i]);
    }
    Serial.println();
}

// Gerencia a conexao TCP compartilhada. Reconecta se cair OU se o alvo (ip:port)
// mudou — permite datalogger (MBAP) e conversor (RTU) em IPs distintos na mesma
// TON com um unico Client. Retorna o Client conectado (ou nullptr).
static char     _tcp_cur_ip[40] = "";
static uint16_t _tcp_cur_port = 0;
static Client* _tcp_ensure_conn(const char* ip, uint16_t port, uint32_t timeout) {
    Client* tcp = _active_tcp_client();
    if (!tcp) return nullptr;
    bool targetChanged = (strcmp(_tcp_cur_ip, ip) != 0) || (_tcp_cur_port != port);
    if (tcp->connected() && targetChanged) {
        tcp->stop();
    }
    if (!tcp->connected()) {
        tcp->setTimeout(timeout / 1000);
        if (!tcp->connect(ip, port)) {
            Serial.printf("[TCP-INV] Falha ao conectar em %s:%d\n", ip, port);
            _tcp_cur_ip[0] = 0;
            return nullptr;
        }
        strncpy(_tcp_cur_ip, ip, sizeof(_tcp_cur_ip) - 1);
        _tcp_cur_ip[sizeof(_tcp_cur_ip) - 1] = 0;
        _tcp_cur_port = port;
    }
    return tcp;
}

// CRC16 Modbus (poly 0xA001) — transporte RTU-sobre-TCP do conversor.
static uint16_t _modbus_crc16(const uint8_t* buf, uint16_t len) {
    uint16_t crc = 0xFFFF;
    for (uint16_t i = 0; i < len; i++) {
        crc ^= buf[i];
        for (uint8_t b = 0; b < 8; b++) {
            if (crc & 0x0001) { crc >>= 1; crc ^= 0xA001; }
            else crc >>= 1;
        }
    }
    return crc;
}

// Helper Modbus TCP (MBAP) — datalogger. Comportamento identico ao anterior;
// so' passou a receber ip/port/timeout e usar o gerenciador de conexao.
// Ultimo codigo de excecao Modbus visto pelo _modbus_tcp_read (0 = nenhum).
// Necessario pro SOE: excecao (tip. 2) na leitura do EVENT = fila vazia (NORMAL, nao erro).
static uint8_t _tcp_last_exc = 0;
// SOE seta true em volta da leitura do EVENT: excecao esperada (fila vazia) nao loga —
// senao o Serial seria inundado com "Excecao 0x02" a cada poll de fila vazia (~2s).
static bool _tcp_quiet_exc = false;

static bool _modbus_tcp_read(const char* ip, uint16_t port, uint32_t timeout,
                             uint8_t slave, uint8_t func, uint16_t addr, uint16_t count, uint16_t *out) {
    _tcp_last_exc = 0;
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    _txId++;
    uint8_t req[12];
    // MBAP Header
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;      // Protocol ID = 0
    req[4] = 0; req[5] = 6;      // Length = 6
    req[6] = slave;              // Unit ID
    // PDU
    req[7] = func;
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = count >> 8; req[11] = count & 0xFF;

    tcp->write(req, 12);
    tcp->flush();

    uint32_t t0 = millis();
    while (tcp->available() < 9 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 9) {
        Serial.printf("[TCP-INV] Timeout slave=%d func=%d addr=%d\n", slave, func, addr);
        _tcp_last_fail_reason = "timeout";
        return false;
    }

    uint8_t hdr[9];
    tcp->readBytes(hdr, 9);
    if (hdr[7] & 0x80) {
        _tcp_last_exc = hdr[8];
        if (!_tcp_quiet_exc) Serial.printf("[TCP-INV] Excecao Modbus slave=%d: 0x%02X\n", slave, hdr[8]);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "exception";
        return false;
    }

    uint8_t byteCount = hdr[8];
    uint8_t buf[256];
    tcp->readBytes(buf, byteCount);

    for (uint16_t i = 0; i < count; i++) {
        out[i] = (buf[i*2] << 8) | buf[i*2+1];
    }
    return true;
}

// Helper Modbus TCP (MBAP) para BITS — FC02 (discrete inputs) / FC01 (coils).
// Resposta empacota bits em bytes (LSB primeiro), diferente dos registradores.
// out deve ter ceil(count/8) bytes. Usado pelos blocos BI dos reles (protecoes).
static bool _modbus_tcp_read_bits(const char* ip, uint16_t port, uint32_t timeout,
                                  uint8_t slave, uint8_t func, uint16_t addr, uint16_t count, uint8_t *out) {
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    _txId++;
    uint8_t req[12];
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;
    req[4] = 0; req[5] = 6;
    req[6] = slave;
    req[7] = func;
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = count >> 8; req[11] = count & 0xFF;

    tcp->write(req, 12);
    tcp->flush();

    uint32_t t0 = millis();
    while (tcp->available() < 9 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 9) {
        Serial.printf("[TCP-INV] Timeout(bits) slave=%d func=%d addr=%d\n", slave, func, addr);
        _tcp_last_fail_reason = "timeout_bits";
        return false;
    }

    uint8_t hdr[9];
    tcp->readBytes(hdr, 9);
    if (hdr[7] & 0x80) {
        Serial.printf("[TCP-INV] Excecao Modbus(bits) slave=%d: 0x%02X\n", slave, hdr[8]);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "exception_bits";
        return false;
    }

    uint8_t byteCount = hdr[8];
    uint8_t expected = (count + 7) / 8;
    if (byteCount > 250 || byteCount < expected) {
        Serial.printf("[TCP-INV] byteCount(bits) invalido: %d (esperado %d)\n", byteCount, expected);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "bytecount_bits";
        return false;
    }
    tcp->readBytes(out, expected);
    // Drena bytes excedentes (byteCount > esperado nao deveria ocorrer, mas nao trava)
    for (uint8_t i = expected; i < byteCount; i++) tcp->read();
    return true;
}

// Helper Modbus TCP (MBAP) para ESCRITA — FC05 (write single coil) / FC06 (write
// single register). Usado pelos comandos (bo_map) de reles TCP diretos (trip/close/
// reset). Resposta de sucesso e' o eco do request (12 bytes); excecao vem com 0x80.
static bool _modbus_tcp_write(const char* ip, uint16_t port, uint32_t timeout,
                              uint8_t slave, uint8_t func, uint16_t addr, uint16_t value) {
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    _txId++;
    uint8_t req[12];
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;
    req[4] = 0; req[5] = 6;
    req[6] = slave;
    req[7] = func;
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = value >> 8; req[11] = value & 0xFF;

    tcp->write(req, 12);
    tcp->flush();

    uint32_t t0 = millis();
    while (tcp->available() < 9 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 9) {
        Serial.printf("[TCP-INV] Timeout(write) slave=%d func=%d addr=%d\n", slave, func, addr);
        _tcp_last_fail_reason = "timeout_write";
        return false;
    }
    uint8_t resp[12];
    uint8_t got = tcp->readBytes(resp, 9);
    if (resp[7] & 0x80) {
        Serial.printf("[TCP-INV] Excecao Modbus(write) slave=%d func=%d: 0x%02X\n", slave, func, resp[8]);
        while (tcp->available()) tcp->read();
        return false;
    }
    while (tcp->available()) tcp->read();   // resto do eco
    return got >= 9 && resp[7] == func;
}

// Helper Modbus TCP (MBAP) — FC15 (write multiple coils), ate 8 bits num byte.
// Necessario para comandos DPC (double-bit, ex: CB-1 do 7SR5): manual manda
// escrever o PAR de bits via FC15 com valor 01 (Off/abre) ou 10 (On/fecha).
static bool _modbus_tcp_write_coils(const char* ip, uint16_t port, uint32_t timeout,
                                    uint8_t slave, uint16_t addr, uint16_t count, uint8_t bits) {
    if (count == 0 || count > 8) return false;
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    _txId++;
    uint8_t req[14];
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;
    req[4] = 0; req[5] = 8;          // length: unit(1)+fc(1)+addr(2)+cnt(2)+bytecount(1)+data(1)
    req[6] = slave;
    req[7] = 0x0F;
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = count >> 8; req[11] = count & 0xFF;
    req[12] = 1;                     // byte count
    req[13] = bits;                  // LSB = primeiro coil

    tcp->write(req, 14);
    tcp->flush();

    uint32_t t0 = millis();
    while (tcp->available() < 9 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 9) {
        Serial.printf("[TCP-INV] Timeout(fc15) slave=%d addr=%d\n", slave, addr);
        return false;
    }
    uint8_t resp[12];
    uint8_t got = tcp->readBytes(resp, 9);
    if (resp[7] & 0x80) {
        Serial.printf("[TCP-INV] Excecao Modbus(fc15) slave=%d: 0x%02X\n", slave, resp[8]);
        while (tcp->available()) tcp->read();
        return false;
    }
    while (tcp->available()) tcp->read();
    return got >= 9 && resp[7] == 0x0F;
}

// Helper Modbus RTU-sobre-TCP + CRC16 — conversor (USR transparente). Espelha o
// readModbusBlock antigo: frame RTU com CRC, valida ID/FC/byteCount/CRC e REJEITA
// frame corrompido (em link instavel nao deixa passar 0xFFFF/lixo como dado).
static bool _modbus_rtu_tcp_read(const char* ip, uint16_t port, uint32_t timeout,
                                 uint8_t slave, uint8_t func, uint16_t addr, uint16_t count, uint16_t *out) {
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    uint8_t req[8];
    req[0] = slave;
    req[1] = func;
    req[2] = addr >> 8; req[3] = addr & 0xFF;
    req[4] = count >> 8; req[5] = count & 0xFF;
    uint16_t crc = _modbus_crc16(req, 6);
    req[6] = crc & 0xFF; req[7] = (crc >> 8) & 0xFF;   // CRC little-endian

    while (tcp->available()) tcp->read();   // flush anti-dessincronizacao
    tcp->write(req, 8);
    tcp->flush();

    // Resposta RTU: [ID][FC][ByteCount][dados...][CRC_L][CRC_H] — minimo 5 bytes.
    uint32_t t0 = millis();
    while (tcp->available() < 5 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 5) {
        Serial.printf("[TCP-INV] Timeout(rtu) slave=%d func=%d addr=%d\n", slave, func, addr);
        _tcp_last_fail_reason = "timeout";
        return false;
    }

    uint8_t hdr[3];
    tcp->readBytes(hdr, 3);   // ID + FC + ByteCount
    if (hdr[1] & 0x80) {
        Serial.printf("[TCP-INV] Excecao Modbus(rtu) slave=%d: 0x%02X\n", slave, hdr[1]);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "exception";
        return false;
    }
    if (hdr[0] != slave || hdr[1] != func) {
        Serial.printf("[TCP-INV] ID/FC invalido(rtu) slave=%d\n", slave);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "id_fc";
        return false;
    }
    uint8_t byteCount = hdr[2];
    if (byteCount != count * 2) {
        Serial.printf("[TCP-INV] byteCount invalido(rtu) slave=%d: %d\n", slave, byteCount);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "bytecount";
        return false;
    }

    t0 = millis();
    while (tcp->available() < (byteCount + 2) && millis() - t0 < timeout) {
        delay(2);
        esp_task_wdt_reset();
    }
    if (tcp->available() < (byteCount + 2)) {
        Serial.printf("[TCP-INV] Resposta(rtu) incompleta slave=%d\n", slave);
        _tcp_last_fail_reason = "incomplete";
        return false;
    }

    uint8_t data[256];
    tcp->readBytes(data, byteCount);
    uint8_t crcBytes[2];
    tcp->readBytes(crcBytes, 2);

    uint8_t full[3 + 256];
    memcpy(full, hdr, 3);
    memcpy(full + 3, data, byteCount);
    uint16_t rxCRC = crcBytes[0] | (crcBytes[1] << 8);
    uint16_t calcCRC = _modbus_crc16(full, 3 + byteCount);
    if (rxCRC != calcCRC) {
        Serial.printf("[TCP-INV] CRC invalido(rtu) slave=%d — frame descartado\n", slave);
        _tcp_last_fail_reason = "crc";   // frame chegou completo mas corrompido (ruido/baud/paridade) — distinguivel remoto
        return false;
    }

    for (uint16_t i = 0; i < count; i++) {
        out[i] = (data[i*2] << 8) | data[i*2+1];
    }
    return true;
}


// =============================================================================
// Inversor (slave 1) — cadastro sem ai_blocks. Reader vazio.
// =============================================================================
static void _sample_tcp_inv_0() {
    Serial.println("[TCP-INV] Inversor: cadastro sem ai_blocks — skip");
}
static void _publish_tcp_inv_0(tcp_publish_fn publish) {
    publish("Inversor_1/data", "{\"error\":\"no_ai_blocks\"}");
}


// =============================================================================
// Despacho publico: round-robin sample + broadcast publish
// =============================================================================
static int _rr_tcp_idx = 0;
static const int _tcp_inv_count = 1;

void inverter_tcp_sample_one() {
    switch (_rr_tcp_idx) {
        case 0: _sample_tcp_inv_0(); break;
    }
    _rr_tcp_idx = (_rr_tcp_idx + 1) % _tcp_inv_count;
}

void inverter_tcp_publish_all(tcp_publish_fn publish) {
    if (!publish) return;
    _publish_tcp_inv_0(publish);
}

// Comandos (bo_map) de devices TCP diretos — write FC05/FC06 via MBAP.
// Espelha modbus_exec_command (RS485): match por nome do device + cmd_id;
// steps[] = multi-write sequencial (SBO). So devices MBAP (datalogger/direto);
// rele atras de conversor rtu_tcp nao entra (write RTU+CRC nao implementado).
bool inverter_tcp_exec_command(const char* device_name, const char* cmd_id) {
    if (!device_name || !cmd_id) return false;
    return false;
}

// SOE: drena a fila de eventos dos devices TCP que tem buffer no catalogo (MBAP).
void inverter_tcp_events_poll(tcp_publish_fn publish) {
    if (!publish) return;
}
