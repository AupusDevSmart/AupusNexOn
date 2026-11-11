// Testes no host da lib pivo_local — docs/IOT-PIVO-TON-LOCAL.md.
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
    std::vector<std::string> ev, estados;
    void aoEvento(const char* tipo, const char* det) override { ev.push_back(std::string(tipo) + ":" + det); }
    void aoMudarEstado(Estado, Estado para) override { estados.push_back(estadoNome(para)); }
    bool tem(const std::string& s) const { for (auto& e : ev) if (e == s) return true; return false; }
    int idx(const std::string& s) const { for (size_t i = 0; i < ev.size(); i++) if (ev[i] == s) return (int)i; return -1; }
};

// Painel simulado. Passo de 100 ms. Encoder publica a cada 5 s.
struct Painel {
    Config cfg; Coletor col; Maquina m; Entradas in; uint32_t t = 100000;
    // atrasos do painel
    uint32_t atraso_pressao = 5000, atraso_pressao_off = 2000, atraso_giro = 1000, atraso_canhao = 1000;
    bool quebra_pressao = false, quebra_giro = false, quebra_canhao = false, lado_preso = false, sem_encoder = false;
    bool tensao = true, desalinhado = false;
    float ang = 10.0f, graus_por_s_100 = 360.0f / 7200.0f;   // 1 volta em 2 h a 100 %
    uint32_t t_bomba = 0, t_dir = 0, t_esq = 0, t_can = 0, t_enc = 0;
    bool bAnt = false, dAnt = false, eAnt = false, cAnt = false;
    // historico de saidas p/ conferir ordem
    std::vector<std::string> ordem;
    Saidas oAnt;
    Painel(Config c = Config()) : cfg(c), m(c, &col) { in.tensao = true; }
    void passo() {
        t += 100;
        const Saidas& o = m.saidas();
        if (o.bomba != bAnt) { t_bomba = t; bAnt = o.bomba; }
        if (o.dir != dAnt) { t_dir = t; dAnt = o.dir; }
        if (o.esq != eAnt) { t_esq = t; eAnt = o.esq; }
        if (o.canhao != cAnt) { t_can = t; cAnt = o.canhao; }
        in.pressao = quebra_pressao ? false : (o.bomba ? (t - t_bomba >= atraso_pressao) : (in.pressao && t - t_bomba < atraso_pressao_off));
        in.gir_dir = lado_preso ? in.gir_dir || o.dir : (quebra_giro ? false : (o.dir && t - t_dir >= atraso_giro));
        in.gir_esq = lado_preso ? in.gir_esq || o.esq : (quebra_giro ? false : (o.esq && t - t_esq >= atraso_giro));
        in.canhao = quebra_canhao ? false : (o.canhao ? (t - t_can >= atraso_canhao) : false);
        in.tensao = tensao;
        in.desalinhado = desalinhado;
        // movimento: lado confirmado e percentimetro (continuo, aproximado)
        if ((in.gir_dir || in.gir_esq) && o.perc_pm > 0) {
            float v = graus_por_s_100 * (o.perc_pm / 1000.0f) * 0.1f;
            ang += in.gir_dir ? v : -v;
            while (ang >= 360) ang -= 360;
            while (ang < 0) ang += 360;
        }
        if (!sem_encoder && t - t_enc >= 5000) { t_enc = t; m.posicao(ang, t); }
        m.tick(t, in);
        const Saidas& n = m.saidas();
        // mesmo tick: registra na ordem da spec (bomba, percentimetro, lados, canhao)
        if (n.bomba != oAnt.bomba) ordem.push_back(n.bomba ? "bomba+" : "bomba-");
        if (n.perc_pm != oAnt.perc_pm) ordem.push_back("perc" + std::to_string(n.perc_pm));
        if (n.dir != oAnt.dir) ordem.push_back(n.dir ? "dir+" : "dir-");
        if (n.esq != oAnt.esq) ordem.push_back(n.esq ? "esq+" : "esq-");
        if (n.canhao != oAnt.canhao) ordem.push_back(n.canhao ? "canhao+" : "canhao-");
        oAnt = n;
    }
    void rodar(uint32_t ms) { for (uint32_t i = 0; i < ms / 100; i++) passo(); }
    bool ate(Estado e, uint32_t ms_max) { for (uint32_t i = 0; i < ms_max / 100; i++) { passo(); if (m.estado() == e) return true; } return false; }
    bool ligar(Plano p) { char mot[40]; m.posicao(ang, t); t_enc = t; return m.ligar(p, t, mot, sizeof(mot)); }
    int pos(const std::string& s) const { for (size_t i = 0; i < ordem.size(); i++) if (ordem[i] == s) return (int)i; return -1; }
};

static Plano plano(char dir = 'D', bool agua = true, int16_t pm = 1000) {
    Plano p; p.dir = dir; p.com_agua = agua; p.pm = pm; strcpy(p.id, "IRR1");
    return p;
}

