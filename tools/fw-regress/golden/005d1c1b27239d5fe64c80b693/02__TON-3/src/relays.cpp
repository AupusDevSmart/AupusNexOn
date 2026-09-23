#include "relays.h"
#include <Wire.h>
#include <Adafruit_MCP23X08.h>
#include "hal.h"

#define MCP_OUT_ADDR 0x27
#define RELAY_COUNT  6

static Adafruit_MCP23X08 _mcp;
static bool _ok = false;
static uint8_t _state = 0;

// ---- C3/C4 anti-travamento: rele VERIFICADO + recuperacao do barramento I2C ----
// Os dois MCP23008 (entradas 0x26, reles 0x27) dividem o I2C. Com SDA preso a lib nao
// trava, mas o rele fica no ultimo estado e a escrita "some". Agora toda escrita e'
// conferida (ACK + leitura do registrador GPIO); falhou -> libera o barramento (9 pulsos
// de clock + STOP), reinicializa os MCP e reaplica o estado DESEJADO. Sem sucesso ->
// relays_io_fault() = true (o posto bloqueia e pede reinicio; ver bomba.cpp).
uint32_t diag_i2c_resets = 0;
static bool _ioFault = false;
static unsigned long _lastHealth = 0;
static uint8_t _pinOf(uint8_t num) { return num; }
static uint8_t _bitOf(uint8_t num) { return num; }
// Le o LATCH de saida (OLAT, reg 0x0A do MCP23008): prova que a escrita chegou ao chip.
// Nao usa o nivel do pino (GPIO) para nao dar falso alarme por carga eletrica no rele.
static int _readOlat() {
    Wire.beginTransmission(MCP_OUT_ADDR);
    Wire.write((uint8_t)0x0A);
    if (Wire.endTransmission(false) != 0) return -1;
    if (Wire.requestFrom((uint8_t)MCP_OUT_ADDR, (uint8_t)1) != 1) return -1;
    return Wire.read();
}
static bool _conferir() {
    int olat = _readOlat();
    if (olat < 0) return false;
    uint8_t g = (uint8_t)olat;
    for (uint8_t n = 1; n <= RELAY_COUNT; n++) {
        bool quero = (_state >> _bitOf(n)) & 1;
        if ((bool)((g >> _pinOf(n)) & 1) != quero) return false;
    }
    return true;
}
static void _i2cBusClear() {
    Wire.end();
    pinMode(I2C_SDA, INPUT_PULLUP);
    pinMode(I2C_SCL, OUTPUT_OPEN_DRAIN);
    for (int i = 0; i < 9; i++) {           // um escravo segurando SDA solta com ate 9 clocks
        digitalWrite(I2C_SCL, LOW); delayMicroseconds(5);
        digitalWrite(I2C_SCL, HIGH); delayMicroseconds(5);
        if (digitalRead(I2C_SDA)) break;
    }
    pinMode(I2C_SDA, OUTPUT_OPEN_DRAIN);    // STOP: SDA sobe com SCL alto
    digitalWrite(I2C_SDA, LOW); delayMicroseconds(5);
    digitalWrite(I2C_SCL, HIGH); delayMicroseconds(5);
    digitalWrite(I2C_SDA, HIGH); delayMicroseconds(5);
    Wire.begin(I2C_SDA, I2C_SCL);
}
extern bool inputs_init();
static bool _recuperar() {
    diag_i2c_resets++;
    Serial.println("[I2C] escrita de rele nao conferiu - recuperando o barramento e os MCP");
    _i2cBusClear();
    inputs_init();                           // MCP de entradas (pull-ups) caso tenha resetado
    if (_mcp.begin_I2C(MCP_OUT_ADDR, &Wire)) {
        for (uint8_t n = 1; n <= RELAY_COUNT; n++) {
            _mcp.pinMode(_pinOf(n), OUTPUT);
            _mcp.digitalWrite(_pinOf(n), ((_state >> _bitOf(n)) & 1) ? HIGH : LOW);
        }
    }
    bool ok = _conferir();
    if (ok != !_ioFault) {
        _ioFault = !ok;
        Serial.println(ok ? "[I2C] reles de volta ao estado desejado" : "[I2C] FALHA: reles sem controle (io_falha)");
    }
    return ok;
}
bool relays_io_fault() { return _ioFault; }
// Chamar a cada volta do laco: confere os reles a cada 2 s (1 transacao I2C).
void relays_health_tick() {
    if (!_ok) return;
    if (millis() - _lastHealth < 2000UL) return;
    _lastHealth = millis();
    if (!_conferir()) _recuperar();
    else if (_ioFault) { _ioFault = false; Serial.println("[I2C] reles conferidos: ok"); }
}

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
    // estado DESEJADO primeiro: a recuperacao reaplica o que se quer, nao o que se leu
    if (state) _state |= (1 << _bitOf(num)); else _state &= ~(1 << _bitOf(num));
    _mcp.digitalWrite(_pinOf(num), state ? HIGH : LOW);
    if (!_conferir()) _recuperar();
}

void relays_all_on() { for (int i = 1; i <= RELAY_COUNT; i++) relay_set(i, true); }
void relays_all_off() { for (int i = 1; i <= RELAY_COUNT; i++) relay_set(i, false); }
uint8_t relays_get_state() { return _state; }
