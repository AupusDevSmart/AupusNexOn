// pivo.cpp — glue gerado: PIVO na TON (sequencia local, sem depender de internet).
// A logica (ligar/irrigar/paradas/desligar/seguranca) esta em pivo_local.cpp (lib pura,
// testada no host). Aqui: BI com polaridade por papel, BO por papel, ciclo do percentimetro,
// encoder -> angulo, NVS, comandos "pivo ..." e publicacao (status + eventos).
// Fonte canonica: AupusNexOn/firmware-libs/pivo_local/glue/. docs/IOT-PIVO-TON-LOCAL.md
//
// Comandos (minusculos; Serial ou <BASE>/cmd, tambem pelo LoRa):
//   pivo io <bo1..bo6> <bi1..bi6> <inv>   papeis BO: bomba valvula dir esq perc canhao
//                                         papeis BI: pressao tensao gir_dir gir_esq seguranca canhao
//                                         0 = nao ligado; inv = 6 digitos 0/1 (1 = BI ativa em baixo)
//   pivo tempos <tensao> <pressurizacao> <giro> <canhao> <bomba> <parada> <tolerancia> <sem_posicao> <janela_giro> <ciclo_perc>  (s)
//   pivo enc <resolucao> <inv 0|1> <zero_graus>      resolucao 0 = sem encoder
//   pivo ligar <id> <d|e> <agua 0|1> <permil> <canhao 0|1> <v|a|t> <valor> [s <ini>:<permil>:<canhao> ...]
//   pivo desligar [motivo] | pivo perc <permil> | pivo canhao <0|1> | pivo status | pivo cfg
// Compatibilidade (sequencia ainda no servidor, ate' a Fase 3): com a sequencia local PARADA,
//   perc <bo> <permil> <ciclo_s> <mascara> | perc off   (igual ao firmware anterior; mascara = DINs
//   de "girando", bit0 = DIN1: o ciclo so' roda com alguma delas em 1). Nao fica na NVS.
#include "pivo.h"
#include "config.h"
#include "pivo_local.h"
#include "inputs.h"
#include "relays.h"
#include <Preferences.h>
#include <math.h>
#include <string.h>
#include <stdlib.h>

using namespace pivo;

// Leitura imediata do encoder (gerada em modbus_meter.cpp quando ha' Encoder no RS485 desta TON).
// Fraca: firmware sem encoder nao define, e "pivo encler" responde pivo_sem_encoder.
extern bool pivo_encoder_amostrar() __attribute__((weak));

enum { BO_BOMBA = 0, BO_VALVULA, BO_DIR, BO_ESQ, BO_PERC, BO_CANHAO };
enum { BI_PRESSAO = 0, BI_TENSAO, BI_GIR_DIR, BI_GIR_ESQ, BI_SEGURANCA, BI_CANHAO };
#define PIVO_IO_MAX 8

// ---- configuracao (NVS "pivo"); sai da gravacao com o I/O PADRAO (BO01-06/BI01-06, ativo em alto):
// a TON ja' liga/desliga sozinha logo apos gravar. O NexON sobrescreve com "pivo io" se o mapa for outro.
static uint8_t  _bo[6] = {1, 2, 3, 4, 5, 6};
static uint8_t  _bi[6] = {1, 2, 3, 4, 5, 6};
static uint8_t  _inv = 0;                // bit k = BI do papel k ativa em baixo
// s: tensao, pressurizacao, giro, canhao, bomba, parada, tolerancia, sem_posicao, janela_giro, ciclo_perc
static uint32_t _tp[10] = {2, 120, 30, 30, 30, 60, 0, 300, 600, 60};   // tolerancia 0 = queda desliga na hora
static uint32_t _enc_res = 0;            // 0 = sem encoder
static bool     _enc_inv = false;
static float    _enc_zero = 0;
static bool     _cfg_ok = true;

// ---- estado do glue
static Maquina* _m = nullptr;
static int8_t   _apl[6] = {-1, -1, -1, -1, -1, -1};   // ultimo valor escrito por papel de BO
static unsigned long _perc_ini = 0;
static int16_t  _perc_pm_ciclo = -1;
static bool     _perc_on = false;
static volatile bool _enc_novo = false;
static float    _enc_bruto = 0;
static bool     _pub_agora = true;
static unsigned long _ult_pub = 0;
static uint8_t  _bi_ant = 0xFF;
static char     _falha_boot[16] = "";    // "reinicio": desligou irrigando (queda de energia/reset)
static bool     _ativo_nvs = false;
// Satelite LoRa mestre-puxa: frame espontaneo colide com o POLL do gateway (e com as
// entradas, que mudam no mesmo instante). O status vai so' na resposta ao POLL.
static bool     _so_poll = false;
static unsigned long _reafirma_ms = 0;   // ultima reafirmacao das saidas do pivo
static uint8_t  _bi_sem_atual = 0;       // entradas semanticas do ultimo pivo_tick()
// Satelite: mudanca de ESTADO (parado/ligando/irrigando/desligando) vai na hora (1 frame) + 1 repeticao
// em 8 s (o 1o pode colidir). Rara: nao satura o radio como os eventos de cada passo.
static int8_t   _e_pub = -1;             // ultimo estado publicado espontaneamente
static unsigned long _e_reforco_ms = 0;  // 0 = sem repeticao pendente
// percentimetro LEGADO (comando "perc" do servidor), so' com a sequencia local parada
static uint8_t  _leg_bo = 0;
static int16_t  _leg_pm = -1;            // -1 = desligado
static uint32_t _leg_ciclo_ms = 60000UL;
static uint8_t  _leg_mask = 0;
static unsigned long _leg_ini = 0;
static int8_t   _leg_saida = -1;

