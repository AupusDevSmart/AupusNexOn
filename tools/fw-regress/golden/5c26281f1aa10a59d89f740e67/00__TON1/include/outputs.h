#ifndef OUTPUTS_H
#define OUTPUTS_H
#include <stdint.h>

void outputs_init();
void output_set(uint8_t num, bool state);
void outputs_all_on();
void outputs_all_off();
uint8_t outputs_get_state();

#endif
