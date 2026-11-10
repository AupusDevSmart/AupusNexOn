// ============================================================================
// wiegand — leitor RFID/teclado Wiegand amostrado pelo ADC (TON-V2: D0 na AI1,
// D1 na AI2). C++ puro, sem Arduino: testado no host (test_wiegand.cpp).
//
// Camadas:
//   Detector       — 1 por linha: recebe as amostras cruas do ADC (com o instante
//                    em us) e devolve cada pulso (inicio + largura). O nivel de
//                    repouso e' calibrado sozinho (media lenta); pulso = amostra
//                    abaixo de 40 % do repouso, fim acima de 60 % (histerese).
//   Decodificador  — junta os pulsos das duas linhas em quadros (fim do quadro =
//                    silencio) e classifica: 26/34 bits = TAG (paridades),
//                    4/8 bits = TECLA. Tag repetida dentro da janela e' ignorada.
//   Teclado        — acumula as teclas: digitos, '*' apaga, '#' fecha a matricula.
//
// Wiegand: repouso alto; bit 0 = pulso baixo no D0, bit 1 = pulso baixo no D1.
// 26 bits = paridade PAR (bits 0..12) + 24 dados + paridade IMPAR (bits 13..25).
// 34 bits = paridade PAR (0..16) + 32 dados + paridade IMPAR (17..33).
// Teclado: 4 bits por tecla (0-9, 10 = '*', 11 = '#') ou 8 bits (nibble alto =
// complemento do baixo).
// ============================================================================
#ifndef WIEGAND_H
#define WIEGAND_H
#include <stdint.h>
#include <stddef.h>

namespace wiegand {

static const int MAX_BITS = 64;

// ---------------------------------------------------------------------------
// Detector de pulso de UMA linha a partir das amostras do ADC
// ---------------------------------------------------------------------------
struct Pulso {
    uint32_t inicio_us;
    uint32_t largura_us;
};

class Detector {
public:
    // piso_repouso: abaixo disso a linha e' considerada sem sinal (desligada/solta);
    // largura_max_us: pulso mais longo que isso nao e' bit (fio solto, curto).
    explicit Detector(uint16_t piso_repouso = 600, uint32_t largura_max_us = 3000);
    // Uma amostra crua (0..4095) no instante t_us. Retorna true quando um pulso termina.
    bool amostra(uint16_t v, uint32_t t_us, Pulso& out);
    uint16_t repouso() const { return (uint16_t)(_repouso_x16 >> 4); }
    bool temSinal() const { return repouso() >= _piso; }
    bool emPulso() const { return _emPulso; }
    // estatisticas
    uint32_t pulsos() const { return _pulsos; }
    uint32_t longos() const { return _longos; }        // descartados por largura > max
    uint32_t larguraMin() const { return _lmin; }
    uint32_t larguraMax() const { return _lmax; }
    uint16_t minimoVisto() const { return _vmin; }       // menor amostra desde o ultimo limparStats
    void limparStats();
private:
    uint32_t _repouso_x16;
    bool     _calibrado;
    uint16_t _piso;
    uint32_t _lmax_aceito;
    bool     _emPulso;
    uint32_t _t0;
    uint32_t _pulsos, _longos, _lmin, _lmax;
    uint16_t _vmin;
};

// ---------------------------------------------------------------------------
// Quadro -> evento
// ---------------------------------------------------------------------------
enum TipoEvento { NENHUM = 0, TAG, TECLA, INVALIDO, REPETIDO };

struct Evento {
    TipoEvento tipo;
    uint8_t    bits;        // tamanho do quadro
    uint32_t   valor;       // TAG: dados (24 ou 32 bits); TECLA: 0..11
    char       uid[12];     // TAG: hexa maiusculo (6 ou 8 digitos)
    const char* motivo;     // INVALIDO: "paridade", "bits_N", "tecla", "excesso"
};

struct Config {
    uint32_t fim_quadro_us = 25000;   // silencio que fecha o quadro
    uint32_t antirep_ms    = 2000;    // mesma tag dentro desta janela = REPETIDO (0 = desliga)
};

class Decodificador {
public:
    explicit Decodificador(const Config& c = Config());
    // Um bit detectado: linha 0 = D0 (bit 0), 1 = D1 (bit 1).
    void adicionarBit(uint8_t linha, uint32_t inicio_us, uint32_t largura_us);
    // Chamar periodicamente; fecha o quadro depois do silencio. true = gerou evento.
    bool tick(uint32_t agora_us, Evento& ev);
    // ultimo quadro (diagnostico)
    uint8_t  ultimoN() const { return _uN; }
    uint8_t  ultimoBit(int i) const { return (uint8_t)((_uBits >> (63 - i)) & 1u); }
    uint32_t ultimaLargura(int i) const { return _uLarg[i]; }
    uint32_t ultimoIntervalo(int i) const { return _uInt[i]; }   // i >= 1: inicio(i) - inicio(i-1)
    // estatisticas
    uint32_t quadros = 0, tags = 0, teclas = 0, invalidos = 0, repetidos = 0;
    const char* ultimoMotivo = "";
    void limparStats();
private:
    Config   _c;
    uint64_t _bits;
    uint8_t  _n;
    bool     _excesso;
    uint32_t _tUltimo;
    uint32_t _larg[MAX_BITS];
    uint32_t _ini[MAX_BITS];
    // copia do ultimo quadro fechado
    uint64_t _uBits;
    uint8_t  _uN;
    uint32_t _uLarg[MAX_BITS];
    uint32_t _uInt[MAX_BITS];
    // anti-repeticao
    uint32_t _ultDados;
    uint8_t  _ultBits;
    uint32_t _ultTagMs;
    bool     _temUlt;
    bool _classificar(uint32_t agora_us, Evento& ev);
};

// ---------------------------------------------------------------------------
// Teclado: matricula por digitos, '#' confirma, '*' apaga
// ---------------------------------------------------------------------------
class Teclado {
public:
    explicit Teclado(uint32_t timeout_ms = 15000, uint8_t max_digitos = 12);
    // Retorna true quando '#' fecha uma matricula (texto() valido ate a proxima tecla).
    bool tecla(uint32_t k, uint32_t agora_ms);
    void tick(uint32_t agora_ms);           // timeout sem tecla apaga o que foi digitado
    const char* texto() const { return _fechado; }
    const char* parcial() const { return _buf; }
    void limpar();
private:
    uint32_t _timeout;
    uint8_t  _max;
    char     _buf[16];
    char     _fechado[16];
    uint8_t  _n;
    uint32_t _tUlt;
};

// ---------------------------------------------------------------------------
// Funcoes puras (expostas para teste)
// ---------------------------------------------------------------------------
// q = bits do quadro, o primeiro bit recebido no MSB (bit n-1 do inteiro).
bool paridade26(uint32_t q, uint32_t& dados24);
bool paridade34(uint64_t q, uint32_t& dados32);
int  tecla4(uint32_t v);      // 0..11 ou -1
int  tecla8(uint32_t v);      // 0..11 ou -1 (nibble alto = complemento)
void hexa(uint32_t v, uint8_t digitos, char* out);   // out >= digitos + 1
char caractereTecla(int k);   // '0'..'9', '*', '#', '?'

}  // namespace wiegand
#endif
