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
#define GATEWAY_IP      "192.168.1.10"
#define GATEWAY_PORT    502
#define GATEWAY_TIMEOUT 2000

const uint8_t TCP_INVERTER_IDS[] = {1, 2, 3, 4};

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
// Inv 1 — Sungrow SG250CX (slave 1)
// 5 blocos | 55 pontos AI (34 avg, 21 last, 0 delta)
// word_order: low_first
// =============================================================================
struct _TcpDs0State {
    double sum_[34];
    int samples;
    float last_[55];
    float first_delta_[1];
    bool has_first_delta;
    bool valid;
    int fail_streak;
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
    uint32_t tcp_reconnects;       // reconexoes forcadas apos falha (diagnostico remoto)
};
static _TcpDs0State _tds0 = {};

// Le todos os blocos do inversor e popula buf concatenado.
// Retorna false se qualquer bloco falhar (timeout, excecao, slave invalido).
static bool _read_tcp_inv_0_raw(uint16_t *buf) {
    // Bloco 0: regs 5000-5049, func 0x04 — Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status
    {
        uint16_t tmp0[50];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 1, 0x04, 4999, 50, tmp0)) {
            Serial.printf("[TCP-INV] Inv 1(id1) bloco 0 FAIL (reg=4999 count=50)\n");
            return false;
        }
        for (uint16_t i = 0; i < 50; i++) buf[0 + i] = tmp0[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 1: regs 5050-5089, func 0x04 — Regs 5050-5089: regulation, insulation
    {
        uint16_t tmp1[40];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 1, 0x04, 5049, 40, tmp1)) {
            Serial.printf("[TCP-INV] Inv 1(id1) bloco 1 FAIL (reg=5049 count=40)\n");
            return false;
        }
        for (uint16_t i = 0; i < 40; i++) buf[50 + i] = tmp1[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 2: regs 5090-5119, func 0x04 — Regs 5090-5119: tempo diario, MPPT 4-6
    {
        uint16_t tmp2[30];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 1, 0x04, 5089, 30, tmp2)) {
            Serial.printf("[TCP-INV] Inv 1(id1) bloco 2 FAIL (reg=5089 count=30)\n");
            return false;
        }
        for (uint16_t i = 0; i < 30; i++) buf[90 + i] = tmp2[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 3: regs 5120-5154, func 0x04 — Regs 5120-5154: MPPT 7-9, bus voltage, PID
    {
        uint16_t tmp3[35];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 1, 0x04, 5119, 35, tmp3)) {
            Serial.printf("[TCP-INV] Inv 1(id1) bloco 3 FAIL (reg=5119 count=35)\n");
            return false;
        }
        for (uint16_t i = 0; i < 35; i++) buf[120 + i] = tmp3[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 4: regs 7013-7030, func 0x04 — Regs 7013-7030: strings 1-18
    {
        uint16_t tmp4[18];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 1, 0x04, 7012, 18, tmp4)) {
            Serial.printf("[TCP-INV] Inv 1(id1) bloco 4 FAIL (reg=7012 count=18)\n");
            return false;
        }
        for (uint16_t i = 0; i < 18; i++) buf[155 + i] = tmp4[i];
    }
    return true;
}

// Le + acumula. Chamar a cada READ_INTERVAL_MS (round-robin em inverter_tcp_sample_one).
static void _sample_tcp_inv_0() {
    // Back-off: device TCP que nao responde fica em cooldown — pula a leitura
    // (que bloquearia o loop ~GATEWAY_TIMEOUT no _modbus_tcp_read) ate expirar.
    // Espelha o leitor RS485; sem isso um device morto (ex: Power_Meter ausente)
    // starva o keepalive do MQTT e a conexao fica flapando.
    if (_tds0.cooldown_until && (long)(millis() - _tds0.cooldown_until) < 0) return;

    uint16_t buf[173];
    if (!_read_tcp_inv_0_raw(buf)) {
        // Falha: fecha o socket p/ o PROXIMO tick reconectar. Reconectar resincroniza
        // o stream RTU-sobre-TCP e faz o conversor resetar o bridge RS485 — e' o que o
        // reboot faz p/ dar 1 leitura boa, aqui a cada falha (e apos cada cooldown, pois
        // o socket fica fechado). Leitura UNICA no ciclo (sem retry) pra nao dobrar o
        // bloqueio do loop se o device estiver mudo — a recuperacao vem no proximo tick.
        Client* _rc = _active_tcp_client();
        if (_rc) _rc->stop();
        _tcp_cur_ip[0] = 0; _tcp_cur_port = 0;   // forca _tcp_ensure_conn a reconectar
        _tds0.tcp_reconnects++;
        _tds0.fail_streak++;
        Serial.printf("[TCP-INV] Inv 1(id1): falha leitura (consecutivas: %d)\n", _tds0.fail_streak);
        if (_tds0.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _tds0.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_tds0.cooldown_until == 0) _tds0.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[TCP-INV] Inv 1(id1): cooldown %lus (nao responde) — loop liberado p/ MQTT/cmd\n", (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    _tds0.cooldown_until = 0;
    if (_tds0.fail_streak > 0) {
        Serial.printf("[TCP-INV] Inv 1(id1): OK (apos %d falhas)\n", _tds0.fail_streak);
        _tds0.fail_streak = 0;
    }

    float v_ia = (float)buf[22] / 10.0;
    _tds0.sum_[0] += v_ia;
    float v_ib = (float)buf[23] / 10.0;
    _tds0.sum_[1] += v_ib;
    float v_ic = (float)buf[24] / 10.0;
    _tds0.sum_[2] += v_ic;
    float v_vab = (float)buf[19] / 10.0;
    _tds0.sum_[3] += v_vab;
    float v_vbc = (float)buf[20] / 10.0;
    _tds0.sum_[4] += v_vbc;
    float v_vca = (float)buf[21] / 10.0;
    _tds0.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)buf[11] / 10.0;
    _tds0.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)buf[13] / 10.0;
    _tds0.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)buf[15] / 10.0;
    _tds0.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)buf[115] / 10.0;
    _tds0.sum_[9] += v_mppt4_voltage;
    float v_mppt5_voltage = (float)buf[117] / 10.0;
    _tds0.sum_[10] += v_mppt5_voltage;
    float v_mppt6_voltage = (float)buf[119] / 10.0;
    _tds0.sum_[11] += v_mppt6_voltage;
    float v_mppt7_voltage = (float)buf[121] / 10.0;
    _tds0.sum_[12] += v_mppt7_voltage;
    float v_mppt8_voltage = (float)buf[123] / 10.0;
    _tds0.sum_[13] += v_mppt8_voltage;
    float v_mppt9_voltage = (float)buf[130] / 10.0;
    _tds0.sum_[14] += v_mppt9_voltage;
    float v_dc_total_power = (float)(((uint32_t)buf[17+1] << 16) | buf[17]);
    _tds0.sum_[15] += v_dc_total_power;
    float v_string1_current = (float)buf[155] / 100.0;
    _tds0.sum_[16] += v_string1_current;
    float v_string2_current = (float)buf[156] / 100.0;
    _tds0.sum_[17] += v_string2_current;
    float v_string3_current = (float)buf[157] / 100.0;
    _tds0.sum_[18] += v_string3_current;
    float v_string4_current = (float)buf[158] / 100.0;
    _tds0.sum_[19] += v_string4_current;
    float v_string5_current = (float)buf[159] / 100.0;
    _tds0.sum_[20] += v_string5_current;
    float v_string6_current = (float)buf[160] / 100.0;
    _tds0.sum_[21] += v_string6_current;
    float v_string7_current = (float)buf[161] / 100.0;
    _tds0.sum_[22] += v_string7_current;
    float v_string8_current = (float)buf[162] / 100.0;
    _tds0.sum_[23] += v_string8_current;
    float v_string9_current = (float)buf[163] / 100.0;
    _tds0.sum_[24] += v_string9_current;
    float v_string10_current = (float)buf[164] / 100.0;
    _tds0.sum_[25] += v_string10_current;
    float v_string11_current = (float)buf[165] / 100.0;
    _tds0.sum_[26] += v_string11_current;
    float v_string12_current = (float)buf[166] / 100.0;
    _tds0.sum_[27] += v_string12_current;
    float v_string13_current = (float)buf[167] / 100.0;
    _tds0.sum_[28] += v_string13_current;
    float v_string14_current = (float)buf[168] / 100.0;
    _tds0.sum_[29] += v_string14_current;
    float v_string15_current = (float)buf[169] / 100.0;
    _tds0.sum_[30] += v_string15_current;
    float v_string16_current = (float)buf[170] / 100.0;
    _tds0.sum_[31] += v_string16_current;
    float v_string17_current = (float)buf[171] / 100.0;
    _tds0.sum_[32] += v_string17_current;
    float v_string18_current = (float)buf[172] / 100.0;
    _tds0.sum_[33] += v_string18_current;
    float v_fp = (float)(int16_t)buf[35] / 1000.0;
    float v_freq = (float)buf[36] / 10.0;
    float v_work_state = (float)buf[38];
    float v_bus_voltage = (float)buf[147] / 10.0;
    float v_daily_yield = (float)buf[3] / 10.0;
    float v_device_type = (float)buf[0];
    float v_output_type = (float)buf[2];
    float v_total_yield = (float)(((uint32_t)buf[4+1] << 16) | buf[4]);
    float v_temp_interna = (float)(int16_t)buf[8] / 10.0;
    float v_nominal_power = (float)buf[1] / 10.0;
    float v_apparent_total = (float)(((uint32_t)buf[9+1] << 16) | buf[9]);
    float v_pid_alarm_code = (float)buf[151];
    float v_pid_work_state = (float)buf[150];
    float v_potencia_ativa = (float)(((uint32_t)buf[31+1] << 16) | buf[31]);
    float v_potencia_reativa = (float)(int32_t)(((uint32_t)buf[33+1] << 16) | buf[33]);
    float v_potencia_aparente = (float)(((uint32_t)buf[9+1] << 16) | buf[9]);
    float v_daily_running_time = (float)buf[113];
    float v_potencia_aparente2 = (float)(((uint32_t)buf[10+1] << 16) | buf[10]);
    float v_total_running_time = (float)(((uint32_t)buf[6+1] << 16) | buf[6]);
    float v_insulation_resistance = (float)buf[71];
    float v_nominal_reactive_power = (float)buf[49] / 10.0;
    _tds0.last_[0] = v_ia;
    _tds0.last_[1] = v_ib;
    _tds0.last_[2] = v_ic;
    _tds0.last_[3] = v_vab;
    _tds0.last_[4] = v_vbc;
    _tds0.last_[5] = v_vca;
    _tds0.last_[6] = v_mppt1_voltage;
    _tds0.last_[7] = v_mppt2_voltage;
    _tds0.last_[8] = v_mppt3_voltage;
    _tds0.last_[9] = v_mppt4_voltage;
    _tds0.last_[10] = v_mppt5_voltage;
    _tds0.last_[11] = v_mppt6_voltage;
    _tds0.last_[12] = v_mppt7_voltage;
    _tds0.last_[13] = v_mppt8_voltage;
    _tds0.last_[14] = v_mppt9_voltage;
    _tds0.last_[15] = v_dc_total_power;
    _tds0.last_[16] = v_string1_current;
    _tds0.last_[17] = v_string2_current;
    _tds0.last_[18] = v_string3_current;
    _tds0.last_[19] = v_string4_current;
    _tds0.last_[20] = v_string5_current;
    _tds0.last_[21] = v_string6_current;
    _tds0.last_[22] = v_string7_current;
    _tds0.last_[23] = v_string8_current;
    _tds0.last_[24] = v_string9_current;
    _tds0.last_[25] = v_string10_current;
    _tds0.last_[26] = v_string11_current;
    _tds0.last_[27] = v_string12_current;
    _tds0.last_[28] = v_string13_current;
    _tds0.last_[29] = v_string14_current;
    _tds0.last_[30] = v_string15_current;
    _tds0.last_[31] = v_string16_current;
    _tds0.last_[32] = v_string17_current;
    _tds0.last_[33] = v_string18_current;
    _tds0.last_[34] = v_fp;
    _tds0.last_[35] = v_freq;
    _tds0.last_[36] = v_work_state;
    _tds0.last_[37] = v_bus_voltage;
    _tds0.last_[38] = v_daily_yield;
    _tds0.last_[39] = v_device_type;
    _tds0.last_[40] = v_output_type;
    _tds0.last_[41] = v_total_yield;
    _tds0.last_[42] = v_temp_interna;
    _tds0.last_[43] = v_nominal_power;
    _tds0.last_[44] = v_apparent_total;
    _tds0.last_[45] = v_pid_alarm_code;
    _tds0.last_[46] = v_pid_work_state;
    _tds0.last_[47] = v_potencia_ativa;
    _tds0.last_[48] = v_potencia_reativa;
    _tds0.last_[49] = v_potencia_aparente;
    _tds0.last_[50] = v_daily_running_time;
    _tds0.last_[51] = v_potencia_aparente2;
    _tds0.last_[52] = v_total_running_time;
    _tds0.last_[53] = v_insulation_resistance;
    _tds0.last_[54] = v_nominal_reactive_power;
    _tds0.samples++;
    _tds0.valid = true;
    Serial.printf("[TCP-INV] Inv 1(id1) #%d: ", _tds0.samples);
    Serial.printf("vab=%.2f ", v_vab);
    Serial.printf("vbc=%.2f ", v_vbc);
    Serial.printf("vca=%.2f ", v_vca);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f ", v_ic);
    Serial.printf("potencia_ativa=%.2f", v_potencia_ativa);
    Serial.println();
}

