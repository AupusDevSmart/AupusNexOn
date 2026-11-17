// controle_ufv — ver controle_ufv.h
#include "controle_ufv.h"
#include <string.h>
#include <stdio.h>

namespace cufv {

const char* modoNome(Modo m) {
    switch (m) {
        case AUTO: return "A";
        case SEGURO1: return "S1";
        case SEGURO2: return "S2";
        case MANUAL: return "M";
        default: return "D";
    }
}

static int rank(Modo m) { return m == SEGURO2 ? 3 : m == SEGURO1 ? 2 : m == MANUAL ? 1 : 0; }

void Controle::begin(EscreverFn w) {
    _w = w;
    memset(_cfg, 0, sizeof(_cfg));
    memset(_est, 0, sizeof(_est));
    _n = 0; _t2_s = 0; _bi = 0; _bi_inv = false;
    _modo = DESLIGADO; _ativo = false; _retomando = false;
    _seq = 0; _tem_seq = false; _ttl_s = 300; _valido_ate = 0; _seguro_desde = 0; _escritas = 0;
    _bi_lida = _bi_estavel = false; _bi_desde = 0;
    _ult_tick = 0; _ms_seguro = _ms_manual = 0; _pior = DESLIGADO;
}

bool Controle::geral(int n, uint16_t t2_s, uint8_t bi, bool bi_inv) {
    if (n < 0 || n > MAX_INV || bi > 8) return false;
    for (int i = n; i < MAX_INV; i++) { memset(&_cfg[i], 0, sizeof(InvCfg)); memset(&_est[i], 0, sizeof(InvEst)); }
    _n = n; _t2_s = t2_s; _bi = bi; _bi_inv = bi_inv;
    if (!_bi) { _bi_lida = _bi_estavel = false; }
    return true;
}

bool Controle::inv(int i, uint16_t addr, int32_t p1, int32_t p2, int32_t pman, int32_t rampa, const char* dev) {
    if (i < 1 || i > _n || !dev || !*dev || rampa < 0) return false;
    InvCfg& c = _cfg[i - 1];
    bool outro = strncmp(c.dev, dev, DEV_SZ - 1) != 0 || c.addr != addr;
    strncpy(c.dev, dev, DEV_SZ - 1); c.dev[DEV_SZ - 1] = 0;
    c.addr = addr; c.p1 = p1; c.p2 = p2; c.pman = pman; c.rampa = rampa;
    if (outro) memset(&_est[i - 1], 0, sizeof(InvEst));   // outro inversor: nada do que sabiamos vale
    return true;
}

void Controle::retomarDoBoot(uint16_t ttl_s, uint32_t now_ms) {
    if (!_n) return;
    _ativo = true;
    _ttl_s = ttl_s ? ttl_s : 300;
    _valido_ate = now_ms + (uint32_t)_ttl_s * 1000UL;
    _modo = AUTO;   // sem alvo conhecido: nada a escrever ate' o backend falar ou a validade vencer
}

int32_t Controle::validadeRestanteS(uint32_t now_ms) const {
    if (!_ativo) return -1;
    int32_t r = (int32_t)(_valido_ate - now_ms);
    return r > 0 ? r / 1000 : 0;
}

void Controle::_setModo(Modo m, uint32_t now_ms) {
    if (m == _modo) return;
    if (m == SEGURO1) _seguro_desde = now_ms;
    _modo = m;
    if (rank(m) > rank(_pior)) _pior = m;
}

// Alvo de cada inversor pelo modo atual.
void Controle::_aplicarModo(uint32_t) {
    bool rampaAtiva = false;
    for (int i = 0; i < _n; i++) {
        InvEst& e = _est[i];
        const InvCfg& c = _cfg[i];
        switch (_modo) {
            case AUTO:
                if (!e.tem_pedido) break;   // sem pedido: mantem o que estiver
                e.tem_alvo = true;
                e.alvo_q = e.ped_q;
                e.alvo_p = e.ped_p;
                if (_retomando && c.rampa > 0 && e.ok_p && e.ped_p > e.esc_p + c.rampa) {
                    e.alvo_p = e.esc_p + c.rampa;   // retomada: sobe aos poucos (reducao vai direto)
                    rampaAtiva = true;
                }
                break;
            case SEGURO1: e.tem_alvo = true; e.alvo_p = c.p1; e.alvo_q = 0; break;
            case SEGURO2: e.tem_alvo = true; e.alvo_p = c.p2; e.alvo_q = 0; break;
            case MANUAL:  e.tem_alvo = true; e.alvo_p = c.pman; e.alvo_q = 0; break;
            case DESLIGADO: break;          // desligar() define os alvos (P = pman, Q = 0)
        }
    }
    if (_modo == AUTO) _retomando = rampaAtiva;
}

void Controle::_escrever(int i, uint32_t now_ms) {
    InvEst& e = _est[i];
    const InvCfg& c = _cfg[i];
    e.tent_ms = now_ms ? now_ms : 1;
    e.tentou = true;
    if (!_w) { e.res_p = e.res_q = ESC_FALHA; return; }
    // P primeiro: reducao de limite e' o que protege o contrato
    if (!e.ok_p || e.esc_p != e.alvo_p) {
        int32_t lido = 0;
        Res r = _w(c.dev, c.addr, SP_P, e.alvo_p, &lido);
        e.res_p = r;
        if (r != ESC_FALHA) _escritas++;
        if (r == ESC_OK || r == ESC_ESCRITO) { e.ok_p = true; e.esc_p = e.alvo_p; }
        else { e.ok_p = false; if (r == ESC_DIVERGE) e.lido_p = lido; }
    }
    if (!e.ok_q || e.esc_q != e.alvo_q) {
        int32_t lido = 0;
        Res r = _w(c.dev, c.addr, SP_Q, e.alvo_q, &lido);
        e.res_q = r;
        if (r != ESC_FALHA) _escritas++;
        if (r == ESC_OK || r == ESC_ESCRITO) { e.ok_q = true; e.esc_q = e.alvo_q; }
        else { e.ok_q = false; if (r == ESC_DIVERGE) e.lido_q = lido; }
    }
}

void Controle::_escreverPendentes(uint32_t now_ms, bool forcar) {
    for (int i = 0; i < _n; i++) {
        InvEst& e = _est[i];
        if (!e.tem_alvo) continue;
        bool falta = !e.ok_p || e.esc_p != e.alvo_p || !e.ok_q || e.esc_q != e.alvo_q;
        if (!falta) continue;
        if (!forcar && e.tent_ms && (uint32_t)(now_ms - e.tent_ms) < RETENTA_MS) continue;
        _escrever(i, now_ms);
    }
}

bool Controle::receber(uint32_t seq, uint16_t ttl_s, int n_sp, const uint8_t* idx, const int32_t* p, const int32_t* q,
                       uint32_t now_ms, char* motivo, size_t msz) {
    if (!_n) { snprintf(motivo, msz, "sem_cfg"); return false; }
    if (_tem_seq && seq < _seq) { snprintf(motivo, msz, "seq_velho"); return false; }
    if (ttl_s < 10) { snprintf(motivo, msz, "ttl_invalido"); return false; }
    for (int k = 0; k < n_sp; k++) {
        if (idx[k] < 1 || idx[k] > _n) { snprintf(motivo, msz, "idx_invalido"); return false; }
    }
    _seq = seq; _tem_seq = true;
    _ttl_s = ttl_s;
    _valido_ate = now_ms + (uint32_t)ttl_s * 1000UL;
    _ativo = true;
    for (int i = 0; i < _n; i++) { _est[i].res_p = _est[i].res_q = ESC_NADA; }
    for (int k = 0; k < n_sp; k++) {
        InvEst& e = _est[idx[k] - 1];
        e.tem_pedido = true; e.ped_p = p[k]; e.ped_q = q[k];
    }
    if (_modo == MANUAL) { motivo[0] = 0; return true; }   // chave em manual: guarda o pedido, nao escreve
    if (_modo != AUTO) {
        _retomando = _modo == SEGURO1 || _modo == SEGURO2;   // voltou do modo seguro: sobe com rampa
        _setModo(AUTO, now_ms);
    }
    _aplicarModo(now_ms);
    _escreverPendentes(now_ms, true);
    motivo[0] = 0;
    return true;
}

void Controle::desligar(uint32_t now_ms) {
    _ativo = false;
    _retomando = false;
    for (int i = 0; i < _n; i++) {
        InvEst& e = _est[i];
        e.tem_pedido = false;
        e.res_p = e.res_q = ESC_NADA;
        if (_modo != MANUAL) { e.tem_alvo = true; e.alvo_p = _cfg[i].pman; e.alvo_q = 0; }
    }
    if (_modo != MANUAL) _setModo(DESLIGADO, now_ms);
    _escreverPendentes(now_ms, true);
}

void Controle::tick(uint32_t now_ms, bool bi_ativa) {
    if (_ult_tick) {
        uint32_t dt = now_ms - _ult_tick;
        if (_modo == SEGURO1 || _modo == SEGURO2) _ms_seguro += dt;
        else if (_modo == MANUAL) _ms_manual += dt;
    }
    _ult_tick = now_ms ? now_ms : 1;
    if (!_n) return;

    // BI manual (debounce 1 s)
    bool b = _bi ? bi_ativa : false;
    if (b != _bi_lida) { _bi_lida = b; _bi_desde = now_ms; }
    if (_bi_lida != _bi_estavel && (uint32_t)(now_ms - _bi_desde) >= 1000UL) {
        _bi_estavel = _bi_lida;
        if (_bi_estavel) {
            _setModo(MANUAL, now_ms);
        } else if (!_ativo) {
            for (int i = 0; i < _n; i++) { _est[i].tem_alvo = true; _est[i].alvo_p = _cfg[i].pman; _est[i].alvo_q = 0; }
            _setModo(DESLIGADO, now_ms);
        } else if ((int32_t)(_valido_ate - now_ms) > 0) {
            _retomando = false;
            _setModo(AUTO, now_ms);
        } else {
            _setModo(SEGURO1, now_ms);
        }
        _aplicarModo(now_ms);
        _escreverPendentes(now_ms, true);
        return;
    }

    // Watchdog: validade vencida -> estagio 1; depois de t2 -> estagio 2
    if (_modo == AUTO && _ativo && (int32_t)(now_ms - _valido_ate) >= 0) {
        _setModo(SEGURO1, now_ms);
        _aplicarModo(now_ms);
        _escreverPendentes(now_ms, true);
        return;
    }
    if (_modo == SEGURO1 && _t2_s && (uint32_t)(now_ms - _seguro_desde) >= (uint32_t)_t2_s * 1000UL) {
        _setModo(SEGURO2, now_ms);
        _aplicarModo(now_ms);
        _escreverPendentes(now_ms, true);
        return;
    }
    _escreverPendentes(now_ms, false);   // retentativas
}

void Controle::resumo(char* out, size_t n) {
    size_t k = (size_t)snprintf(out, n, "%s", modoNome(_modo));
    // eventos primeiro (o ack tem ~60 caracteres: se faltar espaco, perde o fim da lista de inversores)
    if (_ms_seguro && k < n) k += (size_t)snprintf(out + k, n - k, " s=%lu", (unsigned long)(_ms_seguro / 1000));
    if (_ms_manual && k < n) k += (size_t)snprintf(out + k, n - k, " m=%lu", (unsigned long)(_ms_manual / 1000));
    if (rank(_pior) >= 2 && k < n) k += (size_t)snprintf(out + k, n - k, " p=%s", modoNome(_pior));
    for (int i = 0; i < _n && k < n; i++) {
        const InvEst& e = _est[i];
        char t[24];
        if (e.res_p == ESC_DIVERGE) snprintf(t, sizeof(t), "rb%ld", (long)e.lido_p);
        else if (e.res_q == ESC_DIVERGE) snprintf(t, sizeof(t), "rq%ld", (long)e.lido_q);
        else if (e.res_p == ESC_FALHA || e.res_q == ESC_FALHA) snprintf(t, sizeof(t), "f");
        else if (e.res_p == ESC_ESCRITO || e.res_q == ESC_ESCRITO) snprintf(t, sizeof(t), "w");
        else if (e.res_p == ESC_OK || e.res_q == ESC_OK) snprintf(t, sizeof(t), "ok");
        else if (e.tem_alvo && (!e.ok_p || !e.ok_q)) snprintf(t, sizeof(t), "f");   // pendente de tentativa anterior
        else snprintf(t, sizeof(t), "=");
        bool limitado = _modo == AUTO && e.tem_pedido && e.alvo_p < e.ped_p;
        k += (size_t)snprintf(out + k, n > k ? n - k : 0, " %d:%s%s", i + 1, t, limitado ? "r" : "");
    }
    _ms_seguro = _ms_manual = 0;
    _pior = _modo;
    for (int i = 0; i < _n; i++) _est[i].tentou = false;
}

}  // namespace cufv
