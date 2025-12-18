// src/types/equipment.ts

export interface EquipmentData {
  name: string;
  status: "online" | "offline" | "alarm";
  displayMode?:
    | "voltage"
    | "current"
    | "power"
    | "energy"
    | "thd"
    | "inputs"
    | "outputs"
    | "system"
    | "network"
    | "iot"
    | "connectivity"
    | "devices"
    | "protocols"
    | "control"
    | "bridges"
    | "interfaces"
    | "gateway"
    | "all";
  readings?: {
    // Para multímetros (M300/M160)
    voltage?: { L1?: number; L2?: number; L3?: number; LN?: number };
    current?: { L1?: number; L2?: number; L3?: number; N?: number };
    power?: {
      active?: number;
      reactive?: number;
      apparent?: number;
      import?: number;
      export?: number;
    };
    frequency?: number;
    powerFactor?: number;
    thd?: {
      voltage?: number;
      current?: number;
    };
    energy?: {
      activeImport?: number;
      activeExport?: number;
      reactiveImport?: number;
      reactiveExport?: number;
    };
    // Para gateways (A966)
    inputs?: {
      modbus?: {
        status: "connected" | "disconnected" | "error";
        devices?: number;
      };
      ssu?: {
        status: "connected" | "disconnected" | "error";
        devices?: number;
      };
      pulse?: {
        status: "connected" | "disconnected" | "error";
        devices?: number;
      };
    };
    outputs?: {
      mqttWifi?: { status: "connected" | "disconnected" | "error" };
      mqttEthernet?: { status: "connected" | "disconnected" | "error" };
    };
    systemStatus?: {
      cpu?: number;
      memory?: number;
      temperature?: number;
      uptime?: number;
      signalStrength?: number;
    };
    network?: {
      ipAddress?: string;
      macAddress?: string;
      ssid?: string;
      gateway?: string;
      connectionType?: "wifi" | "ethernet" | "both";
    };
    iotStatus?: {
      platform?: string;
      lastSync?: string;
      dataPoints?: number;
      errors?: number;
    };
    // Para ESP32 Controller
    connectivity?: {
      wifi?: {
        status: "connected" | "disconnected" | "connecting";
        ssid?: string;
        rssi?: number;
        ip?: string;
      };
      bluetooth?: {
        status: "enabled" | "disabled";
        devices?: number;
      };
      ethernet?: {
        status: "connected" | "disconnected" | "error";
        ip?: string;
        speed?: string;
        interfaces?: number;
      };
      cellular?: {
        status: "connected" | "disconnected" | "no_signal";
        operator?: string;
        signal?: number;
        technology?: "4G" | "5G" | "3G";
      };
    };
    devices?: Array<{
      name: string;
      type: "relay" | "motor" | "valve" | "pump" | "alarm" | "led" | "sensor";
      pin: number;
      status: "on" | "off" | "error" | "auto";
      value?: number;
      power?: number;
    }>;
    protocols?: {
      mqtt?: {
        status: "connected" | "disconnected" | "error";
        broker?: string;
        messages?: number;
      };
      modbus?: {
        status: "active" | "inactive" | "error";
        slaves?: number;
        requests?: number;
      };
      http?: {
        status: "active" | "inactive";
        server?: boolean;
        requests?: number;
      };
      serial?: {
        status: "active" | "inactive";
        baudRate?: number;
        protocol?: string;
      };
    };
    control?: {
      totalDevices?: number;
      activeDevices?: number;
      powerConsumption?: number;
      commandsPerMin?: number;
      errors?: number;
    };
    // Para Raspberry Pi Gateway
    system?: {
      model?: string;
      os?: string;
      uptime?: number;
      cpu?: {
        usage: number;
        temperature: number;
        frequency: number;
        cores: number;
      };
      memory?: {
        total: number;
        used: number;
        available: number;
      };
    };
    rpiProtocols?: Array<{
      name: string;
      type: "input" | "output" | "bidirectional";
      status: "active" | "inactive" | "error";
      connections?: number;
      throughput?: number;
    }>;
    bridges?: Array<{
      name: string;
      source: string;
      destination: string;
      status: "bridging" | "stopped" | "error";
      messagesPerMin?: number;
      errorRate?: number;
    }>;
    interfaces?: {
      serial?: {
        rs485?: { active: boolean; devices?: number };
        rs232?: { active: boolean; devices?: number };
      };
      usb?: {
        devices: number;
        protocols?: string[];
      };
      gpio?: {
        digitalInputs?: number;
        digitalOutputs?: number;
        i2c?: { devices?: number };
        spi?: { devices?: number };
      };
    };
    gateway?: {
      totalConnections?: number;
      activeConnections?: number;
      dataProcessed?: number;
      messagesPerMin?: number;
      errorRate?: number;
      upstreamLatency?: number;
      downstreamLatency?: number;
    };
    services?: {
      mqtt?: { status: "running" | "stopped"; clients?: number };
      opcua?: { status: "running" | "stopped"; connections?: number };
      modbus?: { status: "running" | "stopped"; slaves?: number };
      http?: { status: "running" | "stopped"; requests?: number };
      database?: { status: "running" | "stopped"; type?: string };
    };
  };
}

export type LabelPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Equipment {
  id: string;
  type: "m300" | "m160" | "landisE750" | "a966";
  position: { x: number; y: number };
  data: EquipmentData;
  labelPosition?: LabelPosition;
}
