#ifndef RELAYS_H
#define RELAYS_H
#include <stdint.h>

bool relays_init();
void relay_set(uint8_t num, bool state);
void relays_all_on();
void relays_all_off();
uint8_t relays_get_state();
// Anti-travamento (C3/C4): confere os reles no I2C; true = sem controle dos reles.
bool relays_io_fault();
void relays_health_tick();

#endif