// Publica medias (avg) + last + delta. Zera acumuladores apos publish.
// Estrutura aninhada espelha _genDeviceReader (RS485): usa tipo.ai/bi do catalogo
// para resolver json paths, agrupar por top-level key, e respeitar tipo.group_order.
static void _publish_tcp_inv_0(tcp_publish_fn publish) {
    if (!_tds0.valid || _tds0.samples == 0) {
        // Enriquecido p/ diagnostico REMOTO: motivo da ultima falha + nº de reconexoes.
        char _nsbuf[112];
        snprintf(_nsbuf, sizeof(_nsbuf),
                 "{\"error\":\"no_samples\",\"last_fail\":\"%s\",\"reconnects\":%lu}",
                 _tcp_last_fail_reason, (unsigned long)_tds0.tcp_reconnects);
        publish("Inv 1_1/data", _nsbuf);
        return;
    }

    int n = _tds0.samples;
    // JSON e payload na HEAP (nao na stack). loopTask tem 8KB de stack;
    // alocar 3KB+3KB na stack aqui causava overflow + Panic em ~67s no projeto
    // Chimarrao com Power_Meter + 2 inversores. Heap fica em ~280KB livres,
    // sobra de sobra pra os 3KB do doc+payload.
    DynamicJsonDocument d(3072);
    d["timestamp"] = (long)time(nullptr);
    d["inverter_id"] = 1;
    d["samples"] = n;

    JsonObject g_info = d.createNestedObject("info");
    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(_tds0.last_[39])); g_info["device_type"] = String(_h); }
    g_info["output_type"] = _tds0.last_[40];
    g_info["nominal_power"] = _tds0.last_[43];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _tds0.last_[38];
    g_energy["total_yield"] = _tds0.last_[41];
    g_energy["Potencia Aparente1"] = _tds0.last_[49];
    g_energy["daily_running_time"] = _tds0.last_[50];
    g_energy["Potencia Aparente2"] = _tds0.last_[51];
    g_energy["total_running_time"] = _tds0.last_[52];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _tds0.last_[42];
    JsonObject g_dc = d.createNestedObject("dc");
    g_dc["mppt1_voltage"] = (float)(_tds0.sum_[6] / n);
    g_dc["mppt2_voltage"] = (float)(_tds0.sum_[7] / n);
    g_dc["mppt3_voltage"] = (float)(_tds0.sum_[8] / n);
    g_dc["mppt4_voltage"] = (float)(_tds0.sum_[9] / n);
    g_dc["mppt5_voltage"] = (float)(_tds0.sum_[10] / n);
    g_dc["mppt6_voltage"] = (float)(_tds0.sum_[11] / n);
    g_dc["mppt7_voltage"] = (float)(_tds0.sum_[12] / n);
    g_dc["mppt8_voltage"] = (float)(_tds0.sum_[13] / n);
    g_dc["mppt9_voltage"] = (float)(_tds0.sum_[14] / n);
    g_dc["total_power"] = (float)(_tds0.sum_[15] / n);
    g_dc["string1_current"] = (float)(_tds0.sum_[16] / n);
    g_dc["string2_current"] = (float)(_tds0.sum_[17] / n);
    g_dc["string3_current"] = (float)(_tds0.sum_[18] / n);
    g_dc["string4_current"] = (float)(_tds0.sum_[19] / n);
    g_dc["string5_current"] = (float)(_tds0.sum_[20] / n);
    g_dc["string6_current"] = (float)(_tds0.sum_[21] / n);
    g_dc["string7_current"] = (float)(_tds0.sum_[22] / n);
    g_dc["string8_current"] = (float)(_tds0.sum_[23] / n);
    g_dc["string9_current"] = (float)(_tds0.sum_[24] / n);
    g_dc["string10_current"] = (float)(_tds0.sum_[25] / n);
    g_dc["string11_current"] = (float)(_tds0.sum_[26] / n);
    g_dc["string12_current"] = (float)(_tds0.sum_[27] / n);
    g_dc["string13_current"] = (float)(_tds0.sum_[28] / n);
    g_dc["string14_current"] = (float)(_tds0.sum_[29] / n);
    g_dc["string15_current"] = (float)(_tds0.sum_[30] / n);
    g_dc["string16_current"] = (float)(_tds0.sum_[31] / n);
    g_dc["string17_current"] = (float)(_tds0.sum_[32] / n);
    g_dc["string18_current"] = (float)(_tds0.sum_[33] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_tds0.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_tds0.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_tds0.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_tds0.sum_[0] / n);
    g_current["phase_b"] = (float)(_tds0.sum_[1] / n);
    g_current["phase_c"] = (float)(_tds0.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _tds0.last_[34];
    g_power["frequency"] = _tds0.last_[35];
    g_power["apparent_total"] = _tds0.last_[44];
    g_power["active_total"] = _tds0.last_[47];
    g_power["reactive_total"] = _tds0.last_[48];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _tds0.last_[36];
    g_status["work_state_text"] = _work_state_text((uint16_t)_tds0.last_[36]);
    JsonObject g_protection = d.createNestedObject("protection");
    g_protection["bus_voltage"] = _tds0.last_[37];
    g_protection["insulation_resistance"] = _tds0.last_[53];
    JsonObject g_regulation = d.createNestedObject("regulation");
    g_regulation["nominal_reactive_power"] = _tds0.last_[54];
    JsonObject g_pid = d.createNestedObject("pid");
    g_pid["alarm_code"] = _tds0.last_[45];
    g_pid["work_state"] = _tds0.last_[46];

    // Payload na HEAP (evita estouro de stack). Liberado ao sair do escopo.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[TCP-INV] OOM ao alocar payload");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Inv 1_1/data", payload);
        Serial.printf("\n===== PUBLICADO: Inv 1 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 34; i++) _tds0.sum_[i] = 0;
    _tds0.samples = 0;
}


// =============================================================================
// Inv 2 — Sungrow SG250CX (slave 2)
// 5 blocos | 55 pontos AI (34 avg, 21 last, 0 delta)
// word_order: low_first
// =============================================================================
struct _TcpDs1State {
    double sum_[34];
    int samples;
    float last_[55];
    float first_delta_[1];
    bool has_first_delta;
    bool valid;
    int fail_streak;
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
    uint32_t tcp_reconnects;       // reconexoes forcadas apos falha (diagnostico remoto)
};
static _TcpDs1State _tds1 = {};

// Le todos os blocos do inversor e popula buf concatenado.
// Retorna false se qualquer bloco falhar (timeout, excecao, slave invalido).
static bool _read_tcp_inv_1_raw(uint16_t *buf) {
    // Bloco 0: regs 5000-5049, func 0x04 — Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status
    {
        uint16_t tmp0[50];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 2, 0x04, 4999, 50, tmp0)) {
            Serial.printf("[TCP-INV] Inv 2(id2) bloco 0 FAIL (reg=4999 count=50)\n");
            return false;
        }
        for (uint16_t i = 0; i < 50; i++) buf[0 + i] = tmp0[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 1: regs 5050-5089, func 0x04 — Regs 5050-5089: regulation, insulation
    {
        uint16_t tmp1[40];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 2, 0x04, 5049, 40, tmp1)) {
            Serial.printf("[TCP-INV] Inv 2(id2) bloco 1 FAIL (reg=5049 count=40)\n");
            return false;
        }
        for (uint16_t i = 0; i < 40; i++) buf[50 + i] = tmp1[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 2: regs 5090-5119, func 0x04 — Regs 5090-5119: tempo diario, MPPT 4-6
    {
        uint16_t tmp2[30];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 2, 0x04, 5089, 30, tmp2)) {
            Serial.printf("[TCP-INV] Inv 2(id2) bloco 2 FAIL (reg=5089 count=30)\n");
            return false;
        }
        for (uint16_t i = 0; i < 30; i++) buf[90 + i] = tmp2[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 3: regs 5120-5154, func 0x04 — Regs 5120-5154: MPPT 7-9, bus voltage, PID
    {
        uint16_t tmp3[35];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 2, 0x04, 5119, 35, tmp3)) {
            Serial.printf("[TCP-INV] Inv 2(id2) bloco 3 FAIL (reg=5119 count=35)\n");
            return false;
        }
        for (uint16_t i = 0; i < 35; i++) buf[120 + i] = tmp3[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 4: regs 7013-7030, func 0x04 — Regs 7013-7030: strings 1-18
    {
        uint16_t tmp4[18];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 2, 0x04, 7012, 18, tmp4)) {
            Serial.printf("[TCP-INV] Inv 2(id2) bloco 4 FAIL (reg=7012 count=18)\n");
            return false;
        }
        for (uint16_t i = 0; i < 18; i++) buf[155 + i] = tmp4[i];
    }
    return true;
}