int main() {
    // 1) Com agua, 1 volta: ordem completa de ligar e desligar
    {
        Painel b; Plano p = plano('D', true, 1000); p.canhao = true;
        CHECK(b.ligar(p), "1 ligar aceito");
        CHECK(b.ate(IRRIGANDO, 60000), "1 chegou a IRRIGANDO");
        CHECK(b.pos("bomba+") >= 0 && b.pos("bomba+") < b.pos("dir+"), "1 bomba antes do lado");
        CHECK(b.pos("dir+") < b.pos("perc1000"), "1 lado antes do percentimetro");
        CHECK(b.pos("perc1000") < b.pos("canhao+"), "1 percentimetro antes do canhao");
        b.rodar(3000);
        CHECK(b.col.tem("passo:canhao_ligado"), "1 canhao confirmado (BI06)");
        CHECK(b.ate(PARADO, 3 * 3600 * 1000), "1 parou sozinho");
        CHECK(!strcmp(b.m.motivoParada(), "concluido") && b.m.falha()[0] == 0, "1 motivo concluido, sem falha");
        CHECK(b.m.percorrido() >= 359.0f && b.m.percorrido() < 362.0f, "1 percorreu ~360 graus");
        int bo = b.pos("bomba-"), pc = b.pos("perc-1"), dr = b.pos("dir-");
        CHECK(bo >= 0 && bo < pc && pc <= dr, "1 desligar: bomba, depois percentimetro, depois lado");
        CHECK(b.col.idx("passo:bomba_desligada") < b.col.idx("passo:lados_desligados"), "1 espera pressao cair antes dos lados");
        const Saidas& o = b.m.saidas();
        CHECK(!o.bomba && !o.dir && !o.esq && !o.canhao && o.perc_pm == -1, "1 tudo desligado no fim");
    }
    // 2) Sem agua: nao liga bomba, percentimetro 100 %, sem canhao
    {
        Painel b; Plano p = plano('E', false, 300); p.canhao = true;
        CHECK(b.ligar(p), "2 ligar sem agua");
        CHECK(b.ate(IRRIGANDO, 10000), "2 irrigando (seco) rapido");
        CHECK(b.pos("bomba+") < 0, "2 bomba nunca ligou");
        CHECK(b.m.saidas().perc_pm == 1000, "2 percentimetro 100 %");
        CHECK(!b.m.saidas().canhao, "2 canhao bloqueado");
        CHECK(b.m.saidas().esq && !b.m.saidas().dir, "2 lado esquerdo");
    }
    // 3) Sem tensao: nada liga
    {
        Painel b; b.tensao = false;
        CHECK(b.ligar(plano()), "3 aceita o comando");
        CHECK(b.ate(PARADO, 10000), "3 volta a PARADO");
        CHECK(!strcmp(b.m.falha(), "sem_tensao"), "3 falha sem_tensao");
        CHECK(b.ordem.empty(), "3 nenhuma saida acionada");
    }
    // 4) Sem pressao: desliga a bomba depois da pressurizacao
    {
        Config c; c.pressurizacao_ms = 20000; Painel b(c); b.quebra_pressao = true;
        b.ligar(plano());
        CHECK(b.ate(PARADO, 60000), "4 parou");
        CHECK(!strcmp(b.m.falha(), "sem_pressao"), "4 falha sem_pressao");
        CHECK(b.pos("dir+") < 0 && b.pos("bomba-") > 0, "4 nao girou e desligou a bomba");
    }
    // 5) Lado nao confirma
    {
        Config c; c.confirma_giro_ms = 10000; Painel b(c); b.quebra_giro = true;
        b.ligar(plano());
        CHECK(b.ate(PARADO, 60000), "5 parou");
        CHECK(!strcmp(b.m.falha(), "nao_girou"), "5 falha nao_girou");
        CHECK(b.pos("perc1000") < 0, "5 percentimetro nem ativou");
    }
    // 6) Seguranca atua irrigando: desliga na hora
    {
        Painel b; b.ligar(plano());
        b.ate(IRRIGANDO, 60000); b.rodar(10000);
        b.desalinhado = true; b.passo();
        CHECK(b.m.estado() == DESLIGANDO, "6 desligando no mesmo tick");
        CHECK(!b.m.saidas().bomba, "6 bomba cortada na hora");
        CHECK(b.ate(PARADO, 60000) && !strcmp(b.m.falha(), "seguranca"), "6 falha seguranca");
    }
    // 7) Queda de pressao: 2 s tolera, 4 s desliga
    {
        Painel b; b.ligar(plano()); b.ate(IRRIGANDO, 60000); b.rodar(10000);
        b.quebra_pressao = true; b.rodar(2000); b.quebra_pressao = false; b.rodar(1000);
        CHECK(b.m.estado() == IRRIGANDO, "7 queda de 2 s tolerada");
        b.quebra_pressao = true; b.rodar(4000);
        CHECK(b.m.estado() != IRRIGANDO && !strcmp(b.m.falha(), "sem_pressao"), "7 queda de 4 s desliga");
    }
    // 7b) Queda de tensao e lado
    {
        Painel b; b.ligar(plano()); b.ate(IRRIGANDO, 60000); b.rodar(5000);
        b.tensao = false; b.rodar(3500);
        CHECK(!strcmp(b.m.falha(), "sem_tensao"), "7b queda de tensao desliga");
        Painel c; c.ligar(plano()); c.ate(IRRIGANDO, 60000); c.rodar(5000);
        c.quebra_giro = true; c.rodar(3500);
        CHECK(!strcmp(c.m.falha(), "lado_caiu"), "7b lado caiu = lado_caiu");
    }
    // 8) Por angulo, direita 10 -> 100
    {
        Painel b; b.ang = 10; Plano p = plano('D'); p.parada = POR_ANGULO; p.angulo = 100;
        b.ligar(p);
        CHECK(b.m.alvo() > 89.9f && b.m.alvo() < 90.1f, "8 alvo 90 graus");
        CHECK(b.ate(PARADO, 3 * 3600 * 1000), "8 parou");
        CHECK(b.ang >= 99.0f && b.ang < 102.0f, "8 parou perto de 100");
    }
    // 8b) Esquerda 100 -> 10 e volta pelo zero (direita 350 -> 20)
    {
        Painel b; b.ang = 100; Plano p = plano('E'); p.parada = POR_ANGULO; p.angulo = 10;
        b.ligar(p);
        CHECK(b.m.alvo() > 89.9f && b.m.alvo() < 90.1f, "8b esquerda: alvo 90");
        b.ate(PARADO, 3 * 3600 * 1000);
        CHECK(b.ang >= 8.0f && b.ang <= 11.0f, "8b parou perto de 10");
        Painel c; c.ang = 350; Plano q = plano('D'); q.parada = POR_ANGULO; q.angulo = 20;
        c.ligar(q);
        CHECK(c.m.alvo() > 29.9f && c.m.alvo() < 30.1f, "8b passa pelo zero: alvo 30");
        c.ate(PARADO, 3 * 3600 * 1000);
        CHECK(c.ang >= 19.0f && c.ang < 22.0f, "8b parou perto de 20");
    }
    // 9) Por duracao (horario convertido): 10 min
    {
        Painel b; Plano p = plano(); p.parada = POR_DURACAO; p.duracao_s = 600;
        b.ligar(p); uint32_t t0 = b.t;
        CHECK(b.ate(DESLIGANDO, 3600 * 1000), "9 desligou");
        CHECK(b.t - t0 >= 600000 && b.t - t0 < 601000, "9 em 10 min");
        CHECK(!strcmp(b.m.motivoParada(), "concluido"), "9 concluido");
    }
    // 10) Sem encoder com parada por posicao: falha sem_posicao
    {
        Painel b; b.sem_encoder = true;
        char mot[32]; CHECK(b.m.ligar(plano(), b.t, mot, sizeof(mot)), "10 liga sem posicao conhecida");
        CHECK(b.ate(PARADO, 10 * 60 * 1000), "10 parou");
        CHECK(!strcmp(b.m.falha(), "sem_posicao"), "10 falha sem_posicao");
        Painel c; c.sem_encoder = true; Plano p = plano(); p.parada = POR_DURACAO; p.duracao_s = 900;
        c.m.ligar(p, c.t, mot, sizeof(mot)); c.rodar(10 * 60 * 1000);
        CHECK(c.m.estado() == IRRIGANDO, "10 por duracao nao precisa de encoder");
    }
    // 11) Segmentos: percentimetro e canhao mudam ao cruzar
    {
        Painel b; b.ang = 80; b.graus_por_s_100 = 360.0f / 3600.0f;
        Plano p = plano('D'); p.parada = POR_ANGULO; p.angulo = 200; p.nseg = 4;
        p.seg[0] = {0, 1000, false}; p.seg[1] = {90, 500, true}; p.seg[2] = {180, 1000, false}; p.seg[3] = {270, 250, false};
        b.ligar(p); b.ate(IRRIGANDO, 60000);
        CHECK(b.m.segmentoAtual() == 0 && b.m.saidas().perc_pm == 1000, "11 comeca no segmento 1 (100 %)");
        b.ate(DESLIGANDO, 2 * 3600 * 1000);
        CHECK(b.col.tem("segmento:2") && b.col.tem("segmento:3"), "11 cruzou os segmentos 2 e 3");
        CHECK(b.pos("perc500") >= 0 && b.pos("canhao+") > b.pos("perc1000"), "11 segmento 2: 50 % e canhao");
        CHECK(b.pos("canhao-") > b.pos("canhao+"), "11 segmento 3 desliga o canhao");
    }
    // 12) Canhao sem retorno: avisa e segue irrigando
    {
        Painel b; b.quebra_canhao = true; Plano p = plano(); p.canhao = true;
        b.ligar(p); b.ate(IRRIGANDO, 60000); b.rodar(40000);
        CHECK(b.col.tem("aviso:canhao_nao_ligou"), "12 aviso canhao");
        CHECK(b.m.estado() == IRRIGANDO, "12 continua irrigando");
    }
    // 13) Recusas
    {
        Painel b; char mot[40];
        b.in.gir_dir = true; b.m.tick(b.t, b.in);
        CHECK(!b.m.ligar(plano(), b.t, mot, sizeof(mot)) && !strcmp(mot, "pivo_girando"), "13 recusa com o pivo girando pelo painel");
        b.in.gir_dir = false; b.in.desalinhado = true; b.m.tick(b.t, b.in);
        CHECK(!b.m.ligar(plano(), b.t, mot, sizeof(mot)) && !strcmp(mot, "desalinhado"), "13 recusa desalinhado");
        b.in.desalinhado = false; b.m.tick(b.t, b.in);
        Plano p = plano(); p.voltas = 0;
        CHECK(!b.m.ligar(p, b.t, mot, sizeof(mot)) && !strncmp(mot, "plano_invalido", 14), "13 recusa plano invalido");
        CHECK(b.m.ligar(plano(), b.t, mot, sizeof(mot)), "13 liga");
        CHECK(!b.m.ligar(plano(), b.t, mot, sizeof(mot)) && !strcmp(mot, "ja_ligado"), "13 recusa ligar de novo");
        Plano s; s.nseg = 2; s.seg[0] = {90, 1000, false}; s.seg[1] = {10, 1000, false};
        CHECK(!validarPlano(s, mot, sizeof(mot)) && !strcmp(mot, "segmento_ordem"), "13 segmentos fora de ordem");
    }
    // 14) Glitch do encoder nao conta
    {
        Painel b; b.ligar(plano()); b.ate(IRRIGANDO, 60000);
        float antes = b.m.percorrido();
        b.m.posicao(b.ang + 170, b.t); b.m.posicao(b.ang, b.t + 1);
        CHECK(b.m.percorrido() - antes < 1.0f, "14 salto de 170 graus ignorado");
        CHECK(b.col.tem("aviso:salto_posicao"), "14 aviso de salto");
    }
    // 15) Desligar no meio do ligar (esperando pressao)
    {
        Painel b; b.ligar(plano()); b.rodar(2000);
        CHECK(b.m.passo() == L_PRESSAO, "15 esperando pressao");
        CHECK(b.m.desligar("comando", b.t), "15 desligar aceito");
        CHECK(b.ate(PARADO, 60000) && b.m.falha()[0] == 0, "15 parado sem falha");
        CHECK(!strcmp(b.m.motivoParada(), "comando"), "15 motivo comando");
    }
    // 16) Lado nao cai no desligar
    {
        Config c; c.confirma_parada_ms = 5000; Painel b(c); b.lado_preso = true;
        b.ligar(plano()); b.ate(IRRIGANDO, 60000); b.rodar(5000);
        b.m.desligar("comando", b.t);
        CHECK(b.ate(PARADO, 60000), "16 termina");
        CHECK(!strcmp(b.m.falha(), "nao_parou"), "16 falha nao_parou");
    }
    // 17) Girando: percentimetro > 0 e angulo mudando
    {
        Painel b; b.ligar(plano('D', true, 500)); b.ate(IRRIGANDO, 60000); b.rodar(30000);
        CHECK(b.m.girando(b.t), "17 girando a 50 %");
        char mot[32]; b.m.ajustarPercentimetro(0, mot, sizeof(mot)); b.rodar(700000);
        CHECK(!b.m.girando(b.t), "17 0 % = parado irrigando (nao girando)");
        CHECK(b.m.estado() == IRRIGANDO, "17 segue irrigando a 0 %");
    }
    // 18) Sem sinais opcionais (sem BI01: espera fixa; sem BI03/04: sem confirmacao)
    {
        Config c; c.tem_pressao = false; c.tem_gir_dir = c.tem_gir_esq = false; c.pressurizacao_ms = 15000;
        Painel b(c); b.ligar(plano()); uint32_t t0 = b.t;
        CHECK(b.ate(IRRIGANDO, 60000), "18 irrigando sem BI01/BI03/BI04");
        CHECK(b.t - t0 >= 15000, "18 esperou a pressurizacao fixa");
    }

    printf("\n%d/%d ok\n", total - falhas, total);
    return falhas ? 1 : 0;
}
