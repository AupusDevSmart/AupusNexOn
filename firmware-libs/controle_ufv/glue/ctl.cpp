// ctl.cpp — glue do controle da UFV pelo MED (lib controle_ufv). Ver ctl.h.
//
// Comandos (texto, via <BASE>/cmd, LoRa ou Serial):
//   ctl geral <n> <t2_s> <bi> <bi_inv>                  cadastro: n inversores, estagio 2, BI manual (0 = sem)
//   ctl cfg <i> <addr> <p1> <p2> <pman> <rampa> <device> cadastro do inversor i (1..n), valores BRUTOS
//   ctl <seq> <ttl_s> [<i> <p> <q>]...                  setpoint com validade (sem trincas = so' renova)
//   ctl off                                             desliga o controle: P = pman, Q = 0, sem watchdog
//   ctl status | ctl limpar
// Resposta: "<modo> c=<hash do cadastro> [s= m= p=] 1:ok 2:= ..." — o backend compara o hash com o
// cadastro dele e reenvia "geral"/"cfg" quando difere (TON trocada, NVS apagado, cadastro alterado).
#include "ctl.h"
#include "controle_ufv.h"
#include <Preferences.h>
#include <stdlib.h>
#include <string.h>

extern uint8_t inputs_get_state();

using namespace cufv;

static Controle _c;
static char _lin[1 + MAX_INV][100];   // linhas do cadastro EXATAMENTE como chegaram (o hash e' delas)
static bool _at_nvs = false;
static uint16_t _ttl_nvs = 0;
static Modo _modo_log = DESLIGADO;
static unsigned long _ult_tick = 0;

static Res _escrever(const char* dev, uint16_t addr, Sp sp, int32_t v, int32_t* lido) {
    const char* cid = sp == SP_P ? "sp_limite_pct" : "sp_q_pct";
    int r = ctl_escrever_sp(dev, addr, cid, v, lido);
    Serial.printf("[CTL] %s@%u %s=%ld -> %s", dev, (unsigned)addr, cid, (long)v,
                  r == 1 ? "ok" : r == 2 ? "escrito (sem read-back)" : r == -2 ? "read-back DIVERGE" : "FALHOU");
    if (r == -2) Serial.printf(" (lido %ld)", (long)*lido);
    Serial.println("");
    return r == 1 ? ESC_OK : r == 2 ? ESC_ESCRITO : r == -2 ? ESC_DIVERGE : ESC_FALHA;
}

// FNV-1a 32 das linhas do cadastro (geral + cfg 1..n, separadas por \n). O backend calcula igual.
static uint32_t _hash() {
    uint32_t h = 2166136261u;
    auto mix = [&h](const char* s) { for (; *s; s++) { h ^= (uint8_t)*s; h *= 16777619u; } };
    mix(_lin[0]);
    for (int i = 1; i <= _c.n(); i++) { mix("\n"); mix(_lin[i]); }
    return h & 0xFFFFFFu;
}

static bool _num(char*& p, long& v) {
    while (*p == ' ') p++;
    if (!*p) return false;
    char* e;
    v = strtol(p, &e, 10);
    if (e == p || (*e && *e != ' ')) return false;
    p = e;
    return true;
}

static void _salvarLinha(int k) {
    Preferences pr;
    if (!pr.begin("ctl", false)) return;
    char key[4] = {'l', (char)('0' + k), 0, 0};
    pr.putString(key, _lin[k]);
    pr.end();
}

static void _salvarAtivo(bool at, uint16_t ttl) {
    if (at == _at_nvs && (!at || ttl == _ttl_nvs)) return;   // so' grava quando muda (flash)
    _at_nvs = at; _ttl_nvs = ttl;
    Preferences pr;
    if (!pr.begin("ctl", false)) return;
    pr.putBool("at", at);
    pr.putUShort("ttl", ttl);
    pr.end();
}