// Le + acumula. Chamar a cada READ_INTERVAL_MS (round-robin em inverter_tcp_sample_one).
static void _sample_tcp_inv_1() {
    // Back-off: device TCP que nao responde fica em cooldown — pula a leitura
    // (que bloquearia o loop ~GATEWAY_TIMEOUT no _modbus_tcp_read) ate expirar.
    // Espelha o leitor RS485; sem isso um device morto (ex: Power_Meter ausente)
    // starva o keepalive do MQTT e a conexao fica flapando.
    if (_tds1.cooldown_until && (long)(millis() - _tds1.cooldown_until) < 0) return;

    uint16_t buf[173];
    if (!_read_tcp_inv_1_raw(buf)) {
        // Falha: fecha o socket p/ o PROXIMO tick reconectar. Reconectar resincroniza
        // o stream RTU-sobre-TCP e faz o conversor resetar o bridge RS485 — e' o que o
        // reboot faz p/ dar 1 leitura boa, aqui a cada falha (e apos cada cooldown, pois
        // o socket fica fechado). Leitura UNICA no ciclo (sem retry) pra nao dobrar o
        // bloqueio do loop se o device estiver mudo — a recuperacao vem no proximo tick.
        Client* _rc = _active_tcp_client();
        if (_rc) _rc->stop();
        _tcp_cur_ip[0] = 0; _tcp_cur_port = 0;   // forca _tcp_ensure_conn a reconectar
        _tds1.tcp_reconnects++;
        _tds1.fail_streak++;
        Serial.printf("[TCP-INV] Inv 2(id2): falha leitura (consecutivas: %d)\n", _tds1.fail_streak);
        if (_tds1.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _tds1.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_tds1.cooldown_until == 0) _tds1.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[TCP-INV] Inv 2(id2): cooldown %lus (nao responde) — loop liberado p/ MQTT/cmd\n", (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    _tds1.cooldown_until = 0;
    if (_tds1.fail_streak > 0) {
        Serial.printf("[TCP-INV] Inv 2(id2): OK (apos %d falhas)\n", _tds1.fail_streak);
        _tds1.fail_streak = 0;
    }

    float v_ia = (float)buf[22] / 10.0;
    _tds1.sum_[0] += v_ia;
    float v_ib = (float)buf[23] / 10.0;
    _tds1.sum_[1] += v_ib;
    float v_ic = (float)buf[24] / 10.0;
    _tds1.sum_[2] += v_ic;
    float v_vab = (float)buf[19] / 10.0;
    _tds1.sum_[3] += v_vab;
    float v_vbc = (float)buf[20] / 10.0;
    _tds1.sum_[4] += v_vbc;
    float v_vca = (float)buf[21] / 10.0;
    _tds1.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)buf[11] / 10.0;
    _tds1.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)buf[13] / 10.0;
    _tds1.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)buf[15] / 10.0;
    _tds1.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)buf[115] / 10.0;
    _tds1.sum_[9] += v_mppt4_voltage;
    float v_mppt5_voltage = (float)buf[117] / 10.0;
    _tds1.sum_[10] += v_mppt5_voltage;
    float v_mppt6_voltage = (float)buf[119] / 10.0;
    _tds1.sum_[11] += v_mppt6_voltage;
    float v_mppt7_voltage = (float)buf[121] / 10.0;
    _tds1.sum_[12] += v_mppt7_voltage;
    float v_mppt8_voltage = (float)buf[123] / 10.0;
    _tds1.sum_[13] += v_mppt8_voltage;
    float v_mppt9_voltage = (float)buf[130] / 10.0;
    _tds1.sum_[14] += v_mppt9_voltage;
    float v_dc_total_power = (float)(((uint32_t)buf[17+1] << 16) | buf[17]);
    _tds1.sum_[15] += v_dc_total_power;
    float v_string1_current = (float)buf[155] / 100.0;
    _tds1.sum_[16] += v_string1_current;
    float v_string2_current = (float)buf[156] / 100.0;
    _tds1.sum_[17] += v_string2_current;
    float v_string3_current = (float)buf[157] / 100.0;
    _tds1.sum_[18] += v_string3_current;
    float v_string4_current = (float)buf[158] / 100.0;
    _tds1.sum_[19] += v_string4_current;
    float v_string5_current = (float)buf[159] / 100.0;
    _tds1.sum_[20] += v_string5_current;
    float v_string6_current = (float)buf[160] / 100.0;
    _tds1.sum_[21] += v_string6_current;
    float v_string7_current = (float)buf[161] / 100.0;
    _tds1.sum_[22] += v_string7_current;
    float v_string8_current = (float)buf[162] / 100.0;
    _tds1.sum_[23] += v_string8_current;
    float v_string9_current = (float)buf[163] / 100.0;
    _tds1.sum_[24] += v_string9_current;
    float v_string10_current = (float)buf[164] / 100.0;
    _tds1.sum_[25] += v_string10_current;
    float v_string11_current = (float)buf[165] / 100.0;
    _tds1.sum_[26] += v_string11_current;
    float v_string12_current = (float)buf[166] / 100.0;
    _tds1.sum_[27] += v_string12_current;
    float v_string13_current = (float)buf[167] / 100.0;
    _tds1.sum_[28] += v_string13_current;
    float v_string14_current = (float)buf[168] / 100.0;
    _tds1.sum_[29] += v_string14_current;
    float v_string15_current = (float)buf[169] / 100.0;
    _tds1.sum_[30] += v_string15_current;
    float v_string16_current = (float)buf[170] / 100.0;
    _tds1.sum_[31] += v_string16_current;
    float v_string17_current = (float)buf[171] / 100.0;
    _tds1.sum_[32] += v_string17_current;
    float v_string18_current = (float)buf[172] / 100.0;
    _tds1.sum_[33] += v_string18_current;
    float v_fp = (float)(int16_t)buf[35] / 1000.0;
    float v_freq = (float)buf[36] / 10.0;
    float v_work_state = (float)buf[38];
    float v_bus_voltage = (float)buf[147] / 10.0;
    float v_daily_yield = (float)buf[3] / 10.0;
    float v_device_type = (float)buf[0];
    float v_output_type = (float)buf[2];
    float v_total_yield = (float)(((uint32_t)buf[4+1] << 16) | buf[4]);
    float v_temp_interna = (float)(int16_t)buf[8] / 10.0;
    float v_nominal_power = (float)buf[1] / 10.0;
    float v_apparent_total = (float)(((uint32_t)buf[9+1] << 16) | buf[9]);
    float v_pid_alarm_code = (float)buf[151];
    float v_pid_work_state = (float)buf[150];
    float v_potencia_ativa = (float)(((uint32_t)buf[31+1] << 16) | buf[31]);
    float v_potencia_reativa = (float)(int32_t)(((uint32_t)buf[33+1] << 16) | buf[33]);
    float v_potencia_aparente = (float)(((uint32_t)buf[9+1] << 16) | buf[9]);
    float v_daily_running_time = (float)buf[113];
    float v_potencia_aparente2 = (float)(((uint32_t)buf[10+1] << 16) | buf[10]);
    float v_total_running_time = (float)(((uint32_t)buf[6+1] << 16) | buf[6]);
    float v_insulation_resistance = (float)buf[71];
    float v_nominal_reactive_power = (float)buf[49] / 10.0;
    _tds1.last_[0] = v_ia;
    _tds1.last_[1] = v_ib;
    _tds1.last_[2] = v_ic;
    _tds1.last_[3] = v_vab;
    _tds1.last_[4] = v_vbc;
    _tds1.last_[5] = v_vca;
    _tds1.last_[6] = v_mppt1_voltage;
    _tds1.last_[7] = v_mppt2_voltage;
    _tds1.last_[8] = v_mppt3_voltage;
    _tds1.last_[9] = v_mppt4_voltage;
    _tds1.last_[10] = v_mppt5_voltage;
    _tds1.last_[11] = v_mppt6_voltage;
    _tds1.last_[12] = v_mppt7_voltage;
    _tds1.last_[13] = v_mppt8_voltage;
    _tds1.last_[14] = v_mppt9_voltage;
    _tds1.last_[15] = v_dc_total_power;
    _tds1.last_[16] = v_string1_current;
    _tds1.last_[17] = v_string2_current;
    _tds1.last_[18] = v_string3_current;
    _tds1.last_[19] = v_string4_current;
    _tds1.last_[20] = v_string5_current;
    _tds1.last_[21] = v_string6_current;
    _tds1.last_[22] = v_string7_current;
    _tds1.last_[23] = v_string8_current;
    _tds1.last_[24] = v_string9_current;
    _tds1.last_[25] = v_string10_current;
    _tds1.last_[26] = v_string11_current;
    _tds1.last_[27] = v_string12_current;
    _tds1.last_[28] = v_string13_current;
    _tds1.last_[29] = v_string14_current;
    _tds1.last_[30] = v_string15_current;
    _tds1.last_[31] = v_string16_current;
    _tds1.last_[32] = v_string17_current;
    _tds1.last_[33] = v_string18_current;
    _tds1.last_[34] = v_fp;
    _tds1.last_[35] = v_freq;
    _tds1.last_[36] = v_work_state;
    _tds1.last_[37] = v_bus_voltage;
    _tds1.last_[38] = v_daily_yield;
    _tds1.last_[39] = v_device_type;
    _tds1.last_[40] = v_output_type;
    _tds1.last_[41] = v_total_yield;
    _tds1.last_[42] = v_temp_interna;
    _tds1.last_[43] = v_nominal_power;
    _tds1.last_[44] = v_apparent_total;
    _tds1.last_[45] = v_pid_alarm_code;
    _tds1.last_[46] = v_pid_work_state;
    _tds1.last_[47] = v_potencia_ativa;
    _tds1.last_[48] = v_potencia_reativa;
    _tds1.last_[49] = v_potencia_aparente;
    _tds1.last_[50] = v_daily_running_time;
    _tds1.last_[51] = v_potencia_aparente2;
    _tds1.last_[52] = v_total_running_time;
    _tds1.last_[53] = v_insulation_resistance;
    _tds1.last_[54] = v_nominal_reactive_power;
    _tds1.samples++;
    _tds1.valid = true;
    Serial.printf("[TCP-INV] Inv 2(id2) #%d: ", _tds1.samples);
    Serial.printf("vab=%.2f ", v_vab);
    Serial.printf("vbc=%.2f ", v_vbc);
    Serial.printf("vca=%.2f ", v_vca);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f ", v_ic);
    Serial.printf("potencia_ativa=%.2f", v_potencia_ativa);
    Serial.println();
}

