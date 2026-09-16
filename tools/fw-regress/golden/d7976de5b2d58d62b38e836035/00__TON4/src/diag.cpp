#include "diag.h"
// Sem WiFi: stubs vazios.
uint32_t diag_modbus_ok = 0;          uint32_t diag_modbus_err = 0;
uint32_t diag_mqtt_pub = 0;           uint32_t diag_publish_fails = 0;
uint32_t diag_wifi_disconnects = 0;   uint32_t diag_mqtt_disconnects = 0;
uint32_t diag_tcp_retries = 0;
uint32_t diag_sd_writes = 0;          uint32_t diag_sd_resends = 0;          uint32_t diag_sd_write_errors = 0;
uint32_t diag_min_free_heap = 0xFFFFFFFFu;
bool     diag_sd_available = false;   bool     diag_tcp_connected = false;
unsigned long diag_last_successful_read_ms = 0;  unsigned long diag_boot_time_ms = 0;
void diag_init() {}
void diag_tick() {}
const char* diag_reset_reason() { return "Unknown"; }
void diag_publish_periodic() {}
