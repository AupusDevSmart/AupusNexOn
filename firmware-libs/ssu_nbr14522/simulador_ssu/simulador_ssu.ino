// ============================================================================
// SIMULADOR DE SSU (ABNT NBR 14522) — roda num ESP32 qualquer e "finge" o medidor
// da concessionaria: transmite blocos ESTENDIDOS (9 octetos, CRC-16) ou NORMAIS
// (8 octetos, LRC) a 110 baud, 1 bloco por segundo, na convencao da norma:
// contagem regressiva do intervalo de demanda, contadores acumulando desde o
// inicio do intervalo, bloco de fechamento repetido 3x, quadrante mudando no
// "amanhecer/entardecer", bits 4/5 alternando, wrap do contador, e (opcional)
// blocos corrompidos pra testar a rejeicao.
//
// Ligacao ao TON-V2: TX deste ESP DIRETO em X14-2 (SU+) e GND comum em X14-1.
// NAO usar resistor em serie: o IO48 da TON tem pull-up de 680R p/ 3V3, entao
// qualquer serie forma divisor no nivel baixo (1k -> 3,3*1000/1680 = 1,96 V, acima
// do VIL de 0,8 V — a TON nunca veria o 0). O TX push-pull a 3V3 drena os 4,9 mA
// do pull-up sem problema (max ~100R se quiser algum limitador). Fidelidade total
// (coletor aberto como o medidor): NPN com o TX invertido, coletor no SU+.
//
// Comandos pelo monitor serial (115200): n=normal  e=estendido  q1..q4=quadrante
// w=forca wrap (contador em 65500)  c=proximo bloco corrompido  x=trava 15 min
// f=fechamento agora  ?=status
// ============================================================================
#include <Arduino.h>

#define PIN_TX        17        // GPIO com a saida a 110 baud (UART1 TX)
#define INTERVALO_S   900       // intervalo de demanda (15 min)
#define PULSOS_KW     2.0f      // pulsos/s por... simplificado: pulsos por segundo na ativa
#define PULSOS_KVAR   0.5f

HardwareSerial SSU(1);

static bool estendido = true;
static uint16_t segundos = INTERVALO_S - 1;
static uint16_t regAtiva = 0, regReativa = 0;   // contadores do intervalo (desde o inicio)
static uint8_t  quadrante = 1;                  // 1..4
static uint8_t  postoHorario = 2;               // 1 ponta, 2 fora
static uint8_t  postoReativo = 2;               // 2 indutivo
static bool     bit4 = false, bit5 = false;     // alternam
static uint16_t fechamentosRestantes = 0;       // 3 repeticoes do bloco de fechamento
static bool     corromperProximo = false;
static uint32_t blocos = 0;
static float    acA = 0, acR = 0;

static uint16_t crc16(const uint8_t* d, size_t n) {
    uint16_t crc = 0;
    for (size_t i = 0; i < n; i++) { crc ^= d[i]; for (uint8_t b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1); }
    return crc;
}
static uint8_t lrc(const uint8_t* d, size_t n) { uint8_t v = 0; for (size_t i = 0; i < n; i++) v ^= d[i]; return (uint8_t)~v; }

// bits 4-5 do octeto 3 pelo quadrante (tabela NAO sequencial da norma: 00=Q1 01=Q4 10=Q2 11=Q3)
static uint8_t quadBits(uint8_t q) { switch (q) { case 1: return 0x00; case 4: return 0x10; case 2: return 0x20; default: return 0x30; } }

