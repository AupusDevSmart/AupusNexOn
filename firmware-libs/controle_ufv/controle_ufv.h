// controle_ufv — lado TON do controle automatico pelo MED da concessionaria (Fase B).
// Logica PURA (sem Arduino/Modbus/NVS): host-testavel em test_controle.cpp.
// docs/IOT-CONTROLE-MED-CONCESSIONARIA-IMPLEMENTACAO.md §5 · decisoes R1/R2/R5/R6 em
// docs/IOT-CONTROLE-MED-CONCESSIONARIA-DIVERGENCIAS.md §6.
//
// O backend (NexON) DECIDE os setpoints; a TON da UFV so':
//   - aplica o setpoint com VALIDADE (ttl relativo + numero de sequencia, R6);
//   - escreve no inversor so' quando o valor muda (EEPROM; o backend ja' aplica o degrau minimo);
//   - confirma a escrita relendo o registrador (read-back, R5) — quem le e' o callback;
//   - validade vencida -> MODO SEGURO local: estagio 1 (P <= P estatico, Q = 0) e, apos t2,
//     estagio 2 (P = p2, 0 quando "zera no estagio 2");
//   - volta com RAMPA de subida de P (spec 11.2);
//   - BI MANUAL (chave Automatico/Manual, R1): bypass da malha, P = 100% Pn, Q = 0.
// Todos os valores sao BRUTOS de registrador (o backend converte pela escala do catalogo).
#ifndef CONTROLE_UFV_H
#define CONTROLE_UFV_H
#include <stdint.h>
#include <stddef.h>

namespace cufv {

static const int MAX_INV = 8;
static const int DEV_SZ = 32;
static const uint32_t RETENTA_MS = 15000;   // escrita que falhou: tenta de novo a cada 15 s

enum Modo : uint8_t { DESLIGADO = 0, AUTO = 1, SEGURO1 = 2, SEGURO2 = 3, MANUAL = 4 };
const char* modoNome(Modo m);              // "D" "A" "S1" "S2" "M"

// Resultado de uma escrita (o callback devolve; a lib guarda por inversor).
enum Res : int8_t { ESC_NADA = 0, ESC_OK = 1, ESC_ESCRITO = 2, ESC_FALHA = -1, ESC_DIVERGE = -2 };
//   ESC_OK      escrito e confirmado pelo read-back
//   ESC_ESCRITO escrito (Modbus respondeu), sem read-back disponivel p/ esse modelo
//   ESC_FALHA   escrita recusada / sem resposta
//   ESC_DIVERGE escrito, mas o read-back leu outro valor (*lido)

enum Sp : uint8_t { SP_P = 0, SP_Q = 1 };
typedef Res (*EscreverFn)(const char* dev, uint16_t addr, Sp sp, int32_t valor, int32_t* lido);

struct InvCfg {
    char dev[DEV_SZ];   // nome do device no diagrama (o mesmo do comando {"device":...})
    uint16_t addr;      // endereco Modbus (0 = so' nome)
    int32_t p1;         // P no estagio 1 do modo seguro (bruto)
    int32_t p2;         // P no estagio 2 (bruto) — 0 quando a UFV "zera no estagio 2"
    int32_t pman;       // P em MANUAL e ao desligar o controle (100% Pn, bruto)
    int32_t rampa;      // subida maxima de P por setpoint recebido na retomada (bruto; 0 = sem rampa)
};

struct InvEst {
    bool    tem_pedido;        // backend ja' mandou alvo desde o boot
    int32_t ped_p, ped_q;      // ultimo pedido do backend
    bool    tem_alvo;          // ha' algo a manter no inversor
    int32_t alvo_p, alvo_q;    // o que deve estar no inversor AGORA (modo/rampa aplicados)
    bool    ok_p, ok_q;        // esc_* vale (escrito com sucesso)
    int32_t esc_p, esc_q;      // ultimo valor escrito com sucesso
    int8_t  res_p, res_q;      // resultado da ultima tentativa
    int32_t lido_p, lido_q;    // read-back divergente
    uint32_t tent_ms;          // ultima tentativa (retentativa)
    bool    tentou;            // houve tentativa desde o ultimo resumo
};

class Controle {
public:
    void begin(EscreverFn w);
    // ---- cadastro (vem do backend; o glue persiste no NVS) ----
    bool geral(int n, uint16_t t2_s, uint8_t bi, bool bi_inv);
    bool inv(int i, uint16_t addr, int32_t p1, int32_t p2, int32_t pman, int32_t rampa, const char* dev);   // i = 1..n
    int  n() const { return _n; }
    const InvCfg& cfg(int i) const { return _cfg[i]; }   // 0-based
    const InvEst& est(int i) const { return _est[i]; }
    uint8_t bi() const { return _bi; }
    bool biInvertida() const { return _bi_inv; }

