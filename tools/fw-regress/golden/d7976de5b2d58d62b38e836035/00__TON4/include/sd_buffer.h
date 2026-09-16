#ifndef SD_BUFFER_H
#define SD_BUFFER_H
#include <stdint.h>

// Tenta inicializar SD. Retorna true se OK.
bool sd_buffer_init();
bool sd_buffer_ready();

// Guarda { topic, payload } no arquivo de buffer. Chamado quando MQTT falha.
// Inclui timestamp automaticamente.
bool sd_buffer_store(const char* topic, const char* payload);

// Drena o buffer: envia tudo que foi salvo (chamado quando MQTT reconecta).
// publish_fn: funcao que retorna true se publicou com sucesso.
// max_send: maximo de msgs a enviar por chamada (evita bloquear demais)
// Retorna numero de mensagens drenadas.
typedef bool (*sd_buffer_publish_fn)(const char* topic, const char* payload);
int sd_buffer_drain(sd_buffer_publish_fn publish_fn, int max_send);

// Quantas mensagens pendentes no buffer (linhas no arquivo)
int sd_buffer_pending();

#endif
