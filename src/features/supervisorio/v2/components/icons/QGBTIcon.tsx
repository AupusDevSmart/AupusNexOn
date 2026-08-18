/**
 * QGBT ICON (estilo Traço / IEC)
 * Quadro/cabine: retângulo com cabeçalho e dois disjuntores + terminal.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface QGBTIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const QGBTIcon: React.FC<QGBTIconProps> = ({
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
      <line x1="40" y1="8" x2="40" y2="16" />
      <rect x="18" y="16" width="44" height="50" rx="4" />
      <line x1="18" y1="28" x2="62" y2="28" strokeWidth={strokeWidth * 0.8} />
      <rect x="28" y="38" width="10" height="16" rx="1.5" strokeWidth={strokeWidth * 0.8} />
      <rect x="42" y="38" width="10" height="16" rx="1.5" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
};
