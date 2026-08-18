/**
 * BANCO DE CAPACITOR ICON (estilo Traço / IEC)
 * Duas placas paralelas (capacitor) + terminais.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface BancoCapacitorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const BancoCapacitorIcon: React.FC<BancoCapacitorIconProps> = ({
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
      <line x1="40" y1="8" x2="40" y2="34" />
      <line x1="25" y1="34" x2="55" y2="34" />
      <line x1="25" y1="43" x2="55" y2="43" />
      <line x1="40" y1="43" x2="40" y2="72" />
    </svg>
  );
};
