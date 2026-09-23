#ifndef SD_BUFFER_H
#define SD_BUFFER_H
#include <stdint.h>

// Fila offline de mensagens MQTT no cartao SD (fila SEGMENTADA, rev. 2026-09-23).
// Fonte canonica: AupusNexOn/firmware-libs/sd_queue/ (testada no host: test_sd_queue.cpp).
// As bases V1 e V2 embutem uma COPIA identica (smoke confere byte a byte).

// Monta o cartao (2 tentativas) e prepara a fila. Retorna true se OK.
bool sd_buffer_init();
bool sd_buffer_ready();

// Guarda { topic, payload } no fim da fila. Chamado quando o MQTT falha.
bool sd_buffer_store(const char* topic, const char* payload);

// Drena a fila: publica no maximo max_send mensagens OU ~300 ms, o que vier primeiro.
// publish_fn: retorna true se publicou. Para na primeira falha (resto fica na fila).
// Retorna quantas mensagens sairam.
typedef bool (*sd_buffer_publish_fn)(const char* topic, const char* payload);
int sd_buffer_drain(sd_buffer_publish_fn publish_fn, int max_send);

// Mensagens pendentes. BARATO (contador em memoria; nunca varre o cartao no laco).
// Enquanto a contagem inicial nao termina, devolve o que ja contou (>=1 se houver fila).
int sd_buffer_pending();

// Manutencao nao-bloqueante: contagem inicial em fatias de ~20 ms e remontagem do
// cartao a cada 10 min quando ele falhou. Chamar a cada volta do laco.
void sd_buffer_tick();

// Estado para o diagnostico: "ok" | "sem_cartao" | "falha" ; mensagens descartadas por
// cartao cheio (as mais antigas).
const char* sd_buffer_state();
uint32_t sd_buffer_discarded();

// Grava o ponteiro de leitura se houver avanco nao salvo (chamar antes de reiniciar).
void sd_buffer_flush();

// Comando remoto "sd limpar confirmo": apaga a fila (e arquivos da versao antiga), zera o
// ponteiro e remonta o cartao. Resolve arquivo corrompido; NAO formata o cartao.
bool sd_buffer_wipe();

#endif
