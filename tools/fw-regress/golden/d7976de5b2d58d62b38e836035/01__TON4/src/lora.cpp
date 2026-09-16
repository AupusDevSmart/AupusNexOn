#include "lora.h"
#include "hal.h"
#include "config.h"
#include <esp_task_wdt.h>

#define LORA_SERIAL Serial2

void lora_init() {
    pinMode(LORA_AUX, INPUT);
    LORA_SERIAL.begin(LORA_BAUD, LORA_CONFIG, UART2_TX, UART2_RX);
    unsigned long t = millis();
    while (!digitalRead(LORA_AUX) && millis() - t < 2000) { delay(10); esp_task_wdt_reset(); }
    Serial.printf("[LORA] E220 AUX=%s\n", digitalRead(LORA_AUX) ? "OK" : "FALHA");
}

void lora_send(const char* msg) {
    unsigned long t = millis();
    while (!digitalRead(LORA_AUX) && millis() - t < 1000) { delay(1); esp_task_wdt_reset(); }
    LORA_SERIAL.println(msg);
    LORA_SERIAL.flush();
}

bool lora_available() { return LORA_SERIAL.available() > 0; }
String lora_read() {
    if (!LORA_SERIAL.available()) return "";
    LORA_SERIAL.setTimeout(100);
    String msg = LORA_SERIAL.readStringUntil('\n');
    msg.trim();
    return msg;
}
bool lora_ready() { return digitalRead(LORA_AUX) == HIGH; }
