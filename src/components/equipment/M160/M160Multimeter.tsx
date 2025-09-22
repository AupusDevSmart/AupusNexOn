// components/equipment/M160/M160Multimeter.tsx

import { Settings, TrendingDown, TrendingUp } from "lucide-react";
import React, { useEffect, useState } from "react";
import { M160Props } from "./M160.types";

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
  name = "M-160",
  readings,
  status = "online",
  displayMode = "all",
  onConfig,
  scale = 1,
}) => {
  const [currentDisplay, setCurrentDisplay] = useState(0);

  // Rotação automática do display quando em modo "all"
  useEffect(() => {
    if (displayMode === "all") {
      const interval = setInterval(() => {
        setCurrentDisplay((prev) => (prev + 1) % 5); // 5 modos agora
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [displayMode]);

  // Renderizar displays baseado no modo
  const renderDisplays = () => {
    if (
      displayMode === "voltage" ||
      (displayMode === "all" && currentDisplay === 0)
    ) {
      return (
        <>
          <DigitalDisplay value={readings.voltage.L1} unit="V" label="L1" />
          <DigitalDisplay value={readings.voltage.L2} unit="V" label="L2" />
          <DigitalDisplay value={readings.voltage.L3} unit="V" label="L3" />
        </>
      );
    } else if (
      displayMode === "current" ||
      (displayMode === "all" && currentDisplay === 1)
    ) {
      return (
        <>
          <DigitalDisplay value={readings.current.L1} unit="A" label="L1" />
          <DigitalDisplay value={readings.current.L2} unit="A" label="L2" />
          <DigitalDisplay value={readings.current.L3} unit="A" label="L3" />
        </>
      );
    } else if (
      displayMode === "power" ||
      (displayMode === "all" && currentDisplay === 2)
    ) {
      return (
        <>
          <DigitalDisplay
            value={readings.power.active}
            unit="kW"
            label="P"
            isExport={readings.power.active && readings.power.active < 0}
          />
          <DigitalDisplay
            value={readings.power.reactive}
            unit="kVAr"
            label="Q"
          />
          <DigitalDisplay
            value={readings.power.apparent}
            unit="kVA"
            label="S"
          />
        </>
      );
    } else if (
      displayMode === "energy" ||
      (displayMode === "all" && currentDisplay === 3)
    ) {
      return (
        <>
          <DigitalDisplay
            value={readings.energy?.activeImport}
            unit="kWh"
            label="E+"
            precision={2}
          />
          <DigitalDisplay
            value={readings.energy?.activeExport}
            unit="kWh"
            label="E-"
            precision={2}
            isExport={true}
          />
          <DigitalDisplay
            value={readings.energy?.reactiveImport}
            unit="kVArh"
            label="Er+"
            precision={2}
          />
        </>
      );
    } else if (
      displayMode === "thd" ||
      (displayMode === "all" && currentDisplay === 4)
    ) {
      return (
        <>
          <DigitalDisplay
            value={readings.thd?.voltage}
            unit="%"
            label="THD V"
            precision={1}
          />
          <DigitalDisplay
            value={readings.thd?.current}
            unit="%"
            label="THD I"
            precision={1}
          />
          <DigitalDisplay
            value={readings.powerFactor}
            unit=""
            label="FP"
            precision={3}
          />
        </>
      );
    }
    return null;
  };

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
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        </div>

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
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className={`h-1 w-6 rounded ${
                  currentDisplay === index ? "bg-green-500" : "bg-gray-600"
                }`}
              />
            ))}
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
