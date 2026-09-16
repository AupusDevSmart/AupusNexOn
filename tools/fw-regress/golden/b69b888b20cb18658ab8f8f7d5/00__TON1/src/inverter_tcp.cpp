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
#define GATEWAY_IP      "192.168.3.111"
#define GATEWAY_PORT    8899
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
        return false;
    }

    for (uint16_t i = 0; i < count; i++) {
        out[i] = (data[i*2] << 8) | data[i*2+1];
    }
    return true;
}


// =============================================================================
// Power_Meter — IMS M160 (slave 1)
// 1 blocos | 19 pontos AI (14 avg, 1 last, 4 delta)
// word_order: high_first
// =============================================================================
struct _TcpDs0State {
    double sum_[14];
    int samples;
    float last_[19];
    float first_delta_[4];
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
    // Bloco 0: regs 38-71, func 0x03 — V, I, P, Q, FP, S, Energia (37..70)
    {
        uint16_t tmp0[34];
        if (!_modbus_rtu_tcp_read("192.168.3.111", 8899, 2000, 1, 0x03, 37, 34, tmp0)) {
            Serial.printf("[TCP-INV] Power_Meter(id1) bloco 0 FAIL (reg=37 count=34)\n");
            return false;
        }
        for (uint16_t i = 0; i < 34; i++) buf[0 + i] = tmp0[i];
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

    uint16_t buf[34];
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
        Serial.printf("[TCP-INV] Power_Meter(id1): falha leitura (consecutivas: %d)\n", _tds0.fail_streak);
        if (_tds0.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _tds0.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_tds0.cooldown_until == 0) _tds0.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[TCP-INV] Power_Meter(id1): cooldown %lus (nao responde) — loop liberado p/ MQTT/cmd\n", (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    _tds0.cooldown_until = 0;
    if (_tds0.fail_streak > 0) {
        Serial.printf("[TCP-INV] Power_Meter(id1): OK (apos %d falhas)\n", _tds0.fail_streak);
        _tds0.fail_streak = 0;
    }

    // TP/TC para escalonamento (le reg 3 via gateway; override do diagrama prevalece)
    float _fTP = 1.0f, _fTC = 1.0f, _fatorEnergia = 1.0f;
    {
        uint16_t _tptc[2];
        if (_modbus_rtu_tcp_read("192.168.3.111", 8899, 2000, 1, 0x03, 3, 2, _tptc)) {
            _fTP = (float)_tptc[0] / 1.0f;
            _fTC = (float)_tptc[1] / 1.0f;
            Serial.printf("[M160] medidor reporta TP=%.0f TC=%.0f\n", _fTP, _fTC);
        } else {
            Serial.println("[M160] leitura TP/TC FALHOU (rc!=0)");
        }
        _fTC = 1.0f;  // override tc_ratio (diagrama) — deterministico
        _fatorEnergia = _fTP * _fTC;
        Serial.printf("[M160] usando TP=%.0f TC=%.0f -> fatorEnergia=%.0f\n", _fTP, _fTC, _fatorEnergia);
    }
    // Casas decimais (reg 35: DPT/DCT/DPQ). value = raw*10^(exp-baseline).
    // Cache do ultimo valor bom (init=baseline => fator 1.0): expoentes mudam raro, entao
    // se a leitura falhar usa o ultimo lido em vez de cair pra 1.0. Retry 3x (flush interno do _readFn).
    static uint8_t _lDPT = 3, _lDCT = 1, _lDPQ = 4;
    float _fDPT = 1.0f, _fDCT = 1.0f, _fDPQ = 1.0f;
    {
        uint16_t _dec[2];
        bool _okDec = false;
        for (int _t = 0; _t < 3 && !_okDec; _t++) _okDec = _modbus_rtu_tcp_read("192.168.3.111", 8899, 2000, 1, 0x03, 35, 2, _dec);
        if (_okDec) {
            _lDPT = (_dec[0] >> 8) & 0xFF;
            _lDCT = _dec[0] & 0xFF;
            _lDPQ = (_dec[1] >> 8) & 0xFF;
            uint8_t _sign = _dec[1] & 0xFF;
            Serial.printf("[M160] DPT=%u DCT=%u DPQ=%u SIGN=0x%02X (raw r35=0x%04X r36=0x%04X)\n", _lDPT, _lDCT, _lDPQ, _sign, _dec[0], _dec[1]);
        } else {
            Serial.printf("[M160] reg35 falhou — usando ultimo bom DPT=%u DCT=%u DPQ=%u\n", _lDPT, _lDCT, _lDPQ);
        }
        _fDPT = _pow10i((int)_lDPT - 3);
        _fDCT = _pow10i((int)_lDCT - 1);
        _fDPQ = _pow10i((int)_lDPQ - 4);
    }
    float v_ia = ((float)buf[6] / 1000.0) * _fDCT;
    _tds0.sum_[0] += v_ia;
    float v_ib = ((float)buf[7] / 1000.0) * _fDCT;
    _tds0.sum_[1] += v_ib;
    float v_ic = ((float)buf[8] / 1000.0) * _fDCT;
    _tds0.sum_[2] += v_ic;
    float v_pt = ((float)(int16_t)buf[12]) * _fDPQ;
    _tds0.sum_[3] += v_pt;
    float v_qt = ((float)(int16_t)buf[16]) * _fDPQ;
    _tds0.sum_[4] += v_qt;
    float v_st = ((float)buf[24]) * _fDPQ;
    _tds0.sum_[5] += v_st;
    float v_va = ((float)buf[0] / 10.0) * _fDPT;
    _tds0.sum_[6] += v_va;
    float v_vb = ((float)buf[1] / 10.0) * _fDPT;
    _tds0.sum_[7] += v_vb;
    float v_vc = ((float)buf[2] / 10.0) * _fDPT;
    _tds0.sum_[8] += v_vc;
    float v_fp_a = (float)(int16_t)buf[17] / 1000.0;
    _tds0.sum_[9] += v_fp_a;
    float v_fp_b = (float)(int16_t)buf[18] / 1000.0;
    _tds0.sum_[10] += v_fp_b;
    float v_fp_c = (float)(int16_t)buf[19] / 1000.0;
    _tds0.sum_[11] += v_fp_c;
    float v_fp_t = (float)(int16_t)buf[20] / 1000.0;
    _tds0.sum_[12] += v_fp_t;
    float v_freq = (float)buf[25] / 100.0;
    _tds0.sum_[13] += v_freq;
    float v_phf = (float)buf[27] / 1000.0;
    float v_consumo_phf = (float)buf[27] / 1000.0;
    if (!_tds0.has_first_delta) { _tds0.first_delta_[0] = v_consumo_phf; }
    float v_consumo_phr = (float)buf[29] / 1000.0;
    if (!_tds0.has_first_delta) { _tds0.first_delta_[1] = v_consumo_phr; }
    float v_consumo_qhf = (float)buf[31] / 1000.0;
    if (!_tds0.has_first_delta) { _tds0.first_delta_[2] = v_consumo_qhf; }
    float v_consumo_qhr = (float)buf[33] / 1000.0;
    if (!_tds0.has_first_delta) { _tds0.first_delta_[3] = v_consumo_qhr; }
    if (!_tds0.has_first_delta) _tds0.has_first_delta = true;
    _tds0.last_[0] = v_ia;
    _tds0.last_[1] = v_ib;
    _tds0.last_[2] = v_ic;
    _tds0.last_[3] = v_pt;
    _tds0.last_[4] = v_qt;
    _tds0.last_[5] = v_st;
    _tds0.last_[6] = v_va;
    _tds0.last_[7] = v_vb;
    _tds0.last_[8] = v_vc;
    _tds0.last_[9] = v_fp_a;
    _tds0.last_[10] = v_fp_b;
    _tds0.last_[11] = v_fp_c;
    _tds0.last_[12] = v_fp_t;
    _tds0.last_[13] = v_freq;
    _tds0.last_[14] = v_phf;
    _tds0.last_[15] = v_consumo_phf;
    _tds0.last_[16] = v_consumo_phr;
    _tds0.last_[17] = v_consumo_qhf;
    _tds0.last_[18] = v_consumo_qhr;
    _tds0.samples++;
    _tds0.valid = true;
    Serial.printf("[TCP-INV] Power_Meter(id1) #%d: ", _tds0.samples);
    Serial.printf("va=%.2f ", v_va);
    Serial.printf("vb=%.2f ", v_vb);
    Serial.printf("vc=%.2f ", v_vc);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f ", v_ic);
    Serial.printf("freq=%.2f", v_freq);
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
        publish("Power_Meter_1/data", _nsbuf);
        return;
    }

