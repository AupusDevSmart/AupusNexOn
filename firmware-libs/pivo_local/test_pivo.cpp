// Testes no host da lib pivo_local — spec "Automacao do pivo (protocolo e firmware)" + decisoes 12/11.
//   g++ -std=c++17 -O2 -Wall -Wextra -o test_pivo test_pivo.cpp pivo_local.cpp && ./test_pivo
#include "pivo_local.h"
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>

using namespace pivo;

static int falhas = 0, total = 0;
#define CHECK(cond, msg) do { total++; if (cond) printf("ok   %s\n", msg); else { falhas++; printf("FALHOU %s  (%s:%d)\n", msg, __FILE__, __LINE__); } } while (0)

struct Coletor : Ouvinte {
    std::vector<std::string> ev;
    void aoEvento(const char* t, const char* d) override { ev.push_back(std::string(t) + ":" + d); }
    void aoMudarEstado(Estado, Estado) override {}
    bool tem(const std::string& s) const { for (auto& e : ev) if (e == s) return true; return false; }
};

// Painel simulado, passo de 100 ms, encoder a cada 5 s (valor bruto, 1 grau por contagem).
struct Painel {
    Config cfg; Coletor col; Maquina m; Entradas in; uint32_t t = 100000;
    uint32_t atraso_pressao = 3000, atraso_giro = 1000, atraso_canhao = 1000;
    bool quebra_pressao = false, quebra_giro = false, quebra_canhao = false, sem_encoder = false, jitter = false;
    bool tensao = true, seguranca = true;
    float ang = 10.0f, gps100 = 360.0f / 3600.0f;          // 1 volta em 1 h a 100 %
    uint32_t t_bomba = 0, t_dir = 0, t_esq = 0, t_can = 0, t_enc = 0;
    bool bAnt = false, dAnt = false, eAnt = false, cAnt = false;
    int dirJuntas = 0;                                     // ciclos com dir e esq em alto juntos
    Painel(Config c = Config()) : cfg(c), m(c, &col) { in.tensao = true; in.seguranca = true; m.tick(t, in); }
    void passo() {
        t += 100;
        const Saidas& o = m.saidas();
        if (o.bomba != bAnt) { t_bomba = t; bAnt = o.bomba; }
        if (o.dir != dAnt) { t_dir = t; dAnt = o.dir; }
        if (o.esq != eAnt) { t_esq = t; eAnt = o.esq; }
        if (o.canhao != cAnt) { t_can = t; cAnt = o.canhao; }
        in.pressao = !quebra_pressao && o.bomba && t - t_bomba >= atraso_pressao;
        in.gir_dir = !quebra_giro && o.dir && t - t_dir >= atraso_giro;
        in.gir_esq = !quebra_giro && o.esq && t - t_esq >= atraso_giro;
        in.canhao = !quebra_canhao && o.canhao && t - t_can >= atraso_canhao;
        in.tensao = tensao; in.seguranca = seguranca;
        if ((in.gir_dir || in.gir_esq) && o.perc_pm > 0) {
            float v = gps100 * (o.perc_pm / 1000.0f) * 0.1f;
            ang += in.gir_dir ? v : -v;
            while (ang >= 360) ang -= 360;
            while (ang < 0) ang += 360;
        }
        if (!sem_encoder && t - t_enc >= 5000) {
            t_enc = t;
            float leitura = (float)(int)ang;                   // encoder de 360 posicoes: inteiro
            if (jitter && (t / 5000) % 2) leitura += 1;        // vai-e-volta de 1 grau
            m.posicao(leitura, t);
        }
        m.tick(t, in);
        if (m.saidas().dir && m.saidas().esq) dirJuntas++;
    }
    void rodar(uint32_t ms) { for (uint32_t i = 0; i < ms / 100; i++) passo(); }
    bool ate(Estado e, uint32_t ms) { for (uint32_t i = 0; i < ms / 100; i++) { passo(); if (m.estado() == e) return true; } return false; }
    bool ligar(Plano p, char* mot = nullptr) { char x[40]; m.posicao((float)(int)ang, t); t_enc = t; return m.ligar(p, t, mot ? mot : x, 40); }
};

static Plano plano(char dir = 'D', bool agua = true, int16_t pm = 1000, uint32_t graus = 360) {
    Plano p; p.dir = dir; p.com_agua = agua; p.pm = pm; p.graus = graus; strcpy(p.id, "a1b2c3d4");
    return p;
}

