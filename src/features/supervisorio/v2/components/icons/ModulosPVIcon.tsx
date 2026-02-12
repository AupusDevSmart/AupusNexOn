/**
 * MÓDULOS PV ICON (Painéis Solares)
 * Usa IconWrapper para ajuste automático
 */

import React from 'react';
import { IconWrapper } from './IconWrapper';
import painelSolarSvg from '@/assets/images/painel-solar (1).svg';

interface ModulosPVIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const ModulosPVIcon: React.FC<ModulosPVIconProps> = ({
  width = 80,
  height = 80,
  className = '',
}) => {
  return (
    <IconWrapper
      src={painelSolarSvg}
      alt="Painéis Solares"
      width={width}
      height={height}
      className={className}
    />
  );
};
