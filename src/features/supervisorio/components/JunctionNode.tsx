// src/features/supervisorio/components/JunctionNode.tsx
import React from "react";

interface JunctionNodeProps {
  id: string;
  posicao: { x: number; y: number };
  containerRect: DOMRect;
  onMouseDown?: (e: React.MouseEvent, id: string) => void;
  onPortClick?: (nodeId: string, port: string) => void;
  isConnecting?: boolean;
}

export function JunctionNode({
  id,
  posicao,
  containerRect,
  onMouseDown,
  onPortClick,
  isConnecting = false,
}: JunctionNodeProps) {
  const x = (posicao.x / 100) * containerRect.width;
  const y = (posicao.y / 100) * containerRect.height;

  const handlePortClick = (port: string) => {
    if (onPortClick) {
      onPortClick(id, port);
    }
  };

  return (
    <g
      className="junction-node cursor-pointer group"
      onMouseDown={(e) => onMouseDown?.(e, id)}
    >
      {/* Nó de junção principal - círculo pequeno */}
      <circle
        cx={x}
        cy={y}
        r="5"
        className="fill-blue-600 dark:fill-blue-400 stroke-white dark:stroke-gray-800 transition-all group-hover:r-7"
        strokeWidth="2"
        style={{ pointerEvents: "all" }}
      />

      {/* Handles (pontos de conexão) - visíveis apenas quando conectando ou em hover */}
      {isConnecting && (
        <>
          {/* Handle Top */}
          <circle
            cx={x}
            cy={y - 12}
            r="4"
            className="fill-green-500 dark:fill-green-400 stroke-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            strokeWidth="1.5"
            onClick={(e) => {
              e.stopPropagation();
              handlePortClick("top");
            }}
            style={{ pointerEvents: "all" }}
          />

          {/* Handle Bottom */}
          <circle
            cx={x}
            cy={y + 12}
            r="4"
            className="fill-green-500 dark:fill-green-400 stroke-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            strokeWidth="1.5"
            onClick={(e) => {
              e.stopPropagation();
              handlePortClick("bottom");
            }}
            style={{ pointerEvents: "all" }}
          />

          {/* Handle Left */}
          <circle
            cx={x - 12}
            cy={y}
            r="4"
            className="fill-green-500 dark:fill-green-400 stroke-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            strokeWidth="1.5"
            onClick={(e) => {
              e.stopPropagation();
              handlePortClick("left");
            }}
            style={{ pointerEvents: "all" }}
          />

          {/* Handle Right */}
          <circle
            cx={x + 12}
            cy={y}
            r="4"
            className="fill-green-500 dark:fill-green-400 stroke-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            strokeWidth="1.5"
            onClick={(e) => {
              e.stopPropagation();
              handlePortClick("right");
            }}
            style={{ pointerEvents: "all" }}
          />
        </>
      )}

      {/* Label ao passar o mouse */}
      <text
        x={x}
        y={y - 20}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        className="fill-gray-700 dark:fill-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      >
        Junction
      </text>
    </g>
  );
}
