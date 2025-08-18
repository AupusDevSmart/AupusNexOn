export interface EquipmentData {
  name: string;
  status: "online" | "offline" | "alarm";
  displayMode?: "voltage" | "current" | "power" | "all";
  readings?: {
    voltage: { L1?: number; L2?: number; L3?: number };
    current: { L1?: number; L2?: number; L3?: number };
    power: { active?: number; reactive?: number; apparent?: number };
    frequency?: number;
    powerFactor?: number;
  };
}

export interface Equipment {
  id: string;
  type: "m300" | "switch" | "breaker" | "battery";
  position: { x: number; y: number };
  data: EquipmentData;
}
