// DiagramEditor/EquipmentToolbar.tsx
import {
  Activity,
  Battery,
  Cpu,
  Gauge,
  Microchip,
  Router,
  ToggleLeft,
  Zap,
} from "lucide-react";
import React from "react";

interface EquipmentToolbarProps {
  onAddEquipment: (type: string) => void;
}

export const EquipmentToolbar: React.FC<EquipmentToolbarProps> = ({
  onAddEquipment,
}) => {
  const equipmentTypes = [
    { type: "m300", icon: Activity, label: "M-300 Multimeter" },
    { type: "m160", icon: Gauge, label: "M-160 Multimedidor" },
    { type: "a966", icon: Router, label: "A-966 Gateway IoT" },
    { type: "esp32", icon: Cpu, label: "ESP32 Controller" },
    { type: "raspberry", icon: Microchip, label: "Raspberry Pi Gateway" },
    { type: "switch", icon: ToggleLeft, label: "Switch" },
    { type: "breaker", icon: Zap, label: "Circuit Breaker" },
    { type: "battery", icon: Battery, label: "Battery" },
  ];

  return (
    <div className="bg-gray-800 p-4 border-r border-gray-700">
      <h3 className="text-white font-bold mb-4">Equipamentos</h3>
      <div className="space-y-2">
        {equipmentTypes.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => onAddEquipment(type)}
            className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white"
          >
            <Icon size={20} />
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
