// Simulador do glue do pivo NA BANCADA (mesmo pivo.cpp + lib da TON), com falha injetada:
// quando o rele da bomba ABRE, as 4 escritas de rele seguintes se perdem (pico no I2C).
// Incidente 12/11/2026: no firmware antigo os reles ficavam presos (esq+dir juntos depois);
// com a reafirmacao a cada 1 s tudo volta ao estado pedido. Sai 1 se algo ficar preso.
#include "Arduino.h"
#include "pivo.h"   // g++ -std=c++17 -w -Isim/stub -I. -I.. -o /tmp/t sim/test_reles.cpp pivo.cpp ../pivo_local.cpp && /tmp/t
unsigned long g_millis = 100000; SerialT Serial;
bool R[9] = {false}; bool forceBI1zero = false; int perder = 0;   // escritas a perder (glitch I2C)
uint32_t diag_i2c_resets = 0;
uint8_t inputs_get_state() { bool d1 = R[1] && !forceBI1zero; return (d1?1:0)|2|(R[3]?4:0)|(R[4]?8:0)|16|32; }   // BI5 seguranca = 1 (normal)
uint8_t relays_get_state() { uint8_t s=0; for (int n=1;n<=6;n++) if (R[n]) s |= 1<<n; return s; }
void relay_set(uint8_t n, bool on) {
  if (perder > 0) { perder--; printf("   t=%6.1fs  R%u -> %s  ** ESCRITA PERDIDA (I2C) **\n", (g_millis-100000)/1000.0, n, on?"ON":"off"); return; }
  bool mudou = R[n] != on;
  if (mudou) printf("   t=%6.1fs  R%u -> %s\n", (g_millis-100000)/1000.0, n, on?"ON":"off");
  R[n] = on;
  if (n == 1 && !on && mudou) perder = 4;   // a bomba ABRE -> pico -> as proximas 4 escritas se perdem
}
bool relays_io_fault() { return false; }
#include <esp_system.h>
esp_reset_reason_t esp_reset_reason() { return ESP_RST_POWERON; }
static void pub(const char*, const char*) {}
static void ciclo(int n=1) { for (int i=0;i<n;i++) { g_millis += 50; pivo_tick(); pivo_loop(pub); } }
static void cmd(const char* c) { char m[96]; int r = pivo_cmd(String(c), m, sizeof m); printf("%7.1fs CMD \"%s\" -> %s\n", (g_millis-100000)/1000.0, c, m); }
static void rel(const char* q) { printf("   [%s] RELES: bomba=%d valv=%d DIR=%d ESQ=%d perc=%d canhao=%d\n", q, R[1],R[2],R[3],R[4],R[5],R[6]); }
int main() {
  pivo_init(); pivo_so_no_poll(true); ciclo(5);
  cmd("pivo cfg 123456 123456 000000 60 30 5 0 0 0 30 600 60 0"); cmd("pivo status");
  cmd("pivo ligar aaaa1111 e 1 600 1 t 36600"); ciclo(100); rel("esquerda irrigando");
  puts("-- operador tira a pressao (BI1 = 0)"); forceBI1zero = true; ciclo(60); rel("3 s depois");
  ciclo(1300); rel("65 s depois");
  forceBI1zero = false;
  cmd("pivo ligar bbbb2222 d 1 500 1 t 43920"); ciclo(60); rel("depois de ligar DIREITA");
  bool ok = R[1] && R[3] && !R[4];
  puts(ok ? "OK: so a direita ligada (esquerda desligada)" : "FALHOU: rele preso");
  return ok ? 0 : 1;
}
