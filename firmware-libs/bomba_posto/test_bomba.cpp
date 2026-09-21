// Testes no host da lib bomba_posto — cobre a logica das etapas 1..6 do "Teste em bancada".
//   g++ -std=c++17 -O2 -Wall -Wextra -o test_bomba test_bomba.cpp bomba_posto.cpp && ./test_bomba
#include "bomba_posto.h"
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>

using namespace bomba;

static int falhas = 0, total = 0;
#define CHECK(cond, msg) do { total++; if (cond) printf("ok   %s\n", msg); else { falhas++; printf("FALHOU %s  (%s:%d)\n", msg, __FILE__, __LINE__); } } while (0)

struct Ev { std::string tipo, motivo, uid, mat; };
struct Coletor : Ouvinte {
    std::vector<Ev> eventos; std::vector<Transacao> trans; std::vector<std::string> reqs; std::vector<std::string> estados;
    std::string ultimoReq;
    void aoPedirAutorizacao(const char* req_id, const char* uid, const char* mat) override { reqs.push_back(std::string(req_id) + "|" + uid + "|" + mat); ultimoReq = req_id; }
    void aoEvento(const char* tipo, const char* motivo, const char* uid, const char* mat) override { eventos.push_back({tipo, motivo, uid, mat}); }
    void aoTransacao(const Transacao& t) override { trans.push_back(t); }
    void aoMudarEstado(Estado, Estado para) override { estados.push_back(estadoNome(para)); }
    bool temEvento(const char* tipo, const char* motivo = nullptr) const {
        for (auto& e : eventos) if (e.tipo == tipo && (!motivo || e.motivo == motivo)) return true;
        return false;
    }
    int contaEvento(const char* tipo) const { int n = 0; for (auto& e : eventos) if (e.tipo == tipo) n++; return n; }
};

// Bancada simulada: K1 com selo (fecha 100 ms depois do pulso com permissao; abre 100 ms depois da permissao cair),
// jumpers e mala. Avanca o tempo em passos de 10 ms chamando tick().
struct Bancada {
    Config cfg; Coletor col; Maquina m; Entradas in; uint32_t t = 100000;
    bool k1_auto = true, k1_colado = false, k1_quebrado = false;
    uint32_t k1_t = 0; bool pulsoVisto = false; bool k1 = false;
    bool ligaAnt = false, permAnt = false;
    Bancada(Config c = Config()) : cfg(c), m(c, &col) { in.contator = false; in.automatico = true; in.bico_no_suporte = true; in.nivel_pct = 50; }
    void passo() {
        t += 10;
        // modelo do K1
        const Saidas& o = m.saidas();
        if (o.liga && !ligaAnt && o.permissao) { pulsoVisto = true; k1_t = t; }
        if (!o.permissao) { if (permAnt) k1_t = t; pulsoVisto = false; }
        ligaAnt = o.liga; permAnt = o.permissao;
        if (k1_auto && !k1_quebrado) {
            if (o.permissao && pulsoVisto && (t - k1_t) >= 100) k1 = true;
            if (!o.permissao && (t - k1_t) >= 100) k1 = k1_colado;
        }
        in.contator = k1_auto ? k1 : in.contator;
        m.tick(t, in);
    }
    void avancar(uint32_t ms) { for (uint32_t i = 0; i < ms; i += 10) passo(); }
    void lista_padrao() { m.lista().adicionarTag("PC-07", 0); m.lista().adicionarMat("1234"); m.lista().versao = 7; }
    void abastecer_ate_abastecendo() { m.cartao("PC-07", t); avancar(50); m.matricula("1234", t); avancar(20); avancar(600); }
    bool bo(bool liga, bool perm, bool sol) const { const Saidas& o = m.saidas(); return o.liga == liga && o.permissao == perm && o.solenoide == sol; }
};

