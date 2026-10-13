/**
 * CARGA ICON (estilo Traço)
 * Caixa com impedância (indutor + resistor em série) e seta de saída para baixo.
 * Equipamento só VISUAL no unifilar (não tem leitura/comando).
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */
import React from 'react';

interface CargaIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const CargaIcon: React.FC<CargaIconProps> = ({
  width = 80,
  height = 80,
  color = 'currentColor',
  strokeWidth = 2.4,
  className = '',
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color, display: 'block' }}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="19" y="8" width="42" height="42" rx="7" />
      {/* indutor (3 espiras) + resistor (zigue-zague), do topo da caixa até a saída */}
      <path d="M40 8 V12 a3.6 3.6 0 0 1 0 7 a3.6 3.6 0 0 1 0 7 a3.6 3.6 0 0 1 0 7 V34 L45.5 36.5 L34.5 40.5 L45.5 44 L40 46.5 V72" />
      {/* seta de saída */}
      <path d="M35 67 L40 72 L45 67" />
    </svg>
  );
};
