// components/equipment/A966/A966.types.ts

export interface A966Communication {
  protocol: "modbus" | "ssu" | "pulse" | "mqtt";
  interface: "rs485" | "ttl" | "wifi" | "ethernet";
  status: "connected" | "disconnected" | "error";
  baudRate?: number;
  devices?: number; // Número de dispositivos conectados
  dataRate?: number; // Taxa de dados (kbps)
  messagesPerMinute?: number; // Mensagens por minuto
}

export interface A966Reading {
  // Protocolos de entrada
  inputs: {
    modbus?: A966Communication;
    ssu?: A966Communication; // NBR-14522 ABNT
    pulse?: A966Communication;
  };
  // Protocolos de saída
  outputs: {
    mqttWifi?: A966Communication;
    mqttEthernet?: A966Communication;
  };
  systemStatus: {
    cpu?: number; // Uso de CPU (%)
    memory?: number; // Uso de memória (%)
    temperature?: number; // Temperatura interna (°C) - Opera -10°C a 60°C
    uptime?: number; // Tempo de funcionamento (horas)
    signalStrength?: number; // Força do sinal WiFi (%)
    firmwareVersion?: string; // Versão do firmware
    serialNumber?: string; // Número de série
  };
  network: {
    ipAddress?: string;
    macAddress?: string;
    ssid?: string; // Nome da rede WiFi
    gateway?: string;
    connectionType: "wifi" | "ethernet" | "both";
  };
  iotStatus: {
    platform?: string; // Nome da plataforma IoT
    lastSync?: string; // Última sincronização
    dataPoints?: number; // Pontos de dados enviados
    errors?: number; // Erros de envio
  };
}

export interface A966Props {
  id: string;
  name?: string;
  readings: A966Reading;
  status?: "online" | "offline" | "alarm";
  displayMode?: "inputs" | "outputs" | "system" | "network" | "iot" | "all";
  onConfig?: () => void;
  scale?: number;
}

export type A966Status = "online" | "offline" | "alarm";
export type A966DisplayMode =
  | "inputs"
  | "outputs"
  | "system"
  | "network"
  | "iot"
  | "all";
