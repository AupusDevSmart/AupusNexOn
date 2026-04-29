/**
 * IoT NexOn - Diagram Editor (NexOn-style)
 * SVG-based visual topology editor matching NexOn supervisório layout.
 * Grid 40px, orthogonal routing, ports on hover, animated selection.
 */

// ============================================================
// CONSTANTS
// ============================================================
var GRID_SIZE = 40;
var NODE_SIZE = 80;
var PORT_RADIUS = 5;
var PORT_RADIUS_HOVER = 7;
var SNAP = GRID_SIZE;
var ROUTE_OFFSET = 30;

var THEMES = {
    dark: {
        bg: '#1A1A1A',
        grid: 'rgba(255,255,255,0.08)',
        gridMajor: 'rgba(255,255,255,0.15)',
        connection: '#FFFFFF',
        connectionHover: '#60A5FA',
        port: '#3B82F6',
        portHover: '#60A5FA',
        nodeStroke: 'rgba(255,255,255,0.2)',
        nodeFill: '#262626',
        nodeText: '#E5E7EB',
        nodeTextSub: '#9CA3AF',
        selection: '#3B82F6',
        accent: '#3B82F6',
    },
    light: {
        bg: '#FFFFFF',
        grid: 'rgba(0,0,0,0.06)',
        gridMajor: 'rgba(0,0,0,0.12)',
        connection: '#374151',
        connectionHover: '#2563EB',
        port: '#3B82F6',
        portHover: '#2563EB',
        nodeStroke: 'rgba(0,0,0,0.15)',
        nodeFill: '#F9FAFB',
        nodeText: '#1F2937',
        nodeTextSub: '#6B7280',
        selection: '#3B82F6',
        accent: '#3B82F6',
    }
};

// ============================================================
// COMPONENT DEFINITIONS
// ============================================================
var COMPONENT_TYPES = {
    // ============================================================
    // CONTROLADORES TON (ESP32-S3-WROOM-1-N8R2)
    // Placa única — modelo define quais periféricos estão ativos
    // Ref: SCH-TON-v1.pdf
    // ============================================================

    // ── Pinagem CONFIRMADA em hardware (firmware v1.3.0) ────────────
    // I2C:       SDA=IO4, SCL=IO5  (MCP23008 x2 + RTC DS3231)
    // SPI-SD:    SPI3_HOST → MOSI=IO35, SCK=IO36, MISO=IO37, CS=IO38
    // SPI-ETH:   SPI2 → MOSI=IO11, SCK=IO12, MISO=IO13, CS=IO10, RST=IO14
    // RS485:     MAX485CSA++ → TX=IO18, RX=IO17, DE/RE=IO8  [X9]
    // LoRa:      UART2 E220-900T30D → TX=IO16, RX=IO15, AUX=IO47, M0/M1=GND (PCB)
    // Opto In:   6x TLP183 → MCP23008(0x26) GP1-GP6  [X12]
    // Relés:     6x ULN2803ADW → MCP23008(0x27) GP1-GP6  [X1-X6]
    // TR Out:    TR1=IO1, TR2=IO2, TR3=IO42, TR4=IO41  [X11] (BC817)
    // PWM:       MOSFET AOD7N65 → IO46  [X8] (definido, não implementado)
    // Analog:    AN1=IO6 (div 8.01x), AN2=IO7 (div 8.01x)
    // RTC:       DS3231 I2C 0x68  [X7]
    // USB-C:     nativo ESP32-S3 (IO19/IO20)

    ton1: {
        label: 'TON1', category: 'controller', color: '#3B82F6',
        icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: true,
        has_lora: false,
        has_relays: false,
        description: 'RS485 + Ethernet + SD + 6 entradas + 4 TR + PWM + 2 AN',
        integrated: {
            mcu: 'ESP32-S3-WROOM-1-N8R2',
            i2c: { sda: 4, scl: 5 },
            rs485: { chip: 'MAX485CSA++', tx: 18, rx: 17, de_re: 8, connector: 'X9' },
            ethernet: { chip: 'W5500', spi: 'SPI2', mosi: 11, sclk: 12, cs: 10, miso: 13, rst: 14 },
            sd_card: { spi: 'SPI3_HOST', mosi: 35, sclk: 36, cs: 38, miso: 37 },
            rtc: { chip: 'DS3231', addr: '0x68', connector: 'X7' },
            opto_inputs: { count: 6, chip: 'TLP183', mux: 'MCP23008@0x26', pins: 'GP1-GP6', connectors: 'X12' },
            transistor_outputs: { count: 4, chip: 'BC817', pins: [1, 2, 42, 41], connector: 'X11' },
            pwm: { count: 1, pin: 46, mosfet: 'AOD7N65', connector: 'X8' },
            analog_inputs: { count: 2, pins: [6, 7], resolution: '12bit', divider: 8.01 },
            usb: { type: 'USB-C', dn: 19, dp: 20 },
        },
        defaults: {
            name: 'TON1',
            ota_hostname: '',
            mqtt_topic_base: '',
            equipamento_id: '',
        },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'ota_hostname', label: 'Hostname OTA', type: 'text', placeholder: 'TON1-XXX' },
            { key: 'mqtt_topic_base', label: 'Tópico Base', type: 'text', placeholder: 'PROPRIETARIO/ESTADO/PLANTA/INSTALACAO' },
            { key: '_topic_preview', label: 'Tópicos Dispositivos', type: 'topic_preview' },
            { key: 'equipamento_id', label: 'Equipamento NexOn (ID)', type: 'text', placeholder: 'CUID 26 chars — necessário para Implantar OTA' },
        ]
    },
    ton2: {
        label: 'TON2', category: 'controller', color: '#8B5CF6',
        icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z',
        antennaIcon: 'M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: true,
        has_lora: true,
        has_relays: false,
        description: 'RS485 + Ethernet + SD + LoRa + 6 entradas + 4 TR + PWM + 2 AN',
        integrated: {
            mcu: 'ESP32-S3-WROOM-1-N8R2',
            i2c: { sda: 4, scl: 5 },
            rs485: { chip: 'MAX485CSA++', tx: 18, rx: 17, de_re: 8, connector: 'X9' },
            ethernet: { chip: 'W5500', spi: 'SPI2', mosi: 11, sclk: 12, cs: 10, miso: 13, rst: 14 },
            sd_card: { spi: 'SPI3_HOST', mosi: 35, sclk: 36, cs: 38, miso: 37 },
            rtc: { chip: 'DS3231', addr: '0x68', connector: 'X7' },
            opto_inputs: { count: 6, chip: 'TLP183', mux: 'MCP23008@0x26', pins: 'GP1-GP6', connectors: 'X12' },
            lora: { module: 'E220-900T30D', interface: 'UART2', tx: 16, rx: 15, aux: 47, m0m1: 'GND (fixo PCB, modo transparente)' },
            transistor_outputs: { count: 4, chip: 'BC817', pins: [1, 2, 42, 41], connector: 'X11' },
            pwm: { count: 1, pin: 46, mosfet: 'AOD7N65', connector: 'X8' },
            analog_inputs: { count: 2, pins: [6, 7], resolution: '12bit', divider: 8.01 },
            usb: { type: 'USB-C', dn: 19, dp: 20 },
        },
        defaults: {
            name: 'TON2',
            ota_hostname: '',
            mqtt_topic_base: '',
            equipamento_id: '',
            lora_mode: 'tx',
        },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'ota_hostname', label: 'Hostname OTA', type: 'text', placeholder: 'TON2-XXX' },
            { key: 'mqtt_topic_base', label: 'Tópico Base', type: 'text', placeholder: 'PROPRIETARIO/ESTADO/PLANTA/INSTALACAO' },
            { key: '_topic_preview', label: 'Tópicos Dispositivos', type: 'topic_preview' },
            { key: 'equipamento_id', label: 'Equipamento NexOn (ID)', type: 'text', placeholder: 'CUID 26 chars — necessário para Implantar OTA' },
            { key: 'lora_mode', label: 'LoRa Modo', type: 'select', options: [['tx', 'TX (Envia)'], ['rx', 'RX (Recebe)'], ['hub', 'Hub (TX+RX)']] },
        ]
    },
    ton3: {
        label: 'TON3', category: 'controller', color: '#F59E0B',
        icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z',
        relayIcon: 'M13 10V3L4 14h7v7l9-11h-7z',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: true,
        has_lora: false,
        has_relays: true,
        description: 'RS485 + Ethernet + SD + 6 relés + 6 entradas + 4 TR + PWM + 2 AN',
        integrated: {
            mcu: 'ESP32-S3-WROOM-1-N8R2',
            i2c: { sda: 4, scl: 5 },
            rs485: { chip: 'MAX485CSA++', tx: 18, rx: 17, de_re: 8, connector: 'X9' },
            ethernet: { chip: 'W5500', spi: 'SPI2', mosi: 11, sclk: 12, cs: 10, miso: 13, rst: 14 },
            sd_card: { spi: 'SPI3_HOST', mosi: 35, sclk: 36, cs: 38, miso: 37 },
            rtc: { chip: 'DS3231', addr: '0x68', connector: 'X7' },
            opto_inputs: { count: 6, chip: 'TLP183', mux: 'MCP23008@0x26', pins: 'GP1-GP6', connectors: 'X12' },
            relays: { count: 6, driver: 'ULN2803ADW', mux: 'MCP23008@0x27', pins: 'GP1-GP6', voltage: '12V', connectors: 'X1-X6 (NA/NF)' },
            transistor_outputs: { count: 4, chip: 'BC817', pins: [1, 2, 42, 41], connector: 'X11' },
            pwm: { count: 1, pin: 46, mosfet: 'AOD7N65', connector: 'X8' },
            analog_inputs: { count: 2, pins: [6, 7], resolution: '12bit', divider: 8.01 },
            usb: { type: 'USB-C', dn: 19, dp: 20 },
        },
        defaults: {
            name: 'TON3',
            ota_hostname: '',
            mqtt_topic_base: '',
            equipamento_id: '',
        },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'ota_hostname', label: 'Hostname OTA', type: 'text', placeholder: 'TON3-XXX' },
            { key: 'mqtt_topic_base', label: 'Tópico Base', type: 'text', placeholder: 'PROPRIETARIO/ESTADO/PLANTA/INSTALACAO' },
            { key: '_topic_preview', label: 'Tópicos Dispositivos', type: 'topic_preview' },
            { key: 'equipamento_id', label: 'Equipamento NexOn (ID)', type: 'text', placeholder: 'CUID 26 chars — necessário para Implantar OTA' },
        ]
    },
    ton4: {
        label: 'TON4', category: 'controller', color: '#EC4899',
        icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z',
        antennaIcon: 'M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546',
        relayIcon: 'M13 10V3L4 14h7v7l9-11h-7z',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: true,
        has_lora: true,
        has_relays: true,
        description: 'Completo: RS485 + Ethernet + SD + LoRa + 6 relés + 6 entradas + 4 TR + PWM + 2 AN',
        integrated: {
            mcu: 'ESP32-S3-WROOM-1-N8R2',
            i2c: { sda: 4, scl: 5 },
            rs485: { chip: 'MAX485CSA++', tx: 18, rx: 17, de_re: 8, connector: 'X9' },
            ethernet: { chip: 'W5500', spi: 'SPI2', mosi: 11, sclk: 12, cs: 10, miso: 13, rst: 14 },
            sd_card: { spi: 'SPI3_HOST', mosi: 35, sclk: 36, cs: 38, miso: 37 },
            rtc: { chip: 'DS3231', addr: '0x68', connector: 'X7' },
            opto_inputs: { count: 6, chip: 'TLP183', mux: 'MCP23008@0x26', pins: 'GP1-GP6', connectors: 'X12' },
            lora: { module: 'E220-900T30D', interface: 'UART2', tx: 16, rx: 15, aux: 47, m0m1: 'GND (fixo PCB, modo transparente)' },
            relays: { count: 6, driver: 'ULN2803ADW', mux: 'MCP23008@0x27', pins: 'GP1-GP6', voltage: '12V', connectors: 'X1-X6 (NA/NF)' },
            transistor_outputs: { count: 4, chip: 'BC817', pins: [1, 2, 42, 41], connector: 'X11' },
            pwm: { count: 1, pin: 46, mosfet: 'AOD7N65', connector: 'X8' },
            analog_inputs: { count: 2, pins: [6, 7], resolution: '12bit', divider: 8.01 },
            usb: { type: 'USB-C', dn: 19, dp: 20 },
        },
        defaults: {
            name: 'TON4',
            ota_hostname: '',
            mqtt_topic_base: '',
            equipamento_id: '',
            lora_mode: 'tx',
        },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'ota_hostname', label: 'Hostname OTA', type: 'text', placeholder: 'TON4-XXX' },
            { key: 'mqtt_topic_base', label: 'Tópico Base', type: 'text', placeholder: 'PROPRIETARIO/ESTADO/PLANTA/INSTALACAO' },
            { key: '_topic_preview', label: 'Tópicos Dispositivos', type: 'topic_preview' },
            { key: 'equipamento_id', label: 'Equipamento NexOn (ID)', type: 'text', placeholder: 'CUID 26 chars — necessário para Implantar OTA' },
            { key: 'lora_mode', label: 'LoRa Modo', type: 'select', options: [['tx', 'TX (Envia)'], ['rx', 'RX (Recebe)'], ['hub', 'Hub (TX+RX)']] },
        ]
    },

    // ============================================================
    // INFRAESTRUTURA DE REDE
    // ============================================================
    wifi_router: {
        label: 'Roteador WiFi', category: 'infra', color: '#10B981',
        icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: false,
        defaults: { name: 'Router', ssid: '', password: '' },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'ssid', label: 'SSID', type: 'text' },
            { key: 'password', label: 'Senha WiFi', type: 'text' },
        ]
    },
    meter_gateway: {
        label: 'Meter Gateway A966', category: 'infra', color: '#6366F1',
        icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: false,
        defaults: { name: 'A966', ip: '', note: '' },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'ip', label: 'IP', type: 'text', placeholder: '192.168.x.x' },
            { key: 'note', label: 'Observacao', type: 'text' },
        ]
    },

    mqtt_broker: {
        label: 'Broker MQTT', category: 'infra', color: '#F97316',
        // Cloud icon
        icon: 'M2.25 15a4.5 4.5 0 014.5-4.5H6a6 6 0 0111.74-2.17A4.5 4.5 0 0121.75 13.5a4.5 4.5 0 01-4.5 4.5H6.75a4.5 4.5 0 01-4.5-4.5z',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: false,
        defaults: { name: 'Broker MQTT', ip: '72.60.158.163', port: 1883 },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'ip', label: 'IP / Host', type: 'text', placeholder: '72.60.158.163' },
            { key: 'port', label: 'Porta', type: 'number' },
        ]
    },

    // Datalogger de inversores (Sungrow WiNet-S, GoodWe Wi-Fi Kit, Huawei SmartLogger, etc)
    // Converte RS485 (inversores) -> Modbus TCP (via WiFi/Ethernet)
    inverter_datalogger: {
        label: 'Datalogger Inversor', category: 'infra', color: '#0EA5E9',
        // Antena/server icon
        icon: 'M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7M9 21v-6a2 2 0 012-2h2a2 2 0 012 2v6',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: false,
        defaults: {
            name: 'Datalogger',
            modelo: 'winet-s',
            ip: '',
            tcp_port: 502,
            timeout_ms: 2000,
        },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'modelo', label: 'Modelo', type: 'select', options: [
                ['winet-s', 'Sungrow WiNet-S'],
                ['logger1000', 'Sungrow Logger1000'],
                ['goodwe-kit', 'GoodWe Wi-Fi/LAN Kit'],
                ['huawei-smartlogger', 'Huawei SmartLogger 3000'],
                ['generico-tcp', 'Gateway RS485-TCP generico'],
            ]},
            { key: 'ip', label: 'IP na rede', type: 'text', placeholder: '192.168.1.50' },
            { key: 'tcp_port', label: 'Porta TCP', type: 'number', placeholder: '502' },
            { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '2000' },
        ]
    },

    // ============================================================
    // DISPOSITIVOS (equipamentos externos que conectam ao TON)
    // ============================================================
    inversor: {
        label: 'Inversor Solar', category: 'device', color: '#EAB308',
        icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: false,
        defaults: { name: 'Inversor', catalog_id: '', modbus_address: 1, num_mppts: 1, num_strings: 1 },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'catalog_id', label: 'Modelo', type: 'device_select', device_type: 'inversor_solar' },
            { key: 'modbus_address', label: 'Endereco Modbus', type: 'number' },
            { key: 'num_mppts', label: 'Qtd MPPTs', type: 'number', placeholder: '1-12' },
            { key: 'num_strings', label: 'Qtd Strings', type: 'number', placeholder: '1-24' },
        ]
    },
    power_meter: {
        label: 'Power Meter', category: 'device', color: '#22C55E',
        icon: 'M13 10V3L4 14h7v7l9-11h-7z',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: false,
        defaults: { name: 'Power Meter', catalog_id: '', modbus_address: 1 },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'catalog_id', label: 'Modelo', type: 'device_select', device_type: 'medidor_energia' },
            { key: 'modbus_address', label: 'Endereco Modbus', type: 'number' },
        ]
    },
    medidor_comum: {
        label: 'Medidor Concessionária', category: 'device', color: '#14B8A6',
        icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: false,
        defaults: { name: 'Medidor', catalog_id: '', modbus_address: 1 },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'catalog_id', label: 'Modelo', type: 'device_select', device_type: 'medidor_energia' },
            { key: 'modbus_address', label: 'Endereco Modbus', type: 'number' },
        ]
    },
    rele_protecao: {
        label: 'Rele Protecao', category: 'device', color: '#EF4444',
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
        ports: ['top', 'bottom', 'left', 'right'],
        generates_firmware: false,
        defaults: { name: 'Rele', catalog_id: '', modbus_address: 1 },
        fields: [
            { key: 'name', label: 'Nome', type: 'text' },
            { key: 'catalog_id', label: 'Modelo', type: 'device_select', device_type: 'rele_protecao' },
            { key: 'modbus_address', label: 'Endereco Modbus', type: 'number' },
        ]
    },
};

