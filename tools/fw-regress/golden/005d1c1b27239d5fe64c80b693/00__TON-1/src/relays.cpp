#include "relays.h"
#include <Wire.h>
#include <Adafruit_MCP23X08.h>

#define MCP_OUT_ADDR 0x27
#define RELAY_COUNT  6

static Adafruit_MCP23X08 _mcp;
static bool _ok = false;
static uint8_t _state = 0;

bool relays_init() {
    if (!_mcp.begin_I2C(MCP_OUT_ADDR, &Wire)) return false;
    for (int i = 1; i <= RELAY_COUNT; i++) {
        _mcp.pinMode(i, OUTPUT);
        _mcp.digitalWrite(i, LOW);
    }
    _ok = true;
    return true;
}

void relay_set(uint8_t num, bool state) {
    if (!_ok || num < 1 || num > RELAY_COUNT) return;
    _mcp.digitalWrite(num, state ? HIGH : LOW);
    if (state) _state |= (1 << num); else _state &= ~(1 << num);
}

void relays_all_on() { for (int i = 1; i <= RELAY_COUNT; i++) relay_set(i, true); }
void relays_all_off() { for (int i = 1; i <= RELAY_COUNT; i++) relay_set(i, false); }
uint8_t relays_get_state() { return _state; }
