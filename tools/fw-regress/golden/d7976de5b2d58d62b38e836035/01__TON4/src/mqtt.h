#ifndef MQTT_H
#define MQTT_H

typedef void (*mqtt_cmd_callback_t)(const char* payload);

void mqtt_init(mqtt_cmd_callback_t callback);
void mqtt_loop();
bool mqtt_publish(const char* topic, const char* payload);
// Publica direto, sem fallback de SD (usado p/ diagnostics — nao faz sentido enfileirar).
bool mqtt_publish_raw(const char* topic, const char* payload);
bool mqtt_connected();
// Retorna nome da interface de rede ativa: "wifi" | "eth" | "none"
const char* mqtt_active_iface();
// Auto-recuperacao (watchdog de conectividade) e reinicio remoto:
// agenda um reinicio em delay_ms (so' executa se for seguro: sem OTA / posto ocioso).
void mqtt_request_restart(const char* reason, unsigned long delay_ms);
bool mqtt_restart_permitido();
// Motivo do ULTIMO reinicio pedido pelo proprio firmware ("" = nao foi o firmware).
const char* mqtt_restart_cause();
// Ha quanto tempo a sessao MQTT atual esta de pe (ms). Protege o 'reboot' contra comando RETIDO.
unsigned long mqtt_conn_age_ms();

#endif
