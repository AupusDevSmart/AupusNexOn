import { M300Multimeter } from "@/components/equipment";
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
            displayMode={eq.data.displayMode}
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