// Publica medias (avg) + last + delta. Zera acumuladores apos publish.
// Estrutura aninhada espelha _genDeviceReader (RS485): usa tipo.ai/bi do catalogo
// para resolver json paths, agrupar por top-level key, e respeitar tipo.group_order.
static void _publish_tcp_inv_1(tcp_publish_fn publish) {
    if (!_tds1.valid || _tds1.samples == 0) {
        // Enriquecido p/ diagnostico REMOTO: motivo da ultima falha + nº de reconexoes.
        char _nsbuf[112];
        snprintf(_nsbuf, sizeof(_nsbuf),
                 "{\"error\":\"no_samples\",\"last_fail\":\"%s\",\"reconnects\":%lu}",
                 _tcp_last_fail_reason, (unsigned long)_tds1.tcp_reconnects);
        publish("Inv 2_2/data", _nsbuf);
        return;
    }

    int n = _tds1.samples;
    // JSON e payload na HEAP (nao na stack). loopTask tem 8KB de stack;
    // alocar 3KB+3KB na stack aqui causava overflow + Panic em ~67s no projeto
    // Chimarrao com Power_Meter + 2 inversores. Heap fica em ~280KB livres,
    // sobra de sobra pra os 3KB do doc+payload.
    DynamicJsonDocument d(3072);
    d["timestamp"] = (long)time(nullptr);
    d["inverter_id"] = 2;
    d["samples"] = n;

    JsonObject g_info = d.createNestedObject("info");
    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(_tds1.last_[39])); g_info["device_type"] = String(_h); }
    g_info["output_type"] = _tds1.last_[40];
    g_info["nominal_power"] = _tds1.last_[43];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _tds1.last_[38];
    g_energy["total_yield"] = _tds1.last_[41];
    g_energy["Potencia Aparente1"] = _tds1.last_[49];
    g_energy["daily_running_time"] = _tds1.last_[50];
    g_energy["Potencia Aparente2"] = _tds1.last_[51];
    g_energy["total_running_time"] = _tds1.last_[52];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _tds1.last_[42];
    JsonObject g_dc = d.createNestedObject("dc");
    g_dc["mppt1_voltage"] = (float)(_tds1.sum_[6] / n);
    g_dc["mppt2_voltage"] = (float)(_tds1.sum_[7] / n);
    g_dc["mppt3_voltage"] = (float)(_tds1.sum_[8] / n);
    g_dc["mppt4_voltage"] = (float)(_tds1.sum_[9] / n);
    g_dc["mppt5_voltage"] = (float)(_tds1.sum_[10] / n);
    g_dc["mppt6_voltage"] = (float)(_tds1.sum_[11] / n);
    g_dc["mppt7_voltage"] = (float)(_tds1.sum_[12] / n);
    g_dc["mppt8_voltage"] = (float)(_tds1.sum_[13] / n);
    g_dc["mppt9_voltage"] = (float)(_tds1.sum_[14] / n);
    g_dc["total_power"] = (float)(_tds1.sum_[15] / n);
    g_dc["string1_current"] = (float)(_tds1.sum_[16] / n);
    g_dc["string2_current"] = (float)(_tds1.sum_[17] / n);
    g_dc["string3_current"] = (float)(_tds1.sum_[18] / n);
    g_dc["string4_current"] = (float)(_tds1.sum_[19] / n);
    g_dc["string5_current"] = (float)(_tds1.sum_[20] / n);
    g_dc["string6_current"] = (float)(_tds1.sum_[21] / n);
    g_dc["string7_current"] = (float)(_tds1.sum_[22] / n);
    g_dc["string8_current"] = (float)(_tds1.sum_[23] / n);
    g_dc["string9_current"] = (float)(_tds1.sum_[24] / n);
    g_dc["string10_current"] = (float)(_tds1.sum_[25] / n);
    g_dc["string11_current"] = (float)(_tds1.sum_[26] / n);
    g_dc["string12_current"] = (float)(_tds1.sum_[27] / n);
    g_dc["string13_current"] = (float)(_tds1.sum_[28] / n);
    g_dc["string14_current"] = (float)(_tds1.sum_[29] / n);
    g_dc["string15_current"] = (float)(_tds1.sum_[30] / n);
    g_dc["string16_current"] = (float)(_tds1.sum_[31] / n);
    g_dc["string17_current"] = (float)(_tds1.sum_[32] / n);
    g_dc["string18_current"] = (float)(_tds1.sum_[33] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_tds1.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_tds1.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_tds1.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_tds1.sum_[0] / n);
    g_current["phase_b"] = (float)(_tds1.sum_[1] / n);
    g_current["phase_c"] = (float)(_tds1.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _tds1.last_[34];
    g_power["frequency"] = _tds1.last_[35];
    g_power["apparent_total"] = _tds1.last_[44];
    g_power["active_total"] = _tds1.last_[47];
    g_power["reactive_total"] = _tds1.last_[48];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _tds1.last_[36];
    g_status["work_state_text"] = _work_state_text((uint16_t)_tds1.last_[36]);
    JsonObject g_protection = d.createNestedObject("protection");
    g_protection["bus_voltage"] = _tds1.last_[37];
    g_protection["insulation_resistance"] = _tds1.last_[53];
    JsonObject g_regulation = d.createNestedObject("regulation");
    g_regulation["nominal_reactive_power"] = _tds1.last_[54];
    JsonObject g_pid = d.createNestedObject("pid");
    g_pid["alarm_code"] = _tds1.last_[45];
    g_pid["work_state"] = _tds1.last_[46];

    // Payload na HEAP (evita estouro de stack). Liberado ao sair do escopo.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[TCP-INV] OOM ao alocar payload");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Inv 2_2/data", payload);
        Serial.printf("\n===== PUBLICADO: Inv 2 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 34; i++) _tds1.sum_[i] = 0;
    _tds1.samples = 0;
}


// =============================================================================
// Inv 3 — Sungrow SG250CX (slave 3)
// 5 blocos | 55 pontos AI (34 avg, 21 last, 0 delta)
// word_order: low_first
// =============================================================================
struct _TcpDs2State {
    double sum_[34];
    int samples;
    float last_[55];
    float first_delta_[1];
    bool has_first_delta;
    bool valid;
    int fail_streak;
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
    uint32_t tcp_reconnects;       // reconexoes forcadas apos falha (diagnostico remoto)
};
static _TcpDs2State _tds2 = {};

// Le todos os blocos do inversor e popula buf concatenado.
// Retorna false se qualquer bloco falhar (timeout, excecao, slave invalido).
static bool _read_tcp_inv_2_raw(uint16_t *buf) {
    // Bloco 0: regs 5000-5049, func 0x04 — Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status
    {
        uint16_t tmp0[50];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 3, 0x04, 4999, 50, tmp0)) {
            Serial.printf("[TCP-INV] Inv 3(id3) bloco 0 FAIL (reg=4999 count=50)\n");
            return false;
        }
        for (uint16_t i = 0; i < 50; i++) buf[0 + i] = tmp0[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 1: regs 5050-5089, func 0x04 — Regs 5050-5089: regulation, insulation
    {
        uint16_t tmp1[40];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 3, 0x04, 5049, 40, tmp1)) {
            Serial.printf("[TCP-INV] Inv 3(id3) bloco 1 FAIL (reg=5049 count=40)\n");
            return false;
        }
        for (uint16_t i = 0; i < 40; i++) buf[50 + i] = tmp1[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 2: regs 5090-5119, func 0x04 — Regs 5090-5119: tempo diario, MPPT 4-6
    {
        uint16_t tmp2[30];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 3, 0x04, 5089, 30, tmp2)) {
            Serial.printf("[TCP-INV] Inv 3(id3) bloco 2 FAIL (reg=5089 count=30)\n");
            return false;
        }
        for (uint16_t i = 0; i < 30; i++) buf[90 + i] = tmp2[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 3: regs 5120-5154, func 0x04 — Regs 5120-5154: MPPT 7-9, bus voltage, PID
    {
        uint16_t tmp3[35];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 3, 0x04, 5119, 35, tmp3)) {
            Serial.printf("[TCP-INV] Inv 3(id3) bloco 3 FAIL (reg=5119 count=35)\n");
            return false;
        }
        for (uint16_t i = 0; i < 35; i++) buf[120 + i] = tmp3[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 4: regs 7013-7030, func 0x04 — Regs 7013-7030: strings 1-18
    {
        uint16_t tmp4[18];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 3, 0x04, 7012, 18, tmp4)) {
            Serial.printf("[TCP-INV] Inv 3(id3) bloco 4 FAIL (reg=7012 count=18)\n");
            return false;
        }
        for (uint16_t i = 0; i < 18; i++) buf[155 + i] = tmp4[i];
    }
    return true;
}

