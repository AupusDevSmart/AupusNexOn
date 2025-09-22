// src/pages/scada/DiagramEditor/DiagramEditor.tsx
import { Equipment } from "@/types/equipment";
import React, { useState } from "react";
import { DiagramCanvas } from "./DiagramCanvas";
import { EquipmentToolbar } from "./EquipmentToolbar";
import { PropertiesPanel } from "./PropertiesPanel";

export const DiagramEditor: React.FC = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAddEquipment = (type: string) => {
    // Dados base para todos os equipamentos
    const baseData = {
      name: `${type.toUpperCase()}-01`,
      status: "online" as const,
      displayMode: "all" as const,
    };

    // Dados específicos para cada tipo de equipamento
    let equipmentReadings = {};

    if (type === "m300") {
      equipmentReadings = {
        voltage: { L1: 220, L2: 220, L3: 220 },
        current: { L1: 10, L2: 10, L3: 10 },
        power: { active: 5, reactive: 2, apparent: 5.4 },
        frequency: 60,
        powerFactor: 0.92,
      };
    } else if (type === "m160") {
      equipmentReadings = {
        voltage: { L1: 220.5, L2: 219.8, L3: 221.2, LN: 127.3 },
        current: { L1: 15.2, L2: 14.8, L3: 15.5, N: 2.1 },
        power: {
          active: -8.5, // Negativo = gerando energia
          reactive: 3.2,
          apparent: 9.1,
          import: 0,
          export: 8.5,
        },
        frequency: 60.02,
        powerFactor: 0.95,
        thd: {
          voltage: 2.1,
          current: 4.8,
        },
        energy: {
          activeImport: 1234.56,
          activeExport: 567.89,
          reactiveImport: 234.12,
          reactiveExport: 89.45,
        },
      };
    } else if (type === "a966") {
      equipmentReadings = {
        inputs: {
          modbus: { status: "connected", devices: 3 },
          ssu: { status: "connected", devices: 1 },
          pulse: { status: "disconnected", devices: 0 },
        },
        outputs: {
          mqttWifi: { status: "connected" },
          mqttEthernet: { status: "disconnected" },
        },
        systemStatus: {
          cpu: 45,
          memory: 62,
          temperature: 38,
          uptime: 168.5,
          signalStrength: 85,
        },
        network: {
          ipAddress: "192.168.1.100",
          ssid: "IndustrialNet",
          connectionType: "wifi",
        },
        iotStatus: {
          platform: "AWS IoT",
          lastSync: "2min ago",
          dataPoints: 1247,
          errors: 0,
        },
      };
    } else if (type === "esp32") {
      equipmentReadings = {
        connectivity: {
          wifi: {
            status: "connected",
            ssid: "IndustrialNet",
            rssi: -45,
            ip: "192.168.1.150",
          },
          bluetooth: {
            status: "enabled",
            devices: 2,
          },
        },
        systemStatus: {
          cpu: 35,
          memory: 180, // KB livres
          temperature: 42,
          uptime: 72.3,
        },
        devices: [
          { name: "Bomba1", type: "pump", pin: 2, status: "on", power: 750 },
          { name: "Valv1", type: "valve", pin: 4, status: "on", power: 24 },
          { name: "Alarm", type: "alarm", pin: 5, status: "off", power: 0 },
          {
            name: "Motor1",
            type: "motor",
            pin: 18,
            status: "auto",
            power: 1100,
          },
        ],
        protocols: {
          mqtt: {
            status: "connected",
            broker: "broker.hivemq.com",
            messages: 45,
          },
          modbus: {
            status: "active",
            slaves: 3,
            requests: 12,
          },
          http: {
            status: "active",
            server: true,
            requests: 8,
          },
          serial: {
            status: "active",
            baudRate: 9600,
            protocol: "RS485",
          },
        },
        control: {
          totalDevices: 4,
          activeDevices: 3,
          powerConsumption: 1874, // W
          commandsPerMin: 28,
          errors: 0,
        },
      };
    } else if (type === "raspberry") {
      equipmentReadings = {
        system: {
          model: "Pi 4 Model B",
          os: "Raspberry Pi OS",
          uptime: 312.5, // horas
          cpu: {
            usage: 28,
            temperature: 45.2,
            frequency: 1800,
            cores: 4,
          },
          memory: {
            total: 4096, // MB
            used: 1250,
            available: 2846,
          },
        },
        connectivity: {
          ethernet: {
            status: "connected",
            ip: "192.168.1.200",
            speed: "1Gbps",
            interfaces: 1,
          },
          wifi: {
            status: "connected",
            ssid: "IndustrialNet_5G",
            signal: 78,
            ip: "192.168.1.201",
          },
          cellular: {
            status: "connected",
            operator: "Vivo",
            signal: 85,
            technology: "4G",
          },
        },
        rpiProtocols: [
          {
            name: "MQTT",
            type: "bidirectional",
            status: "active",
            connections: 12,
            throughput: 45.2,
          },
          {
            name: "Modbus TCP",
            type: "input",
            status: "active",
            connections: 8,
            throughput: 12.3,
          },
          {
            name: "OPC-UA",
            type: "output",
            status: "active",
            connections: 3,
            throughput: 8.7,
          },
          {
            name: "HTTP API",
            type: "bidirectional",
            status: "active",
            connections: 15,
            throughput: 67.1,
          },
        ],
        bridges: [
          {
            name: "Modbus2MQTT",
            source: "Modbus",
            destination: "MQTT",
            status: "bridging",
            messagesPerMin: 120,
            errorRate: 0.5,
          },
          {
            name: "OPC2HTTP",
            source: "OPC-UA",
            destination: "HTTP",
            status: "bridging",
            messagesPerMin: 45,
            errorRate: 0.2,
          },
          {
            name: "Serial2TCP",
            source: "RS485",
            destination: "TCP",
            status: "bridging",
            messagesPerMin: 78,
            errorRate: 1.1,
          },
        ],
        interfaces: {
          serial: {
            rs485: { active: true, devices: 6 },
            rs232: { active: true, devices: 2 },
          },
          usb: {
            devices: 3,
            protocols: ["USB-Serial", "HID"],
          },
          gpio: {
            digitalInputs: 8,
            digitalOutputs: 6,
            i2c: { devices: 4 },
            spi: { devices: 2 },
          },
        },
        gateway: {
          totalConnections: 38,
          activeConnections: 34,
          dataProcessed: 125.7, // MB
          messagesPerMin: 243,
          errorRate: 0.8, // %
          upstreamLatency: 12, // ms
          downstreamLatency: 8, // ms
        },
        services: {
          mqtt: { status: "running", clients: 12 },
          opcua: { status: "running", connections: 3 },
          modbus: { status: "running", slaves: 8 },
          http: { status: "running", requests: 156 },
          database: { status: "running", type: "InfluxDB" },
        },
      };
    }

    const newEquipment: Equipment = {
      id: `${type}-${Date.now()}`,
      type: type as Equipment["type"],
      position: { x: 100, y: 100 },
      data: {
        ...baseData,
        readings: equipmentReadings,
      },
    };

    setEquipment([...equipment, newEquipment]);
    setSelectedId(newEquipment.id);
  };

  const handleEquipmentMove = (
    id: string,
    position: { x: number; y: number }
  ) => {
    setEquipment(
      equipment.map((eq) => (eq.id === id ? { ...eq, position } : eq))
    );
  };

  const handleUpdateEquipment = (id: string, updates: Partial<Equipment>) => {
    setEquipment(
      equipment.map((eq) => (eq.id === id ? { ...eq, ...updates } : eq))
    );
  };

  const selectedEquipment = equipment.find((eq) => eq.id === selectedId);

  return (
    <div className="flex h-screen bg-gray-900">
      <div className="w-64">
        <EquipmentToolbar onAddEquipment={handleAddEquipment} />
      </div>

      <div className="flex-1">
        <DiagramCanvas
          equipment={equipment}
          onEquipmentMove={handleEquipmentMove}
          onEquipmentClick={setSelectedId}
          selectedId={selectedId}
        />
      </div>

      <div className="w-80">
        <PropertiesPanel
          selectedEquipment={selectedEquipment}
          onUpdateEquipment={handleUpdateEquipment}
        />
      </div>
    </div>
  );
};
