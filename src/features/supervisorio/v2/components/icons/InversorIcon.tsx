/**
 * INVERSOR ICON
 * Usa SVG da pasta assets
 */

import React from 'react';
import inversorSvg from '@/assets/images/inversor.svg';

interface InversorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const InversorIcon: React.FC<InversorIconProps> = ({
  width = 80,
  height = 80,
  className = '',
}) => {
  return (
    <img
      src={inversorSvg}
      alt="Inversor"
      width={width}
      height={height}
      className={className}
    />
  );
};
