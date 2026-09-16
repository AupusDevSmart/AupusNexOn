#ifndef LORA_H
#define LORA_H
#include <Arduino.h>

void lora_init();
void lora_send(const char* msg);
bool lora_available();
String lora_read();
bool lora_ready();

#endif
