/**
 * MEDIDOR / POWER METER ICON — baseado no desenho antigo (power-meter.svg):
 * corpo do medidor com visor, régua de dígitos e dois botões.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 * Usado também como ícone genérico (Relé, RTU, fallback) no factory.
 */

import React from 'react';

interface MedidorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const MedidorIcon: React.FC<MedidorIconProps> = ({
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
      {/* terminais */}
      <line x1="40" y1="5" x2="40" y2="13" />
      <line x1="40" y1="67" x2="40" y2="75" />
      {/* corpo do medidor */}
      <rect x="16" y="13" width="48" height="54" rx="6" />
      {/* visor */}
      <rect x="23" y="19" width="34" height="19" rx="3" strokeWidth={strokeWidth * 0.85} />
      {/* régua de dígitos */}
      <rect x="24" y="43" width="9" height="7" rx="1.5" strokeWidth={strokeWidth * 0.75} />
      <rect x="35.5" y="43" width="9" height="7" rx="1.5" strokeWidth={strokeWidth * 0.75} />
      <rect x="47" y="43" width="9" height="7" rx="1.5" strokeWidth={strokeWidth * 0.75} />
      {/* botões */}
      <circle cx="34" cy="59" r="3.1" fill="currentColor" stroke="none" />
      <circle cx="46" cy="59" r="3.1" fill="currentColor" stroke="none" />
    </svg>
  );
};
