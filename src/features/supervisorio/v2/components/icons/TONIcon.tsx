/**
 * TON ICON (controlador IoT Aupus) — estilo Traço.
 * Caixa arredondada rotulada "TON" com indicador de status + stub.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface TONIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const TONIcon: React.FC<TONIconProps> = ({
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
      {/* sinal (antena) */}
      <path d="M30 20 a12 12 0 0 1 20 0" fill="none" strokeWidth={strokeWidth * 0.7} />
      <path d="M34 23 a7 7 0 0 1 12 0" fill="none" strokeWidth={strokeWidth * 0.7} />
      <circle cx="40" cy="26" r="1.8" fill="currentColor" stroke="none" />
      {/* corpo */}
      <rect x="15" y="30" width="50" height="30" rx="7" />
      <text
        x="40"
        y="50"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
        fill="currentColor"
        stroke="none"
      >
        TON
      </text>
      <line x1="40" y1="60" x2="40" y2="72" />
    </svg>
  );
};