// Le + acumula. Chamar a cada READ_INTERVAL_MS (round-robin em inverter_tcp_sample_one).
static void _sample_tcp_inv_2() {
    // Back-off: device TCP que nao responde fica em cooldown — pula a leitura
    // (que bloquearia o loop ~GATEWAY_TIMEOUT no _modbus_tcp_read) ate expirar.
    // Espelha o leitor RS485; sem isso um device morto (ex: Power_Meter ausente)
    // starva o keepalive do MQTT e a conexao fica flapando.
    if (_tds2.cooldown_until && (long)(millis() - _tds2.cooldown_until) < 0) return;

    uint16_t buf[173];
    if (!_read_tcp_inv_2_raw(buf)) {
        // Falha: fecha o socket p/ o PROXIMO tick reconectar. Reconectar resincroniza
        // o stream RTU-sobre-TCP e faz o conversor resetar o bridge RS485 — e' o que o
        // reboot faz p/ dar 1 leitura boa, aqui a cada falha (e apos cada cooldown, pois
        // o socket fica fechado). Leitura UNICA no ciclo (sem retry) pra nao dobrar o
        // bloqueio do loop se o device estiver mudo — a recuperacao vem no proximo tick.
        Client* _rc = _active_tcp_client();
        if (_rc) _rc->stop();
        _tcp_cur_ip[0] = 0; _tcp_cur_port = 0;   // forca _tcp_ensure_conn a reconectar
        _tds2.tcp_reconnects++;
        _tds2.fail_streak++;
        Serial.printf("[TCP-INV] Inv 3(id3): falha leitura (consecutivas: %d)\n", _tds2.fail_streak);
        if (_tds2.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _tds2.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_tds2.cooldown_until == 0) _tds2.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[TCP-INV] Inv 3(id3): cooldown %lus (nao responde) — loop liberado p/ MQTT/cmd\n", (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    _tds2.cooldown_until = 0;
    if (_tds2.fail_streak > 0) {
        Serial.printf("[TCP-INV] Inv 3(id3): OK (apos %d falhas)\n", _tds2.fail_streak);
        _tds2.fail_streak = 0;
    }

    float v_ia = (float)buf[22] / 10.0;
    _tds2.sum_[0] += v_ia;
    float v_ib = (float)buf[23] / 10.0;
    _tds2.sum_[1] += v_ib;
    float v_ic = (float)buf[24] / 10.0;
    _tds2.sum_[2] += v_ic;
    float v_vab = (float)buf[19] / 10.0;
    _tds2.sum_[3] += v_vab;
    float v_vbc = (float)buf[20] / 10.0;
    _tds2.sum_[4] += v_vbc;
    float v_vca = (float)buf[21] / 10.0;
    _tds2.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)buf[11] / 10.0;
    _tds2.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)buf[13] / 10.0;
    _tds2.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)buf[15] / 10.0;
    _tds2.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)buf[115] / 10.0;
    _tds2.sum_[9] += v_mppt4_voltage;
    float v_mppt5_voltage = (float)buf[117] / 10.0;
    _tds2.sum_[10] += v_mppt5_voltage;
    float v_mppt6_voltage = (float)buf[119] / 10.0;
    _tds2.sum_[11] += v_mppt6_voltage;
    float v_mppt7_voltage = (float)buf[121] / 10.0;
    _tds2.sum_[12] += v_mppt7_voltage;
    float v_mppt8_voltage = (float)buf[123] / 10.0;
    _tds2.sum_[13] += v_mppt8_voltage;
    float v_mppt9_voltage = (float)buf[130] / 10.0;
    _tds2.sum_[14] += v_mppt9_voltage;
    float v_dc_total_power = (float)(((uint32_t)buf[17+1] << 16) | buf[17]);
    _tds2.sum_[15] += v_dc_total_power;
    float v_string1_current = (float)buf[155] / 100.0;
    _tds2.sum_[16] += v_string1_current;
    float v_string2_current = (float)buf[156] / 100.0;
    _tds2.sum_[17] += v_string2_current;
    float v_string3_current = (float)buf[157] / 100.0;
    _tds2.sum_[18] += v_string3_current;
    float v_string4_current = (float)buf[158] / 100.0;
    _tds2.sum_[19] += v_string4_current;
    float v_string5_current = (float)buf[159] / 100.0;
    _tds2.sum_[20] += v_string5_current;
    float v_string6_current = (float)buf[160] / 100.0;
    _tds2.sum_[21] += v_string6_current;
    float v_string7_current = (float)buf[161] / 100.0;
    _tds2.sum_[22] += v_string7_current;
    float v_string8_current = (float)buf[162] / 100.0;
    _tds2.sum_[23] += v_string8_current;
    float v_string9_current = (float)buf[163] / 100.0;
    _tds2.sum_[24] += v_string9_current;
    float v_string10_current = (float)buf[164] / 100.0;
    _tds2.sum_[25] += v_string10_current;
    float v_string11_current = (float)buf[165] / 100.0;
    _tds2.sum_[26] += v_string11_current;
    float v_string12_current = (float)buf[166] / 100.0;
    _tds2.sum_[27] += v_string12_current;
    float v_string13_current = (float)buf[167] / 100.0;
    _tds2.sum_[28] += v_string13_current;
    float v_string14_current = (float)buf[168] / 100.0;
    _tds2.sum_[29] += v_string14_current;
    float v_string15_current = (float)buf[169] / 100.0;
    _tds2.sum_[30] += v_string15_current;
    float v_string16_current = (float)buf[170] / 100.0;
    _tds2.sum_[31] += v_string16_current;
    float v_string17_current = (float)buf[171] / 100.0;
    _tds2.sum_[32] += v_string17_current;
    float v_string18_current = (float)buf[172] / 100.0;
    _tds2.sum_[33] += v_string18_current;
    float v_fp = (float)(int16_t)buf[35] / 1000.0;
    float v_freq = (float)buf[36] / 10.0;
    float v_work_state = (float)buf[38];
    float v_bus_voltage = (float)buf[147] / 10.0;
    float v_daily_yield = (float)buf[3] / 10.0;
    float v_device_type = (float)buf[0];
    float v_output_type = (float)buf[2];
    float v_total_yield = (float)(((uint32_t)buf[4+1] << 16) | buf[4]);
    float v_temp_interna = (float)(int16_t)buf[8] / 10.0;
    float v_nominal_power = (float)buf[1] / 10.0;
    float v_apparent_total = (float)(((uint32_t)buf[9+1] << 16) | buf[9]);
    float v_pid_alarm_code = (float)buf[151];
    float v_pid_work_state = (float)buf[150];
    float v_potencia_ativa = (float)(((uint32_t)buf[31+1] << 16) | buf[31]);
    float v_potencia_reativa = (float)(int32_t)(((uint32_t)buf[33+1] << 16) | buf[33]);
    float v_potencia_aparente = (float)(((uint32_t)buf[9+1] << 16) | buf[9]);
    float v_daily_running_time = (float)buf[113];
    float v_potencia_aparente2 = (float)(((uint32_t)buf[10+1] << 16) | buf[10]);
    float v_total_running_time = (float)(((uint32_t)buf[6+1] << 16) | buf[6]);
    float v_insulation_resistance = (float)buf[71];
    float v_nominal_reactive_power = (float)buf[49] / 10.0;
    _tds2.last_[0] = v_ia;
    _tds2.last_[1] = v_ib;
    _tds2.last_[2] = v_ic;
    _tds2.last_[3] = v_vab;
    _tds2.last_[4] = v_vbc;
    _tds2.last_[5] = v_vca;
    _tds2.last_[6] = v_mppt1_voltage;
    _tds2.last_[7] = v_mppt2_voltage;
    _tds2.last_[8] = v_mppt3_voltage;
    _tds2.last_[9] = v_mppt4_voltage;
    _tds2.last_[10] = v_mppt5_voltage;
    _tds2.last_[11] = v_mppt6_voltage;
    _tds2.last_[12] = v_mppt7_voltage;
    _tds2.last_[13] = v_mppt8_voltage;
    _tds2.last_[14] = v_mppt9_voltage;
    _tds2.last_[15] = v_dc_total_power;
    _tds2.last_[16] = v_string1_current;
    _tds2.last_[17] = v_string2_current;
    _tds2.last_[18] = v_string3_current;
    _tds2.last_[19] = v_string4_current;
    _tds2.last_[20] = v_string5_current;
    _tds2.last_[21] = v_string6_current;
    _tds2.last_[22] = v_string7_current;
    _tds2.last_[23] = v_string8_current;
    _tds2.last_[24] = v_string9_current;
    _tds2.last_[25] = v_string10_current;
    _tds2.last_[26] = v_string11_current;
    _tds2.last_[27] = v_string12_current;
    _tds2.last_[28] = v_string13_current;
    _tds2.last_[29] = v_string14_current;
    _tds2.last_[30] = v_string15_current;
    _tds2.last_[31] = v_string16_current;
    _tds2.last_[32] = v_string17_current;
    _tds2.last_[33] = v_string18_current;
    _tds2.last_[34] = v_fp;
    _tds2.last_[35] = v_freq;
    _tds2.last_[36] = v_work_state;
    _tds2.last_[37] = v_bus_voltage;
    _tds2.last_[38] = v_daily_yield;
    _tds2.last_[39] = v_device_type;
    _tds2.last_[40] = v_output_type;
    _tds2.last_[41] = v_total_yield;
    _tds2.last_[42] = v_temp_interna;
    _tds2.last_[43] = v_nominal_power;
    _tds2.last_[44] = v_apparent_total;
    _tds2.last_[45] = v_pid_alarm_code;
    _tds2.last_[46] = v_pid_work_state;
    _tds2.last_[47] = v_potencia_ativa;
    _tds2.last_[48] = v_potencia_reativa;
    _tds2.last_[49] = v_potencia_aparente;
    _tds2.last_[50] = v_daily_running_time;
    _tds2.last_[51] = v_potencia_aparente2;
    _tds2.last_[52] = v_total_running_time;
    _tds2.last_[53] = v_insulation_resistance;
    _tds2.last_[54] = v_nominal_reactive_power;
    _tds2.samples++;
    _tds2.valid = true;
    Serial.printf("[TCP-INV] Inv 3(id3) #%d: ", _tds2.samples);
    Serial.printf("vab=%.2f ", v_vab);
    Serial.printf("vbc=%.2f ", v_vbc);
    Serial.printf("vca=%.2f ", v_vca);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f ", v_ic);
    Serial.printf("potencia_ativa=%.2f", v_potencia_ativa);
    Serial.println();
}

