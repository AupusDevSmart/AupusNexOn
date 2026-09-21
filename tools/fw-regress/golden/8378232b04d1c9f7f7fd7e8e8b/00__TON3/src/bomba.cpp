// bomba.cpp — glue gerado: POSTO DE COMBUSTIVEL na TON. A logica (estados, validacao,
// fins, contator colado, manual) esta em bomba_posto.cpp (lib pura, testada no host).
// Mapa: BO liga=1 permissao=— solenoide=3 sinaleiro=—;
//       BI contator=— auto=— emerg=1 bico=— boia_min=— boia_alta=—;
//       AI nivel=1 (0..3000 mV = 0..100 %).
// Convencao BI: contato fechado ao GND = 1 (inputs_get_state). Emergencia/boias sao NF (aberto = atuado).
#include "bomba.h"
#include "config.h"
#include "bomba_posto.h"
#include "inputs.h"
#include "relays.h"
#include "adc.h"
#include "mqtt.h"
#include <WiFi.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

#define BOMBA_PULSO_MS         500UL
#define BOMBA_ESPERA_BI1_MS    1000UL
#define BOMBA_JANELA_MAT_MS    60000UL
#define BOMBA_AUTH_TIMEOUT_MS  3000UL
#define BOMBA_FLUXO_PARADO_MS  30000UL
#define BOMBA_TEMPO_MAX_MS     600000UL
#define BOMBA_NIVEL_MIN_PCT    5.00f
#define BOMBA_EXIGIR_MAT       1
#define BOMBA_TELEMETRIA_MS    30000UL
#define BOMBA_AI_0_MV          0.0f
#define BOMBA_AI_100_MV        3000.0f
#define BOMBA_K_FATOR          450.00f
#define BOMBA_UID_TESTE        "AABBCCDD"
#define BOMBA_MAT_TESTE        "1234"

static bomba::Maquina*  _m = nullptr;
static bomba_publish_fn _pub = nullptr;
static char   _pubPend[3][256]; static uint8_t _pubPendN = 0;   // eventos gerados antes do publish existir
static float  _fluxo_lpm = 0;         // bancada: comando "fluxo"; campo: fluxometro (bomba_set_fluxo)
static bool   _net_forcado_off = false;
static unsigned long _lastTel = 0, _lastSessaoSave = 0;
static bool   _relayLast[5] = {false,false,false,false,false};
static uint32_t _seqEvento = 0;
static bool   _sessaoAberta = false;

static void _emitir(const char* sub, const char* payload) {
    if (_pub) { _pub(sub, payload); return; }
    if (_pubPendN < 3) { strncpy(_pubPend[_pubPendN], payload, 255); _pubPend[_pubPendN][255] = 0; _pubPendN++; }
}
static long _epochDe(uint32_t ms) {
    time_t now = time(nullptr);
    if (now < 1700000000) return 0;   // sem NTP: 0 (o backend usa a hora de chegada)
    long delta = (long)((millis() - ms) / 1000UL);
    return (long)now - delta;
}
static float _nivelPct() {
    float span = (BOMBA_AI_100_MV - BOMBA_AI_0_MV); if (span < 1.0f) span = 1.0f;
    float pct = (adc_read_mv(0) - BOMBA_AI_0_MV) / span * 100.0f;
    if (pct < 0) pct = 0; if (pct > 100) pct = 100;
    return pct;
}