    int n = _tds0.samples;
    // JSON e payload na HEAP (nao na stack). loopTask tem 8KB de stack;
    // alocar 3KB+3KB na stack aqui causava overflow + Panic em ~67s no projeto
    // Chimarrao com Power_Meter + 2 inversores. Heap fica em ~280KB livres,
    // sobra de sobra pra os 3KB do doc+payload.
    DynamicJsonDocument d(3072);

    float dv_consumo_phf = _tds0.last_[15] - _tds0.first_delta_[0];
    float dv_consumo_phr = _tds0.last_[16] - _tds0.first_delta_[1];
    float dv_consumo_qhf = _tds0.last_[17] - _tds0.first_delta_[2];
    float dv_consumo_qhr = _tds0.last_[18] - _tds0.first_delta_[3];
    d["phf"] = _tds0.last_[14];
    d["consumo_phf"] = dv_consumo_phf;
    d["consumo_phr"] = dv_consumo_phr;
    d["consumo_qhf"] = dv_consumo_qhf;
    d["consumo_qhr"] = dv_consumo_qhr;
    d["Va"] = (float)(_tds0.sum_[6] / n);
    d["Vb"] = (float)(_tds0.sum_[7] / n);
    d["Vc"] = (float)(_tds0.sum_[8] / n);
    d["Ia"] = (float)(_tds0.sum_[0] / n);
    d["Ib"] = (float)(_tds0.sum_[1] / n);
    d["Ic"] = (float)(_tds0.sum_[2] / n);
    d["FPa"] = (float)(_tds0.sum_[9] / n);
    d["FPb"] = (float)(_tds0.sum_[10] / n);
    d["FPc"] = (float)(_tds0.sum_[11] / n);
    d["Pt"] = (float)(_tds0.sum_[3] / n);
    d["Qt"] = (float)(_tds0.sum_[4] / n);
    d["St"] = (float)(_tds0.sum_[5] / n);
    d["Freq"] = (float)(_tds0.sum_[13] / n);
    d["FPt"] = (float)(_tds0.sum_[12] / n);
    d["timestamp"] = (long)time(nullptr);

    // Payload na HEAP (evita estouro de stack). Liberado ao sair do escopo.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[TCP-INV] OOM ao alocar payload");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Power_Meter_1/data", payload);
        Serial.printf("\n===== PUBLICADO: Power_Meter (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    _tds0.first_delta_[0] = _tds0.last_[15];
    _tds0.first_delta_[1] = _tds0.last_[16];
    _tds0.first_delta_[2] = _tds0.last_[17];
    _tds0.first_delta_[3] = _tds0.last_[18];
    for (int i = 0; i < 14; i++) _tds0.sum_[i] = 0;
    _tds0.samples = 0;
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