// Publica medias (avg) + last + delta. Zera acumuladores apos publish.
// Estrutura aninhada espelha _genDeviceReader (RS485): usa tipo.ai/bi do catalogo
// para resolver json paths, agrupar por top-level key, e respeitar tipo.group_order.
static void _publish_tcp_inv_2(tcp_publish_fn publish) {
    if (!_tds2.valid || _tds2.samples == 0) {
        // Enriquecido p/ diagnostico REMOTO: motivo da ultima falha + nº de reconexoes.
        char _nsbuf[112];
        snprintf(_nsbuf, sizeof(_nsbuf),
                 "{\"error\":\"no_samples\",\"last_fail\":\"%s\",\"reconnects\":%lu}",
                 _tcp_last_fail_reason, (unsigned long)_tds2.tcp_reconnects);
        publish("Inv 3_3/data", _nsbuf);
        return;
    }

    int n = _tds2.samples;
    // JSON e payload na HEAP (nao na stack). loopTask tem 8KB de stack;
    // alocar 3KB+3KB na stack aqui causava overflow + Panic em ~67s no projeto
    // Chimarrao com Power_Meter + 2 inversores. Heap fica em ~280KB livres,
    // sobra de sobra pra os 3KB do doc+payload.
    DynamicJsonDocument d(3072);
    d["timestamp"] = (long)time(nullptr);
    d["inverter_id"] = 3;
    d["samples"] = n;

    JsonObject g_info = d.createNestedObject("info");
    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(_tds2.last_[39])); g_info["device_type"] = String(_h); }
    g_info["output_type"] = _tds2.last_[40];
    g_info["nominal_power"] = _tds2.last_[43];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _tds2.last_[38];
    g_energy["total_yield"] = _tds2.last_[41];
    g_energy["Potencia Aparente1"] = _tds2.last_[49];
    g_energy["daily_running_time"] = _tds2.last_[50];
    g_energy["Potencia Aparente2"] = _tds2.last_[51];
    g_energy["total_running_time"] = _tds2.last_[52];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _tds2.last_[42];
    JsonObject g_dc = d.createNestedObject("dc");
    g_dc["mppt1_voltage"] = (float)(_tds2.sum_[6] / n);
    g_dc["mppt2_voltage"] = (float)(_tds2.sum_[7] / n);
    g_dc["mppt3_voltage"] = (float)(_tds2.sum_[8] / n);
    g_dc["mppt4_voltage"] = (float)(_tds2.sum_[9] / n);
    g_dc["mppt5_voltage"] = (float)(_tds2.sum_[10] / n);
    g_dc["mppt6_voltage"] = (float)(_tds2.sum_[11] / n);
    g_dc["mppt7_voltage"] = (float)(_tds2.sum_[12] / n);
    g_dc["mppt8_voltage"] = (float)(_tds2.sum_[13] / n);
    g_dc["mppt9_voltage"] = (float)(_tds2.sum_[14] / n);
    g_dc["total_power"] = (float)(_tds2.sum_[15] / n);
    g_dc["string1_current"] = (float)(_tds2.sum_[16] / n);
    g_dc["string2_current"] = (float)(_tds2.sum_[17] / n);
    g_dc["string3_current"] = (float)(_tds2.sum_[18] / n);
    g_dc["string4_current"] = (float)(_tds2.sum_[19] / n);
    g_dc["string5_current"] = (float)(_tds2.sum_[20] / n);
    g_dc["string6_current"] = (float)(_tds2.sum_[21] / n);
    g_dc["string7_current"] = (float)(_tds2.sum_[22] / n);
    g_dc["string8_current"] = (float)(_tds2.sum_[23] / n);
    g_dc["string9_current"] = (float)(_tds2.sum_[24] / n);
    g_dc["string10_current"] = (float)(_tds2.sum_[25] / n);
    g_dc["string11_current"] = (float)(_tds2.sum_[26] / n);
    g_dc["string12_current"] = (float)(_tds2.sum_[27] / n);
    g_dc["string13_current"] = (float)(_tds2.sum_[28] / n);
    g_dc["string14_current"] = (float)(_tds2.sum_[29] / n);
    g_dc["string15_current"] = (float)(_tds2.sum_[30] / n);
    g_dc["string16_current"] = (float)(_tds2.sum_[31] / n);
    g_dc["string17_current"] = (float)(_tds2.sum_[32] / n);
    g_dc["string18_current"] = (float)(_tds2.sum_[33] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_tds2.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_tds2.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_tds2.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_tds2.sum_[0] / n);
    g_current["phase_b"] = (float)(_tds2.sum_[1] / n);
    g_current["phase_c"] = (float)(_tds2.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _tds2.last_[34];
    g_power["frequency"] = _tds2.last_[35];
    g_power["apparent_total"] = _tds2.last_[44];
    g_power["active_total"] = _tds2.last_[47];
    g_power["reactive_total"] = _tds2.last_[48];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _tds2.last_[36];
    g_status["work_state_text"] = _work_state_text((uint16_t)_tds2.last_[36]);
    JsonObject g_protection = d.createNestedObject("protection");
    g_protection["bus_voltage"] = _tds2.last_[37];
    g_protection["insulation_resistance"] = _tds2.last_[53];
    JsonObject g_regulation = d.createNestedObject("regulation");
    g_regulation["nominal_reactive_power"] = _tds2.last_[54];
    JsonObject g_pid = d.createNestedObject("pid");
    g_pid["alarm_code"] = _tds2.last_[45];
    g_pid["work_state"] = _tds2.last_[46];

    // Payload na HEAP (evita estouro de stack). Liberado ao sair do escopo.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[TCP-INV] OOM ao alocar payload");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Inv 3_3/data", payload);
        Serial.printf("\n===== PUBLICADO: Inv 3 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 34; i++) _tds2.sum_[i] = 0;
    _tds2.samples = 0;
}


// =============================================================================
// Inv 4 — Sungrow SG250CX (slave 4)
// 5 blocos | 55 pontos AI (34 avg, 21 last, 0 delta)
// word_order: low_first
// =============================================================================
struct _TcpDs3State {
    double sum_[34];
    int samples;
    float last_[55];
    float first_delta_[1];
    bool has_first_delta;
    bool valid;
    int fail_streak;
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
    uint32_t tcp_reconnects;       // reconexoes forcadas apos falha (diagnostico remoto)
};
static _TcpDs3State _tds3 = {};

// Le todos os blocos do inversor e popula buf concatenado.
// Retorna false se qualquer bloco falhar (timeout, excecao, slave invalido).
static bool _read_tcp_inv_3_raw(uint16_t *buf) {
    // Bloco 0: regs 5000-5049, func 0x04 — Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status
    {
        uint16_t tmp0[50];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 4, 0x04, 4999, 50, tmp0)) {
            Serial.printf("[TCP-INV] Inv 4(id4) bloco 0 FAIL (reg=4999 count=50)\n");
            return false;
        }
        for (uint16_t i = 0; i < 50; i++) buf[0 + i] = tmp0[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 1: regs 5050-5089, func 0x04 — Regs 5050-5089: regulation, insulation
    {
        uint16_t tmp1[40];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 4, 0x04, 5049, 40, tmp1)) {
            Serial.printf("[TCP-INV] Inv 4(id4) bloco 1 FAIL (reg=5049 count=40)\n");
            return false;
        }
        for (uint16_t i = 0; i < 40; i++) buf[50 + i] = tmp1[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 2: regs 5090-5119, func 0x04 — Regs 5090-5119: tempo diario, MPPT 4-6
    {
        uint16_t tmp2[30];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 4, 0x04, 5089, 30, tmp2)) {
            Serial.printf("[TCP-INV] Inv 4(id4) bloco 2 FAIL (reg=5089 count=30)\n");
            return false;
        }
        for (uint16_t i = 0; i < 30; i++) buf[90 + i] = tmp2[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 3: regs 5120-5154, func 0x04 — Regs 5120-5154: MPPT 7-9, bus voltage, PID
    {
        uint16_t tmp3[35];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 4, 0x04, 5119, 35, tmp3)) {
            Serial.printf("[TCP-INV] Inv 4(id4) bloco 3 FAIL (reg=5119 count=35)\n");
            return false;
        }
        for (uint16_t i = 0; i < 35; i++) buf[120 + i] = tmp3[i];
    }
    delay(50);  // espacamento entre blocos pro datalogger respirar
    // Bloco 4: regs 7013-7030, func 0x04 — Regs 7013-7030: strings 1-18
    {
        uint16_t tmp4[18];
        if (!_modbus_tcp_read("192.168.1.10", 502, 2000, 4, 0x04, 7012, 18, tmp4)) {
            Serial.printf("[TCP-INV] Inv 4(id4) bloco 4 FAIL (reg=7012 count=18)\n");
            return false;
        }
        for (uint16_t i = 0; i < 18; i++) buf[155 + i] = tmp4[i];
    }
    return true;
}

