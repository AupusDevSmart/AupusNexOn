// pivo_local.cpp — ver pivo_local.h. C++ puro.
#include "pivo_local.h"
#include <string.h>
#include <stdio.h>

namespace pivo {

const char* estadoNome(Estado e) {
    switch (e) {
        case PARADO:   return "parado";
        case PARTINDO: return "aguardando_pressao";
        case GIRANDO:  return "girando";
    }
    return "?";
}

const char* passoNome(Passo p) {
    switch (p) {
        case P_NENHUM:  return "";
        case P_PRESSAO: return "pressao";
        case P_GIRO:    return "giro";
    }
    return "?";
}

const char* motivoNome(uint8_t m) {
    switch (m) {
        case M_NENHUMA: return "nenhuma";
        case M_CONCLUIDA: return "concluida";
        case M_COMANDO: return "comando_operador";
        case M_QUEDA_PRESSAO: return "queda_pressao";
        case M_PRESSAO_NAO_SUBIU: return "pressao_nao_subiu";
        case M_TENSAO: return "tensao";
        case M_SEGURANCA: return "seguranca";
        case M_REINICIO: return "reinicio_slave";
        case M_CONDICAO_PARTIDA: return "condicao_partida";
        case M_NAO_GIROU: return "nao_girou";
        case M_LADO_CAIU: return "lado_caiu";
        case M_FALHA_RELES: return "falha_reles";
    }
    return "?";
}

static float norm360(float g) {
    while (g >= 360.0f) g -= 360.0f;
    while (g < 0.0f) g += 360.0f;
    return g;
}
static float dif180(float a, float b) {          // menor caminho b - a, em (-180, 180]
    float d = norm360(b - a);
    return d > 180.0f ? d - 360.0f : d;
}
static float absf(float x) { return x < 0 ? -x : x; }
static void copia(char* dst, const char* src, size_t n) {
    if (!dst || !n) return;
    if (!src) src = "";
    strncpy(dst, src, n - 1);
    dst[n - 1] = 0;
}

static const float SALTO_MAX_GRAUS = 30.0f;   // leitura que pula mais que isso = glitch, nao conta
static const float MUDOU_GRAUS     = 0.5f;    // abaixo disso nao conta como "angulo mudando"

bool validarPlano(Plano& p, char* motivo, size_t msz) {
    if (p.dir != 'D' && p.dir != 'E') { copia(motivo, "direcao", msz); return false; }
    if (p.pm < 0 || p.pm > 1000) { copia(motivo, "percentimetro", msz); return false; }
    if (p.parada == POR_GRAUS) {
        if (p.graus == 0 || p.graus > 360UL * 50UL) { copia(motivo, "parada", msz); return false; }
    } else if (p.parada == POR_DURACAO) {
        if (p.duracao_s == 0 || p.duracao_s > 7UL * 86400UL) { copia(motivo, "duracao", msz); return false; }
    } else { copia(motivo, "parada", msz); return false; }
    if (p.tem_faixa && (p.desliga_em > 359 || p.liga_em > 359)) { copia(motivo, "faixa", msz); return false; }
    if (!p.com_agua) { p.pm = 1000; p.canhao = false; }   // sem agua: 100 % e canhao LOW (spec 6.3)
    p.id[ID_LEN - 1] = 0;
    if (motivo && msz) motivo[0] = 0;
    return true;
}

Maquina::Maquina(const Config& cfg, Ouvinte* ouv) : _cfg(cfg), _ouv(ouv) {}

void Maquina::_ir(Estado e) {
    if (e == _st) return;
    Estado de = _st;
    _st = e;
    if (_ouv) _ouv->aoMudarEstado(de, e);
}

bool Maquina::_queda(bool ok, uint32_t& desde, uint32_t tol, uint32_t now) {
    if (ok) { desde = 0; return false; }
    if (!desde) desde = now ? now : 1;
    return (now - desde) >= tol;
}

float Maquina::percorrido() const { return absf(_soma); }

bool Maquina::girando(uint32_t now) const {
    return _st == GIRANDO && _out.perc_pm > 0 && _ang_mudou_ok && (now - _t_ang_mudou) < _cfg.janela_giro_ms;
}

// ---------------------------------------------------------------- comandos

bool Maquina::ligar(const Plano& p, uint32_t now, char* motivo, size_t msz) {
    if (_st != PARADO) { copia(motivo, "ja_ligado", msz); return false; }
    Plano q = p;
    char m[24];
    if (!validarPlano(q, m, sizeof(m))) {
        char t[40];
        snprintf(t, sizeof(t), "plano_invalido:%s", m);
        copia(motivo, t, msz);
        return false;
    }
    // Condicao de partida (spec 6.2 item 1): tensao e seguranca ok, senao NAO executa.
    if ((_cfg.tem_tensao && !_in.tensao) || (_cfg.tem_seguranca && !_in.seguranca)) {
        _motivo = M_CONDICAO_PARTIDA;
        _evento("parado", "condicao_partida");
        copia(motivo, "condicao_partida", msz);
        return false;
    }
    // Pivo ja' girando pelo painel (retorno de sentido ativo): nao parte por cima.
    if ((_cfg.tem_gir_dir && _in.gir_dir) || (_cfg.tem_gir_esq && _in.gir_esq)) { copia(motivo, "pivo_girando", msz); return false; }

    _plano = q;
    _motivo = M_NENHUMA;
    _alertas = 0;
    _soma = 0; _contando = false;
    _t_canhao_sem = 0; _q_pressao = _q_tensao = _q_lado = 0;
    _t_ligar = now;
    _out = Saidas();
    _evento("ligar", _plano.id);
    _ir(PARTINDO);
    if (_plano.com_agua) {
        _out.bomba = true;                       // spec 6.2 item 2: BO1 e BO2 juntas
        _out.valvula = _cfg.tem_valvula;
        _passo = P_PRESSAO; _t_passo = now;
        _evento("passo", "bomba_ligada");
    } else {
        _acionarLado(now);                       // spec 6.3: sem agua nao liga bomba nem espera pressao
    }
    if (motivo && msz) motivo[0] = 0;
    return true;
}

void Maquina::desligar(uint8_t motivo, uint32_t now) {
    (void)now;
    bool estava = _st != PARADO;
    _out = Saidas();                             // spec 6.6: BO1..BO6 LOW, percentimetro 0
    _passo = P_NENHUM;
    _contando = false;
    _t_canhao_sem = 0;
    _alertas &= (uint8_t)~(A_FALHA_CANHAO | A_ERRO_POSICAO);
    if (estava || motivo != M_COMANDO) _motivo = motivo;
    if (estava) _evento("parado", motivoNome(motivo));
    _ir(PARADO);
}

bool Maquina::ajustarPercentimetro(int16_t pm, char* motivo, size_t msz) {
    if (_st != GIRANDO) { copia(motivo, "nao_girando", msz); return false; }
    if (!_plano.com_agua) { copia(motivo, "sem_agua", msz); return false; }
    if (pm < 0 || pm > 1000) { copia(motivo, "percentimetro", msz); return false; }
    _plano.pm = pm;
    _out.perc_pm = pm;
    _evento("passo", "percentimetro");
    if (motivo && msz) motivo[0] = 0;
    return true;
}

bool Maquina::ajustarCanhao(bool ligado, bool tem_faixa, uint16_t desliga_em, uint16_t liga_em, uint32_t now, char* motivo, size_t msz) {
    if (_st != GIRANDO) { copia(motivo, "nao_girando", msz); return false; }
    if (!_plano.com_agua) { copia(motivo, "sem_agua", msz); return false; }
    if (!_cfg.tem_canhao) { copia(motivo, "sem_canhao", msz); return false; }
    if (tem_faixa && (desliga_em > 359 || liga_em > 359)) { copia(motivo, "faixa", msz); return false; }
    _plano.canhao = ligado;
    _plano.tem_faixa = tem_faixa;
    _plano.desliga_em = desliga_em;
    _plano.liga_em = liga_em;
    _avaliarCanhao(now);                         // idempotente: pedir o estado atual = sucesso
    if (motivo && msz) motivo[0] = 0;
    return true;
}

// ---------------------------------------------------------------- sequencia

void Maquina::_acionarLado(uint32_t now) {
    _out.dir = _plano.dir == 'D';               // nunca os dois (BO3 xor BO4)
    _out.esq = _plano.dir == 'E';
    _passo = P_GIRO; _t_passo = now;
    _evento("passo", _plano.dir == 'D' ? "girar_direita" : "girar_esquerda");
}

void Maquina::_entrarGirando(uint32_t now) {
    _passo = P_NENHUM;
    _q_pressao = _q_tensao = _q_lado = 0;
    _out.perc_pm = _plano.com_agua ? _plano.pm : 1000;   // percentimetro entra no loop
    _ir(GIRANDO);
    _evento("girando", _plano.id);
    // Referencia dos graus percorridos (spec 6.2 item 6): leitura recente vale; senao a proxima.
    _soma = 0;
    _contando = _tem_pos && (now - _t_pos) < _cfg.sem_posicao_ms;
    _avaliarCanhao(now);                         // canhao na hora (sem esperar BI6)
}

// Dentro de [desliga_em, liga_em] o canhao fica OFF; faixa que passa pelo zero (ex.: 340..20).
bool Maquina::_canhaoNaFaixaOff() const {
    if (!_plano.tem_faixa || !_tem_pos) return false;
    int a = (int)(_ang + 0.5f) % 360;
    int d = _plano.desliga_em, l = _plano.liga_em;
    if (d <= l) return a >= d && a <= l;
    return a >= d || a <= l;
}

void Maquina::_avaliarCanhao(uint32_t now) {
    bool quer = _st == GIRANDO && _plano.com_agua && _plano.canhao && _cfg.tem_canhao && !_canhaoNaFaixaOff();
    if (_out.canhao != quer) {
        _out.canhao = quer;
        _t_canhao_sem = 0;
        _evento("passo", quer ? "canhao_ligar" : "canhao_desligar");
    }
    if (!quer) { _t_canhao_sem = 0; _alertas &= (uint8_t)~A_FALHA_CANHAO; }
    (void)now;
}

void Maquina::tick(uint32_t now, const Entradas& in) {
    _in = in;
    if (_st == PARADO) return;

    // Seguranca (BI5): 0 ou sem sinal -> desliga NA HORA (spec 6.4), em qualquer etapa
    if (_cfg.tem_seguranca && !in.seguranca) { desligar(M_SEGURANCA, now); return; }
    if (_cfg.tem_tensao && _queda(in.tensao, _q_tensao, _cfg.tol_tensao_ms, now)) { desligar(M_TENSAO, now); return; }
    uint32_t dt = now - _t_passo;

    if (_st == PARTINDO) {
        if (_passo == P_PRESSAO) {
            if (_cfg.tem_pressao ? in.pressao : dt >= _cfg.espera_pressao_ms) _acionarLado(now);
            else if (_cfg.tem_pressao && dt >= _cfg.espera_pressao_ms) desligar(M_PRESSAO_NAO_SUBIU, now);
        } else if (_passo == P_GIRO) {
            if (!_temGir() || _gir()) _entrarGirando(now);          // confirmou: segue NA HORA
            else if (dt >= _cfg.confirma_giro_ms) desligar(M_NAO_GIROU, now);
        }
        return;
    }

    // GIRANDO
    if (_plano.com_agua && _cfg.tem_pressao && _queda(in.pressao, _q_pressao, _cfg.tol_pressao_ms, now)) { desligar(M_QUEDA_PRESSAO, now); return; }
    if (_temGir() && _queda(_gir(), _q_lado, _cfg.tol_lado_ms, now)) { desligar(M_LADO_CAIU, now); return; }
    if (_plano.parada == POR_DURACAO && (now - _t_ligar) >= _plano.duracao_s * 1000UL) { desligar(M_CONCLUIDA, now); return; }

    // Encoder sem leitura: mantem a operacao e sinaliza (spec 6.4); o operador decide.
    if (_plano.parada == POR_GRAUS || _plano.tem_faixa) {
        uint32_t ult = (_tem_pos && (int32_t)(_t_pos - _t_ligar) > 0) ? _t_pos : _t_ligar;
        if ((now - ult) >= _cfg.sem_posicao_ms) _alertas |= A_ERRO_POSICAO;
    }
    // Canhao: ligado e a BI6 nao confirma -> alerta (nao para)
    if (_out.canhao && _cfg.tem_canhao_st) {
        if (in.canhao) { _t_canhao_sem = 0; _alertas &= (uint8_t)~A_FALHA_CANHAO; }
        else {
            if (!_t_canhao_sem) _t_canhao_sem = now ? now : 1;
            if ((now - _t_canhao_sem) >= _cfg.confirma_canhao_ms) _alertas |= A_FALHA_CANHAO;
        }
    }
}

void Maquina::posicao(float g, uint32_t now) {
    if (!(g >= -720.0f && g <= 720.0f)) return;            // NaN/lixo
    g = norm360(g);
    if (!_tem_pos) {
        _tem_pos = true; _ang = g; _ang_ref = g; _t_pos = now; _t_ang_mudou = now;
    } else {
        float d = dif180(_ang, g);
        bool salto = absf(d) > SALTO_MAX_GRAUS;
        if (!salto && absf(dif180(_ang_ref, g)) >= MUDOU_GRAUS) { _t_ang_mudou = now; _ang_mudou_ok = true; _ang_ref = g; }
        if (salto) _ang_ref = g;
        // Soma COM SINAL (o vai-e-volta de 1 grau do encoder se cancela); percorrido = |soma|.
        if (_contando && !salto && _st == GIRANDO) _soma += d;
        _ang = g; _t_pos = now;
    }
    _alertas &= (uint8_t)~A_ERRO_POSICAO;
    if (_st != GIRANDO) return;
    if (!_contando) { _contando = true; _soma = 0; }        // 1a leitura depois de girar = referencia
    if (_plano.parada == POR_GRAUS && absf(_soma) >= (float)_plano.graus) { desligar(M_CONCLUIDA, now); return; }
    _avaliarCanhao(now);                                     // faixa do canhao a cada posicao
}

} // namespace pivo
