#include "adc.h"
#include "hal.h"
#include <Arduino.h>

#define ADC_DIVIDER 8.01

void adc_init() {
    analogReadResolution(12);
    analogSetPinAttenuation(AN1, ADC_11db);
    analogSetPinAttenuation(AN2, ADC_11db);
}

float adc_read_mv(int channel) {
    int pin = (channel == 1) ? AN1 : AN2;
    return analogReadMilliVolts(pin) * ADC_DIVIDER;
}
