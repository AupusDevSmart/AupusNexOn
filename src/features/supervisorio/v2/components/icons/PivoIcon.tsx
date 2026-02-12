/**
 * PIVÔ ICON
 * Usa IconWrapper para ajuste automático
 */
import React from 'react';
import { IconWrapper } from './IconWrapper';
import pivoSvg from '../../../../../assets/images/pivot-transparente.svg';

interface PivoIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const PivoIcon: React.FC<PivoIconProps> = ({
  width = 80,
  height = 80,
  className = '',
}) => {
  return (
    <IconWrapper
      src={pivoSvg}
      alt="Pivô"
      width={width}
      height={height}
      className={className}
    />
  );
};
