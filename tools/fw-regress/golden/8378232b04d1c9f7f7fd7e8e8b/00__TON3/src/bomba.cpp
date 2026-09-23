// bomba.cpp — glue gerado: POSTO DE COMBUSTIVEL na TON. A logica (estados, validacao,
// fins, contator colado, manual) esta em bomba_posto.cpp (lib pura, testada no host).
// Mapa: BO liga=1 permissao=2 solenoide=3 sinaleiro=4;
//       BI contator=1 auto=2 emerg=3 bico=4 boia_min=5 boia_alta=6;
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
#include <esp_system.h>

extern bool g_cmd_from_serial;   // main.cpp

#define BOMBA_PULSO_MS         500UL
#define BOMBA_ESPERA_BI1_MS    1000UL
#define BOMBA_JANELA_MAT_MS    60000UL
#define BOMBA_AUTH_TIMEOUT_MS  3000UL
#define BOMBA_FLUXO_PARADO_MS  10000UL
#define BOMBA_TEMPO_MAX_MS     30000UL
#define BOMBA_NIVEL_MIN_PCT    10.00f
#define BOMBA_EXIGIR_MAT       1
#define BOMBA_MAT_LIVRE        0   // 1 = matricula digitada nao e' conferida (opcao explicita)
#define BOMBA_SIM_CMDS         1   // 1 = bancada (TESTE/ ou Simular): card/mat/fluxo/net aceitos por MQTT; 0 = campo: so' pelo Serial
#define BOMBA_TELEMETRIA_MS    30000UL
#define BOMBA_NIVEL_BAIXO_MS   3000UL   // AI abaixo do minimo precisa persistir isto p/ encerrar (amostra ruim nao corta)
#define BOMBA_BOOT_SETTLE_MS   500UL    // espera as entradas do MCP estabilizarem (3 scans de 50 ms) antes do 1o tick
#define BOMBA_AI_0_MV          0.0f
#define BOMBA_AI_100_MV        3000.0f
#define BOMBA_K_FATOR          450.00f
#define BOMBA_UID_TESTE        "PC-07"
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
// Nivel (AI): MEDIANA das ultimas 9 amostras (1 a cada 20 ms). Uma amostra ruim (contato, ruido,
// glitch do ADC) nao vira "nivel baixo". Bancada 22/09: pilha com mau contato caia a 0 por 1 amostra.
static float _nivelPct() {
    static float am[9]; static uint8_t n = 0, idx = 0; static uint32_t t_am = 0;
    uint32_t now = millis();
    if (n == 0 || now - t_am >= 20) { t_am = now; am[idx] = adc_read_mv(1); idx = (uint8_t)((idx + 1) % 9); if (n < 9) n++; }
    float s[9]; for (uint8_t i = 0; i < n; i++) s[i] = am[i];
    for (uint8_t i = 1; i < n; i++) { float v = s[i]; int j = i - 1; while (j >= 0 && s[j] > v) { s[j + 1] = s[j]; j--; } s[j + 1] = v; }
    float mv = s[n / 2];
    float span = (BOMBA_AI_100_MV - BOMBA_AI_0_MV); if (span < 1.0f) span = 1.0f;
    float pct = (mv - BOMBA_AI_0_MV) / span * 100.0f;
    if (pct < 0) pct = 0; if (pct > 100) pct = 100;
    return pct;
}

// ---- persistencia (NVS ns "posto"): lista (JSON retido) + sessao em andamento ----
// Bloqueio (falha_partida / contator_colado) PERSISTE no NVS: reset ou queda de energia nao destrava —
// so' o comando/botao 'rearme' (bancada 22/09: o bloqueio sumia ao religar a TON).
static void _salvarBloqueio(const char* motivo) {
    Preferences pr; if (!pr.begin("posto", false)) return;
    if (motivo && motivo[0]) pr.putString("bloq", motivo); else pr.remove("bloq");
    pr.end();
}
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
    if (L.ntags() == 0) Serial.println("[BOMBA] AVISO: lista SEM tags — ninguem autorizado offline (fail-closed)");