// ---- persistencia (NVS ns "posto"): lista (JSON retido) + sessao em andamento ----
static void _salvarSessao(bool aberta) {
    Preferences pr; if (!pr.begin("posto", false)) return;
    if (!aberta) { pr.remove("sessao"); pr.end(); _sessaoAberta = false; return; }
    char j[200];
    snprintf(j, sizeof(j), "{\"uid\":\"%s\",\"matricula\":\"%s\",\"inicio\":%ld,\"nivel_antes\":%.0f,\"litros\":%.2f,\"validacao\":\"%s\"}",
             _m->uidAtual(), _m->matAtual(), _epochDe(millis()), _m->entradas().nivel_pct, _m->litros(), bomba::validacaoNome(_m->validacaoAtual()));
    pr.putString("sessao", j); pr.end(); _sessaoAberta = true;
}
static void _publicarSessaoInterrompida() {
    Preferences pr; if (!pr.begin("posto", true)) return;
    String s = pr.getString("sessao", ""); pr.end();
    if (!s.length()) return;
    StaticJsonDocument<256> d; if (deserializeJson(d, s)) { _salvarSessao(false); return; }
    char p[300];
    snprintf(p, sizeof(p), "{\"uid\":\"%s\",\"matricula\":\"%s\",\"litros\":%.2f,\"inicio\":%ld,\"fim\":0,\"nivel_antes\":%.0f,\"nivel_depois\":%.0f,\"fim_motivo\":\"queda_energia\",\"validacao\":\"%s\",\"status\":\"queda_energia\"}",
             d["uid"] | "", d["matricula"] | "", (float)(d["litros"] | 0.0f), (long)(d["inicio"] | 0L), (float)(d["nivel_antes"] | -1.0f), _nivelPct(), d["validacao"] | "offline");
    _emitir("abastecimento", p);
    Serial.println("[BOMBA] sessao interrompida por queda de energia/reset: transacao publicada");
    _salvarSessao(false);
}
static void _carregarLista(bomba::Lista& L, const char* json, bool persistir) {
    // v2: {"versao":N,"tags":[{"uid":"PC-07","mats":["1234"],"limite":0}],"mats":["1234"]}
    // legado: {"uids":["AABBCCDD"]}
    DynamicJsonDocument d(6144);
    if (deserializeJson(d, json)) { Serial.println("[BOMBA] lista invalida (JSON)"); return; }
    L.limpar();
    L.versao = d["versao"] | 0;
    for (JsonVariant v : d["uids"].as<JsonArray>()) L.adicionarTag(v.as<const char*>(), 0);
    for (JsonObject t : d["tags"].as<JsonArray>()) {
        const char* uid = t["uid"] | ""; if (!*uid) continue;
        L.adicionarTag(uid, t["limite"] | 0.0f);
        for (JsonVariant m : t["mats"].as<JsonArray>()) L.adicionarMatDaTag(uid, m.as<const char*>());
    }
    for (JsonVariant m : d["mats"].as<JsonArray>()) L.adicionarMat(m.as<const char*>());
    Serial.printf("[BOMBA] lista v%lu: %d tags, %d matriculas\n", (unsigned long)L.versao, L.ntags(), L.nmats());
    if (persistir) {
        size_t n = strlen(json);
        Preferences pr; if (pr.begin("posto", false)) { if (n < 3900) pr.putString("lista", json); else Serial.println("[BOMBA] lista > 3,9 kB: nao persistida"); pr.end(); }
    }
}

// ---- ouvinte: maquina -> MQTT ----
struct _Ouv : public bomba::Ouvinte {
    void aoPedirAutorizacao(const char* req_id, const char* uid, const char* mat) override {
        char p[160];
        snprintf(p, sizeof(p), "{\"req_id\":\"%s\",\"uid\":\"%s\",\"matricula\":\"%s\",\"mac\":\"%s\"}", req_id, uid, mat, WiFi.macAddress().c_str());
        _emitir("auth/req", p);
        Serial.printf("[BOMBA] auth/req %s uid=%s mat=%s\n", req_id, uid, mat);
    }
    void aoEvento(const char* tipo, const char* motivo, const char* uid, const char* mat) override {
        char p[220];
        snprintf(p, sizeof(p), "{\"tipo\":\"%s\",\"motivo\":\"%s\",\"uid\":\"%s\",\"matricula\":\"%s\",\"seq\":%lu,\"ts\":%ld}",
                 tipo, motivo, uid ? uid : "", mat ? mat : "", (unsigned long)(++_seqEvento), _epochDe(millis()));
        _emitir("evento", p);
        Serial.printf("[BOMBA] evento %s (%s) uid=%s mat=%s\n", tipo, motivo, uid ? uid : "", mat ? mat : "");
    }
    void aoTransacao(const bomba::Transacao& t) override {
        char p[360];
        snprintf(p, sizeof(p),
            "{\"uid\":\"%s\",\"matricula\":\"%s\",\"litros\":%.2f,\"inicio\":%ld,\"fim\":%ld,\"nivel_antes\":%.0f,\"nivel_depois\":%.0f,"
            "\"fim_motivo\":\"%s\",\"validacao\":\"%s\",\"status\":\"%s\"}",
            t.uid, t.matricula, t.litros, _epochDe(t.inicio_ms), _epochDe(t.fim_ms), t.nivel_antes, t.nivel_depois,
            t.fim_motivo, bomba::validacaoNome(t.validacao), t.fim_motivo);
        _emitir("abastecimento", p);
        _salvarSessao(false);
        Serial.printf("[BOMBA] TRANSACAO %s uid=%s mat=%s litros=%.2f (%s)\n", t.fim_motivo, t.uid, t.matricula, t.litros, bomba::validacaoNome(t.validacao));
    }
    void aoMudarEstado(bomba::Estado de, bomba::Estado para) override {
        Serial.printf("[BOMBA] %s -> %s\n", bomba::estadoNome(de), bomba::estadoNome(para));
        if (para == bomba::ABASTECENDO) _salvarSessao(true);
        _lastTel = 0;   // forca telemetria na proxima volta
    }
};
static _Ouv _ouv;

