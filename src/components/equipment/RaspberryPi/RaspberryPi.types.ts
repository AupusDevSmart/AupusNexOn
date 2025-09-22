// components/equipment/RaspberryPi/RaspberryPi.types.ts

export interface RaspberryProtocol {
  name: string;
  type: "input" | "output" | "bidirectional";
  status: "active" | "inactive" | "error";
  connections?: number;
  throughput?: number; // msgs/sec or MB/s
  port?: number;
  interface?: "ethernet" | "wifi" | "serial" | "usb" | "gpio";
}

export interface RaspberryBridge {
  name: string;
  source: string; // Protocolo origem
  destination: string; // Protocolo destino
  status: "bridging" | "stopped" | "error";
  messagesPerMin?: number;
  errorRate?: number; // %
  dataTransformed?: boolean;
}

export interface RaspberryReading {
  // Sistema
  system: {
    model?: string; // Pi 4, Pi Zero, etc.
    os?: string; // Raspberry Pi OS, Ubuntu, etc.
    uptime?: number; // horas
    cpu?: {
      usage: number; // %
      temperature: number; // °C
      frequency: number; // MHz
      cores: number;
    };
    memory?: {
      total: number; // MB
      used: number; // MB
      available: number; // MB
    };
    load?: {
      avg1min: number;
      avg5min: number;
      avg15min: number;
    };
  };

  // Conectividade de Rede
  connectivity: {
    ethernet: {
      status: "connected" | "disconnected" | "error";
      ip?: string;
      speed?: string; // 100Mbps, 1Gbps
      interfaces?: number; // Múltiplas interfaces ethernet
    };
    wifi: {
      status: "connected" | "disconnected" | "scanning";
      ssid?: string;
      signal?: number; // %
      ip?: string;
    };
    cellular?: {
      status: "connected" | "disconnected" | "no_signal";
      operator?: string;
      signal?: number; // %
      technology?: "4G" | "5G" | "3G";
    };
  };

  // Protocolos Suportados (Gateway)
  protocols?: RaspberryProtocol[];

  // Pontes/Bridges Ativas
  bridges?: RaspberryBridge[];

  // Interfaces de Comunicação
  interfaces?: {
    serial?: {
      rs485: { active: boolean; devices?: number };
      rs232: { active: boolean; devices?: number };
    };
    usb?: {
      devices: number;
      protocols?: string[]; // "modbus", "usb-serial", etc.
    };
    gpio?: {
      digitalInputs: number;
      digitalOutputs: number;
      i2c: { devices?: number };
      spi: { devices?: number };
    };
  };

  // Estatísticas do Gateway
  gateway?: {
    totalConnections?: number;
    activeConnections?: number;
    dataProcessed?: number; // MB processados
    messagesPerMin?: number;
    errorRate?: number; // %
    upstreamLatency?: number; // ms
    downstreamLatency?: number; // ms
  };

  // Serviços de Bridge
  services?: {
    mqtt?: { status: "running" | "stopped"; clients?: number };
    opcua?: { status: "running" | "stopped"; connections?: number };
    modbus?: { status: "running" | "stopped"; slaves?: number };
    http?: { status: "running" | "stopped"; requests?: number };
    database?: {
      status: "running" | "stopped";
      type?: "sqlite" | "mysql" | "influxdb";
    };
  };
}

export interface RaspberryProps {
  id: string;
  name?: string;
  readings: RaspberryReading;
  status?: "online" | "offline" | "alarm";
  displayMode?:
    | "system"
    | "connectivity"
    | "protocols"
    | "bridges"
    | "interfaces"
    | "gateway"
    | "all";
  onConfig?: () => void;
  scale?: number;
}

export type RaspberryStatus = "online" | "offline" | "alarm";
export type RaspberryDisplayMode =
  | "system"
  | "connectivity"
  | "protocols"
  | "bridges"
  | "interfaces"
  | "gateway"
  | "all";