#if BOMBA_EXIGIR_MAT && !BOMBA_MAT_LIVRE
    if (L.nmats() > 0) { /* ok */ } else {
        bool algumaTagComMat = false;
        for (int i = 0; i < L.ntags(); i++) { /* Lista nao expoe tags; o glue so' avisa pelo total */ (void)i; }
        (void)algumaTagComMat;
        Serial.println("[BOMBA] AVISO: lista sem matriculas — com 'exigir matricula' toda matricula sera NEGADA offline (ligue 'matricula livre' se for intencional)");
    }
#endif
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
        static unsigned long _tEstado = 0;
        unsigned long agora = millis();
        Serial.printf("[BOMBA] %s -> %s  (+%lu ms | t=%lu)\n", bomba::estadoNome(de), bomba::estadoNome(para), _tEstado ? (agora - _tEstado) : 0UL, agora);
        _tEstado = agora;
        if (para == bomba::ABASTECENDO) _salvarSessao(true);
        if (para == bomba::BLOQUEADA) _salvarBloqueio(_m ? _m->motivoBloqueio() : "restaurado");
        if (de == bomba::BLOQUEADA) _salvarBloqueio(nullptr);
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
// Entradas BI com anti-repique (debounce): chave seletora, botao de emergencia, gancho do bico e
// contato auxiliar sao mecanicos. A maquina so' ve o novo valor depois de BOMBA_DEBOUNCE_MS estavel,
// bit a bit (um contato oscilando nao segura os outros). Bancada 22/09: jumper da chave Auto mal
// preso gerou 8 trocas ociosa<->manual em 90 s (evento + transacao a cada troca).
#ifndef BOMBA_DEBOUNCE_MS
#define BOMBA_DEBOUNCE_MS 100
#endif
static uint8_t _lerBiFiltrado() {
    static uint8_t raw_ant = 0, estavel = 0; static uint32_t t_bit[8]; static bool init = false;
    uint8_t raw = inputs_get_state(); uint32_t now = millis();
    if (!init) { init = true; raw_ant = estavel = raw; for (int i = 0; i < 8; i++) t_bit[i] = now; return raw; }
    for (int i = 0; i < 8; i++) {
        uint8_t m = (uint8_t)(1u << i);
        if ((raw & m) != (raw_ant & m)) { raw_ant = (uint8_t)((raw_ant & ~m) | (raw & m)); t_bit[i] = now; }
        else if ((estavel & m) != (raw & m) && now - t_bit[i] >= BOMBA_DEBOUNCE_MS) {
            estavel = (uint8_t)((estavel & ~m) | (raw & m));
            Serial.printf("[BOMBA] BI%d -> %d (t=%lu)\n", i + 1, (raw & m) ? 1 : 0, (unsigned long)now);
        }
    }
    return estavel;
}

