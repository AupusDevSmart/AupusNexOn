/**
 * TON ICON
 *
 * Identifica visualmente um TON (controlador IoT Aupus) no diagrama unifilar.
 * Distintivo dos equipamentos eletricos: caixa retangular com pontos representando
 * I/Os (rele/transistores), em vez de simbolos eletricos tradicionais.
 *
 * SVG inline — sem dependencia de asset externo, respeita currentColor para
 * dark mode e estados (normal/alarme/falha).
 */

import React from 'react';

interface TONIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const TONIcon: React.FC<TONIconProps> = ({
  width = 80,
  height = 80,
  color = 'currentColor',
  strokeWidth = 1.6,
  className = '',
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="TON (controlador IoT)"
    >
      {/* Corpo do controlador */}
      <rect x="3" y="5" width="18" height="14" rx="1.5" />

      {/* Linha separando area de info / area de I/Os */}
      <line x1="3" y1="9" x2="21" y2="9" />

      {/* LED de status (canto superior esquerdo) */}
      <circle cx="5.5" cy="7" r="0.7" fill={color} />

      {/* Label TON (canto superior direito) — texto inline */}
      <text
        x="19"
        y="8"
        textAnchor="end"
        fontSize="3"
        fontWeight="600"
        fill={color}
        stroke="none"
      >
        TON
      </text>

      {/* 6 I/Os (reles) — fileira inferior */}
      <circle cx="6" cy="13.5" r="0.9" />
      <circle cx="9" cy="13.5" r="0.9" />
      <circle cx="12" cy="13.5" r="0.9" />
      <circle cx="15" cy="13.5" r="0.9" />
      <circle cx="18" cy="13.5" r="0.9" />
      <circle cx="6" cy="16.5" r="0.9" />
      <circle cx="9" cy="16.5" r="0.9" />
      <circle cx="12" cy="16.5" r="0.9" />
      <circle cx="15" cy="16.5" r="0.9" />
      <circle cx="18" cy="16.5" r="0.9" />
    </svg>
  );
};
