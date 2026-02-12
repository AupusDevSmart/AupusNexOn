/**
 * BANCO CAPACITOR ICON
 * Ícone para categoria: Banco Capacitor
 */

import React from 'react';

interface BancoCapacitorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const BancoCapacitorIcon: React.FC<BancoCapacitorIconProps> = ({
  width = 80,
  height = 80,
  color = '#1F2937',
  strokeWidth = 2,
  className = '',
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
    >
      <path d="M22 11H14.6C14.7 9.4 15.1 7.9 15.8 6.4L14 5.5C12 9.5 12 14.4 14 18.4L15.8 17.5C15.1 16.1 14.7 14.5 14.6 12.9H22V11Z"/>
      <path d="M9 11H2V13H9V19H11V5H9V11Z"/>
    </svg>
  );
};
