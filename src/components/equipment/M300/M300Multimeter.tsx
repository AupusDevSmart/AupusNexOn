import { Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import { M300Props, M300Reading } from "./M300.types";

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

  // Rotação automática do display quando em modo "all"
  useEffect(() => {
    if (displayMode === "all") {
      const interval = setInterval(() => {
        setCurrentDisplay((prev) => (prev + 1) % 3);
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
    return null;
  };

  return (
    <div
      className="relative inline-block"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Corpo principal do M-300 */}
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
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-700 rounded px-2 py-1">
            <span className="text-gray-400">Freq:</span>
            <span className="text-white ml-1">
              {readings.frequency?.toFixed(1) || "---"} Hz
            </span>
          </div>
          <div className="bg-gray-700 rounded px-2 py-1">
            <span className="text-gray-400">FP:</span>
            <span className="text-white ml-1">
              {readings.powerFactor?.toFixed(2) || "---"}
            </span>
          </div>
        </div>

        {/* Indicador de modo de display */}
        {displayMode === "all" && (
          <div className="flex justify-center gap-1 mt-3">
            <div
              className={`h-1 w-8 rounded ${
                currentDisplay === 0 ? "bg-green-500" : "bg-gray-600"
              }`}
            />
            <div
              className={`h-1 w-8 rounded ${
                currentDisplay === 1 ? "bg-green-500" : "bg-gray-600"
              }`}
            />
            <div
              className={`h-1 w-8 rounded ${
                currentDisplay === 2 ? "bg-green-500" : "bg-gray-600"
              }`}
            />
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
    </div>
  );
};

export default M300Multimeter;

// Demo com múltiplas configurações
export function M300Demo() {
  const [config, setConfig] = useState({
    displayMode: "all" as "voltage" | "current" | "power" | "all",
    status: "online" as "online" | "offline" | "alarm",
  });

  // Dados simulados
  const readings: M300Reading = {
    voltage: { L1: 220.5, L2: 219.8, L3: 221.2 },
    current: { L1: 15.2, L2: 14.8, L3: 15.5 },
    power: { active: 10.5, reactive: 3.2, apparent: 11.0 },
    frequency: 60.02,
    powerFactor: 0.95,
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-2xl font-bold text-white mb-8">
        M-300 Multimeter Component
      </h1>

      {/* Controles */}
      <div className="mb-8 bg-gray-800 p-4 rounded-lg">
        <h2 className="text-white font-bold mb-4">Configurações</h2>
        <div className="flex gap-4">
          <select
            className="bg-gray-700 text-white px-3 py-2 rounded"
            value={config.displayMode}
            onChange={(e) =>
              setConfig({
                ...config,
                displayMode: e.target.value as
                  | "voltage"
                  | "current"
                  | "power"
                  | "all",
              })
            }
          >
            <option value="all">Todos (Rotativo)</option>
            <option value="voltage">Tensão</option>
            <option value="current">Corrente</option>
            <option value="power">Potência</option>
          </select>

          <select
            className="bg-gray-700 text-white px-3 py-2 rounded"
            value={config.status}
            onChange={(e) =>
              setConfig({
                ...config,
                status: e.target.value as "online" | "offline" | "alarm",
              })
            }
          >
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="alarm">Alarme</option>
          </select>
        </div>
      </div>

      {/* Demonstração */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div>
          <h3 className="text-white mb-4">Tamanho Normal</h3>
          <M300Multimeter
            id="m300-1"
            name="M300-01"
            readings={readings}
            status={config.status}
            displayMode={config.displayMode}
            onConfig={() => alert("Configurar M300-01")}
          />
        </div>

        <div>
          <h3 className="text-white mb-4">Tamanho Reduzido</h3>
          <M300Multimeter
            id="m300-2"
            name="M300-02"
            readings={readings}
            status={config.status}
            displayMode={config.displayMode}
            scale={0.8}
          />
        </div>

        <div>
          <h3 className="text-white mb-4">Sem Dados</h3>
          <M300Multimeter
            id="m300-3"
            name="M300-03"
            readings={{
              voltage: {},
              current: {},
              power: {},
            }}
            status="offline"
            displayMode={config.displayMode}
          />
        </div>
      </div>
    </div>
  );
}
