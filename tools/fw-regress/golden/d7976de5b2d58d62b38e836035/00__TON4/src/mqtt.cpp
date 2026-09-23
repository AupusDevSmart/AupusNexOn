#include "mqtt.h"
void mqtt_init(mqtt_cmd_callback_t cb) {}
void mqtt_loop() {}
bool mqtt_publish(const char* t, const char* p) { return false; }
bool mqtt_connected() { return false; }
#include <Arduino.h>
bool mqtt_restart_permitido() { return true; }
void mqtt_request_restart(const char* reason, unsigned long delay_ms) { Serial.printf("[SYS] reinicio (%s)\n", reason); delay(delay_ms > 3000 ? 3000 : delay_ms); ESP.restart(); }
const char* mqtt_restart_cause() { return ""; }
unsigned long mqtt_conn_age_ms() { return 0xFFFFFFFFUL; }
