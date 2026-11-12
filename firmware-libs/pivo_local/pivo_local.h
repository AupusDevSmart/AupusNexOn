// ============================================================================
// pivo_local — maquina de estados do PIVO na TON slave (sequencia local, sem internet).
// Spec: arquivos/Spec NexON - Automacao do pivo (protocolo e firmware).md (v1.0, 11/11/2026)
//       + decisoes do usuario em 12/11/2026 (docs/IOT-PIVO-TON-LOCAL.md).
//
// C++ PURO (sem Arduino): compila no host (test_pivo.cpp) e no ESP32 dentro do
// firmware gerado. Quem le as BI, aciona reles, roda o ciclo do percentimetro,
// publica e guarda NVS e' o glue (glue/pivo.cpp) — esta lib so' decide.
// Fonte canonica: AupusNexOn/firmware-libs/pivo_local/. Os geradores (V1 e V2)
// embutem uma COPIA identica (tools/sync-pivo-lib.mjs --check confere).
//
// Saidas: BO1 bombeamento, BO2 valvula, BO3 direita, BO4 esquerda, BO5 percentimetro, BO6 canhao.
// Entradas SEMANTICAS (polaridade ja' resolvida pelo glue):
//   pressao (BI1, 1 = ok) · tensao (BI2, 1 = ok) · gir_dir/gir_esq (BI3/BI4, retorno do sentido)
//   seguranca (BI5, 1 = ok; 0 ou sem sinal = atuou) · canhao (BI6, retorno do canhao)
// Angulo: valor BRUTO do encoder, 0..359 (a calibracao fica no app).
// ============================================================================
#ifndef PIVO_LOCAL_H
#define PIVO_LOCAL_H

#include <stdint.h>
#include <stddef.h>

namespace pivo {

// Etapa (spec 7.3): parado · aguardando_pressao (partida: pressao ou giro) · girando
enum Estado : uint8_t { PARADO = 0, PARTINDO = 1, GIRANDO = 2 };
const char* estadoNome(Estado e);

// Passo da partida (dentro de PARTINDO)
enum Passo : uint8_t { P_NENHUM = 0, P_PRESSAO = 1, P_GIRO = 2 };
const char* passoNome(Passo p);

// Motivo da ultima parada (spec 8.6) + extras desta implementacao (9..)
enum Motivo : uint8_t {
    M_NENHUMA = 0, M_CONCLUIDA = 1, M_COMANDO = 2, M_QUEDA_PRESSAO = 3, M_PRESSAO_NAO_SUBIU = 4,
    M_TENSAO = 5, M_SEGURANCA = 6, M_REINICIO = 7, M_CONDICAO_PARTIDA = 8,
    M_NAO_GIROU = 9,      // o sentido nao confirmou (BI3/BI4) no tempo
    M_LADO_CAIU = 10,     // o retorno do sentido caiu com o pivo girando (parou sem comando)
    M_FALHA_RELES = 11,   // expansor de reles sem controle (glue)
};
const char* motivoNome(uint8_t m);

// Alertas (spec 8.6): bit0 erro de posicao · bit1 falha no canhao · bit2 reinicios repetidos (glue)
enum Alerta : uint8_t { A_ERRO_POSICAO = 1, A_FALHA_CANHAO = 2, A_REINICIOS = 4 };

enum Parada : uint8_t {
    POR_GRAUS = 0,    // graus a percorrer a partir da posicao atual (voltas = 360 x n, no NexON)
    POR_DURACAO = 1,  // PROVISORIO: pivo sem encoder (tempo estimado no NexON) — sai quando houver encoder de teste
};

static const int ID_LEN = 12;

struct Config {
    bool tem_valvula   = false;   // BO2
    bool tem_canhao    = true;    // BO6
    bool tem_pressao   = true;    // BI1
    bool tem_tensao    = true;    // BI2
    bool tem_gir_dir   = true;    // BI3
    bool tem_gir_esq   = true;    // BI4
    bool tem_seguranca = true;    // BI5
    bool tem_canhao_st = true;    // BI6
    uint32_t espera_pressao_ms  = 60000;    // partida: pressao tem de subir em ate' (sem BI1 = espera fixa)
    uint32_t confirma_giro_ms   = 30000;    // partida: sentido confirmado (BI3/BI4) em ate'
    uint32_t confirma_canhao_ms = 5000;     // canhao ligado sem BI6 por isto -> alerta falha_canhao
    uint32_t tol_pressao_ms     = 0;        // girando: pressao em 0 por isto -> desliga (0 = na hora)
    uint32_t tol_tensao_ms      = 0;        // girando: tensao em 0 por isto -> desliga (0 = na hora)
    uint32_t tol_lado_ms        = 0;        // girando: retorno do sentido em 0 por isto -> desliga
    uint32_t sem_posicao_ms     = 30000;    // sem leitura do encoder por isto -> alerta erro_posicao (nao para)
    uint32_t janela_giro_ms     = 600000;   // "angulo mudando" dentro desta janela
};

struct Plano {
    char     id[ID_LEN] = {0};    // id da ordem (8 caracteres)
    char     dir        = 'D';    // 'D' direita | 'E' esquerda
    bool     com_agua   = true;
    int16_t  pm         = 1000;   // percentimetro em permil (0..1000). Sem agua => 1000
    bool     canhao     = false;
    bool     tem_faixa  = false;  // faixa do canhao: dentro de [desliga_em, liga_em] o canhao fica OFF
    uint16_t desliga_em = 0;      // 0..359 (bruto do encoder)
    uint16_t liga_em    = 0;      // 0..359
    Parada   parada     = POR_GRAUS;
    uint32_t graus      = 360;    // POR_GRAUS (>0)
    uint32_t duracao_s  = 0;      // POR_DURACAO (>0)
};
bool validarPlano(Plano& p, char* motivo, size_t msz);

struct Entradas {
    bool pressao   = false;
    bool tensao    = false;
    bool gir_dir   = false;
    bool gir_esq   = false;
    bool seguranca = false;   // 1 = ok
    bool canhao    = false;
};

struct Saidas {
    bool    bomba   = false;
    bool    valvula = false;
    bool    dir     = false;
    bool    esq     = false;
    bool    canhao  = false;
    int16_t perc_pm = -1;     // BO5: ciclo do percentimetro (glue); -1 = desligado
};

// Eventos (glue: <base>/pivo/evento na TON com WiFi; o satelite LoRa nao manda).
//   tipo: "ligar" | "passo" | "girando" | "alerta" | "parado"
struct Ouvinte {
    virtual ~Ouvinte() {}
    virtual void aoEvento(const char* tipo, const char* detalhe) = 0;
    virtual void aoMudarEstado(Estado de, Estado para) = 0;
};

class Maquina {
public:
    Maquina(const Config& cfg, Ouvinte* ouv);
    void configurar(const Config& cfg) { _cfg = cfg; }
    const Config& config() const { return _cfg; }

