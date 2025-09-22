// components/equipment/A966/A966Gateway.tsx

import { Activity, Cable, Cloud, Router, Settings, Wifi } from "lucide-react";
import React, { useEffect, useState } from "react";
import { A966Communication, A966Props } from "./A966.types";

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

// Indicador de Protocolo
const ProtocolIndicator = ({
  protocol,
  interface: iface,
  status,
}: A966Communication & { protocol: string; interface: string }) => {
  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case "modbus":
        return <Activity size={12} className="text-blue-400" />;
      case "mqtt":
        return <Cloud size={12} className="text-green-400" />;
      case "wifi":
        return <Wifi size={12} className="text-purple-400" />;
      case "ethernet":
        return <Cable size={12} className="text-orange-400" />;
      default:
        return <Router size={12} className="text-gray-400" />;
    }
  };

  return (
    <div className="bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
      {getProtocolIcon(protocol)}
      <div className="flex flex-col">
        <span className="text-xs text-white font-mono">
          {protocol.toUpperCase()}
        </span>
        <span className="text-xs text-gray-400">{iface}</span>
      </div>
      <StatusLED status={status} label="" />
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

  // Rotação automática do display quando em modo "all"
  useEffect(() => {
    if (displayMode === "all") {
      const interval = setInterval(() => {
        setCurrentDisplay((prev) => (prev + 1) % 5); // 5 modos
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [displayMode]);

  // Renderizar displays baseado no modo
  const renderDisplays = () => {
    if (
      displayMode === "inputs" ||
      (displayMode === "all" && currentDisplay === 0)
    ) {
      return (
        <>
          <GatewayDisplay
            value="MODBUS"
            label="Entrada 1"
            status={readings.inputs.modbus?.status}
          />
          <GatewayDisplay
            value="SSU/NBR"
            label="Entrada 2"
            status={readings.inputs.ssu?.status}
          />
          <GatewayDisplay
            value="PULSE"
            label="Entrada 3"
            status={readings.inputs.pulse?.status}
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
            value={readings.iotStatus.platform || "IoT"}
            label="Plataforma"
            status={
              readings.iotStatus.errors && readings.iotStatus.errors > 0
                ? "error"
                : "connected"
            }
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
            value={readings.systemStatus.cpu}
            unit="%"
            label="CPU"
            status={
              readings.systemStatus.cpu && readings.systemStatus.cpu > 80
                ? "error"
                : "online"
            }
          />
          <GatewayDisplay
            value={readings.systemStatus.memory}
            unit="%"
            label="Mem"
            status={
              readings.systemStatus.memory && readings.systemStatus.memory > 85
                ? "error"
                : "online"
            }
          />
          <GatewayDisplay
            value={readings.systemStatus.temperature}
            unit="°C"
            label="Temp"
            status={
              readings.systemStatus.temperature &&
              readings.systemStatus.temperature > 55
                ? "error"
                : "online"
            }
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
            label="IP Addr"
          />
          <GatewayDisplay
            value={readings.network.ssid || "Ethernet"}
            label={
              readings.network.connectionType === "wifi" ? "WiFi" : "Network"
            }
          />
          <GatewayDisplay
            value={readings.systemStatus.signalStrength}
            unit="%"
            label="Signal"
            status={
              readings.systemStatus.signalStrength &&
              readings.systemStatus.signalStrength < 30
                ? "error"
                : "connected"
            }
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
            value={readings.iotStatus.dataPoints}
            label="Data Pts"
          />
          <GatewayDisplay
            value={readings.iotStatus.lastSync || "Syncing"}
            label="Last Sync"
          />
          <GatewayDisplay
            value={readings.iotStatus.errors || 0}
            label="Errors"
            status={
              readings.iotStatus.errors && readings.iotStatus.errors > 0
                ? "error"
                : "online"
            }
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
      {/* Corpo principal do A-966 */}
      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 shadow-xl w-64">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
          <h3 className="text-white font-bold text-sm">{name}</h3>
          <div className="flex gap-2">
            <StatusLED status={status} label="PWR" />
            {readings.network.connectionType === "wifi" && (
              <Wifi size={14} className="text-purple-400" />
            )}
            {readings.network.connectionType === "ethernet" && (
              <Cable size={14} className="text-orange-400" />
            )}
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

        {/* Informações adicionais - Protocolos */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div className="bg-gray-700 rounded px-2 py-1">
            <span className="text-gray-400">Uptime:</span>
            <span className="text-white ml-1">
              {readings.systemStatus.uptime?.toFixed(0) || "---"}h
            </span>
          </div>
          <div className="bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
            <div className="flex items-center gap-1">
              <Cloud size={10} className="text-green-400" />
              <span className="text-gray-400">IoT:</span>
            </div>
            <span className="text-white text-xs">
              {readings.iotStatus.platform?.substring(0, 3) || "---"}
            </span>
          </div>
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

      {/* Pontos de conexão - Entradas */}
      <div className="absolute -top-2 left-4">
        <div className="flex gap-2">
          <div
            className="w-3 h-3 bg-blue-600 rounded-full border border-gray-400"
            title="Modbus RS-485"
          />
          <div
            className="w-3 h-3 bg-yellow-600 rounded-full border border-gray-400"
            title="SSU/TTL"
          />
          <div
            className="w-3 h-3 bg-green-600 rounded-full border border-gray-400"
            title="Pulse/TTL"
          />
        </div>
      </div>

      {/* Pontos de conexão - Saídas */}
      <div className="absolute -top-2 right-4">
        <div className="flex gap-2">
          <div
            className="w-3 h-3 bg-purple-600 rounded-full border border-gray-400"
            title="WiFi"
          />
          <div
            className="w-3 h-3 bg-orange-600 rounded-full border border-gray-400"
            title="Ethernet"
          />
        </div>
      </div>

      {/* Indicador visual de Gateway IoT */}
      <div className="absolute -bottom-1 right-2">
        <div className="bg-purple-600 text-white text-xs px-1 py-0.5 rounded font-mono flex items-center gap-1">
          <Cloud size={10} />
          IoT
        </div>
      </div>
    </div>
  );
};

export default A966Gateway;
