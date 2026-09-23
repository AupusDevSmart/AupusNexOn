// Testes de host da fila do SD: g++ -std=c++17 -DSDQ_HOST -DSDQ_SEG_MAX=2048 -DSDQ_TOTAL_MAX=65536 test_sd_queue.cpp sd_buffer.cpp
#include "sd_buffer.h"
#include "sdq_host_shim.h"
#include <string>
#include <vector>
#include <set>

unsigned long g_millis = 1000;
HostSerial Serial;
bool diag_sd_available = false;
uint32_t diag_sd_writes = 0, diag_sd_resends = 0, diag_sd_write_errors = 0;
HostCard g_card;
HostSD SD;
std::map<std::string, uint64_t> g_nvs;
void sdq_host_reboot();

static int g_ok = 0, g_fail = 0;
#define CHECK(c, m) do { if (c) { g_ok++; printf("ok   %s\n", m); } else { g_fail++; printf("FALHOU %s  (linha %d)\n", m, __LINE__); } } while (0)

static std::vector<std::string> g_pub;      // payloads publicados
static int g_pubFailAfter = -1;              // >=0: falha depois de N publicacoes nesta chamada
static bool pubOk(const char* t, const char* p) {
    if (g_pubFailAfter == 0) return false;
    if (g_pubFailAfter > 0) g_pubFailAfter--;
    g_pub.push_back(std::string(t) + "|" + p); return true;
}
static std::string msg(int i) { char b[96]; snprintf(b, sizeof b, "{\"i\":%d,\"pad\":\"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\"}", i); return b; }
static void reset_all() { g_card = HostCard(); g_nvs.clear(); g_pub.clear(); g_pubFailAfter = -1; g_millis = 1000; sdq_host_reboot(); diag_sd_write_errors = 0; }
static void boot() { sdq_host_reboot(); sd_buffer_init(); for (int i = 0; i < 2000 && sd_buffer_pending() >= 0; i++) { sd_buffer_tick(); g_millis += 25; } }
static void drain_all(int batch = 5) { for (int i = 0; i < 100000 && sd_buffer_pending() > 0; i++) { g_millis += 10; if (sd_buffer_drain(pubOk, batch) == 0 && g_pubFailAfter == 0) break; } }
static bool ordered_exact(int n) {
    if ((int)g_pub.size() != n) return false;
    for (int i = 0; i < n; i++) if (g_pub[i] != "t/a|" + msg(i)) return false;
    return true;
}
// Cada 0..n-1 aparece, em ordem de primeira aparicao; retorna duplicatas.
static int check_atleastonce(int n, bool* ok) {
    std::set<int> seen; int dup = 0, next = 0; *ok = true;
    for (auto& s : g_pub) {
        int i = atoi(s.c_str() + s.find("\"i\":") + 4);
        if (seen.count(i)) { dup++; continue; }
        if (i != next) *ok = false;
        seen.insert(i); next++;
    }
    if ((int)seen.size() != n) *ok = false;
    return dup;
}

