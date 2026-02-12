/**
 * ÍCONE - REDE CONCESSIONÁRIA - Monocromático
 *
 * Ícone SVG de entrada da rede elétrica da concessionária.
 * Representa torre de transmissão ou poste.
 * Usa currentColor para adaptar ao tema claro/escuro.
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
  strokeWidth = 0.05,
  className = '',
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 2 2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color }}
    >
      {/* Torre/Poste (estrutura central) */}
      <g transform="translate(1.0, 0.375)">
        {/* Base do poste */}
        <line x1="0" y1="0" x2="0" y2="1.25" stroke="currentColor" strokeWidth={strokeWidth * 1.5} />

        {/* Cruzeta superior */}
        <line x1="-0.417" y1="0.125" x2="0.417" y2="0.125" stroke="currentColor" strokeWidth={strokeWidth * 1.2} />

        {/* Cruzeta inferior */}
        <line x1="-0.333" y1="0.5" x2="0.333" y2="0.5" stroke="currentColor" strokeWidth={strokeWidth * 1.2} />

        {/* Isoladores (círculos nas pontas) */}
        <circle cx="-0.417" cy="0.125" r="0.0417" stroke="currentColor" strokeWidth={strokeWidth * 0.8} fill="none" />
        <circle cx="0" cy="0.125" r="0.0417" stroke="currentColor" strokeWidth={strokeWidth * 0.8} fill="none" />
        <circle cx="0.417" cy="0.125" r="0.0417" stroke="currentColor" strokeWidth={strokeWidth * 0.8} fill="none" />

        <circle cx="-0.333" cy="0.5" r="0.0417" stroke="currentColor" strokeWidth={strokeWidth * 0.8} fill="none" />
        <circle cx="0.333" cy="0.5" r="0.0417" stroke="currentColor" strokeWidth={strokeWidth * 0.8} fill="none" />
      </g>

      {/* Linhas de transmissão (fios entrando) */}
      <g>
        {/* Fios da esquerda chegando */}
        <line x1="0.083" y1="0.375" x2="0.583" y2="0.5" stroke="currentColor" strokeWidth={strokeWidth * 0.8} strokeDasharray="0.05 0.033" />
        <line x1="0.083" y1="0.625" x2="0.667" y2="0.875" stroke="currentColor" strokeWidth={strokeWidth * 0.8} strokeDasharray="0.05 0.033" />

        {/* Fios da direita saindo */}
        <line x1="1.417" y1="0.5" x2="1.917" y2="0.625" stroke="currentColor" strokeWidth={strokeWidth * 0.8} strokeDasharray="0.05 0.033" />
        <line x1="1.333" y1="0.875" x2="1.917" y2="1.0" stroke="currentColor" strokeWidth={strokeWidth * 0.8} strokeDasharray="0.05 0.033" />
      </g>

      {/* Caixa de medição (opcional - abaixo do poste) */}
      <rect
        x="0.8"
        y="1.55"
        width="0.4"
        height="0.3"
        rx="0.033"
        stroke="currentColor"
        strokeWidth={strokeWidth * 0.8}
        fill="none"
      />

      {/* Símbolo de raio (indicando energia) */}
      <g transform="translate(0.933, 1.675)">
        <path
          d="M 0.067 0 L 0 0.067 L 0.033 0.067 L 0 0.133 L 0.1 0.05 L 0.067 0.05 Z"
          stroke="currentColor"
          strokeWidth={strokeWidth * 0.6}
          fill="currentColor"
        />
      </g>
    </svg>
  );
};