    // ---- operacao ----
    // Boot com o controle ativo (NVS): a validade corre a partir do boot com o ultimo ttl.
    void retomarDoBoot(uint16_t ttl_s, uint32_t now_ms);
    // Setpoint com validade. idx 1..n. seq menor que o ultimo aceito = mensagem velha (LoRa) -> false.
    // n_sp = 0: so' renova a validade (heartbeat).
    bool receber(uint32_t seq, uint16_t ttl_s, int n_sp, const uint8_t* idx, const int32_t* p, const int32_t* q,
                 uint32_t now_ms, char* motivo, size_t msz);
    // "ctl off": desliga o watchdog e devolve os inversores a P = pman, Q = 0.
    void desligar(uint32_t now_ms);
    // Loop: BI manual (posicao ja' lida, com debounce aqui), validade, estagios, retentativas.
    void tick(uint32_t now_ms, bool bi_ativa);

    Modo modo() const { return _modo; }
    bool ativo() const { return _ativo; }            // backend ligou o controle (watchdog armado)
    uint16_t ttl() const { return _ttl_s; }
    uint32_t seq() const { return _seq; }
    int32_t validadeRestanteS(uint32_t now_ms) const;
    uint32_t escritas() const { return _escritas; }

    // Resumo curto p/ o ack: "<modo> [s=<seg em seguro>] [m=<seg em manual>] [p=<pior estagio>] 1:ok 2:= ...".
    // Zera os marcadores (tempo em seguro/manual, pior modo) — o backend registra os eventos.
    void resumo(char* out, size_t n);
    Modo piorDesdeResumo() const { return _pior; }

private:
    void _aplicarModo(uint32_t now_ms);
    void _escreverPendentes(uint32_t now_ms, bool forcar);
    void _escrever(int i, uint32_t now_ms);
    void _setModo(Modo m, uint32_t now_ms);

    EscreverFn _w = nullptr;
    InvCfg _cfg[MAX_INV];
    InvEst _est[MAX_INV];
    int _n = 0;
    uint16_t _t2_s = 0;
    uint8_t _bi = 0;
    bool _bi_inv = false;

    Modo _modo = DESLIGADO;
    bool _ativo = false;
    bool _retomando = false;     // rampa de subida em curso
    uint32_t _seq = 0;
    bool _tem_seq = false;
    uint16_t _ttl_s = 300;
    uint32_t _valido_ate = 0;    // millis (comparado com subtracao: sobrevive ao wrap)
    uint32_t _seguro_desde = 0;
    uint32_t _escritas = 0;

    // BI: debounce de 1 s
    bool _bi_lida = false, _bi_estavel = false;
    uint32_t _bi_desde = 0;

    // marcadores desde o ultimo resumo
    uint32_t _ult_tick = 0;
    uint32_t _ms_seguro = 0, _ms_manual = 0;
    Modo _pior = DESLIGADO;
};

}  // namespace cufv
#endif
