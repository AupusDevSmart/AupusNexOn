// ctl.h — controle da UFV pelo MED (glue gerado; logica na lib controle_ufv).
// docs/IOT-CONTROLE-MED-CONCESSIONARIA-IMPLEMENTACAO.md §5
#ifndef CTL_H
#define CTL_H
#include <Arduino.h>

// Escrita de setpoint com read-back, definida pelo modbus (gerado):
//   1 = escrito e confirmado; 2 = escrito sem read-back; 0 = falhou; -2 = read-back divergente (*lido)
int ctl_escrever_sp(const char* dev, int addr, const char* cid, int32_t valor, int32_t* lido);

void ctl_init();     // cadastro do NVS; controle ativo antes do reinicio -> validade corre do boot
void ctl_tick();     // BI manual, validade, modo seguro, retentativas — chamar no loop
// Comandos "ctl ..." (texto CRU: o nome do device diferencia maiusculas).
// -1 = nao e' ctl; 0 = recusado; 1 = ok. msg = resultado curto (vai no ack).
int  ctl_cmd(const char* raw, char* msg, size_t msg_sz);
#endif
