import { Equipment } from "@/types/equipment";
import React, { useState } from "react";
import { DiagramCanvas } from "./DiagramCanvas";
import { EquipmentToolbar } from "./EquipmentToolbar";
import { PropertiesPanel } from "./PropertiesPanel";

export const DiagramEditor: React.FC = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAddEquipment = (type: string) => {
    const newEquipment: Equipment = {
      id: `${type}-${Date.now()}`,
      type: type as Equipment["type"],
      position: { x: 100, y: 100 },
      data: {
        name: `${type.toUpperCase()}-01`,
        status: "online",
        displayMode: "all",
        readings: {
          voltage: { L1: 220, L2: 220, L3: 220 },
          current: { L1: 10, L2: 10, L3: 10 },
          power: { active: 5, reactive: 2, apparent: 5.4 },
          frequency: 60,
          powerFactor: 0.92,
        },
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
