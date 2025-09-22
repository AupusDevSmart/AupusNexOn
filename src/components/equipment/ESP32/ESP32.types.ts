// components/equipment/ESP32/ESP32.types.ts

export interface ESP32GPIO {
  pin: number;
  mode: "input" | "output" | "analog" | "pwm";
  value: number | boolean;
  label?: string;
  device?: string; // Nome do dispositivo conectado
}

export interface ESP32Device {
  name: string;
  type: "relay" | "motor" | "valve" | "pump" | "alarm" | "led" | "sensor";
  pin: number;
  status: "on" | "off" | "error" | "auto";
  value?: number; // Para PWM, analog, etc.
  power?: number; // Consumo em W
}

export interface ESP32Reading {
  // Conectividade/Gateway
  connectivity: {
    wifi: {
      status: "connected" | "disconnected" | "connecting";
      ssid?: string;
      rssi?: number; // Força do sinal (-100 a 0 dBm)
      ip?: string;
    };
    bluetooth: {
      status: "enabled" | "disabled";
      devices?: number; // Dispositivos BLE conectados
    };
  };

  // Sistema
  system: {
    cpu?: number; // Uso de CPU (%)
    memory?: number; // Memória livre (KB)
    temperature?: number; // Temperatura interna (°C)
    uptime?: number; // Tempo funcionamento (horas)
    voltage?: number; // Tensão de alimentação (V)
    frequency?: number; // Frequência CPU (MHz)
  };

  // Controle de Dispositivos
  devices?: ESP32Device[];

  // Protocolos Gateway
  protocols: {
    mqtt?: {
      status: "connected" | "disconnected" | "error";
      broker?: string;
      messages?: number; // Mensagens/min
      topics?: number;
    };
    modbus?: {
      status: "active" | "inactive" | "error";
      slaves?: number; // Dispositivos Modbus
      requests?: number; // Requests/min
    };
    http?: {
      status: "active" | "inactive";
      server?: boolean;
      requests?: number; // Requests/min
    };
    serial?: {
      status: "active" | "inactive";
      baudRate?: number;
      protocol?: "RS485" | "RS232" | "TTL";
    };
  };

  // Status dos GPIOs para monitoramento
  gpios?: ESP32GPIO[];

  // Estatísticas de controle
  control?: {
    totalDevices?: number;
    activeDevices?: number;
    powerConsumption?: number; // Consumo total em W
    commandsPerMin?: number;
    errors?: number;
  };
}

export interface ESP32Props {
  id: string;
  name?: string;
  readings: ESP32Reading;
  status?: "online" | "offline" | "alarm";
  displayMode?:
    | "connectivity"
    | "system"
    | "devices"
    | "protocols"
    | "control"
    | "all";
  onConfig?: () => void;
  scale?: number;
}

export type ESP32Status = "online" | "offline" | "alarm";
export type ESP32DisplayMode =
  | "connectivity"
  | "system"
  | "devices"
  | "protocols"
  | "control"
  | "all";
