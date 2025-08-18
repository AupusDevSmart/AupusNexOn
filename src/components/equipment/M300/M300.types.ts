export interface M300Reading {
  voltage: { L1?: number; L2?: number; L3?: number };
  current: { L1?: number; L2?: number; L3?: number };
  power: { active?: number; reactive?: number; apparent?: number };
  frequency?: number;
  powerFactor?: number;
}

export interface M300Props {
  id: string;
  name?: string;
  readings: M300Reading;
  status?: "online" | "offline" | "alarm";
  displayMode?: "voltage" | "current" | "power" | "all";
  onConfig?: () => void;
  scale?: number;
  position?: { x: number; y: number };
  onDragEnd?: (position: { x: number; y: number }) => void;
}
