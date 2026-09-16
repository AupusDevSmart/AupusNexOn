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
// Rele (Pextron URP6000)
// Endereco Modbus: 1
// Modos: 13 avg, 0 last, 0 delta
// =========================================================================

struct _Dev0State {
    // Acumuladores (somas para media)
    double sum_[13];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[13];
    // Primeira amostra de delta (snapshot no inicio do ciclo)
    float first_delta_[1];
    bool has_first_delta;
    // Estados BI da ultima leitura
    uint8_t bi_[29];
    bool valid;
    int fail_streak;            // leituras consecutivas falhas
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
};
static _Dev0State _ds0 = {};

static bool _read_dev_0_raw(uint16_t *buf) {
    _select(1);
    // Handshake
    _mb.readHoldingRegisters(136, 2);
    delay(30);
    // Bloco 0: reg 700, count 23, func 0x03 - Analógicos principais
    {
        uint8_t rc = _mb.readHoldingRegisters(700, 23);
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
                rc = _mb.readHoldingRegisters(700, 23);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 23; i++) buf[0 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele_1 bloco 0 FAIL (reg=700 count=23 rc=0x%02X)\n", rc);
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
    // Bloco 1: reg 812, count 10, func 0x03 - DNP simplificado + energia
    {
        uint8_t rc = _mb.readHoldingRegisters(812, 10);
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
                rc = _mb.readHoldingRegisters(812, 10);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 10; i++) buf[23 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele_1 bloco 1 FAIL (reg=812 count=10 rc=0x%02X)\n", rc);
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
    // Bloco 2: reg 673, count 1, func 0x03 - Local/Remoto
    {
        uint8_t rc = _mb.readHoldingRegisters(673, 1);
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
                rc = _mb.readHoldingRegisters(673, 1);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 1; i++) buf[33 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele_1 bloco 2 FAIL (reg=673 count=1 rc=0x%02X)\n", rc);
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
        Serial.printf("[MB] Rele_1: falha leitura (consecutivas: %d)\n", _ds0.fail_streak);
        if (_ds0.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _ds0.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_ds0.cooldown_until == 0) _ds0.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[MB] Rele_1: cooldown %lus (nao responde) — loop liberado p/ LoRa/cmd\n",
                          (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    diag_last_successful_read_ms = millis();
    _ds0.cooldown_until = 0;
    if (_ds0.fail_streak > 0) {
        Serial.printf("[MB] Rele_1: OK (apos %d falhas consecutivas)\n", _ds0.fail_streak);
        _ds0.fail_streak = 0;
    }

    float v_ia = (float)buf[0] / 256.0;
    _ds0.sum_[0] += v_ia;
    float v_ib = (float)buf[1] / 256.0;
    _ds0.sum_[1] += v_ib;
    float v_ic = (float)buf[2] / 256.0;
    _ds0.sum_[2] += v_ic;
    float v_in = (float)buf[4] / 256.0;
    _ds0.sum_[3] += v_in;
    float v_va = (float)buf[5] / 128.0;
    _ds0.sum_[4] += v_va;
    float v_vb = (float)buf[6] / 128.0;
    _ds0.sum_[5] += v_vb;
    float v_vc = (float)buf[7] / 128.0;
    _ds0.sum_[6] += v_vc;
    float v_freq = (float)buf[11] / 256.0;
    _ds0.sum_[7] += v_freq;
    float v_cosfi_a = (float)((buf[13] & 0x8000) ? -1 : 1) * (float)(buf[13] & 0x7FFF) / 256.0;
    _ds0.sum_[8] += v_cosfi_a;
    float v_cosfi_b = (float)((buf[14] & 0x8000) ? -1 : 1) * (float)(buf[14] & 0x7FFF) / 256.0;
    _ds0.sum_[9] += v_cosfi_b;
    float v_cosfi_c = (float)((buf[15] & 0x8000) ? -1 : 1) * (float)(buf[15] & 0x7FFF) / 256.0;
    _ds0.sum_[10] += v_cosfi_c;
    float v_pa_total = (float)((int32_t)(((uint32_t)buf[17+0] << 16) | buf[17+1]) + (int32_t)(((uint32_t)buf[17+2] << 16) | buf[17+3]) + (int32_t)(((uint32_t)buf[17+4] << 16) | buf[17+5])) / 1280.0;
    _ds0.sum_[11] += v_pa_total;
    float v_pr_total = (float)buf[27] / 4.0;
    _ds0.sum_[12] += v_pr_total;
    _ds0.last_[0] = v_ia;
    _ds0.last_[1] = v_ib;
    _ds0.last_[2] = v_ic;
    _ds0.last_[3] = v_in;
    _ds0.last_[4] = v_va;
    _ds0.last_[5] = v_vb;
    _ds0.last_[6] = v_vc;
    _ds0.last_[7] = v_freq;
    _ds0.last_[8] = v_cosfi_a;
    _ds0.last_[9] = v_cosfi_b;
    _ds0.last_[10] = v_cosfi_c;
    _ds0.last_[11] = v_pa_total;
    _ds0.last_[12] = v_pr_total;
    _ds0.samples++;
    // Log de debug — mostra principais valores lidos
    Serial.printf("[MB] Rele_1 #%d: ", _ds0.samples);
    Serial.printf("va=%.2f ", v_va);
    Serial.printf("vb=%.2f ", v_vb);
    Serial.printf("vc=%.2f ", v_vc);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f", v_ic);
    Serial.println();

    // BI coils (0x01)
    if (_mb.readCoils(0, 53) == _mb.ku8MBSuccess) {
        _ds0.bi_[0] = (_mb.getResponseBuffer(1) >> 7) & 1;
        _ds0.bi_[1] = (_mb.getResponseBuffer(2) >> 2) & 1;
        _ds0.bi_[2] = (_mb.getResponseBuffer(2) >> 0) & 1;
        _ds0.bi_[3] = (_mb.getResponseBuffer(1) >> 10) & 1;
        _ds0.bi_[4] = (_mb.getResponseBuffer(2) >> 1) & 1;
        _ds0.bi_[5] = (_mb.getResponseBuffer(0) >> 7) & 1;
        _ds0.bi_[6] = (_mb.getResponseBuffer(0) >> 2) & 1;
        _ds0.bi_[7] = (_mb.getResponseBuffer(0) >> 1) & 1;
        _ds0.bi_[8] = (_mb.getResponseBuffer(0) >> 0) & 1;
        _ds0.bi_[9] = (_mb.getResponseBuffer(0) >> 10) & 1;
        _ds0.bi_[10] = (_mb.getResponseBuffer(0) >> 9) & 1;
        _ds0.bi_[11] = (_mb.getResponseBuffer(0) >> 8) & 1;
        _ds0.bi_[12] = (_mb.getResponseBuffer(0) >> 14) & 1;
        _ds0.bi_[13] = (_mb.getResponseBuffer(0) >> 13) & 1;
        _ds0.bi_[14] = (_mb.getResponseBuffer(0) >> 12) & 1;
        _ds0.bi_[15] = (_mb.getResponseBuffer(0) >> 11) & 1;
        _ds0.bi_[16] = (_mb.getResponseBuffer(0) >> 6) & 1;
        _ds0.bi_[17] = (_mb.getResponseBuffer(0) >> 5) & 1;
        _ds0.bi_[18] = (_mb.getResponseBuffer(0) >> 4) & 1;
        _ds0.bi_[19] = (_mb.getResponseBuffer(0) >> 3) & 1;
        _ds0.bi_[20] = (_mb.getResponseBuffer(1) >> 14) & 1;
        _ds0.bi_[21] = (_mb.getResponseBuffer(1) >> 13) & 1;
        _ds0.bi_[22] = (_mb.getResponseBuffer(1) >> 12) & 1;
        _ds0.bi_[23] = (_mb.getResponseBuffer(1) >> 11) & 1;
        _ds0.bi_[24] = (_mb.getResponseBuffer(1) >> 6) & 1;
        _ds0.bi_[25] = (_mb.getResponseBuffer(1) >> 5) & 1;
        _ds0.bi_[26] = (_mb.getResponseBuffer(1) >> 4) & 1;
        _ds0.bi_[27] = (_mb.getResponseBuffer(1) >> 3) & 1;
    }
    _ds0.valid = true;
}

// Publica JSON (medias + last + delta) e reseta acumuladores. Chamar a cada PUBLISH_INTERVAL_MS.
static void _publish_dev_0(modbus_publish_fn publish) {
    if (!_ds0.valid || _ds0.samples == 0) {
        publish("Rele_1/status", "{\"error\":\"no_samples\"}");
        return;
    }

    int n = _ds0.samples;
    // JSON na heap (nao na stack). loopTask tem 8KB de stack; alocar 3KB+3KB
    // aqui (doc + payload) causava Panic em ~200s no projeto Chimarrao com
    // Power_Meter + 2 inversores. Heap fica em ~280KB livres.
    DynamicJsonDocument d(3072);
    d["timestamp"] = (long)time(nullptr);
    d["inverter_id"] = 1;
    d["samples"] = n;

    d["va"] = (float)(_ds0.sum_[4] / n);
    d["vb"] = (float)(_ds0.sum_[5] / n);
    d["vc"] = (float)(_ds0.sum_[6] / n);
    d["ia"] = (float)(_ds0.sum_[0] / n);
    d["ib"] = (float)(_ds0.sum_[1] / n);
    d["ic"] = (float)(_ds0.sum_[2] / n);
    d["in"] = (float)(_ds0.sum_[3] / n);
    d["cosfi_a"] = (float)(_ds0.sum_[8] / n);
    d["cosfi_b"] = (float)(_ds0.sum_[9] / n);
    d["cosfi_c"] = (float)(_ds0.sum_[10] / n);
    d["pa_total"] = (float)(_ds0.sum_[11] / n);
    d["pr_total"] = (float)(_ds0.sum_[12] / n);
    d["freq"] = (float)(_ds0.sum_[7] / n);
    d["f27a"] = _ds0.bi_[6];
    d["f27b"] = _ds0.bi_[7];
    d["f27c"] = _ds0.bi_[8];
    d["f51a"] = _ds0.bi_[16];
    d["f51b"] = _ds0.bi_[17];
    d["f51c"] = _ds0.bi_[18];
    d["f50a"] = _ds0.bi_[12];
    d["f50b"] = _ds0.bi_[13];
    d["f50c"] = _ds0.bi_[14];
    d["f50n"] = _ds0.bi_[15];
    d["f51n"] = _ds0.bi_[19];
    d["f59a"] = _ds0.bi_[20];
    d["f59b"] = _ds0.bi_[21];
    d["f59c"] = _ds0.bi_[22];
    d["f59n"] = _ds0.bi_[23];
    d["f81"] = _ds0.bi_[3];
    d["f46"] = _ds0.bi_[0];
    d["f47"] = _ds0.bi_[1];
    d["f67a"] = _ds0.bi_[24];
    d["f67b"] = _ds0.bi_[25];
    d["f67c"] = _ds0.bi_[26];
    d["f67n"] = _ds0.bi_[27];
    d["f32a"] = _ds0.bi_[9];
    d["f32b"] = _ds0.bi_[10];
    d["f32c"] = _ds0.bi_[11];
    d["fba"] = _ds0.bi_[5];
    d["f86"] = _ds0.bi_[4];
    d["f78"] = _ds0.bi_[2];

    // Payload na heap — mesma razao do JSON doc acima.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[RS485] malloc payload falhou — pulando publish");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Rele_1/data", payload);
        Serial.printf("\n===== PUBLICADO: Rele_1 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 13; i++) _ds0.sum_[i] = 0;
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
    if (strcmp(device_name, "Rele") == 0) {
        _select(1);
        _mb.readHoldingRegisters(136, 2); delay(30);  // handshake auto-Modbus
        while (_rs485.available()) _rs485.read();  // drena eco do handshake
        if (strcmp(cmd_id, "cmd_abrir") == 0) {
            uint8_t rc = _mb.writeSingleCoil(52, true);
            if (rc != _mb.ku8MBSuccess) { delay(40); while (_rs485.available()) _rs485.read(); rc = _mb.writeSingleCoil(52, true); }
            delay(3000);
            _mb.readHoldingRegisters(136, 2); delay(30);
            while (_rs485.available()) _rs485.read();
            if (_mb.writeSingleCoil(52, false) != _mb.ku8MBSuccess) {  // rearma coil de pulso
                delay(40); while (_rs485.available()) _rs485.read();
                _mb.writeSingleCoil(52, false);
            }
            return rc == _mb.ku8MBSuccess;
        }
        if (strcmp(cmd_id, "cmd_reset") == 0) {
            uint8_t rc = _mb.writeSingleCoil(48, true);
            if (rc != _mb.ku8MBSuccess) { delay(40); while (_rs485.available()) _rs485.read(); rc = _mb.writeSingleCoil(48, true); }
            delay(3000);
            _mb.readHoldingRegisters(136, 2); delay(30);
            while (_rs485.available()) _rs485.read();
            if (_mb.writeSingleCoil(48, false) != _mb.ku8MBSuccess) {  // rearma coil de pulso
                delay(40); while (_rs485.available()) _rs485.read();
                _mb.writeSingleCoil(48, false);
            }
            return rc == _mb.ku8MBSuccess;
        }
        if (strcmp(cmd_id, "cmd_fechar") == 0) {
            uint8_t rc = _mb.writeSingleCoil(51, true);
            if (rc != _mb.ku8MBSuccess) { delay(40); while (_rs485.available()) _rs485.read(); rc = _mb.writeSingleCoil(51, true); }
            delay(3000);
            _mb.readHoldingRegisters(136, 2); delay(30);
            while (_rs485.available()) _rs485.read();
            if (_mb.writeSingleCoil(51, false) != _mb.ku8MBSuccess) {  // rearma coil de pulso
                delay(40); while (_rs485.available()) _rs485.read();
                _mb.writeSingleCoil(51, false);
            }
            return rc == _mb.ku8MBSuccess;
        }
        if (strcmp(cmd_id, "cmrccj0ci06ofjqrcqapsitqx") == 0) {
            uint8_t rc = _mb.writeSingleCoil(52, true);
            if (rc != _mb.ku8MBSuccess) { delay(40); while (_rs485.available()) _rs485.read(); rc = _mb.writeSingleCoil(52, true); }
            delay(3000);
            _mb.readHoldingRegisters(136, 2); delay(30);
            while (_rs485.available()) _rs485.read();
            if (_mb.writeSingleCoil(52, false) != _mb.ku8MBSuccess) {  // rearma coil de pulso
                delay(40); while (_rs485.available()) _rs485.read();
                _mb.writeSingleCoil(52, false);
            }
            return rc == _mb.ku8MBSuccess;
        }
        if (strcmp(cmd_id, "cmrccj0cs06ohjqrc8udt9b3l") == 0) {
            uint8_t rc = _mb.writeSingleCoil(51, true);
            if (rc != _mb.ku8MBSuccess) { delay(40); while (_rs485.available()) _rs485.read(); rc = _mb.writeSingleCoil(51, true); }
            delay(3000);
            _mb.readHoldingRegisters(136, 2); delay(30);
            while (_rs485.available()) _rs485.read();
            if (_mb.writeSingleCoil(51, false) != _mb.ku8MBSuccess) {  // rearma coil de pulso
                delay(40); while (_rs485.available()) _rs485.read();
                _mb.writeSingleCoil(51, false);
            }
            return rc == _mb.ku8MBSuccess;
        }
        return false;
    }
    return false;
}
