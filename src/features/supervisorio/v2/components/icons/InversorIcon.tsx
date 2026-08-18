/**
 * INVERSOR ICON (estilo Traço / IEC)
 * Caixa com diagonal, senóide (AC) e "=" (DC) + terminais.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface InversorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const InversorIcon: React.FC<InversorIconProps> = ({
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
      <line x1="40" y1="8" x2="40" y2="18" />
      <rect x="18" y="18" width="44" height="44" rx="4" />
      <line x1="22" y1="58" x2="58" y2="22" />
      {/* senóide (AC) — canto superior esquerdo */}
      <path d="M25 34 q3.5 -7 7 0 t7 0" strokeWidth={strokeWidth * 0.85} />
      {/* "=" (DC) — canto inferior direito */}
      <line x1="45" y1="48" x2="57" y2="48" strokeWidth={strokeWidth * 0.85} />
      <line x1="45" y1="53" x2="57" y2="53" strokeWidth={strokeWidth * 0.85} />
      <line x1="40" y1="62" x2="40" y2="72" />
    </svg>
  );
};
