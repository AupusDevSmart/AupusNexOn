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
      <line x1="40" y1="6" x2="40" y2="18" />
      <circle cx="40" cy="44" r="21" strokeWidth={strokeWidth * 0.8} strokeDasharray="4 4" />
      <line x1="40" y1="44" x2="61" y2="44" />
      <circle cx="40" cy="44" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
};