static void _telemetria() {
    const bomba::Entradas& e = _m->entradas();
    char p[420];
    snprintf(p, sizeof(p),
        "{\"estado\":\"%s\",\"nivel_pct\":%.0f,\"litros\":%.2f,\"uid\":\"%s\",\"matricula\":\"%s\",\"lista_versao\":%lu,\"lista_tags\":%d,"
        "\"contator\":%d,\"automatico\":%d,\"emergencia\":%d,\"bico_no_suporte\":%d,\"boia_min\":%d,\"boia_alta\":%d,\"fluxo_lpm\":%.1f,"
        "\"online\":%d,\"validacao\":\"%s\",\"motivo_bloqueio\":\"%s\",\"ver\":\"%s\"}",
        bomba::estadoNome(_m->estado()), e.nivel_pct, _m->litros(), _m->uidAtual(), _m->matAtual(),
        (unsigned long)_m->lista().versao, _m->lista().ntags(),
        e.contator ? 1 : 0, e.automatico ? 1 : 0, e.emergencia ? 1 : 0, e.bico_no_suporte ? 1 : 0, e.nivel_baixo_boia ? 1 : 0, e.boia_alta ? 1 : 0,
        _fluxo_lpm, _m->online() ? 1 : 0, bomba::validacaoNome(_m->validacaoAtual()), _m->motivoBloqueio(), FIRMWARE_VERSION);
    _emitir("bomba", p);
}

static void _aplicarRele(int idx, int bo, bool on) {
    if (!bo) return;
    if (_relayLast[idx] == on) return;
    _relayLast[idx] = on;
    relay_set(bo, on);
}

// ---- API ----
void bomba_init() {
    bomba::Config c;
    c.pulso_bo1_ms = BOMBA_PULSO_MS; c.espera_bi1_ms = BOMBA_ESPERA_BI1_MS; c.janela_mat_ms = BOMBA_JANELA_MAT_MS;
    c.auth_timeout_ms = BOMBA_AUTH_TIMEOUT_MS; c.fluxo_parado_ms = BOMBA_FLUXO_PARADO_MS; c.tempo_max_ms = BOMBA_TEMPO_MAX_MS;
    c.nivel_min_pct = BOMBA_NIVEL_MIN_PCT; c.exigir_matricula = BOMBA_EXIGIR_MAT != 0;
    c.tem_contator_aux = false;
    static bomba::Maquina m(c, &_ouv);
    _m = &m;
    // reles: garantidamente desligados no boot (relays_init ja fez; reforca)
    relay_set(1, false);
    relay_set(3, false);
    Preferences pr;
    if (pr.begin("posto", true)) {
        String lista = pr.getString("lista", ""); pr.end();
        if (lista.length()) _carregarLista(_m->lista(), lista.c_str(), false);
    }
    Serial.printf("[OK] Posto de combustivel: maquina de estados (lista v%lu, %d tags) — comandos: card/mat/fluxo/status/rearme/net/lista\n",
                  (unsigned long)_m->lista().versao, _m->lista().ntags());
}

bool bomba_ota_permitida() { return !_m || _m->otaPermitida(); }

void bomba_set_lista(const char* json) { if (_m) _carregarLista(_m->lista(), json, true); }

void bomba_auth_resp(const char* json) {
    if (!_m) return;
    StaticJsonDocument<256> d;
    if (deserializeJson(d, json)) { Serial.println("[BOMBA] auth/resp invalida"); return; }
    _m->respostaAuth(d["req_id"] | "", d["ok"] | false, d["motivo"] | "", d["limite_litros"] | 0.0f, millis());
}

