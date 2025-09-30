import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import { M300Props } from "./M300.types";

// Componente Display Digital
const DigitalDisplay = ({
  value,
  unit,
  label,
  precision = 1,
}: {
  value?: number;
  unit: string;
  label: string;
  precision?: number;
}) => (
  <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
    <div className="text-xs text-green-400 font-mono">{label}</div>
    <div className="text-green-400 font-mono text-lg leading-tight">
      {value !== undefined ? value.toFixed(precision) : "---"} {unit}
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

// Componente Principal M-300
const M300Multimeter: React.FC<M300Props> = ({
  name = "M-300",
  readings,
  status = "online",
  displayMode = "all",
  onConfig,
  scale = 1,
}) => {
  const [currentDisplay, setCurrentDisplay] = useState(0);
  const [manualMode, setManualMode] = useState(false);

  const displayModes = [
    { index: 0, label: "TENSÕES (1/3)", mode: "voltage" },
    { index: 1, label: "CORRENTES (2/3)", mode: "current" },
    { index: 2, label: "POTÊNCIAS (3/3)", mode: "power" },
  ];

  // Rotação automática do display quando em modo "all" e não manual
  useEffect(() => {
    if (displayMode === "all" && !manualMode) {
      const interval = setInterval(() => {
        setCurrentDisplay((prev) => (prev + 1) % 3);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [displayMode, manualMode]);

  // Navegação manual
  const handlePrevious = () => {
    setManualMode(true);
    setCurrentDisplay((prev) => (prev - 1 + 3) % 3);
  };

  const handleNext = () => {
    setManualMode(true);
    setCurrentDisplay((prev) => (prev + 1) % 3);
  };

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
          <DigitalDisplay value={readings.power.active} unit="kW" label="P" />
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
    }
  };

  return (
    <div
      className="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 shadow-xl"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        width: "256px",
      }}
    >
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

      {/* Barra de Navegação */}
      <div className="flex justify-between items-center mb-2 bg-gray-700 rounded px-2 py-1">
        <button
          onClick={handlePrevious}
          className="text-green-400 hover:text-green-300 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-green-400 text-xs font-mono">
          {displayModes[currentDisplay].label}
        </span>
        <button
          onClick={handleNext}
          className="text-green-400 hover:text-green-300 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Display Area */}
      <div className="space-y-1 mb-3">{renderDisplays()}</div>

      {/* Info Bar */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div className="bg-gray-700 rounded px-2 py-1">
          <span className="text-gray-400">Freq:</span>
          <span className="text-white ml-1">
            {readings.frequency.toFixed(2)} Hz
          </span>
        </div>
        <div className="bg-gray-700 rounded px-2 py-1">
          <span className="text-gray-400">FP:</span>
          <span className="text-white ml-1">
            {readings.powerFactor.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex justify-center gap-1 mt-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`h-1 w-6 rounded transition-colors duration-200 ${
              index === currentDisplay ? "bg-green-500" : "bg-gray-600"
            }`}
          />
        ))}
      </div>

      <div className="flex justify-center mt-1">
        <span className="text-xs text-green-400">
          {manualMode ? "MANUAL" : "AUTO"}
        </span>
      </div>
    </div>
  );
};

export default M300Multimeter;
