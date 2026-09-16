#include "modbus_meter.h"
#include "hal.h"
#include "config.h"
#include "diag.h"
#include "mqtt.h"   // mqtt_loop() chamado entre blocos pra nao bloquear keepalive
#include <ModbusMaster.h>
#include <ArduinoJson.h>
#include <string.h>
#include <math.h>
#include <time.h>

static ModbusMaster _mb;
static HardwareSerial _rs485(RS485_UART_NUM);

// NOTA: ModbusMaster usa ku16MBResponseTimeout = 2000ms como static const compilada
// na lib — nao expoe setter runtime. Timeout fica em 2s (folgado pra Sungrow).
// Refator pra ajustar exige trocar a lib (ex: eModbus) — fora deste escopo.

// preTx: garante TX anterior 100% drenado (flush) antes de comutar DE/RE pra TX.
// Sem o flush, bytes do envio anterior ainda no shift register UART podem ecoar
// pelo RX e o ModbusMaster os interpreta como inicio de resposta -> rc=0xE0
// (ku8MBInvalidSlaveID). Delay de 1ms (vs 500us anterior) e' folga pro driver
// MAX485 — necessario em variantes com optoacoplador/isolacao.
static void _preTx()  {
    _rs485.flush();
    digitalWrite(RS485_DIR, HIGH);
    delayMicroseconds(1000);
}
// postTx: mantem TX habilitado por 1ms apos enviar pra ultimo bit nao ser truncado,
// depois libera linha pro slave responder.
static void _postTx() {
    delayMicroseconds(1000);
    digitalWrite(RS485_DIR, LOW);
}

// _select: prepara a proxima transacao Modbus.
// CRITICO: drena buffer RX antes de cada nova requisicao. Bytes residuais (eco
// de transacao anterior OU resposta atrasada de outro slave no barramento)
// contaminam o frame proximo. Sem drain, ModbusMaster ve o byte residual como
// slave ID da resposta e retorna 0xE0 mesmo com o frame real chegando depois.
static inline void _select(uint8_t addr) {
    while (_rs485.available()) _rs485.read();
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

// 10^e por inteiro (e pode ser negativo). Evita pull de powf; deterministico em FPU/no-FPU.
static inline float _pow10i(int e){ float r=1.0f; if(e>=0){ for(int i=0;i<e;i++) r*=10.0f; } else { for(int i=0;i<-e;i++) r/=10.0f; } return r; }

// Timestamp formatado "DD/MM/YYYY HH:MM:SS" no timezone local (configurado via configTime).
// Fallback "0" (epoch zero) se o relogio nao estiver sincronizado.
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
    Serial.printf("[RS485] TX=%d RX=%d DIR=%d %d baud\n",
                  UART1_TX, UART1_RX, RS485_DIR, RS485_BAUD);
}


// =========================================================================
// Power Meter (IMS M160)
// Endereco Modbus: 1
// Modos: 14 avg, 1 last, 4 delta
// =========================================================================

struct _Dev0State {
    // Acumuladores (somas para media)
    double sum_[14];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[19];
    // Primeira amostra de delta (snapshot no inicio do ciclo)
    float first_delta_[4];
    bool has_first_delta;
    // Estados BI da ultima leitura
    uint8_t bi_[1];
    bool valid;
    int fail_streak;            // leituras consecutivas falhas
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
};
static _Dev0State _ds0 = {};

