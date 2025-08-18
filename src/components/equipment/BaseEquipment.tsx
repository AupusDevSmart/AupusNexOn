// components/equipment/BaseEquipment.tsx
import React from "react";

export interface Connection {
  from: string;
  to: string;
  type: "power" | "signal" | "ground";
}

export interface BaseEquipmentProps {
  id: string;
  type: "multimeter" | "switch" | "converter" | "battery" | "inverter";
  position: { x: number; y: number };
  data?: Record<string, unknown>;
  connections?: Connection[];
  onClick?: () => void;
  onDragEnd?: (position: { x: number; y: number }) => void;
}

//Deixando pronto base para possíveis futuros equipamentos
export const BaseEquipment: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <>{children}</>;
};
