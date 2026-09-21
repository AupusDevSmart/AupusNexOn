// ============================================================================
// bomba_posto — maquina de estados do POSTO DE COMBUSTIVEL na TON (V1 ton3/ton4 e
// V2 ton3v2/ton4v2). Implementa "Posto de Combustivel na Fazenda — Como funciona"
// + "Teste em bancada" (2026-09-21): identificacao dupla (tag + matricula),
// validacao online (NexON) com fallback na lista local, permissao MANTIDA (BO2),
// partida por pulso (BO1) confirmada pelo contato auxiliar do contator (BI1),
// solenoide (BO3), condicoes de fim, contator colado, modo manual, bloqueio.
//
// C++ PURO (sem Arduino): compila no host (test_bomba.cpp) e no ESP32 dentro do
// firmware gerado. Quem le as entradas fisicas, aciona reles, publica MQTT e
// persiste NVS e' o glue gerado (bomba.cpp) — esta lib so' decide.
// Fonte canonica: AupusNexOn/firmware-libs/bomba_posto/. O gerador (V1 e V2)
// embute uma COPIA identica (smoke confere byte a byte).
//
// Convencao das ENTRADAS (semanticas, ja com a polaridade resolvida pelo glue):
//   contator        = contato auxiliar do K1 fechado (bomba ligada)
//   automatico      = chave do painel em Automatico (BI fechada)
//   emergencia      = botao de emergencia ATUADO (contato NF: BI aberta = atuado)
//   bico_no_suporte = bico devolvido/no suporte (BI fechada)
//   nivel_baixo_boia= boia de nivel minimo ATUADA (contato NF: BI aberta = tanque no fundo)
//   boia_alta       = boia de nivel alto ATUADA (alarme na descarga; nao intertrava)
//   nivel_pct       = transmissor de nivel (AI), <0 quando nao ha transmissor
//   fluxo_lpm       = vazao instantanea (fluxometro real ou comando "fluxo" na bancada)
// ============================================================================
#ifndef BOMBA_POSTO_H
#define BOMBA_POSTO_H

#include <stdint.h>
#include <stddef.h>

namespace bomba {

enum Estado : uint8_t {
    OCIOSA = 0, AGUARDANDO_MATRICULA, VALIDANDO, PARTINDO, ABASTECENDO,
    ENCERRANDO, BLOQUEADA, MANUAL
};
const char* estadoNome(Estado e);

enum Validacao : uint8_t { VAL_NENHUMA = 0, VAL_ONLINE, VAL_OFFLINE, VAL_MANUAL };
const char* validacaoNome(Validacao v);

// Limites (RAM do ESP32 e' generosa; a lista vai em NVS via glue)
static const int LISTA_MAX_TAGS = 64;
static const int LISTA_MAX_MATS = 64;
static const int TAG_MAX_MATS   = 8;
static const int UID_LEN        = 24;
static const int MAT_LEN        = 16;
static const int MOTIVO_LEN     = 24;
static const int REQ_LEN        = 16;

struct Config {
    uint32_t pulso_bo1_ms       = 500;     // toque de "liga" no K1
    uint32_t espera_bi1_ms      = 1000;    // espera pelo contato auxiliar na partida e no desligamento
    uint32_t janela_mat_ms      = 60000;   // entre a tag e a matricula
    uint32_t auth_timeout_ms    = 3000;    // resposta do NexON antes de validar offline
    uint32_t fluxo_parado_ms    = 10000;   // bancada 10 s / campo 30 s
    uint32_t tempo_max_ms       = 30000;   // bancada 30 s / campo 10 min
    float    nivel_min_pct      = 10.0f;   // AI1 abaixo disso nao libera (<0 desliga a regra)
    uint32_t estabilizacao_ms   = 1000;    // apos o boot: nada de pulso ate as entradas estabilizarem
    bool     exigir_matricula   = true;    // false = posto sem IHM: autoriza so' pela tag
    bool     tem_contator_aux   = true;    // false = sem BI1 ligada (nao espera confirmacao)
};

struct Entradas {
    bool  contator         = false;
    bool  automatico       = true;
    bool  emergencia       = false;
    bool  bico_no_suporte  = true;
    bool  nivel_baixo_boia = false;
    bool  boia_alta        = false;
    float nivel_pct        = -1.0f;
    float fluxo_lpm        = 0.0f;
};

struct Saidas {
    bool liga      = false;   // BO1 (pulso)
    bool permissao = false;   // BO2 (mantida)
    bool solenoide = false;   // BO3 (mantida)
    bool sinaleiro = false;   // BO4 (opcional: aceso enquanto autorizado/abastecendo)
};

struct Tag {
    char  uid[UID_LEN];
    char  mats[TAG_MAX_MATS][MAT_LEN];   // matriculas permitidas p/ esta maquina (vazio = qualquer cadastrada)
    uint8_t nmats;
    float limite_litros;                 // 0 = sem limite
};

// Lista local de autorizados (copia do NexON, sincronizada por MQTT retido).
class Lista {
public:
    Lista() { limpar(); }
    void limpar();
    bool adicionarTag(const char* uid, float limite);
    bool adicionarMatDaTag(const char* uid, const char* mat);
    bool adicionarMat(const char* mat);
    const Tag* tag(const char* uid) const;
    bool matCadastrada(const char* mat) const;
    // Decide offline. motivo: "tag" | "matricula" | "par" | "" ; limite_out = limite da tag.
    bool validar(const char* uid, const char* mat, bool exigirMat, char* motivo, float* limite_out) const;
    uint32_t versao = 0;
    int ntags() const { return _ntags; }
    int nmats() const { return _nmats; }
private:
    Tag  _tags[LISTA_MAX_TAGS]; int _ntags;
    char _mats[LISTA_MAX_MATS][MAT_LEN]; int _nmats;
};

struct Transacao {
    char      uid[UID_LEN];
    char      matricula[MAT_LEN];
    float     litros;
    uint32_t  inicio_ms, fim_ms;      // millis (o glue converte p/ epoch)
    float     nivel_antes, nivel_depois;
    char      fim_motivo[MOTIVO_LEN]; // concluido|fluxo_parado|emergencia|timeout|limite|nivel_baixo|manual|contator_colado|contator_caiu
    Validacao validacao;
};

// Quem consome os eventos (glue: MQTT/Serial; teste: coletor).
struct Ouvinte {
    virtual ~Ouvinte() {}
    virtual void aoPedirAutorizacao(const char* req_id, const char* uid, const char* mat) = 0;
    virtual void aoEvento(const char* tipo, const char* motivo, const char* uid, const char* mat) = 0;
    virtual void aoTransacao(const Transacao& t) = 0;
    virtual void aoMudarEstado(Estado de, Estado para) = 0;
};

class Maquina {
public:
    Maquina(const Config& cfg, Ouvinte* ouv);

