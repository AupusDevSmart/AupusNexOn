// components/equipment/RaspberryPi/RaspberryGateway.tsx

import {
  Activity,
  ArrowLeftRight,
  Cable,
  Cpu,
  Database,
  Network,
  Router,
  Server,
  Settings,
  Wifi,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  RaspberryBridge,
  RaspberryProps,
  RaspberryProtocol,
} from "./RaspberryPi.types";

// Componente Display Digital para Raspberry Pi
const RaspberryDisplay = ({
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
  status?:
    | "active"
    | "inactive"
    | "error"
    | "bridging"
    | "running"
    | "stopped"
    | "connected"
    | "disconnected";
}) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "active":
      case "bridging":
      case "running":
      case "connected":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "inactive":
      case "stopped":
      case "disconnected":
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
    | "error"
    | "active"
    | "inactive"
    | "bridging";
  label: string;
}) => {
  const colors = {
    online: "bg-green-500 shadow-green-500/50",
    connected: "bg-green-500 shadow-green-500/50",
    active: "bg-green-500 shadow-green-500/50",
    bridging: "bg-blue-500 shadow-blue-500/50 animate-pulse",
    offline: "bg-gray-500",
    disconnected: "bg-gray-500",
    inactive: "bg-gray-500",
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
const ProtocolIndicator = ({ protocol }: { protocol: RaspberryProtocol }) => {
  const getProtocolIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("mqtt"))
      return <Database size={12} className="text-green-400" />;
    if (lowerName.includes("modbus"))
      return <Activity size={12} className="text-blue-400" />;
    if (lowerName.includes("opcua"))
      return <Server size={12} className="text-purple-400" />;
    if (lowerName.includes("http"))
      return <Network size={12} className="text-orange-400" />;
    return <Router size={12} className="text-gray-400" />;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "input":
        return "↓";
      case "output":
        return "↑";
      case "bidirectional":
        return "↕";
      default:
        return "•";
    }
  };

  return (
    <div className="bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
      {getProtocolIcon(protocol.name)}
      <div className="flex flex-col">
        <span className="text-xs text-white font-mono">
          {protocol.name} {getTypeIcon(protocol.type)}
        </span>
        <span className="text-xs text-gray-400">
          {protocol.connections || 0} conn
        </span>
      </div>
      <StatusLED status={protocol.status} label="" />
    </div>
  );
};

// Indicador de Bridge
const BridgeIndicator = ({ bridge }: { bridge: RaspberryBridge }) => {
  return (
    <div className="bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
      <ArrowLeftRight size={12} className="text-cyan-400" />
      <div className="flex flex-col">
        <span className="text-xs text-white font-mono">
          {bridge.source}→{bridge.destination}
        </span>
        <span className="text-xs text-gray-400">
          {bridge.messagesPerMin || 0}/min
        </span>
      </div>
      <StatusLED status={bridge.status} label="" />
    </div>
  );
};

