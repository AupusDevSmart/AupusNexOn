/**
 * PIVÔ ICON
 * Usa IconWrapper para ajuste automático
 */
import React from 'react';
import { IconWrapper } from './IconWrapper';

// Importar PNG diretamente como URL
const pivoPng = '/src/assets/images/pivot-transparente.png';

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
      src={pivoPng}
      alt="Pivô"
      width={width}
      height={height}
      className={className}
    />
  );
};