// ---- fila de eventos (o Ouvinte e' chamado dentro do tick; publica no loop)
struct EvPivo { char t[12]; char x[24]; char id[ID_LEN]; char e[12]; };
static EvPivo  _evq[12];
static uint8_t _evh = 0, _evn = 0;
static void _evPush(const char* t, const char* x) {
    EvPivo& v = _evq[(_evh + _evn) % 12];
    if (_evn == 12) _evh = (_evh + 1) % 12; else _evn++;   // cheia: descarta o mais velho
    strncpy(v.t, t, sizeof(v.t) - 1); v.t[sizeof(v.t) - 1] = 0;
    strncpy(v.x, x ? x : "", sizeof(v.x) - 1); v.x[sizeof(v.x) - 1] = 0;
    strncpy(v.id, _m ? _m->plano().id : "", sizeof(v.id) - 1); v.id[sizeof(v.id) - 1] = 0;
    strncpy(v.e, _m ? estadoNome(_m->estado()) : "", sizeof(v.e) - 1); v.e[sizeof(v.e) - 1] = 0;
}

static void _salvarAtivo(bool ativo) {
    if (ativo == _ativo_nvs) return;
    _ativo_nvs = ativo;
    Preferences pr;
    if (!pr.begin("pivo", false)) return;
    pr.putBool("at", ativo);
    if (ativo && _m) pr.putString("id", _m->plano().id);
    pr.end();
}

struct OuvinteGlue : Ouvinte {
    void aoEvento(const char* tipo, const char* det) override {
        Serial.printf("[PIVO] %s %s\n", tipo, det ? det : "");
        _evPush(tipo, det);
        _pub_agora = true;
    }
    void aoMudarEstado(Estado de, Estado para) override {
        Serial.printf("[PIVO] %s -> %s\n", estadoNome(de), estadoNome(para));
        if (para != PARADO) _falha_boot[0] = 0;
        _salvarAtivo(para != PARADO);
        _pub_agora = true;
    }
};
static OuvinteGlue _ouv;

static Config _montarConfig() {
    Config c;
    c.tem_valvula   = _bo[BO_VALVULA] != 0;
    c.tem_canhao    = _bo[BO_CANHAO] != 0;
    c.tem_pressao   = _bi[BI_PRESSAO] != 0;
    c.tem_tensao    = _bi[BI_TENSAO] != 0;
    c.tem_gir_dir   = _bi[BI_GIR_DIR] != 0;
    c.tem_gir_esq   = _bi[BI_GIR_ESQ] != 0;
    c.tem_seguranca = _bi[BI_SEGURANCA] != 0;
    c.tem_canhao_st = _bi[BI_CANHAO] != 0;
    c.tensao_ms          = _tp[0] * 1000UL;
    c.pressurizacao_ms   = _tp[1] * 1000UL;
    c.confirma_giro_ms   = _tp[2] * 1000UL;
    c.confirma_canhao_ms = _tp[3] * 1000UL;
    c.confirma_bomba_ms  = _tp[4] * 1000UL;
    c.confirma_parada_ms = _tp[5] * 1000UL;
    c.tolerancia_ms      = _tp[6] * 1000UL;
    c.sem_posicao_ms     = _tp[7] * 1000UL;
    c.janela_giro_ms     = _tp[8] * 1000UL;
    return c;
}

static void _salvarCfg() {
    Preferences pr;
    if (!pr.begin("pivo", false)) return;
    pr.putBytes("bo", _bo, sizeof(_bo));
    pr.putBytes("bi", _bi, sizeof(_bi));
    pr.putUChar("inv", _inv);
    pr.putBytes("tp", _tp, sizeof(_tp));
    pr.putUInt("er", _enc_res);
    pr.putBool("ei", _enc_inv);
    pr.putFloat("ez", _enc_zero);
    pr.putBool("ok", _cfg_ok);
    pr.end();
}

