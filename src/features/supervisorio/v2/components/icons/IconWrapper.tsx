/**
 * ICON WRAPPER
 * Componente base para todos os ícones de equipamentos.
 * Garante que qualquer imagem (SVG/PNG) sempre se ajuste ao espaço disponível.
 *
 * USO:
 * <IconWrapper src={meuSvg} width={80} height={160} alt="Meu Equipamento" />
 */

import React from 'react';

interface IconWrapperProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export const IconWrapper: React.FC<IconWrapperProps> = ({
  src,
  alt,
  width = 80,
  height = 80,
  className = '',
}) => {
  return (
    <div
      className={className}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
};
