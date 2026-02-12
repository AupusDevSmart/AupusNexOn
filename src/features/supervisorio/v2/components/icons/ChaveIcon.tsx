/**
 * CHAVE ICON
 * Ícone para categoria: Chave
 * Usa IconWrapper para ajuste automático
 */

import React from 'react';
import { IconWrapper } from './IconWrapper';
import chaveSvg from '@/assets/images/chave (2).svg';

interface ChaveIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const ChaveIcon: React.FC<ChaveIconProps> = ({
  width = 80,
  height = 80,
  className = '',
}) => {
  return (
    <IconWrapper
      src={chaveSvg}
      alt="Chave"
      width={width}
      height={height}
      className={className}
    />
  );
};
