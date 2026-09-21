#ifndef INPUTS_H
#define INPUTS_H
#include <stdint.h>

bool inputs_init();
void inputs_scan();
uint8_t inputs_get_state();
bool inputs_changed();

#endif
