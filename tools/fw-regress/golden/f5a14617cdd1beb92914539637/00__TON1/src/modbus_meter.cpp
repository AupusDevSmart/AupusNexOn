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
// Inversor (WEG SIW400 ST075)
// Endereco Modbus: 1
// Modos: 26 avg, 10 last, 0 delta
// =========================================================================

struct _Dev0State {
    // Acumuladores (somas para media)
    double sum_[26];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[36];
    // Primeira amostra de delta (snapshot no inicio do ciclo)
    float first_delta_[1];
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
    // Bloco 0: reg 768, count 4, func 0x03 - Regs 0x0300-0x0303: PV1-2 V/I
    {
        uint8_t rc = _mb.readHoldingRegisters(768, 4);
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
                rc = _mb.readHoldingRegisters(768, 4);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 4; i++) buf[0 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 0 FAIL (reg=768 count=4 rc=0x%02X)\n", rc);
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
    // Bloco 1: reg 772, count 12, func 0x03 - Regs 0x0304-0x030F: AC, freq, work_mode, temp
    {
        uint8_t rc = _mb.readHoldingRegisters(772, 12);
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
                rc = _mb.readHoldingRegisters(772, 12);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 12; i++) buf[4 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 1 FAIL (reg=772 count=12 rc=0x%02X)\n", rc);
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
    // Bloco 2: reg 786, count 15, func 0x03 - Regs 0x0312-0x0320: E-Total, FW ver, warning, E-Day
    {
        uint8_t rc = _mb.readHoldingRegisters(786, 15);
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
                rc = _mb.readHoldingRegisters(786, 15);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 15; i++) buf[16 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 2 FAIL (reg=786 count=15 rc=0x%02X)\n", rc);
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
    // Bloco 3: reg 850, count 25, func 0x03 - Regs 0x0352-0x036A: Pac U32 + PV3-4 V/I + Istr1-16
    {
        uint8_t rc = _mb.readHoldingRegisters(850, 25);
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
                rc = _mb.readHoldingRegisters(850, 25);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 25; i++) buf[31 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 3 FAIL (reg=850 count=25 rc=0x%02X)\n", rc);
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
    // Bloco 4: reg 1014, count 4, func 0x03 - Regs 0x03F6-0x03F9: Q + PF INT32
    {
        uint8_t rc = _mb.readHoldingRegisters(1014, 4);
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
                rc = _mb.readHoldingRegisters(1014, 4);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 4; i++) buf[56 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 4 FAIL (reg=1014 count=4 rc=0x%02X)\n", rc);
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

    uint16_t buf[60];
    if (!_read_dev_0_raw(buf)) {
        _ds0.fail_streak++;
        Serial.printf("[MB] Inversor_1: falha leitura (consecutivas: %d)\n", _ds0.fail_streak);
        if (_ds0.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _ds0.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_ds0.cooldown_until == 0) _ds0.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[MB] Inversor_1: cooldown %lus (nao responde) — loop liberado p/ LoRa/cmd\n",
                          (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    diag_last_successful_read_ms = millis();
    _ds0.cooldown_until = 0;
    if (_ds0.fail_streak > 0) {
        Serial.printf("[MB] Inversor_1: OK (apos %d falhas consecutivas)\n", _ds0.fail_streak);
        _ds0.fail_streak = 0;
    }

    float v_ia = (float)buf[7] / 10.0;
    _ds0.sum_[0] += v_ia;
    float v_ib = (float)buf[8] / 10.0;
    _ds0.sum_[1] += v_ib;
    float v_ic = (float)buf[9] / 10.0;
    _ds0.sum_[2] += v_ic;
    float v_vab = (float)buf[4] / 10.0;
    _ds0.sum_[3] += v_vab;
    float v_vbc = (float)buf[5] / 10.0;
    _ds0.sum_[4] += v_vbc;
    float v_vca = (float)buf[6] / 10.0;
    _ds0.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)buf[0] / 10.0;
    _ds0.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)buf[1] / 10.0;
    _ds0.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)buf[36] / 10.0;
    _ds0.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)buf[37] / 10.0;
    _ds0.sum_[9] += v_mppt4_voltage;
    float v_string1_current = (float)buf[40] / 10.0;
    _ds0.sum_[10] += v_string1_current;
    float v_string2_current = (float)buf[41] / 10.0;
    _ds0.sum_[11] += v_string2_current;
    float v_string3_current = (float)buf[42] / 10.0;
    _ds0.sum_[12] += v_string3_current;
    float v_string4_current = (float)buf[43] / 10.0;
    _ds0.sum_[13] += v_string4_current;
    float v_string5_current = (float)buf[44] / 10.0;
    _ds0.sum_[14] += v_string5_current;
    float v_string6_current = (float)buf[45] / 10.0;
    _ds0.sum_[15] += v_string6_current;
    float v_string7_current = (float)buf[46] / 10.0;
    _ds0.sum_[16] += v_string7_current;
    float v_string8_current = (float)buf[47] / 10.0;
    _ds0.sum_[17] += v_string8_current;
    float v_string9_current = (float)buf[48] / 10.0;
    _ds0.sum_[18] += v_string9_current;
    float v_string10_current = (float)buf[49] / 10.0;
    _ds0.sum_[19] += v_string10_current;
    float v_string11_current = (float)buf[50] / 10.0;
    _ds0.sum_[20] += v_string11_current;
    float v_string12_current = (float)buf[51] / 10.0;
    _ds0.sum_[21] += v_string12_current;
    float v_string13_current = (float)buf[52] / 10.0;
    _ds0.sum_[22] += v_string13_current;
    float v_string14_current = (float)buf[53] / 10.0;
    _ds0.sum_[23] += v_string14_current;
    float v_string15_current = (float)buf[54] / 10.0;
    _ds0.sum_[24] += v_string15_current;
    float v_string16_current = (float)buf[55] / 10.0;
    _ds0.sum_[25] += v_string16_current;
    float v_fp = (float)(int32_t)(((uint32_t)buf[58] << 16) | buf[58+1]) / 1000.0;
    float v_freq = (float)buf[10] / 100.0;
    float v_work_state = (float)buf[14];
    float v_daily_yield = (float)buf[30] / 10.0;
    float v_total_yield = (float)(((uint32_t)buf[16] << 16) | buf[16+1]) / 10.0;
    float v_temp_interna = (float)(int16_t)buf[15] / 10.0;
    float v_warning_code = (float)buf[21];
    float v_potencia_ativa = (float)(((uint32_t)buf[31] << 16) | buf[31+1]);
    float v_firmware_version = (float)buf[20];
    float v_potencia_reativa = (float)(int32_t)(((uint32_t)buf[56] << 16) | buf[56+1]);
    _ds0.last_[0] = v_ia;
    _ds0.last_[1] = v_ib;
    _ds0.last_[2] = v_ic;
    _ds0.last_[3] = v_vab;
    _ds0.last_[4] = v_vbc;
    _ds0.last_[5] = v_vca;
    _ds0.last_[6] = v_mppt1_voltage;
    _ds0.last_[7] = v_mppt2_voltage;
    _ds0.last_[8] = v_mppt3_voltage;
    _ds0.last_[9] = v_mppt4_voltage;
    _ds0.last_[10] = v_string1_current;
    _ds0.last_[11] = v_string2_current;
    _ds0.last_[12] = v_string3_current;
    _ds0.last_[13] = v_string4_current;
    _ds0.last_[14] = v_string5_current;
    _ds0.last_[15] = v_string6_current;
    _ds0.last_[16] = v_string7_current;
    _ds0.last_[17] = v_string8_current;
    _ds0.last_[18] = v_string9_current;
    _ds0.last_[19] = v_string10_current;
    _ds0.last_[20] = v_string11_current;
    _ds0.last_[21] = v_string12_current;
    _ds0.last_[22] = v_string13_current;
    _ds0.last_[23] = v_string14_current;
    _ds0.last_[24] = v_string15_current;
    _ds0.last_[25] = v_string16_current;
    _ds0.last_[26] = v_fp;
    _ds0.last_[27] = v_freq;
    _ds0.last_[28] = v_work_state;
    _ds0.last_[29] = v_daily_yield;
    _ds0.last_[30] = v_total_yield;
    _ds0.last_[31] = v_temp_interna;
    _ds0.last_[32] = v_warning_code;
    _ds0.last_[33] = v_potencia_ativa;
    _ds0.last_[34] = v_firmware_version;
    _ds0.last_[35] = v_potencia_reativa;
    _ds0.samples++;
    // Log de debug — mostra principais valores lidos
    Serial.printf("[MB] Inversor_1 #%d: ", _ds0.samples);
    Serial.printf("vab=%.2f ", v_vab);
    Serial.printf("vbc=%.2f ", v_vbc);
    Serial.printf("vca=%.2f ", v_vca);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f", v_ic);
    Serial.println();
    _ds0.valid = true;
}

// Publica JSON (medias + last + delta) e reseta acumuladores. Chamar a cada PUBLISH_INTERVAL_MS.
static void _publish_dev_0(modbus_publish_fn publish) {
    if (!_ds0.valid || _ds0.samples == 0) {
        publish("Inversor_1/status", "{\"error\":\"no_samples\"}");
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

    d["warning_code"] = _ds0.last_[32];
    d["firmware_version"] = _ds0.last_[34];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _ds0.last_[29];
    g_energy["total_yield"] = _ds0.last_[30];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _ds0.last_[31];
    JsonObject g_dc = d.createNestedObject("dc");
    g_dc["mppt1_voltage"] = (float)(_ds0.sum_[6] / n);
    g_dc["mppt2_voltage"] = (float)(_ds0.sum_[7] / n);
    g_dc["mppt3_voltage"] = (float)(_ds0.sum_[8] / n);
    g_dc["mppt4_voltage"] = (float)(_ds0.sum_[9] / n);
    g_dc["string1_current"] = (float)(_ds0.sum_[10] / n);
    g_dc["string2_current"] = (float)(_ds0.sum_[11] / n);
    g_dc["string3_current"] = (float)(_ds0.sum_[12] / n);
    g_dc["string4_current"] = (float)(_ds0.sum_[13] / n);
    g_dc["string5_current"] = (float)(_ds0.sum_[14] / n);
    g_dc["string6_current"] = (float)(_ds0.sum_[15] / n);
    g_dc["string7_current"] = (float)(_ds0.sum_[16] / n);
    g_dc["string8_current"] = (float)(_ds0.sum_[17] / n);
    g_dc["string9_current"] = (float)(_ds0.sum_[18] / n);
    g_dc["string10_current"] = (float)(_ds0.sum_[19] / n);
    g_dc["string11_current"] = (float)(_ds0.sum_[20] / n);
    g_dc["string12_current"] = (float)(_ds0.sum_[21] / n);
    g_dc["string13_current"] = (float)(_ds0.sum_[22] / n);
    g_dc["string14_current"] = (float)(_ds0.sum_[23] / n);
    g_dc["string15_current"] = (float)(_ds0.sum_[24] / n);
    g_dc["string16_current"] = (float)(_ds0.sum_[25] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_ds0.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_ds0.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_ds0.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_ds0.sum_[0] / n);
    g_current["phase_b"] = (float)(_ds0.sum_[1] / n);
    g_current["phase_c"] = (float)(_ds0.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _ds0.last_[26];
    g_power["frequency"] = _ds0.last_[27];
    g_power["active_total"] = _ds0.last_[33];
    g_power["reactive_total"] = _ds0.last_[35];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _ds0.last_[28];
    g_status["work_state_text"] = _work_state_text((uint16_t)_ds0.last_[28]);

    // Payload na heap — mesma razao do JSON doc acima.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[RS485] malloc payload falhou — pulando publish");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Inversor_1/data", payload);
        Serial.printf("\n===== PUBLICADO: Inversor_1 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 26; i++) _ds0.sum_[i] = 0;
    _ds0.samples = 0;
}

// =========================================================================
// Inversor (Huawei SUN2000-75KTL M1)
// Endereco Modbus: 2
// Modos: 37 avg, 12 last, 0 delta
// =========================================================================

struct _Dev1State {
    // Acumuladores (somas para media)
    double sum_[37];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[49];
    // Primeira amostra de delta (snapshot no inicio do ciclo)
    float first_delta_[1];
    bool has_first_delta;
    // Estados BI da ultima leitura
    uint8_t bi_[1];
    bool valid;
    int fail_streak;            // leituras consecutivas falhas
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
};
static _Dev1State _ds1 = {};

static bool _read_dev_1_raw(uint16_t *buf) {
    _select(2);
    // Bloco 0: reg 32016, count 40, func 0x03 - Regs 32016-32055: PV1-20 V/I (10 MPPTs x 2 strings)
    {
        uint8_t rc = _mb.readHoldingRegisters(32016, 40);
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
            if (_ds1.fail_streak == 0) {
                rc = _mb.readHoldingRegisters(32016, 40);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 40; i++) buf[0 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 0 FAIL (reg=32016 count=40 rc=0x%02X)\n", rc);
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
    // Bloco 1: reg 32064, count 27, func 0x03 - Regs 32064-32090: P, V, I, freq, temp, isolamento, status, fault
    {
        uint8_t rc = _mb.readHoldingRegisters(32064, 27);
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
            if (_ds1.fail_streak == 0) {
                rc = _mb.readHoldingRegisters(32064, 27);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 27; i++) buf[40 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 1 FAIL (reg=32064 count=27 rc=0x%02X)\n", rc);
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
    // Bloco 2: reg 32106, count 10, func 0x03 - Regs 32106-32115: energia total e diaria
    {
        uint8_t rc = _mb.readHoldingRegisters(32106, 10);
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
            if (_ds1.fail_streak == 0) {
                rc = _mb.readHoldingRegisters(32106, 10);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 10; i++) buf[67 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 2 FAIL (reg=32106 count=10 rc=0x%02X)\n", rc);
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
    // Bloco 3: reg 30070, count 5, func 0x03 - Regs 30070-30074: Model ID + Rated Power
    {
        uint8_t rc = _mb.readHoldingRegisters(30070, 5);
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
            if (_ds1.fail_streak == 0) {
                rc = _mb.readHoldingRegisters(30070, 5);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 5; i++) buf[77 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 3 FAIL (reg=30070 count=5 rc=0x%02X)\n", rc);
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
static void _sample_dev_1() {
    // Back-off: device que falhou MODBUS_FAIL_COOLDOWN_N vezes fica em cooldown.
    // Pula a leitura (que bloquearia o loop no timeout) ate o cooldown expirar.
    if (_ds1.cooldown_until && (long)(millis() - _ds1.cooldown_until) < 0) return;

    uint16_t buf[82];
    if (!_read_dev_1_raw(buf)) {
        _ds1.fail_streak++;
        Serial.printf("[MB] Inversor_2: falha leitura (consecutivas: %d)\n", _ds1.fail_streak);
        if (_ds1.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _ds1.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_ds1.cooldown_until == 0) _ds1.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[MB] Inversor_2: cooldown %lus (nao responde) — loop liberado p/ LoRa/cmd\n",
                          (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    diag_last_successful_read_ms = millis();
    _ds1.cooldown_until = 0;
    if (_ds1.fail_streak > 0) {
        Serial.printf("[MB] Inversor_2: OK (apos %d falhas consecutivas)\n", _ds1.fail_streak);
        _ds1.fail_streak = 0;
    }

    float v_ia = (float)(int32_t)(((uint32_t)buf[48] << 16) | buf[48+1]) / 1000.0;
    _ds1.sum_[0] += v_ia;
    float v_ib = (float)(int32_t)(((uint32_t)buf[50] << 16) | buf[50+1]) / 1000.0;
    _ds1.sum_[1] += v_ib;
    float v_ic = (float)(int32_t)(((uint32_t)buf[52] << 16) | buf[52+1]) / 1000.0;
    _ds1.sum_[2] += v_ic;
    float v_vab = (float)buf[42] / 10.0;
    _ds1.sum_[3] += v_vab;
    float v_vbc = (float)buf[43] / 10.0;
    _ds1.sum_[4] += v_vbc;
    float v_vca = (float)buf[44] / 10.0;
    _ds1.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)(int16_t)buf[0] / 10.0;
    _ds1.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)(int16_t)buf[4] / 10.0;
    _ds1.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)(int16_t)buf[8] / 10.0;
    _ds1.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)(int16_t)buf[12] / 10.0;
    _ds1.sum_[9] += v_mppt4_voltage;
    float v_mppt5_voltage = (float)(int16_t)buf[16] / 10.0;
    _ds1.sum_[10] += v_mppt5_voltage;
    float v_mppt6_voltage = (float)(int16_t)buf[20] / 10.0;
    _ds1.sum_[11] += v_mppt6_voltage;
    float v_mppt7_voltage = (float)(int16_t)buf[24] / 10.0;
    _ds1.sum_[12] += v_mppt7_voltage;
    float v_mppt8_voltage = (float)(int16_t)buf[28] / 10.0;
    _ds1.sum_[13] += v_mppt8_voltage;
    float v_mppt9_voltage = (float)(int16_t)buf[32] / 10.0;
    _ds1.sum_[14] += v_mppt9_voltage;
    float v_dc_total_power = (float)(int32_t)(((uint32_t)buf[40] << 16) | buf[40+1]);
    _ds1.sum_[15] += v_dc_total_power;
    float v_mppt10_voltage = (float)(int16_t)buf[36] / 10.0;
    _ds1.sum_[16] += v_mppt10_voltage;
    float v_string1_current = (float)(int16_t)buf[1] / 100.0;
    _ds1.sum_[17] += v_string1_current;
    float v_string2_current = (float)(int16_t)buf[3] / 100.0;
    _ds1.sum_[18] += v_string2_current;
    float v_string3_current = (float)(int16_t)buf[5] / 100.0;
    _ds1.sum_[19] += v_string3_current;
    float v_string4_current = (float)(int16_t)buf[7] / 100.0;
    _ds1.sum_[20] += v_string4_current;
    float v_string5_current = (float)(int16_t)buf[9] / 100.0;
    _ds1.sum_[21] += v_string5_current;
    float v_string6_current = (float)(int16_t)buf[11] / 100.0;
    _ds1.sum_[22] += v_string6_current;
    float v_string7_current = (float)(int16_t)buf[13] / 100.0;
    _ds1.sum_[23] += v_string7_current;
    float v_string8_current = (float)(int16_t)buf[15] / 100.0;
    _ds1.sum_[24] += v_string8_current;
    float v_string9_current = (float)(int16_t)buf[17] / 100.0;
    _ds1.sum_[25] += v_string9_current;
    float v_string10_current = (float)(int16_t)buf[19] / 100.0;
    _ds1.sum_[26] += v_string10_current;
    float v_string11_current = (float)(int16_t)buf[21] / 100.0;
    _ds1.sum_[27] += v_string11_current;
    float v_string12_current = (float)(int16_t)buf[23] / 100.0;
    _ds1.sum_[28] += v_string12_current;
    float v_string13_current = (float)(int16_t)buf[25] / 100.0;
    _ds1.sum_[29] += v_string13_current;
    float v_string14_current = (float)(int16_t)buf[27] / 100.0;
    _ds1.sum_[30] += v_string14_current;
    float v_string15_current = (float)(int16_t)buf[29] / 100.0;
    _ds1.sum_[31] += v_string15_current;
    float v_string16_current = (float)(int16_t)buf[31] / 100.0;
    _ds1.sum_[32] += v_string16_current;
    float v_string17_current = (float)(int16_t)buf[33] / 100.0;
    _ds1.sum_[33] += v_string17_current;
    float v_string18_current = (float)(int16_t)buf[35] / 100.0;
    _ds1.sum_[34] += v_string18_current;
    float v_string19_current = (float)(int16_t)buf[37] / 100.0;
    _ds1.sum_[35] += v_string19_current;
    float v_string20_current = (float)(int16_t)buf[39] / 100.0;
    _ds1.sum_[36] += v_string20_current;
    float v_fp = (float)(int16_t)buf[60] / 1000.0;
    float v_freq = (float)buf[61] / 100.0;
    float v_work_state = (float)buf[65];
    float v_daily_yield = (float)(((uint32_t)buf[75] << 16) | buf[75+1]) / 100.0;
    float v_device_type = (float)buf[77];
    float v_total_yield = (float)(((uint32_t)buf[67] << 16) | buf[67+1]) / 100.0;
    float v_temp_interna = (float)(int16_t)buf[63] / 10.0;
    float v_nominal_power = (float)(((uint32_t)buf[80] << 16) | buf[80+1]) / 1000.0;
    float v_pid_alarm_code = (float)buf[66];
    float v_potencia_ativa = (float)(int32_t)(((uint32_t)buf[56] << 16) | buf[56+1]);
    float v_potencia_reativa = (float)(int32_t)(((uint32_t)buf[58] << 16) | buf[58+1]);
    float v_insulation_resistance = (float)buf[64] / 1000.0;
    _ds1.last_[0] = v_ia;
    _ds1.last_[1] = v_ib;
    _ds1.last_[2] = v_ic;
    _ds1.last_[3] = v_vab;
    _ds1.last_[4] = v_vbc;
    _ds1.last_[5] = v_vca;
    _ds1.last_[6] = v_mppt1_voltage;
    _ds1.last_[7] = v_mppt2_voltage;
    _ds1.last_[8] = v_mppt3_voltage;
    _ds1.last_[9] = v_mppt4_voltage;
    _ds1.last_[10] = v_mppt5_voltage;
    _ds1.last_[11] = v_mppt6_voltage;
    _ds1.last_[12] = v_mppt7_voltage;
    _ds1.last_[13] = v_mppt8_voltage;
    _ds1.last_[14] = v_mppt9_voltage;
    _ds1.last_[15] = v_dc_total_power;
    _ds1.last_[16] = v_mppt10_voltage;
    _ds1.last_[17] = v_string1_current;
    _ds1.last_[18] = v_string2_current;
    _ds1.last_[19] = v_string3_current;
    _ds1.last_[20] = v_string4_current;
    _ds1.last_[21] = v_string5_current;
    _ds1.last_[22] = v_string6_current;
    _ds1.last_[23] = v_string7_current;
    _ds1.last_[24] = v_string8_current;
    _ds1.last_[25] = v_string9_current;
    _ds1.last_[26] = v_string10_current;
    _ds1.last_[27] = v_string11_current;
    _ds1.last_[28] = v_string12_current;
    _ds1.last_[29] = v_string13_current;
    _ds1.last_[30] = v_string14_current;
    _ds1.last_[31] = v_string15_current;
    _ds1.last_[32] = v_string16_current;
    _ds1.last_[33] = v_string17_current;
    _ds1.last_[34] = v_string18_current;
    _ds1.last_[35] = v_string19_current;
    _ds1.last_[36] = v_string20_current;
    _ds1.last_[37] = v_fp;
    _ds1.last_[38] = v_freq;
    _ds1.last_[39] = v_work_state;
    _ds1.last_[40] = v_daily_yield;
    _ds1.last_[41] = v_device_type;
    _ds1.last_[42] = v_total_yield;
    _ds1.last_[43] = v_temp_interna;
    _ds1.last_[44] = v_nominal_power;
    _ds1.last_[45] = v_pid_alarm_code;
    _ds1.last_[46] = v_potencia_ativa;
    _ds1.last_[47] = v_potencia_reativa;
    _ds1.last_[48] = v_insulation_resistance;
    _ds1.samples++;
    // Log de debug — mostra principais valores lidos
    Serial.printf("[MB] Inversor_2 #%d: ", _ds1.samples);
    Serial.printf("vab=%.2f ", v_vab);
    Serial.printf("vbc=%.2f ", v_vbc);
    Serial.printf("vca=%.2f ", v_vca);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f", v_ic);
    Serial.println();
    _ds1.valid = true;
}

// Publica JSON (medias + last + delta) e reseta acumuladores. Chamar a cada PUBLISH_INTERVAL_MS.
static void _publish_dev_1(modbus_publish_fn publish) {
    if (!_ds1.valid || _ds1.samples == 0) {
        publish("Inversor_2/status", "{\"error\":\"no_samples\"}");
        return;
    }

    int n = _ds1.samples;
    // JSON na heap (nao na stack). loopTask tem 8KB de stack; alocar 3KB+3KB
    // aqui (doc + payload) causava Panic em ~200s no projeto Chimarrao com
    // Power_Meter + 2 inversores. Heap fica em ~280KB livres.
    DynamicJsonDocument d(3072);
    d["timestamp"] = (long)time(nullptr);
    d["inverter_id"] = 2;
    d["samples"] = n;

    JsonObject g_info = d.createNestedObject("info");
    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(_ds1.last_[41])); g_info["device_type"] = String(_h); }
    g_info["nominal_power"] = _ds1.last_[44];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _ds1.last_[40];
    g_energy["total_yield"] = _ds1.last_[42];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _ds1.last_[43];
    JsonObject g_dc = d.createNestedObject("dc");
    g_dc["mppt1_voltage"] = (float)(_ds1.sum_[6] / n);
    g_dc["mppt2_voltage"] = (float)(_ds1.sum_[7] / n);
    g_dc["mppt3_voltage"] = (float)(_ds1.sum_[8] / n);
    g_dc["mppt4_voltage"] = (float)(_ds1.sum_[9] / n);
    g_dc["mppt5_voltage"] = (float)(_ds1.sum_[10] / n);
    g_dc["mppt6_voltage"] = (float)(_ds1.sum_[11] / n);
    g_dc["mppt7_voltage"] = (float)(_ds1.sum_[12] / n);
    g_dc["mppt8_voltage"] = (float)(_ds1.sum_[13] / n);
    g_dc["mppt9_voltage"] = (float)(_ds1.sum_[14] / n);
    g_dc["total_power"] = (float)(_ds1.sum_[15] / n);
    g_dc["mppt10_voltage"] = (float)(_ds1.sum_[16] / n);
    g_dc["string1_current"] = (float)(_ds1.sum_[17] / n);
    g_dc["string2_current"] = (float)(_ds1.sum_[18] / n);
    g_dc["string3_current"] = (float)(_ds1.sum_[19] / n);
    g_dc["string4_current"] = (float)(_ds1.sum_[20] / n);
    g_dc["string5_current"] = (float)(_ds1.sum_[21] / n);
    g_dc["string6_current"] = (float)(_ds1.sum_[22] / n);
    g_dc["string7_current"] = (float)(_ds1.sum_[23] / n);
    g_dc["string8_current"] = (float)(_ds1.sum_[24] / n);
    g_dc["string9_current"] = (float)(_ds1.sum_[25] / n);
    g_dc["string10_current"] = (float)(_ds1.sum_[26] / n);
    g_dc["string11_current"] = (float)(_ds1.sum_[27] / n);
    g_dc["string12_current"] = (float)(_ds1.sum_[28] / n);
    g_dc["string13_current"] = (float)(_ds1.sum_[29] / n);
    g_dc["string14_current"] = (float)(_ds1.sum_[30] / n);
    g_dc["string15_current"] = (float)(_ds1.sum_[31] / n);
    g_dc["string16_current"] = (float)(_ds1.sum_[32] / n);
    g_dc["string17_current"] = (float)(_ds1.sum_[33] / n);
    g_dc["string18_current"] = (float)(_ds1.sum_[34] / n);
    g_dc["string19_current"] = (float)(_ds1.sum_[35] / n);
    g_dc["string20_current"] = (float)(_ds1.sum_[36] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_ds1.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_ds1.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_ds1.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_ds1.sum_[0] / n);
    g_current["phase_b"] = (float)(_ds1.sum_[1] / n);
    g_current["phase_c"] = (float)(_ds1.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _ds1.last_[37];
    g_power["frequency"] = _ds1.last_[38];
    g_power["active_total"] = _ds1.last_[46];
    g_power["reactive_total"] = _ds1.last_[47];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _ds1.last_[39];
    g_status["work_state_text"] = _work_state_text((uint16_t)_ds1.last_[39]);
    JsonObject g_protection = d.createNestedObject("protection");
    g_protection["insulation_resistance"] = _ds1.last_[48];
    JsonObject g_pid = d.createNestedObject("pid");
    g_pid["alarm_code"] = _ds1.last_[45];

    // Payload na heap — mesma razao do JSON doc acima.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[RS485] malloc payload falhou — pulando publish");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Inversor_2/data", payload);
        Serial.printf("\n===== PUBLICADO: Inversor_2 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 37; i++) _ds1.sum_[i] = 0;
    _ds1.samples = 0;
}

static int _rr_idx = 0;
static const int _dev_count = 2;

void modbus_sample_one() {
    switch (_rr_idx) {
        case 0: _sample_dev_0(); break;
        case 1: _sample_dev_1(); break;
    }
    _rr_idx = (_rr_idx + 1) % _dev_count;
}

void modbus_publish_all(modbus_publish_fn publish) {
    if (!publish) return;
    _publish_dev_0(publish);
    _publish_dev_1(publish);
}

// Legado: sample todos + publica (sem media)
void modbus_read_all(modbus_publish_fn publish) {
    if (!publish) return;
    _sample_dev_0();
    _publish_dev_0(publish);
    _sample_dev_1();
    _publish_dev_1(publish);
}

// SOE: drena a fila de eventos de cada device que tem buffer no catalogo.
void modbus_events_poll(modbus_publish_fn publish) {
    if (!publish) return;
}

bool modbus_exec_command(const char* device_name, const char* cmd_id) {
    if (!device_name || !cmd_id) return false;
    return false;
}
