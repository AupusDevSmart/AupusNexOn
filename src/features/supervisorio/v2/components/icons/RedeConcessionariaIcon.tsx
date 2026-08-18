/**
 * ÍCONE - REDE CONCESSIONÁRIA (estilo Traço / IEC)
 * Entrada da rede: barra MT com terminais + alimentador com seta de entrada.
 * Inline SVG monocromático (currentColor) → recolorível pelo tema e serializável (export).
 */

import React from 'react';

interface RedeConcessionariaIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const RedeConcessionariaIcon: React.FC<RedeConcessionariaIconProps> = ({
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
      {/* Barra MT de entrada */}
      <line x1="24" y1="22" x2="56" y2="22" />
      <circle cx="32" cy="22" r="3" fill="currentColor" stroke="none" />
      <circle cx="48" cy="22" r="3" fill="currentColor" stroke="none" />
      {/* Alimentador + seta (energia entrando) */}
      <line x1="40" y1="22" x2="40" y2="58" />
      <path d="M32 50 L40 59 L48 50" />
    </svg>
  );
};
