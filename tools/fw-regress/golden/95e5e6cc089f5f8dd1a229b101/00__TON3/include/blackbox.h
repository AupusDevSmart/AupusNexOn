#ifndef BLACKBOX_H
#define BLACKBOX_H
#include <stdint.h>

// CAIXA-PRETA da TON (plano anti-travamento, 2026-09-23). Fonte canonica:
// AupusNexOn/firmware-libs/blackbox/ (as bases V1 e V2 embutem copia identica).
//  - anel dos ultimos 40 eventos em memoria RTC (sobrevive a reinicio/watchdog/panic);
//  - os ultimos 16 sao copiados no NVS no maximo a cada 15 min, no boot e antes de todo
//    reinicio pedido pelo firmware (sobrevive a quem tira da tomada);
//  - guarda a ETAPA do laco em execucao: depois de um watchdog, diz onde a TON travou;
//  - publicado em <base>/log ao reconectar (so' o que ainda nao foi) e pelo comando "log".

void bb_init();                                   // cedo no setup (depois do Serial)
void bb_log(const char* fmt, ...);                // evento curto (ate 43 caracteres)
void bb_stage(uint8_t etapa);                     // marca a etapa atual do laco
void bb_flush();                                  // grava no NVS o que estiver pendente
const char* bb_stage_name(uint8_t etapa);

enum BbEtapa : uint8_t {
    BB_INICIO = 0, BB_REDE = 1, BB_ENTRADAS = 2, BB_MODBUS_RTU = 3, BB_PUBLICACAO = 4,
    BB_MODBUS_TCP = 5, BB_POSTO = 6, BB_SD = 7, BB_OTA = 8, BB_OUTROS = 9
};

typedef bool (*bb_publish_fn)(const char* topic, const char* payload);
// so_novos: true = so' eventos ainda nao publicados; false = o anel inteiro. Retorna quantos.
int bb_publish(bb_publish_fn pub, const char* topic_base, bool so_novos);

#endif
