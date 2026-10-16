/**
 * PIVÔ ICON (estilo Traço)
 * Pivô central de irrigação: campo (círculo tracejado) + centro + braço.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface PivoIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const PivoIcon: React.FC<PivoIconProps> = ({
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
      {/* área irrigada (tracejada) ocupando o símbolo inteiro + lança do pivô a partir do centro */}
      <circle cx="40" cy="40" r="31" strokeWidth={strokeWidth * 0.85} strokeDasharray="5 4" />
      <line x1="40" y1="40" x2="71" y2="40" />
      <circle cx="40" cy="40" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
};
