/**
 * ÍCONE - QGBT (Quadro Geral de Baixa Tensão) - Monocromático
 *
 * Ícone SVG simplificado de quadro elétrico.
 * Usa currentColor para adaptar ao tema claro/escuro.
 */

import React from 'react';
import { ICON } from '../../utils/diagramConstants';

interface QGBTIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const QGBTIcon: React.FC<QGBTIconProps> = ({
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
      {/* Retângulo externo (corpo do quadro) */}
      <rect
        x="0.25"
        y="0.17"
        width="1.5"
        height="1.66"
        rx="0.075"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
      />

      {/* Porta (retângulo interno) */}
      <rect
        x="0.375"
        y="0.29"
        width="1.25"
        height="1.42"
        rx="0.05"
        stroke="currentColor"
        strokeWidth={strokeWidth * 0.8}
        fill="none"
      />

      {/* Fechadura */}
      <circle
        cx="1.55"
        cy="1.0"
        r="0.0625"
        stroke="currentColor"
        strokeWidth={strokeWidth * 0.8}
        fill="none"
      />

      {/* Disjuntores simulados (linhas horizontais) */}
      <g transform="translate(0.55, 0.415)">
        {/* Grupo 1 - 3 disjuntores */}
        <rect x="0" y="0" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />
        <rect x="0.325" y="0" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />
        <rect x="0.65" y="0" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />

        {/* Grupo 2 */}
        <rect x="0" y="0.5" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />
        <rect x="0.325" y="0.5" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />
        <rect x="0.65" y="0.5" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />

        {/* Grupo 3 */}
        <rect x="0" y="1.0" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />
        <rect x="0.325" y="1.0" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />
        <rect x="0.65" y="1.0" width="0.25" height="0.375" rx="0.025" stroke="currentColor" strokeWidth={strokeWidth * 0.6} fill="none" />
      </g>
    </svg>
  );
};
