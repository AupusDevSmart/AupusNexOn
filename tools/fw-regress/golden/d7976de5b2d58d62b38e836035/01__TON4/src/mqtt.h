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

#endif
