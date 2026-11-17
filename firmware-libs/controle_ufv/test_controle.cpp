// Testes da lib controle_ufv (host):
//   g++ -std=c++17 -Wall -o /tmp/tc test_controle.cpp controle_ufv.cpp && /tmp/tc
#include "controle_ufv.h"
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
using namespace cufv;

static int falhas = 0, total = 0;
#define CHECK(c, msg) do { total++; if (!(c)) { falhas++; printf("FALHOU: %s (linha %d)\n", msg, __LINE__); } } while (0)

// Inversor de mentira: guarda o que foi escrito; pode recusar ou "ler outro valor".
struct InvSim { int32_t p = 1000, q = 0; bool offline = false; bool ignora = false; int escritas = 0; };
static InvSim inv[3];
static bool sem_rb = false;
static Res escrever(const char* dev, uint16_t, Sp sp, int32_t v, int32_t* lido) {
    int i = dev[3] - '1';
    InvSim& s = inv[i];
    if (s.offline) return ESC_FALHA;
    s.escritas++;
    if (!s.ignora) { if (sp == SP_P) s.p = v; else s.q = v; }
    if (sem_rb) return ESC_ESCRITO;
    int32_t r = sp == SP_P ? s.p : s.q;
    if (r != v) { *lido = r; return ESC_DIVERGE; }
    return ESC_OK;
}

static Controle c;
static char msg[64], res[128];
static uint32_t T = 1000;
static bool ctl(uint32_t seq, uint16_t ttl, std::vector<std::vector<int32_t>> sp) {
    uint8_t idx[8]; int32_t p[8], q[8]; int n = 0;
    for (auto& v : sp) { idx[n] = (uint8_t)v[0]; p[n] = v[1]; q[n] = v[2]; n++; }
    bool ok = c.receber(seq, ttl, n, idx, p, q, T, msg, sizeof msg);
    c.resumo(res, sizeof res);
    return ok;
}
static void passa(uint32_t ms, bool bi = false) { for (uint32_t t = 0; t < ms; t += 500) { T += 500; c.tick(T, bi); } }

