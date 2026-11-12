#pragma once
#include <cstdint>
void relay_set(uint8_t num, bool on);
bool relays_io_fault();
uint8_t relays_get_state();
unsigned long relays_io_fault_ms();
