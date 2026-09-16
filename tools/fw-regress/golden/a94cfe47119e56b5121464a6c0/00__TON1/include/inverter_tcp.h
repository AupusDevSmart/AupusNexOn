#ifndef INVERTER_TCP_H
#define INVERTER_TCP_H
#include <stdint.h>

// Callback de publicacao: subtopic relativo a MQTT_TOPIC_BASE, payload JSON.
typedef void (*tcp_publish_fn)(const char* subtopic, const char* payload);

// Inicializa cliente TCP do datalogger e imprime configuracao.
void inverter_tcp_init();

// Round-robin: le UM inversor por chamada e acumula amostras (avg) +
// salva ultima leitura (last) + snapshot inicial de delta. Chamar a cada
// READ_INTERVAL_MS (no loop principal). Distribui carga no datalogger.
void inverter_tcp_sample_one();

// Calcula medias/deltas acumulados e publica JSON por inversor.
// Chamar a cada PUBLISH_INTERVAL_MS. Zera acumuladores apos publicar.
void inverter_tcp_publish_all(tcp_publish_fn publish);

// Executa comando (bo_map) de um device TCP direto pelo nome — write de coil
// (FC05) ou registrador (FC06) via MBAP. Retorna false se o device/cmd nao
// existir no lado TCP (o chamador tenta RS485 primeiro; este e' o fallback).
bool inverter_tcp_exec_command(const char* device_name, const char* cmd_id);

// SOE: drena a fila de eventos (EVENTCOUNT + EVENT via FC04) dos devices TCP
// cujo catalogo tem a chave 'eventos'. Publica evento cru no subtopico "evt".
void inverter_tcp_events_poll(tcp_publish_fn publish);

#define TCP_INVERTER_COUNT 2
extern const uint8_t TCP_INVERTER_IDS[];

#endif
