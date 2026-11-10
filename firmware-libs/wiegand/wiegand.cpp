// wiegand.cpp — ver wiegand.h. C++ puro.
#include "wiegand.h"
#include <string.h>

namespace wiegand {

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------
Detector::Detector(uint16_t piso_repouso, uint32_t largura_max_us)
    : _repouso_x16(0), _calibrado(false), _piso(piso_repouso), _lmax_aceito(largura_max_us),
      _emPulso(false), _t0(0), _pulsos(0), _longos(0), _lmin(0), _lmax(0), _vmin(0xFFFF) {}

void Detector::limparStats() {
    _pulsos = 0; _longos = 0; _lmin = 0; _lmax = 0; _vmin = 0xFFFF;
}

bool Detector::amostra(uint16_t v, uint32_t t_us, Pulso& out) {
    if (v < _vmin) _vmin = v;
    if (!_calibrado) { _repouso_x16 = (uint32_t)v << 4; _calibrado = true; return false; }
    uint32_t rep = _repouso_x16 >> 4;
    uint32_t limBaixo = rep * 4 / 10;   // entra no pulso abaixo de 40 % do repouso
    uint32_t limAlto  = rep * 6 / 10;   // sai do pulso acima de 60 %
    if (!_emPulso) {
        if (rep >= _piso && v < limBaixo) { _emPulso = true; _t0 = t_us; return false; }
        // repouso: media lenta (1/64) — acompanha deriva da fonte, ignora o pulso
        _repouso_x16 = _repouso_x16 - (_repouso_x16 >> 6) + ((uint32_t)v << 4 >> 6);
        return false;
    }
    if (v <= limAlto) {
        // ainda no pulso; pulso longo demais = linha presa/solta: abandona e recalibra
        if ((uint32_t)(t_us - _t0) > _lmax_aceito) { _emPulso = false; _longos++; _calibrado = false; }
        return false;
    }
    _emPulso = false;
    uint32_t larg = (uint32_t)(t_us - _t0);
    if (larg > _lmax_aceito) { _longos++; return false; }
    _pulsos++;
    if (_lmin == 0 || larg < _lmin) _lmin = larg;
    if (larg > _lmax) _lmax = larg;
    out.inicio_us = _t0;
    out.largura_us = larg;
    return true;
}

// ---------------------------------------------------------------------------
// Funcoes puras
// ---------------------------------------------------------------------------
static int contaUns(uint64_t v) { int n = 0; while (v) { n += (int)(v & 1u); v >>= 1; } return n; }

bool paridade26(uint32_t q, uint32_t& dados24) {
    // bit 25 (MSB) = paridade par sobre os bits 25..13; bit 0 = paridade impar sobre 12..0
    uint32_t alto = (q >> 13) & 0x1FFFu;   // 13 bits: P_par + 12 dados
    uint32_t baixo = q & 0x1FFFu;          // 12 dados + P_impar
    dados24 = (q >> 1) & 0xFFFFFFu;
    return (contaUns(alto) % 2 == 0) && (contaUns(baixo) % 2 == 1);
}

bool paridade34(uint64_t q, uint32_t& dados32) {
    uint64_t alto = (q >> 17) & 0x1FFFFull;
    uint64_t baixo = q & 0x1FFFFull;
    dados32 = (uint32_t)((q >> 1) & 0xFFFFFFFFull);
    return (contaUns(alto) % 2 == 0) && (contaUns(baixo) % 2 == 1);
}

int tecla4(uint32_t v) {
    v &= 0xFu;
    return v <= 11 ? (int)v : -1;
}

int tecla8(uint32_t v) {
    uint32_t lo = v & 0xFu, hi = (v >> 4) & 0xFu;
    if ((hi ^ lo) != 0xFu) return -1;
    return lo <= 11 ? (int)lo : -1;
}

void hexa(uint32_t v, uint8_t digitos, char* out) {
    static const char H[] = "0123456789ABCDEF";
    for (int i = digitos - 1; i >= 0; i--) { out[i] = H[v & 0xFu]; v >>= 4; }
    out[digitos] = 0;
}

char caractereTecla(int k) {
    if (k >= 0 && k <= 9) return (char)('0' + k);
    if (k == 10) return '*';
    if (k == 11) return '#';
    return '?';
}

// ---------------------------------------------------------------------------
// Decodificador
// ---------------------------------------------------------------------------
Decodificador::Decodificador(const Config& c)
    : _c(c), _bits(0), _n(0), _excesso(false), _tUltimo(0), _uBits(0), _uN(0),
      _ultDados(0), _ultBits(0), _ultTagMs(0), _temUlt(false) {
    memset(_larg, 0, sizeof(_larg)); memset(_ini, 0, sizeof(_ini));
    memset(_uLarg, 0, sizeof(_uLarg)); memset(_uInt, 0, sizeof(_uInt));
}

void Decodificador::limparStats() {
    quadros = tags = teclas = invalidos = repetidos = 0;
    ultimoMotivo = "";
}

void Decodificador::adicionarBit(uint8_t linha, uint32_t inicio_us, uint32_t largura_us) {
    _tUltimo = inicio_us + largura_us;
    if (_n >= MAX_BITS) { _excesso = true; return; }
    _bits = (_bits << 1) | (linha ? 1u : 0u);
    _larg[_n] = largura_us;
    _ini[_n] = inicio_us;
    _n++;
}

bool Decodificador::tick(uint32_t agora_us, Evento& ev) {
    if (_n == 0 && !_excesso) return false;
    if ((uint32_t)(agora_us - _tUltimo) < _c.fim_quadro_us) return false;
    // fecha o quadro: copia para o diagnostico
    _uN = _n;
    _uBits = _n ? (_bits << (64 - _n)) : 0;   // primeiro bit no MSB do uint64
    for (int i = 0; i < _n; i++) {
        _uLarg[i] = _larg[i];
        _uInt[i] = i ? (uint32_t)(_ini[i] - _ini[i - 1]) : 0;
    }
    bool r = _classificar(agora_us, ev);
    _bits = 0; _n = 0; _excesso = false;
    return r;
}

bool Decodificador::_classificar(uint32_t agora_us, Evento& ev) {
    memset(&ev, 0, sizeof(ev));
    ev.bits = _n;
    quadros++;
    if (_excesso) { ev.tipo = INVALIDO; ev.motivo = "excesso"; invalidos++; ultimoMotivo = ev.motivo; return true; }
    uint32_t agora_ms = agora_us / 1000u;
    if (_n == 26 || _n == 34) {
        uint32_t dados = 0;
        bool ok = (_n == 26) ? paridade26((uint32_t)_bits, dados) : paridade34(_bits, dados);
        if (!ok) { ev.tipo = INVALIDO; ev.motivo = "paridade"; invalidos++; ultimoMotivo = ev.motivo; return true; }
        ev.valor = dados;
        hexa(dados, _n == 26 ? 6 : 8, ev.uid);
        // mesma tag dentro da janela: REPETIDO (a janela anda enquanto a tag fica encostada)
        if (_c.antirep_ms && _temUlt && _ultDados == dados && _ultBits == _n &&
            (uint32_t)(agora_ms - _ultTagMs) < _c.antirep_ms) {
            _ultTagMs = agora_ms;
            ev.tipo = REPETIDO; repetidos++;
            return true;
        }
        _temUlt = true; _ultDados = dados; _ultBits = _n; _ultTagMs = agora_ms;
        ev.tipo = TAG; tags++;
        return true;
    }
    if (_n == 4 || _n == 8) {
        int k = (_n == 4) ? tecla4((uint32_t)_bits) : tecla8((uint32_t)_bits);
        if (k < 0) { ev.tipo = INVALIDO; ev.motivo = "tecla"; invalidos++; ultimoMotivo = ev.motivo; return true; }
        ev.tipo = TECLA; ev.valor = (uint32_t)k; teclas++;
        return true;
    }
    ev.tipo = INVALIDO;
    // "bits_N" sem printf: motivo estatico por faixa + o N vai em ev.bits
    ev.motivo = "bits";
    invalidos++; ultimoMotivo = ev.motivo;
    return true;
}

// ---------------------------------------------------------------------------
// Teclado
// ---------------------------------------------------------------------------
Teclado::Teclado(uint32_t timeout_ms, uint8_t max_digitos)
    : _timeout(timeout_ms), _max(max_digitos > 15 ? 15 : max_digitos), _n(0), _tUlt(0) {
    _buf[0] = 0; _fechado[0] = 0;
}

void Teclado::limpar() { _n = 0; _buf[0] = 0; }

void Teclado::tick(uint32_t agora_ms) {
    if (_n && _timeout && (uint32_t)(agora_ms - _tUlt) > _timeout) limpar();
}

bool Teclado::tecla(uint32_t k, uint32_t agora_ms) {
    tick(agora_ms);
    _tUlt = agora_ms;
    if (k <= 9) {
        if (_n < _max) { _buf[_n++] = (char)('0' + k); _buf[_n] = 0; }
        return false;
    }
    if (k == 10) { limpar(); return false; }   // '*': apaga
    if (k == 11) {                              // '#': confirma
        if (!_n) return false;
        memcpy(_fechado, _buf, (size_t)_n + 1);
        limpar();
        return true;
    }
    return false;
}

}  // namespace wiegand
