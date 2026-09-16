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
// Inversor (Sungrow SG110CX)
// Endereco Modbus: 1
// Modos: 34 avg, 21 last, 0 delta
// =========================================================================

struct _Dev0State {
    // Acumuladores (somas para media)
    double sum_[34];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[55];
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
    // Bloco 0: reg 4999, count 50, func 0x04 - Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status
    {
        uint8_t rc = _mb.readInputRegisters(4999, 50);
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
                rc = _mb.readInputRegisters(4999, 50);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 50; i++) buf[0 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 0 FAIL (reg=4999 count=50 rc=0x%02X)\n", rc);
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
    // Bloco 1: reg 5049, count 40, func 0x04 - Regs 5050-5089: regulation, insulation
    {
        uint8_t rc = _mb.readInputRegisters(5049, 40);
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
                rc = _mb.readInputRegisters(5049, 40);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 40; i++) buf[50 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 1 FAIL (reg=5049 count=40 rc=0x%02X)\n", rc);
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
    // Bloco 2: reg 5089, count 30, func 0x04 - Regs 5090-5119: tempo diario, MPPT 4-6
    {
        uint8_t rc = _mb.readInputRegisters(5089, 30);
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
                rc = _mb.readInputRegisters(5089, 30);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 30; i++) buf[90 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 2 FAIL (reg=5089 count=30 rc=0x%02X)\n", rc);
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
    // Bloco 3: reg 5119, count 35, func 0x04 - Regs 5120-5154: MPPT 7-9, bus voltage, PID
    {
        uint8_t rc = _mb.readInputRegisters(5119, 35);
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
                rc = _mb.readInputRegisters(5119, 35);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 35; i++) buf[120 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 3 FAIL (reg=5119 count=35 rc=0x%02X)\n", rc);
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
    // Bloco 4: reg 7012, count 18, func 0x04 - Regs 7013-7030: strings 1-18
    {
        uint8_t rc = _mb.readInputRegisters(7012, 18);
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
                rc = _mb.readInputRegisters(7012, 18);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 18; i++) buf[155 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_1 bloco 4 FAIL (reg=7012 count=18 rc=0x%02X)\n", rc);
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

    uint16_t buf[173];
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

    float v_ia = (float)buf[22] / 10.0;
    _ds0.sum_[0] += v_ia;
    float v_ib = (float)buf[23] / 10.0;
    _ds0.sum_[1] += v_ib;
    float v_ic = (float)buf[24] / 10.0;
    _ds0.sum_[2] += v_ic;
    float v_vab = (float)buf[19] / 10.0;
    _ds0.sum_[3] += v_vab;
    float v_vbc = (float)buf[20] / 10.0;
    _ds0.sum_[4] += v_vbc;
    float v_vca = (float)buf[21] / 10.0;
    _ds0.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)buf[11] / 10.0;
    _ds0.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)buf[13] / 10.0;
    _ds0.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)buf[15] / 10.0;
    _ds0.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)buf[115] / 10.0;
    _ds0.sum_[9] += v_mppt4_voltage;
    float v_mppt5_voltage = (float)buf[117] / 10.0;
    _ds0.sum_[10] += v_mppt5_voltage;
    float v_mppt6_voltage = (float)buf[119] / 10.0;
    _ds0.sum_[11] += v_mppt6_voltage;
    float v_mppt7_voltage = (float)buf[121] / 10.0;
    _ds0.sum_[12] += v_mppt7_voltage;
    float v_mppt8_voltage = (float)buf[123] / 10.0;
    _ds0.sum_[13] += v_mppt8_voltage;
    float v_mppt9_voltage = (float)buf[130] / 10.0;
    _ds0.sum_[14] += v_mppt9_voltage;
    float v_dc_total_power = (float)(((uint32_t)buf[17+1] << 16) | buf[17]);
    _ds0.sum_[15] += v_dc_total_power;
    float v_string1_current = (float)buf[155] / 100.0;
    _ds0.sum_[16] += v_string1_current;
    float v_string2_current = (float)buf[156] / 100.0;
    _ds0.sum_[17] += v_string2_current;
    float v_string3_current = (float)buf[157] / 100.0;
    _ds0.sum_[18] += v_string3_current;
    float v_string4_current = (float)buf[158] / 100.0;
    _ds0.sum_[19] += v_string4_current;
    float v_string5_current = (float)buf[159] / 100.0;
    _ds0.sum_[20] += v_string5_current;
    float v_string6_current = (float)buf[160] / 100.0;
    _ds0.sum_[21] += v_string6_current;
    float v_string7_current = (float)buf[161] / 100.0;
    _ds0.sum_[22] += v_string7_current;
    float v_string8_current = (float)buf[162] / 100.0;
    _ds0.sum_[23] += v_string8_current;
    float v_string9_current = (float)buf[163] / 100.0;
    _ds0.sum_[24] += v_string9_current;
    float v_string10_current = (float)buf[164] / 100.0;
    _ds0.sum_[25] += v_string10_current;
    float v_string11_current = (float)buf[165] / 100.0;
    _ds0.sum_[26] += v_string11_current;
    float v_string12_current = (float)buf[166] / 100.0;
    _ds0.sum_[27] += v_string12_current;
    float v_string13_current = (float)buf[167] / 100.0;
    _ds0.sum_[28] += v_string13_current;
    float v_string14_current = (float)buf[168] / 100.0;
    _ds0.sum_[29] += v_string14_current;
    float v_string15_current = (float)buf[169] / 100.0;
    _ds0.sum_[30] += v_string15_current;
    float v_string16_current = (float)buf[170] / 100.0;
    _ds0.sum_[31] += v_string16_current;
    float v_string17_current = (float)buf[171] / 100.0;
    _ds0.sum_[32] += v_string17_current;
    float v_string18_current = (float)buf[172] / 100.0;
    _ds0.sum_[33] += v_string18_current;
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
    _ds0.last_[10] = v_mppt5_voltage;
    _ds0.last_[11] = v_mppt6_voltage;
    _ds0.last_[12] = v_mppt7_voltage;
    _ds0.last_[13] = v_mppt8_voltage;
    _ds0.last_[14] = v_mppt9_voltage;
    _ds0.last_[15] = v_dc_total_power;
    _ds0.last_[16] = v_string1_current;
    _ds0.last_[17] = v_string2_current;
    _ds0.last_[18] = v_string3_current;
    _ds0.last_[19] = v_string4_current;
    _ds0.last_[20] = v_string5_current;
    _ds0.last_[21] = v_string6_current;
    _ds0.last_[22] = v_string7_current;
    _ds0.last_[23] = v_string8_current;
    _ds0.last_[24] = v_string9_current;
    _ds0.last_[25] = v_string10_current;
    _ds0.last_[26] = v_string11_current;
    _ds0.last_[27] = v_string12_current;
    _ds0.last_[28] = v_string13_current;
    _ds0.last_[29] = v_string14_current;
    _ds0.last_[30] = v_string15_current;
    _ds0.last_[31] = v_string16_current;
    _ds0.last_[32] = v_string17_current;
    _ds0.last_[33] = v_string18_current;
    _ds0.last_[34] = v_fp;
    _ds0.last_[35] = v_freq;
    _ds0.last_[36] = v_work_state;
    _ds0.last_[37] = v_bus_voltage;
    _ds0.last_[38] = v_daily_yield;
    _ds0.last_[39] = v_device_type;
    _ds0.last_[40] = v_output_type;
    _ds0.last_[41] = v_total_yield;
    _ds0.last_[42] = v_temp_interna;
    _ds0.last_[43] = v_nominal_power;
    _ds0.last_[44] = v_apparent_total;
    _ds0.last_[45] = v_pid_alarm_code;
    _ds0.last_[46] = v_pid_work_state;
    _ds0.last_[47] = v_potencia_ativa;
    _ds0.last_[48] = v_potencia_reativa;
    _ds0.last_[49] = v_potencia_aparente;
    _ds0.last_[50] = v_daily_running_time;
    _ds0.last_[51] = v_potencia_aparente2;
    _ds0.last_[52] = v_total_running_time;
    _ds0.last_[53] = v_insulation_resistance;
    _ds0.last_[54] = v_nominal_reactive_power;
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

    JsonObject g_info = d.createNestedObject("info");
    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(_ds0.last_[39])); g_info["device_type"] = String(_h); }
    g_info["output_type"] = _ds0.last_[40];
    g_info["nominal_power"] = _ds0.last_[43];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _ds0.last_[38];
    g_energy["total_yield"] = _ds0.last_[41];
    g_energy["Potencia Aparente1"] = _ds0.last_[49];
    g_energy["daily_running_time"] = _ds0.last_[50];
    g_energy["Potencia Aparente2"] = _ds0.last_[51];
    g_energy["total_running_time"] = _ds0.last_[52];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _ds0.last_[42];
    JsonObject g_dc = d.createNestedObject("dc");
    g_dc["mppt1_voltage"] = (float)(_ds0.sum_[6] / n);
    g_dc["mppt2_voltage"] = (float)(_ds0.sum_[7] / n);
    g_dc["mppt3_voltage"] = (float)(_ds0.sum_[8] / n);
    g_dc["mppt4_voltage"] = (float)(_ds0.sum_[9] / n);
    g_dc["mppt5_voltage"] = (float)(_ds0.sum_[10] / n);
    g_dc["mppt6_voltage"] = (float)(_ds0.sum_[11] / n);
    g_dc["mppt7_voltage"] = (float)(_ds0.sum_[12] / n);
    g_dc["mppt8_voltage"] = (float)(_ds0.sum_[13] / n);
    g_dc["mppt9_voltage"] = (float)(_ds0.sum_[14] / n);
    g_dc["total_power"] = (float)(_ds0.sum_[15] / n);
    g_dc["string1_current"] = (float)(_ds0.sum_[16] / n);
    g_dc["string2_current"] = (float)(_ds0.sum_[17] / n);
    g_dc["string3_current"] = (float)(_ds0.sum_[18] / n);
    g_dc["string4_current"] = (float)(_ds0.sum_[19] / n);
    g_dc["string5_current"] = (float)(_ds0.sum_[20] / n);
    g_dc["string6_current"] = (float)(_ds0.sum_[21] / n);
    g_dc["string7_current"] = (float)(_ds0.sum_[22] / n);
    g_dc["string8_current"] = (float)(_ds0.sum_[23] / n);
    g_dc["string9_current"] = (float)(_ds0.sum_[24] / n);
    g_dc["string10_current"] = (float)(_ds0.sum_[25] / n);
    g_dc["string11_current"] = (float)(_ds0.sum_[26] / n);
    g_dc["string12_current"] = (float)(_ds0.sum_[27] / n);
    g_dc["string13_current"] = (float)(_ds0.sum_[28] / n);
    g_dc["string14_current"] = (float)(_ds0.sum_[29] / n);
    g_dc["string15_current"] = (float)(_ds0.sum_[30] / n);
    g_dc["string16_current"] = (float)(_ds0.sum_[31] / n);
    g_dc["string17_current"] = (float)(_ds0.sum_[32] / n);
    g_dc["string18_current"] = (float)(_ds0.sum_[33] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_ds0.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_ds0.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_ds0.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_ds0.sum_[0] / n);
    g_current["phase_b"] = (float)(_ds0.sum_[1] / n);
    g_current["phase_c"] = (float)(_ds0.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _ds0.last_[34];
    g_power["frequency"] = _ds0.last_[35];
    g_power["apparent_total"] = _ds0.last_[44];
    g_power["active_total"] = _ds0.last_[47];
    g_power["reactive_total"] = _ds0.last_[48];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _ds0.last_[36];
    g_status["work_state_text"] = _work_state_text((uint16_t)_ds0.last_[36]);
    JsonObject g_protection = d.createNestedObject("protection");
    g_protection["bus_voltage"] = _ds0.last_[37];
    g_protection["insulation_resistance"] = _ds0.last_[53];
    JsonObject g_regulation = d.createNestedObject("regulation");
    g_regulation["nominal_reactive_power"] = _ds0.last_[54];
    JsonObject g_pid = d.createNestedObject("pid");
    g_pid["alarm_code"] = _ds0.last_[45];
    g_pid["work_state"] = _ds0.last_[46];

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
    for (int i = 0; i < 34; i++) _ds0.sum_[i] = 0;
    _ds0.samples = 0;
}

