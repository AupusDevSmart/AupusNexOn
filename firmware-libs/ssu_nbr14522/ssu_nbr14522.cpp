// ssu_nbr14522.cpp — ver ssu_nbr14522.h. Implementa a spec interna "Firmware de
// leitura da SSU" (ABNT NBR 14522:2008, 3.4.1 / 3.4.2). C++ puro.
#include "ssu_nbr14522.h"
#include <string.h>

namespace ssu {

const uint8_t QUADRANTE[4] = { 1, 4, 2, 3 };   // 0b00->Q1, 0b01->Q4, 0b10->Q2, 0b11->Q3

// ---------------------------------------------------------------- checksums
uint8_t lrc(const uint8_t* d, size_t n) {
    uint8_t v = 0;
    for (size_t i = 0; i < n; i++) v ^= d[i];
    return (uint8_t)(~v);
}

uint16_t crc16(const uint8_t* d, size_t n) {
    uint16_t crc = 0;
    for (size_t i = 0; i < n; i++) {
        crc ^= d[i];
        for (uint8_t b = 0; b < 8; b++)
            crc = (crc & 1) ? (uint16_t)((crc >> 1) ^ 0xA001) : (uint16_t)(crc >> 1);
    }
    return crc;
}

// ------------------------------------------------------------ decodificacao
static void _limpar(Resultado& r) { memset(&r, 0, sizeof(r)); }

bool decodificarNormal(const uint8_t* d, Resultado& r) {
    _limpar(r);
    memcpy(r.raw, d, 8); r.rawLen = 8;
    if (lrc(d, 7) != d[7]) return false;
    r.valido   = true;
    r.formato  = FMT_NORMAL;
    r.segundos = (uint16_t)(d[0] | ((d[1] & 0x0F) << 8));
    // octeto 2 bits 6-7: pulsos capacitivos/indutivos computados p/ UFER/DMCR
    r.postoReativo    = (uint8_t)((d[1] >> 6) & 0x03);
    // octeto 3 (layout INCOMPATIVEL com o estendido): 4 bits de segmento + tipo de tarifa
    r.segmentoHorario = (uint8_t)(d[2] & 0x0F);
    r.tipoTarifa      = (uint8_t)((d[2] >> 4) & 0x03);
    r.quadrante       = 0;                        // NAO existe quadrante no bloco normal
    // contadores de 15 bits (bit 7 do MSB nao usado)
    r.pulsosAtiva   = (uint16_t)(d[3] | ((d[4] & 0x7F) << 8));
    r.pulsosReativa = (uint16_t)(d[5] | ((d[6] & 0x7F) << 8));
    r.regAtiva   = 1;                             // sem sentido de fluxo: ativa -> REG1
    r.regReativa = 3;                             // reativa -> REG3
    return true;
}

bool decodificarEstendido(const uint8_t* d, Resultado& r) {
    _limpar(r);
    memcpy(r.raw, d, 9); r.rawLen = 9;
    uint16_t crcRx = (uint16_t)(d[7] | (d[8] << 8));   // LSB primeiro
    if (crc16(d, 7) != crcRx) return false;
    r.valido   = true;
    r.formato  = FMT_ESTENDIDO;
    r.segundos = (uint16_t)(d[0] | ((d[1] & 0x0F) << 8));
    // octeto 2, nibble alto: bit4 reposicao (alterna), bit5 fim reativo (alterna), bits6-7 posto reativo
    r.postoReativo   = (uint8_t)((d[1] >> 6) & 0x03);
    // octeto 3: bits 0-1 posto horario, 2-3 reservados (mascarados), 4-5 quadrante (tabela), 7 tarifacao reativo
    r.postoHorario   = (uint8_t)(d[2] & 0x03);
    r.quadrante      = QUADRANTE[(d[2] >> 4) & 0x03];
    r.tarifaReativos = (d[2] & 0x80) != 0;
    r.pulsosAtiva    = (uint16_t)(d[3] | (d[4] << 8));
    r.pulsosReativa  = (uint16_t)(d[5] | (d[6] << 8));
    // Q1 -> REG1+REG3 ; Q2 -> REG2+REG4 ; Q3 -> REG2+REG5 ; Q4 -> REG1+REG6
    static const uint8_t REG_R[5] = { 0, 3, 4, 5, 6 };
    r.regAtiva   = (r.quadrante == 1 || r.quadrante == 4) ? 1 : 2;
    r.regReativa = REG_R[r.quadrante];
    return true;
}

// ---------------------------------------------------------------- Leitor
Leitor::Leitor() { reset(); }

void Leitor::reset() {
    memset(_buf, 0, sizeof(_buf)); _len = 0; _ultimoByteMs = 0; _temByte = false;
    _fmtEsperado = FMT_DESCONHECIDO; _votoFmt = FMT_DESCONHECIDO; _votos = 0;
    memset(_ultimo, 0, sizeof(_ultimo)); memset(_visto, 0, sizeof(_visto));
    _temAnterior = false; _antSegundos = _antPA = _antPR = 0;
    _temBits = false; _antBit4 = _antBit5 = 0;
    memset(&_st, 0, sizeof(_st));
}

void Leitor::travarFormato(Formato f) { _st.formato = (uint8_t)f; _votoFmt = FMT_DESCONHECIDO; _votos = 0; }

bool Leitor::alimentarByte(uint8_t b, uint32_t agora_ms, Resultado& out) {
    bool fechou = false;
    // gap > GAP_MS => o byte que chegou e' o octeto 1 de um bloco novo: fecha o anterior
    if (_temByte && (uint32_t)(agora_ms - _ultimoByteMs) > GAP_MS && _len > 0) {
        fechou = _processar(_buf, _len, out);
        _len = 0;
    }
    _ultimoByteMs = agora_ms; _temByte = true;
    if (_len < MAX_BLOCO) _buf[_len++] = b;
    else { _erro(); _len = 0; }   // lixo continuo sem gap: descarta
    return fechou;
}

bool Leitor::fecharBloco(Resultado& out) {
    if (_len == 0) return false;
    bool ok = _processar(_buf, _len, out);
    _len = 0;
    return ok;
}

bool Leitor::alimentarBloco(const uint8_t* d, size_t n, Resultado& out) {
    return _processar(d, n, out);
}

void Leitor::_erro() {
    _st.blocosInvalidos++;
    _st.errosConsecutivos++;
    if (travado() && _st.errosConsecutivos >= ERROS_PARA_DEGRADAR) {
        // enlace degradado: volta a DETECTANDO (o medidor nao muda de modo em
        // operacao, mas um enlace ruim pode ter travado no formato errado)
        _st.enlaceDegradado = true;
        _st.redeteccoes++;
        _st.formato = FMT_DESCONHECIDO;
        _votoFmt = FMT_DESCONHECIDO; _votos = 0;
    }
}

// Testa a(s) hipotese(s) compativel(is) com o tamanho. Um bloco normal com um
// byte de ruido tem 9 bytes: com 9 bytes testa CRC (estendido) E LRC nos 8
// primeiros (normal+lixo). Retorna o formato aceito em `fmt`.
bool Leitor::_decodificar(const uint8_t* d, size_t n, Resultado& r, uint8_t& fmt) {
    if (n == 9 && decodificarEstendido(d, r)) { fmt = FMT_ESTENDIDO; return true; }
    if (n == 8 && decodificarNormal(d, r))    { fmt = FMT_NORMAL;    return true; }
    if (n == 9 && decodificarNormal(d, r))    { fmt = FMT_NORMAL;    return true; }   // normal + 1 byte de ruido
    return false;
}

bool Leitor::_processar(const uint8_t* d, size_t n, Resultado& out) {
    _limpar(out);
    if (n < 8 || n > 9) { _erro(); return false; }

    Resultado r; uint8_t fmt = FMT_DESCONHECIDO;
    if (!travado()) {
        // ESTADO DETECTANDO: exige checksum valido + repeticao consistente.
        if (!_decodificar(d, n, r, fmt)) { _st.blocosInvalidos++; _votoFmt = FMT_DESCONHECIDO; _votos = 0; return false; }
        _st.blocosDeteccao++;
        if (fmt == _votoFmt) _votos++; else { _votoFmt = fmt; _votos = 1; }
        if (_votos >= BLOCOS_PARA_TRAVAR) {
            _st.formato = fmt; _st.enlaceDegradado = false; _st.errosConsecutivos = 0;
            // os blocos consumidos na deteccao NAO alimentam acumuladores; o
            // rastreio de registradores comeca do zero a partir do proximo bloco
            memset(_visto, 0, sizeof(_visto)); _temAnterior = false; _temBits = false;
        }
        return false;
    }

    // ESTADO TRAVADO: tamanho divergente = erro de frame, nunca troca de formato
    size_t esperado = (_st.formato == FMT_ESTENDIDO) ? 9 : 8;
    if (n != esperado) { _erro(); return false; }
    bool ok = (_st.formato == FMT_ESTENDIDO) ? decodificarEstendido(d, r) : decodificarNormal(d, r);
    if (!ok) { _erro(); return false; }

    _st.blocosValidos++;
    _st.errosConsecutivos = 0;
    if (_st.enlaceDegradado) _st.enlaceDegradado = false;
    _registrar(r);
    out = r;
    return true;
}

// Registradores, intervalo, idempotencia e toggles (spec §7 e §9).
void Leitor::_registrar(Resultado& r) {
    // Bloco de fechamento repetido (3x, dados identicos): idempotente — nada acumula.
    if (_temAnterior && r.segundos == _antSegundos && r.pulsosAtiva == _antPA && r.pulsosReativa == _antPR) {
        r.repetido = true;
        _st.fechamentosRepetidos++;
        return;
    }

    // Contador regressivo REINICIOU (ex.: 0/1 -> 899): intervalo de demanda novo.
    // Os contadores de pulso recomecam do zero no intervalo novo, entao a base
    // de comparacao de TODOS os registradores passa a ser 0 (nao e' wrap) — e
    // todos passam a valer como VISTOS: um registrador que so' aparecer mais
    // tarde neste intervalo (ex.: troca Q1->Q3 no meio) conta desde 0, nao vira
    // baseline (senao os pulsos ate a 1a leitura dele seriam perdidos). Baseline
    // so' existe pra registrador nunca visto ANTES de qualquer reinicio (boot no
    // meio de um intervalo: o valor inicial e' desconhecido).
    if (_temAnterior && r.segundos > _antSegundos + 5) {
        r.fimIntervaloDemanda = true;
        _st.intervalos++;
        for (int i = 1; i <= 6; i++) { _ultimo[i] = 0; _visto[i] = true; }
    }

    // Bits que ALTERNAM (octeto 2, bits 4 e 5) — detectar por MUDANCA, nunca ler como nivel.
    if (r.formato == FMT_ESTENDIDO) {
        uint8_t b4 = (uint8_t)((r.raw[1] >> 4) & 1), b5 = (uint8_t)((r.raw[1] >> 5) & 1);
        if (_temBits) {
            if (b4 != _antBit4) r.reposicaoFatura     = true;
            if (b5 != _antBit5) r.fimIntervaloReativo = true;
        }
        _antBit4 = b4; _antBit5 = b5; _temBits = true;
    }

    // Rastrear por REGISTRADOR: o quadrante so' diz qual registrador cada contador
    // representa; a comparacao e' sempre com o ultimo valor DAQUELE registrador.
    // Delta modular absorve UMA volta do contador: 16 bits no estendido
    // (65500 -> 40 = 76) e 15 bits no normal (contadores de 15 bits, bit 7 do
    // octeto alto mascarado: 32700 -> 40 = 108, nao 32836).
    const uint16_t mask = (r.formato == FMT_NORMAL) ? 0x7FFF : 0xFFFF;
    uint8_t ra = r.regAtiva, rr = r.regReativa;
    if (_visto[ra]) r.deltaAtiva = (uint16_t)((r.pulsosAtiva - _ultimo[ra]) & mask);
    else { r.deltaAtiva = 0; r.baseline = true; }
    _ultimo[ra] = r.pulsosAtiva; _visto[ra] = true;

    if (_visto[rr]) r.deltaReativa = (uint16_t)((r.pulsosReativa - _ultimo[rr]) & mask);
    else { r.deltaReativa = 0; r.baseline = true; }
    _ultimo[rr] = r.pulsosReativa; _visto[rr] = true;

    _antSegundos = r.segundos; _antPA = r.pulsosAtiva; _antPR = r.pulsosReativa; _temAnterior = true;
}

} // namespace ssu