void bomba_loop(bomba_publish_fn publish) {
    if (!_m) return;
    if (publish && _pub != publish) {
        _pub = publish;
        _publicarSessaoInterrompida();
        for (uint8_t i = 0; i < _pubPendN; i++) _pub("evento", _pubPend[i]);
        _pubPendN = 0;
    }
    uint8_t st = inputs_get_state();
    bomba::Entradas in;
    in.contator         = false;
    in.automatico       = true;
    in.emergencia       = !((st >> 0) & 1);          // NF: aberto = atuado
    in.bico_no_suporte  = true;
    in.nivel_baixo_boia = false;     // NF
    in.boia_alta        = false;   // NF
    in.nivel_pct        = _nivelPct();
    in.fluxo_lpm        = _fluxo_lpm;
    (void)st;
    _m->setOnline(!_net_forcado_off && mqtt_connected());
    _m->tick(millis(), in);
    const bomba::Saidas& o = _m->saidas();
    _aplicarRele(0, 1, o.liga);
    _aplicarRele(1, 0, o.permissao);
    _aplicarRele(2, 3, o.solenoide);
    _aplicarRele(3, 0, o.sinaleiro);
    if (_m->estado() == bomba::ABASTECENDO && millis() - _lastSessaoSave > 5000) { _lastSessaoSave = millis(); _salvarSessao(true); }
    if (millis() - _lastTel > BOMBA_TELEMETRIA_MS) { _lastTel = millis(); _telemetria(); }
}

bool bomba_cmd(const String& cmdIn, char* msg, size_t msg_sz) {
    if (!_m) return false;
    String cmd = cmdIn; cmd.trim();
    String low = cmd; low.toLowerCase();
    if (low.startsWith("card ")) {
        String u = cmd.substring(5); u.trim(); u.toUpperCase();
        if (!u.length()) u = BOMBA_UID_TESTE;
        _m->cartao(u.c_str(), millis()); snprintf(msg, msg_sz, "card_%s_%s", u.c_str(), bomba::estadoNome(_m->estado())); return true;
    }
    if (low == "card") { _m->cartao(BOMBA_UID_TESTE, millis()); snprintf(msg, msg_sz, "card_%s", BOMBA_UID_TESTE); return true; }
    if (low.startsWith("mat ")) {
        String m = cmd.substring(4); m.trim();
        if (!m.length()) m = BOMBA_MAT_TESTE;
        _m->matricula(m.c_str(), millis()); snprintf(msg, msg_sz, "mat_%s_%s", m.c_str(), bomba::estadoNome(_m->estado())); return true;
    }
    if (low == "mat") { _m->matricula(BOMBA_MAT_TESTE, millis()); snprintf(msg, msg_sz, "mat_%s", BOMBA_MAT_TESTE); return true; }
    if (low.startsWith("fluxo")) {
        String v = cmd.substring(5); v.trim();
        _fluxo_lpm = v.length() ? v.toFloat() : 0.0f; if (_fluxo_lpm < 0) _fluxo_lpm = 0;
        snprintf(msg, msg_sz, "fluxo_%.1f_lpm", _fluxo_lpm); return true;
    }
    if (low == "rearme") { _m->rearme(millis()); snprintf(msg, msg_sz, "rearme_%s", bomba::estadoNome(_m->estado())); return true; }
    if (low == "net off") { _net_forcado_off = true;  snprintf(msg, msg_sz, "net_off_forcado"); return true; }
    if (low == "net on")  { _net_forcado_off = false; snprintf(msg, msg_sz, "net_on"); return true; }
    if (low == "lista") {
        const bomba::Lista& L = _m->lista();
        Serial.printf("[BOMBA] lista v%lu: %d tags, %d matriculas\n", (unsigned long)L.versao, L.ntags(), L.nmats());
        snprintf(msg, msg_sz, "lista_v%lu_%dtags", (unsigned long)L.versao, L.ntags()); return true;
    }
    if (low == "status") {
        const bomba::Entradas& e = _m->entradas();
        Serial.printf("[BOMBA] estado=%s uid=%s mat=%s litros=%.2f nivel=%.0f%% fluxo=%.1f L/min | contator=%d auto=%d emerg=%d bico=%d boia_min=%d boia_alta=%d | online=%d lista=v%lu(%d) ver=%s\n",
            bomba::estadoNome(_m->estado()), _m->uidAtual(), _m->matAtual(), _m->litros(), e.nivel_pct, _fluxo_lpm,
            e.contator, e.automatico, e.emergencia, e.bico_no_suporte, e.nivel_baixo_boia, e.boia_alta,
            _m->online() ? 1 : 0, (unsigned long)_m->lista().versao, _m->lista().ntags(), FIRMWARE_VERSION);
        _telemetria();
        snprintf(msg, msg_sz, "status_%s", bomba::estadoNome(_m->estado())); return true;
    }
    return false;
}