static void montar(uint8_t* out, size_t& n) {
    out[0] = segundos & 0xFF;
    out[1] = (uint8_t)(((segundos >> 8) & 0x0F) | (bit4 ? 0x10 : 0) | (bit5 ? 0x20 : 0) | ((postoReativo & 3) << 6));
    if (estendido) {
        out[2] = (uint8_t)((postoHorario & 3) | quadBits(quadrante) | 0x80);
        out[3] = regAtiva & 0xFF; out[4] = regAtiva >> 8;
        out[5] = regReativa & 0xFF; out[6] = regReativa >> 8;
        uint16_t c = crc16(out, 7); out[7] = c & 0xFF; out[8] = c >> 8; n = 9;
    } else {
        out[2] = (uint8_t)((postoHorario & 0x0F) | (1 << 4));          // segmento + tarifa verde
        out[3] = regAtiva & 0xFF; out[4] = (regAtiva >> 8) & 0x7F;      // 15 bits
        out[5] = regReativa & 0xFF; out[6] = (regReativa >> 8) & 0x7F;
        out[7] = lrc(out, 7); n = 8;
    }
    if (corromperProximo) { out[4] ^= 0x01; corromperProximo = false; }
}

static void enviar() {
    uint8_t b[9]; size_t n = 0;
    montar(b, n);
    SSU.write(b, n);                    // ~800 ms a 110 baud; o restante do segundo e' silencio
    blocos++;
    Serial.printf("[SIM] #%lu %s seg=%u Q%u A=%u R=%u |", (unsigned long)blocos, estendido ? "EXT" : "NRM", segundos, quadrante, regAtiva, regReativa);
    for (size_t i = 0; i < n; i++) Serial.printf(" %02x", b[i]);
    Serial.println();
}

void setup() {
    Serial.begin(115200);
    SSU.begin(110, SERIAL_8N1, -1, PIN_TX);
    Serial.printf("\n[SIM] Simulador de SSU NBR 14522 — 110 baud no GPIO %d\n", PIN_TX);
    Serial.println("[SIM] n=normal e=estendido q1..q4 w=wrap c=corromper f=fechar x=15min ?=status");
}

void loop() {
    static unsigned long ultimo = 0;
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n'); cmd.trim();
        if (cmd == "n") estendido = false;
        else if (cmd == "e") estendido = true;
        else if (cmd.startsWith("q") && cmd.length() == 2) quadrante = (uint8_t)constrain(cmd[1] - '0', 1, 4);
        else if (cmd == "w") { regAtiva = 65500; regReativa = 65500; }
        else if (cmd == "c") corromperProximo = true;
        else if (cmd == "f") segundos = 0;
        else if (cmd == "x") segundos = INTERVALO_S - 1;
        else if (cmd == "?") Serial.printf("[SIM] fmt=%s seg=%u Q%u A=%u R=%u bit4=%d bit5=%d\n", estendido ? "EXT" : "NRM", segundos, quadrante, regAtiva, regReativa, bit4, bit5);
        Serial.printf("[SIM] cmd '%s' ok\n", cmd.c_str());
    }
    if (millis() - ultimo < 1000) return;
    ultimo = millis();

    if (fechamentosRestantes > 0) {          // bloco de fechamento repetido (dados identicos)
        enviar();
        if (--fechamentosRestantes == 0) {   // intervalo novo: contadores reiniciam
            segundos = INTERVALO_S - 1; regAtiva = 0; regReativa = 0; acA = acR = 0;
            static uint8_t viradas = 0;
            if (++viradas % 4 == 0) bit5 = !bit5;   // reativo de 1 h = 1 transicao a cada 4 intervalos
            if (viradas % 96 == 0) bit4 = !bit4;    // "fatura" a cada 24 h simuladas
        }
        return;
    }

    // energia "medida" neste segundo (perfil simples; troque por sin() se quiser um dia solar)
    acA += PULSOS_KW; acR += PULSOS_KVAR;
    regAtiva  = (uint16_t)(regAtiva  + (uint16_t)acA); acA -= (uint16_t)acA;   // wrap natural em uint16
    regReativa = (uint16_t)(regReativa + (uint16_t)acR); acR -= (uint16_t)acR;

    enviar();
    if (segundos == 0) { fechamentosRestantes = 2; return; }   // ja enviou 1; repete mais 2 (total 3)
    segundos--;
}
