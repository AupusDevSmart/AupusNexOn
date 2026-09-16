#include "inputs.h"
#include "hal.h"
#include <Wire.h>
#include <Adafruit_MCP23X08.h>

#define MCP_IN_ADDR  0x26
#define INPUT_COUNT  6

static Adafruit_MCP23X08 _mcp;
static bool _ok = false;
static uint8_t _state = 0;
static uint8_t _prev = 0;
static bool _changed = false;
static uint8_t _debounce[INPUT_COUNT] = {0};

bool inputs_init() {
    if (!_mcp.begin_I2C(MCP_IN_ADDR, &Wire)) return false;
    for (int i = 1; i <= INPUT_COUNT; i++)
        _mcp.pinMode(i, INPUT_PULLUP);
    // GP6/GP7 = LoRa M0/M1 (saidas)
    _mcp.pinMode(6, OUTPUT);
    _mcp.pinMode(7, OUTPUT);
    _mcp.digitalWrite(6, LOW);
    _mcp.digitalWrite(7, LOW);
    _ok = true;
    return true;
}

void inputs_scan() {
    if (!_ok) return;
    uint8_t reading = 0;
    for (int i = 0; i < INPUT_COUNT; i++) {
        bool val = !_mcp.digitalRead(i + 1);
        if (val == ((_state >> i) & 1)) {
            _debounce[i] = 0;
        } else {
            _debounce[i]++;
            if (_debounce[i] >= 3) {
                if (val) reading |= (1 << i);
                _debounce[i] = 0;
            } else {
                if ((_state >> i) & 1) reading |= (1 << i);
            }
            continue;
        }
        if (val) reading |= (1 << i);
    }
    _prev = _state;
    _state = reading;
    if (_state != _prev) _changed = true;
}

uint8_t inputs_get_state() { return _state; }
bool inputs_changed() { bool c = _changed; _changed = false; return c; }