    // Chamar a cada volta do loop com as entradas ja' lidas. Depois aplicar saidas().
    void tick(uint32_t now_ms, const Entradas& in);
    const Saidas& saidas() const { return _out; }
    Estado estado() const { return _st; }

    // Estimulos externos
    void cartao(const char* uid, uint32_t now_ms);
    void matricula(const char* mat, uint32_t now_ms);
    void respostaAuth(const char* req_id, bool ok, const char* motivo, float limite_litros, uint32_t now_ms);
    void rearme(uint32_t now_ms);
    void setOnline(bool online) { _online = online; }
    bool online() const { return _online; }
    bool otaPermitida() const { return _st == OCIOSA || _st == BLOQUEADA; }

    Lista& lista() { return _lista; }
    const Lista& lista() const { return _lista; }

    // Observabilidade (status/telemetria)
    float    litros() const { return _litros; }
    const char* uidAtual() const { return _uid; }
    const char* matAtual() const { return _mat; }
    const char* motivoBloqueio() const { return _motivo_bloq; }
    Validacao validacaoAtual() const { return _val; }
    const Entradas& entradas() const { return _in; }

private:
    void _ir(Estado novo, uint32_t now);
    void _negar(const char* motivo, uint32_t now);
    void _validar(uint32_t now);
    void _decidir(bool ok, const char* motivo, float limite, Validacao val, uint32_t now);
    bool _precondicoes(char* motivo) const;
    void _partir(uint32_t now);
    void _encerrar(const char* motivo, uint32_t now);
    void _fecharTransacao(uint32_t now);
    void _iniciarManual(uint32_t now);
    void _fecharManual(uint32_t now);

    Config   _cfg;
    Ouvinte* _ouv;
    Lista    _lista;
    Estado   _st;
    Saidas   _out;
    Entradas _in;
    bool     _online;
    uint32_t _t_estado;        // millis da entrada no estado atual
    uint32_t _t_boot;
    bool     _primeiroTick;
    uint32_t _last_tick;
    // sessao
    char     _uid[UID_LEN];
    char     _mat[MAT_LEN];
    char     _req[REQ_LEN];
    uint32_t _req_seq;
    float    _limite;
    Validacao _val;
    float    _litros;
    uint32_t _t_ini;
    float    _nivel_ini;
    bool     _bico_saiu;       // o bico saiu do suporte durante o abastecimento
    uint32_t _t_fluxo_zero;    // desde quando o fluxo esta zerado (0 = fluindo)
    bool     _fluxo_zero;
    char     _fim_motivo[MOTIVO_LEN];
    char     _motivo_bloq[MOTIVO_LEN];
    bool     _contator_ant;
    // manual
    bool     _man_ligado;
    uint32_t _man_t_ini;
    float    _man_litros;
    float    _man_nivel_ini;
};

} // namespace bomba

#endif // BOMBA_POSTO_H
