// pivo_local.cpp — ver pivo_local.h. C++ puro.
#include "pivo_local.h"
#include <string.h>
#include <stdio.h>

namespace pivo {

const char* estadoNome(Estado e) {
    switch (e) {
        case PARADO:     return "parado";
        case LIGANDO:    return "ligando";
        case IRRIGANDO:  return "irrigando";
        case DESLIGANDO: return "desligando";
    }
    return "?";
}

const char* passoNome(Passo p) {
    switch (p) {
        case P_NENHUM:  return "";
        case L_TENSAO:  return "tensao";
        case L_PRESSAO: return "pressao";
        case L_LADO:    return "lado";
        case D_BOMBA:   return "bomba_off";
        case D_LADO:    return "lado_off";
    }
    return "?";
}

static float norm360(float g) {
    while (g >= 360.0f) g -= 360.0f;
    while (g < 0.0f) g += 360.0f;
    return g;
}
// Diferenca mais curta b - a, em (-180, 180].
static float dif180(float a, float b) {
    float d = norm360(b - a);
    return d > 180.0f ? d - 360.0f : d;
}
static void copia(char* dst, const char* src, size_t n) {
    if (!src) src = "";
    strncpy(dst, src, n - 1);
    dst[n - 1] = 0;
}
static float absf(float x) { return x < 0 ? -x : x; }

static const float SALTO_MAX_GRAUS = 30.0f;   // leitura que pula mais que isso = glitch, nao conta
static const float MUDOU_GRAUS     = 0.2f;    // abaixo disso e' ruido (para o "girando")

bool validarPlano(Plano& p, char* motivo, size_t msz) {
    if (p.dir != 'D' && p.dir != 'E') { copia(motivo, "direcao", msz); return false; }
    if (p.pm < 0 || p.pm > 1000) { copia(motivo, "percentimetro", msz); return false; }
    switch (p.parada) {
        case POR_VOLTAS:
            if (!(p.voltas > 0.0f) || p.voltas > 50.0f) { copia(motivo, "voltas", msz); return false; }
            break;
        case POR_ANGULO:
            if (!(p.angulo >= 0.0f) || p.angulo > 360.0f) { copia(motivo, "angulo", msz); return false; }
            p.angulo = norm360(p.angulo);
            break;
        case POR_DURACAO:
            if (p.duracao_s == 0 || p.duracao_s > 7UL * 86400UL) { copia(motivo, "duracao", msz); return false; }
            break;
        default:
            copia(motivo, "parada", msz); return false;
    }
    if (p.nseg > MAX_SEG) { copia(motivo, "segmentos", msz); return false; }
    for (int i = 0; i < p.nseg; i++) {
        Segmento& s = p.seg[i];
        if (!(s.ini_grau >= 0.0f) || s.ini_grau >= 360.0f || s.pm < 0 || s.pm > 1000) { copia(motivo, "segmento", msz); return false; }
        if (i > 0 && !(s.ini_grau > p.seg[i - 1].ini_grau)) { copia(motivo, "segmento_ordem", msz); return false; }
    }
    if (!p.com_agua) {                       // sem agua: percentimetro 100 % e sem canhao
        p.pm = 1000; p.canhao = false;
        for (int i = 0; i < p.nseg; i++) { p.seg[i].pm = 1000; p.seg[i].canhao = false; }
    }
    p.id[ID_LEN - 1] = 0;
    if (motivo && msz) motivo[0] = 0;
    return true;
}

Maquina::Maquina(const Config& cfg, Ouvinte* ouv) : _cfg(cfg), _ouv(ouv) {}

void Maquina::_ir(Estado e, uint32_t) {
    if (e == _st) return;
    Estado de = _st;
    _st = e;
    if (_ouv) _ouv->aoMudarEstado(de, e);
}

void Maquina::_passoPara(Passo p, uint32_t now, const char* nome) {
    _passo = p;
    _t_passo = now;
    if (nome && _ouv) _ouv->aoEvento("passo", nome);
}

bool Maquina::_queda(bool ok, uint32_t& desde, uint32_t now) {
    if (ok) { desde = 0; return false; }
    if (!desde) desde = now ? now : 1;
    return (now - desde) >= _cfg.tolerancia_ms;
}

bool Maquina::girando(uint32_t now) const {
    return _out.perc_pm > 0 && _ang_mudou_ok && (now - _t_ang_mudou) < _cfg.janela_giro_ms;
}

// ---------------------------------------------------------------- comandos

bool Maquina::ligar(const Plano& p, uint32_t now, char* motivo, size_t msz) {
    if (_st != PARADO) { copia(motivo, "ja_ligado", msz); return false; }
    Plano q = p;
    char m[MOTIVO_LEN];
    if (!validarPlano(q, m, sizeof(m))) {
        char t[MOTIVO_LEN + 16];
        snprintf(t, sizeof(t), "plano_invalido:%s", m);
        copia(motivo, t, msz);
        return false;
    }
    if ((_cfg.tem_gir_dir && _in.gir_dir) || (_cfg.tem_gir_esq && _in.gir_esq)) { copia(motivo, "pivo_girando", msz); return false; }
    if (_cfg.tem_seguranca && _in.desalinhado) { copia(motivo, "desalinhado", msz); return false; }

    _plano = q;
    _falha[0] = 0; _motivo[0] = 0; _falha_desligar = false;
    _percorrido = 0; _alvo = -1; _contando = false; _seg = -1;
    _canhao_conf_ate = 0; _q_pressao = _q_tensao = _q_lado = 0;
    _t_ligar = now; _now = now;
    // Posicao recente: a referencia ja' e' o angulo atual. Senao, a primeira leitura vira a referencia.
    if (_tem_pos && (now - _t_pos) < _cfg.sem_posicao_ms) {
        _contando = true;
        if (_plano.parada == POR_VOLTAS) _alvo = 360.0f * _plano.voltas;
        else if (_plano.parada == POR_ANGULO) {
            float d = _plano.dir == 'D' ? norm360(_plano.angulo - _ang) : norm360(_ang - _plano.angulo);
            _alvo = d < 0.5f ? 360.0f : d;
        }
    }
    if (_ouv) _ouv->aoEvento("ligar", _plano.id);
    _ir(LIGANDO, now);
    _passoPara(L_TENSAO, now, "tensao");
    if (motivo && msz) motivo[0] = 0;
    return true;
}

bool Maquina::desligar(const char* motivo, uint32_t now) {
    if (_st == DESLIGANDO) return false;
    if (_st == PARADO) {
        // Garante tudo em OFF (ex.: comando de seguranca repetido); nao reabre a sequencia.
        _out = Saidas();
        return false;
    }
    _iniciarDesligar(motivo && *motivo ? motivo : "comando", false, now);
    return true;
}

bool Maquina::ajustarPercentimetro(int16_t pm, char* motivo, size_t msz) {
    if (_st != IRRIGANDO) { copia(motivo, "nao_irrigando", msz); return false; }
    if (!_plano.com_agua) { copia(motivo, "sem_agua", msz); return false; }
    if (_plano.nseg) { copia(motivo, "segmentos", msz); return false; }
    if (pm < 0 || pm > 1000) { copia(motivo, "percentimetro", msz); return false; }
    _plano.pm = pm;
    _out.perc_pm = pm;
    if (_ouv) _ouv->aoEvento("passo", "percentimetro");
    if (motivo && msz) motivo[0] = 0;
    return true;
}

bool Maquina::comandarCanhao(bool on, uint32_t now, char* motivo, size_t msz) {
    if (_st != IRRIGANDO) { copia(motivo, "nao_irrigando", msz); return false; }
    if (!_plano.com_agua) { copia(motivo, "sem_agua", msz); return false; }
    if (!_cfg.tem_canhao) { copia(motivo, "sem_canhao", msz); return false; }
    if (_plano.nseg) { copia(motivo, "segmentos", msz); return false; }
    if (_out.canhao == on) { copia(motivo, on ? "ja_ligado" : "ja_desligado", msz); return false; }
    _plano.canhao = on;
    _canhao(on, now);
    if (motivo && msz) motivo[0] = 0;
    return true;
}

// ---------------------------------------------------------------- sequencia

void Maquina::_ligarBomba(uint32_t now) {
    _out.bomba = true;
    _out.valvula = _cfg.tem_valvula;
    _passoPara(L_PRESSAO, now, "bomba_ligada");
}

void Maquina::_acionarLado(uint32_t now) {
    _out.dir = _plano.dir == 'D';
    _out.esq = _plano.dir == 'E';
    _passoPara(L_LADO, now, _plano.dir == 'D' ? "girar_direita" : "girar_esquerda");
}

void Maquina::_canhao(bool on, uint32_t now) {
    _out.canhao = on;
    _canhao_conf_ate = _cfg.tem_canhao_st ? (now ? now : 1) : 0;
    if (_ouv) _ouv->aoEvento("passo", on ? "canhao_ligar" : "canhao_desligar");
}

void Maquina::_entrarIrrigando(uint32_t now) {
    if (_ouv) _ouv->aoEvento("passo", "girando");
    _passo = P_NENHUM;
    _q_pressao = _q_tensao = _q_lado = 0;
    _ir(IRRIGANDO, now);
    _aplicarSegmento(now, true);              // percentimetro (passo 6) e canhao (passos 7-8)
    if (_ouv) _ouv->aoEvento("irrigando", _plano.id);
}

// Percentimetro e canhao do segmento em que o pivo esta (ou do plano, sem segmentos).
void Maquina::_aplicarSegmento(uint32_t now, bool forcar) {
    int16_t pm = _plano.pm;
    bool can = _plano.canhao;
    if (_plano.nseg && _tem_pos) {
        int i = _plano.nseg - 1;                  // antes do primeiro ini = continua o ultimo (volta)
        for (int k = 0; k < _plano.nseg; k++) if (_plano.seg[k].ini_grau <= _ang) i = k;
        if (i != _seg) {
            bool primeiro = _seg < 0;
            _seg = i;
            if (!primeiro || !forcar) {
                char d[12]; snprintf(d, sizeof(d), "%d", i + 1);
                if (_ouv) _ouv->aoEvento("segmento", d);
            }
            forcar = true;
        }
        pm = _plano.seg[_seg].pm;
        can = _plano.seg[_seg].canhao;
    } else if (_plano.nseg && _seg >= 0) {
        pm = _plano.seg[_seg].pm;
        can = _plano.seg[_seg].canhao;
    }
    if (!_plano.com_agua) { pm = 1000; can = false; }
    if (!forcar) return;
    if (_out.perc_pm != pm) {
        _out.perc_pm = pm;
        if (_ouv) _ouv->aoEvento("passo", "percentimetro");
    }
    bool querCanhao = can && _cfg.tem_canhao;
    if (_out.canhao != querCanhao) _canhao(querCanhao, now);
}

void Maquina::_iniciarDesligar(const char* motivo, bool falha, uint32_t now) {
    copia(_motivo, motivo, sizeof(_motivo));
    _falha_desligar = falha;
    if (falha) copia(_falha, motivo, sizeof(_falha));
    if (_ouv) _ouv->aoEvento(falha ? "falha" : "desligar", motivo);
    _canhao_conf_ate = 0;
    _ir(DESLIGANDO, now);
    if (_out.bomba || _out.valvula) {          // desligar 1: bombeamento (e valvula)
        _out.bomba = false;
        _out.valvula = false;
        _passoPara(D_BOMBA, now, "bomba_desligada");
    } else {
        _depoisBomba(now);
    }
}

void Maquina::_depoisBomba(uint32_t now) {
    _out.perc_pm = -1;                          // desligar 3: percentimetro em 0
    _out.dir = false;                           // desligar 4: lados e canhao
    _out.esq = false;
    _out.canhao = false;
    _passoPara(D_LADO, now, "lados_desligados");
}

void Maquina::_terminar(uint32_t now) {
    _passo = P_NENHUM;
    _contando = false;
    _out = Saidas();
    if (_ouv) _ouv->aoEvento("parado", _motivo);
    _ir(PARADO, now);
}

// Seguranca valida desde que algo foi acionado (ligar 2 em diante). true = mandou desligar.
bool Maquina::_segurancaLigando(uint32_t now) {
    if (_cfg.tem_seguranca && _in.desalinhado) { _iniciarDesligar("seguranca", true, now); return true; }
    if (_cfg.tem_tensao && _queda(_in.tensao, _q_tensao, now)) { _iniciarDesligar("sem_tensao", true, now); return true; }
    return false;
}

void Maquina::tick(uint32_t now, const Entradas& in) {
    _now = now;
    _in = in;
    uint32_t dt = now - _t_passo;

    switch (_st) {
    case PARADO:
        break;

    case LIGANDO:
        if (_passo == L_TENSAO) {
            if (_cfg.tem_seguranca && in.desalinhado) {         // nada ligado ainda: so' registra
                copia(_falha, "seguranca", sizeof(_falha)); copia(_motivo, "seguranca", sizeof(_motivo));
                if (_ouv) _ouv->aoEvento("falha", "seguranca");
                _out = Saidas(); _passo = P_NENHUM; _ir(PARADO, now);
            } else if (!_cfg.tem_tensao || in.tensao) {
                if (_plano.com_agua) _ligarBomba(now);
                else _acionarLado(now);                         // sem agua: pula 2 e 3
            } else if (dt >= _cfg.tensao_ms) {
                copia(_falha, "sem_tensao", sizeof(_falha)); copia(_motivo, "sem_tensao", sizeof(_motivo));
                if (_ouv) _ouv->aoEvento("falha", "sem_tensao");
                _out = Saidas(); _passo = P_NENHUM; _ir(PARADO, now);
            }
            break;
        }
        if (_segurancaLigando(now)) break;
        if (_passo == L_PRESSAO) {
            if (_cfg.tem_pressao) {
                if (in.pressao) _acionarLado(now);
                else if (dt >= _cfg.pressurizacao_ms) _iniciarDesligar("sem_pressao", true, now);
            } else if (dt >= _cfg.pressurizacao_ms) {
                _acionarLado(now);                              // sem pressostato: espera fixa
            }
        } else if (_passo == L_LADO) {
            if (!_temGir() || _gir()) _entrarIrrigando(now);
            else if (dt >= _cfg.confirma_giro_ms) _iniciarDesligar("nao_girou", true, now);
        }
        break;

    case IRRIGANDO: {
        if (_cfg.tem_seguranca && in.desalinhado) { _iniciarDesligar("seguranca", true, now); break; }
        if (_plano.com_agua && _cfg.tem_pressao && _queda(in.pressao, _q_pressao, now)) { _iniciarDesligar("sem_pressao", true, now); break; }
        if (_cfg.tem_tensao && _queda(in.tensao, _q_tensao, now)) { _iniciarDesligar("sem_tensao", true, now); break; }
        if (_temGir() && _queda(_gir(), _q_lado, now)) { _iniciarDesligar("lado_caiu", true, now); break; }
        if (_plano.parada == POR_DURACAO) {
            if ((now - _t_ligar) >= _plano.duracao_s * 1000UL) { _iniciarDesligar("concluido", false, now); break; }
        } else {
            uint32_t ult = (_tem_pos && (int32_t)(_t_pos - _t_ligar) > 0) ? _t_pos : _t_ligar;
            if ((now - ult) >= _cfg.sem_posicao_ms) { _iniciarDesligar("sem_posicao", true, now); break; }
        }
        if (_canhao_conf_ate) {
            if (in.canhao == _out.canhao) {
                _canhao_conf_ate = 0;
                if (_ouv) _ouv->aoEvento("passo", _out.canhao ? "canhao_ligado" : "canhao_desligado");
            } else if ((now - _canhao_conf_ate) >= _cfg.confirma_canhao_ms) {
                _canhao_conf_ate = 0;
                if (_ouv) _ouv->aoEvento("aviso", _out.canhao ? "canhao_nao_ligou" : "canhao_nao_desligou");
            }
        }
        break;
    }

    case DESLIGANDO:
        if (_passo == D_BOMBA) {
            if (!_cfg.tem_pressao || !in.pressao) _depoisBomba(now);
            else if (dt >= _cfg.confirma_bomba_ms) {
                if (_ouv) _ouv->aoEvento("aviso", "pressao_nao_caiu");
                _depoisBomba(now);
            }
        } else if (_passo == D_LADO) {
            bool parado = (!_cfg.tem_gir_dir || !in.gir_dir) && (!_cfg.tem_gir_esq || !in.gir_esq);
            if (parado) _terminar(now);
            else if (dt >= _cfg.confirma_parada_ms) {
                if (!_falha[0]) copia(_falha, "nao_parou", sizeof(_falha));
                if (_ouv) _ouv->aoEvento("falha", "nao_parou");
                _terminar(now);
            }
        }
        break;
    }
}

void Maquina::posicao(float graus, uint32_t now) {
    if (!(graus >= -720.0f && graus <= 720.0f)) return;       // NaN/lixo
    graus = norm360(graus);
    if (!_tem_pos) {
        _tem_pos = true;
        _ang = graus;
        _t_pos = now;
        _t_ang_mudou = now;
        _ang_ref = graus;
    } else {
        float d = dif180(_ang, graus);
        bool salto = absf(d) > SALTO_MAX_GRAUS;
        if (salto) _ang_ref = graus;
        else if (absf(dif180(_ang_ref, graus)) >= MUDOU_GRAUS) { _t_ang_mudou = now; _ang_mudou_ok = true; _ang_ref = graus; }
        if (_contando && !salto && (_st == LIGANDO || _st == IRRIGANDO))
            _percorrido += _plano.dir == 'D' ? d : -d;
        if (salto && _ouv && _st == IRRIGANDO) _ouv->aoEvento("aviso", "salto_posicao");
        _ang = graus;
        _t_pos = now;
    }
    if ((_st == LIGANDO || _st == IRRIGANDO) && !_contando) {
        _contando = true;
        _percorrido = 0;
        if (_plano.parada == POR_VOLTAS) _alvo = 360.0f * _plano.voltas;
        else if (_plano.parada == POR_ANGULO) {
            float d = _plano.dir == 'D' ? norm360(_plano.angulo - _ang) : norm360(_ang - _plano.angulo);
            _alvo = d < 0.5f ? 360.0f : d;
        }
    }
    if (_st != IRRIGANDO) return;
    if (_alvo >= 0 && _percorrido >= _alvo) { _iniciarDesligar("concluido", false, now); return; }
    _aplicarSegmento(now, false);
}

} // namespace pivo