var CATEGORIES = [
    { id: 'controller', label: 'Controladores TON', types: ['ton1', 'ton2', 'ton3', 'ton4'] },
    { id: 'infra', label: 'Infraestrutura', types: ['wifi_router', 'mqtt_broker', 'meter_gateway', 'inverter_datalogger'] },
    { id: 'device', label: 'Dispositivos', types: ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'] },
];

var CONNECTION_STYLES = {
    rs485: { stroke: '', dasharray: '', width: 4, label: 'RS485' },
    tcp:   { stroke: '', dasharray: '', width: 4, label: 'TCP' },
    lora_radio: { stroke: '', dasharray: '8,4', width: 4, label: 'LoRa' },
    wifi:  { stroke: '', dasharray: '4,6', width: 3, label: 'WiFi' },
    ethernet: { stroke: '', dasharray: '', width: 4, label: 'RJ45' },
};

// ============================================================
// SVG NAMESPACE HELPER
// ============================================================
var SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

// ============================================================
// DIAGRAM ENGINE
// ============================================================
var DiagramEditor = class {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.components = [];
        this.connections = [];
        this.selectedId = null;
        this.connectingFrom = null;
        this.dragging = null;
        this.pan = { x: 0, y: 0 };
        this.zoom = 1;
        this.nextId = 1;
        this.onSelect = null;
        this.onChange = null;
        this.onZoomChange = null;
        this.onDblClick = null;
        this.onValidationError = null;
        this.onConnectionMenu = null;
        this.editMode = false;
        this.toolMode = 'move'; // 'move' or 'select'
        this.selectedIds = new Set();
        this._marquee = null; // {startX, startY} in diagram coords
        this._hoveredNode = null;
        this._undoStack = [];
        this._redoStack = [];
        this._maxHistory = 50;
        this._clipboard = null; // { components: [...], connections: [...] }

        this._theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        this._themeObserver = new MutationObserver(() => {
            this._theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            this._applyTheme();
            this._renderAll();
        });
        this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        this._build();
        this._bindEvents();
    }

    get T() { return THEMES[this._theme]; }

    // ---- Build SVG ----
    _build() {
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.userSelect = 'none';

        this.svg = svgEl('svg', { width: '100%', height: '100%' });
        this.svg.style.position = 'absolute';
        this.svg.style.inset = '0';
        this.svg.style.cursor = 'grab';
        this.svg.style.background = this.T.bg;

        // Defs
        const defs = svgEl('defs');

        // Grid pattern (40px) - LINE-based like NexOn
        const pat = svgEl('pattern', {
            id: 'nexon-grid', width: GRID_SIZE, height: GRID_SIZE,
            patternUnits: 'userSpaceOnUse'
        });
        const gridLineV = svgEl('line', {
            x1: GRID_SIZE, y1: '0', x2: GRID_SIZE, y2: GRID_SIZE,
            stroke: this.T.grid, 'stroke-width': '0.5'
        });
        const gridLineH = svgEl('line', {
            x1: '0', y1: GRID_SIZE, x2: GRID_SIZE, y2: GRID_SIZE,
            stroke: this.T.grid, 'stroke-width': '0.5'
        });
        pat.appendChild(gridLineV);
        pat.appendChild(gridLineH);
        this._gridLineV = gridLineV;
        this._gridLineH = gridLineH;
        defs.appendChild(pat);
        this._gridPattern = pat;

        // Selection dash animation
        const style = document.createElementNS(SVG_NS, 'style');
        style.textContent = `
            @keyframes nexon-dash { to { stroke-dashoffset: -16; } }
            .nexon-selected { animation: nexon-dash 0.6s linear infinite; }
        `;
        defs.appendChild(style);

        this.svg.appendChild(defs);

        // Main group
        this.mainGroup = svgEl('g');

        // Grid background
        this.gridRect = svgEl('rect', {
            x: '-10000', y: '-10000', width: '20000', height: '20000',
            fill: 'url(#nexon-grid)'
        });
        this.mainGroup.appendChild(this.gridRect);

        // Connections layer
        this.connectionsGroup = svgEl('g');
        this.mainGroup.appendChild(this.connectionsGroup);

        // Components layer
        this.componentsGroup = svgEl('g');
        this.mainGroup.appendChild(this.componentsGroup);

        // Labels layer (above connections and components so names are never hidden)
        this.labelsGroup = svgEl('g');
        this.mainGroup.appendChild(this.labelsGroup);

        // Temp connection line
        this.tempLine = svgEl('path', {
            stroke: '#666', 'stroke-width': '2', 'stroke-dasharray': '6,4',
            fill: 'none', display: 'none'
        });
        this.mainGroup.appendChild(this.tempLine);
        this._tempTarget = { x: 0, y: 0 };

        // Selection marquee rect
        this.marqueeRect = svgEl('rect', {
            fill: 'rgba(59,130,246,0.15)', stroke: '#3B82F6',
            'stroke-width': '1', 'stroke-dasharray': '4,3',
            display: 'none', rx: '2'
        });
        this.mainGroup.appendChild(this.marqueeRect);

        this.svg.appendChild(this.mainGroup);
        this.container.appendChild(this.svg);
        this._updateTransform();

    }

    _applyTheme() {
        this.svg.style.background = this.T.bg;
        this._gridLineV.setAttribute('stroke', this.T.grid);
        this._gridLineH.setAttribute('stroke', this.T.grid);
    }

    // ---- Events ----
    _bindEvents() {
        let isPanning = false;
        let panStart = { x: 0, y: 0 };
        let wasDragged = false;

        this.svg.addEventListener('mousedown', (e) => {
            if (e.target === this.svg || e.target === this.gridRect) {
                if (this.connectingFrom) {
                    this.connectingFrom = null;
                    this.tempLine.setAttribute('display', 'none');
                    this.svg.style.cursor = this.toolMode === 'select' ? 'default' : 'grab';
                } else if (this.toolMode === 'select' && this.editMode) {
                    // Start marquee selection
                    const rect = this.svg.getBoundingClientRect();
                    const dx = (e.clientX - rect.left - this.pan.x) / this.zoom;
                    const dy = (e.clientY - rect.top - this.pan.y) / this.zoom;
                    this._marquee = { startX: dx, startY: dy, currentX: dx, currentY: dy };
                    this.marqueeRect.setAttribute('display', '');
                    this._updateMarqueeRect();
                    if (!e.shiftKey) {
                        this.selectedIds.clear();
                        this.selectedId = null;
                    }
                    this._renderAll();
                } else {
                    isPanning = true;
                    wasDragged = false;
                    panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
                    this.svg.style.cursor = 'grabbing';
                    this._deselect();
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this._marquee) {
                const rect = this.svg.getBoundingClientRect();
                this._marquee.currentX = (e.clientX - rect.left - this.pan.x) / this.zoom;
                this._marquee.currentY = (e.clientY - rect.top - this.pan.y) / this.zoom;
                this._updateMarqueeRect();
            } else if (isPanning) {
                this.pan.x = e.clientX - panStart.x;
                this.pan.y = e.clientY - panStart.y;
                this._updateTransform();
                wasDragged = true;
            } else if (this.dragging) {
                const rect = this.svg.getBoundingClientRect();
                const x = (e.clientX - rect.left - this.pan.x) / this.zoom - this.dragging.offsetX;
                const y = (e.clientY - rect.top - this.pan.y) / this.zoom - this.dragging.offsetY;
                const snapped = this._snap(x, y);
                // Move all selected components if dragging one of the selected
                if (this.selectedIds.size > 1 && this.selectedIds.has(this.dragging.componentId)) {
                    const comp = this.components.find(c => c.id === this.dragging.componentId);
                    if (comp) {
                        const deltaX = snapped.x - comp.x;
                        const deltaY = snapped.y - comp.y;
                        if (deltaX !== 0 || deltaY !== 0) {
                            this.selectedIds.forEach(id => {
                                const c = this.components.find(c => c.id === id);
                                if (c) { c.x += deltaX; c.y += deltaY; this._renderComponent(c); }
                            });
                            this._renderConnections();
                        }
                    }
                } else {
                    const comp = this.components.find(c => c.id === this.dragging.componentId);
                    if (comp) {
                        comp.x = snapped.x;
                        comp.y = snapped.y;
                        this._renderComponent(comp);
                        this._renderConnections();
                    }
                }
                wasDragged = true;
            } else if (this.connectingFrom) {
                const rect = this.svg.getBoundingClientRect();
                this._tempTarget.x = (e.clientX - rect.left - this.pan.x) / this.zoom;
                this._tempTarget.y = (e.clientY - rect.top - this.pan.y) / this.zoom;
                const fromComp = this.components.find(c => c.id === this.connectingFrom.componentId);
                if (fromComp) {
                    const fromPos = this._getPortPos(fromComp, this.connectingFrom.port);
                    this.tempLine.setAttribute('d',
                        `M${fromPos.x},${fromPos.y} L${this._tempTarget.x},${this._tempTarget.y}`);
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (this._marquee) {
                // Finalize marquee selection
                this._selectInMarquee();
                this._marquee = null;
                this.marqueeRect.setAttribute('display', 'none');
                this._renderAll();
            }
            if (isPanning) {
                isPanning = false;
                this.svg.style.cursor = this.toolMode === 'select' ? 'default' :
                    (this.connectingFrom ? 'crosshair' : 'grab');
            }
            if (this.dragging) {
                this.dragging = null;
                if (this.onChange) this.onChange();
            }
        });

        // Zoom (scroll wheel)
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.92 : 1.08;
            const newZoom = Math.min(3, Math.max(0.2, this.zoom * delta));
            const rect = this.svg.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            this.pan.x = mx - (mx - this.pan.x) * (newZoom / this.zoom);
            this.pan.y = my - (my - this.pan.y) * (newZoom / this.zoom);
            this.zoom = newZoom;
            this._updateTransform();
            this._updateGridVisibility();
            if (this.onZoomChange) this.onZoomChange(this.zoom);
        });

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.editMode) {
                    if (this.selectedIds.size > 0) {
                        [...this.selectedIds].forEach(id => this.removeComponent(id));
                        this.selectedIds.clear();
                    } else if (this.selectedId) {
                        this.removeComponent(this.selectedId);
                    }
                }
            } else if (e.key === 'Escape') {
                if (this.connectingFrom) {
                    this.connectingFrom = null;
                    this.tempLine.setAttribute('display', 'none');
                    this.svg.style.cursor = this.toolMode === 'select' ? 'default' : 'grab';
                } else {
                    this._deselect();
                }
            } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
                e.preventDefault();
                if (this.editMode && this.undo()) {
                    if (typeof showToast === 'function') showToast('Desfazer');
                    if (typeof updateSidebarEquipList === 'function') updateSidebarEquipList();
                }
            } else if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
                       (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                if (this.editMode && this.redo()) {
                    if (typeof showToast === 'function') showToast('Refazer');
                    if (typeof updateSidebarEquipList === 'function') updateSidebarEquipList();
                }
            } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
                if (this.editMode && (this.selectedIds.size > 0 || this.selectedId)) {
                    e.preventDefault();
                    this._copySelected();
                }
            } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
                if (this.editMode && this._clipboard) {
                    e.preventDefault();
                    this._pasteClipboard();
                }
            } else if (e.key === 'm' && (e.ctrlKey || e.metaKey)) {
                if (this.editMode) {
                    e.preventDefault();
                    this._mirrorSelected();
                }
            } else if (e.key === 'v' || e.key === 'V') {
                if (typeof setToolMode === 'function') setToolMode('move');
            } else if (e.key === 's' || e.key === 'S') {
                if (this.editMode && typeof setToolMode === 'function') setToolMode('select');
            }
        });
    }

    _updateTransform() {
        this.mainGroup.setAttribute('transform',
            `translate(${this.pan.x},${this.pan.y}) scale(${this.zoom})`);
    }

    _updateMarqueeRect() {
        if (!this._marquee) return;
        const m = this._marquee;
        const x = Math.min(m.startX, m.currentX);
        const y = Math.min(m.startY, m.currentY);
        const w = Math.abs(m.currentX - m.startX);
        const h = Math.abs(m.currentY - m.startY);
        this.marqueeRect.setAttribute('x', x);
        this.marqueeRect.setAttribute('y', y);
        this.marqueeRect.setAttribute('width', w);
        this.marqueeRect.setAttribute('height', h);
    }

    _selectInMarquee() {
        if (!this._marquee) return;
        const m = this._marquee;
        const x1 = Math.min(m.startX, m.currentX);
        const y1 = Math.min(m.startY, m.currentY);
        const x2 = Math.max(m.startX, m.currentX);
        const y2 = Math.max(m.startY, m.currentY);
        this.components.forEach(c => {
            const cx = c.x + NODE_SIZE / 2;
            const cy = c.y + NODE_SIZE / 2;
            if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
                this.selectedIds.add(c.id);
            }
        });
        // Also set single selectedId to last in set for keyboard delete
        if (this.selectedIds.size === 1) {
            this.selectedId = [...this.selectedIds][0];
        } else if (this.selectedIds.size > 1) {
            this.selectedId = null;
        }
    }

    _updateGridVisibility() {
        // Grid visible only in edit mode (like NexOn)
        const show = this.editMode && this.zoom > 0.3;
        this.gridRect.setAttribute('fill', show ? 'url(#nexon-grid)' : this.T.bg);
    }

    _snap(x, y) {
        return {
            x: Math.round(x / SNAP) * SNAP,
            y: Math.round(y / SNAP) * SNAP,
        };
    }

    // ---- Component Management ----
    addComponent(type, x, y) {
        const def = COMPONENT_TYPES[type];
        if (!def) return null;
        this._pushHistory();
        const id = 'c' + (this.nextId++);
        const props = { ...def.defaults };

        // Auto-increment modbus_address for same-type devices
        if ('modbus_address' in props) {
            const sameType = this.components.filter(c => c.type === type);
            if (sameType.length > 0) {
                const maxAddr = Math.max(...sameType.map(c => parseInt(c.props.modbus_address) || 0));
                props.modbus_address = maxAddr + 1;
            }
        }

        // Auto-generate OTA hostname for controllers
        if ('ota_hostname' in props) {
            const count = this.components.filter(c => c.type === type).length;
            const suffix = count > 0 ? `-${count + 1}` : '';
            props.ota_hostname = `${props.name || type}${suffix}`.toUpperCase().replace(/\s+/g, '-');
        }

        const comp = {
            id, type,
            x: x ?? 200,
            y: y ?? 200,
            props,
        };
        this.components.push(comp);
        this._renderComponent(comp);
        if (this.onChange) this.onChange();
        return comp;
    }

    removeComponent(id) {
        this._pushHistory();
        this.connections = this.connections.filter(c => c.from.componentId !== id && c.to.componentId !== id);
        this.components = this.components.filter(c => c.id !== id);
        const el = this.componentsGroup.querySelector(`[data-id="${id}"]`);
        if (el) el.remove();
        this._renderConnections();
        if (this.selectedId === id) this._deselect();
        if (this.onChange) this.onChange();
    }

    updateComponentProps(id, props) {
        this._pushHistory();
        const comp = this.components.find(c => c.id === id);
        if (!comp) return;
        Object.assign(comp.props, props);
        this._renderComponent(comp);
        if (this.onChange) this.onChange();
    }

    // ---- Connection Management ----
    addConnection(fromId, fromPort, toId, toPort, style) {
        const exists = this.connections.find(c =>
            (c.from.componentId === fromId && c.from.port === fromPort && c.to.componentId === toId && c.to.port === toPort) ||
            (c.from.componentId === toId && c.from.port === toPort && c.to.componentId === fromId && c.to.port === fromPort)
        );
        if (exists) return;
        this._pushHistory();
        const conn = {
            id: 'conn' + (this.nextId++),
            from: { componentId: fromId, port: fromPort },
            to: { componentId: toId, port: toPort },
            style: style || 'rs485',
        };
        this.connections.push(conn);
        this._reassignModbusAddresses();
        this._renderConnections();
        if (this.onChange) this.onChange();
        return conn;
    }

    // Reassign modbus addresses based on distance from TON controller
    // Only auto-assigns devices that don't have _addr_manual flag
    _reassignModbusAddresses() {
        const tons = this.components.filter(c => c.type === 'ton1' || c.type === 'ton2' || c.type === 'ton3' || c.type === 'ton4');
        if (!tons.length) return;

        for (const ton of tons) {
            const visited = new Set();
            const queue = [{ id: ton.id, dist: 0 }];
            visited.add(ton.id);
            const devicesByType = {};

            while (queue.length) {
                const { id: curId, dist } = queue.shift();
                const neighbors = this.connections
                    .filter(c => c.from.componentId === curId || c.to.componentId === curId)
                    .map(c => c.from.componentId === curId ? c.to.componentId : c.from.componentId);

                for (const nId of neighbors) {
                    if (visited.has(nId)) continue;
                    visited.add(nId);
                    const comp = this.components.find(c => c.id === nId);
                    if (!comp) continue;
                    const def = COMPONENT_TYPES[comp.type];
                    if (def && def.category === 'device' && 'modbus_address' in comp.props) {
                        if (!devicesByType[comp.type]) devicesByType[comp.type] = [];
                        devicesByType[comp.type].push({ comp, dist: dist + 1 });
                    }
                    if (def && def.category !== 'controller') {
                        queue.push({ id: nId, dist: dist + 1 });
                    }
                }
            }

            // Assign addresses: closer to TON = lower ID
            // Skip devices with manual address (_addr_manual flag)
            for (const type of Object.keys(devicesByType)) {
                const devices = devicesByType[type].sort((a, b) => a.dist - b.dist);
                const manualAddrs = new Set(
                    devices.filter(d => d.comp.props._addr_manual).map(d => d.comp.props.modbus_address)
                );
                let nextAddr = 1;
                devices.forEach(d => {
                    if (d.comp.props._addr_manual) return; // keep manual
                    while (manualAddrs.has(nextAddr)) nextAddr++;
                    d.comp.props.modbus_address = nextAddr++;
                    this._renderComponent(d.comp);
                });
            }
        }
    }

    // Check if a modbus address conflicts with same-type siblings
    checkModbusConflict(compId, newAddress) {
        const comp = this.components.find(c => c.id === compId);
        if (!comp) return null;
        const sameType = this.components.filter(c =>
            c.type === comp.type && c.id !== compId && parseInt(c.props.modbus_address) === parseInt(newAddress)
        );
        return sameType.length > 0 ? sameType[0] : null;
    }

    removeConnection(id) {
        this._pushHistory();
        this.connections = this.connections.filter(c => c.id !== id);
        this._renderConnections();
        if (this.onChange) this.onChange();
    }

    changeConnectionStyle(id, newStyle) {
        const conn = this.connections.find(c => c.id === id);
        if (!conn) return;
        this._pushHistory();
        conn.style = newStyle;
        this._renderConnections();
        if (this.onChange) this.onChange();
    }

    /**
     * Returns which connection styles are valid for a pair of components.
     */
    _getAllowedStyles(fromId, toId) {
        const from = this.components.find(c => c.id === fromId);
        const to = this.components.find(c => c.id === toId);
        if (!from || !to) return ['rs485'];
        const types = [from.type, to.type];
        const tonTypes = ['ton1', 'ton2', 'ton3', 'ton4'];

        // TON com LoRa ↔ TON com LoRa = LoRa (TON2 e TON4 têm LoRa)
        const loraTypes = ['ton2', 'ton4'];
        if (types.every(t => loraTypes.includes(t))) return ['lora_radio'];

        // Anything ↔ Router = wifi or ethernet (RJ45)
        if (types.includes('wifi_router')) return ['wifi', 'ethernet'];

        // Router ↔ Broker = wifi or ethernet
        if (types.includes('mqtt_broker')) return ['wifi', 'ethernet'];

        // Datalogger de inversor: RS485 para inversores, TCP para TON/Router
        if (types.includes('inverter_datalogger')) {
            const other = from.type === 'inverter_datalogger' ? to.type : from.type;
            // Datalogger ↔ Inversor = RS485
            if (other === 'inversor') return ['rs485'];
            // Datalogger ↔ TON = TCP (via rede)
            if (tonTypes.includes(other)) return ['tcp'];
            // Datalogger ↔ Router = WiFi ou Ethernet
            if (other === 'wifi_router') return ['wifi', 'ethernet'];
            return ['tcp'];
        }

        // TON ↔ device = rs485 or tcp
        const deviceTypes = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];
        if (types.some(t => tonTypes.includes(t)) && types.some(t => deviceTypes.includes(t))) {
            return ['rs485', 'tcp'];
        }

        // A966 ↔ medidor = rs485
        if (types.includes('meter_gateway')) return ['rs485'];

        return ['rs485'];
    }

    // ---- Port Positions ----
    _getPortPos(comp, port) {
        const s = NODE_SIZE;
        const cx = comp.x + s / 2;
        const cy = comp.y + s / 2;
        switch (port) {
            case 'top':    return { x: cx, y: comp.y };
            case 'bottom': return { x: cx, y: comp.y + s };
            case 'left':   return { x: comp.x, y: cy };
            case 'right':  return { x: comp.x + s, y: cy };
        }
        return { x: cx, y: cy };
    }

    // ---- Rendering: Node (NexOn style - 80x80, color accent bar, icon, label) ----
    _renderComponent(comp) {
        const def = COMPONENT_TYPES[comp.type];
        const s = NODE_SIZE;
        let g = this.componentsGroup.querySelector(`[data-id="${comp.id}"]`);
        if (g) g.remove();

        g = svgEl('g', { 'data-id': comp.id });
        g.setAttribute('transform', `translate(${comp.x},${comp.y})`);
        g.style.cursor = 'pointer';

        const isSelected = comp.id === this.selectedId || this.selectedIds.has(comp.id);

        // Shadow
        const shadow = svgEl('rect', {
            x: '2', y: '2', width: s, height: s, rx: '10',
            fill: 'rgba(0,0,0,0.2)', filter: 'blur(4px)'
        });
        g.appendChild(shadow);

        // Main rect
        const rect = svgEl('rect', {
            x: '0', y: '0', width: s, height: s, rx: '10',
            fill: this.T.nodeFill,
            stroke: isSelected ? this.T.selection : this.T.nodeStroke,
            'stroke-width': isSelected ? '2.5' : '1',
        });
        if (isSelected) {
            rect.setAttribute('stroke-dasharray', '8,4');
            rect.classList.add('nexon-selected');
        }
        g.appendChild(rect);

        // Color accent bar (top, 4px)
        const accent = svgEl('rect', {
            x: '0', y: '0', width: s, height: '4', rx: '10',
            fill: def.color
        });
        // Clip to top corners only
        const clipRect = svgEl('rect', {
            x: '0', y: '0', width: s, height: '10', fill: def.color
        });
        // Simpler: just a rect at top
        const accentBar = svgEl('rect', {
            x: '1', y: '1', width: s - 2, height: '4',
            rx: '9', fill: def.color, opacity: '0.9'
        });
        g.appendChild(accentBar);

        // Icon (centered in box, like NexOn)
        const iconG = svgEl('g');
        iconG.setAttribute('transform', `translate(${s / 2 - 12},${s / 2 - 12}) scale(1)`);
        const icon = svgEl('path', {
            d: def.icon, fill: 'none', stroke: def.color,
            'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        });
        iconG.appendChild(icon);
        g.appendChild(iconG);

        // TON2 antenna — tall antenna sticking out from top of box
        if (def.has_lora) {
            const antColor = '#A855F7';
            // Antenna mast (vertical line from top of box going up)
            const mastX = s - 16;
            const mastTop = -22;
            const mast = svgEl('line', {
                x1: mastX, y1: 4, x2: mastX, y2: mastTop,
                stroke: antColor, 'stroke-width': '2', 'stroke-linecap': 'round'
            });
            g.appendChild(mast);
            // Antenna tip (small circle)
            const tip = svgEl('circle', {
                cx: mastX, cy: mastTop, r: '2.5',
                fill: antColor
            });
            g.appendChild(tip);
            // Radio waves (3 arcs emanating from tip)
            const wave1 = svgEl('path', {
                d: `M${mastX + 5},${mastTop + 2} A6,6 0 0,0 ${mastX + 5},${mastTop - 6}`,
                fill: 'none', stroke: antColor, 'stroke-width': '1.5', 'stroke-linecap': 'round', opacity: '0.8'
            });
            const wave2 = svgEl('path', {
                d: `M${mastX + 9},${mastTop + 4} A10,10 0 0,0 ${mastX + 9},${mastTop - 8}`,
                fill: 'none', stroke: antColor, 'stroke-width': '1.2', 'stroke-linecap': 'round', opacity: '0.5'
            });
            const wave3 = svgEl('path', {
                d: `M${mastX + 13},${mastTop + 6} A14,14 0 0,0 ${mastX + 13},${mastTop - 10}`,
                fill: 'none', stroke: antColor, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.3'
            });
            g.appendChild(wave1);
            g.appendChild(wave2);
            g.appendChild(wave3);

            // "LoRa" label next to antenna
            const loraLabel = svgEl('text', {
                x: mastX - 6, y: mastTop + 2, 'text-anchor': 'end',
                fill: antColor, 'font-size': '8', 'font-weight': '700',
                'font-family': 'system-ui, sans-serif', opacity: '0.9'
            });
            loraLabel.textContent = 'LoRa';
            g.appendChild(loraLabel);
        }

        // Label rendered in separate top-layer group (labelsGroup) so it's never hidden by connections
        const labelText = (comp.props.name || def.label).toUpperCase();
        const labelFontSize = 11;
        const labelW = labelText.length * 6.5 + 10;
        const labelH = 16;
        const labelY = s + 16;

        // Remove old label for this component
        const oldLabel = this.labelsGroup.querySelector(`[data-label-id="${comp.id}"]`);
        if (oldLabel) oldLabel.remove();

        const labelG = svgEl('g', { 'data-label-id': comp.id });
        labelG.setAttribute('transform', `translate(${comp.x},${comp.y})`);
        const labelBg = svgEl('rect', {
            x: s / 2 - labelW / 2, y: labelY - labelH + 3, width: labelW, height: labelH,
            rx: '4', fill: this.T.bg, opacity: '0.9'
        });
        labelG.appendChild(labelBg);
        const label = svgEl('text', {
            x: s / 2, y: labelY, 'text-anchor': 'middle',
            fill: this.T.nodeText, 'font-size': labelFontSize, 'font-weight': '600',
            'font-family': 'system-ui, sans-serif'
        });
        label.textContent = labelText;
        labelG.appendChild(label);
        this.labelsGroup.appendChild(labelG);

        // Ports (visible on hover in edit mode, always hidden in view mode)
        def.ports.forEach(port => {
            const pos = this._getPortPos({ ...comp, x: 0, y: 0 }, port);
            const portG = svgEl('g', { 'data-port': port, 'data-component': comp.id });

            // Port outer ring (larger hit area)
            const hitArea = svgEl('circle', {
                cx: pos.x, cy: pos.y, r: '12',
                fill: 'transparent', stroke: 'none'
            });
            hitArea.style.cursor = this.editMode ? 'crosshair' : 'default';
            portG.appendChild(hitArea);

            // Port circle
            const circle = svgEl('circle', {
                cx: pos.x, cy: pos.y, r: PORT_RADIUS,
                fill: this.T.port, stroke: '#FFFFFF', 'stroke-width': '2'
            });
            circle.style.transition = 'r 0.15s, opacity 0.15s';
            circle.style.opacity = this.connectingFrom ? '1' : '0';

            if (!this.editMode) {
                portG.style.display = 'none';
            }

            portG.appendChild(circle);

            // Hover effects
            portG.addEventListener('mouseenter', () => {
                circle.style.opacity = '1';
                circle.setAttribute('r', PORT_RADIUS_HOVER);
            });
            portG.addEventListener('mouseleave', () => {
                if (!this.connectingFrom) circle.style.opacity = '0';
                circle.setAttribute('r', PORT_RADIUS);
            });

            // Click to connect
            portG.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (!this.editMode) return;
                if (this.connectingFrom) {
                    if (this.connectingFrom.componentId !== comp.id) {
                        const validation = this._validateConnection(this.connectingFrom.componentId, comp.id);
                        if (validation.allowed) {
                            const style = this._guessConnectionStyle(this.connectingFrom.componentId, comp.id);
                            this.addConnection(
                                this.connectingFrom.componentId, this.connectingFrom.port,
                                comp.id, port, style
                            );
                        } else if (this.onValidationError) {
                            this.onValidationError(validation.reason);
                        }
                    }
                    this.connectingFrom = null;
                    this.tempLine.setAttribute('display', 'none');
                    this.svg.style.cursor = 'grab';
                    this._renderAll();
                } else {
                    this.connectingFrom = { componentId: comp.id, port };
                    const absPos = this._getPortPos(comp, port);
                    this.tempLine.setAttribute('d', `M${absPos.x},${absPos.y} L${absPos.x},${absPos.y}`);
                    this.tempLine.setAttribute('stroke', this.T.port);
                    this.tempLine.setAttribute('display', '');
                    this.svg.style.cursor = 'crosshair';
                    this._renderAll();
                }
            });

            g.appendChild(portG);
        });

        // Node hover: show ports in edit mode
        g.addEventListener('mouseenter', () => {
            if (!this.editMode) return;
            this._hoveredNode = comp.id;
            g.querySelectorAll('[data-port] circle:last-child').forEach(c => {
                c.style.opacity = '1';
            });
        });
        g.addEventListener('mouseleave', () => {
            this._hoveredNode = null;
            if (!this.connectingFrom) {
                g.querySelectorAll('[data-port] circle:last-child').forEach(c => {
                    c.style.opacity = '0';
                });
            }
        });

        // Drag (edit mode only)
        rect.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (this.connectingFrom) return;
            if (!this.editMode) return;

            // In select mode: toggle selection, allow drag of selected group
            if (this.toolMode === 'select') {
                if (e.shiftKey) {
                    // Shift+click toggles individual selection
                    if (this.selectedIds.has(comp.id)) {
                        this.selectedIds.delete(comp.id);
                    } else {
                        this.selectedIds.add(comp.id);
                    }
                } else if (!this.selectedIds.has(comp.id)) {
                    // Click without shift on unselected: start fresh selection
                    this.selectedIds.clear();
                    this.selectedIds.add(comp.id);
                }
                this.selectedId = comp.id;
                this._renderAll();
            } else {
                // Move mode: single select
                this.selectedIds.clear();
                this._select(comp.id);
            }

            // Save state before drag starts (for undo on move)
            this._pushHistory();
            // Start drag regardless of mode
            const svgRect = this.svg.getBoundingClientRect();
            const mx = (e.clientX - svgRect.left - this.pan.x) / this.zoom;
            const my = (e.clientY - svgRect.top - this.pan.y) / this.zoom;
            this.dragging = {
                componentId: comp.id,
                offsetX: mx - comp.x,
                offsetY: my - comp.y,
            };
        });

        // Click to select (view mode = open config)
        g.addEventListener('click', (e) => {
            if (!this.dragging) this._select(comp.id);
        });

        // Double-click to open properties (works in any mode)
        g.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (this.onDblClick) this.onDblClick(comp);
        });

        // Delete button (appears when selected in edit mode)
        if (this.editMode && isSelected) {
            const delG = svgEl('g', { 'data-delete': comp.id });
            delG.style.cursor = 'pointer';
            // Red circle at top-right corner
            const delBg = svgEl('circle', {
                cx: s + 4, cy: -4, r: '11',
                fill: '#EF4444', stroke: '#1A1A1A', 'stroke-width': '2'
            });
            delG.appendChild(delBg);
            // X icon
            const delIcon = svgEl('path', {
                d: 'M-4,-4 L4,4 M4,-4 L-4,4',
                transform: `translate(${s + 4},-4)`,
                stroke: '#FFFFFF', 'stroke-width': '2', 'stroke-linecap': 'round',
                fill: 'none'
            });
            delG.appendChild(delIcon);
            delG.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.removeComponent(comp.id);
            });
            // Hover effect
            delG.addEventListener('mouseenter', () => delBg.setAttribute('fill', '#DC2626'));
            delG.addEventListener('mouseleave', () => delBg.setAttribute('fill', '#EF4444'));
            g.appendChild(delG);
        }

        this.componentsGroup.appendChild(g);
    }

    // ---- Rendering: Connections (orthogonal routing) ----
    _renderConnections() {
        this.connectionsGroup.innerHTML = '';

        this.connections.forEach(conn => {
            const fromComp = this.components.find(c => c.id === conn.from.componentId);
            const toComp = this.components.find(c => c.id === conn.to.componentId);
            if (!fromComp || !toComp) return;

            const from = this._getPortPos(fromComp, conn.from.port);
            const to = this._getPortPos(toComp, conn.to.port);
            const cStyle = CONNECTION_STYLES[conn.style] || CONNECTION_STYLES.rs485;

            const pathD = this._calcRoute(from, conn.from.port, to, conn.to.port);

            // Hit area (wider invisible path for easier clicking)
            const hitPath = svgEl('path', {
                d: pathD, fill: 'none', stroke: 'transparent', 'stroke-width': '12'
            });
            hitPath.style.cursor = 'pointer';
            this.connectionsGroup.appendChild(hitPath);

            // Visible path
            const pathEl = svgEl('path', {
                d: pathD, fill: 'none',
                stroke: cStyle.stroke || this.T.connection,
                'stroke-width': cStyle.width,
                'stroke-linecap': 'round', 'stroke-linejoin': 'round'
            });
            if (cStyle.dasharray) pathEl.setAttribute('stroke-dasharray', cStyle.dasharray);
            pathEl.style.transition = 'stroke 0.15s';
            this.connectionsGroup.appendChild(pathEl);

            // Connection type label at midpoint
            const mid = this._pathMidpoint(from, to);
            const labelBg = svgEl('rect', {
                x: mid.x - 16, y: mid.y - 8, width: '32', height: '16',
                rx: '4', fill: this.T.nodeFill, stroke: this.T.nodeStroke, 'stroke-width': '0.5',
                opacity: '0.9'
            });
            this.connectionsGroup.appendChild(labelBg);
            const labelText = svgEl('text', {
                x: mid.x, y: mid.y + 3, 'text-anchor': 'middle',
                fill: cStyle.stroke || this.T.nodeTextSub, 'font-size': '8', 'font-weight': '600',
                'font-family': 'system-ui, sans-serif'
            });
            labelText.textContent = cStyle.label;
            this.connectionsGroup.appendChild(labelText);

            // Edit mode: click on connection to show context menu
            if (this.editMode) {
                const openConnMenu = (e) => {
                    e.stopPropagation();
                    // Get allowed styles for this connection
                    const allowed = this._getAllowedStyles(conn.from.componentId, conn.to.componentId);
                    if (this.onConnectionMenu) {
                        this.onConnectionMenu(conn, allowed, e);
                    }
                };
                hitPath.addEventListener('mousedown', (e) => { e.stopPropagation(); openConnMenu(e); });
                labelBg.addEventListener('mousedown', (e) => { e.stopPropagation(); openConnMenu(e); });
                labelText.addEventListener('mousedown', (e) => { e.stopPropagation(); openConnMenu(e); });
                hitPath.style.cursor = 'pointer';
                labelBg.style.cursor = 'pointer';
                labelText.style.cursor = 'pointer';

                // Hover highlight
                const highlight = () => { pathEl.setAttribute('stroke', this.T.connectionHover); pathEl.setAttribute('stroke-width', cStyle.width + 1); };
                const unhighlight = () => { pathEl.setAttribute('stroke', cStyle.stroke || this.T.connection); pathEl.setAttribute('stroke-width', cStyle.width); };
                hitPath.addEventListener('mouseenter', highlight);
                hitPath.addEventListener('mouseleave', unhighlight);
                labelBg.addEventListener('mouseenter', highlight);
                labelBg.addEventListener('mouseleave', unhighlight);
            } else {
                // View mode — just hover highlight
                const highlight = () => { pathEl.setAttribute('stroke', this.T.connectionHover); pathEl.setAttribute('stroke-width', cStyle.width + 1); };
                const unhighlight = () => { pathEl.setAttribute('stroke', cStyle.stroke || this.T.connection); pathEl.setAttribute('stroke-width', cStyle.width); };
                hitPath.addEventListener('mouseenter', highlight);
                hitPath.addEventListener('mouseleave', unhighlight);
            }
        });
    }

    _pathMidpoint(from, to) {
        return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    }

    _calcRoute(from, fromPort, to, toPort) {
        const off = ROUTE_OFFSET;
        let fx = from.x, fy = from.y, tx = to.x, ty = to.y;
        let fx2 = fx, fy2 = fy, tx2 = tx, ty2 = ty;

        if (fromPort === 'top') fy2 -= off;
        else if (fromPort === 'bottom') fy2 += off;
        else if (fromPort === 'left') fx2 -= off;
        else if (fromPort === 'right') fx2 += off;

        if (toPort === 'top') ty2 -= off;
        else if (toPort === 'bottom') ty2 += off;
        else if (toPort === 'left') tx2 -= off;
        else if (toPort === 'right') tx2 += off;

        const midX = (fx2 + tx2) / 2;
        const midY = (fy2 + ty2) / 2;

        if ((fromPort === 'left' || fromPort === 'right') && (toPort === 'left' || toPort === 'right')) {
            return `M${fx},${fy} L${fx2},${fy2} L${midX},${fy2} L${midX},${ty2} L${tx2},${ty2} L${tx},${ty}`;
        }
        if ((fromPort === 'top' || fromPort === 'bottom') && (toPort === 'top' || toPort === 'bottom')) {
            return `M${fx},${fy} L${fx2},${fy2} L${fx2},${midY} L${tx2},${midY} L${tx2},${ty2} L${tx},${ty}`;
        }
        // Mixed: one vertical port + one horizontal port
        const fromVertical = (fromPort === 'top' || fromPort === 'bottom');
        if (fromVertical) {
            // Source exits vertically → go to target's Y level, then horizontal
            return `M${fx},${fy} L${fx2},${fy2} L${fx2},${ty2} L${tx2},${ty2} L${tx},${ty}`;
        } else {
            // Source exits horizontally → go to target's X level, then vertical
            return `M${fx},${fy} L${fx2},${fy2} L${tx2},${fy2} L${tx2},${ty2} L${tx},${ty}`;
        }
    }

    /**
     * Validate if a connection between two components is allowed.
     * Returns { allowed: true } or { allowed: false, reason: 'message' }
     */
    _validateConnection(fromId, toId) {
        const from = this.components.find(c => c.id === fromId);
        const to = this.components.find(c => c.id === toId);
        if (!from || !to) return { allowed: false, reason: 'Componente não encontrado' };

        const types = [from.type, to.type];
        const tonTypes = ['ton1', 'ton2', 'ton3', 'ton4'];
        const deviceTypes = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];

        // Rule 1: TON to TON — only allowed if BOTH are TON2 (LoRa)
        if (types.every(t => tonTypes.includes(t))) {
            if (from.type !== 'ton2' || to.type !== 'ton2') {
                return { allowed: false, reason: 'Conexão entre TONs só é permitida entre dois TON2 (LoRa)' };
            }
        }

        // Rule 2: MQTT Broker only connects to Router WiFi
        if (types.includes('mqtt_broker')) {
            const other = from.type === 'mqtt_broker' ? to.type : from.type;
            if (other !== 'wifi_router') {
                return { allowed: false, reason: 'Broker MQTT só se conecta ao Roteador WiFi' };
            }
        }

        // Rule 3: A966 (meter_gateway) only connects to medidor_comum
        if (types.includes('meter_gateway')) {
            const other = from.type === 'meter_gateway' ? to.type : from.type;
            if (other !== 'medidor_comum') {
                return { allowed: false, reason: 'Gateway A966 só se conecta ao Medidor Concessionária' };
            }
        }

        // Rule 4: medidor_comum only connects to meter_gateway (A966)
        if (types.includes('medidor_comum')) {
            const other = from.type === 'medidor_comum' ? to.type : from.type;
            if (other !== 'meter_gateway') {
                return { allowed: false, reason: 'Medidor Concessionária só se conecta ao Gateway A966' };
            }
        }

        // Rule 5: TON connects to: Router WiFi, devices (RS485), Datalogger (TCP), or another TON2 (LoRa)
        if (types.some(t => tonTypes.includes(t))) {
            const otherType = tonTypes.includes(from.type) ? to.type : from.type;
            const allowedTargets = ['wifi_router', 'inverter_datalogger', ...deviceTypes, 'ton2'];
            if (!allowedTargets.includes(otherType)) {
                return { allowed: false, reason: 'TON se conecta a: Router WiFi, Datalogger ou dispositivos' };
            }
        }

        // Rule 6: Devices connect to TON, Datalogger, or to each other (daisy-chain RS485 série)
        // But NOT to Router/Broker directly
        if (types.some(t => deviceTypes.includes(t))) {
            const other = deviceTypes.includes(from.type) ? to.type : from.type;
            if (other === 'wifi_router' || other === 'mqtt_broker') {
                return { allowed: false, reason: 'Dispositivos não se conectam diretamente ao Router/Broker' };
            }
        }

        // Rule 7: Datalogger conecta a: Inversor (RS485), Router (WiFi/Eth), TON (TCP)
        if (types.includes('inverter_datalogger')) {
            const other = from.type === 'inverter_datalogger' ? to.type : from.type;
            const allowedTargets = ['inversor', 'wifi_router', ...tonTypes];
            if (!allowedTargets.includes(other)) {
                return { allowed: false, reason: 'Datalogger se conecta a: Inversor (RS485), Router (WiFi) ou TON (TCP)' };
            }
        }

        return { allowed: true };
    }

    _guessConnectionStyle(fromId, toId) {
        const from = this.components.find(c => c.id === fromId);
        const to = this.components.find(c => c.id === toId);
        if (!from || !to) return 'rs485';
        const types = [from.type, to.type];
        const tonTypes = ['ton1', 'ton2', 'ton3', 'ton4'];
        const deviceTypes = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];
        // TON com LoRa ↔ TON com LoRa = LoRa (TON2 e TON4)
        const loraTypes = ['ton2', 'ton4'];
        if (types.some(t => loraTypes.includes(t)) && types.every(t => tonTypes.includes(t))) return 'lora_radio';
        // Router to Broker MQTT = WiFi
        if (types.includes('mqtt_broker') && types.includes('wifi_router')) return 'wifi';
        // Datalogger ↔ Inversor = RS485
        if (types.includes('inverter_datalogger') && types.includes('inversor')) return 'rs485';
        // Datalogger ↔ TON = TCP
        if (types.includes('inverter_datalogger') && types.some(t => tonTypes.includes(t))) return 'tcp';
        // TON/anything to Router = WiFi (default, can switch to ethernet)
        if (types.includes('wifi_router')) return 'wifi';
        // TON to device = RS485 (via conversor integrado)
        if (types.some(t => tonTypes.includes(t)) && types.some(t => deviceTypes.includes(t))) return 'rs485';
        // A966 to medidor = RS485
        if (types.includes('meter_gateway') && types.includes('medidor_comum')) return 'rs485';
        return 'rs485';
    }

    _renderAll() {
        // Clear and re-render
        while (this.componentsGroup.firstChild) this.componentsGroup.removeChild(this.componentsGroup.firstChild);
        while (this.labelsGroup.firstChild) this.labelsGroup.removeChild(this.labelsGroup.firstChild);
        this.components.forEach(c => this._renderComponent(c));
        this._renderConnections();
        this._updateGridVisibility();
    }

    // ---- Selection ----
    _select(id) {
        this.selectedId = id;
        this._renderAll();
        const comp = this.components.find(c => c.id === id);
        if (this.onSelect) this.onSelect(comp || null);
    }

    _deselect() {
        this.selectedId = null;
        this.selectedIds.clear();
        this._renderAll();
        if (this.onSelect) this.onSelect(null);
    }

    // ---- Undo / Redo ----
    _snapshot() {
        return JSON.stringify({
            components: this.components.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, props: { ...c.props } })),
            connections: this.connections.map(c => ({ id: c.id, from: { ...c.from }, to: { ...c.to }, style: c.style })),
            nextId: this.nextId,
        });
    }

    _pushHistory() {
        const snap = this._snapshot();
        // Don't push if identical to current top
        if (this._undoStack.length && this._undoStack[this._undoStack.length - 1] === snap) return;
        this._undoStack.push(snap);
        if (this._undoStack.length > this._maxHistory) this._undoStack.shift();
        this._redoStack = [];
    }

    _restoreSnapshot(json) {
        const data = JSON.parse(json);
        this.components = data.components.map(c => ({ ...c, props: { ...c.props } }));
        this.connections = data.connections.map(c => ({ ...c, from: { ...c.from }, to: { ...c.to } }));
        this.nextId = data.nextId;
        this.selectedId = null;
        this.selectedIds.clear();
        this._renderAll();
        if (this.onChange) this.onChange();
    }

    undo() {
        if (!this._undoStack.length) return false;
        this._redoStack.push(this._snapshot());
        const snap = this._undoStack.pop();
        this._restoreSnapshot(snap);
        return true;
    }

    redo() {
        if (!this._redoStack.length) return false;
        this._undoStack.push(this._snapshot());
        const snap = this._redoStack.pop();
        this._restoreSnapshot(snap);
        return true;
    }

    // ---- Copy / Paste ----
    _copySelected() {
        const ids = new Set();
        if (this.selectedIds.size > 0) {
            this.selectedIds.forEach(id => ids.add(id));
        } else if (this.selectedId) {
            ids.add(this.selectedId);
        }
        if (ids.size === 0) return;

        const comps = this.components.filter(c => ids.has(c.id))
            .map(c => ({ type: c.type, x: c.x, y: c.y, props: { ...c.props }, _origId: c.id }));
        // Copy connections that are fully within selected set
        const conns = this.connections.filter(c => ids.has(c.from.componentId) && ids.has(c.to.componentId))
            .map(c => ({ from: { ...c.from }, to: { ...c.to }, style: c.style }));

        this._clipboard = { components: comps, connections: conns };
        if (typeof showToast === 'function') showToast(`Copiado (${comps.length})`);
    }

    _pasteClipboard() {
        if (!this._clipboard || !this._clipboard.components.length) return;
        this._pushHistory();

        const OFFSET = GRID_SIZE; // offset pasted items by one grid cell
        const idMap = {}; // old _origId -> new id

        // Create new components
        const newIds = [];
        this._clipboard.components.forEach(c => {
            const id = this.nextId++;
            idMap[c._origId] = id;
            this.components.push({
                id, type: c.type,
                x: c.x + OFFSET, y: c.y + OFFSET,
                props: { ...c.props, name: (c.props.name || '') }
            });
            newIds.push(id);
        });

        // Recreate connections with new IDs
        this._clipboard.connections.forEach(c => {
            const fromId = idMap[c.from.componentId];
            const toId = idMap[c.to.componentId];
            if (fromId && toId) {
                this.connections.push({
                    id: this.nextId++,
                    from: { componentId: fromId, port: c.from.port },
                    to: { componentId: toId, port: c.to.port },
                    style: c.style
                });
            }
        });

        // Update clipboard offset for consecutive pastes
        this._clipboard = {
            components: this._clipboard.components.map(c => ({ ...c, x: c.x + OFFSET, y: c.y + OFFSET })),
            connections: this._clipboard.connections
        };

        // Select pasted components
        this.selectedIds.clear();
        newIds.forEach(id => this.selectedIds.add(id));
        this.selectedId = newIds.length === 1 ? newIds[0] : null;

        this._renderAll();
        if (this.onChange) this.onChange();
        if (typeof updateSidebarEquipList === 'function') updateSidebarEquipList();
        if (typeof showToast === 'function') showToast(`Colado (${newIds.length})`);
    }

    _mirrorSelected() {
        if (!this._clipboard || !this._clipboard.components.length) {
            // If nothing in clipboard, copy first
            this._copySelected();
        }
        if (!this._clipboard || !this._clipboard.components.length) return;
        this._pushHistory();

        const comps = this._clipboard.components;
        const conns = this._clipboard.connections;

        // Find bounding box center X of copied components
        let minX = Infinity, maxX = -Infinity;
        comps.forEach(c => { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); });
        const centerX = (minX + maxX) / 2;
        const groupWidth = maxX - minX;

        // Place mirrored group to the right with a gap
        const gap = GRID_SIZE * 3;
        const offsetX = groupWidth + gap;

        const idMap = {};
        const newIds = [];

        // Mirror port horizontally
        const mirrorPort = (port) => {
            if (port === 'left') return 'right';
            if (port === 'right') return 'left';
            return port; // top/bottom unchanged
        };

        // Create mirrored components
        comps.forEach(c => {
            const id = this.nextId++;
            idMap[c._origId] = id;
            // Mirror X position relative to center, then shift right
            const mirroredX = centerX - (c.x - centerX) + offsetX;
            const snappedX = Math.round(mirroredX / GRID_SIZE) * GRID_SIZE;
            this.components.push({
                id, type: c.type,
                x: snappedX, y: c.y,
                props: { ...c.props }
            });
            newIds.push(id);
        });

        // Recreate connections with mirrored ports
        conns.forEach(c => {
            const fromId = idMap[c.from.componentId];
            const toId = idMap[c.to.componentId];
            if (fromId && toId) {
                this.connections.push({
                    id: this.nextId++,
                    from: { componentId: fromId, port: mirrorPort(c.from.port) },
                    to: { componentId: toId, port: mirrorPort(c.to.port) },
                    style: c.style
                });
            }
        });

        // Select mirrored components
        this.selectedIds.clear();
        newIds.forEach(id => this.selectedIds.add(id));
        this.selectedId = newIds.length === 1 ? newIds[0] : null;

        this._renderAll();
        if (this.onChange) this.onChange();
        if (typeof updateSidebarEquipList === 'function') updateSidebarEquipList();
        if (typeof showToast === 'function') showToast(`Espelhado (${newIds.length})`);
    }

    // ---- Zoom controls ----
    zoomTo(level) {
        const rect = this.svg.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const newZoom = Math.min(3, Math.max(0.2, level));
        this.pan.x = cx - (cx - this.pan.x) * (newZoom / this.zoom);
        this.pan.y = cy - (cy - this.pan.y) * (newZoom / this.zoom);
        this.zoom = newZoom;
        this._updateTransform();
        this._updateGridVisibility();
        if (this.onZoomChange) this.onZoomChange(this.zoom);
    }

    zoomIn() { this.zoomTo(this.zoom * 1.2); }
    zoomOut() { this.zoomTo(this.zoom / 1.2); }

    // ---- Serialization ----
    toJSON() {
        return {
            components: this.components.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, props: { ...c.props } })),
            connections: this.connections.map(c => ({ id: c.id, from: { ...c.from }, to: { ...c.to }, style: c.style })),
            pan: { ...this.pan },
            zoom: this.zoom,
            nextId: this.nextId,
        };
    }

    fromJSON(data) {
        if (!data) return;
        this.components = (data.components || []).map(c => ({ ...c, props: { ...c.props } }));
        this.connections = (data.connections || []).map(c => ({ ...c, from: { ...c.from }, to: { ...c.to } }));
        this.pan = data.pan || { x: 0, y: 0 };
        this.zoom = data.zoom || 1;
        this.nextId = data.nextId || this.components.length + this.connections.length + 1;
        this.selectedId = null;
        this._updateTransform();
        this._renderAll();
    }

    // ---- Drop from palette ----
    handleDrop(type, clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const x = (clientX - rect.left - this.pan.x) / this.zoom;
        const y = (clientY - rect.top - this.pan.y) / this.zoom;
        const snapped = this._snap(x, y);
        return this.addComponent(type, snapped.x, snapped.y);
    }

    // ---- Center view ----
    centerView() {
        const cw = this.container.clientWidth || this.svg.clientWidth || 800;
        const ch = this.container.clientHeight || this.svg.clientHeight || 600;

        if (!this.components.length) {
            this.pan = { x: 0, y: 0 };
            this.zoom = 1;
        } else {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            this.components.forEach(c => {
                minX = Math.min(minX, c.x);
                minY = Math.min(minY, c.y);
                maxX = Math.max(maxX, c.x + NODE_SIZE);
                maxY = Math.max(maxY, c.y + NODE_SIZE + 20); // +20 for label below
            });
            const contentW = maxX - minX + 120;
            const contentH = maxY - minY + 120;
            const fitZoom = Math.min(cw / contentW, ch / contentH);
            this.zoom = Math.max(0.4, Math.min(1.5, fitZoom));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            this.pan.x = cw / 2 - centerX * this.zoom;
            this.pan.y = ch / 2 - centerY * this.zoom;
        }
        this._updateTransform();
        this._updateGridVisibility();
        if (this.onZoomChange) this.onZoomChange(this.zoom);
    }

    // ---- Fullscreen toggle ----
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.closest('.diagram-wrapper')?.requestFullscreen?.() ||
            this.container.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }

    destroy() {
        this._themeObserver?.disconnect();
        this.stopSimulation();
    }

    // ================================================================
    // SIMULATION MODE - animated data flow visualization
    // ================================================================
    startSimulation() {
        if (this._simRunning) return;
        this._simRunning = true;

        // Create simulation overlay layer (above connections, below labels)
        if (!this._simGroup) {
            this._simGroup = svgEl('g');
            this._simGroup.setAttribute('class', 'sim-layer');
            // Insert after connections, before components
            this.mainGroup.insertBefore(this._simGroup, this.labelsGroup);
        }
        this._simGroup.innerHTML = '';
        this._simParticles = [];
        this._simStep = 0;

        // Build the data flow sequence from topology
        this._simFlows = this._buildSimFlows();
        this._simCycleTime = 0;
        this._simLastTime = performance.now();

        // Add glow filter for particles
        if (!this.svg.querySelector('#simGlow')) {
            const defs = this.svg.querySelector('defs') || svgEl('defs');
            if (!defs.parentNode) this.svg.insertBefore(defs, this.svg.firstChild);
            defs.innerHTML += `
                <filter id="simGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <radialGradient id="simPulse" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.6"/>
                    <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
                </radialGradient>`;
        }

        this._simRAF = requestAnimationFrame((t) => this._simTick(t));
    }

    stopSimulation() {
        this._simRunning = false;
        if (this._simRAF) cancelAnimationFrame(this._simRAF);
        if (this._simGroup) this._simGroup.innerHTML = '';
        // Remove component pulse effects
        this.componentsGroup.querySelectorAll('.sim-pulse').forEach(el => el.remove());
        this._simParticles = [];
    }

    _buildSimFlows() {
        // Find TON controllers and build sequential data flow
        const tons = this.components.filter(c => c.type === 'ton1' || c.type === 'ton2' || c.type === 'ton3' || c.type === 'ton4');
        const flows = [];

        for (const ton of tons) {
            // Find connected devices via BFS
            const devices = [];
            const visited = new Set([ton.id]);
            const queue = [ton.id];

            while (queue.length) {
                const curId = queue.shift();
                const neighbors = this.connections
                    .filter(c => c.from.componentId === curId || c.to.componentId === curId)
                    .map(c => c.from.componentId === curId
                        ? { id: c.to.componentId, conn: c }
                        : { id: c.from.componentId, conn: c });

                for (const n of neighbors) {
                    if (visited.has(n.id)) continue;
                    visited.add(n.id);
                    const comp = this.components.find(c => c.id === n.id);
                    if (!comp) continue;
                    const def = COMPONENT_TYPES[comp.type];
                    if (def?.category === 'device') {
                        devices.push({ comp, conn: n.conn });
                    }
                    if (def?.category !== 'controller') queue.push(n.id);
                }
            }

            // Find path from TON to router/wifi
            const router = this._findConnectedByType(ton.id, 'wifi_router');
            // Find path from router to broker
            const broker = router ? this._findConnectedByType(router.comp.id, 'mqtt_broker') : null;

            // Build full pipeline per device: REQ → RES → WiFi → MQTT
            const pathToRouter = router ? this._getConnectionPath(ton.id, router.comp.id) : null;
            const pathToBroker = (router && broker) ? this._getConnectionPath(router.comp.id, broker.comp.id) : null;

            for (const dev of devices) {
                const pathToDevice = this._getConnectionPath(ton.id, dev.comp.id);
                if (!pathToDevice) continue;
                const pathFromDevice = [...pathToDevice].reverse().map(s => ({ ...s, reverse: !s.reverse }));

                const steps = [
                    { segments: pathToDevice, color: '#3B82F6', label: 'REQ', pulseComp: ton.id, targetComp: dev.comp.id },
                    { segments: pathFromDevice, color: '#10B981', label: 'RES', pulseComp: dev.comp.id, targetComp: ton.id },
                ];
                if (pathToRouter) {
                    steps.push({ segments: pathToRouter, color: '#06B6D4', label: 'WiFi', pulseComp: ton.id, targetComp: router.comp.id });
                }
                if (pathToBroker) {
                    steps.push({ segments: pathToBroker, color: '#F97316', label: 'MQTT', pulseComp: router.comp.id, targetComp: broker.comp.id });
                }
                flows.push({ type: 'pipeline', steps });
            }
        }

        return flows;
    }

    _findConnectedByType(fromId, targetType) {
        const visited = new Set([fromId]);
        const queue = [fromId];
        while (queue.length) {
            const curId = queue.shift();
            const neighbors = this.connections
                .filter(c => c.from.componentId === curId || c.to.componentId === curId)
                .map(c => c.from.componentId === curId ? c.to.componentId : c.from.componentId);
            for (const nId of neighbors) {
                if (visited.has(nId)) continue;
                visited.add(nId);
                const comp = this.components.find(c => c.id === nId);
                if (!comp) continue;
                if (comp.type === targetType) return { comp };
                queue.push(nId);
            }
        }
        return null;
    }

    _getConnectionPath(fromId, toId) {
        // BFS to find path of connection segments
        const visited = new Set([fromId]);
        const queue = [{ id: fromId, path: [] }];
        while (queue.length) {
            const { id: curId, path } = queue.shift();
            const conns = this.connections.filter(c =>
                c.from.componentId === curId || c.to.componentId === curId
            );
            for (const conn of conns) {
                const otherId = conn.from.componentId === curId ? conn.to.componentId : conn.from.componentId;
                if (visited.has(otherId)) continue;
                visited.add(otherId);

                const fromComp = this.components.find(c => c.id === conn.from.componentId);
                const toComp = this.components.find(c => c.id === conn.to.componentId);
                if (!fromComp || !toComp) continue;

                const isForward = conn.from.componentId === curId;
                const from = this._getPortPos(fromComp, conn.from.port);
                const to = this._getPortPos(toComp, conn.to.port);
                const pathD = this._calcRoute(from, conn.from.port, to, conn.to.port);

                const segment = { pathD, reverse: !isForward, conn };
                const newPath = [...path, segment];

                if (otherId === toId) return newPath;
                const comp = this.components.find(c => c.id === otherId);
                const def = comp ? COMPONENT_TYPES[comp.type] : null;
                if (def && def.category !== 'controller') {
                    queue.push({ id: otherId, path: newPath });
                }
            }
        }
        return null;
    }

    _simTick(time) {
        if (!this._simRunning) return;

        const dt = time - this._simLastTime;
        this._simLastTime = time;
        this._simCycleTime += dt;

        const DUR = 800;             // ms for a particle to travel one step
        const STEP_GAP = 100;        // ms gap between steps in same pipeline
        const PIPELINE_STAGGER = 250; // ms offset between device pipelines
        const pipelines = this._simFlows;

        if (pipelines.length === 0) {
            this._simRAF = requestAnimationFrame((t) => this._simTick(t));
            return;
        }

        // Calculate total cycle duration
        const maxSteps = Math.max(...pipelines.map(p => p.steps?.length || 0));
        const pipelineDur = maxSteps * DUR + (maxSteps - 1) * STEP_GAP;
        const lastPipelineStart = (pipelines.length - 1) * PIPELINE_STAGGER;
        const totalCycle = lastPipelineStart + pipelineDur + 1200;
        const cyclePos = this._simCycleTime % totalCycle;

        // Clear
        this._simGroup.innerHTML = '';
        this.componentsGroup.querySelectorAll('.sim-pulse').forEach(el => el.remove());

        // Render each pipeline
        for (let i = 0; i < pipelines.length; i++) {
            const pipeline = pipelines[i];
            if (!pipeline.steps) continue;
            const pipeStart = i * PIPELINE_STAGGER;

            for (let s = 0; s < pipeline.steps.length; s++) {
                const stepStart = pipeStart + s * (DUR + STEP_GAP);
                const elapsed = cyclePos - stepStart;
                if (elapsed < 0 || elapsed > DUR) continue;
                this._drawFlowParticle(pipeline.steps[s], elapsed / DUR);
            }
        }

        this._simRAF = requestAnimationFrame((t) => this._simTick(t));
    }

    _drawFlowParticle(flow, progress) {
        const segs = flow.segments;
        if (!segs || !segs.length) return;
        const totalSegments = segs.length;

        // Pulse source
        if (flow.pulseComp) {
            this._addCompPulse(flow.pulseComp, flow.color, progress < 0.3 ? progress / 0.3 : 1);
        }
        // Pulse target on arrival
        if (flow.targetComp && progress > 0.85) {
            this._addCompPulse(flow.targetComp, flow.color, (progress - 0.85) / 0.15);
        }

        // Trail particles
        for (let pi = 0; pi < 3; pi++) {
            const pProgress = Math.max(0, Math.min(1, progress - pi * 0.1));
            if (pProgress <= 0) continue;
            const opacity = pi === 0 ? 1 : 0.5 - pi * 0.15;
            const radius = pi === 0 ? 5 : 3;

            const segFloat = pProgress * totalSegments;
            const segIdx = Math.min(Math.floor(segFloat), totalSegments - 1);
            const segProg = segFloat - segIdx;

            const seg = segs[segIdx];
            const pos = this._getPointOnPath(seg.pathD, seg.reverse ? 1 - segProg : segProg);
            if (!pos) continue;

            this._simGroup.appendChild(svgEl('circle', {
                cx: pos.x, cy: pos.y, r: radius + 4,
                fill: flow.color, opacity: opacity * 0.3, filter: 'url(#simGlow)'
            }));
            this._simGroup.appendChild(svgEl('circle', {
                cx: pos.x, cy: pos.y, r: radius,
                fill: flow.color, opacity: opacity,
            }));
        }

        // Label
        const segFloat = progress * totalSegments;
        const segIdx = Math.min(Math.floor(segFloat), totalSegments - 1);
        const segProg = segFloat - segIdx;
        const seg = segs[segIdx];
        const leadPos = this._getPointOnPath(seg.pathD, seg.reverse ? 1 - segProg : segProg);
        if (leadPos) {
            const label = svgEl('text', {
                x: leadPos.x, y: leadPos.y - 12, 'text-anchor': 'middle',
                fill: flow.color, 'font-size': '9', 'font-weight': '700',
                'font-family': 'system-ui, sans-serif', opacity: '0.9'
            });
            label.textContent = flow.label;
            this._simGroup.appendChild(label);
        }
    }

    _addCompPulse(compId, color, intensity) {
        const comp = this.components.find(c => c.id === compId);
        if (!comp) return;
        const g = this.componentsGroup.querySelector(`[data-id="${compId}"]`);
        if (!g) return;

        const s = NODE_SIZE;
        const pulse = svgEl('rect', {
            x: '-4', y: '-4', width: s + 8, height: s + 8, rx: '14',
            fill: 'none', stroke: color,
            'stroke-width': '2',
            opacity: String(intensity * 0.7),
        });
        pulse.classList.add('sim-pulse');
        g.appendChild(pulse);
    }

    _getPointOnPath(pathD, t) {
        // Parse path and interpolate position at t (0-1)
        const commands = pathD.match(/[ML][^ML]*/g);
        if (!commands) return null;

        const points = commands.map(cmd => {
            const nums = cmd.trim().substring(1).split(/[,\s]+/).map(Number);
            return { x: nums[0], y: nums[1] };
        });

        if (points.length < 2) return points[0] || null;

        // Calculate total length
        let totalLen = 0;
        const segments = [];
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            const len = Math.sqrt(dx * dx + dy * dy);
            segments.push({ from: points[i - 1], to: points[i], len });
            totalLen += len;
        }

        if (totalLen === 0) return points[0];

        const targetLen = t * totalLen;
        let accumulated = 0;
        for (const seg of segments) {
            if (accumulated + seg.len >= targetLen || seg === segments[segments.length - 1]) {
                const segT = seg.len === 0 ? 0 : (targetLen - accumulated) / seg.len;
                return {
                    x: seg.from.x + (seg.to.x - seg.from.x) * Math.min(1, segT),
                    y: seg.from.y + (seg.to.y - seg.from.y) * Math.min(1, segT),
                };
            }
            accumulated += seg.len;
        }
        return points[points.length - 1];
    }
}
