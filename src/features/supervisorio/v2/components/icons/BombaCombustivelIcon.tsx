/**
 * BOMBA DE COMBUSTÍVEL ICON (estilo Traço)
 * Dispenser de posto: corpo com display + mangueira + bico (pistola).
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 */

import React from 'react';

interface BombaCombustivelIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const BombaCombustivelIcon: React.FC<BombaCombustivelIconProps> = ({
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
      {/* base no chão */}
      <line x1="16" y1="66" x2="46" y2="66" />
      {/* corpo do dispenser */}
      <rect x="20" y="16" width="24" height="50" rx="3" />
      {/* display */}
      <rect x="25" y="22" width="14" height="11" rx="1.5" strokeWidth={strokeWidth * 0.8} />
      {/* botões/detalhe */}
      <line x1="26" y1="41" x2="38" y2="41" strokeWidth={strokeWidth * 0.7} />
      <line x1="26" y1="47" x2="38" y2="47" strokeWidth={strokeWidth * 0.7} />
      {/* mangueira: sobe do topo direito e desce */}
      <path d="M44 24 C55 24 58 29 58 37 L58 52" />
      {/* bico (pistola) apontando pra direita */}
      <path d="M53 52 L62 52 L62 46 L66 46" />
    </svg>
  );
};

export default BombaCombustivelIcon;
