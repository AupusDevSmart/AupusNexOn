/**
 * TRANSFORMADOR ICON (estilo Traço / IEC)
 * Dois enrolamentos (círculos sobrepostos) + terminais.
 * Inline SVG monocromático (currentColor) → recolorível e serializável.
 * Também usado para TC / TP (mapeados no factory).
 */
import React from 'react';

interface TransformadorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const TransformadorIcon: React.FC<TransformadorIconProps> = ({
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
      <line x1="40" y1="8" x2="40" y2="17" />
      <circle cx="40" cy="32" r="15" />
      <circle cx="40" cy="48" r="15" />
      <line x1="40" y1="63" x2="40" y2="72" />
    </svg>
  );
};
