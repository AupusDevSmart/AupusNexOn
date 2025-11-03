// DiagramEditor/DiagramCanvas.tsx
import {
  A966Gateway,
  LandisGyrE750,
  M160Multimeter,
  M300Multimeter,
} from "@/components/equipment";
import { Equipment } from "@/types/equipment";
import React, { useCallback, useRef, useState } from "react";

interface DiagramCanvasProps {
  equipment: Equipment[];
  onEquipmentMove: (id: string, position: { x: number; y: number }) => void;
  onEquipmentClick: (id: string) => void;
  selectedId?: string | null; // Permitir null aqui
}

export const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  equipment,
  onEquipmentMove,
  onEquipmentClick,
  selectedId,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent, equipmentId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setDraggedId(equipmentId);
    setIsDragging(true);
    onEquipmentClick(equipmentId);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !draggedId || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const newPosition = {
        x: e.clientX - rect.left - dragOffset.x,
        y: e.clientY - rect.top - dragOffset.y,
      };

      onEquipmentMove(draggedId, newPosition);
    },
    [isDragging, draggedId, dragOffset, onEquipmentMove]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedId(null);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const renderEquipment = (eq: Equipment) => {
    switch (eq.type) {
      case "m300":
        return (
          <M300Multimeter
            id={eq.id}
            name={eq.data.name}
            readings={
              eq.data.readings || {
                voltage: {},
                current: {},
                power: {},
              }
            }
            status={eq.data.status}
            displayMode={eq.data.displayMode as any}
            scale={0.8}
          />
        );
      case "m160":
        return (
          <M160Multimeter
            id={eq.id}
            name={eq.data.name}
            readings={
              eq.data.readings || {
                voltage: {},
                current: {},
                power: {},
                energy: {},
                thd: {},
              }
            }
            status={eq.data.status}
            displayMode={eq.data.displayMode as any}
            scale={0.8}
          />
        );
      case "landisE750":
        return (
          <LandisGyrE750
            id={eq.id}
            name={eq.data.name}
            readings={
              eq.data.readings || {
                voltage: {},
                current: {},
                energy: {},
                power: {},
                communication: {},
                system: {},
                loadProfile: {},
              }
            }
            status={eq.data.status as any}
            displayMode={eq.data.displayMode as any}
            scale={0.8}
            moduleConfiguration={{
              baseModule: true,
              communicationModule: "GSM_GPRS",
              pulseModule: true,
              networkNode: false,
            }}
            onModuleConfig={(module) =>
              console.log("Configure module:", module)
            }
          />
        );
      case "a966":
        return (
          <A966Gateway
            id={eq.id}
            name={eq.data.name}
            readings={{
              inputs: eq.data.readings?.inputs || {},
              outputs: eq.data.readings?.outputs || {},
              systemStatus: eq.data.readings?.systemStatus || {},
              network: eq.data.readings?.network || {
                connectionType: "ethernet",
              },
              iotStatus: eq.data.readings?.iotStatus || {},
            }}
            status={eq.data.status}
            displayMode={eq.data.displayMode as any}
            scale={0.8}
          />
        );

      // Adicionar outros equipamentos aqui
      default:
        return null;
    }
  };

  return (
    <div
    ref={canvasRef}
    className="relative w-full h-full bg-gray-900 overflow-hidden"
    style={{
      backgroundImage:
        "radial-gradient(circle, #374151 1px, transparent 1px)",
      backgroundSize: "20px 20px",
    }}
  >
    {/* SVG para linhas de conexão - RENDERIZAR PRIMEIRO (fica atrás) */}
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {/* Renderizar linhas de conexão entre equipamentos */}
      {equipment.map((eq) => 
        eq.connections?.map((conn, idx) => {
          const targetEq = equipment.find(e => e.id === conn.to);
          if (!targetEq) return null;

          return (
            <line
              key={`${eq.id}-${conn.to}-${idx}`}
              x1={eq.position.x + 50} // +50 para centralizar (ajuste conforme tamanho do componente)
              y1={eq.position.y + 50}
              x2={targetEq.position.x + 50}
              y2={targetEq.position.y + 50}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="connection-line"
              style={{
                stroke: conn.type === 'power' ? '#3b82f6' : 
                        conn.type === 'signal' ? '#10b981' : 
                        '#6b7280',
                strokeWidth: '2px',
              }}
            />
          );
        })
      )}
    </svg>

    {/* Equipamentos - RENDERIZAR DEPOIS (fica na frente) */}
    {equipment.map((eq) => (
      <div
        key={eq.id}
        className={`absolute cursor-move ${
          selectedId === eq.id ? "ring-2 ring-blue-500" : ""
        }`}
        style={{
          left: `${eq.position.x}px`,
          top: `${eq.position.y}px`,
          userSelect: "none",
          zIndex: 10, // Garante que fica acima do SVG
        }}
        onMouseDown={(e) => handleMouseDown(e, eq.id)}
      >
        {renderEquipment(eq)}
      </div>
    ))}
  </div>
);
};
