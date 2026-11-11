// pivo.h — pivo na TON (glue gerado; logica na lib pivo_local). docs/IOT-PIVO-TON-LOCAL.md
#ifndef PIVO_H
#define PIVO_H
#include <Arduino.h>

typedef void (*pivo_publish_fn)(const char* subtopic, const char* payload);

void pivo_init();                          // NVS (io/tempos/encoder); reles do pivo desligados
void pivo_loop(pivo_publish_fn publish);   // le BI, roda a maquina, aplica BO + ciclo do percentimetro, publica
bool pivo_ocioso();                        // parado: libera OTA e reinicio
void pivo_encoder_bruto(float bruto);      // leitura nova do encoder (contagem crua do Modbus)
void pivo_publicar_agora();                // forca o status no proximo loop
void pivo_publicar(pivo_publish_fn publish); // publica o status AGORA (resposta ao POLL do LoRa)
void pivo_so_no_poll(bool so_poll);        // satelite mestre-puxa: status so' na resposta ao POLL
// "pivo ..." (Serial / <BASE>/cmd). -1 = nao e' comando do pivo; 0 = recusado; 1 = ok. msg = resultado curto.
int  pivo_cmd(const String& cmd, char* msg, size_t msg_sz);
#endif