void bomba_init() {
    // Serial USB-CDC: se o host (monitor) parar de ler, escrever NAO pode bloquear o loop da bomba.
    Serial.setTxTimeoutMs(0);
    // WiFi: modem-sleep DESLIGADO neste firmware. Com o power-save padrao do ESP32 a entrega MQTT
    // chegava em rajadas 3..50 s atrasadas (perda de pacote + retransmissao TCP) e o auth/req tem
    // so' 3 s p/ ir e voltar. WIFI_PS_NONE custa ~60 mA a mais (TON e' alimentada por fonte 5 V/2 A).
    WiFi.setSleep(false);
    bomba::Config c;
    c.pulso_bo1_ms = BOMBA_PULSO_MS; c.espera_bi1_ms = BOMBA_ESPERA_BI1_MS; c.janela_mat_ms = BOMBA_JANELA_MAT_MS;
    c.auth_timeout_ms = BOMBA_AUTH_TIMEOUT_MS; c.fluxo_parado_ms = BOMBA_FLUXO_PARADO_MS; c.tempo_max_ms = BOMBA_TEMPO_MAX_MS;
    c.nivel_min_pct = BOMBA_NIVEL_MIN_PCT; c.nivel_baixo_ms = BOMBA_NIVEL_BAIXO_MS; c.exigir_matricula = BOMBA_EXIGIR_MAT != 0; c.matricula_livre = BOMBA_MAT_LIVRE != 0;
    c.tem_contator_aux = true;
    c.rng = esp_random;   // req_id do auth/req com nonce (T8.3)
    static bomba::Maquina m(c, &_ouv);
    _m = &m;
    // reles: garantidamente desligados no boot (relays_init ja fez; reforca)
    relay_set(1, false);
    relay_set(2, false);
    relay_set(3, false);
    relay_set(4, false);
    Preferences pr;
    String bloq;
    if (pr.begin("posto", true)) {
        String lista = pr.getString("lista", ""); bloq = pr.getString("bloq", ""); pr.end();
        if (lista.length()) _carregarLista(_m->lista(), lista.c_str(), false);
    }
    if (bloq.length()) {
        _m->bloquear(bloq.c_str(), millis());
        Serial.printf("[BOMBA] BLOQUEIO restaurado do NVS (%s): reset nao destrava, use 'rearme'\n", bloq.c_str());
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
    // Boot: o MCP so' tem estado valido apos 3 scans (150 ms); antes disso tudo le "aberto" e a maquina
    // entraria em MANUAL (evento espurio a cada boot). O filtro das BI inicializa depois da espera.
    static uint32_t t_boot = 0; if (!t_boot) t_boot = millis() ? millis() : 1;
    if (millis() - t_boot < BOMBA_BOOT_SETTLE_MS) return;
    if (publish && _pub != publish) {
        _pub = publish;
        _publicarSessaoInterrompida();
        for (uint8_t i = 0; i < _pubPendN; i++) _pub("evento", _pubPend[i]);
        _pubPendN = 0;
    }
    uint8_t st = _lerBiFiltrado();   // BI com anti-repique (100 ms, bit a bit)
    bomba::Entradas in;
    in.contator         = ((st >> 0) & 1);
    in.automatico       = ((st >> 1) & 1);
    in.emergencia       = !((st >> 2) & 1);          // NF: aberto = atuado
    in.bico_no_suporte  = ((st >> 3) & 1);
    in.nivel_baixo_boia = !((st >> 4) & 1);     // NF
    in.boia_alta        = !((st >> 5) & 1);   // NF
    in.nivel_pct        = _nivelPct();
    in.fluxo_lpm        = _fluxo_lpm;
    (void)st;
    _m->setOnline(!_net_forcado_off && mqtt_connected());
    _m->tick(millis(), in);
    const bomba::Saidas& o = _m->saidas();
    _aplicarRele(0, 1, o.liga);
    _aplicarRele(1, 2, o.permissao);
    _aplicarRele(2, 3, o.solenoide);
    _aplicarRele(3, 4, o.sinaleiro);
    if (_m->estado() == bomba::ABASTECENDO && millis() - _lastSessaoSave > 5000) { _lastSessaoSave = millis(); _salvarSessao(true); }
    if (millis() - _lastTel > BOMBA_TELEMETRIA_MS) { _lastTel = millis(); _telemetria(); }
}

bool bomba_cmd(const String& cmdIn, char* msg, size_t msg_sz) {
    if (!_m) return false;
    String cmd = cmdIn; cmd.trim();
    String low = cmd; low.toLowerCase();
#if !BOMBA_SIM_CMDS
    // Build de CAMPO: simulacao (card/mat/fluxo/net) so' com acesso fisico (Serial USB). Por MQTT: recusa.
    if (!g_cmd_from_serial && (low.startsWith("card") || low.startsWith("mat") || low.startsWith("fluxo") || low.startsWith("net "))) {
        Serial.printf("[BOMBA] comando de simulacao recusado por MQTT em build de campo: %s\n", cmd.c_str());
        snprintf(msg, msg_sz, "sim_cmd_recusado_build_campo"); return true;
    }
#endif
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
        Serial.printf("[BOMBA] estado=%s uid=%s mat=%s litros=%.2f nivel=%.0f%% (an1=%.0f an2=%.0f mV) fluxo=%.1f L/min | contator=%d auto=%d emerg=%d bico=%d boia_min=%d boia_alta=%d | online=%d lista=v%lu(%d) ver=%s\n",
            bomba::estadoNome(_m->estado()), _m->uidAtual(), _m->matAtual(), _m->litros(), e.nivel_pct, adc_read_mv(1), adc_read_mv(2), _fluxo_lpm,
            e.contator, e.automatico, e.emergencia, e.bico_no_suporte, e.nivel_baixo_boia, e.boia_alta,
            _m->online() ? 1 : 0, (unsigned long)_m->lista().versao, _m->lista().ntags(), FIRMWARE_VERSION);
        _telemetria();
        snprintf(msg, msg_sz, "status_%s", bomba::estadoNome(_m->estado())); return true;
    }
    return false;
}