// Le + acumula. Chamar a cada READ_INTERVAL_MS (round-robin em inverter_tcp_sample_one).
static void _sample_tcp_inv_3() {
    // Back-off: device TCP que nao responde fica em cooldown — pula a leitura
    // (que bloquearia o loop ~GATEWAY_TIMEOUT no _modbus_tcp_read) ate expirar.
    // Espelha o leitor RS485; sem isso um device morto (ex: Power_Meter ausente)
    // starva o keepalive do MQTT e a conexao fica flapando.
    if (_tds3.cooldown_until && (long)(millis() - _tds3.cooldown_until) < 0) return;

    uint16_t buf[173];
    if (!_read_tcp_inv_3_raw(buf)) {
        // Falha: fecha o socket p/ o PROXIMO tick reconectar. Reconectar resincroniza
        // o stream RTU-sobre-TCP e faz o conversor resetar o bridge RS485 — e' o que o
        // reboot faz p/ dar 1 leitura boa, aqui a cada falha (e apos cada cooldown, pois
        // o socket fica fechado). Leitura UNICA no ciclo (sem retry) pra nao dobrar o
        // bloqueio do loop se o device estiver mudo — a recuperacao vem no proximo tick.
        Client* _rc = _active_tcp_client();
        if (_rc) _rc->stop();
        _tcp_cur_ip[0] = 0; _tcp_cur_port = 0;   // forca _tcp_ensure_conn a reconectar
        _tds3.tcp_reconnects++;
        _tds3.fail_streak++;
        Serial.printf("[TCP-INV] Inv 4(id4): falha leitura (consecutivas: %d)\n", _tds3.fail_streak);
        if (_tds3.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _tds3.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_tds3.cooldown_until == 0) _tds3.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[TCP-INV] Inv 4(id4): cooldown %lus (nao responde) — loop liberado p/ MQTT/cmd\n", (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    _tds3.cooldown_until = 0;
    if (_tds3.fail_streak > 0) {
        Serial.printf("[TCP-INV] Inv 4(id4): OK (apos %d falhas)\n", _tds3.fail_streak);
        _tds3.fail_streak = 0;
    }

    float v_ia = (float)buf[22] / 10.0;
    _tds3.sum_[0] += v_ia;
    float v_ib = (float)buf[23] / 10.0;
    _tds3.sum_[1] += v_ib;
    float v_ic = (float)buf[24] / 10.0;
    _tds3.sum_[2] += v_ic;
    float v_vab = (float)buf[19] / 10.0;
    _tds3.sum_[3] += v_vab;
    float v_vbc = (float)buf[20] / 10.0;
    _tds3.sum_[4] += v_vbc;
    float v_vca = (float)buf[21] / 10.0;
    _tds3.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)buf[11] / 10.0;
    _tds3.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)buf[13] / 10.0;
    _tds3.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)buf[15] / 10.0;
    _tds3.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)buf[115] / 10.0;
    _tds3.sum_[9] += v_mppt4_voltage;
    float v_mppt5_voltage = (float)buf[117] / 10.0;
    _tds3.sum_[10] += v_mppt5_voltage;
    float v_mppt6_voltage = (float)buf[119] / 10.0;
    _tds3.sum_[11] += v_mppt6_voltage;
    float v_mppt7_voltage = (float)buf[121] / 10.0;
    _tds3.sum_[12] += v_mppt7_voltage;
    float v_mppt8_voltage = (float)buf[123] / 10.0;
    _tds3.sum_[13] += v_mppt8_voltage;
    float v_mppt9_voltage = (float)buf[130] / 10.0;
    _tds3.sum_[14] += v_mppt9_voltage;
    float v_dc_total_power = (float)(((uint32_t)buf[17+1] << 16) | buf[17]);
    _tds3.sum_[15] += v_dc_total_power;
    float v_string1_current = (float)buf[155] / 100.0;
    _tds3.sum_[16] += v_string1_current;
    float v_string2_current = (float)buf[156] / 100.0;
    _tds3.sum_[17] += v_string2_current;
    float v_string3_current = (float)buf[157] / 100.0;
    _tds3.sum_[18] += v_string3_current;
    float v_string4_current = (float)buf[158] / 100.0;
    _tds3.sum_[19] += v_string4_current;
    float v_string5_current = (float)buf[159] / 100.0;
    _tds3.sum_[20] += v_string5_current;
    float v_string6_current = (float)buf[160] / 100.0;
    _tds3.sum_[21] += v_string6_current;
    float v_string7_current = (float)buf[161] / 100.0;
    _tds3.sum_[22] += v_string7_current;
    float v_string8_current = (float)buf[162] / 100.0;
    _tds3.sum_[23] += v_string8_current;
    float v_string9_current = (float)buf[163] / 100.0;
    _tds3.sum_[24] += v_string9_current;
    float v_string10_current = (float)buf[164] / 100.0;
    _tds3.sum_[25] += v_string10_current;
    float v_string11_current = (float)buf[165] / 100.0;
    _tds3.sum_[26] += v_string11_current;
    float v_string12_current = (float)buf[166] / 100.0;
    _tds3.sum_[27] += v_string12_current;
    float v_string13_current = (float)buf[167] / 100.0;
    _tds3.sum_[28] += v_string13_current;
    float v_string14_current = (float)buf[168] / 100.0;
    _tds3.sum_[29] += v_string14_current;
    float v_string15_current = (float)buf[169] / 100.0;
    _tds3.sum_[30] += v_string15_current;
    float v_string16_current = (float)buf[170] / 100.0;
    _tds3.sum_[31] += v_string16_current;
    float v_string17_current = (float)buf[171] / 100.0;
    _tds3.sum_[32] += v_string17_current;
    float v_string18_current = (float)buf[172] / 100.0;
    _tds3.sum_[33] += v_string18_current;
    float v_fp = (float)(int16_t)buf[35] / 1000.0;
    float v_freq = (float)buf[36] / 10.0;
    float v_work_state = (float)buf[38];
    float v_bus_voltage = (float)buf[147] / 10.0;
    float v_daily_yield = (float)buf[3] / 10.0;
    float v_device_type = (float)buf[0];
    float v_output_type = (float)buf[2];
    float v_total_yield = (float)(((uint32_t)buf[4+1] << 16) | buf[4]);
    float v_temp_interna = (float)(int16_t)buf[8] / 10.0;
    float v_nominal_power = (float)buf[1] / 10.0;
    float v_apparent_total = (float)(((uint32_t)buf[9+1] << 16) | buf[9]);
    float v_pid_alarm_code = (float)buf[151];
    float v_pid_work_state = (float)buf[150];
    float v_potencia_ativa = (float)(((uint32_t)buf[31+1] << 16) | buf[31]);
    float v_potencia_reativa = (float)(int32_t)(((uint32_t)buf[33+1] << 16) | buf[33]);
    float v_potencia_aparente = (float)(((uint32_t)buf[9+1] << 16) | buf[9]);
    float v_daily_running_time = (float)buf[113];
    float v_potencia_aparente2 = (float)(((uint32_t)buf[10+1] << 16) | buf[10]);
    float v_total_running_time = (float)(((uint32_t)buf[6+1] << 16) | buf[6]);
    float v_insulation_resistance = (float)buf[71];
    float v_nominal_reactive_power = (float)buf[49] / 10.0;
    _tds3.last_[0] = v_ia;
    _tds3.last_[1] = v_ib;
    _tds3.last_[2] = v_ic;
    _tds3.last_[3] = v_vab;
    _tds3.last_[4] = v_vbc;
    _tds3.last_[5] = v_vca;
    _tds3.last_[6] = v_mppt1_voltage;
    _tds3.last_[7] = v_mppt2_voltage;
    _tds3.last_[8] = v_mppt3_voltage;
    _tds3.last_[9] = v_mppt4_voltage;
    _tds3.last_[10] = v_mppt5_voltage;
    _tds3.last_[11] = v_mppt6_voltage;
    _tds3.last_[12] = v_mppt7_voltage;
    _tds3.last_[13] = v_mppt8_voltage;
    _tds3.last_[14] = v_mppt9_voltage;
    _tds3.last_[15] = v_dc_total_power;
    _tds3.last_[16] = v_string1_current;
    _tds3.last_[17] = v_string2_current;
    _tds3.last_[18] = v_string3_current;
    _tds3.last_[19] = v_string4_current;
    _tds3.last_[20] = v_string5_current;
    _tds3.last_[21] = v_string6_current;
    _tds3.last_[22] = v_string7_current;
    _tds3.last_[23] = v_string8_current;
    _tds3.last_[24] = v_string9_current;
    _tds3.last_[25] = v_string10_current;
    _tds3.last_[26] = v_string11_current;
    _tds3.last_[27] = v_string12_current;
    _tds3.last_[28] = v_string13_current;
    _tds3.last_[29] = v_string14_current;
    _tds3.last_[30] = v_string15_current;
    _tds3.last_[31] = v_string16_current;
    _tds3.last_[32] = v_string17_current;
    _tds3.last_[33] = v_string18_current;
    _tds3.last_[34] = v_fp;
    _tds3.last_[35] = v_freq;
    _tds3.last_[36] = v_work_state;
    _tds3.last_[37] = v_bus_voltage;
    _tds3.last_[38] = v_daily_yield;
    _tds3.last_[39] = v_device_type;
    _tds3.last_[40] = v_output_type;
    _tds3.last_[41] = v_total_yield;
    _tds3.last_[42] = v_temp_interna;
    _tds3.last_[43] = v_nominal_power;
    _tds3.last_[44] = v_apparent_total;
    _tds3.last_[45] = v_pid_alarm_code;
    _tds3.last_[46] = v_pid_work_state;
    _tds3.last_[47] = v_potencia_ativa;
    _tds3.last_[48] = v_potencia_reativa;
    _tds3.last_[49] = v_potencia_aparente;
    _tds3.last_[50] = v_daily_running_time;
    _tds3.last_[51] = v_potencia_aparente2;
    _tds3.last_[52] = v_total_running_time;
    _tds3.last_[53] = v_insulation_resistance;
    _tds3.last_[54] = v_nominal_reactive_power;
    _tds3.samples++;
    _tds3.valid = true;
    Serial.printf("[TCP-INV] Inv 4(id4) #%d: ", _tds3.samples);
    Serial.printf("vab=%.2f ", v_vab);
    Serial.printf("vbc=%.2f ", v_vbc);
    Serial.printf("vca=%.2f ", v_vca);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f ", v_ic);
    Serial.printf("potencia_ativa=%.2f", v_potencia_ativa);
    Serial.println();
}

