#ifndef OTA_H
#define OTA_H
#include <stdint.h>

void ota_init();

// Processa um comando OTA recebido via MQTT (JSON: url, version, md5).
// Bloqueante: baixa o firmware, grava, reinicia.
void ota_handle_command(const char* payload);

// True durante o download/flash. loop() principal deve ceder tempo nesse estado.
bool ota_in_progress();

// ----- Rollback automático (proteção pós-OTA) -----
// Detecta no boot se o firmware atual está em estado PENDING_VERIFY
// (entrou agora via OTA e ainda não foi confirmado válido). Se sim,
// arma um contador interno de validação. Chamar UMA vez no setup().
void ota_check_pending_verify();

// Sinaliza uma execução saudável (chamar após cada mqtt_publish OK).
// Após N sinalizações consecutivas, marca a partição como válida e
// desliga o rollback. Se o firmware travar antes, no próximo reset
// o bootloader detecta PENDING_VERIFY e reverte para a partição anterior.
void ota_confirm_valid_if_needed();

#endif
