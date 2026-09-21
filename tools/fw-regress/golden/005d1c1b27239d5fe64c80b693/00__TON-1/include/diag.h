#ifndef DIAG_H
#define DIAG_H
#include <stdint.h>

// Contadores globais de diagnostico (extern). Outros modulos incrementam estes diretamente.
extern uint32_t      diag_modbus_ok;
extern uint32_t      diag_modbus_err;
extern uint32_t      diag_mqtt_pub;
extern uint32_t      diag_publish_fails;
extern uint32_t      diag_wifi_disconnects;
extern uint32_t      diag_mqtt_disconnects;
extern uint32_t      diag_tcp_retries;
extern uint32_t      diag_sd_writes;
extern uint32_t      diag_sd_resends;
extern uint32_t      diag_sd_write_errors;
extern uint32_t      diag_min_free_heap;
extern bool          diag_sd_available;
extern bool          diag_tcp_connected;
extern unsigned long diag_last_successful_read_ms;
extern unsigned long diag_boot_time_ms;

void        diag_init();                  // chamar uma vez no setup()
void        diag_tick();                  // chamar todo loop (atualiza min_free_heap)
const char* diag_reset_reason();          // texto do esp_reset_reason()
void        diag_publish_periodic();      // publica em DIAG_TOPIC se passou DIAG_INTERVAL_MS

#endif
