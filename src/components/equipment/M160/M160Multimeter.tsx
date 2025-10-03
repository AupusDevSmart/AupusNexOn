// components/equipment/M160/M160Multimeter.tsx

import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Settings,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { M160DisplayInfo, M160NavigationState, M160Props } from "./M160.types";

// Componente Display Digital
const DigitalDisplay = ({
  value,
  unit,
  label,
  precision = 1,
  isExport = false,
}: {
  value?: number;
  unit: string;
  label: string;
  precision?: number;
  isExport?: boolean;
}) => (
  <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
    <div className="text-xs text-green-400 font-mono flex items-center gap-1">
      {label}
      {isExport && <TrendingUp size={10} className="text-green-500" />}
      {value !== undefined && value < 0 && (
        <TrendingDown size={10} className="text-red-500" />
      )}
    </div>
    <div className="text-green-400 font-mono text-lg leading-tight">
      {value !== undefined ? Math.abs(value).toFixed(precision) : "---"} {unit}
    </div>
  </div>
);

// Componente LED Indicador
const StatusLED = ({
  status,
  label,
}: {
  status: "online" | "offline" | "alarm";
  label: string;
}) => {
  const colors = {
    online: "bg-green-500 shadow-green-500/50",
    offline: "bg-gray-500",
    alarm: "bg-red-500 shadow-red-500/50 animate-pulse",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${colors[status]} shadow-lg`} />
      <span className="text-xs text-gray-300">{label}</span>
    </div>
  );
};

// Indicador de Quadrante
const QuadrantIndicator = ({
  power,
}: {
  power?: { active?: number; reactive?: number };
}) => {
  const getQuadrant = () => {
    const active = power?.active || 0;
    const reactive = power?.reactive || 0;

    if (active >= 0 && reactive >= 0)
      return { quad: "Q1", color: "bg-green-500", label: "Consumo Indutivo" };
    if (active < 0 && reactive >= 0)
      return { quad: "Q2", color: "bg-blue-500", label: "Geração Indutiva" };
    if (active < 0 && reactive < 0)
      return {
        quad: "Q3",
        color: "bg-purple-500",
        label: "Geração Capacitiva",
      };
    return { quad: "Q4", color: "bg-yellow-500", label: "Consumo Capacitivo" };
  };

  const { quad, color, label } = getQuadrant();

  return (
    <div className="bg-gray-700 rounded px-2 py-1">
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-gray-400 text-xs">{quad}</span>
      </div>
      <div className="text-xs text-white truncate" title={label}>
        {label}
      </div>
    </div>
  );
};

// Componente Principal M-160
const M160Multimeter: React.FC<M160Props> = ({
  id,
  name = "M-160",
  readings,
  status = "online",
  displayMode = "all",
  onConfig,
  scale = 1,
  navigation = {},
  navigationCallbacks = {},
  initialDisplayIndex = 0,
  autoRotationInterval = 3000,
}) => {
  // Configurações padrão para navegação
  const navConfig = {
    enableManualNavigation: true,
    showDisplayLabel: true,
    showPositionIndicator: true,
    allowAutoRotationToggle: true,
    customDisplayLabels: {
      voltage: "TENSÕES",
      current: "CORRENTES",
      power: "POTÊNCIAS",
      energy: "ENERGIA",
      thd: "QUALIDADE",
    },
    ...navigation,
  };

  // Informações dos displays disponíveis
  const displayInfos: M160DisplayInfo[] = [
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
      mode: "power",
      label: navConfig.customDisplayLabels?.power || "POTÊNCIAS",
      icon: "P",
      index: 2,
    },
    {
      mode: "energy",
      label: navConfig.customDisplayLabels?.energy || "ENERGIA",
      icon: "E",
      index: 3,
    },
    {
      mode: "thd",
      label: navConfig.customDisplayLabels?.thd || "QUALIDADE",
      icon: "Q",
      index: 4,
    },
  ];

  // Estado da navegação
  const [navState, setNavState] = useState<M160NavigationState>({
    currentDisplayIndex: initialDisplayIndex || 0,
    isManualMode: true, // Inicia em modo manual
    isAutoRotating: false,
    intervalId: null,
  });

  // Função para iniciar rotação automática
  const startAutoRotation = useCallback(() => {
    if (displayMode !== "all" || navState.isManualMode) return null;

    const intervalId = setInterval(() => {
      setNavState((prev) => ({
        ...prev,
        currentDisplayIndex:
          (prev.currentDisplayIndex + 1) % displayInfos.length,
      }));
    }, autoRotationInterval);

    setNavState((prev) => ({
      ...prev,
      intervalId,
      isAutoRotating: true,
    }));

    return intervalId;
  }, [
    displayMode,
    navState.isManualMode,
    autoRotationInterval,
    displayInfos.length,
  ]);

  // Função para parar rotação automática
  const stopAutoRotation = useCallback(() => {
    if (navState.intervalId) {
      clearInterval(navState.intervalId);
      setNavState((prev) => ({
        ...prev,
        intervalId: null,
        isAutoRotating: false,
      }));
    }
  }, [navState.intervalId]);

  // Função para navegar para o próximo display
  const nextDisplay = useCallback(() => {
    const newIndex = (navState.currentDisplayIndex + 1) % displayInfos.length;

    setNavState((prev) => ({
      ...prev,
      currentDisplayIndex: newIndex,
      isManualMode: true,
      isAutoRotating: false,
    }));

    stopAutoRotation();

    // Callbacks
    navigationCallbacks.onNextDisplay?.(navState.currentDisplayIndex);
    navigationCallbacks.onDisplayChange?.(
      newIndex,
      displayInfos[newIndex].mode
    );
    navigationCallbacks.onNavigationModeChange?.(true);
  }, [
    navState.currentDisplayIndex,
    displayInfos,
    stopAutoRotation,
    navigationCallbacks,
  ]);

  // Função para navegar para o display anterior
  const previousDisplay = useCallback(() => {
    const newIndex =
      navState.currentDisplayIndex === 0
        ? displayInfos.length - 1
        : navState.currentDisplayIndex - 1;

    setNavState((prev) => ({
      ...prev,
      currentDisplayIndex: newIndex,
      isManualMode: true,
      isAutoRotating: false,
    }));

    stopAutoRotation();

    // Callbacks
    navigationCallbacks.onPreviousDisplay?.(navState.currentDisplayIndex);
    navigationCallbacks.onDisplayChange?.(
      newIndex,
      displayInfos[newIndex].mode
    );
    navigationCallbacks.onNavigationModeChange?.(true);
  }, [
    navState.currentDisplayIndex,
    displayInfos,
    stopAutoRotation,
    navigationCallbacks,
  ]);

  // Função para alternar modo automático/manual
  const toggleAutoRotation = useCallback(() => {
    if (navState.isManualMode) {
      // Volta para automático
      setNavState((prev) => ({
        ...prev,
        isManualMode: false,
      }));
      startAutoRotation();
      navigationCallbacks.onNavigationModeChange?.(false);
    } else {
      // Vai para manual
      stopAutoRotation();
      setNavState((prev) => ({
        ...prev,
        isManualMode: true,
      }));
      navigationCallbacks.onNavigationModeChange?.(true);
    }
  }, [
    navState.isManualMode,
    startAutoRotation,
    stopAutoRotation,
    navigationCallbacks,
  ]);

  // Efeito para controlar rotação automática - DESLIGADO
  // useEffect(() => {
  //   if (displayMode === "all" && !navState.isManualMode) {
  //     startAutoRotation();
  //   } else {
  //     stopAutoRotation();
  //   }

  //   return () => {
  //     if (navState.intervalId) {
  //       clearInterval(navState.intervalId);
  //     }
  //   };
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [displayMode, navState.isManualMode]);

  // Renderizar displays baseado no modo
  const renderDisplays = () => {
    const currentMode =
      displayMode === "all"
        ? displayInfos[navState.currentDisplayIndex].mode
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
      case "power":
        return (
          <>
            <DigitalDisplay
              value={readings.power.active}
              unit="W"
              label="Pa+Pb+Pc"
              isExport={readings.power.active && readings.power.active < 0}
              precision={3}
            />
            <DigitalDisplay
              value={readings.power.reactive}
              unit="VAr"
              label="qhfi"
              precision={3}
            />
            <DigitalDisplay
              value={readings.power.apparent}
              unit="VA"
              label="S"
              precision={3}
            />
          </>
        );
      case "energy":
        return (
          <>
            <DigitalDisplay
              value={readings.energy?.activeImport}
              unit="kWh"
              label="phf"
              precision={3}
            />
            <DigitalDisplay
              value={readings.energy?.activeExport}
              unit="kWh"
              label="phr"
              precision={3}
              isExport={true}
            />
            <DigitalDisplay
              value={readings.energy?.reactiveImport}
              unit="kVArh"
              label="qhfi"
              precision={3}
            />
          </>
        );
      case "thd":
        return (
          <>
            <DigitalDisplay
              value={readings.powerFactor}
              unit=""
              label="FPA"
              precision={2}
            />
            <DigitalDisplay
              value={readings.powerFactorB}
              unit=""
              label="FPB"
              precision={2}
            />
            <DigitalDisplay
              value={readings.powerFactorC}
              unit=""
              label="FPC"
              precision={2}
            />
          </>
        );
      default:
        return null;
    }
  };

  const currentDisplayInfo = displayInfos[navState.currentDisplayIndex];

  return (
    <div
      className="relative inline-block"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Corpo principal do M-160 */}
      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 shadow-xl w-64">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
          <h3 className="text-white font-bold text-sm">{name}</h3>
          <div className="flex gap-2">
            <StatusLED status={status} label="COM" />
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
                <span className="text-green-400 text-xs font-mono">
                  {currentDisplayInfo.label}
                </span>
              )}
              {navConfig.showPositionIndicator && (
                <span className="text-gray-400 text-xs">
                  ({navState.currentDisplayIndex + 1}/{displayInfos.length})
                </span>
              )}
              {navConfig.allowAutoRotationToggle && navState.isManualMode && (
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

        {/* Informações adicionais */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div className="bg-gray-700 rounded px-2 py-1">
            <span className="text-gray-400">Freq:</span>
            <span className="text-white ml-1">
              {readings.frequency?.toFixed(1) || "---"} Hz
            </span>
          </div>
          <QuadrantIndicator power={readings.power} />
        </div>

        {/* Indicador de modo de display */}
        {displayMode === "all" && (
          <div className="flex justify-center gap-1 mt-3">
            {displayInfos.map((_, index) => (
              <div
                key={index}
                className={`h-1 w-6 rounded transition-colors duration-200 ${
                  navState.currentDisplayIndex === index
                    ? "bg-green-500"
                    : "bg-gray-600"
                }`}
              />
            ))}
          </div>
        )}

        {/* Indicador de modo manual/automático */}
        {displayMode === "all" && navState.isManualMode && (
          <div className="flex justify-center mt-1">
            <span className="text-xs text-blue-400 animate-pulse">MANUAL</span>
          </div>
        )}

        {/* Indicador de modo automático ativo */}
        {displayMode === "all" &&
          navState.isAutoRotating &&
          !navState.isManualMode && (
            <div className="flex justify-center mt-1">
              <span className="text-xs text-green-400">AUTO</span>
            </div>
          )}
      </div>

      {/* Pontos de conexão */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
        <div className="flex gap-2">
          <div
            className="w-3 h-3 bg-gray-600 rounded-full border border-gray-400"
            title="L1"
          />
          <div
            className="w-3 h-3 bg-gray-600 rounded-full border border-gray-400"
            title="L2"
          />
          <div
            className="w-3 h-3 bg-gray-600 rounded-full border border-gray-400"
            title="L3"
          />
          <div
            className="w-3 h-3 bg-gray-600 rounded-full border border-gray-400"
            title="N"
          />
        </div>
      </div>

      {/* Indicador visual de medidor 4 quadrantes */}
      <div className="absolute -bottom-1 right-2">
        <div className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded font-mono">
          4Q
        </div>
      </div>
    </div>
  );
};

export default M160Multimeter;
