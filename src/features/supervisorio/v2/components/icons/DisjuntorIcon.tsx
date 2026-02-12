/**
 * DISJUNTOR ICON
 * Usa SVG da pasta assets
 */

import React from 'react';
import disjuntorSvg from '@/assets/images/disjuntor.svg';

interface DisjuntorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const DisjuntorIcon: React.FC<DisjuntorIconProps> = ({
  width = 80,
  height = 80,
  className = '',
}) => {
  return (
    <img
      src={disjuntorSvg}
      alt="Disjuntor"
      width={width}
      height={height}
      className={className}
    />
  );
};
