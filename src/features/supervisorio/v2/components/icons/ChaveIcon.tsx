/**
 * CHAVE SECCIONADORA ICON (estilo Traço / IEC) — vertical (2x4 / 80x160).
 * Lâmina articulada (aberta) entre dois contatos + terminais.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface ChaveIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const ChaveIcon: React.FC<ChaveIconProps> = ({
  width = 80,
  height = 160,
  color = 'currentColor',
  strokeWidth = 2.4,
  className = '',
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 80 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color, display: 'block' }}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* terminal superior + contato */}
      <line x1="40" y1="18" x2="40" y2="52" />
      <circle cx="40" cy="56" r="3.5" fill="currentColor" stroke="none" />
      {/* lâmina articulada (aberta) */}
      <line x1="40" y1="56" x2="22" y2="104" />
      {/* contato inferior + terminal */}
      <circle cx="40" cy="108" r="3.5" fill="currentColor" stroke="none" />
      <line x1="40" y1="108" x2="40" y2="142" />
    </svg>
  );
};
