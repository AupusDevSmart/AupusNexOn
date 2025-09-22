// components/equipment/ESP32/ESP32Controller.tsx

import {
  Activity,
  Bluetooth,
  Cpu,
  Power,
  Radio,
  Server,
  Settings,
  ToggleLeft,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { ESP32Device, ESP32Props } from "./ESP32.types";

// Componente Display Digital para ESP32
const ESP32Display = ({
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
    | "on"
    | "off"
    | "error"
    | "connected"
    | "disconnected"
    | "active"
    | "inactive";
}) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "on":
      case "connected":
      case "active":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "off":
      case "disconnected":
      case "inactive":
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
    | "on"
    | "off";
  label: string;
}) => {
  const colors = {
    online: "bg-green-500 shadow-green-500/50",
    connected: "bg-green-500 shadow-green-500/50",
    on: "bg-green-500 shadow-green-500/50",
    offline: "bg-gray-500",
    disconnected: "bg-gray-500",
    off: "bg-gray-500",
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

// Indicador de Device
const DeviceIndicator = ({ device }: { device: ESP32Device }) => {
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "relay":
        return <ToggleLeft size={12} className="text-blue-400" />;
      case "motor":
        return <Activity size={12} className="text-green-400" />;
      case "pump":
        return <Radio size={12} className="text-cyan-400" />;
      case "valve":
        return <Power size={12} className="text-orange-400" />;
      case "alarm":
        return <Zap size={12} className="text-red-400" />;
      default:
        return <Server size={12} className="text-gray-400" />;
    }
  };

  return (
    <div className="bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
      {getDeviceIcon(device.type)}
      <div className="flex flex-col">
        <span className="text-xs text-white font-mono">{device.name}</span>
        <span className="text-xs text-gray-400">Pin {device.pin}</span>
      </div>
      <StatusLED status={device.status} label="" />
    </div>
  );
};

// Componente Principal ESP32
const ESP32Controller: React.FC<ESP32Props> = ({
  name = "ESP32",
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
      displayMode === "connectivity" ||
      (displayMode === "all" && currentDisplay === 0)
    ) {
      return (
        <>
          <ESP32Display
            value={readings.connectivity.wifi.ssid || "No WiFi"}
            label="WiFi"
            status={readings.connectivity.wifi.status}
          />
          <ESP32Display
            value={readings.connectivity.wifi.rssi}
            unit="dBm"
            label="Signal"
            status={
              readings.connectivity.wifi.rssi &&
              readings.connectivity.wifi.rssi > -70
                ? "connected"
                : "error"
            }
          />
          <ESP32Display
            value={readings.connectivity.wifi.ip || "---"}
            label="IP Addr"
          />
        </>
      );
    } else if (
      displayMode === "system" ||
      (displayMode === "all" && currentDisplay === 1)
    ) {
      return (
        <>
          <ESP32Display
            value={readings.system.cpu}
            unit="%"
            label="CPU"
            status={
              readings.system.cpu && readings.system.cpu > 80 ? "error" : "on"
            }
          />
          <ESP32Display
            value={readings.system.memory}
            unit="KB"
            label="Mem Free"
            status={
              readings.system.memory && readings.system.memory < 10
                ? "error"
                : "on"
            }
          />
          <ESP32Display
            value={readings.system.temperature}
            unit="°C"
            label="Temp"
            status={
              readings.system.temperature && readings.system.temperature > 70
                ? "error"
                : "on"
            }
          />
        </>
      );
    } else if (
      displayMode === "devices" ||
      (displayMode === "all" && currentDisplay === 2)
    ) {
      const devices = readings.devices?.slice(0, 3) || [];
      return (
        <>
          {devices.map((device, index) => (
            <ESP32Display
              key={index}
              value={`${device.name} ${device.status.toUpperCase()}`}
              label={`Pin ${device.pin}`}
              status={device.status}
            />
          ))}
          {devices.length === 0 && (
            <ESP32Display value="No devices" label="Devices" />
          )}
        </>
      );
    } else if (
      displayMode === "protocols" ||
      (displayMode === "all" && currentDisplay === 3)
    ) {
      return (
        <>
          <ESP32Display
            value="MQTT"
            label="Protocol 1"
            status={readings.protocols.mqtt?.status}
          />
          <ESP32Display
            value="MODBUS"
            label="Protocol 2"
            status={readings.protocols.modbus?.status}
          />
          <ESP32Display
            value="HTTP"
            label="Protocol 3"
            status={readings.protocols.http?.status}
          />
        </>
      );
    } else if (
      displayMode === "control" ||
      (displayMode === "all" && currentDisplay === 4)
    ) {
      return (
        <>
          <ESP32Display
            value={readings.control?.activeDevices}
            unit={`/${readings.control?.totalDevices}`}
            label="Active"
          />
          <ESP32Display
            value={readings.control?.powerConsumption}
            unit="W"
            label="Power"
          />
          <ESP32Display
            value={readings.control?.commandsPerMin}
            unit="/min"
            label="Cmds"
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
      {/* Corpo principal do ESP32 */}
      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 shadow-xl w-64">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
          <h3 className="text-white font-bold text-sm">{name}</h3>
          <div className="flex gap-2">
            <StatusLED status={status} label="PWR" />
            {readings.connectivity.wifi.status === "connected" ? (
              <Wifi size={14} className="text-green-400" />
            ) : (
              <WifiOff size={14} className="text-gray-500" />
            )}
            {readings.connectivity.bluetooth.status === "enabled" && (
              <Bluetooth size={14} className="text-blue-400" />
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
            <span className="text-gray-400">Uptime:</span>
            <span className="text-white ml-1">
              {readings.system.uptime?.toFixed(1) || "---"}h
            </span>
          </div>
          <div className="bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
            <div className="flex items-center gap-1">
              <Cpu size={10} className="text-blue-400" />
              <span className="text-gray-400">Core:</span>
            </div>
            <span className="text-white text-xs">
              {readings.system.frequency || "240"}MHz
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

      {/* Pontos de conexão - GPIOs */}
      <div className="absolute -top-2 left-1/4">
        <div className="flex gap-1">
          <div
            className="w-2 h-2 bg-blue-600 rounded-full border border-gray-400"
            title="GPIO 2"
          />
          <div
            className="w-2 h-2 bg-green-600 rounded-full border border-gray-400"
            title="GPIO 4"
          />
          <div
            className="w-2 h-2 bg-orange-600 rounded-full border border-gray-400"
            title="GPIO 5"
          />
          <div
            className="w-2 h-2 bg-purple-600 rounded-full border border-gray-400"
            title="GPIO 18"
          />
          <div
            className="w-2 h-2 bg-red-600 rounded-full border border-gray-400"
            title="GPIO 19"
          />
        </div>
      </div>

      {/* Pontos de conexão - Comunicação */}
      <div className="absolute -top-2 right-1/4">
        <div className="flex gap-1">
          <div
            className="w-2 h-2 bg-cyan-600 rounded-full border border-gray-400"
            title="RX/TX"
          />
          <div
            className="w-2 h-2 bg-yellow-600 rounded-full border border-gray-400"
            title="RS485"
          />
        </div>
      </div>

      {/* Indicador visual de Controller/Gateway */}
      <div className="absolute -bottom-1 right-2">
        <div className="bg-cyan-600 text-white text-xs px-1 py-0.5 rounded font-mono flex items-center gap-1">
          <Server size={10} />
          CTRL
        </div>
      </div>
    </div>
  );
};

export default ESP32Controller;