int main() {
    // ---------------- Etapa 1: caminho feliz (offline, lista local) ----------------
    {
        Bancada b; b.lista_padrao(); b.avancar(1500);   // boot + estabilizacao
        CHECK(b.m.estado() == OCIOSA && b.bo(false, false, false), "T1.0 boot: ociosa, reles desligados");
        b.m.cartao("PC-07", b.t); b.avancar(50);
        CHECK(b.m.estado() == AGUARDANDO_MATRICULA && b.bo(false, false, false), "T1.1a tag lida -> aguardando matricula, nada liga");
        b.m.matricula("1234", b.t); b.avancar(20);
        CHECK(b.m.estado() == PARTINDO, "T1.1b matricula -> validando (offline) -> partindo");
        CHECK(b.bo(true, true, true), "T1.1c partindo: BO2 e BO3 ligados + pulso no BO1");
        b.avancar(500);
        CHECK(!b.m.saidas().liga && b.m.saidas().permissao, "T1.1d pulso do BO1 acabou (~500 ms), permissao mantida");
        CHECK(b.m.estado() == ABASTECENDO, "T1.2 BI1 fechou em < 1 s -> abastecendo");
        b.in.bico_no_suporte = false;              // operador pega o bico
        b.in.fluxo_lpm = 60; b.avancar(20000);
        CHECK(b.m.litros() > 19.5f && b.m.litros() < 20.5f, "T1.3 fluxo 60 L/min por 20 s -> ~20 L");
        b.in.fluxo_lpm = 0; b.in.bico_no_suporte = true; b.avancar(20);
        CHECK(b.m.estado() == ENCERRANDO && b.bo(false, false, false), "T1.4a bico devolvido -> encerrando, BO2/BO3 desligam");
        b.avancar(200);
        CHECK(b.m.estado() == OCIOSA, "T1.4b BI1 abriu -> ociosa");
        CHECK(b.col.trans.size() == 1 && std::string(b.col.trans[0].fim_motivo) == "concluido" && b.col.trans[0].validacao == VAL_OFFLINE,
              "T1.4c transacao 'concluido' publicada, validacao offline");
        CHECK(std::string(b.col.trans[0].uid) == "PC-07" && std::string(b.col.trans[0].matricula) == "1234" && b.col.trans[0].litros > 19.5f, "T1.4d transacao com uid, matricula e litros");
        CHECK(b.col.trans[0].nivel_antes == 50 && b.col.trans[0].nivel_depois == 50, "T1.4e nivel antes/depois registrado");
    }

    // ---------------- Validacao ONLINE (auth/req -> auth/resp) e timeout do NexON ----------------
    {
        Bancada b; b.lista_padrao(); b.avancar(1500); b.m.setOnline(true);
        b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20);
        CHECK(b.m.estado() == VALIDANDO && b.col.reqs.size() == 1 && b.col.reqs[0].find("|PC-07|1234") != std::string::npos, "online: pede autorizacao ao NexON (auth/req com uid+matricula)");
        CHECK(b.bo(false, false, false), "online: nada liga enquanto valida");
        b.m.respostaAuth("r999", true, "", 0, b.t); b.avancar(20);
        CHECK(b.m.estado() == VALIDANDO, "online: resposta com req_id errado e' ignorada");
        b.m.respostaAuth(b.col.ultimoReq.c_str(), true, "", 15, b.t); b.avancar(700);
        CHECK(b.m.estado() == ABASTECENDO && b.m.validacaoAtual() == VAL_ONLINE, "online: resposta ok -> abastecendo, validacao online");
        b.in.bico_no_suporte = false; b.in.fluxo_lpm = 60; b.avancar(5000); b.in.bico_no_suporte = true; b.avancar(300);
        CHECK(b.col.trans.size() == 1 && b.col.trans[0].validacao == VAL_ONLINE, "online: transacao marca validacao online");
        // NexON nega
        b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20);
        b.m.respostaAuth(b.col.ultimoReq.c_str(), false, "limite_diario", 0, b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "limite_diario") && b.bo(false, false, false), "online: NexON nega -> evento negado com o motivo do NexON, nada liga");
        // NexON nao responde em 3 s -> lista local
        b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(3200);
        CHECK(b.m.estado() == PARTINDO || b.m.estado() == ABASTECENDO, "online sem resposta: apos 3 s valida pela lista local e parte");
        CHECK(b.m.validacaoAtual() == VAL_OFFLINE, "online sem resposta: validacao marcada como offline");
    }

    // ---------------- Etapa 2: negacoes (nenhum rele mexe) ----------------
    {
        Bancada b; b.lista_padrao(); b.m.lista().adicionarTag("PC-99", 0); b.m.lista().adicionarMatDaTag("PC-99", "5555"); b.m.lista().adicionarMat("5555");
        b.avancar(1500);
        b.m.cartao("XX-00", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "tag") && b.bo(false, false, false), "T2.1 tag nao cadastrada -> negado (tag)");
        b.col.eventos.clear();
        b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("0000", b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "matricula"), "T2.2 matricula nao cadastrada -> negado (matricula)");
        b.col.eventos.clear();
        b.m.cartao("PC-99", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "par"), "T2.3 tag e matricula validas mas par nao permitido -> negado (par)");
        b.col.eventos.clear();
        b.m.cartao("PC-07", b.t); b.avancar(60100);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "timeout_matricula"), "T2.4 matricula nao digitada em 60 s -> volta a ociosa");
        b.col.eventos.clear();
        b.in.emergencia = true; b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "emergencia") && b.bo(false, false, false), "T2.5 emergencia atuada -> negado (emergencia)");
        b.in.emergencia = false; b.col.eventos.clear();
        b.in.automatico = false; b.avancar(20);
        CHECK(b.m.estado() == MANUAL, "T2.6a chave em Manual -> estado manual");
        b.m.cartao("PC-07", b.t); b.avancar(20);
        CHECK(b.col.temEvento("negado", "manual") && b.bo(false, false, false), "T2.6b tag com chave em Manual -> negado (manual)");
        b.in.automatico = true; b.avancar(20); b.col.eventos.clear();
        b.in.nivel_baixo_boia = true; b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "nivel_baixo"), "T2.7 boia de minimo atuada -> negado (nivel_baixo)");
        b.in.nivel_baixo_boia = false; b.col.eventos.clear();
        b.in.nivel_pct = 5; b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "nivel_baixo"), "T2.8 AI1 abaixo do minimo (5% < 10%) -> negado (nivel_baixo)");
        CHECK(b.col.trans.empty(), "Etapa 2: nenhuma transacao gerada");
    }

    // ---------------- Etapa 3: fins de abastecimento ----------------
    {
        Bancada b; b.lista_padrao(); b.avancar(1500); b.abastecer_ate_abastecendo();
        CHECK(b.m.estado() == ABASTECENDO, "T3 setup: abastecendo");
        b.in.emergencia = true; b.passo();
        CHECK(!b.m.saidas().permissao && !b.m.saidas().solenoide && b.m.estado() == ENCERRANDO, "T3.1 emergencia -> BO2 abre no mesmo tick (< 200 ms)");
        b.avancar(300);
        CHECK(b.col.trans.size() == 1 && std::string(b.col.trans[0].fim_motivo) == "emergencia", "T3.1b transacao 'emergencia'");
        b.in.emergencia = false;
    }
    {
        Bancada b; b.lista_padrao(); b.avancar(1500); b.abastecer_ate_abastecendo();
        b.in.fluxo_lpm = 60; b.avancar(3000); b.in.fluxo_lpm = 0; b.avancar(9000);
        CHECK(b.m.estado() == ABASTECENDO, "T3.2a fluxo zero ha 9 s: ainda abastecendo (limite 10 s)");
        b.avancar(1500);
        CHECK(b.m.estado() != ABASTECENDO && b.col.trans.size() == 1 && std::string(b.col.trans[0].fim_motivo) == "fluxo_parado", "T3.2b fluxo zero por 10 s -> 'fluxo_parado'");
        CHECK(b.col.trans[0].litros > 2.9f && b.col.trans[0].litros < 3.1f, "T3.2c litros = 3 L (60 L/min por 3 s)");
    }
    {
        Bancada b; b.lista_padrao(); b.avancar(1500); b.abastecer_ate_abastecendo();
        b.in.fluxo_lpm = 10; b.avancar(30500);
        CHECK(b.col.trans.size() == 1 && std::string(b.col.trans[0].fim_motivo) == "timeout", "T3.3 tempo maximo (30 s) -> 'timeout'");
    }
    {
        Bancada b; b.lista_padrao(); b.m.lista().adicionarTag("PC-07", 10); b.avancar(1500); b.abastecer_ate_abastecendo();
        b.in.fluxo_lpm = 60; b.avancar(12000);
        CHECK(b.col.trans.size() == 1 && std::string(b.col.trans[0].fim_motivo) == "limite" && b.col.trans[0].litros >= 10.0f && b.col.trans[0].litros < 10.3f, "T3.4 limite de 10 L -> encerra em ~10 L, 'limite'");
    }
    {
        Bancada b; b.lista_padrao(); b.avancar(1500); b.abastecer_ate_abastecendo();
        b.in.nivel_baixo_boia = true; b.avancar(300);
        CHECK(b.col.trans.size() == 1 && std::string(b.col.trans[0].fim_motivo) == "nivel_baixo", "T3.5a boia de minimo durante o abastecimento -> 'nivel_baixo'");
        b.in.nivel_baixo_boia = false; b.avancar(500);
        b.abastecer_ate_abastecendo(); b.in.nivel_pct = 3; b.avancar(300);
        CHECK(b.col.trans.size() == 2 && std::string(b.col.trans[1].fim_motivo) == "nivel_baixo", "T3.5b AI1 abaixo do minimo durante o abastecimento -> 'nivel_baixo'");
    }

    // ---------------- Etapa 4: falhas do contator ----------------
    {
        Bancada b; b.lista_padrao(); b.avancar(1500); b.k1_quebrado = true;   // jumper NA do BO2 -> BI1 removido
        b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20);
        CHECK(b.m.estado() == PARTINDO && b.m.saidas().permissao, "T4.1a partindo (permissao ligada)");
        b.avancar(1100);
        CHECK(b.m.estado() == BLOQUEADA && b.bo(false, false, false), "T4.1b sem BI1 em 1 s -> desliga tudo, bloqueada");
        CHECK(b.col.temEvento("falha_partida"), "T4.1c evento 'falha_partida'");
        b.m.cartao("PC-07", b.t); b.avancar(20);
        CHECK(b.col.temEvento("negado", "bloqueada") && b.m.estado() == BLOQUEADA, "T4.1d nova partida recusada em bloqueada");
        b.m.rearme(b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("rearme"), "T4.3 rearme -> ociosa");
    }
    {
        Bancada b; b.lista_padrao(); b.avancar(1500); b.abastecer_ate_abastecendo();
        b.k1_colado = true;                                            // jumper fixo BI1-GND
        b.in.bico_no_suporte = false; b.avancar(500); b.in.bico_no_suporte = true; b.avancar(20);
        CHECK(b.m.estado() == ENCERRANDO && b.bo(false, false, false), "T4.2a encerrando: BO2/BO3 desligados");
        b.avancar(1100);
        CHECK(b.m.estado() == BLOQUEADA && b.col.temEvento("contator_colado"), "T4.2b BI1 nao abriu em 1 s -> 'contator_colado', bloqueada");
        CHECK(b.col.trans.size() == 1 && std::string(b.col.trans[0].fim_motivo) == "concluido", "T4.2c a transacao do abastecimento ainda e' publicada");
        b.m.cartao("PC-07", b.t); b.avancar(20);
        CHECK(b.col.temEvento("negado", "bloqueada"), "T4.2d nova partida recusada");
        b.m.rearme(b.t); b.avancar(20);
        CHECK(b.m.estado() == BLOQUEADA && b.col.temEvento("rearme_negado", "contator_colado"), "T4.3a rearme com o jumper ainda fechado -> negado");
        b.k1_colado = false; b.avancar(200); b.m.rearme(b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA, "T4.3b rearme com o jumper removido -> ociosa");
        b.col.eventos.clear();
        b.k1_auto = false; b.in.contator = true; b.avancar(50);
        CHECK(b.col.temEvento("nao_autorizado") && b.bo(false, false, false), "T4.4 BI1 fechada com a TON ociosa -> evento 'nao_autorizado'");
        b.in.contator = false; b.avancar(50); b.in.contator = true; b.avancar(50);
        CHECK(b.col.contaEvento("nao_autorizado") == 2, "T4.4b um evento por borda de fechamento");
    }

    // ---------------- Etapa 5: modo manual ----------------
    {
        Bancada b; b.lista_padrao(); b.avancar(1500); b.k1_auto = false;
        b.in.automatico = false; b.avancar(20);
        CHECK(b.m.estado() == MANUAL && b.col.temEvento("manual", "chave"), "T5.1 BI2 aberta -> manual, evento 'manual'");
        b.in.contator = true; b.in.fluxo_lpm = 60; b.avancar(20000); b.in.fluxo_lpm = 0; b.in.contator = false; b.avancar(50);
        CHECK(b.col.trans.size() == 1 && b.col.trans[0].validacao == VAL_MANUAL && b.col.trans[0].litros > 19.5f && std::string(b.col.trans[0].fim_motivo) == "manual",
              "T5.2 K1 fechado + fluxo 60 por 20 s -> transacao manual de ~20 L");
        CHECK(b.bo(false, false, false), "T5.2b em manual a TON nao comanda nada");
        b.in.automatico = true; b.avancar(20);
        CHECK(b.m.estado() == OCIOSA, "T5.3 BI2 fecha -> ociosa");
        // chave virada no meio de um abastecimento automatico encerra com 'manual'
        b.k1_auto = true; b.abastecer_ate_abastecendo(); b.in.automatico = false; b.passo();
        CHECK(b.m.estado() == ENCERRANDO && !b.m.saidas().permissao, "T5.4 chave para Manual durante o abastecimento -> encerra");
    }

    // ---------------- Etapa 6: energia/rede/OTA (a parte de logica) ----------------
    {
        Bancada b; b.lista_padrao();
        b.avancar(200); b.m.cartao("PC-07", b.t); b.avancar(20);
        CHECK(b.m.estado() == OCIOSA && b.col.temEvento("negado", "inicializando"), "T6.4 no boot (< 1 s) nenhuma partida e' aceita");
        b.avancar(1500);
        CHECK(b.m.otaPermitida(), "T6.5a OTA permitida em ociosa");
        b.abastecer_ate_abastecendo();
        CHECK(!b.m.otaPermitida(), "T6.5b OTA recusada durante o abastecimento");
        b.in.bico_no_suporte = false; b.avancar(100); b.in.bico_no_suporte = true; b.avancar(300);
        CHECK(b.m.otaPermitida(), "T6.5c OTA volta a ser permitida em ociosa");
        // T6.1: sem rede -> lista local e validacao offline (ja coberto na etapa 1); T6.3: lista sobrevive ao reboot = NVS (glue)
        Lista l; l.adicionarTag("PC-07", 0); l.versao = 3;
        char m[MOTIVO_LEN]; float lim;
        CHECK(l.validar("PC-07", "qualquer", true, m, &lim), "lista legada (sem matriculas): aceita qualquer matricula");
        l.adicionarMat("1234");
        CHECK(!l.validar("PC-07", "9999", true, m, &lim) && std::string(m) == "matricula", "lista com matriculas: matricula desconhecida -> 'matricula'");
        CHECK(l.validar("PC-07", "1234", true, m, &lim), "lista com matriculas: matricula cadastrada -> ok");
        CHECK(l.validar("PC-07", "", false, m, &lim), "posto sem IHM (exigir_matricula=false): so' a tag basta");
    }

    // ---------------- sem contato auxiliar (tem_contator_aux=false): parte pelo tempo do pulso ----------------
    {
        Config c; c.tem_contator_aux = false; Bancada b(c); b.lista_padrao(); b.avancar(1500); b.k1_auto = false;
        b.m.cartao("PC-07", b.t); b.avancar(20); b.m.matricula("1234", b.t); b.avancar(20); b.avancar(600);
        CHECK(b.m.estado() == ABASTECENDO, "sem BI1: abastecendo apos o pulso");
        b.in.bico_no_suporte = false; b.avancar(100); b.in.bico_no_suporte = true; b.avancar(50);
        CHECK(b.m.estado() == OCIOSA && b.col.trans.size() == 1, "sem BI1: encerra sem esperar o contator");
    }

    printf("\n%d/%d verificacoes ok%s\n", total - falhas, total, falhas ? "  <<< FALHAS" : "");
    return falhas ? 1 : 0;
}
