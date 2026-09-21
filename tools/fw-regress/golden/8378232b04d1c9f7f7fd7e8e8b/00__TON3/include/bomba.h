// bomba.h — posto de combustivel na TON (glue gerado; logica na lib bomba_posto)
#ifndef BOMBA_H
#define BOMBA_H
#include <Arduino.h>

typedef void (*bomba_publish_fn)(const char* subtopic, const char* payload);

void bomba_init();                          // NVS (lista + sessao), config; reles ficam desligados
void bomba_loop(bomba_publish_fn publish);  // le BI/AI, roda a maquina, aplica BO, publica
bool bomba_ota_permitida();                 // so' em ociosa/bloqueada

// MQTT (chamadas pelo _onMessage do mqtt.cpp)
void bomba_set_lista(const char* json);     // <BASE>/cmd/rfid_sync (retido): lista de autorizados
void bomba_auth_resp(const char* json);     // <BASE>/auth/resp: resposta do NexON

// Comandos (Serial / <BASE>/cmd): retornam true e preenchem msg
bool bomba_cmd(const String& cmd, char* msg, size_t msg_sz);
#endif
