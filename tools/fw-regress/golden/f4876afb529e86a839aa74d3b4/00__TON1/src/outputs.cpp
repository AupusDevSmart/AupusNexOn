#include "outputs.h"
#include "hal.h"
#include <Arduino.h>

static const uint8_t _pins[] = { TR1, TR2, TR3, TR4 };
static uint8_t _state = 0;

void outputs_init() {
    for (int i = 0; i < 4; i++) {
        pinMode(_pins[i], OUTPUT);
        digitalWrite(_pins[i], LOW);
    }
}

void output_set(uint8_t num, bool state) {
    if (num < 1 || num > 4) return;
    digitalWrite(_pins[num - 1], state ? HIGH : LOW);
    if (state) _state |= (1 << (num-1)); else _state &= ~(1 << (num-1));
}

void outputs_all_on() { for (int i = 1; i <= 4; i++) output_set(i, true); }
void outputs_all_off() { for (int i = 1; i <= 4; i++) output_set(i, false); }
uint8_t outputs_get_state() { return _state; }
