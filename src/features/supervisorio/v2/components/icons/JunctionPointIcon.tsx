/**
 * JUNCTION POINT ICON — ponto de junção (nó de conexão).
 * Pequeno ponto preenchido, centralizado no vértice.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
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
  width = 80,
  height = 80,
  color = 'currentColor',
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
    >
      <circle cx="40" cy="40" r="10" fill="currentColor" stroke="none" />
    </svg>
  );
};
