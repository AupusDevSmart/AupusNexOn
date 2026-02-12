/**
 * TRANSFORMADOR ICON
 * Usa IconWrapper para ajuste automático
 */
import React from 'react';
import { IconWrapper } from './IconWrapper';
import transformadorPng from '@/assets/images/transformador.png';

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
  className = '',
}) => {
  return (
    <IconWrapper
      src={transformadorPng}
      alt="Transformador"
      width={width}
      height={height}
      className={className}
    />
  );
};
