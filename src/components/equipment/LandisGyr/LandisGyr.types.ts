// components/equipment/LandisGyr/LandisGyr.types.ts

export interface LandisGyrE750Reading {
  voltage: {
    L1?: number;
    L2?: number;
    L3?: number;
    phaseAngles?: {
      L1?: number;
      L2?: number;
      L3?: number;
    };
  };
  current: {
    L1?: number;
    L2?: number;
    L3?: number;
    N?: number; // Corrente de neutro
    phaseAngles?: {
      L1?: number;
      L2?: number;
      L3?: number;
    };
  };
  energy: {
    activeImport?: number; // +A (kWh)
    activeExport?: number; // -A (kWh)
    reactiveQ1?: number; // R1 (kVArh)
    reactiveQ2?: number; // R2 (kVArh)
    reactiveQ3?: number; // R3 (kVArh)
    reactiveQ4?: number; // R4 (kVArh)
  };
  power: {
    active?: number; // Potência ativa instantânea
    reactive?: number; // Potência reativa instantânea
    apparent?: number; // Potência aparente
  };
  loadProfile?: {
    channels?: number; // 6 canais disponíveis
    interval?: number; // 15 min padrão
    depth?: number; // 3 meses mínimo
  };
  communication?: {
    moduleType?: "GSM_GPRS" | "LAN_DSL" | "PSTN";
    signalStrength?: number;
    connectionStatus?: "connected" | "disconnected" | "error";
    lastSync?: Date;
  };
  system?: {
    firmwareVersion?: string;
    moduleId?: string;
    signatureStatus?: "valid" | "invalid" | "pending";
    secondIndex?: number; // Contador de segundos
    batteryBackup?: number; // 7 dias backup
    cdo?: string; // Código do dispositivo
    sts?: number; // Status
    frame?: string; // Frame de dados
    uptime?: number; // Tempo de funcionamento
  };
  tariff?: {
    currentTariff?: number;
    tariffChanges?: number;
  };
  qualityMonitoring?: {
    voltageMonitoring?: boolean;
    currentMonitoring?: boolean;
    neutralDisconnected?: boolean;
    harmonicAccuracy?: boolean;
  };
}

export interface LandisGyrE750NavigationConfig {
  enableManualNavigation?: boolean;
  showDisplayLabel?: boolean;
  showPositionIndicator?: boolean;
  allowAutoRotationToggle?: boolean;
  customDisplayLabels?: LandisGyrE750DisplayLabels;
  showModuleInfo?: boolean; // Mostrar info dos módulos
  showSignatureStatus?: boolean; // Mostrar status da assinatura digital
}

export interface LandisGyrE750DisplayLabels {
  voltage?: string;
  current?: string;
  energy?: string;
  power?: string;
  communication?: string;
  system?: string;
  loadProfile?: string;
}

export interface LandisGyrE750NavigationCallbacks {
  onDisplayChange?: (
    displayIndex: number,
    displayMode: LandisGyrE750DisplayMode
  ) => void;
  onNavigationModeChange?: (isManual: boolean) => void;
  onNextDisplay?: (currentDisplay: number) => void;
  onPreviousDisplay?: (currentDisplay: number) => void;
  onModuleConfig?: (moduleType: string) => void;
}

export interface LandisGyrE750Props {
  id: string;
  name?: string;
  readings: LandisGyrE750Reading;
  status?: "online" | "offline" | "alarm" | "syncing";
  displayMode?: LandisGyrE750DisplayMode;
  onConfig?: () => void;
  onModuleConfig?: (moduleType: string) => void;
  scale?: number;
  navigation?: LandisGyrE750NavigationConfig;
  navigationCallbacks?: LandisGyrE750NavigationCallbacks;
  initialDisplayIndex?: number;
  autoRotationInterval?: number;
  showAdvancedDiagnostics?: boolean;
  moduleConfiguration?: {
    baseModule?: boolean;
    communicationModule?: string;
    pulseModule?: boolean;
    networkNode?: boolean;
  };
}

export type LandisGyrE750Status = "online" | "offline" | "alarm" | "syncing";
export type LandisGyrE750DisplayMode =
  | "voltage"
  | "current"
  | "energy"
  | "power"
  | "communication"
  | "system"
  | "loadProfile"
  | "all";

export interface LandisGyrE750DisplayInfo {
  mode: LandisGyrE750DisplayMode;
  label: string;
  icon: string;
  index: number;
}

export interface LandisGyrE750NavigationState {
  currentDisplayIndex: number;
  isManualMode: boolean;
  isAutoRotating: boolean;
  intervalId: NodeJS.Timeout | null;
}
