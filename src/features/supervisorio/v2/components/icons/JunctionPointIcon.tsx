/**
 * JUNCTION POINT ICON - Ponto de Junção Invisível
 *
 * Renderiza um círculo pequeno para representar um ponto de junção
 * onde múltiplas conexões se encontram.
 */

import React from 'react';

interface JunctionPointIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const JunctionPointIcon: React.FC<JunctionPointIconProps> = ({
  width = 10,
  height = 10,
  color = 'currentColor',
  strokeWidth = 0,
  className = '',
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Círculo pequeno preenchido */}
      <circle
        cx="5"
        cy="5"
        r="4"
        fill={color}
        stroke="none"
      />
    </svg>
  );
};
