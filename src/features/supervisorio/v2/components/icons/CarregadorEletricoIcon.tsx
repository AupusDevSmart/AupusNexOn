import React from 'react';
import carregadorEletricoSvg from '../../../../../assets/images/carregador-eletrico.svg';
import { IconWrapper } from './IconWrapper';

interface CarregadorEletricoIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export const CarregadorEletricoIcon: React.FC<CarregadorEletricoIconProps> = ({
  width = 80,
  height = 80,
  className = '',
}) => {
  return (
    <IconWrapper
      src={carregadorEletricoSvg}
      alt="Carregador Elétrico"
      width={width}
      height={height}
      className={className}
    />
  );
};