void pivo_init() {
    Preferences pr;
    char id[ID_LEN] = "";
    bool estava = false;
    if (pr.begin("pivo", true)) {
        if (pr.getBytesLength("bo") == sizeof(_bo)) pr.getBytes("bo", _bo, sizeof(_bo));
        if (pr.getBytesLength("bi") == sizeof(_bi)) pr.getBytes("bi", _bi, sizeof(_bi));
        _inv = pr.getUChar("inv", 0);
        if (pr.getBytesLength("tp") == sizeof(_tp)) pr.getBytes("tp", _tp, sizeof(_tp));
        _enc_res = pr.getUInt("er", 0);
        _enc_inv = pr.getBool("ei", false);
        _enc_zero = pr.getFloat("ez", 0);
        _cfg_ok = pr.getBool("ok", true);
        estava = pr.getBool("at", false);
        pr.getString("id", id, sizeof(id));
        pr.end();
    }
    for (int k = 0; k < 6; k++) { if (_bo[k] > PIVO_IO_MAX) _bo[k] = 0; if (_bi[k] > PIVO_IO_MAX) _bi[k] = 0; }
    static Maquina m(_montarConfig(), &_ouv);
    _m = &m;
    // Reles do pivo ja' saem desligados (RELAYS_RESTORE_ON_SW_RESET = 0): reinicio = pivo parado.
    if (estava) {
        // Desligou no meio de uma irrigacao (queda de energia, reset): avisa o NexON uma vez.
        strncpy(_falha_boot, "reinicio", sizeof(_falha_boot) - 1);
        _evPush("falha", "reinicio");
        strncpy(_evq[(_evh + _evn - 1) % 12].id, id, ID_LEN - 1);
        _ativo_nvs = true;
        _salvarAtivo(false);
    }
    Serial.printf("[PIVO] init: cfg=%d BO %u/%u/%u/%u/%u/%u BI %u/%u/%u/%u/%u/%u inv=0x%02X enc=%lu%s\n",
        _cfg_ok, _bo[0], _bo[1], _bo[2], _bo[3], _bo[4], _bo[5], _bi[0], _bi[1], _bi[2], _bi[3], _bi[4], _bi[5],
        _inv, (unsigned long)_enc_res, estava ? " (estava irrigando: reinicio)" : "");
}

bool pivo_ocioso() { return !_m || _m->estado() == PARADO; }
void pivo_encoder_bruto(float bruto) { _enc_bruto = bruto; _enc_novo = true; }
void pivo_publicar_agora() { _pub_agora = true; _ult_pub = 0; }
void pivo_so_no_poll(bool so_poll) { _so_poll = so_poll; }

static bool _biPapel(uint8_t st, int papel) {
    uint8_t n = _bi[papel];
    if (!n) return false;
    bool v = (st >> (n - 1)) & 1;
    return (_inv >> papel) & 1 ? !v : v;
}

static void _setBo(int papel, bool on) {
    uint8_t n = _bo[papel];
    if (!n) return;
    int8_t v = on ? 1 : 0;
    if (_apl[papel] == v) return;
    _apl[papel] = v;
    relay_set(n, on);
}

// Ciclo do percentimetro: a BO anda permil/1000 do ciclo. So' roda com o lado confirmado
// (BI girando do lado, ou o comando do lado quando nao ha BI). Troca de % vale no proximo ciclo.
static bool _percSaida(int16_t pm, bool ladoOk, unsigned long now) {
    if (pm < 0) { _perc_ini = 0; _perc_pm_ciclo = -1; return false; }
    if (!ladoOk) { _perc_ini = 0; return false; }
    uint32_t ciclo = _tp[9] * 1000UL;
    if (!_perc_ini || now - _perc_ini >= ciclo) { _perc_ini = now ? now : 1; _perc_pm_ciclo = pm; }
    uint32_t on_ms = (uint32_t)(((uint64_t)ciclo * (uint32_t)_perc_pm_ciclo) / 1000ULL);
    return (now - _perc_ini) < on_ms;
}

static float _anguloDe(float bruto) {
    double r = fmod((double)bruto, (double)_enc_res);
    if (r < 0) r += _enc_res;
    float g = (float)(r * 360.0 / (double)_enc_res);
    if (_enc_inv) g = 360.0f - g;
    g += _enc_zero;
    while (g >= 360.0f) g -= 360.0f;
    while (g < 0.0f) g += 360.0f;
    return g;
}