int main() {
    // 1) Ordem e sem perda, varios segmentos
    reset_all(); g_card.dirs["/"] = true; boot();
    for (int i = 0; i < 300; i++) sd_buffer_store("t/a", msg(i).c_str());
    int segs = 0; for (auto& kv : g_card.files) if (kv.first.rfind("/q/", 0) == 0) segs++;
    CHECK(segs > 5, "1a fila ocupa varios segmentos");
    CHECK(sd_buffer_pending() == 300, "1b pendentes = 300 (contador em memoria)");
    drain_all();
    CHECK(ordered_exact(300), "1c drenou 300 na ordem, sem perda nem duplicata");
    CHECK(sd_buffer_pending() == 0, "1d pendentes = 0 no fim");
    int restam = 0; for (auto& kv : g_card.files) if (kv.first.rfind("/q/", 0) == 0) restam++;
    CHECK(restam <= 1, "1e segmentos lidos foram apagados (fica no maximo o de escrita)");

    // 2) Falha de publicacao no meio: nada se perde
    reset_all(); boot();
    for (int i = 0; i < 50; i++) sd_buffer_store("t/a", msg(i).c_str());
    g_pubFailAfter = 3; sd_buffer_drain(pubOk, 5);
    CHECK(g_pub.size() == 3 && sd_buffer_pending() == 47, "2a broker caiu no meio do lote: 3 sairam, 47 ficaram");
    g_pubFailAfter = -1; drain_all();
    CHECK(ordered_exact(50), "2b depois de voltar: 50 na ordem, sem perda nem duplicata");

    // 3) Queda de energia NO MEIO da drenagem (ponteiro nao salvo): reenvia no maximo 1 lote
    reset_all(); boot();
    for (int i = 0; i < 100; i++) sd_buffer_store("t/a", msg(i).c_str());
    for (int k = 0; k < 7; k++) sd_buffer_drain(pubOk, 5);
    auto nvsAntes = g_nvs;
    sd_buffer_drain(pubOk, 5);                   // publicou 5...
    g_nvs = nvsAntes;                            // ...mas a energia caiu antes de salvar o ponteiro
    boot(); drain_all();
    bool ok3; int dup3 = check_atleastonce(100, &ok3);
    CHECK(ok3 && dup3 <= 5, "3 queda durante drenagem: todas as 100 chegam, no maximo 5 repetidas");

    // 4) Queda de energia NO MEIO de uma gravacao: linha incompleta nao contamina a proxima
    reset_all(); boot();
    for (int i = 0; i < 10; i++) sd_buffer_store("t/a", msg(i).c_str());
    g_card.writeCutAfter = 20; sd_buffer_store("t/a", msg(10).c_str());   // grava so' 20 bytes
    boot();                                                              // TON reinicia
    for (int i = 11; i < 20; i++) sd_buffer_store("t/a", msg(i).c_str());
    drain_all();
    bool limpo = true; for (auto& s : g_pub) if (s.find("\"i\":10") != std::string::npos || s.find("t/a|{") != 0) limpo = false;
    CHECK(g_pub.size() == 19 && limpo, "4 linha cortada pela queda foi descartada; as outras 19 chegaram inteiras");

    // 5) Cartao cheio: descarta as MAIS ANTIGAS, mantem as novas
    reset_all(); boot();
    for (int i = 0; i < 2000; i++) sd_buffer_store("t/a", msg(i).c_str());
    uint64_t tot = 0; for (auto& kv : g_card.files) tot += kv.second.size();
    CHECK(tot <= 65536, "5a fila respeita o teto total do cartao");
    CHECK(sd_buffer_discarded() > 0, "5b descartadas contadas");
    drain_all();
    CHECK(!g_pub.empty() && g_pub.back() == "t/a|" + msg(1999), "5c a mais nova (1999) foi mantida e enviada por ultimo");
    bool ok5 = true; int prev = -1; for (auto& s : g_pub) { int i = atoi(s.c_str() + s.find("\"i\":") + 4); if (i <= prev) ok5 = false; prev = i; }
    CHECK(ok5, "5d o que sobrou saiu em ordem");

    // 6) Cartao com defeito: desativa apos 3 falhas, remonta sozinho em 10 min
    reset_all(); boot();
    g_card.broken = true;
    for (int i = 0; i < 3; i++) sd_buffer_store("t/a", msg(i).c_str());
    CHECK(!sd_buffer_ready() && std::string(sd_buffer_state()) == "falha", "6a 3 falhas seguidas: cartao marcado em falha");
    unsigned long t0 = g_millis;
    bool ok6 = sd_buffer_store("t/a", msg(9).c_str());
    CHECK(!ok6 && g_millis == t0, "6b com o cartao em falha a gravacao retorna na hora");
    g_card.broken = false;
    g_millis += 300000; sd_buffer_tick();
    CHECK(!sd_buffer_ready(), "6c nao tenta remontar antes de 10 min");
    g_millis += 400000; sd_buffer_tick();
    CHECK(sd_buffer_ready() && std::string(sd_buffer_state()) == "ok", "6d remontou sozinho apos 10 min");
    CHECK(sd_buffer_store("t/a", msg(0).c_str()), "6e voltou a gravar");

    // 7) Sem cartao no boot
    reset_all(); g_card.broken = true; sdq_host_reboot();
    CHECK(!sd_buffer_init() && std::string(sd_buffer_state()) == "sem_cartao" && sd_buffer_pending() == 0, "7 sem cartao: init falha, TON segue, pendentes 0");

    // 8) Migracao do arquivo antigo (versao anterior do firmware)
    reset_all();
    std::string legado; for (int i = 0; i < 40; i++) legado += "t/a\t" + msg(i) + "\n";
    g_card.files["/mqtt_buf.txt"] = legado;
    g_card.mounted = true; boot();
    for (int i = 40; i < 60; i++) sd_buffer_store("t/a", msg(i).c_str());
    drain_all();
    CHECK(ordered_exact(60) && !g_card.files.count("/mqtt_buf.txt"), "8 fila antiga (40) migrada e enviada antes das novas (20), em ordem");

    // 8b) Sobra .tmp da drenagem antiga interrompida (tem tudo): prevalece sobre o .txt
    reset_all();
    std::string tmp; for (int i = 0; i < 30; i++) tmp += "t/a\t" + msg(i) + "\n";
    g_card.files["/mqtt_buf.tmp"] = tmp; g_card.files["/mqtt_buf.txt"] = "t/a\t" + msg(29) + "\n";
    boot(); drain_all();
    CHECK(ordered_exact(30), "8b .tmp antigo migrado sem duplicar o .txt");

    // 9) Contagem inicial apos reinicio com fila grande (fatiada)
    reset_all(); boot();
    for (int i = 0; i < 700; i++) sd_buffer_store("t/a", msg(i).c_str());
    for (int k = 0; k < 20; k++) sd_buffer_drain(pubOk, 5);    // 100 sairam
    sdq_host_reboot(); sd_buffer_init();
    CHECK(sd_buffer_pending() >= 1, "9a logo apos o boot ja indica que ha fila");
    for (int i = 0; i < 5000; i++) { sd_buffer_tick(); g_millis += 25; }
    CHECK(sd_buffer_pending() == 600, "9b contagem concluida: 600 pendentes");
    drain_all();
    CHECK(ordered_exact(700), "9c drenou tudo na ordem apos o reinicio");

    // 10) Gravacao e drenagem intercaladas (TON online/offline alternando)
    reset_all(); boot();
    int w = 0;
    for (int ciclo = 0; ciclo < 50; ciclo++) {
        for (int k = 0; k < 7; k++) { sd_buffer_store("t/a", msg(w).c_str()); w++; }
        sd_buffer_drain(pubOk, 5);
        if (ciclo % 13 == 0) { boot(); }
    }
    drain_all();
    bool ok10; int dup10 = check_atleastonce(w, &ok10);
    CHECK(ok10 && dup10 == 0, "10 online/offline alternando com reinicios: tudo chega, em ordem, sem duplicata");

    printf("%d/%d verificacoes ok\n", g_ok, g_ok + g_fail);
    return g_fail ? 1 : 0;
}
