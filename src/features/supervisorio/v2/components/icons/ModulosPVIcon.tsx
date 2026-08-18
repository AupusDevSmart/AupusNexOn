/**
 * MÓDULOS PV ICON (estilo Traço / IEC)
 * Painel fotovoltaico: retângulo com grade de células + terminal.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface ModulosPVIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const ModulosPVIcon: React.FC<ModulosPVIconProps> = ({
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
      <rect x="14" y="16" width="52" height="34" rx="3" />
      <line x1="14" y1="33" x2="66" y2="33" strokeWidth={strokeWidth * 0.8} />
      <line x1="31.3" y1="16" x2="31.3" y2="50" strokeWidth={strokeWidth * 0.8} />
      <line x1="48.6" y1="16" x2="48.6" y2="50" strokeWidth={strokeWidth * 0.8} />
      <line x1="40" y1="50" x2="40" y2="72" />
    </svg>
  );
};