// =========================================================================
// Inversor (Sungrow SG75CX)
// Endereco Modbus: 2
// Modos: 34 avg, 21 last, 0 delta
// =========================================================================

struct _Dev1State {
    // Acumuladores (somas para media)
    double sum_[34];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[55];
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
    // Bloco 0: reg 4999, count 50, func 0x04 - Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status
    {
        uint8_t rc = _mb.readInputRegisters(4999, 50);
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
                rc = _mb.readInputRegisters(4999, 50);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 50; i++) buf[0 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 0 FAIL (reg=4999 count=50 rc=0x%02X)\n", rc);
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
    // Bloco 1: reg 5049, count 40, func 0x04 - Regs 5050-5089: regulation, insulation
    {
        uint8_t rc = _mb.readInputRegisters(5049, 40);
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
                rc = _mb.readInputRegisters(5049, 40);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 40; i++) buf[50 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 1 FAIL (reg=5049 count=40 rc=0x%02X)\n", rc);
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
    // Bloco 2: reg 5089, count 30, func 0x04 - Regs 5090-5119: tempo diario, MPPT 4-6
    {
        uint8_t rc = _mb.readInputRegisters(5089, 30);
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
                rc = _mb.readInputRegisters(5089, 30);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 30; i++) buf[90 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 2 FAIL (reg=5089 count=30 rc=0x%02X)\n", rc);
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
    // Bloco 3: reg 5119, count 35, func 0x04 - Regs 5120-5154: MPPT 7-9, bus voltage, PID
    {
        uint8_t rc = _mb.readInputRegisters(5119, 35);
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
                rc = _mb.readInputRegisters(5119, 35);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 35; i++) buf[120 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 3 FAIL (reg=5119 count=35 rc=0x%02X)\n", rc);
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
    // Bloco 4: reg 7012, count 18, func 0x04 - Regs 7013-7030: strings 1-18
    {
        uint8_t rc = _mb.readInputRegisters(7012, 18);
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
                rc = _mb.readInputRegisters(7012, 18);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 18; i++) buf[155 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_2 bloco 4 FAIL (reg=7012 count=18 rc=0x%02X)\n", rc);
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

    uint16_t buf[173];
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

    float v_ia = (float)buf[22] / 10.0;
    _ds1.sum_[0] += v_ia;
    float v_ib = (float)buf[23] / 10.0;
    _ds1.sum_[1] += v_ib;
    float v_ic = (float)buf[24] / 10.0;
    _ds1.sum_[2] += v_ic;
    float v_vab = (float)buf[19] / 10.0;
    _ds1.sum_[3] += v_vab;
    float v_vbc = (float)buf[20] / 10.0;
    _ds1.sum_[4] += v_vbc;
    float v_vca = (float)buf[21] / 10.0;
    _ds1.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)buf[11] / 10.0;
    _ds1.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)buf[13] / 10.0;
    _ds1.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)buf[15] / 10.0;
    _ds1.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)buf[115] / 10.0;
    _ds1.sum_[9] += v_mppt4_voltage;
    float v_mppt5_voltage = (float)buf[117] / 10.0;
    _ds1.sum_[10] += v_mppt5_voltage;
    float v_mppt6_voltage = (float)buf[119] / 10.0;
    _ds1.sum_[11] += v_mppt6_voltage;
    float v_mppt7_voltage = (float)buf[121] / 10.0;
    _ds1.sum_[12] += v_mppt7_voltage;
    float v_mppt8_voltage = (float)buf[123] / 10.0;
    _ds1.sum_[13] += v_mppt8_voltage;
    float v_mppt9_voltage = (float)buf[130] / 10.0;
    _ds1.sum_[14] += v_mppt9_voltage;
    float v_dc_total_power = (float)(((uint32_t)buf[17+1] << 16) | buf[17]);
    _ds1.sum_[15] += v_dc_total_power;
    float v_string1_current = (float)buf[155] / 100.0;
    _ds1.sum_[16] += v_string1_current;
    float v_string2_current = (float)buf[156] / 100.0;
    _ds1.sum_[17] += v_string2_current;
    float v_string3_current = (float)buf[157] / 100.0;
    _ds1.sum_[18] += v_string3_current;
    float v_string4_current = (float)buf[158] / 100.0;
    _ds1.sum_[19] += v_string4_current;
    float v_string5_current = (float)buf[159] / 100.0;
    _ds1.sum_[20] += v_string5_current;
    float v_string6_current = (float)buf[160] / 100.0;
    _ds1.sum_[21] += v_string6_current;
    float v_string7_current = (float)buf[161] / 100.0;
    _ds1.sum_[22] += v_string7_current;
    float v_string8_current = (float)buf[162] / 100.0;
    _ds1.sum_[23] += v_string8_current;
    float v_string9_current = (float)buf[163] / 100.0;
    _ds1.sum_[24] += v_string9_current;
    float v_string10_current = (float)buf[164] / 100.0;
    _ds1.sum_[25] += v_string10_current;
    float v_string11_current = (float)buf[165] / 100.0;
    _ds1.sum_[26] += v_string11_current;
    float v_string12_current = (float)buf[166] / 100.0;
    _ds1.sum_[27] += v_string12_current;
    float v_string13_current = (float)buf[167] / 100.0;
    _ds1.sum_[28] += v_string13_current;
    float v_string14_current = (float)buf[168] / 100.0;
    _ds1.sum_[29] += v_string14_current;
    float v_string15_current = (float)buf[169] / 100.0;
    _ds1.sum_[30] += v_string15_current;
    float v_string16_current = (float)buf[170] / 100.0;
    _ds1.sum_[31] += v_string16_current;
    float v_string17_current = (float)buf[171] / 100.0;
    _ds1.sum_[32] += v_string17_current;
    float v_string18_current = (float)buf[172] / 100.0;
    _ds1.sum_[33] += v_string18_current;
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
    _ds1.last_[16] = v_string1_current;
    _ds1.last_[17] = v_string2_current;
    _ds1.last_[18] = v_string3_current;
    _ds1.last_[19] = v_string4_current;
    _ds1.last_[20] = v_string5_current;
    _ds1.last_[21] = v_string6_current;
    _ds1.last_[22] = v_string7_current;
    _ds1.last_[23] = v_string8_current;
    _ds1.last_[24] = v_string9_current;
    _ds1.last_[25] = v_string10_current;
    _ds1.last_[26] = v_string11_current;
    _ds1.last_[27] = v_string12_current;
    _ds1.last_[28] = v_string13_current;
    _ds1.last_[29] = v_string14_current;
    _ds1.last_[30] = v_string15_current;
    _ds1.last_[31] = v_string16_current;
    _ds1.last_[32] = v_string17_current;
    _ds1.last_[33] = v_string18_current;
    _ds1.last_[34] = v_fp;
    _ds1.last_[35] = v_freq;
    _ds1.last_[36] = v_work_state;
    _ds1.last_[37] = v_bus_voltage;
    _ds1.last_[38] = v_daily_yield;
    _ds1.last_[39] = v_device_type;
    _ds1.last_[40] = v_output_type;
    _ds1.last_[41] = v_total_yield;
    _ds1.last_[42] = v_temp_interna;
    _ds1.last_[43] = v_nominal_power;
    _ds1.last_[44] = v_apparent_total;
    _ds1.last_[45] = v_pid_alarm_code;
    _ds1.last_[46] = v_pid_work_state;
    _ds1.last_[47] = v_potencia_ativa;
    _ds1.last_[48] = v_potencia_reativa;
    _ds1.last_[49] = v_potencia_aparente;
    _ds1.last_[50] = v_daily_running_time;
    _ds1.last_[51] = v_potencia_aparente2;
    _ds1.last_[52] = v_total_running_time;
    _ds1.last_[53] = v_insulation_resistance;
    _ds1.last_[54] = v_nominal_reactive_power;
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
    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(_ds1.last_[39])); g_info["device_type"] = String(_h); }
    g_info["output_type"] = _ds1.last_[40];
    g_info["nominal_power"] = _ds1.last_[43];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _ds1.last_[38];
    g_energy["total_yield"] = _ds1.last_[41];
    g_energy["Potencia Aparente1"] = _ds1.last_[49];
    g_energy["daily_running_time"] = _ds1.last_[50];
    g_energy["Potencia Aparente2"] = _ds1.last_[51];
    g_energy["total_running_time"] = _ds1.last_[52];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _ds1.last_[42];
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
    g_dc["string1_current"] = (float)(_ds1.sum_[16] / n);
    g_dc["string2_current"] = (float)(_ds1.sum_[17] / n);
    g_dc["string3_current"] = (float)(_ds1.sum_[18] / n);
    g_dc["string4_current"] = (float)(_ds1.sum_[19] / n);
    g_dc["string5_current"] = (float)(_ds1.sum_[20] / n);
    g_dc["string6_current"] = (float)(_ds1.sum_[21] / n);
    g_dc["string7_current"] = (float)(_ds1.sum_[22] / n);
    g_dc["string8_current"] = (float)(_ds1.sum_[23] / n);
    g_dc["string9_current"] = (float)(_ds1.sum_[24] / n);
    g_dc["string10_current"] = (float)(_ds1.sum_[25] / n);
    g_dc["string11_current"] = (float)(_ds1.sum_[26] / n);
    g_dc["string12_current"] = (float)(_ds1.sum_[27] / n);
    g_dc["string13_current"] = (float)(_ds1.sum_[28] / n);
    g_dc["string14_current"] = (float)(_ds1.sum_[29] / n);
    g_dc["string15_current"] = (float)(_ds1.sum_[30] / n);
    g_dc["string16_current"] = (float)(_ds1.sum_[31] / n);
    g_dc["string17_current"] = (float)(_ds1.sum_[32] / n);
    g_dc["string18_current"] = (float)(_ds1.sum_[33] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_ds1.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_ds1.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_ds1.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_ds1.sum_[0] / n);
    g_current["phase_b"] = (float)(_ds1.sum_[1] / n);
    g_current["phase_c"] = (float)(_ds1.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _ds1.last_[34];
    g_power["frequency"] = _ds1.last_[35];
    g_power["apparent_total"] = _ds1.last_[44];
    g_power["active_total"] = _ds1.last_[47];
    g_power["reactive_total"] = _ds1.last_[48];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _ds1.last_[36];
    g_status["work_state_text"] = _work_state_text((uint16_t)_ds1.last_[36]);
    JsonObject g_protection = d.createNestedObject("protection");
    g_protection["bus_voltage"] = _ds1.last_[37];
    g_protection["insulation_resistance"] = _ds1.last_[53];
    JsonObject g_regulation = d.createNestedObject("regulation");
    g_regulation["nominal_reactive_power"] = _ds1.last_[54];
    JsonObject g_pid = d.createNestedObject("pid");
    g_pid["alarm_code"] = _ds1.last_[45];
    g_pid["work_state"] = _ds1.last_[46];

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
    for (int i = 0; i < 34; i++) _ds1.sum_[i] = 0;
    _ds1.samples = 0;
}