static void _publicarStatus(pivo_publish_fn pub) {
    const Saidas& o = _m->saidas();
    const Entradas& in = _m->entradas();
    uint8_t bi = (in.pressao ? 1 : 0) | (in.tensao ? 2 : 0) | (in.gir_dir ? 4 : 0) | (in.gir_esq ? 8 : 0) | (in.desalinhado ? 16 : 0) | (in.canhao ? 32 : 0);
    uint8_t bo = (o.bomba ? 1 : 0) | (o.valvula ? 2 : 0) | (o.dir ? 4 : 0) | (o.esq ? 8 : 0) | (_perc_on ? 16 : 0) | (o.canhao ? 32 : 0);
    const char* f = _m->falha()[0] ? _m->falha() : _falha_boot;
    char an[12];
    if (_m->temPosicao()) snprintf(an, sizeof(an), "%.1f", _m->angulo()); else strcpy(an, "null");
    const Plano& p = _m->plano();
    // Compacto: o satelite LoRa aceita ate' ~120 B de conteudo (MTU 200 com o envelope).
    // e = estado (0 parado, 1 ligando, 2 irrigando, 3 desligando); p = passo (pivo::Passo);
    // f = falha; pc/al = graus percorridos/alvo (inteiros; al -1 = sem alvo); c = config recebida.
    // bi: bit0 pressao, 1 tensao, 2 gir_dir, 3 gir_esq, 4 desalinhado, 5 canhao.
    // bo: bit0 bomba, 1 valvula, 2 dir, 3 esq, 4 percentimetro (fase ON), 5 canhao, 6 GIRANDO (perc > 0 e angulo mudando).
    if (_m->girando(millis())) bo |= 64;
    char payload[160];
    snprintf(payload, sizeof(payload),
        "{\"e\":%d,\"p\":%d,\"f\":\"%s\",\"d\":\"%c\",\"a\":%d,\"pm\":%d,\"an\":%s,\"pc\":%ld,\"al\":%ld,\"sg\":%d,\"bi\":%u,\"bo\":%u,\"c\":%d}",
        (int)_m->estado(), (int)_m->passo(), f, p.dir, p.com_agua ? 1 : 0, (int)o.perc_pm,
        an, (long)lroundf(_m->percorrido()), (long)lroundf(_m->alvo()), _m->segmentoAtual(), bi, bo, _cfg_ok ? 1 : 0);
    if (pub) pub("pivo", payload);
}

void pivo_publicar(pivo_publish_fn publish) {
    if (!_m || !publish) return;
    _pub_agora = false;
    _ult_pub = millis() ? millis() : 1;
    _publicarStatus(publish);
    _e_pub = (int8_t)_m->estado();   // o POLL ja' levou este estado
}

// Controle do pivo: entradas -> maquina -> saidas. Sem radio/MQTT: e' chamado logo apos o
// inputs_scan() (a BO bate no mesmo ciclo em que a BI mudou) e de novo no pivo_loop().
void pivo_tick() {
    if (!_m) return;
    unsigned long now = millis();
    uint8_t st = inputs_get_state();
    Entradas in;
    in.pressao     = _biPapel(st, BI_PRESSAO);
    in.tensao      = _biPapel(st, BI_TENSAO);
    in.gir_dir     = _biPapel(st, BI_GIR_DIR);
    in.gir_esq     = _biPapel(st, BI_GIR_ESQ);
    in.desalinhado = _biPapel(st, BI_SEGURANCA);
    in.canhao      = _biPapel(st, BI_CANHAO);

    if (_enc_novo) {
        _enc_novo = false;
        if (_enc_res) _m->posicao(_anguloDe(_enc_bruto), now);
    }
    _m->tick(now, in);

    // Expansor de reles sem controle (I2C): o rele pode estar preso em qualquer estado. Pivo
    // ligado -> desliga com falha; parado -> recusa ligar (pivo_cmd). Nao da' para confiar na saida.
    if (relays_io_fault()) {
        if (_m->estado() == LIGANDO || _m->estado() == IRRIGANDO) {
            _m->desligar("falha_reles", now);
            strncpy(_falha_boot, "falha_reles", sizeof(_falha_boot) - 1);
            Serial.println("[PIVO] FALHA: reles sem controle (I2C) - desligando o pivo");
        }
    }
    // Reafirma TODAS as saidas do pivo a cada 1 s (nao confia no cache: escrita perdida ou rele
    // mexido por fora volta ao estado que a sequencia quer em ate' 1 s).
    if (now - _reafirma_ms >= 1000UL) {
        _reafirma_ms = now ? now : 1;
        for (int k = 0; k < 6; k++) _apl[k] = -1;
    }
    // Saidas (mantidas) + ciclo do percentimetro. Ordem: DESLIGA antes de ligar, e os dois
    // sentidos nunca em alto juntos (intertravamento por software alem da lib).
    const Saidas& o = _m->saidas();
    bool qDir = o.dir, qEsq = o.esq;
    if (qDir && qEsq) { qDir = false; qEsq = false; Serial.println("[PIVO] BUG: dir e esq pedidos juntos - os dois em OFF"); }
    if (!qDir) _setBo(BO_DIR, false);
    if (!qEsq) _setBo(BO_ESQ, false);
    if (!o.bomba) _setBo(BO_BOMBA, false);
    if (!o.valvula) _setBo(BO_VALVULA, false);
    if (!o.canhao) _setBo(BO_CANHAO, false);
    if (qDir) _setBo(BO_DIR, true);   // o oposto ja' foi para OFF acima (e e' reafirmado a cada 1 s)
    if (qEsq) _setBo(BO_ESQ, true);
    if (o.bomba) _setBo(BO_BOMBA, true);
    if (o.valvula) _setBo(BO_VALVULA, true);
    if (o.canhao) _setBo(BO_CANHAO, true);
    bool ladoOk = (o.dir && (!_bi[BI_GIR_DIR] || in.gir_dir)) || (o.esq && (!_bi[BI_GIR_ESQ] || in.gir_esq));
    if (_m->estado() == PARADO && _leg_pm >= 0 && _leg_bo) {
        // Percentimetro legado (servidor): ciclo na BO pedida, so' com DIN de girando em 1.
        bool gir = !_leg_mask || (st & _leg_mask);
        bool on = false;
        if (!gir) _leg_ini = 0;
        else {
            if (!_leg_ini || now - _leg_ini >= _leg_ciclo_ms) _leg_ini = now ? now : 1;
            on = (now - _leg_ini) < (uint32_t)(((uint64_t)_leg_ciclo_ms * (uint32_t)_leg_pm) / 1000ULL);
        }
        if (_leg_saida != (on ? 1 : 0)) { _leg_saida = on ? 1 : 0; relay_set(_leg_bo, on); }
        _perc_on = on;
        for (int k = 0; k < 6; k++) if (_bo[k] == _leg_bo) _apl[k] = -1;   // a sequencia local reescreve ao assumir
    } else {
        if (_leg_pm >= 0 && _m->estado() != PARADO) { _leg_pm = -1; _leg_saida = -1; }   // sequencia local assumiu
        _perc_on = _percSaida(o.perc_pm, ladoOk, now);
        _setBo(BO_PERC, _perc_on);
    }
    _bi_sem_atual = (in.pressao ? 1 : 0) | (in.tensao ? 2 : 0) | (in.gir_dir ? 4 : 0) | (in.gir_esq ? 8 : 0) | (in.desalinhado ? 16 : 0) | (in.canhao ? 32 : 0);
}

