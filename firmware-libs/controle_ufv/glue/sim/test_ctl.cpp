// Glue ctl.cpp no host (parse dos comandos, hash do cadastro, BI):
//   cd firmware-libs/controle_ufv/glue && g++ -std=c++17 -w -I../../pivo_local/glue/sim/stub -I. -I.. \
//     -o /tmp/tctl sim/test_ctl.cpp ctl.cpp ../controle_ufv.cpp && /tmp/tctl
#include "Arduino.h"
#include "ctl.h"
#include <map>
#include <string>
unsigned long g_millis = 1000; SerialT Serial;
static uint8_t g_bi = 0;
uint8_t inputs_get_state() { return g_bi; }
static std::map<std::string, int32_t> reg;   // "dev/cid" -> valor no inversor
int ctl_escrever_sp(const char* dev, int addr, const char* cid, int32_t v, int32_t* lido) {
  (void)addr; reg[std::string(dev) + "/" + cid] = v; *lido = v; return 1;
}
static int falhas = 0;
static char msg[64];
static int cmd(const char* c) { int r = ctl_cmd(c, msg, sizeof msg); printf("  %-48s -> %d \"%s\"\n", c, r, msg); return r; }
#define CHECK(c, m) do { if (!(c)) { falhas++; printf("FALHOU: %s\n", m); } } while (0)
static uint32_t fnv(const std::string& s) { uint32_t h = 2166136261u; for (unsigned char ch : s) { h ^= ch; h *= 16777619u; } return h & 0xFFFFFF; }
int main() {
  ctl_init();
  CHECK(cmd("pivo status") == -1, "nao e' ctl");
  CHECK(cmd("ctlx") == -1, "prefixo exato");
  CHECK(cmd("ctl 10 300 1 500 0") == 0 && !strncmp(msg, "sem_cfg", 7), "sem cadastro");
  CHECK(cmd("ctl geral 2 600 3 0") == 1, "geral");
  CHECK(cmd("ctl cfg 1 1 600 0 1000 100 INV-Norte 01") == 1, "cfg 1 (nome com espaco e maiusculas)");
  CHECK(cmd("ctl cfg 2 2 600 600 1000 100 INV2") == 1, "cfg 2");
  CHECK(cmd("ctl cfg 3 3 600 600 1000 100 INV3") == 0, "cfg alem de n");
  char h[16]; snprintf(h, sizeof h, "c=%06lx", (unsigned long)fnv("ctl geral 2 600 3 0\nctl cfg 1 1 600 0 1000 100 INV-Norte 01\nctl cfg 2 2 600 600 1000 100 INV2"));
  CHECK(strstr(msg, "c=") == nullptr || true, "");
  cmd("ctl status"); CHECK(strstr(msg, h) != nullptr, "hash igual ao do backend (FNV das linhas)");
  CHECK(cmd("ctl 1763400000 300 1 450 -120 2 1000 80") == 1, "setpoint");
  CHECK(reg["INV-Norte 01/sp_limite_pct"] == 450 && reg["INV-Norte 01/sp_q_pct"] == -120 && reg["INV2/sp_q_pct"] == 80, "escrito com o nome cru");
  CHECK(!strncmp(msg, "A c=", 4) && strstr(msg, "1:ok 2:ok"), "resposta A c=... 1:ok 2:ok");
  CHECK(cmd("ctl 1763400000 300 1 450") == 0 && !strcmp(msg, "ctl_formato"), "trinca incompleta");
  CHECK(cmd("ctl 1763399000 300 1 1 1") == 0 && !strncmp(msg, "seq_velho", 9), "seq velho");
  // BI 3 (bit 2) -> manual
  g_bi = 4; for (int k = 0; k < 10; k++) { g_millis += 250; ctl_tick(); }
  CHECK(reg["INV2/sp_limite_pct"] == 1000 && reg["INV-Norte 01/sp_limite_pct"] == 1000 && reg["INV2/sp_q_pct"] == 0, "BI manual: 100%, Q 0");
  cmd("ctl 1763400060 300 1 450 -120 2 1000 80"); CHECK(msg[0] == 'M', "resposta M");
  g_bi = 0; for (int k = 0; k < 10; k++) { g_millis += 250; ctl_tick(); }
  CHECK(reg["INV-Norte 01/sp_limite_pct"] == 450, "volta ao pedido");
  // validade vence
  g_millis += 301000; ctl_tick();
  CHECK(reg["INV-Norte 01/sp_limite_pct"] == 600 && reg["INV-Norte 01/sp_q_pct"] == 0, "estagio 1");
  cmd("ctl off"); CHECK(reg["INV2/sp_limite_pct"] == 1000 && msg[0] == 'D', "off");
  cmd("ctl limpar"); cmd("ctl status"); CHECK(strstr(msg, "n=0"), "limpar");
  printf(falhas ? "FALHOU (%d)\n" : "OK\n", falhas);
  return falhas ? 1 : 0;
}
