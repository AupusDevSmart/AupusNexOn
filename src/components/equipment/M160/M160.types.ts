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

// Configurações para navegação manual
export interface M160NavigationConfig {
  enableManualNavigation?: boolean; // Habilita botões de navegação manual
  showDisplayLabel?: boolean; // Mostra rótulo do display atual
  showPositionIndicator?: boolean; // Mostra contador (X/5)
  allowAutoRotationToggle?: boolean; // Permite alternar entre manual/automático
  customDisplayLabels?: M160DisplayLabels; // Rótulos personalizados para displays
}

// Rótulos personalizáveis para cada display
export interface M160DisplayLabels {
  voltage?: string;
  current?: string;
  power?: string;
  energy?: string;
  thd?: string;
}

// Callbacks para eventos de navegação
export interface M160NavigationCallbacks {
  onDisplayChange?: (
    displayIndex: number,
    displayMode: M160DisplayMode
  ) => void;
  onNavigationModeChange?: (isManual: boolean) => void;
  onNextDisplay?: (currentDisplay: number) => void;
  onPreviousDisplay?: (currentDisplay: number) => void;
}

export interface M160Props {
  id: string;
  name?: string;
  readings: M160Reading;
  status?: "online" | "offline" | "alarm";
  displayMode?: "voltage" | "current" | "power" | "energy" | "thd" | "all";
  onConfig?: () => void;
  scale?: number;

  // Novas props para navegação
  navigation?: M160NavigationConfig;
  navigationCallbacks?: M160NavigationCallbacks;

  // Controle inicial do display (para modo manual)
  initialDisplayIndex?: number;
  autoRotationInterval?: number; // Intervalo em ms (padrão: 3000)
}

export type M160Status = "online" | "offline" | "alarm";
export type M160DisplayMode =
  | "voltage"
  | "current"
  | "power"
  | "energy"
  | "thd"
  | "all";

// Informações sobre cada display disponível
export interface M160DisplayInfo {
  mode: M160DisplayMode;
  label: string;
  icon: string;
  index: number;
}

// Estado interno do componente para navegação
export interface M160NavigationState {
  currentDisplayIndex: number;
  isManualMode: boolean;
  isAutoRotating: boolean;
  intervalId: NodeJS.Timeout | null;
}