void pivo_loop(pivo_publish_fn publish) {
    if (!_m) return;
    pivo_tick();
    unsigned long now = millis();

    // Publicacao: eventos na hora; status na mudanca (min 1 s) e a cada 30 s ligado / 60 s parado
    if (_bi_sem_atual != _bi_ant) { _bi_ant = _bi_sem_atual; _pub_agora = true; }
    // Satelite LoRa: eventos NAO vao pelo radio (cada frame trava o loop ~0,5-0,8 s esperando o
    // radio e ocupa o canal dos comandos). Estado/passo/falha vao no status do POLL e no ack do
    // "pivo status". Descarta a fila.
    if (_so_poll) _evn = 0;
    while (_evn && publish) {
        EvPivo& v = _evq[_evh];
        char ev[128];
        snprintf(ev, sizeof(ev), "{\"t\":\"%s\",\"x\":\"%s\",\"e\":\"%s\",\"id\":\"%s\"}", v.t, v.x, v.e, v.id);
        publish("pivo/evento", ev);
        _evh = (_evh + 1) % 12; _evn--;
    }
    unsigned long periodo = _m->estado() == PARADO ? 60000UL : 30000UL;
    if (_so_poll) {
        // satelite mestre-puxa: status no POLL; so' a MUDANCA DE ESTADO sai na hora
        int8_t e = (int8_t)_m->estado();
        if (_e_pub < 0) _e_pub = e;                        // boot: o 1o POLL leva o estado
        if (e != _e_pub && publish) {
            _e_pub = e;
            _publicarStatus(publish);
            _e_reforco_ms = now + 8000UL; if (!_e_reforco_ms) _e_reforco_ms = 1;
        } else if (_e_reforco_ms && (long)(now - _e_reforco_ms) >= 0 && publish) {
            _e_reforco_ms = 0;
            _publicarStatus(publish);
        }
        return;
    }
    if ((_pub_agora && now - _ult_pub >= 1000UL) || !_ult_pub || now - _ult_pub >= periodo) {
        _pub_agora = false;
        _ult_pub = now ? now : 1;
        _publicarStatus(publish);
    }
}

// ---------------------------------------------------------------- comandos

static int _ok(char* msg, size_t sz, const char* m) { snprintf(msg, sz, "%s", m); return 1; }
static int _erro(char* msg, size_t sz, const char* m) { snprintf(msg, sz, "%s", m); return 0; }

