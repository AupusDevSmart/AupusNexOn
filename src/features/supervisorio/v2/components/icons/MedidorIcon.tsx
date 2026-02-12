/**
 * MEDIDOR ICON (Power Meter)
 * Usa SVG da pasta assets
 */

import React from 'react';
import powerMeterSvg from '@/assets/images/power-meter.svg';

interface MedidorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const MedidorIcon: React.FC<MedidorIconProps> = ({
  width = 60,
  height = 60,
  className = '',
}) => {
  return (
    <img
      src={powerMeterSvg}
      alt="Medidor"
      width={width}
      height={height}
      className={className}
    />
  );
};