// =========================================================================
// Inversor (Sungrow SG110CX)
// Endereco Modbus: 3
// Modos: 34 avg, 21 last, 0 delta
// =========================================================================

struct _Dev2State {
    // Acumuladores (somas para media)
    double sum_[34];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[55];
    // Primeira amostra de delta (snapshot no inicio do ciclo)
    float first_delta_[1];
    bool has_first_delta;
    // Estados BI da ultima leitura
    uint8_t bi_[1];
    bool valid;
    int fail_streak;            // leituras consecutivas falhas
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
};
static _Dev2State _ds2 = {};

static bool _read_dev_2_raw(uint16_t *buf) {
    _select(3);
    // Bloco 0: reg 4999, count 50, func 0x04 - Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status
    {
        uint8_t rc = _mb.readInputRegisters(4999, 50);
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
            if (_ds2.fail_streak == 0) {
                rc = _mb.readInputRegisters(4999, 50);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 50; i++) buf[0 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_3 bloco 0 FAIL (reg=4999 count=50 rc=0x%02X)\n", rc);
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
    // Bloco 1: reg 5049, count 40, func 0x04 - Regs 5050-5089: regulation, insulation
    {
        uint8_t rc = _mb.readInputRegisters(5049, 40);
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
            if (_ds2.fail_streak == 0) {
                rc = _mb.readInputRegisters(5049, 40);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 40; i++) buf[50 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_3 bloco 1 FAIL (reg=5049 count=40 rc=0x%02X)\n", rc);
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
    // Bloco 2: reg 5089, count 30, func 0x04 - Regs 5090-5119: tempo diario, MPPT 4-6
    {
        uint8_t rc = _mb.readInputRegisters(5089, 30);
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
            if (_ds2.fail_streak == 0) {
                rc = _mb.readInputRegisters(5089, 30);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 30; i++) buf[90 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_3 bloco 2 FAIL (reg=5089 count=30 rc=0x%02X)\n", rc);
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
    // Bloco 3: reg 5119, count 35, func 0x04 - Regs 5120-5154: MPPT 7-9, bus voltage, PID
    {
        uint8_t rc = _mb.readInputRegisters(5119, 35);
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
            if (_ds2.fail_streak == 0) {
                rc = _mb.readInputRegisters(5119, 35);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 35; i++) buf[120 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_3 bloco 3 FAIL (reg=5119 count=35 rc=0x%02X)\n", rc);
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
    // Bloco 4: reg 7012, count 18, func 0x04 - Regs 7013-7030: strings 1-18
    {
        uint8_t rc = _mb.readInputRegisters(7012, 18);
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
            if (_ds2.fail_streak == 0) {
                rc = _mb.readInputRegisters(7012, 18);
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < 18; i++) buf[155 + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] Inversor_3 bloco 4 FAIL (reg=7012 count=18 rc=0x%02X)\n", rc);
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
static void _sample_dev_2() {
    // Back-off: device que falhou MODBUS_FAIL_COOLDOWN_N vezes fica em cooldown.
    // Pula a leitura (que bloquearia o loop no timeout) ate o cooldown expirar.
    if (_ds2.cooldown_until && (long)(millis() - _ds2.cooldown_until) < 0) return;

    uint16_t buf[173];
    if (!_read_dev_2_raw(buf)) {
        _ds2.fail_streak++;
        Serial.printf("[MB] Inversor_3: falha leitura (consecutivas: %d)\n", _ds2.fail_streak);
        if (_ds2.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _ds2.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_ds2.cooldown_until == 0) _ds2.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[MB] Inversor_3: cooldown %lus (nao responde) — loop liberado p/ LoRa/cmd\n",
                          (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    diag_last_successful_read_ms = millis();
    _ds2.cooldown_until = 0;
    if (_ds2.fail_streak > 0) {
        Serial.printf("[MB] Inversor_3: OK (apos %d falhas consecutivas)\n", _ds2.fail_streak);
        _ds2.fail_streak = 0;
    }

    float v_ia = (float)buf[22] / 10.0;
    _ds2.sum_[0] += v_ia;
    float v_ib = (float)buf[23] / 10.0;
    _ds2.sum_[1] += v_ib;
    float v_ic = (float)buf[24] / 10.0;
    _ds2.sum_[2] += v_ic;
    float v_vab = (float)buf[19] / 10.0;
    _ds2.sum_[3] += v_vab;
    float v_vbc = (float)buf[20] / 10.0;
    _ds2.sum_[4] += v_vbc;
    float v_vca = (float)buf[21] / 10.0;
    _ds2.sum_[5] += v_vca;
    float v_mppt1_voltage = (float)buf[11] / 10.0;
    _ds2.sum_[6] += v_mppt1_voltage;
    float v_mppt2_voltage = (float)buf[13] / 10.0;
    _ds2.sum_[7] += v_mppt2_voltage;
    float v_mppt3_voltage = (float)buf[15] / 10.0;
    _ds2.sum_[8] += v_mppt3_voltage;
    float v_mppt4_voltage = (float)buf[115] / 10.0;
    _ds2.sum_[9] += v_mppt4_voltage;
    float v_mppt5_voltage = (float)buf[117] / 10.0;
    _ds2.sum_[10] += v_mppt5_voltage;
    float v_mppt6_voltage = (float)buf[119] / 10.0;
    _ds2.sum_[11] += v_mppt6_voltage;
    float v_mppt7_voltage = (float)buf[121] / 10.0;
    _ds2.sum_[12] += v_mppt7_voltage;
    float v_mppt8_voltage = (float)buf[123] / 10.0;
    _ds2.sum_[13] += v_mppt8_voltage;
    float v_mppt9_voltage = (float)buf[130] / 10.0;
    _ds2.sum_[14] += v_mppt9_voltage;
    float v_dc_total_power = (float)(((uint32_t)buf[17+1] << 16) | buf[17]);
    _ds2.sum_[15] += v_dc_total_power;
    float v_string1_current = (float)buf[155] / 100.0;
    _ds2.sum_[16] += v_string1_current;
    float v_string2_current = (float)buf[156] / 100.0;
    _ds2.sum_[17] += v_string2_current;
    float v_string3_current = (float)buf[157] / 100.0;
    _ds2.sum_[18] += v_string3_current;
    float v_string4_current = (float)buf[158] / 100.0;
    _ds2.sum_[19] += v_string4_current;
    float v_string5_current = (float)buf[159] / 100.0;
    _ds2.sum_[20] += v_string5_current;
    float v_string6_current = (float)buf[160] / 100.0;
    _ds2.sum_[21] += v_string6_current;
    float v_string7_current = (float)buf[161] / 100.0;
    _ds2.sum_[22] += v_string7_current;
    float v_string8_current = (float)buf[162] / 100.0;
    _ds2.sum_[23] += v_string8_current;
    float v_string9_current = (float)buf[163] / 100.0;
    _ds2.sum_[24] += v_string9_current;
    float v_string10_current = (float)buf[164] / 100.0;
    _ds2.sum_[25] += v_string10_current;
    float v_string11_current = (float)buf[165] / 100.0;
    _ds2.sum_[26] += v_string11_current;
    float v_string12_current = (float)buf[166] / 100.0;
    _ds2.sum_[27] += v_string12_current;
    float v_string13_current = (float)buf[167] / 100.0;
    _ds2.sum_[28] += v_string13_current;
    float v_string14_current = (float)buf[168] / 100.0;
    _ds2.sum_[29] += v_string14_current;
    float v_string15_current = (float)buf[169] / 100.0;
    _ds2.sum_[30] += v_string15_current;
    float v_string16_current = (float)buf[170] / 100.0;
    _ds2.sum_[31] += v_string16_current;
    float v_string17_current = (float)buf[171] / 100.0;
    _ds2.sum_[32] += v_string17_current;
    float v_string18_current = (float)buf[172] / 100.0;
    _ds2.sum_[33] += v_string18_current;
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
    _ds2.last_[0] = v_ia;
    _ds2.last_[1] = v_ib;
    _ds2.last_[2] = v_ic;
    _ds2.last_[3] = v_vab;
    _ds2.last_[4] = v_vbc;
    _ds2.last_[5] = v_vca;
    _ds2.last_[6] = v_mppt1_voltage;
    _ds2.last_[7] = v_mppt2_voltage;
    _ds2.last_[8] = v_mppt3_voltage;
    _ds2.last_[9] = v_mppt4_voltage;
    _ds2.last_[10] = v_mppt5_voltage;
    _ds2.last_[11] = v_mppt6_voltage;
    _ds2.last_[12] = v_mppt7_voltage;
    _ds2.last_[13] = v_mppt8_voltage;
    _ds2.last_[14] = v_mppt9_voltage;
    _ds2.last_[15] = v_dc_total_power;
    _ds2.last_[16] = v_string1_current;
    _ds2.last_[17] = v_string2_current;
    _ds2.last_[18] = v_string3_current;
    _ds2.last_[19] = v_string4_current;
    _ds2.last_[20] = v_string5_current;
    _ds2.last_[21] = v_string6_current;
    _ds2.last_[22] = v_string7_current;
    _ds2.last_[23] = v_string8_current;
    _ds2.last_[24] = v_string9_current;
    _ds2.last_[25] = v_string10_current;
    _ds2.last_[26] = v_string11_current;
    _ds2.last_[27] = v_string12_current;
    _ds2.last_[28] = v_string13_current;
    _ds2.last_[29] = v_string14_current;
    _ds2.last_[30] = v_string15_current;
    _ds2.last_[31] = v_string16_current;
    _ds2.last_[32] = v_string17_current;
    _ds2.last_[33] = v_string18_current;
    _ds2.last_[34] = v_fp;
    _ds2.last_[35] = v_freq;
    _ds2.last_[36] = v_work_state;
    _ds2.last_[37] = v_bus_voltage;
    _ds2.last_[38] = v_daily_yield;
    _ds2.last_[39] = v_device_type;
    _ds2.last_[40] = v_output_type;
    _ds2.last_[41] = v_total_yield;
    _ds2.last_[42] = v_temp_interna;
    _ds2.last_[43] = v_nominal_power;
    _ds2.last_[44] = v_apparent_total;
    _ds2.last_[45] = v_pid_alarm_code;
    _ds2.last_[46] = v_pid_work_state;
    _ds2.last_[47] = v_potencia_ativa;
    _ds2.last_[48] = v_potencia_reativa;
    _ds2.last_[49] = v_potencia_aparente;
    _ds2.last_[50] = v_daily_running_time;
    _ds2.last_[51] = v_potencia_aparente2;
    _ds2.last_[52] = v_total_running_time;
    _ds2.last_[53] = v_insulation_resistance;
    _ds2.last_[54] = v_nominal_reactive_power;
    _ds2.samples++;
    // Log de debug — mostra principais valores lidos
    Serial.printf("[MB] Inversor_3 #%d: ", _ds2.samples);
    Serial.printf("vab=%.2f ", v_vab);
    Serial.printf("vbc=%.2f ", v_vbc);
    Serial.printf("vca=%.2f ", v_vca);
    Serial.printf("ia=%.2f ", v_ia);
    Serial.printf("ib=%.2f ", v_ib);
    Serial.printf("ic=%.2f", v_ic);
    Serial.println();
    _ds2.valid = true;
}

// Publica JSON (medias + last + delta) e reseta acumuladores. Chamar a cada PUBLISH_INTERVAL_MS.
static void _publish_dev_2(modbus_publish_fn publish) {
    if (!_ds2.valid || _ds2.samples == 0) {
        publish("Inversor_3/status", "{\"error\":\"no_samples\"}");
        return;
    }

    int n = _ds2.samples;
    // JSON na heap (nao na stack). loopTask tem 8KB de stack; alocar 3KB+3KB
    // aqui (doc + payload) causava Panic em ~200s no projeto Chimarrao com
    // Power_Meter + 2 inversores. Heap fica em ~280KB livres.
    DynamicJsonDocument d(3072);
    d["timestamp"] = (long)time(nullptr);
    d["inverter_id"] = 3;
    d["samples"] = n;

    JsonObject g_info = d.createNestedObject("info");
    { char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(_ds2.last_[39])); g_info["device_type"] = String(_h); }
    g_info["output_type"] = _ds2.last_[40];
    g_info["nominal_power"] = _ds2.last_[43];
    JsonObject g_energy = d.createNestedObject("energy");
    g_energy["daily_yield"] = _ds2.last_[38];
    g_energy["total_yield"] = _ds2.last_[41];
    g_energy["Potencia Aparente1"] = _ds2.last_[49];
    g_energy["daily_running_time"] = _ds2.last_[50];
    g_energy["Potencia Aparente2"] = _ds2.last_[51];
    g_energy["total_running_time"] = _ds2.last_[52];
    JsonObject g_temperature = d.createNestedObject("temperature");
    g_temperature["internal"] = _ds2.last_[42];
    JsonObject g_dc = d.createNestedObject("dc");
    g_dc["mppt1_voltage"] = (float)(_ds2.sum_[6] / n);
    g_dc["mppt2_voltage"] = (float)(_ds2.sum_[7] / n);
    g_dc["mppt3_voltage"] = (float)(_ds2.sum_[8] / n);
    g_dc["mppt4_voltage"] = (float)(_ds2.sum_[9] / n);
    g_dc["mppt5_voltage"] = (float)(_ds2.sum_[10] / n);
    g_dc["mppt6_voltage"] = (float)(_ds2.sum_[11] / n);
    g_dc["mppt7_voltage"] = (float)(_ds2.sum_[12] / n);
    g_dc["mppt8_voltage"] = (float)(_ds2.sum_[13] / n);
    g_dc["mppt9_voltage"] = (float)(_ds2.sum_[14] / n);
    g_dc["total_power"] = (float)(_ds2.sum_[15] / n);
    g_dc["string1_current"] = (float)(_ds2.sum_[16] / n);
    g_dc["string2_current"] = (float)(_ds2.sum_[17] / n);
    g_dc["string3_current"] = (float)(_ds2.sum_[18] / n);
    g_dc["string4_current"] = (float)(_ds2.sum_[19] / n);
    g_dc["string5_current"] = (float)(_ds2.sum_[20] / n);
    g_dc["string6_current"] = (float)(_ds2.sum_[21] / n);
    g_dc["string7_current"] = (float)(_ds2.sum_[22] / n);
    g_dc["string8_current"] = (float)(_ds2.sum_[23] / n);
    g_dc["string9_current"] = (float)(_ds2.sum_[24] / n);
    g_dc["string10_current"] = (float)(_ds2.sum_[25] / n);
    g_dc["string11_current"] = (float)(_ds2.sum_[26] / n);
    g_dc["string12_current"] = (float)(_ds2.sum_[27] / n);
    g_dc["string13_current"] = (float)(_ds2.sum_[28] / n);
    g_dc["string14_current"] = (float)(_ds2.sum_[29] / n);
    g_dc["string15_current"] = (float)(_ds2.sum_[30] / n);
    g_dc["string16_current"] = (float)(_ds2.sum_[31] / n);
    g_dc["string17_current"] = (float)(_ds2.sum_[32] / n);
    g_dc["string18_current"] = (float)(_ds2.sum_[33] / n);
    JsonObject g_voltage = d.createNestedObject("voltage");
    g_voltage["phase_a-b"] = (float)(_ds2.sum_[3] / n);
    g_voltage["phase_b-c"] = (float)(_ds2.sum_[4] / n);
    g_voltage["phase_c-a"] = (float)(_ds2.sum_[5] / n);
    JsonObject g_current = d.createNestedObject("current");
    g_current["phase_a"] = (float)(_ds2.sum_[0] / n);
    g_current["phase_b"] = (float)(_ds2.sum_[1] / n);
    g_current["phase_c"] = (float)(_ds2.sum_[2] / n);
    JsonObject g_power = d.createNestedObject("power");
    g_power["power_factor"] = _ds2.last_[34];
    g_power["frequency"] = _ds2.last_[35];
    g_power["apparent_total"] = _ds2.last_[44];
    g_power["active_total"] = _ds2.last_[47];
    g_power["reactive_total"] = _ds2.last_[48];
    JsonObject g_status = d.createNestedObject("status");
    g_status["work_state"] = _ds2.last_[36];
    g_status["work_state_text"] = _work_state_text((uint16_t)_ds2.last_[36]);
    JsonObject g_protection = d.createNestedObject("protection");
    g_protection["bus_voltage"] = _ds2.last_[37];
    g_protection["insulation_resistance"] = _ds2.last_[53];
    JsonObject g_regulation = d.createNestedObject("regulation");
    g_regulation["nominal_reactive_power"] = _ds2.last_[54];
    JsonObject g_pid = d.createNestedObject("pid");
    g_pid["alarm_code"] = _ds2.last_[45];
    g_pid["work_state"] = _ds2.last_[46];

    // Payload na heap — mesma razao do JSON doc acima.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[RS485] malloc payload falhou — pulando publish");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("Inversor_3/data", payload);
        Serial.printf("\n===== PUBLICADO: Inversor_3 (%d amostras) =====\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
    for (int i = 0; i < 34; i++) _ds2.sum_[i] = 0;
    _ds2.samples = 0;
}

static int _rr_idx = 0;
static const int _dev_count = 3;

void modbus_sample_one() {
    switch (_rr_idx) {
        case 0: _sample_dev_0(); break;
        case 1: _sample_dev_1(); break;
        case 2: _sample_dev_2(); break;
    }
    _rr_idx = (_rr_idx + 1) % _dev_count;
}

void modbus_publish_all(modbus_publish_fn publish) {
    if (!publish) return;
    _publish_dev_0(publish);
    _publish_dev_1(publish);
    _publish_dev_2(publish);
}

// Legado: sample todos + publica (sem media)
void modbus_read_all(modbus_publish_fn publish) {
    if (!publish) return;
    _sample_dev_0();
    _publish_dev_0(publish);
    _sample_dev_1();
    _publish_dev_1(publish);
    _sample_dev_2();
    _publish_dev_2(publish);
}

// SOE: drena a fila de eventos de cada device que tem buffer no catalogo.
void modbus_events_poll(modbus_publish_fn publish) {
    if (!publish) return;
}

bool modbus_exec_command(const char* device_name, const char* cmd_id) {
    if (!device_name || !cmd_id) return false;
    return false;
}