static bool _read_dev_0_raw(uint16_t *buf) {
    _select(1);
    // Bloco 0: reg 37, count 34, func 0x03 - V, I, P, Q, FP, S, Energia (37..70)
    {
        uint8_t rc = _mb.readHoldingRegisters(37, 34);
        if (rc != _mb.ku8MBSuccess) {
            // Codigos: 0xE0 InvalidSlaveID (cross-talk/eco) | 0xE2 timeout
            //          0xE3 CRC | 0x02 IllegalAddr | 0x01 IllegalFn | 0x04 SlaveFail
            // 0xE0 indica que recebemos bytes errados (residuo no RX). Drenar
            // agressivamente antes do retry pra nao herdar a contaminacao.
            if (rc == 0xE0) {
                delay(20);
                while (_rs485.available()) _rs485.read();
                delay(20);
            } else {
                delay(50);
            }
            // Retry so' na 1a falha (transiente). Device cronicamente morto nao
            // paga 2x o timeout — reduz o bloqueio do loop ate o cooldown armar.
            if (_ds0.fail_streak == 0) {
                rc = _mb.readHoldingRegisters(37, 34);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 34; i++) buf[0 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Power Meter_1 bloco 0 FAIL (reg=37 count=34 rc=0x%02X)\n", rc);
            return false;
        }
    }
    // Espacamento entre blocos. 80ms cobre datalogger interno do Sungrow CX
    // (mais lento do parque). Outros devices pagam 40ms extra por bloco — desprezivel
    // dado round-robin de 2s/device * N devices.
    delay(80);
    // CRITICO: chamar mqtt_loop() entre blocos para nao bloquear PubSubClient.
    // Se um sample Modbus passa de 15s (default keepalive antigo) sem loop(),
    // broker desconecta. Mantem mensagens MQTT processadas durante ciclos longos.
    mqtt_loop();
    return true;
}

// Le + acumula. Chamar a cada READ_INTERVAL_MS.
static void _sample_dev_0() {
    // Back-off: device que falhou MODBUS_FAIL_COOLDOWN_N vezes fica em cooldown.
    // Pula a leitura (que bloquearia o loop no timeout) ate o cooldown expirar.
    if (_ds0.cooldown_until && (long)(millis() - _ds0.cooldown_until) < 0) return;

    uint16_t buf[34];
    if (!_read_dev_0_raw(buf)) {
        _ds0.fail_streak++;
        Serial.printf("[MB] Power Meter_1: falha leitura (consecutivas: %d)\n", _ds0.fail_streak);
        if (_ds0.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _ds0.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_ds0.cooldown_until == 0) _ds0.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[MB] Power Meter_1: cooldown %lus (nao responde) — loop liberado p/ LoRa/cmd\n",
                          (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    diag_last_successful_read_ms = millis();
    _ds0.cooldown_until = 0;
    if (_ds0.fail_streak > 0) {
        Serial.printf("[MB] Power Meter_1: OK (apos %d falhas consecutivas)\n", _ds0.fail_streak);
        _ds0.fail_streak = 0;
    }

    // TP/TC para escalonamento. Le do medidor (reg 3) pra log; se houver
    // override no diagrama (tc_ratio/tp_ratio), usa o valor FIXO (deterministico).
    float _fTP = 1.0f, _fTC = 1.0f, _fatorEnergia = 1.0f;
    {
        delay(40);
        uint8_t rc_tptc = _mb.readHoldingRegisters(3, 2);
        if (rc_tptc == _mb.ku8MBSuccess) {
            uint16_t _tp_raw = _mb.getResponseBuffer(0);
            uint16_t _tc_raw = _mb.getResponseBuffer(1);
            _fTP = (float)_tp_raw / 1.0f;
            _fTC = (float)_tc_raw / 1.0f;
            Serial.printf("[M160] medidor reporta TP=%.0f TC=%.0f (raw tp=%u tc=%u)\n", _fTP, _fTC, _tp_raw, _tc_raw);
        } else {
            Serial.println("[M160] leitura TP/TC FALHOU (rc!=0)");
        }
        _fatorEnergia = _fTP * _fTC;
        Serial.printf("[M160] usando TP=%.0f TC=%.0f -> fatorEnergia=%.0f\n", _fTP, _fTC, _fatorEnergia);
    }

    // Casas decimais (reg 35: DPT/DCT/DPQ). value = raw*10^(exp-baseline).
    // Cache do ultimo valor bom (init=baseline => fator 1.0): expoentes mudam raro, entao se a
    // leitura falhar usa o ultimo lido em vez de cair pra 1.0. Flush+retry (mesmo do bloco principal).
    static uint8_t _lDPT = 3, _lDCT = 1, _lDPQ = 4;
    float _fDPT = 1.0f, _fDCT = 1.0f, _fDPQ = 1.0f;
    {
        uint8_t rc_dec = 0xFF;
        for (int _t = 0; _t < 3 && rc_dec != _mb.ku8MBSuccess; _t++) {
            while (_rs485.available()) _rs485.read();   // drena residual — corrige 0xE0 (dessincronia)
            delay(20);
            rc_dec = _mb.readHoldingRegisters(35, 2);
        }
        if (rc_dec == _mb.ku8MBSuccess) {
            uint16_t _dec0 = _mb.getResponseBuffer(0);
            uint16_t _dec1 = _mb.getResponseBuffer(1);
            _lDPT = (_dec0 >> 8) & 0xFF;
            _lDCT = _dec0 & 0xFF;
            _lDPQ = (_dec1 >> 8) & 0xFF;
            uint8_t _sign = _dec1 & 0xFF;
            Serial.printf("[M160] DPT=%u DCT=%u DPQ=%u SIGN=0x%02X (raw r35=0x%04X r36=0x%04X)\n", _lDPT, _lDCT, _lDPQ, _sign, _dec0, _dec1);
        } else {
            Serial.printf("[M160] reg35 falhou (rc=0x%02X) — usando ultimo bom DPT=%u DCT=%u DPQ=%u\n", rc_dec, _lDPT, _lDCT, _lDPQ);
        }
        _fDPT = _pow10i((int)_lDPT - 3);
        _fDCT = _pow10i((int)_lDCT - 1);
        _fDPQ = _pow10i((int)_lDPQ - 4);
    }

    float v_ia = ((float)buf[6] / 1000.0) * _fDCT;
    _ds0.sum_[0] += v_ia;
    float v_ib = ((float)buf[7] / 1000.0) * _fDCT;
    _ds0.sum_[1] += v_ib;
    float v_ic = ((float)buf[8] / 1000.0) * _fDCT;
    _ds0.sum_[2] += v_ic;
    float v_pt = ((float)(int16_t)buf[12]) * _fDPQ;
    _ds0.sum_[3] += v_pt;
    float v_qt = ((float)(int16_t)buf[16]) * _fDPQ;
    _ds0.sum_[4] += v_qt;
    float v_st = ((float)buf[24]) * _fDPQ;
    _ds0.sum_[5] += v_st;
    float v_va = ((float)buf[0] / 10.0) * _fDPT;
    _ds0.sum_[6] += v_va;
    float v_vb = ((float)buf[1] / 10.0) * _fDPT;
    _ds0.sum_[7] += v_vb;
    float v_vc = ((float)buf[2] / 10.0) * _fDPT;
    _ds0.sum_[8] += v_vc;
    float v_fp_a = (float)(int16_t)buf[17] / 1000.0;
    _ds0.sum_[9] += v_fp_a;
    float v_fp_b = (float)(int16_t)buf[18] / 1000.0;
    _ds0.sum_[10] += v_fp_b;
    float v_fp_c = (float)(int16_t)buf[19] / 1000.0;
    _ds0.sum_[11] += v_fp_c;
    float v_fp_t = (float)(int16_t)buf[20] / 1000.0;
    _ds0.sum_[12] += v_fp_t;
    float v_freq = (float)buf[25] / 100.0;
    _ds0.sum_[13] += v_freq;
    float v_phf = (float)buf[27] / 1000.0;
    float v_consumo_phf = (float)buf[27] / 1000.0;
    if (!_ds0.has_first_delta) { _ds0.first_delta_[0] = v_consumo_phf; }
    float v_consumo_phr = (float)buf[29] / 1000.0;
    if (!_ds0.has_first_delta) { _ds0.first_delta_[1] = v_consumo_phr; }
    float v_consumo_qhf = (float)buf[31] / 1000.0;
    if (!_ds0.has_first_delta) { _ds0.first_delta_[2] = v_consumo_qhf; }
    float v_consumo_qhr = (float)buf[33] / 1000.0;
    if (!_ds0.has_first_delta) { _ds0.first_delta_[3] = v_consumo_qhr; }
    if (!_ds0.has_first_delta) _ds0.has_first_delta = true;
    _ds0.last_[0] = v_ia;
    _ds0.last_[1] = v_ib;
    _ds0.last_[2] = v_ic;
    _ds0.last_[3] = v_pt;
    _ds0.last_[4] = v_qt;
    _ds0.last_[5] = v_st;
    _ds0.last_[6] = v_va;
    _ds0.last_[7] = v_vb;
    _ds0.last_[8] = v_vc;
    _ds0.last_[9] = v_fp_a;
    _ds0.last_[10] = v_fp_b;
    _ds0.last_[11] = v_fp_c;
    _ds0.last_[12] = v_fp_t;
    _ds0.last_[13] = v_freq;
    _ds0.last_[14] = v_phf;
    _ds0.last_[15] = v_consumo_phf;
    _ds0.last_[16] = v_consumo_phr;
    _ds0.last_[17] = v_consumo_qhf;
    _ds0.last_[18] = v_consumo_qhr;
    _ds0.samples++;
    // Log de debug — mostra principais valores lidos
    Serial.printf("[MB] Power Meter_1 #%d: ", _ds0.samples);
    Serial.printf("va=%.2f ", v_va);
    Serial.printf("vb=%.2f ", v_vb);
    Serial.printf("vc=%.2f ", v_vc);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f", v_ic);
    Serial.println();
    _ds0.valid = true;
}

// Publica JSON (medias + last + delta) e reseta acumuladores. Chamar a cada PUBLISH_INTERVAL_MS.
static void _publish_dev_0(modbus_publish_fn publish) {
    if (!_ds0.valid || _ds0.samples == 0) {
        publish("Power Meter_1/status", "{\"error\":\"no_samples\"}");
        return;
    }

    int n = _ds0.samples;
    // JSON na heap (nao na stack). loopTask tem 8KB de stack; alocar 3KB+3KB
    // aqui (doc + payload) causava Panic em ~200s no projeto Chimarrao com
    // Power_Meter + 2 inversores. Heap fica em ~280KB livres.
    DynamicJsonDocument d(3072);

    float dv_consumo_phf = _ds0.last_[15] - _ds0.first_delta_[0];
    if (dv_consumo_phf < 0 || fabsf(dv_consumo_phf) < 1e-6f) dv_consumo_phf = 0;
    float dv_consumo_phr = _ds0.last_[16] - _ds0.first_delta_[1];
    if (dv_consumo_phr < 0 || fabsf(dv_consumo_phr) < 1e-6f) dv_consumo_phr = 0;
    float dv_consumo_qhf = _ds0.last_[17] - _ds0.first_delta_[2];
    if (dv_consumo_qhf < 0 || fabsf(dv_consumo_qhf) < 1e-6f) dv_consumo_qhf = 0;
    float dv_consumo_qhr = _ds0.last_[18] - _ds0.first_delta_[3];
    if (dv_consumo_qhr < 0 || fabsf(dv_consumo_qhr) < 1e-6f) dv_consumo_qhr = 0;
    d["phf"] = _ds0.last_[14];
    d["consumo_phf"] = dv_consumo_phf;
    d["consumo_phr"] = dv_consumo_phr;
    d["consumo_qhf"] = dv_consumo_qhf;
    d["consumo_qhr"] = dv_consumo_qhr;
    d["Va"] = (float)(_ds0.sum_[6] / n);
    d["Vb"] = (float)(_ds0.sum_[7] / n);
    d["Vc"] = (float)(_ds0.sum_[8] / n);
    d["Ia"] = (float)(_ds0.sum_[0] / n);
    d["Ib"] = (float)(_ds0.sum_[1] / n);
    d["Ic"] = (float)(_ds0.sum_[2] / n);
    d["FPa"] = (float)(_ds0.sum_[9] / n);
    d["FPb"] = (float)(_ds0.sum_[10] / n);
    d["FPc"] = (float)(_ds0.sum_[11] / n);
    d["Pt"] = (float)(_ds0.sum_[3] / n);
    d["Qt"] = (float)(_ds0.sum_[4] / n);
    d["St"] = (float)(_ds0.sum_[5] / n);
    d["Freq"] = (float)(_ds0.sum_[13] / n);
    d["FPt"] = (float)(_ds0.sum_[12] / n);
    d["timestamp"] = (long)time(nullptr);

    // Payload na heap — mesma razao do JSON doc acima.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[RS485] malloc payload falhou — pulando publish");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Power Meter_1/data", payload);
        Serial.printf("\n===== PUBLICADO: Power Meter_1 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    _ds0.first_delta_[0] = _ds0.last_[15];
    _ds0.first_delta_[1] = _ds0.last_[16];
    _ds0.first_delta_[2] = _ds0.last_[17];
    _ds0.first_delta_[3] = _ds0.last_[18];
    for (int i = 0; i < 14; i++) _ds0.sum_[i] = 0;
    _ds0.samples = 0;
}

static int _rr_idx = 0;
static const int _dev_count = 1;

void modbus_sample_one() {
    switch (_rr_idx) {
        case 0: _sample_dev_0(); break;
    }
    _rr_idx = (_rr_idx + 1) % _dev_count;
}

void modbus_publish_all(modbus_publish_fn publish) {
    if (!publish) return;
    _publish_dev_0(publish);
}

// Legado: sample todos + publica (sem media)
void modbus_read_all(modbus_publish_fn publish) {
    if (!publish) return;
    _sample_dev_0();
    _publish_dev_0(publish);
}

// SOE: drena a fila de eventos de cada device que tem buffer no catalogo.
void modbus_events_poll(modbus_publish_fn publish) {
    if (!publish) return;
}

bool modbus_exec_command(const char* device_name, const char* cmd_id) {
    if (!device_name || !cmd_id) return false;
    return false;
}
