// components/equipment/LandisGyr/LandisGyrE750.tsx

import {
  ChevronLeft,
  ChevronRight,
  HardDrive,
  RotateCcw,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  Wifi,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LandisGyrE750DisplayInfo,
  LandisGyrE750NavigationState,
  LandisGyrE750Props,
} from "./LandisGyr.types";

// Componente Display Digital
const DigitalDisplay = ({
  value,
  unit,
  label,
  precision = 1,
  isExport = false,
  isImport = false,
}: {
  value?: number;
  unit: string;
  label: string;
  precision?: number;
  isExport?: boolean;
  isImport?: boolean;
}) => (
  <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
    <div className="text-xs text-blue-400 font-mono flex items-center gap-1">
      {label}
      {isExport && <TrendingUp size={10} className="text-red-500" />}
      {isImport && <TrendingDown size={10} className="text-green-500" />}
    </div>
    <div className="text-blue-400 font-mono text-lg leading-tight">
      {value !== undefined ? value.toFixed(precision) : "---"} {unit}
    </div>
  </div>
);

// Componente LED Indicador com status específicos do E750
const StatusLED = ({
  status,
  label,
}: {
  status: "online" | "offline" | "alarm" | "syncing";
  label: string;
}) => {
  const colors = {
    online: "bg-green-500 shadow-green-500/50",
    offline: "bg-gray-500",
    alarm: "bg-red-500 shadow-red-500/50 animate-pulse",
    syncing: "bg-yellow-500 shadow-yellow-500/50 animate-pulse",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${colors[status]} shadow-lg`} />
      <span className="text-xs text-gray-300">{label}</span>
    </div>
  );
};

// Indicador de Módulos SyM2
const ModuleIndicator = ({
  moduleConfig,
  onModuleConfig,
}: {
  moduleConfig?: {
    baseModule?: boolean;
    communicationModule?: string;
    pulseModule?: boolean;
    networkNode?: boolean;
  };
  onModuleConfig?: (moduleType: string) => void;
}) => {
  const modules = [
    {
      key: "baseModule",
      label: "BM",
      active: moduleConfig?.baseModule,
      color: "bg-blue-500",
    },
    {
      key: "communicationModule",
      label: "CM",
      active: !!moduleConfig?.communicationModule,
      color: "bg-green-500",
    },
    {
      key: "pulseModule",
      label: "IM",
      active: moduleConfig?.pulseModule,
      color: "bg-yellow-500",
    },
    {
      key: "networkNode",
      label: "PM",
      active: moduleConfig?.networkNode,
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="bg-gray-700 rounded px-2 py-1">
      <div className="text-xs text-gray-400 mb-1">Módulos SyM2</div>
      <div className="flex gap-1">
        {modules.map((module) => (
          <button
            key={module.key}
            onClick={() => onModuleConfig?.(module.key)}
            className={`w-6 h-4 rounded text-xs font-mono flex items-center justify-center transition-colors ${
              module.active
                ? `${module.color} text-white shadow-lg`
                : "bg-gray-600 text-gray-400"
            }`}
            title={`${module.label} ${module.active ? "Ativo" : "Inativo"}`}
          >
            {module.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Indicador de Assinatura Digital
const SignatureIndicator = ({
  signatureStatus,
  secondIndex,
}: {
  signatureStatus?: "valid" | "invalid" | "pending";
  secondIndex?: number;
}) => {
  const getSignatureColor = () => {
    switch (signatureStatus) {
      case "valid":
        return "text-green-400";
      case "invalid":
        return "text-red-400";
      case "pending":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="bg-gray-700 rounded px-2 py-1">
      <div className="flex items-center gap-1">
        <Shield size={12} className={getSignatureColor()} />
        <span className="text-xs text-gray-400">Assinatura</span>
      </div>
      <div className={`text-xs ${getSignatureColor()}`}>
        {signatureStatus?.toUpperCase() || "N/A"}
      </div>
      {secondIndex && (
        <div className="text-xs text-gray-400">Idx: {secondIndex}</div>
      )}
    </div>
  );
};

// Componente Principal Landis+Gyr E750
const LandisGyrE750: React.FC<LandisGyrE750Props> = ({
  id,
  name = "E750",
  readings,
  status = "online",
  displayMode = "all",
  onConfig,
  onModuleConfig,
  scale = 1,
  navigation = {},
  navigationCallbacks = {},
  initialDisplayIndex = 0,
  autoRotationInterval = 4000,
  showAdvancedDiagnostics = false,
  moduleConfiguration,
}) => {
  // Configurações padrão para navegação
  const navConfig = {
    enableManualNavigation: true,
    showDisplayLabel: true,
    showPositionIndicator: true,
    allowAutoRotationToggle: true,
    showModuleInfo: true,
    showSignatureStatus: true,
    customDisplayLabels: {
      voltage: "TENSÕES",
      current: "CORRENTES",
      energy: "ENERGIA 4Q",
      power: "POTÊNCIA",
      communication: "COMUNICAÇÃO",
      system: "SISTEMA",
      loadProfile: "PERFIL CARGA",
    },
    ...navigation,
  };

  // Informações dos displays disponíveis
  const displayInfos: LandisGyrE750DisplayInfo[] = [
    {
      mode: "voltage",
      label: navConfig.customDisplayLabels?.voltage || "TENSÕES",
      icon: "V",
      index: 0,
    },
    {
      mode: "current",
      label: navConfig.customDisplayLabels?.current || "CORRENTES",
      icon: "A",
      index: 1,
    },
    {
      mode: "energy",
      label: navConfig.customDisplayLabels?.energy || "ENERGIA 4Q",
      icon: "E",
      index: 2,
    },
    {
      mode: "power",
      label: navConfig.customDisplayLabels?.power || "POTÊNCIA",
      icon: "P",
      index: 3,
    },
    {
      mode: "communication",
      label: navConfig.customDisplayLabels?.communication || "COMUNICAÇÃO",
      icon: "C",
      index: 4,
    },
    {
      mode: "system",
      label: navConfig.customDisplayLabels?.system || "SISTEMA",
      icon: "S",
      index: 5,
    },
    {
      mode: "loadProfile",
      label: navConfig.customDisplayLabels?.loadProfile || "PERFIL CARGA",
      icon: "L",
      index: 6,
    },
  ];

  // Estado da navegação
  const [currentDisplayIndex, setCurrentDisplayIndex] = useState(initialDisplayIndex || 0);
  const [isManualMode, setIsManualMode] = useState(true); // Inicia em modo manual
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Função para parar rotação automática
  const stopAutoRotation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Função para navegar para o próximo display
  const nextDisplay = useCallback(() => {
    stopAutoRotation();
    setIsManualMode(true);
    setCurrentDisplayIndex((prev) => {
      const newIndex = (prev + 1) % displayInfos.length;
      navigationCallbacks.onNextDisplay?.(prev);
      navigationCallbacks.onDisplayChange?.(newIndex, displayInfos[newIndex].mode);
      navigationCallbacks.onNavigationModeChange?.(true);
      return newIndex;
    });
  }, [displayInfos, stopAutoRotation, navigationCallbacks]);

  // Função para navegar para o display anterior
  const previousDisplay = useCallback(() => {
    stopAutoRotation();
    setIsManualMode(true);
    setCurrentDisplayIndex((prev) => {
      const newIndex = prev === 0 ? displayInfos.length - 1 : prev - 1;
      navigationCallbacks.onPreviousDisplay?.(prev);
      navigationCallbacks.onDisplayChange?.(newIndex, displayInfos[newIndex].mode);
      navigationCallbacks.onNavigationModeChange?.(true);
      return newIndex;
    });
  }, [displayInfos, stopAutoRotation, navigationCallbacks]);

  // Função para alternar modo automático/manual
  const toggleAutoRotation = useCallback(() => {
    setIsManualMode((prev) => {
      const newManualMode = !prev;
      navigationCallbacks.onNavigationModeChange?.(newManualMode);
      if (newManualMode) {
        stopAutoRotation();
      }
      return newManualMode;
    });
  }, [navigationCallbacks, stopAutoRotation]);

  // Efeito para controlar rotação automática - DESLIGADO
  // useEffect(() => {
  //   if (displayMode !== "all" || isManualMode) {
  //     stopAutoRotation();
  //     return;
  //   }

  //   intervalRef.current = setInterval(() => {
  //     setCurrentDisplayIndex((prev) => (prev + 1) % displayInfos.length);
  //   }, autoRotationInterval);

  //   return () => {
  //     stopAutoRotation();
  //   };
  // }, [displayMode, isManualMode, autoRotationInterval, displayInfos.length, stopAutoRotation]);

  // Renderizar displays baseado no modo
  const renderDisplays = () => {
    const currentMode =
      displayMode === "all"
        ? displayInfos[currentDisplayIndex].mode
        : displayMode;

    switch (currentMode) {
      case "voltage":
        return (
          <>
            <DigitalDisplay value={readings.voltage.L1} unit="V" label="Va" />
            <DigitalDisplay value={readings.voltage.L2} unit="V" label="Vb" />
            <DigitalDisplay value={readings.voltage.L3} unit="V" label="Vc" />
          </>
        );
      case "current":
        return (
          <>
            <DigitalDisplay value={readings.current.L1} unit="A" label="Ia" />
            <DigitalDisplay value={readings.current.L2} unit="A" label="Ib" />
            <DigitalDisplay value={readings.current.L3} unit="A" label="Ic" />
          </>
        );
      case "energy":
        return (
          <>
            <DigitalDisplay
              value={readings.energy.activeImport}
              unit="kWh"
              label="phf"
              precision={3}
            />
            <DigitalDisplay
              value={readings.energy.activeExport}
              unit="kWh"
              label="phr"
              precision={3}
            />
            <DigitalDisplay
              value={readings.energy.reactiveQ1}
              unit="kVArh"
              label="qhfi"
              precision={3}
            />
          </>
        );
      case "power":
        return (
          <>
            <DigitalDisplay
              value={readings.energy.reactiveQ2}
              unit="kVArh"
              label="qhri"
              precision={3}
            />
            <DigitalDisplay
              value={readings.energy.reactiveQ3}
              unit="kVArh"
              label="qhfc"
              precision={3}
            />
            <DigitalDisplay
              value={readings.energy.reactiveQ4}
              unit="kVArh"
              label="qhrc"
              precision={3}
            />
          </>
        );
      case "communication":
        return (
          <>
            <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
              <div className="text-xs text-blue-400 font-mono flex items-center gap-1">
                <Wifi size={10} />
                Módulo: {readings.communication?.moduleType || "N/A"}
              </div>
              <div className="text-blue-400 font-mono text-sm">
                {readings.communication?.connectionStatus?.toUpperCase() ||
                  "OFFLINE"}
              </div>
            </div>
            <DigitalDisplay
              value={readings.communication?.signalStrength}
              unit="%"
              label="Sinal"
            />
            <div className="bg-black border border-gray-600 rounded px-2 py-1">
              <div className="text-xs text-blue-400 font-mono">Última Sync</div>
              <div className="text-blue-400 font-mono text-sm">
                {readings.communication?.lastSync
                  ? new Date(
                      readings.communication.lastSync
                    ).toLocaleTimeString()
                  : "N/A"}
              </div>
            </div>
          </>
        );
      case "system":
        return (
          <>
            <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
              <div className="text-xs text-blue-400 font-mono">cdo</div>
              <div className="text-blue-400 font-mono text-lg">
                {readings.system?.cdo || "---"}
              </div>
            </div>
            <DigitalDisplay
              value={readings.system?.sts}
              unit=""
              label="sts"
              precision={0}
            />
            <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
              <div className="text-xs text-blue-400 font-mono">frame</div>
              <div className="text-blue-400 font-mono text-xs">
                {readings.system?.frame || "---"}
              </div>
            </div>
          </>
        );
      case "loadProfile":
        return (
          <>
            <DigitalDisplay
              value={readings.loadProfile?.channels}
              unit="ch"
              label="Canais"
              precision={0}
            />
            <DigitalDisplay
              value={readings.loadProfile?.interval}
              unit="min"
              label="Intervalo"
              precision={0}
            />
            <DigitalDisplay
              value={readings.loadProfile?.depth}
              unit="meses"
              label="Histórico"
              precision={0}
            />
          </>
        );
      default:
        return null;
    }
  };

  const currentDisplayInfo = displayInfos[currentDisplayIndex];

  return (
    <div
      className="relative inline-block"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Corpo principal do E750 */}
      <div className="bg-gray-800 border-2 border-blue-600 rounded-lg p-4 shadow-xl w-72">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <HardDrive size={16} className="text-blue-400" />
              Landis+Gyr {name}
            </h3>
            <div className="text-xs text-blue-400">SyM2 Industrial Meter</div>
          </div>
          <div className="flex gap-2">
            <StatusLED status={status} label="SyM2" />
            {onConfig && (
              <button
                onClick={onConfig}
                className="text-gray-400 hover:text-white transition-colors"
                title="Configurações"
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Controles de Navegação */}
        {displayMode === "all" && navConfig.enableManualNavigation && (
          <div className="flex justify-between items-center mb-2 bg-gray-700 rounded px-2 py-1">
            <button
              onClick={previousDisplay}
              className="text-gray-300 hover:text-white transition-colors p-1 rounded hover:bg-gray-600"
              title="Display anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-2">
              {navConfig.showDisplayLabel && (
                <span className="text-blue-400 text-xs font-mono">
                  {currentDisplayInfo.label}
                </span>
              )}
              {navConfig.showPositionIndicator && (
                <span className="text-gray-400 text-xs">
                  ({currentDisplayIndex + 1}/{displayInfos.length})
                </span>
              )}
              {navConfig.allowAutoRotationToggle && isManualMode && (
                <button
                  onClick={toggleAutoRotation}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors p-1 rounded hover:bg-gray-600"
                  title="Reativar rotação automática"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>

            <button
              onClick={nextDisplay}
              className="text-gray-300 hover:text-white transition-colors p-1 rounded hover:bg-gray-600"
              title="Próximo display"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Display Area */}
        <div className="space-y-1 mb-3">{renderDisplays()}</div>

        {/* Informações dos Módulos e Sistema */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          {navConfig.showModuleInfo && (
            <ModuleIndicator
              moduleConfig={moduleConfiguration}
              onModuleConfig={onModuleConfig}
            />
          )}
          {navConfig.showSignatureStatus && (
            <SignatureIndicator
              signatureStatus={readings.system?.signatureStatus}
              secondIndex={readings.system?.secondIndex}
            />
          )}
        </div>

        {/* Indicador de modo de display */}
        {displayMode === "all" && (
          <div className="flex justify-center gap-1 mt-3">
            {displayInfos.map((_, index) => (
              <div
                key={index}
                className={`h-1 w-4 rounded transition-colors duration-200 ${
                  currentDisplayIndex === index
                    ? "bg-blue-500"
                    : "bg-gray-600"
                }`}
              />
            ))}
          </div>
        )}

        {/* Indicador de modo manual/automático */}
        {displayMode === "all" && isManualMode && (
          <div className="flex justify-center mt-1">
            <span className="text-xs text-blue-400 animate-pulse">MANUAL</span>
          </div>
        )}

        {/* Indicador de modo automático ativo */}
        {displayMode === "all" &&
          !isManualMode &&
          displayMode === "all" && (
            <div className="flex justify-center mt-1">
              <span className="text-xs text-green-400">AUTO SyM2</span>
            </div>
          )}
      </div>

      {/* Pontos de conexão - mais pontos para medidor industrial */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
        <div className="flex gap-1">
          <div
            className="w-2 h-2 bg-blue-600 rounded-full border border-blue-400"
            title="L1"
          />
          <div
            className="w-2 h-2 bg-blue-600 rounded-full border border-blue-400"
            title="L2"
          />
          <div
            className="w-2 h-2 bg-blue-600 rounded-full border border-blue-400"
            title="L3"
          />
          <div
            className="w-2 h-2 bg-gray-600 rounded-full border border-gray-400"
            title="N"
          />
          <div
            className="w-2 h-2 bg-yellow-600 rounded-full border border-yellow-400"
            title="ET"
          />
        </div>
      </div>

      {/* Indicador SyM2 */}
      <div className="absolute -bottom-1 right-2">
        <div className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded font-mono">
          SyM2
        </div>
      </div>

      {/* Indicador de Ethernet */}
      <div className="absolute -bottom-1 left-2">
        <div className="bg-green-600 text-white text-xs px-1 py-0.5 rounded font-mono">
          PoE
        </div>
      </div>
    </div>
  );
};

export default LandisGyrE750;