    void tick(uint32_t now_ms, const Entradas& in);
    const Saidas& saidas() const { return _out; }
    void posicao(float graus_bruto, uint32_t now_ms);   // cada leitura boa do encoder (0..359)

    // Comandos. false + motivo quando recusam.
    bool ligar(const Plano& p, uint32_t now_ms, char* motivo, size_t msz);
    void desligar(uint8_t motivo, uint32_t now_ms);     // SEMPRE desliga (tudo LOW, spec 6.6)
    bool ajustarPercentimetro(int16_t pm, char* motivo, size_t msz);
    bool ajustarCanhao(bool ligado, bool tem_faixa, uint16_t desliga_em, uint16_t liga_em, uint32_t now_ms, char* motivo, size_t msz);
    void marcarMotivo(uint8_t m) { _motivo = m; }       // glue: reinicio (boot)

    // Observabilidade
    Estado      estado() const { return _st; }
    Passo       passo() const { return _passo; }
    const Plano& plano() const { return _plano; }
    uint8_t     motivo() const { return _motivo; }      // motivo da ultima parada
    uint8_t     alertas() const { return _alertas; }
    bool        temPosicao() const { return _tem_pos; }
    float       angulo() const { return _ang; }
    float       percorrido() const;                     // graus desde a partida (deslocamento liquido, modulo)
    uint32_t    alvo() const { return _plano.parada == POR_GRAUS ? _plano.graus : 0; }
    bool        girando(uint32_t now_ms) const;
    const Entradas& entradas() const { return _in; }
    bool        otaPermitida() const { return _st == PARADO; }

private:
    void _ir(Estado e);
    void _evento(const char* t, const char* d) { if (_ouv) _ouv->aoEvento(t, d); }
    void _acionarLado(uint32_t now);
    void _entrarGirando(uint32_t now);
    void _avaliarCanhao(uint32_t now);
    bool _canhaoNaFaixaOff() const;
    bool _gir() const { return _plano.dir == 'D' ? _in.gir_dir : _in.gir_esq; }
    bool _temGir() const { return _plano.dir == 'D' ? _cfg.tem_gir_dir : _cfg.tem_gir_esq; }
    bool _queda(bool ok, uint32_t& desde, uint32_t tol, uint32_t now);

    Config   _cfg;
    Ouvinte* _ouv;
    Estado   _st = PARADO;
    Passo    _passo = P_NENHUM;
    Saidas   _out;
    Entradas _in;
    Plano    _plano;
    uint8_t  _motivo = M_NENHUMA;
    uint8_t  _alertas = 0;
    uint32_t _t_passo = 0;
    uint32_t _t_ligar = 0;
    // posicao
    bool     _tem_pos = false;
    float    _ang = 0;
    uint32_t _t_pos = 0;
    float    _ang_ref = 0;
    uint32_t _t_ang_mudou = 0;
    bool     _ang_mudou_ok = false;
    bool     _contando = false;
    float    _soma = 0;            // soma dos deslocamentos (com sinal); percorrido = |soma|
    // canhao
    uint32_t _t_canhao_sem = 0;    // desde quando o canhao esta' ligado sem BI6 (0 = ok)
    // quedas (0 = ok)
    uint32_t _q_pressao = 0, _q_tensao = 0, _q_lado = 0;
};

} // namespace pivo

#endif // PIVO_LOCAL_H
