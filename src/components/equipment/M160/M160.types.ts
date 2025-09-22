// components/equipment/M160/M160.types.ts

export interface M160Reading {
  voltage: {
    L1?: number;
    L2?: number;
    L3?: number;
    LN?: number; // Tensão de neutro
  };
  current: {
    L1?: number;
    L2?: number;
    L3?: number;
    N?: number; // Corrente de neutro
  };
  power: {
    active?: number; // Potência ativa (kW)
    reactive?: number; // Potência reativa (kVAr)
    apparent?: number; // Potência aparente (kVA)
    import?: number; // Energia importada (kWh)
    export?: number; // Energia exportada (kWh) - 4 quadrantes
  };
  frequency?: number;
  powerFactor?: number;
  thd?: {
    voltage?: number; // THD de tensão (%)
    current?: number; // THD de corrente (%)
  };
  energy?: {
    activeImport?: number; // Energia ativa importada
    activeExport?: number; // Energia ativa exportada
    reactiveImport?: number; // Energia reativa importada
    reactiveExport?: number; // Energia reativa exportada
  };
}

export interface M160Props {
  id: string;
  name?: string;
  readings: M160Reading;
  status?: "online" | "offline" | "alarm";
  displayMode?: "voltage" | "current" | "power" | "energy" | "thd" | "all";
  onConfig?: () => void;
  scale?: number;
}

export type M160Status = "online" | "offline" | "alarm";
export type M160DisplayMode =
  | "voltage"
  | "current"
  | "power"
  | "energy"
  | "thd"
  | "all";