int main() {
    // 1) Partida com agua: bomba+valvula -> pressao -> sentido -> giro -> percentimetro e canhao NA HORA
    {
        Config c; c.tem_valvula = true; Painel b(c); Plano p = plano('D', true, 1000, 360); p.canhao = true;
        CHECK(b.ligar(p), "1 ligar aceito");
        CHECK(b.m.saidas().bomba && b.m.saidas().valvula && !b.m.saidas().dir, "1 bomba e valvula juntas, sentido ainda nao");
        CHECK(b.m.estado() == PARTINDO && b.m.passo() == P_PRESSAO, "1 aguardando pressao");
        b.rodar(2900); CHECK(!b.m.saidas().dir, "1 sem pressao ainda: sem sentido");
        b.rodar(200);  CHECK(b.m.saidas().dir && !b.m.saidas().esq, "1 pressao ok -> direita na hora");
        CHECK(b.m.saidas().perc_pm == -1 && !b.m.saidas().canhao, "1 percentimetro e canhao so' depois do giro");
        b.rodar(1100); CHECK(b.m.estado() == GIRANDO, "1 giro confirmado (1 s) -> girando, sem esperar 30 s");
        CHECK(b.m.saidas().perc_pm == 1000 && b.m.saidas().canhao, "1 percentimetro e canhao na hora");
        CHECK(b.ate(PARADO, 2 * 3600 * 1000), "1 parou sozinho");
        CHECK(b.m.motivo() == M_CONCLUIDA, "1 motivo concluida");
        CHECK(b.m.percorrido() >= 359.0f && b.m.percorrido() < 362.0f, "1 percorreu ~360 graus");
        const Saidas& o = b.m.saidas();
        CHECK(!o.bomba && !o.valvula && !o.dir && !o.esq && !o.canhao && o.perc_pm == -1, "1 tudo LOW no fim");
        CHECK(b.dirJuntas == 0, "1 dir e esq nunca juntas");
    }
    // 2) Sem agua: sem bomba, sem espera de pressao, 100 %, canhao LOW mesmo pedido
    {
        Painel b; Plano p = plano('E', false, 300); p.canhao = true;
        CHECK(b.ligar(p), "2 ligar sem agua");
        CHECK(b.m.saidas().esq && !b.m.saidas().bomba, "2 sentido direto, sem bomba");
        CHECK(b.ate(GIRANDO, 5000), "2 girando");
        CHECK(b.m.saidas().perc_pm == 1000 && !b.m.saidas().canhao, "2 100 % e canhao LOW");
    }
    // 3) Condicao de partida: sem tensao ou sem seguranca -> nao executa
    {
        Painel b; b.tensao = false; b.passo(); char mot[40];
        CHECK(!b.ligar(plano(), mot) && !strcmp(mot, "condicao_partida"), "3 sem tensao: recusa");
        CHECK(b.m.motivo() == M_CONDICAO_PARTIDA && !b.m.saidas().bomba, "3 motivo condicao_partida, nada ligado");
        Painel c; c.seguranca = false; c.passo();
        CHECK(!c.ligar(plano(), mot) && !strcmp(mot, "condicao_partida"), "3 seguranca em 0: recusa");
    }
    // 4) Pressao nao subiu no prazo (60 s padrao)
    {
        Painel b; b.quebra_pressao = true; b.ligar(plano());
        b.rodar(59000); CHECK(b.m.estado() == PARTINDO, "4 ainda esperando aos 59 s");
        CHECK(b.ate(PARADO, 3000) && b.m.motivo() == M_PRESSAO_NAO_SUBIU, "4 aos 60 s: pressao_nao_subiu");
        CHECK(!b.m.saidas().bomba, "4 bomba desligada");
    }
    // 5) Sentido nao confirmou
    {
        Config c; c.confirma_giro_ms = 10000; Painel b(c); b.quebra_giro = true; b.ligar(plano());
        CHECK(b.ate(PARADO, 30000) && b.m.motivo() == M_NAO_GIROU, "5 nao_girou");
        CHECK(b.m.saidas().perc_pm == -1, "5 percentimetro nem entrou");
    }
    // 6) Seguranca (BI5 -> 0) desliga na hora, tudo LOW de uma vez
    {
        Painel b; Plano p = plano(); p.canhao = true; b.ligar(p); b.ate(GIRANDO, 10000); b.rodar(5000);
        b.seguranca = false; b.passo();
        const Saidas& o = b.m.saidas();
        CHECK(b.m.estado() == PARADO && b.m.motivo() == M_SEGURANCA, "6 parado no mesmo ciclo, motivo seguranca");
        CHECK(!o.bomba && !o.dir && !o.esq && !o.canhao && o.perc_pm == -1, "6 tudo LOW de uma vez");
    }
    // 7) Quedas com tolerancia 0 (padrao): pressao e tensao desligam no 1o ciclo
    {
        Painel b; b.ligar(plano()); b.ate(GIRANDO, 10000); b.rodar(3000);
        b.quebra_pressao = true; b.passo();
        CHECK(b.m.estado() == PARADO && b.m.motivo() == M_QUEDA_PRESSAO, "7 queda_pressao na hora");
        Painel c; c.ligar(plano()); c.ate(GIRANDO, 10000); c.rodar(3000);
        c.tensao = false; c.passo();
        CHECK(c.m.motivo() == M_TENSAO, "7 tensao na hora");
    }
    // 7b) Tolerancias configuradas (spec: 10 s) separadas
    {
        Config c; c.tol_pressao_ms = 10000; c.tol_tensao_ms = 10000;
        Painel b(c); b.ligar(plano()); b.ate(GIRANDO, 10000); b.rodar(3000);
        b.quebra_pressao = true; b.rodar(9000); b.quebra_pressao = false; b.rodar(5000);
        CHECK(b.m.estado() == GIRANDO, "7b queda de 9 s tolerada");
        b.quebra_pressao = true; b.rodar(10500);
        CHECK(b.m.motivo() == M_QUEDA_PRESSAO, "7b queda de 10 s desliga");
    }
    // 8) Desligar do operador: tudo LOW na hora, motivo comando_operador
    {
        Painel b; Plano p = plano(); p.canhao = true; b.ligar(p); b.ate(GIRANDO, 10000); b.rodar(3000);
        b.m.desligar(M_COMANDO, b.t);
        const Saidas& o = b.m.saidas();
        CHECK(b.m.estado() == PARADO && b.m.motivo() == M_COMANDO, "8 parado, comando_operador");
        CHECK(!o.bomba && !o.valvula && !o.dir && !o.esq && !o.canhao && o.perc_pm == -1, "8 tudo LOW");
        Painel c; c.ligar(plano()); c.rodar(1000); c.m.desligar(M_COMANDO, c.t);
        CHECK(c.m.estado() == PARADO && !c.m.saidas().bomba, "8 desligar no meio da partida");
    }
    // 9) Parada em graus maiores que uma volta (2 voltas = 720) e pela virada 359 -> 0
    {
        Painel b; b.ang = 350; b.gps100 = 360.0f / 600.0f; b.ligar(plano('D', true, 1000, 720));
        CHECK(b.ate(PARADO, 3600 * 1000) && b.m.motivo() == M_CONCLUIDA, "9 parou");
        CHECK(b.m.percorrido() >= 719.0f && b.m.percorrido() < 724.0f, "9 percorreu ~720 graus");
        Painel c; c.ang = 5; c.gps100 = 360.0f / 600.0f; c.ligar(plano('E', true, 1000, 30));
        c.ate(PARADO, 3600 * 1000);
        CHECK(c.m.percorrido() >= 29.0f && c.m.percorrido() < 33.0f, "9 esquerda pela virada 0 -> 359: 30 graus");
    }
    // 10) Jitter de 1 grau do encoder nao soma (pivo parado irrigando a 0 %)
    {
        Painel b; b.jitter = true; b.ligar(plano('D', true, 0, 30)); b.ate(GIRANDO, 10000);
        b.rodar(30 * 60 * 1000);
        CHECK(b.m.estado() == GIRANDO && b.m.percorrido() <= 1.5f, "10 30 min de vai-e-volta: nao parou nem somou");
    }
    // 11) Encoder parou de responder: segue girando com alerta erro_posicao
    {
        Painel b; b.ligar(plano()); b.ate(GIRANDO, 10000); b.rodar(10000);
        b.sem_encoder = true; b.rodar(40000);
        CHECK(b.m.estado() == GIRANDO, "11 continua girando");
        CHECK(b.m.alertas() & A_ERRO_POSICAO, "11 alerta erro_posicao");
        b.sem_encoder = false; b.rodar(6000);
        CHECK(!(b.m.alertas() & A_ERRO_POSICAO), "11 leitura voltou: alerta some");
    }
    // 12) Canhao sem retorno: alerta falha_canhao em 5 s, segue girando
    {
        Painel b; b.quebra_canhao = true; Plano p = plano(); p.canhao = true; b.ligar(p); b.ate(GIRANDO, 10000);
        b.rodar(4000); CHECK(!(b.m.alertas() & A_FALHA_CANHAO), "12 antes de 5 s sem alerta");
        b.rodar(1500); CHECK(b.m.alertas() & A_FALHA_CANHAO, "12 alerta falha_canhao");
        CHECK(b.m.estado() == GIRANDO, "12 segue girando");
    }
    // 13) Canhao por faixa: [100, 200] OFF; e faixa pelo zero [340, 20]
    {
        Painel b; b.ang = 80; b.gps100 = 360.0f / 600.0f; Plano p = plano('D', true, 1000, 180);
        p.canhao = true; p.tem_faixa = true; p.desliga_em = 100; p.liga_em = 200;
        b.ligar(p); b.ate(GIRANDO, 10000);
        CHECK(b.m.saidas().canhao, "13 em 80 graus: canhao ligado");
        while (b.ang < 120 && b.m.estado() == GIRANDO) b.passo();
        b.rodar(6000); CHECK(!b.m.saidas().canhao, "13 em ~120 graus: canhao OFF (dentro da faixa)");
        while (b.ang < 215 && b.m.estado() == GIRANDO) b.passo();
        b.rodar(6000); CHECK(b.m.saidas().canhao, "13 em ~215 graus: canhao ligado de novo");
        Plano q = plano(); q.tem_faixa = true; q.desliga_em = 340; q.liga_em = 20; q.canhao = true;
        Painel c; c.ang = 350; c.ligar(q); c.ate(GIRANDO, 10000);
        CHECK(!c.m.saidas().canhao, "13 faixa pelo zero: em 350 canhao OFF");
    }
    // 14) Ajustes: percentimetro e canhao (on/off/faixa); idempotente
    {
        Painel b; b.ligar(plano('D', true, 600)); b.ate(GIRANDO, 10000); char mot[32];
        CHECK(b.m.ajustarPercentimetro(300, mot, sizeof mot) && b.m.saidas().perc_pm == 300, "14 percentimetro ajustado");
        CHECK(b.m.ajustarCanhao(true, false, 0, 0, b.t, mot, sizeof mot) && b.m.saidas().canhao, "14 canhao ligado");
        CHECK(b.m.ajustarCanhao(true, false, 0, 0, b.t, mot, sizeof mot), "14 ligar de novo = sucesso");
        CHECK(b.m.ajustarCanhao(false, false, 0, 0, b.t, mot, sizeof mot) && !b.m.saidas().canhao, "14 canhao desligado");
        Painel s; s.ligar(plano('D', false)); s.ate(GIRANDO, 5000);
        CHECK(!s.m.ajustarCanhao(true, false, 0, 0, s.t, mot, sizeof mot) && !strcmp(mot, "sem_agua"), "14 sem agua: canhao recusado");
    }
    // 15) Recusas
    {
        Painel b; char mot[40];
        b.in.gir_esq = true; b.m.tick(b.t, b.in);
        CHECK(!b.m.ligar(plano(), b.t, mot, sizeof mot) && !strcmp(mot, "pivo_girando"), "15 pivo girando pelo painel");
        b.in.gir_esq = false; b.m.tick(b.t, b.in);
        CHECK(!b.m.ligar(plano('D', true, 1000, 0), b.t, mot, sizeof mot) && !strncmp(mot, "plano_invalido", 14), "15 parada 0 graus invalida");
        CHECK(b.m.ligar(plano(), b.t, mot, sizeof mot), "15 liga");
        CHECK(!b.m.ligar(plano(), b.t, mot, sizeof mot) && !strcmp(mot, "ja_ligado"), "15 nova ordem com o pivo ligado: recusa");
    }
    // 16) Giro caiu com o pivo girando: desliga (lado_caiu)
    {
        Painel b; b.ligar(plano()); b.ate(GIRANDO, 10000); b.rodar(3000);
        b.quebra_giro = true; b.passo();
        CHECK(b.m.motivo() == M_LADO_CAIU && !b.m.saidas().bomba, "16 lado_caiu desliga");
    }
    // 17) Sem encoder (provisorio): parada por duracao
    {
        Painel b; b.sem_encoder = true; Plano p = plano(); p.parada = POR_DURACAO; p.duracao_s = 600;
        char mot[32]; CHECK(b.m.ligar(p, b.t, mot, sizeof mot), "17 liga por duracao");
        uint32_t t0 = b.t;
        CHECK(b.ate(PARADO, 3600 * 1000) && b.m.motivo() == M_CONCLUIDA, "17 concluida");
        CHECK(b.t - t0 >= 600000 && b.t - t0 < 601000, "17 em 10 min");
    }
    // 18) Sentido: ligar esquerda depois de direita nunca deixa os dois em alto
    {
        Painel b; b.ligar(plano('D')); b.ate(GIRANDO, 10000); b.rodar(2000);
        b.m.desligar(M_COMANDO, b.t); b.rodar(2000);
        b.ligar(plano('E')); b.ate(GIRANDO, 10000); b.rodar(2000);
        CHECK(b.m.saidas().esq && !b.m.saidas().dir && b.dirJuntas == 0, "18 so' a esquerda");
    }

    printf("\n%d/%d ok\n", total - falhas, total);
    return falhas ? 1 : 0;
}
