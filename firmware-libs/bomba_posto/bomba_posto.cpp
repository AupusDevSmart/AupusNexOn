// bomba_posto.cpp — ver bomba_posto.h. C++ puro.
#include "bomba_posto.h"
#include <string.h>
#include <stdio.h>

namespace bomba {

static void _cp(char* dst, size_t n, const char* src) {
    if (!dst || n == 0) return;
    size_t i = 0;
    if (src) for (; i + 1 < n && src[i]; i++) dst[i] = src[i];
    dst[i] = 0;
}
static bool _eq(const char* a, const char* b) {
    if (!a || !b) return false;
    while (*a && *b) {
        char ca = (*a >= 'a' && *a <= 'z') ? (char)(*a - 32) : *a;
        char cb = (*b >= 'a' && *b <= 'z') ? (char)(*b - 32) : *b;
        if (ca != cb) return false;
        a++; b++;
    }
    return *a == 0 && *b == 0;
}

const char* estadoNome(Estado e) {
    switch (e) {
        case OCIOSA: return "ociosa";
        case AGUARDANDO_MATRICULA: return "aguardando_matricula";
        case VALIDANDO: return "validando";
        case PARTINDO: return "partindo";
        case ABASTECENDO: return "abastecendo";
        case ENCERRANDO: return "encerrando";
        case BLOQUEADA: return "bloqueada";
        case MANUAL: return "manual";
    }
    return "?";
}
const char* validacaoNome(Validacao v) {
    switch (v) {
        case VAL_ONLINE: return "online";
        case VAL_OFFLINE: return "offline";
        case VAL_MANUAL: return "manual";
        default: return "nenhuma";
    }
}

// ---------------------------------------------------------------- Lista
void Lista::limpar() { _ntags = 0; _nmats = 0; versao = 0; memset(_tags, 0, sizeof(_tags)); memset(_mats, 0, sizeof(_mats)); }

bool Lista::adicionarTag(const char* uid, float limite) {
    if (!uid || !*uid) return false;
    for (int i = 0; i < _ntags; i++) if (_eq(_tags[i].uid, uid)) { _tags[i].limite_litros = limite; return true; }
    if (_ntags >= LISTA_MAX_TAGS) return false;
    Tag& t = _tags[_ntags++];
    memset(&t, 0, sizeof(t));
    _cp(t.uid, UID_LEN, uid);
    t.limite_litros = limite;
    return true;
}
bool Lista::adicionarMatDaTag(const char* uid, const char* mat) {
    if (!mat || !*mat) return false;
    for (int i = 0; i < _ntags; i++) {
        if (!_eq(_tags[i].uid, uid)) continue;
        Tag& t = _tags[i];
        for (int j = 0; j < t.nmats; j++) if (_eq(t.mats[j], mat)) return true;
        if (t.nmats >= TAG_MAX_MATS) return false;
        _cp(t.mats[t.nmats++], MAT_LEN, mat);
        return true;
    }
    return false;
}
bool Lista::adicionarMat(const char* mat) {
    if (!mat || !*mat) return false;
    for (int i = 0; i < _nmats; i++) if (_eq(_mats[i], mat)) return true;
    if (_nmats >= LISTA_MAX_MATS) return false;
    _cp(_mats[_nmats++], MAT_LEN, mat);
    return true;
}
const Tag* Lista::tag(const char* uid) const {
    for (int i = 0; i < _ntags; i++) if (_eq(_tags[i].uid, uid)) return &_tags[i];
    return nullptr;
}
bool Lista::matCadastrada(const char* mat) const {
    for (int i = 0; i < _nmats; i++) if (_eq(_mats[i], mat)) return true;
    return false;
}
bool Lista::validar(const char* uid, const char* mat, bool exigirMat, char* motivo, float* limite_out, bool matLivre) const {
    if (motivo) motivo[0] = 0;
    if (limite_out) *limite_out = 0;
    const Tag* t = tag(uid);
    if (!t) { _cp(motivo, MOTIVO_LEN, "tag"); return false; }
    if (exigirMat) {
        if (!mat || !*mat) { _cp(motivo, MOTIVO_LEN, "matricula"); return false; }
        if (!matLivre) {
            // matricula precisa existir: na lista global OU na lista da tag. Sem NENHUMA
            // matricula cadastrada => nega (fail-closed), nunca "liberado para todos".
            bool conhecida = matCadastrada(mat);
            for (int j = 0; j < t->nmats && !conhecida; j++) if (_eq(t->mats[j], mat)) conhecida = true;
            if (!conhecida) { _cp(motivo, MOTIVO_LEN, "matricula"); return false; }
        }
        // par: se a tag restringe matriculas, a matricula tem que estar nela (vale mesmo com matricula livre)
        if (t->nmats > 0) {
            bool par = false;
            for (int j = 0; j < t->nmats; j++) if (_eq(t->mats[j], mat)) { par = true; break; }
            if (!par) { _cp(motivo, MOTIVO_LEN, "par"); return false; }
        }
    }
    if (limite_out) *limite_out = t->limite_litros;
    return true;
}

// ---------------------------------------------------------------- Maquina
Maquina::Maquina(const Config& cfg, Ouvinte* ouv)
    : _cfg(cfg), _ouv(ouv), _st(OCIOSA), _online(false), _t_estado(0), _t_boot(0), _primeiroTick(true),
      _last_tick(0), _req_seq(0), _limite(0), _val(VAL_NENHUMA), _litros(0), _t_ini(0), _nivel_ini(-1),
      _bico_saiu(false), _t_fluxo_zero(0), _fluxo_zero(false), _contator_ant(false),
      _man_ligado(false), _man_t_ini(0), _man_litros(0), _man_nivel_ini(-1) {
    _uid[0] = _mat[0] = _req[0] = _fim_motivo[0] = _motivo_bloq[0] = 0;
}

void Maquina::_ir(Estado novo, uint32_t now) {
    if (novo == _st) return;
    Estado de = _st;
    _st = novo; _t_estado = now;
    if (_ouv) _ouv->aoMudarEstado(de, novo);
}

bool Maquina::_precondicoes(char* motivo) const {
    if (_in.emergencia) { _cp(motivo, MOTIVO_LEN, "emergencia"); return false; }
    if (!_in.automatico) { _cp(motivo, MOTIVO_LEN, "manual"); return false; }
    if (_in.nivel_baixo_boia) { _cp(motivo, MOTIVO_LEN, "nivel_baixo"); return false; }
    if (_in.nivel_pct >= 0 && _cfg.nivel_min_pct >= 0 && _in.nivel_pct < _cfg.nivel_min_pct) { _cp(motivo, MOTIVO_LEN, "nivel_baixo"); return false; }
    return true;
}

void Maquina::_negar(const char* motivo, uint32_t now) {
    if (_ouv) _ouv->aoEvento("negado", motivo, _uid, _mat);
    _uid[0] = _mat[0] = _req[0] = 0;
    if (_st == AGUARDANDO_MATRICULA || _st == VALIDANDO) _ir(OCIOSA, now);
}

void Maquina::cartao(const char* uid, uint32_t now) {
    if (!uid || !*uid) return;
    if (_st == BLOQUEADA) { _cp(_uid, UID_LEN, uid); _negar("bloqueada", now); return; }
    if (_st == MANUAL)    { _cp(_uid, UID_LEN, uid); _negar("manual", now); return; }
    if (_st != OCIOSA)    { char u[UID_LEN]; _cp(u, UID_LEN, uid); if (_ouv) _ouv->aoEvento("negado", "ocupado", u, ""); return; }
    if (_primeiroTick || (uint32_t)(now - _t_boot) < _cfg.estabilizacao_ms) { _cp(_uid, UID_LEN, uid); _negar("inicializando", now); return; }
    _cp(_uid, UID_LEN, uid); _mat[0] = 0;
    if (_cfg.exigir_matricula) _ir(AGUARDANDO_MATRICULA, now);
    else _validar(now);
}

void Maquina::matricula(const char* mat, uint32_t now) {
    if (_st != AGUARDANDO_MATRICULA || !mat || !*mat) return;
    _cp(_mat, MAT_LEN, mat);
    _validar(now);
}

void Maquina::_validar(uint32_t now) {
    _ir(VALIDANDO, now);
    if (_online) {
        snprintf(_req, REQ_LEN, "r%lu", (unsigned long)(++_req_seq));
        if (_ouv) _ouv->aoPedirAutorizacao(_req, _uid, _mat);
        return;   // aguarda respostaAuth() ou o timeout no tick()
    }
    char motivo[MOTIVO_LEN]; float lim = 0;
    bool ok = _lista.validar(_uid, _mat, _cfg.exigir_matricula, motivo, &lim, _cfg.matricula_livre);
    _decidir(ok, motivo, lim, VAL_OFFLINE, now);
}

void Maquina::respostaAuth(const char* req_id, bool ok, const char* motivo, float limite, uint32_t now) {
    if (_st != VALIDANDO || !req_id || !_eq(req_id, _req)) return;
    _decidir(ok, motivo ? motivo : "", limite, VAL_ONLINE, now);
}

void Maquina::_decidir(bool ok, const char* motivo, float limite, Validacao val, uint32_t now) {
    _req[0] = 0;
    if (!ok) { _negar((motivo && *motivo) ? motivo : "negado", now); return; }
    char pre[MOTIVO_LEN];
    if (!_precondicoes(pre)) { _negar(pre, now); return; }
    _limite = limite; _val = val;
    _partir(now);
}

void Maquina::_partir(uint32_t now) {
    _litros = 0; _bico_saiu = false; _fluxo_zero = false; _t_fluxo_zero = 0;
    _nivel_ini = _in.nivel_pct;
    _ir(PARTINDO, now);
}

void Maquina::_encerrar(const char* motivo, uint32_t now) {
    _cp(_fim_motivo, MOTIVO_LEN, motivo);
    _ir(ENCERRANDO, now);
}

void Maquina::_fecharTransacao(uint32_t now) {
    Transacao t; memset(&t, 0, sizeof(t));
    _cp(t.uid, UID_LEN, _uid); _cp(t.matricula, MAT_LEN, _mat);
    t.litros = _litros; t.inicio_ms = _t_ini; t.fim_ms = now;
    t.nivel_antes = _nivel_ini; t.nivel_depois = _in.nivel_pct;
    _cp(t.fim_motivo, MOTIVO_LEN, _fim_motivo); t.validacao = _val;
    if (_ouv) _ouv->aoTransacao(t);
    _uid[0] = _mat[0] = 0; _litros = 0; _limite = 0; _val = VAL_NENHUMA;
}

void Maquina::_iniciarManual(uint32_t now) {
    _man_ligado = true; _man_t_ini = now; _man_litros = 0; _man_nivel_ini = _in.nivel_pct;
}
void Maquina::_fecharManual(uint32_t now) {
    if (!_man_ligado) return;
    _man_ligado = false;
    Transacao t; memset(&t, 0, sizeof(t));
    t.litros = _man_litros; t.inicio_ms = _man_t_ini; t.fim_ms = now;
    t.nivel_antes = _man_nivel_ini; t.nivel_depois = _in.nivel_pct;
    _cp(t.fim_motivo, MOTIVO_LEN, "manual"); t.validacao = VAL_MANUAL;
    if (_ouv) _ouv->aoTransacao(t);
}

void Maquina::rearme(uint32_t now) {
    if (_st != BLOQUEADA) return;
    if (_cfg.tem_contator_aux && _in.contator) {
        if (_ouv) _ouv->aoEvento("rearme_negado", "contator_colado", "", "");
        return;
    }
    if (_ouv) _ouv->aoEvento("rearme", _motivo_bloq, "", "");
    _motivo_bloq[0] = 0;
    _ir(OCIOSA, now);
}

void Maquina::tick(uint32_t now, const Entradas& in) {
    if (_primeiroTick) { _primeiroTick = false; _t_boot = now; _last_tick = now; _t_estado = now; _contator_ant = in.contator; }
    uint32_t dt = now - _last_tick; _last_tick = now;
    _in = in;
    const bool contEdgeUp = in.contator && !_contator_ant;
    _contator_ant = in.contator;

    // fluxo parado: cronometro desde que a vazao zerou
    if (in.fluxo_lpm <= 0.0005f) { if (!_fluxo_zero) { _fluxo_zero = true; _t_fluxo_zero = now; } }
    else _fluxo_zero = false;

    Saidas o;   // tudo desligado por padrao — so' PARTINDO/ABASTECENDO ligam algo
    switch (_st) {
    case OCIOSA:
        if (!in.automatico) {
            if (_ouv) _ouv->aoEvento("manual", "chave", "", "");
            _ir(MANUAL, now);
            break;
        }
        if (_cfg.tem_contator_aux && contEdgeUp) {
            if (_ouv) _ouv->aoEvento("nao_autorizado", "contator_fechou_sem_comando", "", "");
        }
        break;

    case AGUARDANDO_MATRICULA:
        if (!in.automatico) { _negar("manual", now); break; }
        if ((uint32_t)(now - _t_estado) > _cfg.janela_mat_ms) _negar("timeout_matricula", now);
        break;

    case VALIDANDO:
        if (!in.automatico) { _negar("manual", now); break; }
        if (_req[0] && (uint32_t)(now - _t_estado) > _cfg.auth_timeout_ms) {
            // NexON nao respondeu: decide pela lista local
            char motivo[MOTIVO_LEN]; float lim = 0;
            bool ok = _lista.validar(_uid, _mat, _cfg.exigir_matricula, motivo, &lim, _cfg.matricula_livre);
            _decidir(ok, motivo, lim, VAL_OFFLINE, now);
        }
        break;

    case PARTINDO: {
        uint32_t el = now - _t_estado;
        o.permissao = true; o.solenoide = true; o.sinaleiro = true;
        o.liga = el < _cfg.pulso_bo1_ms;
        if (in.emergencia) { _encerrar("emergencia", now); o = Saidas(); break; }
        bool ligou = _cfg.tem_contator_aux ? in.contator : (el >= _cfg.pulso_bo1_ms);
        if (ligou) {
            _t_ini = now; _litros = 0; _bico_saiu = false; _fluxo_zero = false; _t_fluxo_zero = 0;
            _ir(ABASTECENDO, now);
            o.liga = false;
            break;
        }
        if (el >= _cfg.espera_bi1_ms && el >= _cfg.pulso_bo1_ms) {
            // K1 nao confirmou: desliga tudo e bloqueia ate reconhecimento
            o = Saidas();
            if (_ouv) _ouv->aoEvento("falha_partida", "sem_confirmacao_bi1", _uid, _mat);
            _cp(_motivo_bloq, MOTIVO_LEN, "falha_partida");
            _uid[0] = _mat[0] = 0; _val = VAL_NENHUMA;
            _ir(BLOQUEADA, now);
        }
        break;
    }

    case ABASTECENDO: {
        o.permissao = true; o.solenoide = true; o.sinaleiro = true;
        _litros += in.fluxo_lpm * (float)dt / 60000.0f;
        if (!in.bico_no_suporte) _bico_saiu = true;
        const char* fim = nullptr;
        if (in.emergencia)                                              fim = "emergencia";
        else if (!in.automatico)                                        fim = "manual";
        else if (_cfg.tem_contator_aux && !in.contator)                 fim = "contator_caiu";
        else if (in.nivel_baixo_boia)                                   fim = "nivel_baixo";
        else if (in.nivel_pct >= 0 && _cfg.nivel_min_pct >= 0 && in.nivel_pct < _cfg.nivel_min_pct) fim = "nivel_baixo";
        else if (_limite > 0 && _litros >= _limite)                     fim = "limite";
        else if ((uint32_t)(now - _t_ini) >= _cfg.tempo_max_ms)         fim = "timeout";
        else if (_bico_saiu && in.bico_no_suporte)                      fim = "concluido";
        else if (_fluxo_zero && (uint32_t)(now - _t_fluxo_zero) >= _cfg.fluxo_parado_ms) fim = "fluxo_parado";
        if (fim) { _encerrar(fim, now); o = Saidas(); }
        break;
    }

    case ENCERRANDO: {
        // permissao e solenoide ja' cairam (saidas zeradas): espera o K1 abrir
        bool abriu = !_cfg.tem_contator_aux || !in.contator;
        if (abriu) { _fecharTransacao(now); _ir(OCIOSA, now); break; }
        if ((uint32_t)(now - _t_estado) >= _cfg.espera_bi1_ms) {
            if (_ouv) _ouv->aoEvento("contator_colado", _fim_motivo, _uid, _mat);
            _fecharTransacao(now);
            _cp(_motivo_bloq, MOTIVO_LEN, "contator_colado");
            _ir(BLOQUEADA, now);
        }
        break;
    }

    case BLOQUEADA:
        break;   // so' sai por rearme()

    case MANUAL:
        if (_man_ligado) _man_litros += in.fluxo_lpm * (float)dt / 60000.0f;
        if (in.automatico) {
            if (_man_ligado) _fecharManual(now);
            _ir(OCIOSA, now);
            break;
        }
        if (_cfg.tem_contator_aux) {
            if (in.contator && !_man_ligado) _iniciarManual(now);
            else if (!in.contator && _man_ligado) _fecharManual(now);
        }
        break;
    }
    _out = o;
}

} // namespace bomba
