// ============================================================================
// ssu_nbr14522 — leitura da Saida Serial de Usuario (SSU) de medidores da
// concessionaria, ABNT NBR 14522:2008 (secoes 3.4.1 bloco normal / 3.4.2
// bloco estendido). Alvo: Landis+Gyr E750 A2E3 na TON-V2 (SU+ = IO48).
//
// Escopo (spec interna "Firmware de leitura da SSU", §1): traduzir octetos em
// uma struct de resultado. NAO publica MQTT, NAO grava SD, NAO conhece RTC,
// RTP ou Ke. Quem consome decide o que fazer com a traducao.
//
// C++ puro (sem Arduino) — compila no host para os testes (test_ssu.cpp) e no
// ESP32 dentro do firmware gerado. Fonte canonica: AupusNexOn/firmware-libs/
// ssu_nbr14522/. O gerador V2 embute uma COPIA identica (ver ssu-lib-sync).
// ============================================================================
#ifndef SSU_NBR14522_H
#define SSU_NBR14522_H

#include <stdint.h>
#include <stddef.h>

namespace ssu {

enum Formato : uint8_t { FMT_DESCONHECIDO = 0, FMT_NORMAL = 1, FMT_ESTENDIDO = 2 };

// Resultado de UM bloco valido (spec §1). Deltas em PULSO CRU (sem Ke).
struct Resultado {
    bool     valido;               // checksum ok e formato coerente
    uint8_t  formato;              // FMT_NORMAL | FMT_ESTENDIDO
    uint16_t segundos;             // contagem REGRESSIVA ate o fim do intervalo de demanda
    uint8_t  quadrante;            // 1..4 (0 no bloco normal)
    uint8_t  postoHorario;         // estendido: 1 ponta, 2 fora de ponta, 3 quarto posto
    uint8_t  postoReativo;         // 0 nenhum, 1 capacitivo, 2 indutivo, 3 ambos
    bool     tarifaReativos;       // estendido: bit 7 do octeto 3
    bool     fimIntervaloDemanda;  // 1o bloco de um intervalo NOVO (contador reiniciou)
    bool     fimIntervaloReativo;  // transicao do bit 5 do octeto 2 (alterna a cada fim)
    bool     reposicaoFatura;      // transicao do bit 4 do octeto 2 (alterna a cada fatura)
    uint8_t  regAtiva;             // 1 ou 2 — registrador que a ativa alimenta neste bloco
    uint8_t  regReativa;           // 3..6  — registrador que a reativa alimenta
    uint16_t deltaAtiva;           // pulsos desde a leitura anterior DO MESMO registrador
    uint16_t deltaReativa;
    uint16_t pulsosAtiva;          // contadores crus do bloco (auditoria)
    uint16_t pulsosReativa;
    uint8_t  segmentoHorario;      // bloco normal: bits 0-3 do octeto 3
    uint8_t  tipoTarifa;           // bloco normal: 0 azul, 1 verde, 2 irrigantes, 3 outras
    bool     repetido;             // bloco de fechamento repetido (3x) — NAO acumular
    bool     baseline;             // 1a leitura do registrador: so' define ponto de partida
    uint8_t  raw[9];               // bloco bruto
    uint8_t  rawLen;               // 8 ou 9
};

struct Estatisticas {
    uint32_t blocosValidos;
    uint32_t blocosInvalidos;      // checksum errado / tamanho errado / lixo
    uint32_t errosConsecutivos;
    uint32_t redeteccoes;          // vezes que voltou a DETECTANDO por enlace degradado
    uint32_t blocosDeteccao;       // consumidos na autodeteccao (nao alimentam acumulador)
    uint32_t fechamentosRepetidos;
    uint32_t intervalos;           // intervalos de demanda fechados (contador reiniciou)
    bool     enlaceDegradado;      // 30 erros consecutivos
    uint8_t  formato;              // formato travado (FMT_*)
};

// Checksums (spec §6)
uint8_t  lrc(const uint8_t* d, size_t n);      // complemento do XOR
uint16_t crc16(const uint8_t* d, size_t n);    // X16+X15+X2+1, refletido 0xA001, init 0

// Decodificacao pura de um bloco (valida checksum; nao mexe em estado).
bool decodificarNormal(const uint8_t* d, Resultado& r);      // 8 octetos
bool decodificarEstendido(const uint8_t* d, Resultado& r);   // 9 octetos

// Tabela de quadrante (bits 4-5 do octeto 3) — NAO sequencial (spec §7).
extern const uint8_t QUADRANTE[4];   // {1, 4, 2, 3}

/**
 * Leitor com estado: enquadramento (por gap, caminho A) ou bloco pronto
 * (RX-timeout do UART, caminho B), autodeteccao/trava de formato, validacao,
 * rastreio por REGISTRADOR (6 regs) com wrap uint16, reinicio do contador a
 * cada intervalo de demanda, idempotencia do bloco de fechamento e deteccao
 * das transicoes dos bits 4/5.
 */
class Leitor {
public:
    static const uint32_t GAP_MS            = 150;  // > 1 byte (~91 ms) e < silencio (182 ms)
    static const uint8_t  BLOCOS_PARA_TRAVAR = 10;  // blocos coerentes p/ travar o formato
    static const uint8_t  ERROS_PARA_DEGRADAR = 30; // erros consecutivos -> degradado + redeteccao
    static const uint8_t  MAX_BLOCO         = 16;

    Leitor();
    void reset();

    // Caminho A: byte a byte com carimbo de tempo. Retorna true quando um bloco
    // valido (e ja travado) foi decodificado em `out`.
    bool alimentarByte(uint8_t b, uint32_t agora_ms, Resultado& out);
    // Caminho B: bloco completo (n = 8 ou 9). Mesmo retorno.
    bool alimentarBloco(const uint8_t* d, size_t n, Resultado& out);
    // Forca o gap (ex.: timeout de silencio sem byte novo) — fecha bloco pendente.
    bool fecharBloco(Resultado& out);

    const Estatisticas& stats() const { return _st; }
    Formato formato() const { return (Formato)_st.formato; }
    bool travado() const { return _st.formato != FMT_DESCONHECIDO; }

    // Formato esperado pelo cadastro: SO' validacao (spec §5 "coerencia") —
    // nunca substitui a deteccao. Divergente => alarme de quem consome.
    void definirFormatoEsperado(Formato f) { _fmtEsperado = f; }
    bool formatoDivergente() const { return _fmtEsperado != FMT_DESCONHECIDO && travado() && _st.formato != _fmtEsperado; }

    // Bancada/testes: trava direto (pula a autodeteccao).
    void travarFormato(Formato f);

private:
    bool _processar(const uint8_t* d, size_t n, Resultado& out);
    bool _decodificar(const uint8_t* d, size_t n, Resultado& r, uint8_t& fmt);
    void _registrar(Resultado& r);
    void _erro();

    // enquadramento
    uint8_t  _buf[MAX_BLOCO];
    uint8_t  _len;
    uint32_t _ultimoByteMs;
    bool     _temByte;
    // deteccao
    uint8_t  _fmtEsperado;
    uint8_t  _votoFmt;
    uint8_t  _votos;
    // registradores (indice 1..6)
    uint16_t _ultimo[7];
    bool     _visto[7];
    // idempotencia / intervalo / toggles
    bool     _temAnterior;
    uint16_t _antSegundos, _antPA, _antPR;
    bool     _temBits;
    uint8_t  _antBit4, _antBit5;

    Estatisticas _st;
};

} // namespace ssu

#endif // SSU_NBR14522_H
