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
// Rele DJ-2.1 (Siemens 7SR5)
// Endereco Modbus: 1
// Modos: 13 avg, 0 last, 0 delta | BI: 9 pontos em 4 blocos
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
    uint8_t bi_[9];
    bool bi_valid;              // >=1 ciclo com TODOS os blocos BI lidos OK
    bool valid;
    int fail_streak;            // leituras consecutivas falhas
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
};
static _Dev0State _ds0 = {};

static bool _read_dev_0_raw(uint16_t *buf) {
    _select(1);
    // Bloco 0: reg 15, count 6, func 0x04 - RTU 30016-30021: Va/Vb/Vc Primary
    {
        uint8_t rc = _mb.readInputRegisters(15, 6);
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
                rc = _mb.readInputRegisters(15, 6);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 6; i++) buf[0 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele DJ-2.1_1 bloco 0 FAIL (reg=15 count=6 rc=0x%02X)\n", rc);
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
    // Bloco 1: reg 59, count 2, func 0x04 - RTU 30060: Frequency Hz
    {
        uint8_t rc = _mb.readInputRegisters(59, 2);
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
                rc = _mb.readInputRegisters(59, 2);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 2; i++) buf[6 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele DJ-2.1_1 bloco 1 FAIL (reg=59 count=2 rc=0x%02X)\n", rc);
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
    // Bloco 2: reg 63, count 6, func 0x04 - RTU 30064-30069: Ia/Ib/Ic Primary
    {
        uint8_t rc = _mb.readInputRegisters(63, 6);
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
                rc = _mb.readInputRegisters(63, 6);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 6; i++) buf[8 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele DJ-2.1_1 bloco 2 FAIL (reg=63 count=6 rc=0x%02X)\n", rc);
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
    // Bloco 3: reg 87, count 2, func 0x04 - RTU 30088: In Primary
    {
        uint8_t rc = _mb.readInputRegisters(87, 2);
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
                rc = _mb.readInputRegisters(87, 2);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 2; i++) buf[14 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele DJ-2.1_1 bloco 3 FAIL (reg=87 count=2 rc=0x%02X)\n", rc);
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
    // Bloco 4: reg 117, count 2, func 0x04 - RTU 30118: P 3Ph Primary
    {
        uint8_t rc = _mb.readInputRegisters(117, 2);
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
                rc = _mb.readInputRegisters(117, 2);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 2; i++) buf[16 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele DJ-2.1_1 bloco 4 FAIL (reg=117 count=2 rc=0x%02X)\n", rc);
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
    // Bloco 5: reg 125, count 2, func 0x04 - RTU 30126: Q 3Ph Primary
    {
        uint8_t rc = _mb.readInputRegisters(125, 2);
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
                rc = _mb.readInputRegisters(125, 2);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 2; i++) buf[18 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele DJ-2.1_1 bloco 5 FAIL (reg=125 count=2 rc=0x%02X)\n", rc);
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
    // Bloco 6: reg 135, count 6, func 0x04 - RTU 30136-30141: PF PhA/B/C
    {
        uint8_t rc = _mb.readInputRegisters(135, 6);
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
                rc = _mb.readInputRegisters(135, 6);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 6; i++) buf[20 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Rele DJ-2.1_1 bloco 6 FAIL (reg=135 count=6 rc=0x%02X)\n", rc);
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

    uint16_t buf[26];
    if (!_read_dev_0_raw(buf)) {
        _ds0.fail_streak++;
        Serial.printf("[MB] Rele DJ-2.1_1: falha leitura (consecutivas: %d)\n", _ds0.fail_streak);
        if (_ds0.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _ds0.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_ds0.cooldown_until == 0) _ds0.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[MB] Rele DJ-2.1_1: cooldown %lus (nao responde) — loop liberado p/ LoRa/cmd\n",
                          (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    diag_last_successful_read_ms = millis();
    _ds0.cooldown_until = 0;
    if (_ds0.fail_streak > 0) {
        Serial.printf("[MB] Rele DJ-2.1_1: OK (apos %d falhas consecutivas)\n", _ds0.fail_streak);
        _ds0.fail_streak = 0;
    }

    float v_ia = (float)(int32_t)(((uint32_t)buf[8] << 16) | buf[8+1]) / 1000.0;
    _ds0.sum_[0] += v_ia;
    float v_ib = (float)(int32_t)(((uint32_t)buf[10] << 16) | buf[10+1]) / 1000.0;
    _ds0.sum_[1] += v_ib;
    float v_ic = (float)(int32_t)(((uint32_t)buf[12] << 16) | buf[12+1]) / 1000.0;
    _ds0.sum_[2] += v_ic;
    float v_in = (float)(int32_t)(((uint32_t)buf[14] << 16) | buf[14+1]) / 1000.0;
    _ds0.sum_[3] += v_in;
    float v_va = (float)(int32_t)(((uint32_t)buf[0] << 16) | buf[0+1]) / 1000.0;
    _ds0.sum_[4] += v_va;
    float v_vb = (float)(int32_t)(((uint32_t)buf[2] << 16) | buf[2+1]) / 1000.0;
    _ds0.sum_[5] += v_vb;
    float v_vc = (float)(int32_t)(((uint32_t)buf[4] << 16) | buf[4+1]) / 1000.0;
    _ds0.sum_[6] += v_vc;
    float v_freq = (float)(int32_t)(((uint32_t)buf[6] << 16) | buf[6+1]) / 1000.0;
    _ds0.sum_[7] += v_freq;
    float v_cosfi_a = (float)(int32_t)(((uint32_t)buf[20] << 16) | buf[20+1]) / 1000.0;
    _ds0.sum_[8] += v_cosfi_a;
    float v_cosfi_b = (float)(int32_t)(((uint32_t)buf[22] << 16) | buf[22+1]) / 1000.0;
    _ds0.sum_[9] += v_cosfi_b;
    float v_cosfi_c = (float)(int32_t)(((uint32_t)buf[24] << 16) | buf[24+1]) / 1000.0;
    _ds0.sum_[10] += v_cosfi_c;
    float v_pa_total = (float)(int32_t)(((uint32_t)buf[16] << 16) | buf[16+1]) / 1000.0;
    _ds0.sum_[11] += v_pa_total;
    float v_pr_total = (float)(int32_t)(((uint32_t)buf[18] << 16) | buf[18+1]) / 1000.0;
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
    Serial.printf("[MB] Rele DJ-2.1_1 #%d: ", _ds0.samples);
    Serial.printf("va=%.2f ", v_va);
    Serial.printf("vb=%.2f ", v_vb);
    Serial.printf("vc=%.2f ", v_vc);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f", v_ic);
    Serial.println();

    // BI 9 pontos em 4 bloco(s)
    {
        bool _biOk = true;
        if (_mb.readDiscreteInputs(561, 8) == _mb.ku8MBSuccess) {
            _ds0.bi_[6] = (_mb.getResponseBuffer(0) >> 6) & 1;  // dj_aberto
            _ds0.bi_[7] = (_mb.getResponseBuffer(0) >> 0) & 1;  // dj_fechado
        } else _biOk = false;
        if (_mb.readDiscreteInputs(294, 4) == _mb.ku8MBSuccess) {
            _ds0.bi_[3] = (_mb.getResponseBuffer(0) >> 1) & 1;  // f59a
            _ds0.bi_[4] = (_mb.getResponseBuffer(0) >> 2) & 1;  // f59b
            _ds0.bi_[5] = (_mb.getResponseBuffer(0) >> 3) & 1;  // f59c
        } else _biOk = false;
        if (_mb.readDiscreteInputs(112, 4) == _mb.ku8MBSuccess) {
            _ds0.bi_[0] = (_mb.getResponseBuffer(0) >> 1) & 1;  // f27a
            _ds0.bi_[1] = (_mb.getResponseBuffer(0) >> 2) & 1;  // f27b
            _ds0.bi_[2] = (_mb.getResponseBuffer(0) >> 3) & 1;  // f27c
        } else _biOk = false;
        if (_mb.readDiscreteInputs(603, 2) == _mb.ku8MBSuccess) {
            _ds0.bi_[8] = (_mb.getResponseBuffer(0) >> 1) & 1;  // local_remoto
        } else _biOk = false;
        if (_biOk) _ds0.bi_valid = true;
    }
    _ds0.valid = true;
}

// Publica JSON (medias + last + delta) e reseta acumuladores. Chamar a cada PUBLISH_INTERVAL_MS.
static void _publish_dev_0(modbus_publish_fn publish) {
    if (!_ds0.valid || _ds0.samples == 0) {
        publish("Rele DJ-2.1_1/status", "{\"error\":\"no_samples\"}");
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
    if (_ds0.bi_valid) d["f27a"] = _ds0.bi_[0];
    if (_ds0.bi_valid) d["f27b"] = _ds0.bi_[1];
    if (_ds0.bi_valid) d["f27c"] = _ds0.bi_[2];
    if (_ds0.bi_valid) d["f59a"] = _ds0.bi_[3];
    if (_ds0.bi_valid) d["f59b"] = _ds0.bi_[4];
    if (_ds0.bi_valid) d["f59c"] = _ds0.bi_[5];
    if (_ds0.bi_valid) d["local_remoto"] = _ds0.bi_[8];
    if (_ds0.bi_valid) d["dj_aberto"] = _ds0.bi_[6];
    if (_ds0.bi_valid) d["dj_fechado"] = _ds0.bi_[7];

    // Payload na heap — mesma razao do JSON doc acima.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[RS485] malloc payload falhou — pulando publish");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Rele DJ-2.1_1/data", payload);
        Serial.printf("\n===== PUBLICADO: Rele DJ-2.1_1 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 13; i++) _ds0.sum_[i] = 0;
    _ds0.samples = 0;
}

// ===== SOE (eventos) — Rele DJ-2.1 =====
static void _evt_emit_dev_0(modbus_publish_fn publish, const uint8_t* b) {
    uint8_t type = b[0];
    if (type != 1 && type != 2 && type != 4) return;   // tipo desconhecido: ignora
    uint8_t fun = b[2], inf = b[3];
    uint16_t ms = 0; uint8_t mi = 0, ho = 0;
    int dpi = -1; long rt = -1, fnum = -1;
    bool hasMeas = false; float meas = 0.0f;
    if (type == 1) {
        dpi = b[4];
    } else if (type == 2) {
        dpi = b[4];
        rt   = (long)b[5]  | ((long)b[6]  << 8);
        fnum = (long)b[7]  | ((long)b[8]  << 8);
    } else { // type 4: Meas (R32.23, LSB first) nos bytes 4-7
        uint32_t u = (uint32_t)b[4] | ((uint32_t)b[5] << 8) | ((uint32_t)b[6] << 16) | ((uint32_t)b[7] << 24);
        memcpy(&meas, &u, sizeof(float)); hasMeas = true;
        rt   = (long)b[8]  | ((long)b[9]  << 8);
        fnum = (long)b[10] | ((long)b[11] << 8);
    }
    ms = (uint16_t)b[12] | ((uint16_t)b[13] << 8);   // ms L, ms H
    mi = b[14]; ho = b[15];
    bool hora_ok = !(mi & 0x80);      // MSB de Mi = hora invalida (relogio nao setado)
    bool dst     = (ho & 0x80) != 0;  // MSB de Ho = horario de verao
    uint8_t mins = mi & 0x7F, hrs = ho & 0x7F;

    char p[320]; int n = 0;
    n += snprintf(p + n, sizeof(p) - n,
        "{\"dev\":\"Rele DJ-2.1_1\",\"cat\":\"siemens-7sr5\",\"proto\":\"modbus_7sr\""
        ",\"type\":%u,\"fun\":%u,\"inf\":%u"
        ",\"ho\":%u,\"mi\":%u,\"ms\":%u,\"hora_ok\":%s,\"dst\":%s,\"ts_rx\":%ld",
        type, fun, inf, hrs, mins, ms, hora_ok ? "true" : "false", dst ? "true" : "false",
        (long)time(nullptr));
    if (dpi  >= 0) n += snprintf(p + n, sizeof(p) - n, ",\"dpi\":%d", dpi);
    if (rt   >= 0) n += snprintf(p + n, sizeof(p) - n, ",\"rt\":%ld", rt);
    if (fnum >= 0) n += snprintf(p + n, sizeof(p) - n, ",\"fault\":%ld", fnum);
    if (hasMeas)   n += snprintf(p + n, sizeof(p) - n, ",\"meas\":%.3f", meas);
    snprintf(p + n, sizeof(p) - n, "}");

    Serial.printf("[EVT] Rele DJ-2.1_1 t%u FUN=%u INF=%u %02u:%02u:%06.3f%s\n",
                  type, fun, inf, hrs, mins, ms / 1000.0, hora_ok ? "" : " (HORA INVALIDA)");
    publish("evt", p);
}

// Drena a fila de eventos. Oportunista: se o rele nao responder, sai quieto (a
// telemetria ja loga falha; evento nao deve poluir nem entrar no back-off).
static void _evt_poll_dev_0(modbus_publish_fn publish) {
    _select(1);
    _mb.clearResponseBuffer();
    if (_mb.readInputRegisters(0, 1) != _mb.ku8MBSuccess) return;
    uint16_t cnt = _mb.getResponseBuffer(0);
    if (cnt == 0) return;
    Serial.printf("[EVT] Rele DJ-2.1_1: %u evento(s) no buffer\n", (unsigned)cnt);
    for (int guard = 0; guard < 32; guard++) {   // teto: nunca travar o loop principal
        _select(1);
        _mb.clearResponseBuffer();
        uint8_t rc = _mb.readInputRegisters(1, 8);
        if (rc == 0x02) break;  // fila vazia = fim (NORMAL)
        if (rc != _mb.ku8MBSuccess) {
            Serial.printf("[EVT] Rele DJ-2.1_1: leitura de evento rc=0x%02X — aborta ciclo\n", rc);
            break;
        }
        uint8_t b[16];
        for (int i = 0; i < 8; i++) {
            uint16_t r = _mb.getResponseBuffer(i);
            b[i * 2] = (uint8_t)(r >> 8); b[i * 2 + 1] = (uint8_t)(r & 0xFF);
        }
        _evt_emit_dev_0(publish, b);
    }
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
    _evt_poll_dev_0(publish);
}

bool modbus_exec_command(const char* device_name, const char* cmd_id) {
    if (!device_name || !cmd_id) return false;
    if (strcmp(device_name, "Rele DJ-2.1") == 0) {
        _select(1);
        return false;
    }
    return false;
}