// "ctl geral ..." / "ctl cfg ...". persistir=false no boot (relendo o NVS).
static bool _aplicarLinha(const char* linha, bool persistir) {
    char b[100];
    strncpy(b, linha, sizeof(b) - 1); b[sizeof(b) - 1] = 0;
    char* p = b + 4;   // depois de "ctl "
    long a[6];
    if (!strncmp(p, "geral ", 6)) {
        p += 6;
        for (int k = 0; k < 4; k++) if (!_num(p, a[k])) return false;
        if (a[0] < 0 || a[0] > MAX_INV || a[1] < 0 || a[1] > 65535 || a[2] < 0 || a[2] > 8) return false;
        if (!_c.geral((int)a[0], (uint16_t)a[1], (uint8_t)a[2], a[3] != 0)) return false;
        strncpy(_lin[0], linha, sizeof(_lin[0]) - 1); _lin[0][sizeof(_lin[0]) - 1] = 0;
        if (persistir) _salvarLinha(0);
        for (int i = (int)a[0] + 1; i <= MAX_INV; i++) {
            if (!_lin[i][0]) continue;
            _lin[i][0] = 0;
            if (persistir) _salvarLinha(i);
        }
        return true;
    }
    if (!strncmp(p, "cfg ", 4)) {
        p += 4;
        for (int k = 0; k < 6; k++) if (!_num(p, a[k])) return false;
        while (*p == ' ') p++;
        if (!*p || a[1] < 0 || a[1] > 247) return false;
        if (!_c.inv((int)a[0], (uint16_t)a[1], (int32_t)a[2], (int32_t)a[3], (int32_t)a[4], (int32_t)a[5], p)) return false;
        strncpy(_lin[a[0]], linha, sizeof(_lin[0]) - 1); _lin[a[0]][sizeof(_lin[0]) - 1] = 0;
        if (persistir) _salvarLinha((int)a[0]);
        return true;
    }
    return false;
}

// "<modo> c=<hash> <resto do resumo>"
static void _resposta(char* msg, size_t sz) {
    char r[96];
    _c.resumo(r, sizeof(r));
    const char* resto = strchr(r, ' ');
    char modo[4] = {0};
    size_t lm = resto ? (size_t)(resto - r) : strlen(r);
    if (lm > 3) lm = 3;
    memcpy(modo, r, lm);
    snprintf(msg, sz, "%s c=%06lx%s", modo, (unsigned long)_hash(), resto ? resto : "");
}

void ctl_init() {
    _c.begin(_escrever);
    memset(_lin, 0, sizeof(_lin));
    Preferences pr;
    if (!pr.begin("ctl", true)) { Serial.println("[CTL] sem cadastro (NVS vazio)"); return; }
    char key[4] = {'l', '0', 0, 0};
    pr.getString(key, _lin[0], sizeof(_lin[0]));
    for (int i = 1; i <= MAX_INV; i++) { key[1] = (char)('0' + i); pr.getString(key, _lin[i], sizeof(_lin[0])); }
    _at_nvs = pr.getBool("at", false);
    _ttl_nvs = pr.getUShort("ttl", 300);
    pr.end();
    char l[1 + MAX_INV][100];
    memcpy(l, _lin, sizeof(l));
    if (!l[0][0] || !_aplicarLinha(l[0], false)) { Serial.println("[CTL] sem cadastro"); return; }
    for (int i = 1; i <= _c.n(); i++) if (l[i][0] && !_aplicarLinha(l[i], false)) Serial.printf("[CTL] cadastro %d invalido no NVS\n", i);
    if (_at_nvs) _c.retomarDoBoot(_ttl_nvs, millis());
    _modo_log = _c.modo();
    Serial.printf("[CTL] %d inversor(es), BI manual %u, controle %s (validade %us a partir do boot) c=%06lx\n",
                  _c.n(), (unsigned)_c.bi(), _at_nvs ? "ATIVO" : "desligado", (unsigned)_ttl_nvs, (unsigned long)_hash());
}