// Publica medias (avg) + last + delta. Zera acumuladores apos publish.
// Estrutura aninhada espelha _genDeviceReader (RS485): usa tipo.ai/bi do catalogo
// para resolver json paths, agrupar por top-level key, e respeitar tipo.group_order.
static void _publish_tcp_inv_3(tcp_publish_fn publish) {
    if (!_tds3.valid || _tds3.samples == 0) {
        // Enriquecido p/ diagnostico REMOTO: motivo da ultima falha + nº de reconexoes.
        char _nsbuf[112];
        snprintf(_nsbuf, sizeof(_nsbuf),
                 "{\"error\":\"no_samples\",\"last_fail\":\"%s\",\"reconnects\":%lu}",
                 _tcp_last_fail_reason, (unsigned long)_tds3.tcp_reconnects);
        publish("Inv 4_4/data", _nsbuf);
        return;
    }

    int n = _tds3.samples;
    // JSON e payload na HEAP (nao na stack). loopTask tem 8KB de stack;
    // alocar 3KB+3KB na stack aqui causava overflow + Panic em ~67s no projeto
    // Chimarrao com Power_Meter + 2 inversores. Heap fica em ~280KB livres,
    // sobra de sobra pra os 3KB do doc+payload.
    DynamicJsonDocument d(3072);
    d["timestamp"] = (long)time(nullptr);
    d["inverter_id"] = 4;
    d["samples"] = n;

    JsonObject g_info = d.createNestedObject("info");
    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(_tds3.last_[39])); g_info["device_type"] = String(_h); }
    g_info["output_type"] = _tds3.last_[40];
    g_info["nominal_power"] = _tds3.last_[43];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _tds3.last_[38];
    g_energy["total_yield"] = _tds3.last_[41];
    g_energy["Potencia Aparente1"] = _tds3.last_[49];
    g_energy["daily_running_time"] = _tds3.last_[50];
    g_energy["Potencia Aparente2"] = _tds3.last_[51];
    g_energy["total_running_time"] = _tds3.last_[52];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _tds3.last_[42];
    JsonObject g_dc = d.createNestedObject("dc");
    g_dc["mppt1_voltage"] = (float)(_tds3.sum_[6] / n);
    g_dc["mppt2_voltage"] = (float)(_tds3.sum_[7] / n);
    g_dc["mppt3_voltage"] = (float)(_tds3.sum_[8] / n);
    g_dc["mppt4_voltage"] = (float)(_tds3.sum_[9] / n);
    g_dc["mppt5_voltage"] = (float)(_tds3.sum_[10] / n);
    g_dc["mppt6_voltage"] = (float)(_tds3.sum_[11] / n);
    g_dc["mppt7_voltage"] = (float)(_tds3.sum_[12] / n);
    g_dc["mppt8_voltage"] = (float)(_tds3.sum_[13] / n);
    g_dc["mppt9_voltage"] = (float)(_tds3.sum_[14] / n);
    g_dc["total_power"] = (float)(_tds3.sum_[15] / n);
    g_dc["string1_current"] = (float)(_tds3.sum_[16] / n);
    g_dc["string2_current"] = (float)(_tds3.sum_[17] / n);
    g_dc["string3_current"] = (float)(_tds3.sum_[18] / n);
    g_dc["string4_current"] = (float)(_tds3.sum_[19] / n);
    g_dc["string5_current"] = (float)(_tds3.sum_[20] / n);
    g_dc["string6_current"] = (float)(_tds3.sum_[21] / n);
    g_dc["string7_current"] = (float)(_tds3.sum_[22] / n);
    g_dc["string8_current"] = (float)(_tds3.sum_[23] / n);
    g_dc["string9_current"] = (float)(_tds3.sum_[24] / n);
    g_dc["string10_current"] = (float)(_tds3.sum_[25] / n);
    g_dc["string11_current"] = (float)(_tds3.sum_[26] / n);
    g_dc["string12_current"] = (float)(_tds3.sum_[27] / n);
    g_dc["string13_current"] = (float)(_tds3.sum_[28] / n);
    g_dc["string14_current"] = (float)(_tds3.sum_[29] / n);
    g_dc["string15_current"] = (float)(_tds3.sum_[30] / n);
    g_dc["string16_current"] = (float)(_tds3.sum_[31] / n);
    g_dc["string17_current"] = (float)(_tds3.sum_[32] / n);
    g_dc["string18_current"] = (float)(_tds3.sum_[33] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_tds3.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_tds3.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_tds3.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_tds3.sum_[0] / n);
    g_current["phase_b"] = (float)(_tds3.sum_[1] / n);
    g_current["phase_c"] = (float)(_tds3.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _tds3.last_[34];
    g_power["frequency"] = _tds3.last_[35];
    g_power["apparent_total"] = _tds3.last_[44];
    g_power["active_total"] = _tds3.last_[47];
    g_power["reactive_total"] = _tds3.last_[48];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _tds3.last_[36];
    g_status["work_state_text"] = _work_state_text((uint16_t)_tds3.last_[36]);
    JsonObject g_protection = d.createNestedObject("protection");
    g_protection["bus_voltage"] = _tds3.last_[37];
    g_protection["insulation_resistance"] = _tds3.last_[53];
    JsonObject g_regulation = d.createNestedObject("regulation");
    g_regulation["nominal_reactive_power"] = _tds3.last_[54];
    JsonObject g_pid = d.createNestedObject("pid");
    g_pid["alarm_code"] = _tds3.last_[45];
    g_pid["work_state"] = _tds3.last_[46];

    // Payload na HEAP (evita estouro de stack). Liberado ao sair do escopo.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[TCP-INV] OOM ao alocar payload");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Inv 4_4/data", payload);
        Serial.printf("\n===== PUBLICADO: Inv 4 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 34; i++) _tds3.sum_[i] = 0;
    _tds3.samples = 0;
}


// =============================================================================
// Despacho publico: round-robin sample + broadcast publish
// =============================================================================
static int _rr_tcp_idx = 0;
static const int _tcp_inv_count = 4;

void inverter_tcp_sample_one() {
    switch (_rr_tcp_idx) {
        case 0: _sample_tcp_inv_0(); break;
        case 1: _sample_tcp_inv_1(); break;
        case 2: _sample_tcp_inv_2(); break;
        case 3: _sample_tcp_inv_3(); break;
    }
    _rr_tcp_idx = (_rr_tcp_idx + 1) % _tcp_inv_count;
}

void inverter_tcp_publish_all(tcp_publish_fn publish) {
    if (!publish) return;
    _publish_tcp_inv_0(publish);
    _publish_tcp_inv_1(publish);
    _publish_tcp_inv_2(publish);
    _publish_tcp_inv_3(publish);
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