static int _cmdLigar(char* args, char* msg, size_t sz) {
    if (!_cfg_ok) return _erro(msg, sz, "pivo_sem_config");
    if (relays_io_fault()) return _erro(msg, sz, "pivo_falha_reles");
    Plano p;
    char* sv = nullptr;
    char* tok = strtok_r(args, " ", &sv);
    if (!tok) return _erro(msg, sz, "pivo_ligar_invalido");
    strncpy(p.id, tok, ID_LEN - 1);
    const char* d = strtok_r(nullptr, " ", &sv);
    const char* ag = strtok_r(nullptr, " ", &sv);
    const char* pm = strtok_r(nullptr, " ", &sv);
    const char* cn = strtok_r(nullptr, " ", &sv);
    const char* pt = strtok_r(nullptr, " ", &sv);
    const char* pv = strtok_r(nullptr, " ", &sv);
    if (!d || !ag || !pm || !cn || !pt || !pv) return _erro(msg, sz, "pivo_ligar_invalido");
    p.dir = (d[0] == 'e') ? 'E' : (d[0] == 'd') ? 'D' : '?';
    p.com_agua = atoi(ag) != 0;
    p.pm = (int16_t)atoi(pm);
    p.canhao = atoi(cn) != 0;
    if (pt[0] == 'v') { p.parada = POR_VOLTAS; p.voltas = atof(pv); }
    else if (pt[0] == 'a') { p.parada = POR_ANGULO; p.angulo = atof(pv); }
    else if (pt[0] == 't') { p.parada = POR_DURACAO; p.duracao_s = (uint32_t)strtoul(pv, nullptr, 10); }
    else return _erro(msg, sz, "pivo_parada_invalida");
    const char* s = strtok_r(nullptr, " ", &sv);
    if (s && s[0] == 's') {
        while ((tok = strtok_r(nullptr, " ", &sv)) != nullptr && p.nseg < MAX_SEG) {
            float ini = 0; int spm = 0, sc = 0;
            if (sscanf(tok, "%f:%d:%d", &ini, &spm, &sc) < 2) return _erro(msg, sz, "pivo_segmento_invalido");
            p.seg[p.nseg].ini_grau = ini; p.seg[p.nseg].pm = (int16_t)spm; p.seg[p.nseg].canhao = sc != 0;
            p.nseg++;
        }
    }
    // I/O minimo para o plano
    if ((p.dir == 'D' && !_bo[BO_DIR]) || (p.dir == 'E' && !_bo[BO_ESQ]) || !_bo[BO_PERC] || (p.com_agua && !_bo[BO_BOMBA]))
        return _erro(msg, sz, "pivo_io_incompleto");
    if ((p.parada != POR_DURACAO || p.nseg) && !_enc_res) return _erro(msg, sz, "pivo_sem_encoder");
    char mot[40];
    if (!_m->ligar(p, millis(), mot, sizeof(mot))) { snprintf(msg, sz, "pivo_%s", mot); return 0; }
    return _ok(msg, sz, "pivo_ligando");
}

// "perc ..." do firmware anterior (sequencia no servidor). -1 = nao e' perc.
static int _cmdPercLegado(const String& cmd, char* msg, size_t sz) {
    if (!cmd.startsWith("perc")) return -1;
    if (_m && _m->estado() != PARADO) return _erro(msg, sz, "perc_pivo_local_ligado");
    if (cmd.indexOf("off") >= 0) {
        if (_leg_bo) relay_set(_leg_bo, false);
        _leg_pm = -1; _leg_ini = 0; _leg_saida = -1; _perc_on = false;
        for (int k = 0; k < 6; k++) if (_bo[k] == _leg_bo) _apl[k] = -1;
        return _ok(msg, sz, "perc_off");
    }
    int bo = 0, pm = -1, cy = 60, mk = 0;
    if (sscanf(cmd.c_str(), "perc %d %d %d %d", &bo, &pm, &cy, &mk) < 2 || bo < 1 || bo > PIVO_IO_MAX || pm < 0 || pm > 1000 || cy < 5 || cy > 600 || mk < 0 || mk > 255)
        return _erro(msg, sz, "perc_invalido");
    if (_leg_bo && _leg_bo != bo) relay_set(_leg_bo, false);
    bool emCiclo = _leg_pm >= 0 && _leg_bo == bo && _leg_ini;
    _leg_bo = (uint8_t)bo; _leg_ciclo_ms = (uint32_t)cy * 1000UL; _leg_mask = (uint8_t)mk; _leg_pm = (int16_t)pm;
    if (!emCiclo) { _leg_ini = 0; _leg_saida = -1; }
    Serial.printf("[PIVO] perc legado: BO%d %d.%d%% ciclo %ds mascara 0x%02X\n", bo, pm / 10, pm % 10, cy, mk);
    snprintf(msg, sz, "perc_%d_%d", bo, pm);
    return 1;
}