void ctl_tick() {
    unsigned long now = millis();
    if (_ult_tick && now - _ult_tick < 200UL) return;
    _ult_tick = now ? now : 1;
    if (!_c.n()) return;
    bool bi = false;
    if (_c.bi()) {
        bi = (inputs_get_state() >> (_c.bi() - 1)) & 1;
        if (_c.biInvertida()) bi = !bi;
    }
    _c.tick((uint32_t)now, bi);
    if (_c.modo() != _modo_log) {
        Serial.printf("[CTL] modo %s -> %s\n", modoNome(_modo_log), modoNome(_c.modo()));
        _modo_log = _c.modo();
    }
}

int ctl_cmd(const char* raw, char* msg, size_t sz) {
    while (*raw == ' ') raw++;
    if (strncmp(raw, "ctl", 3) != 0 || (raw[3] && raw[3] != ' ')) return -1;
    char b[100];
    strncpy(b, raw, sizeof(b) - 1); b[sizeof(b) - 1] = 0;
    for (int k = (int)strlen(b) - 1; k >= 0 && (b[k] == ' ' || b[k] == '\r' || b[k] == '\n'); k--) b[k] = 0;
    char* p = b + 3;
    while (*p == ' ') p++;
    unsigned long now = millis();

    if (!strcmp(p, "status") || !*p) {
        snprintf(msg, sz, "%s c=%06lx v=%ld seq=%lu n=%d e=%lu", modoNome(_c.modo()), (unsigned long)_hash(),
                 (long)_c.validadeRestanteS((uint32_t)now), (unsigned long)_c.seq(), _c.n(), (unsigned long)_c.escritas());
        return 1;
    }
    if (!strcmp(p, "off")) {
        _c.desligar((uint32_t)now);
        _salvarAtivo(false, _ttl_nvs);
        _resposta(msg, sz);
        return 1;
    }
    if (!strcmp(p, "limpar")) {
        _c.desligar((uint32_t)now);
        _c.geral(0, 0, 0, false);
        _salvarAtivo(false, _ttl_nvs);
        for (int i = 0; i <= MAX_INV; i++) if (_lin[i][0]) { _lin[i][0] = 0; _salvarLinha(i); }
        snprintf(msg, sz, "ctl_limpo");
        return 1;
    }
    if (!strncmp(p, "geral ", 6) || !strncmp(p, "cfg ", 4)) {
        // normaliza p/ "ctl <resto>" (o hash e' da linha que o backend montou, sem espacos extras)
        char linha[100];
        snprintf(linha, sizeof(linha), "ctl %s", p);
        if (!_aplicarLinha(linha, true)) { snprintf(msg, sz, "cfg_invalido"); return 0; }
        snprintf(msg, sz, "cfg_ok c=%06lx", (unsigned long)_hash());
        return 1;
    }
    // ctl <seq> <ttl> [<i> <p> <q>]...
    long seq, ttl;
    if (!_num(p, seq) || !_num(p, ttl) || seq < 0 || ttl < 0 || ttl > 65535) { snprintf(msg, sz, "ctl_formato"); return 0; }
    uint8_t idx[MAX_INV]; int32_t vp[MAX_INV], vq[MAX_INV];
    int n = 0;
    while (true) {
        while (*p == ' ') p++;
        if (!*p) break;
        long i, a, q;
        if (n >= MAX_INV || !_num(p, i) || !_num(p, a) || !_num(p, q) || i < 1 || i > MAX_INV) { snprintf(msg, sz, "ctl_formato"); return 0; }
        idx[n] = (uint8_t)i; vp[n] = (int32_t)a; vq[n] = (int32_t)q; n++;
    }
    char mot[24];
    if (!_c.receber((uint32_t)seq, (uint16_t)ttl, n, idx, vp, vq, (uint32_t)now, mot, sizeof(mot))) {
        snprintf(msg, sz, "%s c=%06lx", mot, (unsigned long)_hash());
        return 0;
    }
    _salvarAtivo(true, (uint16_t)ttl);
    _resposta(msg, sz);
    return 1;
}
