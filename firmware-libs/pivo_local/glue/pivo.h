// pivo.h — pivo na TON (glue gerado; logica na lib pivo_local). docs/IOT-PIVO-TON-LOCAL.md
#ifndef PIVO_H
#define PIVO_H
#include <Arduino.h>

typedef void (*pivo_publish_fn)(const char* subtopic, const char* payload);

void pivo_init();                          // NVS (io/tempos/encoder); reles do pivo desligados
void pivo_tick();                          // SO' controle: le BI, roda a maquina, aplica BO (sem radio) — chamar logo apos inputs_scan()
void pivo_loop(pivo_publish_fn publish);   // pivo_tick() + publicacao (status/eventos)
bool pivo_ocioso();                        // parado: libera OTA e reinicio
void pivo_encoder_bruto(float bruto);      // leitura nova do encoder (contagem crua do Modbus)
// Calibracao (NEXON-103): "pivo encler" pede 5 leituras seguidas por pivo_encoder_amostrar(), que o
// modbus_meter.cpp define quando ha' Encoder no RS485 (true = leitura boa, ja' entregue acima).
void pivo_publicar_agora();                // forca o status no proximo loop
void pivo_publicar(pivo_publish_fn publish); // publica o status AGORA (resposta ao POLL do LoRa)
void pivo_so_no_poll(bool so_poll);        // satelite mestre-puxa: status so' na resposta ao POLL
// "pivo ..." (Serial / <BASE>/cmd). -1 = nao e' comando do pivo; 0 = recusado; 1 = ok. msg = resultado curto.
int  pivo_cmd(const String& cmd, char* msg, size_t msg_sz);
#endif
