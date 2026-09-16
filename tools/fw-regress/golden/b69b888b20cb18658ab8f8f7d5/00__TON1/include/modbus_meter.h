#ifndef MODBUS_METER_H
#define MODBUS_METER_H
#include <stdint.h>

typedef void (*modbus_publish_fn)(const char* subtopic, const char* payload);

void modbus_init();

// Acumulacao + media. Chamar a cada READ_INTERVAL_MS (round-robin 1 device por call)
// Internamente cicla entre os devices.
void modbus_sample_one();

// Publica medias acumuladas e reseta contadores. Chamar a cada PUBLISH_INTERVAL_MS.
void modbus_publish_all(modbus_publish_fn publish);

// Wrapper legado: faz sample de todos e publica imediatamente (sem media).
void modbus_read_all(modbus_publish_fn publish);

// SOE: drena a fila de eventos dos devices que expoem buffer (chave 'eventos' no catalogo).
// Publica cada evento CRU no subtopico "evt". Chamar a cada EVT_POLL_MS.
void modbus_events_poll(modbus_publish_fn publish);

// Executa comando BO (write coil). device_name do catalogo, cmd_id conforme bo_map.
bool modbus_exec_command(const char* device_name, const char* cmd_id);

#endif
