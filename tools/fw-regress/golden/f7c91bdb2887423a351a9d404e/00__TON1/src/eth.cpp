#include "hal.h"
#include "config.h"
#include <SPI.h>
#include <Ethernet.h>
#include <WiFi.h>   // pra usarmos esp_efuse_mac_get_default

static byte _mac[6];
static bool _hwReady = false;
static bool _hasIp   = false;
static EthernetClient _ethClient;

// Deriva MAC unico da TON a partir do eFuse (MAC WiFi base + 1).
// Evita colisao quando mais de uma TON estao na mesma rede.
static void _deriveMac() {
    uint8_t base[6];
    WiFi.macAddress(base);
    memcpy(_mac, base, 6);
    _mac[0] |= 0x02;  // localmente administrado, evita colisao com OUIs reais
    _mac[5] = (uint8_t)((base[5] + 1) & 0xFF);
}

// Le diretamente o Version Register do W5500 (endereco 0x0039 do bloco Common Register).
// W5500 sempre retorna 0x04 nesse registro. Mesmo metodo do TON-TESTE/main.cpp.
// SPI a 1 MHz (mais confiavel pra diagnostico do que os 14 MHz default).
static uint8_t _w5500_read_version() {
    digitalWrite(W5500_CS, LOW);
    SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
    SPI.transfer(0x00);   // address high byte
    SPI.transfer(0x39);   // address low byte (Version Register)
    SPI.transfer(0x01);   // control: Common Register, Read mode
    uint8_t ver = SPI.transfer(0x00);
    SPI.endTransaction();
    digitalWrite(W5500_CS, HIGH);
    return ver;
}

bool eth_hw_init() {
    if (_hwReady) return true;
    _deriveMac();

    Serial.printf("[ETH] Iniciando W5500 — pinos: CS=%d RST=%d MOSI=%d MISO=%d SCLK=%d\n",
                  W5500_CS, W5500_RST, SPI2_MOSI_PIN, SPI2_MISO_PIN, SPI2_SCLK_PIN);

    // Mesma sequencia de reset do TON-TESTE (validada em hardware)
    pinMode(W5500_CS, OUTPUT);
    digitalWrite(W5500_CS, HIGH);
    pinMode(W5500_RST, OUTPUT);
    digitalWrite(W5500_RST, LOW); delay(50);
    digitalWrite(W5500_RST, HIGH); delay(500);    // PHY ready (datasheet: >=150ms)

    SPI.begin(SPI2_SCLK_PIN, SPI2_MISO_PIN, SPI2_MOSI_PIN);

    // Le o Version Register direto via SPI — fonte de verdade:
    // 0x04 = W5500 OK | 0x00 ou 0xFF = chip nao responde
    uint8_t ver = _w5500_read_version();
    Serial.printf("[ETH] Version register (0x39): 0x%02X (esperado 0x04)\n", ver);
    _hwReady = (ver == 0x04);

    if (_hwReady) {
        Ethernet.init(W5500_CS);
        Serial.printf("[ETH] OK — W5500 detectado, MAC %02X:%02X:%02X:%02X:%02X:%02X\n",
                      _mac[0], _mac[1], _mac[2], _mac[3], _mac[4], _mac[5]);
    } else {
        // Diagnostico extra de MISO em high-Z
        pinMode(SPI2_MISO_PIN, INPUT_PULLUP);
        int misoUp = digitalRead(SPI2_MISO_PIN);
        pinMode(SPI2_MISO_PIN, INPUT_PULLDOWN);
        int misoDown = digitalRead(SPI2_MISO_PIN);
        Serial.printf("[ETH] MISO high-Z: pull-up=%d pull-down=%d "
                      "(ambos seguem o pull = MISO flutuando, chip ausente/desligado)\n",
                      misoUp, misoDown);
        Serial.println("[ETH] FALHA: W5500 nao respondeu. Cheque solda, 3V3, pinos SPI e RST.");
    }
    return _hwReady;
}

bool eth_link_up() {
    if (!_hwReady) return false;
    return Ethernet.linkStatus() == LinkON;
}

bool eth_has_ip() { return _hwReady && _hasIp; }

// Tenta DHCP se link UP e ainda nao temos IP. Retorna true se temos IP via DHCP.
// IMPORTANTE: NAO faz fallback automatico para IP estatico — se DHCP falhar, retorna false
// e a logica de switching mantem WiFi (rede provavelmente nao serve a TON).
// Para usar IP estatico explicitamente, ative ETH_USE_STATIC_FALLBACK no config.h.
bool eth_check_dhcp() {
    if (!_hwReady) return false;
    if (!eth_link_up()) {
        if (_hasIp) {
            Serial.println("[ETH] Link DOWN — perdemos IP");
            _hasIp = false;
        }
        return false;
    }
    if (_hasIp) return true;

    // B3: link sem servidor DHCP (switch sem roteador) -> apos 3 falhas, tenta so' a cada 2 min
    static uint8_t _dhcpFails = 0; static unsigned long _dhcpLast = 0;
    if (_dhcpFails >= 3 && millis() - _dhcpLast < 120000UL) return false;
    _dhcpLast = millis();
    Serial.printf("[ETH] Link UP, tentando DHCP (timeout %lums)...\n",
                  (unsigned long)ETH_DHCP_TIMEOUT_MS);
    if (Ethernet.begin(_mac, ETH_DHCP_TIMEOUT_MS, 2000) != 0) {
        _dhcpFails = 0;
        _hasIp = true;
        Serial.printf("[ETH] DHCP OK -> %s | gw=%s | dns=%s\n",
                      Ethernet.localIP().toString().c_str(),
                      Ethernet.gatewayIP().toString().c_str(),
                      Ethernet.dnsServerIP().toString().c_str());
        return true;
    }

    if (_dhcpFails < 255) _dhcpFails++;
#ifdef ETH_USE_STATIC_FALLBACK
    // Fallback IP estatico — so se explicitamente habilitado no config.
    // Cuidado: se a rede nao for ETH_STATIC_IP/SUBNET, o broker fica inalcancavel.
    IPAddress ip, gw, sn, dns;
    ip.fromString(ETH_STATIC_IP); gw.fromString(ETH_GATEWAY);
    sn.fromString(ETH_SUBNET); dns.fromString(ETH_DNS);
    Ethernet.begin(_mac, ip, dns, gw, sn);
    _hasIp = (Ethernet.localIP() != IPAddress(0, 0, 0, 0));
    if (_hasIp) {
        Serial.printf("[ETH] DHCP falhou, IP estatico %s\n", Ethernet.localIP().toString().c_str());
    } else {
        Serial.println("[ETH] Sem IP (DHCP falhou e estatico tambem)");
    }
    return _hasIp;
#else
    Serial.println("[ETH] DHCP falhou — sem IP. Mantendo WiFi.");
    _hasIp = false;
    return false;
#endif
}

EthernetClient& eth_get_client() { return _ethClient; }

IPAddress eth_local_ip() { return Ethernet.localIP(); }

// === Compat: mantidas para nao quebrar quem ja chamava ===
bool eth_init()       { return eth_hw_init() && eth_check_dhcp(); }
bool eth_connected()  { return eth_has_ip(); }
void eth_maintain()   { if (_hwReady) Ethernet.maintain(); }
void eth_hw_reset() {
    Serial.println("[ETH] RESET do W5500 pelo pino (Ethernet com link e sem broker)");
    _hwReady = false; _hasIp = false;
    eth_hw_init();
}
