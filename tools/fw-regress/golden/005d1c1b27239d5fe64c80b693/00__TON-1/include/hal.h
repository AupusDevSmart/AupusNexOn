#ifndef HAL_H
#define HAL_H

// USB nativo
#define USB_DN              19
#define USB_DP              20

// I2C
#define I2C_SDA             4
#define I2C_SCL             5

// SPI1 - SD Card (SPI3_HOST, zona MSPI)
#define SPI1_MOSI_PIN       35
#define SPI1_MISO_PIN       37
#define SPI1_SCLK_PIN       36
#define SD_CS               38

// SPI2 - W5500 Ethernet
#define SPI2_MOSI_PIN       11
#define SPI2_MISO_PIN       13
#define SPI2_SCLK_PIN       12
#define W5500_CS            10
#define W5500_RST           14

// UART1 (RS485)
#define UART1_TX            18
#define UART1_RX            17

// UART2 (LoRa)
#define UART2_TX            16
#define UART2_RX            15

// RS485 direction
#define RS485_DIR           8

// LoRa E220
#define LORA_AUX            47

// Transistor outputs (BC817)
#define TR1                 1
#define TR2                 2
#define TR3                 42
#define TR4                 41

// Analog inputs
#define AN1                 6
#define AN2                 7

// PWM output (MOSFET AOD7N65)
#define PWM_OUT             46

#endif
