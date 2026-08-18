/**
 * CARREGADOR ELÉTRICO ICON (estilo Traço)
 * Estação de recarga: corpo com display + raio + terminal.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface CarregadorEletricoIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const CarregadorEletricoIcon: React.FC<CarregadorEletricoIconProps> = ({
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
      <rect x="26" y="16" width="28" height="48" rx="4" />
      <rect x="31" y="22" width="18" height="13" rx="2" strokeWidth={strokeWidth * 0.8} />
      <path
        d="M42 40 L35 51 L40 51 L37 60 L47 47 L42 47 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
};