int main() {
    c.begin(escrever);
    // 1. sem cadastro: recusa
    CHECK(!ctl(1, 300, {{1, 500, 0}}) && !strcmp(msg, "sem_cfg"), "sem cadastro recusa");

    // cadastro: 2 inversores; P1 = 60%, P2 = 0 (zera), manual = 100%, rampa 20% (x10)
    CHECK(c.geral(2, 600, 3, false), "geral");
    CHECK(c.inv(1, 1, 600, 0, 1000, 200, "INV1"), "inv1");
    CHECK(c.inv(2, 2, 600, 600, 1000, 200, "INV2"), "inv2");
    CHECK(!c.inv(3, 3, 0, 0, 0, 0, "INV3"), "idx alem de n recusado");

    // 2. primeiro setpoint: escreve e confirma
    CHECK(ctl(100, 300, {{1, 500, -200}, {2, 800, 0}}), "setpoint aceito");
    CHECK(inv[0].p == 500 && inv[0].q == -200 && inv[1].p == 800, "valores no inversor");
    CHECK(!strcmp(res, "A 1:ok 2:ok"), "resumo ok");
    printf("  resumo: %s\n", res);

    // 3. mesmo valor: NAO escreve de novo (EEPROM)
    int e0 = inv[0].escritas + inv[1].escritas;
    CHECK(ctl(160, 300, {{1, 500, -200}, {2, 800, 0}}), "heartbeat com o mesmo valor");
    CHECK(inv[0].escritas + inv[1].escritas == e0, "sem escrita repetida");
    CHECK(!strcmp(res, "A 1:= 2:="), "resumo =");

    // 4. heartbeat sem setpoints renova a validade
    CHECK(ctl(161, 300, {}), "heartbeat vazio");
    // 5. seq velho (LoRa atrasado) e' descartado
    CHECK(!ctl(150, 300, {{1, 100, 0}}) && !strcmp(msg, "seq_velho"), "seq velho recusado");
    CHECK(inv[0].p == 500, "seq velho nao escreve");

    // 6. read-back divergente: inversor ignora -> rb + retentativa
    inv[0].ignora = true;
    CHECK(ctl(200, 300, {{1, 400, -200}, {2, 800, 0}}), "setpoint com inversor que ignora");
    CHECK(std::string(res).find("1:rb500") != std::string::npos, "read-back divergente informado");
    int esc = inv[0].escritas;
    passa(10000); CHECK(inv[0].escritas == esc, "nao retenta antes de 15 s");
    passa(6000);  CHECK(inv[0].escritas == esc + 1, "retenta depois de 15 s");
    inv[0].ignora = false;
    passa(16000); CHECK(inv[0].p == 400, "retentativa acerta quando o inversor obedece");

    // 7. validade vence -> estagio 1 (P1, Q 0); depois de t2 -> estagio 2 (P2)
    CHECK(ctl(300, 60, {{1, 400, -200}, {2, 800, 100}}), "setpoint com ttl 60 s");
    passa(59000); CHECK(c.modo() == AUTO, "ainda valido aos 59 s");
    passa(1500);  CHECK(c.modo() == SEGURO1, "estagio 1 ao vencer");
    CHECK(inv[0].p == 600 && inv[0].q == 0 && inv[1].p == 600 && inv[1].q == 0, "estagio 1: P estatico, Q 0");
    passa(600000); CHECK(c.modo() == SEGURO2, "estagio 2 depois de t2");
    CHECK(inv[0].p == 0 && inv[1].p == 600, "estagio 2: so' quem zera vai a 0");

    // 8. comunicacao volta: rampa de subida (200 por setpoint), reducao direta
    CHECK(ctl(400, 300, {{1, 1000, 0}, {2, 300, 0}}), "volta da comunicacao");
    printf("  retomada: %s\n", res);
    CHECK(c.modo() == AUTO && inv[0].p == 200 && inv[1].p == 300, "rampa no 1, reducao direta no 2");
    CHECK(std::string(res).find("1:okr") != std::string::npos, "marca r (limitado pela rampa)");
    CHECK(std::string(res).find("s=") != std::string::npos && std::string(res).find("p=S2") != std::string::npos, "informa tempo e pior estagio");
    ctl(401, 300, {{1, 1000, 0}, {2, 300, 0}}); CHECK(inv[0].p == 400, "rampa 2");
    ctl(402, 300, {{1, 1000, 0}, {2, 300, 0}});
    ctl(403, 300, {{1, 1000, 0}, {2, 300, 0}});
    ctl(404, 300, {{1, 1000, 0}, {2, 300, 0}}); CHECK(inv[0].p == 1000, "rampa chega ao pedido");
    ctl(405, 300, {{1, 1000, 0}, {2, 300, 0}}); CHECK(!strcmp(res, "A 1:= 2:="), "fim da rampa");

    // 9. BI manual: 100% e Q 0; pedido guardado e nao escrito; volta
    passa(500, true); CHECK(c.modo() == AUTO, "debounce da BI");
    passa(1500, true); CHECK(c.modo() == MANUAL, "BI manual");
    CHECK(inv[1].p == 1000 && inv[1].q == 0, "manual: 100% Pn, Q 0");
    T += 500; c.tick(T, true);
    { uint8_t idx[1] = {2}; int32_t p[1] = {200}, q[1] = {50};
      CHECK(c.receber(500, 300, 1, idx, p, q, T, msg, sizeof msg), "pedido em manual aceito"); c.resumo(res, sizeof res); }
    CHECK(inv[1].p == 1000, "em manual nao escreve o pedido");
    CHECK(res[0] == 'M' && std::string(res).find("m=") != std::string::npos, "resumo M + tempo em manual");
    passa(1500, false); CHECK(c.modo() == AUTO && inv[1].p == 200 && inv[1].q == 50, "volta ao automatico com o pedido");

    // 10. manual com a validade vencida: volta direto ao estagio 1
    passa(1500, true); CHECK(c.modo() == MANUAL, "manual de novo");
    passa(400000, true);
    passa(1500, false); CHECK(c.modo() == SEGURO1, "saiu do manual sem validade -> estagio 1");

    // 11. inversor offline no modo seguro: retenta ate' conseguir
    inv[0].offline = true;
    CHECK(ctl(600, 300, {{1, 300, 0}, {2, 300, 0}}), "setpoint com inversor offline");
    CHECK(std::string(res).find("1:f") != std::string::npos, "falha informada");
    inv[0].offline = false; passa(16000); CHECK(inv[0].p == 300, "retentativa depois de voltar");

    // 12. ctl off: 100% e Q 0, watchdog desarmado
    c.desligar(T); CHECK(c.modo() == DESLIGADO && inv[0].p == 1000 && inv[0].q == 0 && !c.ativo(), "desligar");
    passa(400000); CHECK(c.modo() == DESLIGADO, "desligado nao entra em modo seguro");

    // 13. sem read-back no modelo: "w"
    sem_rb = true;
    CHECK(ctl(700, 300, {{1, 700, 0}}), "setpoint sem read-back"); CHECK(!strcmp(res, "A 1:w 2:="), "resumo w");
    sem_rb = false;

    // 14. boot com o controle ativo: sem alvo nada e' escrito; vence -> estagio 1
    Controle b; b.begin(escrever); b.geral(1, 0, 0, false); b.inv(1, 1, 250, 0, 1000, 0, "INV1");
    int eb = inv[0].escritas;
    b.retomarDoBoot(120, 5000); b.tick(6000, false);
    CHECK(inv[0].escritas == eb, "boot: nada escrito antes de vencer");
    b.tick(5000 + 120000, false); CHECK(b.modo() == SEGURO1 && inv[0].p == 250, "boot: validade vence -> estagio 1");
    b.tick(5000 + 900000, false); CHECK(b.modo() == SEGURO1, "t2 = 0: fica no estagio 1");

    // 15. wrap do millis
    Controle w; w.begin(escrever); w.geral(1, 0, 0, false); w.inv(1, 1, 111, 0, 1000, 0, "INV1");
    { uint8_t idx[1] = {1}; int32_t p[1] = {900}, q[1] = {0}; w.receber(1, 60, 1, idx, p, q, 0xFFFFF000UL, msg, sizeof msg); }
    w.tick(0x00000100UL, false); CHECK(w.modo() == AUTO, "wrap: ainda valido");
    w.tick(0xFFFFF000u + 61000u, false); CHECK(w.modo() == SEGURO1, "wrap: vence certo");

    printf("%d/%d OK\n", total - falhas, total);
    return falhas ? 1 : 0;
}
