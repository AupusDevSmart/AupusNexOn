// components/equipment/A966/A966Gateway.tsx

import {
  Cable,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Settings,
  Wifi,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { A966Props } from "./A966.types";

// Componente Display Digital para Gateway
const GatewayDisplay = ({
  value,
  unit,
  label,
  precision = 1,
  status,
}: {
  value?: number | string;
  unit?: string;
  label: string;
  precision?: number;
  status?: "connected" | "disconnected" | "error" | "online" | "offline";
}) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "connected":
      case "online":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "disconnected":
      case "offline":
        return "text-gray-500";
      default:
        return "text-green-400";
    }
  };

  return (
    <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
      <div className="text-xs text-green-400 font-mono">{label}</div>
      <div
        className={`font-mono text-lg leading-tight ${getStatusColor(status)}`}
      >
        {typeof value === "number" && value !== undefined
          ? `${value.toFixed(precision)}${unit ? ` ${unit}` : ""}`
          : value || "---"}
      </div>
    </div>
  );
};

// Componente LED Indicador
const StatusLED = ({
  status,
  label,
}: {
  status:
    | "online"
    | "offline"
    | "alarm"
    | "connected"
    | "disconnected"
    | "error";
  label: string;
}) => {
  const colors = {
    online: "bg-green-500 shadow-green-500/50",
    connected: "bg-green-500 shadow-green-500/50",
    offline: "bg-gray-500",
    disconnected: "bg-gray-500",
    alarm: "bg-red-500 shadow-red-500/50 animate-pulse",
    error: "bg-red-500 shadow-red-500/50 animate-pulse",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${colors[status]} shadow-lg`} />
      <span className="text-xs text-gray-300">{label}</span>
    </div>
  );
};

// Componente Principal A-966
const A966Gateway: React.FC<A966Props> = ({
  name = "A-966",
  readings,
  status = "online",
  displayMode = "all",
  onConfig,
  scale = 1,
}) => {
  const [currentDisplay, setCurrentDisplay] = useState(0);
  const [manualMode, setManualMode] = useState(false);

  const displayModes = [
    { index: 0, label: "ENTRADAS (1/5)", mode: "inputs" },
    { index: 1, label: "SAÍDAS (2/5)", mode: "outputs" },
    { index: 2, label: "SISTEMA (3/5)", mode: "system" },
    { index: 3, label: "REDE (4/5)", mode: "network" },
    { index: 4, label: "IoT (5/5)", mode: "iot" },
  ];

  // Rotação automática do display quando em modo "all" e não manual
  useEffect(() => {
    if (displayMode === "all" && !manualMode) {
      const interval = setInterval(() => {
        setCurrentDisplay((prev) => (prev + 1) % 5);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [displayMode, manualMode]);

  // Navegação manual
  const handlePrevious = () => {
    setManualMode(true);
    setCurrentDisplay((prev) => (prev - 1 + 5) % 5);
  };

  const handleNext = () => {
    setManualMode(true);
    setCurrentDisplay((prev) => (prev + 1) % 5);
  };

  // Renderizar displays baseado no modo
  const renderDisplays = () => {
    if (
      displayMode === "inputs" ||
      (displayMode === "all" && currentDisplay === 0)
    ) {
      return (
        <>
          <GatewayDisplay
            value={readings.inputs.modbus ? "MODBUS/RS485" : "---"}
            label="Entrada 1"
            status={readings.inputs.modbus?.status}
          />
          <GatewayDisplay
            value={readings.inputs.ssu ? "SSU/RS485" : "---"}
            label="Entrada 2"
            status={readings.inputs.ssu?.status}
          />
          <GatewayDisplay
            value={readings.inputs.modbus?.devices || 0}
            unit="devices"
            label="Dispositivos"
          />
        </>
      );
    } else if (
      displayMode === "outputs" ||
      (displayMode === "all" && currentDisplay === 1)
    ) {
      return (
        <>
          <GatewayDisplay
            value="MQTT/WiFi"
            label="Saída 1"
            status={readings.outputs.mqttWifi?.status}
          />
          <GatewayDisplay
            value="MQTT/ETH"
            label="Saída 2"
            status={readings.outputs.mqttEthernet?.status}
          />
          <GatewayDisplay
            value={readings.iotStatus?.platform || "---"}
            label="Plataforma"
          />
        </>
      );
    } else if (
      displayMode === "system" ||
      (displayMode === "all" && currentDisplay === 2)
    ) {
      return (
        <>
          <GatewayDisplay
            value={readings.systemStatus?.cpu}
            unit="%"
            label="CPU"
          />
          <GatewayDisplay
            value={readings.systemStatus?.memory}
            unit="%"
            label="Memória"
          />
          <GatewayDisplay
            value={readings.systemStatus?.temperature}
            unit="°C"
            label="Temperatura"
          />
        </>
      );
    } else if (
      displayMode === "network" ||
      (displayMode === "all" && currentDisplay === 3)
    ) {
      return (
        <>
          <GatewayDisplay
            value={readings.network.ipAddress || "---"}
            label="IP Address"
          />
          <GatewayDisplay
            value={readings.network.ssid || "---"}
            label="WiFi SSID"
          />
          <GatewayDisplay
            value={readings.network.connectionType?.toUpperCase() || "---"}
            label="Conexão"
          />
        </>
      );
    } else if (
      displayMode === "iot" ||
      (displayMode === "all" && currentDisplay === 4)
    ) {
      return (
        <>
          <GatewayDisplay
            value={readings.iotStatus?.platform || "---"}
            label="Plataforma"
          />
          <GatewayDisplay
            value={
              readings.systemStatus?.uptime
                ? `${Math.floor(readings.systemStatus.uptime / 24)}d`
                : "---"
            }
            label="Uptime"
          />
          <GatewayDisplay
            value={readings.iotStatus?.dataPoints || 0}
            label="Data Points"
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
        width: "320px",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
        <h3 className="text-white font-bold text-sm">{name}</h3>
        <div className="flex gap-2">
          {readings.network.connectionType === "wifi" && (
            <Wifi size={14} className="text-green-400" />
          )}
          {readings.network.connectionType === "ethernet" && (
            <Cable size={14} className="text-orange-400" />
          )}
          {readings.network.connectionType === "both" && (
            <>
              <Wifi size={14} className="text-green-400" />
              <Cable size={14} className="text-orange-400" />
            </>
          )}
          <StatusLED status={status} label="PWR" />
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
          <span className="text-gray-400">Uptime:</span>
          <span className="text-white ml-1">
            {readings.systemStatus?.uptime
              ? `${Math.floor(readings.systemStatus.uptime / 24)}h`
              : "---"}
          </span>
        </div>
        <div className="bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
          <Cloud size={12} className="text-green-400" />
          <span className="text-gray-400 text-xs">IoT:</span>
          <span className="text-white text-xs">
            {readings.iotStatus?.platform ? "Nex" : "---"}
          </span>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex justify-center gap-1 mt-3">
        {[0, 1, 2, 3, 4].map((index) => (
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

export default A966Gateway;