int pivo_cmd(const String& cmd, char* msg, size_t sz) {
    { int r = _cmdPercLegado(cmd, msg, sz); if (r >= 0) return r; }
    if (!cmd.startsWith("pivo ") && cmd != "pivo") return -1;
    if (!_m) return _erro(msg, sz, "pivo_nao_iniciado");
    char buf[200];
    String a = cmd.substring(4); a.trim();
    strncpy(buf, a.c_str(), sizeof(buf) - 1); buf[sizeof(buf) - 1] = 0;
    char* sv = nullptr;
    char* verbo = strtok_r(buf, " ", &sv);
    char* resto = sv;
    if (!verbo) return _erro(msg, sz, "pivo_cmd_vazio");

    if (!strcmp(verbo, "ligar")) return _cmdLigar(resto ? resto : (char*)"", msg, sz);

    if (!strcmp(verbo, "desligar")) {
        char mot[20] = "comando";
        if (resto && *resto) { strncpy(mot, resto, sizeof(mot) - 1); mot[sizeof(mot) - 1] = 0; for (char* c = mot; *c; c++) if (*c == ' ' || *c == '"' || *c == '\\') *c = '_'; }
        Estado e = _m->estado();
        if (_m->desligar(mot, millis())) return _ok(msg, sz, "pivo_desligando");
        if (e == PARADO) {
            // Sequencia local parada, mas as BOs podem ter sido ligadas por fora (rN on, sequencia
            // antiga no servidor, percentimetro legado): desliga TODAS as BOs do pivo na hora.
            for (int k = 0; k < 6; k++) if (_bo[k]) { relay_set(_bo[k], false); _apl[k] = 0; }
            if (_leg_bo) relay_set(_leg_bo, false);
            _leg_pm = -1; _leg_ini = 0; _leg_saida = -1; _perc_on = false;
            pivo_publicar_agora();
            return _ok(msg, sz, "pivo_ja_parado");
        }
        return _ok(msg, sz, "pivo_ja_desligando");
    }
    if (!strcmp(verbo, "perc")) {
        char mot[32];
        int pm = resto ? atoi(resto) : -1;
        if (!_m->ajustarPercentimetro((int16_t)pm, mot, sizeof(mot))) { snprintf(msg, sz, "pivo_%s", mot); return 0; }
        snprintf(msg, sz, "pivo_perc_%d", pm);
        return 1;
    }
    if (!strcmp(verbo, "canhao")) {
        char mot[32];
        bool on = resto && atoi(resto) != 0;
        if (!_m->comandarCanhao(on, millis(), mot, sizeof(mot))) { snprintf(msg, sz, "pivo_canhao_%s", mot); return 0; }
        _apl[BO_CANHAO] = -1;   // reescreve a BO06 (alguem pode ter mexido no rele por fora)
        return _ok(msg, sz, on ? "pivo_canhao_on" : "pivo_canhao_off");
    }
    if (!strcmp(verbo, "status")) {
        // Estado no proprio ack (chega mesmo no satelite LoRa, onde o status so' sai no POLL):
        // "pivo_st <estado> <passo> <permil> <falha|->" — estado 0 parado, 1 ligando, 2 irrigando, 3 desligando.
        pivo_publicar_agora();
        const char* f = _m->falha()[0] ? _m->falha() : (_falha_boot[0] ? _falha_boot : "-");
        snprintf(msg, sz, "pivo_st %d %d %d %s", (int)_m->estado(), (int)_m->passo(), (int)_m->saidas().perc_pm, f);
        return 1;
    }
    if (!strcmp(verbo, "encler")) {
        // Calibracao do angulo (NEXON-103): 5 leituras Modbus SEGUIDAS do encoder, so' com o pivo parado
        // (a leitura bloqueia o loop). Tudo no proprio ack, que chega ate' pelo LoRa:
        //   "pivo_el <v1> <v2> <v3> <v4> <v5>"  as 5 leituras boas (contagem crua)
        //   "pivo_el_erro <n>"                  falhou depois de n leituras boas (erro ou timeout)
        // Quem decide se vale (iguais ou +-1) e' o NexON. Devolve 1 nos dois casos: a TON respondeu.
        if (_m->estado() != PARADO) return _erro(msg, sz, "pivo_ligado");
        if (!pivo_encoder_amostrar) return _erro(msg, sz, "pivo_sem_encoder");
        size_t n = (size_t)snprintf(msg, sz, "pivo_el");
        for (int k = 0; k < 5; k++) {
            if (k) delay(60);
            _enc_novo = false;
            if (!pivo_encoder_amostrar() || !_enc_novo) { snprintf(msg, sz, "pivo_el_erro %d", k); return 1; }
            if (n < sz) n += (size_t)snprintf(msg + n, sz - n, " %lu", (unsigned long)lroundf(_enc_bruto));
        }
        return 1;
    }
    if (!strcmp(verbo, "cfg")) {
        Serial.printf("[PIVO] cfg=%d BO %u %u %u %u %u %u | BI %u %u %u %u %u %u inv=0x%02X | tempos %lu %lu %lu %lu %lu %lu %lu %lu %lu %lu | enc %lu inv=%d zero=%.1f\n",
            _cfg_ok, _bo[0], _bo[1], _bo[2], _bo[3], _bo[4], _bo[5], _bi[0], _bi[1], _bi[2], _bi[3], _bi[4], _bi[5], _inv,
            (unsigned long)_tp[0], (unsigned long)_tp[1], (unsigned long)_tp[2], (unsigned long)_tp[3], (unsigned long)_tp[4],
            (unsigned long)_tp[5], (unsigned long)_tp[6], (unsigned long)_tp[7], (unsigned long)_tp[8], (unsigned long)_tp[9],
            (unsigned long)_enc_res, _enc_inv, _enc_zero);
        return _ok(msg, sz, "pivo_cfg_printed");
    }

    // Configuracao: so' com o pivo parado (trocar I/O com saida ligada deixaria rele preso).
    bool cfgCmd = !strcmp(verbo, "io") || !strcmp(verbo, "tempos") || !strcmp(verbo, "enc");
    if (cfgCmd && _m->estado() != PARADO) return _erro(msg, sz, "pivo_ligado");

    if (!strcmp(verbo, "io")) {
        int b[6], i[6]; char inv[8] = "";
        if (!resto || sscanf(resto, "%d %d %d %d %d %d %d %d %d %d %d %d %7s",
                &b[0], &b[1], &b[2], &b[3], &b[4], &b[5], &i[0], &i[1], &i[2], &i[3], &i[4], &i[5], inv) != 13 || strlen(inv) != 6)
            return _erro(msg, sz, "pivo_io_invalido");
        for (int k = 0; k < 6; k++) {
            if (b[k] < 0 || b[k] > PIVO_IO_MAX || i[k] < 0 || i[k] > PIVO_IO_MAX) return _erro(msg, sz, "pivo_io_faixa");
            for (int j = 0; j < k; j++) if (b[k] && b[k] == b[j]) return _erro(msg, sz, "pivo_bo_repetida");
            if (inv[k] != '0' && inv[k] != '1') return _erro(msg, sz, "pivo_inv_invalido");
        }
        // Desliga as BOs antigas antes de trocar o mapa
        for (int k = 0; k < 6; k++) if (_bo[k]) relay_set(_bo[k], false);
        uint8_t m = 0;
        for (int k = 0; k < 6; k++) { _bo[k] = (uint8_t)b[k]; _bi[k] = (uint8_t)i[k]; if (inv[k] == '1') m |= (1 << k); _apl[k] = -1; }
        _inv = m;
        _cfg_ok = true;
        _salvarCfg();
        _m->configurar(_montarConfig());
        pivo_publicar_agora();
        return _ok(msg, sz, "pivo_io_ok");
    }
    if (!strcmp(verbo, "tempos")) {
        unsigned long t[10];
        if (!resto || sscanf(resto, "%lu %lu %lu %lu %lu %lu %lu %lu %lu %lu", &t[0], &t[1], &t[2], &t[3], &t[4], &t[5], &t[6], &t[7], &t[8], &t[9]) != 10)
            return _erro(msg, sz, "pivo_tempos_invalido");
        static const unsigned long lo[10] = {1, 5, 5, 5, 5, 5, 0, 30, 30, 5};   // tolerancia aceita 0 (instantaneo)
        static const unsigned long hi[10] = {60, 1800, 600, 600, 600, 600, 60, 3600, 3600, 600};
        for (int k = 0; k < 10; k++) if (t[k] < lo[k] || t[k] > hi[k]) return _erro(msg, sz, "pivo_tempos_faixa");
        for (int k = 0; k < 10; k++) _tp[k] = (uint32_t)t[k];
        _salvarCfg();
        _m->configurar(_montarConfig());
        return _ok(msg, sz, "pivo_tempos_ok");
    }
    if (!strcmp(verbo, "enc")) {
        unsigned long res = 0; int inv = 0; float zero = 0;
        if (!resto || sscanf(resto, "%lu %d %f", &res, &inv, &zero) != 3 || (res != 0 && (res < 2 || res > 1000000UL)) || !(zero >= -360.0f && zero <= 360.0f))
            return _erro(msg, sz, "pivo_enc_invalido");
        _enc_res = (uint32_t)res; _enc_inv = inv != 0; _enc_zero = zero;
        _salvarCfg();
        return _ok(msg, sz, "pivo_enc_ok");
    }
    return _erro(msg, sz, "pivo_cmd_desconhecido");
}
