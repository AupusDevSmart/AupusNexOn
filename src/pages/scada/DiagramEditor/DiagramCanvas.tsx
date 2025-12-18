// DiagramEditor/DiagramCanvas.tsx
import {
  A966Gateway,
  LandisGyrE750,
  M160Multimeter,
  M300Multimeter,
} from "@/components/equipment";
import { EquipmentLabel } from "@/components/equipment/EquipmentLabel";
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
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // Use ref instead of state

  const handleMouseDown = (e: React.MouseEvent, equipmentId: string) => {
    console.log("🖱️ MouseDown no equipamento:", equipmentId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDraggedId(equipmentId);
    setIsDragging(true);
    console.log("📞 Chamando onEquipmentClick com:", equipmentId);
    onEquipmentClick(equipmentId);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !draggedId || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const newPosition = {
        x: e.clientX - rect.left - dragOffsetRef.current.x,
        y: e.clientY - rect.top - dragOffsetRef.current.y,
      };

      onEquipmentMove(draggedId, newPosition);
    },
    [isDragging, draggedId, onEquipmentMove]
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

  const renderEquipment = useCallback((eq: Equipment) => {
    let equipmentComponent: React.ReactNode = null;

    switch (eq.type) {
      case "m300":
        equipmentComponent = (
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
        break;
      case "m160":
        equipmentComponent = (
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
        break;
      case "landisE750":
        equipmentComponent = (
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
        break;
      case "a966":
        equipmentComponent = (
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
        break;

      // Adicionar outros equipamentos aqui
      default:
        return null;
    }

    // Envolver com EquipmentLabel para posicionar o nome
    return (
      <EquipmentLabel name={eq.data.name} position={eq.labelPosition}>
        {equipmentComponent}
      </EquipmentLabel>
    );
  }, []); // Empty deps - function doesn't depend on any changing values

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
          }}
          onMouseDown={(e) => handleMouseDown(e, eq.id)}
        >
          {renderEquipment(eq)}
        </div>
      ))}
    </div>
  );
};