// Componente Principal Raspberry Pi
const RaspberryGateway: React.FC<RaspberryProps> = ({
  name = "RPi Gateway",
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
        setCurrentDisplay((prev) => (prev + 1) % 6); // 6 modos
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [displayMode]);

  // Renderizar displays baseado no modo
  const renderDisplays = () => {
    if (
      displayMode === "system" ||
      (displayMode === "all" && currentDisplay === 0)
    ) {
      return (
        <>
          <RaspberryDisplay
            value={readings.system.cpu?.usage}
            unit="%"
            label="CPU"
            status={
              readings.system.cpu?.usage && readings.system.cpu.usage > 80
                ? "error"
                : "active"
            }
          />
          <RaspberryDisplay
            value={readings.system.memory?.used}
            unit="MB"
            label="Memory"
            status={
              readings.system.memory?.used &&
              readings.system.memory?.total &&
              readings.system.memory.used / readings.system.memory.total > 0.9
                ? "error"
                : "active"
            }
          />
          <RaspberryDisplay
            value={readings.system.cpu?.temperature}
            unit="°C"
            label="Temp"
            status={
              readings.system.cpu?.temperature &&
              readings.system.cpu.temperature > 70
                ? "error"
                : "active"
            }
          />
        </>
      );
    } else if (
      displayMode === "connectivity" ||
      (displayMode === "all" && currentDisplay === 1)
    ) {
      return (
        <>
          <RaspberryDisplay
            value={readings.connectivity.ethernet.ip || "No ETH"}
            label="Ethernet"
            status={readings.connectivity.ethernet.status}
          />
          <RaspberryDisplay
            value={readings.connectivity.wifi.ssid || "No WiFi"}
            label="WiFi"
            status={readings.connectivity.wifi.status}
          />
          <RaspberryDisplay
            value={readings.connectivity.cellular?.operator || "No Cell"}
            label="Cellular"
            status={readings.connectivity.cellular?.status}
          />
        </>
      );
    } else if (
      displayMode === "protocols" ||
      (displayMode === "all" && currentDisplay === 2)
    ) {
      const protocols = readings.protocols?.slice(0, 3) || [];
      return (
        <>
          {protocols.map((protocol, index) => (
            <RaspberryDisplay
              key={index}
              value={`${protocol.name} ${protocol.type.toUpperCase()}`}
              label={`Proto ${index + 1}`}
              status={protocol.status}
            />
          ))}
          {protocols.length === 0 && (
            <RaspberryDisplay value="No protocols" label="Protocols" />
          )}
        </>
      );
    } else if (
      displayMode === "bridges" ||
      (displayMode === "all" && currentDisplay === 3)
    ) {
      const bridges = readings.bridges?.slice(0, 3) || [];
      return (
        <>
          {bridges.map((bridge, index) => (
            <RaspberryDisplay
              key={index}
              value={`${bridge.source}→${bridge.destination}`}
              label={`Bridge ${index + 1}`}
              status={bridge.status}
            />
          ))}
          {bridges.length === 0 && (
            <RaspberryDisplay value="No bridges" label="Bridges" />
          )}
        </>
      );
    } else if (
      displayMode === "interfaces" ||
      (displayMode === "all" && currentDisplay === 4)
    ) {
      return (
        <>
          <RaspberryDisplay
            value={`RS485: ${
              readings.interfaces?.serial?.rs485.active ? "ON" : "OFF"
            }`}
            label="Serial"
            status={
              readings.interfaces?.serial?.rs485.active ? "active" : "inactive"
            }
          />
          <RaspberryDisplay
            value={`USB: ${readings.interfaces?.usb?.devices || 0} dev`}
            label="USB"
            status={readings.interfaces?.usb?.devices ? "active" : "inactive"}
          />
          <RaspberryDisplay
            value={`I2C: ${readings.interfaces?.gpio?.i2c?.devices || 0} dev`}
            label="I2C/SPI"
            status={
              readings.interfaces?.gpio?.i2c?.devices ? "active" : "inactive"
            }
          />
        </>
      );
    } else if (
      displayMode === "gateway" ||
      (displayMode === "all" && currentDisplay === 5)
    ) {
      return (
        <>
          <RaspberryDisplay
            value={readings.gateway?.activeConnections}
            unit={`/${readings.gateway?.totalConnections}`}
            label="Conn"
          />
          <RaspberryDisplay
            value={readings.gateway?.messagesPerMin}
            unit="/min"
            label="Msgs"
          />
          <RaspberryDisplay
            value={readings.gateway?.errorRate}
            unit="%"
            label="Errors"
            status={
              readings.gateway?.errorRate && readings.gateway.errorRate > 5
                ? "error"
                : "active"
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
      {/* Corpo principal do Raspberry Pi */}
      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 shadow-xl w-64">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
          <h3 className="text-white font-bold text-sm">{name}</h3>
          <div className="flex gap-2">
            <StatusLED status={status} label="PWR" />
            {readings.connectivity.ethernet.status === "connected" && (
              <Cable size={14} className="text-green-400" />
            )}
            {readings.connectivity.wifi.status === "connected" && (
              <Wifi size={14} className="text-blue-400" />
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

        {/* Informações adicionais */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div className="bg-gray-700 rounded px-2 py-1">
            <span className="text-gray-400">Model:</span>
            <span className="text-white ml-1">
              {readings.system.model || "Pi 4"}
            </span>
          </div>
          <div className="bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
            <div className="flex items-center gap-1">
              <Cpu size={10} className="text-green-400" />
              <span className="text-gray-400">Freq:</span>
            </div>
            <span className="text-white text-xs">
              {readings.system.cpu?.frequency || "1800"}MHz
            </span>
          </div>
        </div>

        {/* Indicador de modo de display */}
        {displayMode === "all" && (
          <div className="flex justify-center gap-1 mt-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className={`h-1 w-5 rounded ${
                  currentDisplay === index ? "bg-green-500" : "bg-gray-600"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pontos de conexão - Rede */}
      <div className="absolute -top-2 left-6">
        <div className="flex gap-1">
          <div
            className="w-3 h-3 bg-green-600 rounded-full border border-gray-400"
            title="Ethernet"
          />
          <div
            className="w-3 h-3 bg-blue-600 rounded-full border border-gray-400"
            title="WiFi"
          />
          <div
            className="w-3 h-3 bg-purple-600 rounded-full border border-gray-400"
            title="Cellular"
          />
        </div>
      </div>

      {/* Pontos de conexão - Interfaces */}
      <div className="absolute -top-2 right-6">
        <div className="flex gap-1">
          <div
            className="w-2 h-2 bg-yellow-600 rounded-full border border-gray-400"
            title="RS485"
          />
          <div
            className="w-2 h-2 bg-red-600 rounded-full border border-gray-400"
            title="RS232"
          />
          <div
            className="w-2 h-2 bg-cyan-600 rounded-full border border-gray-400"
            title="I2C"
          />
          <div
            className="w-2 h-2 bg-orange-600 rounded-full border border-gray-400"
            title="USB"
          />
        </div>
      </div>

      {/* Indicador visual de Gateway */}
      <div className="absolute -bottom-1 right-2">
        <div className="bg-red-600 text-white text-xs px-1 py-0.5 rounded font-mono flex items-center gap-1">
          <Router size={10} />
          GW
        </div>
      </div>
    </div>
  );
};

export default RaspberryGateway;
