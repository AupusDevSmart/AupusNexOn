// src/pages/scada/DiagramEditor/DiagramEditor.tsx
import { Equipment } from "@/types/equipment";
import React, { useState } from "react";
import { DiagramCanvas } from "./DiagramCanvas";
import { EquipmentToolbar } from "./EquipmentToolbar";
import { PropertiesPanel } from "./PropertiesPanel";

export const DiagramEditor: React.FC = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  console.log("🔄 DiagramEditor render:", {
    equipmentCount: equipment.length,
    selectedId,
    equipmentIds: equipment.map(e => e.id)
  });

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
    } else if (type === "landisE750") {
      equipmentReadings = {
        voltage: { L1: 220.8, L2: 221.5, L3: 219.2 },
        current: { L1: 18.5, L2: 17.8, L3: 18.9, N: 1.2 },
        energy: {
          activeImport: 2456.78,
          activeExport: 1234.56,
          reactiveQ1: 567.89,
          reactiveQ2: 234.12,
          reactiveQ3: 123.45,
          reactiveQ4: 89.67,
        },
        power: {
          active: 12.8,
          reactive: 4.2,
          apparent: 13.5,
        },
        communication: {
          moduleType: "GSM_GPRS" as const,
          signalStrength: 85,
          connectionStatus: "connected" as const,
          lastSync: new Date(),
        },
        system: {
          firmwareVersion: "v2.1.4",
          moduleId: "E750-001",
          signatureStatus: "valid" as const,
          secondIndex: 1634567,
          batteryBackup: 7,
        },
        loadProfile: {
          channels: 6,
          interval: 15,
          depth: 3,
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
    console.log("➕ Equipamento adicionado:", newEquipment.id);
  };

  const handleEquipmentMove = (
    id: string,
    position: { x: number; y: number }
  ) => {
    setEquipment(
      equipment.map((eq) => (eq.id === id ? { ...eq, position } : eq))
    );
  };

  const handleEquipmentClick = (id: string) => {
    console.log("🖱️ Equipamento clicado:", id);
    console.log("📋 Estado atual selectedId ANTES:", selectedId);
    setSelectedId(id);
    console.log("✅ setSelectedId chamado com:", id);
  };

  const handleUpdateEquipment = (id: string, updates: Partial<Equipment>) => {
    console.log("🔧 Atualizando equipamento:", id, updates);
    setEquipment(
      equipment.map((eq) => (eq.id === id ? { ...eq, ...updates } : eq))
    );
  };

  const selectedEquipment = equipment.find((eq) => eq.id === selectedId);
  console.log("🎯 selectedEquipment encontrado:", selectedEquipment ? selectedEquipment.id : "NENHUM");

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* Toolbar Esquerda - Equipamentos */}
      <div className="w-64 flex-shrink-0">
        <EquipmentToolbar onAddEquipment={handleAddEquipment} />
      </div>

      {/* Canvas Central - Diagrama */}
      <div className="flex-1 min-w-0">
        <DiagramCanvas
          equipment={equipment}
          onEquipmentMove={handleEquipmentMove}
          onEquipmentClick={handleEquipmentClick}
          selectedId={selectedId}
        />
      </div>

      {/* Painel Direita - Propriedades */}
      <div className="w-80 flex-shrink-0 h-full overflow-y-auto bg-gray-800">
        <PropertiesPanel
          selectedEquipment={selectedEquipment}
          onUpdateEquipment={handleUpdateEquipment}
        />
      </div>
    </div>
  );
};
