#ifndef CONFIG_H
#define CONFIG_H
#include <stdint.h>

// ============================================================
// CONFIG - TON4 (TON4)
// Gerado pelo NexOn IoT
// ============================================================

#define DEVICE_MODEL        "TON4"
#define DEVICE_ID           "TON4-1"
#define FIRMWARE_VERSION    "1.8.0-build202001010000"

// I2C
#define I2C_ADDR_RTC        0x68
#define I2C_ADDR_MUX_IN     0x26
#define I2C_ADDR_MUX_OUT    0x27
#define I2C_CLOCK_HZ        100000

// SPI
#define SPI_CLOCK_HZ        8000000

// RS485
#define RS485_UART_NUM      1
#define RS485_BAUD          9600
#define RS485_CONFIG        SERIAL_8N1

// LoRa (E220-900T30D — modo transparente, half-duplex RX+TX)
#define LORA_UART_NUM       2
#define LORA_BAUD           9600
#define LORA_CONFIG         SERIAL_8N1
#define LORA_ROLE           "SATELLITE"

// MQTT ausente (LoRa-only). MQTT_TOPIC_BASE definido apenas pra compilar os
// helpers de comando — nenhuma publicacao MQTT real ocorre nesta TON.
#define MQTT_TOPIC_BASE     "OLI/GO/CHIMARRAO/BOMBAS"
#define DIAG_INTERVAL_MS    60000

// Ethernet W5500
#define ETH_MAC             { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x01 }
#define ETH_DHCP_TIMEOUT_MS 4000    // B3: era 10 s bloqueando o laco a cada 30 s
#define ETH_STATIC_IP       "192.168.1.200"
#define ETH_GATEWAY         "192.168.1.1"
#define ETH_SUBNET          "255.255.255.0"
#define ETH_DNS             "8.8.8.8"

// SD Card
#define SD_BUFFER_FILE      "/datalog.csv"
#define SD_MAX_FILE_SIZE    (1024 * 1024)

// PWM
#define PWM_CHANNEL         0
#define PWM_FREQ_HZ         1000
#define PWM_RESOLUTION      8

// ADC
#define ADC_RESOLUTION_BITS 12
#define ADC_ATTEN           ADC_11db
#define ADC_DIVIDER         8.01

// MCP23008 pin mapping
#define MCP_INPUT_COUNT     6

// Timing
#define INPUT_SCAN_MS       50
#define WATCHDOG_TIMEOUT_S  60      // Watchdog mais generoso (60s) para lidar com Modbus lento

// Medidores Modbus
#define METER_CYCLE_MS      4000
#define PUBLISH_INTERVAL_MS 60000
#define MAX_READINGS        35
// Back-off de device Modbus que nao responde: apos N falhas consecutivas, para
// de ler por COOLDOWN_MS. Cada leitura falha bloqueia ~2-4s no timeout do
// ModbusMaster; sem back-off, um device morto deixa a TON surda a comandos
// (critico no satellite LoRa — precisa sempre acionar a bomba). Durante o
// cooldown o loop fica livre pra LoRa/MQTT.
#define MODBUS_FAIL_COOLDOWN_N   3
#define MODBUS_COOLDOWN_MS       30000UL

#endif
