/**
 * DISJUNTOR ICON — estilo SCADA (Elipse): caixa sólida, sem nada desenhado dentro
 * e sem terminais (a linha de conexão encosta no corpo — ver
 * getEquipmentIconBody/getPortPoint).
 *
 * A posição do disjuntor é comunicada SÓ pela COR da caixa (vermelho = FECHADO,
 * verde = ABERTO, cinza = sem status — quem decide é o EquipmentNode via
 * useDisjuntorEstado → `color`). O contato desenhado dentro (NEXON-29) foi
 * retirado a pedido: a caixa é toda cinza, vermelha ou verde.
 */

import React from 'react';

interface DisjuntorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  /** Mantido por compatibilidade (EquipmentIconFactory repassa); o desenho não muda com ele. */
  estado?: 'aberto' | 'fechado' | null;
}

export const DisjuntorIcon: React.FC<DisjuntorIconProps> = ({
  width = 80,
  height = 80,
  color = 'currentColor',
  strokeWidth = 2.4,
  className = '',
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ color, display: 'block' }}
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* corpo: caixa fechada (quadrado sólido), cantos quase retos como no Elipse */}
    <rect x="22" y="22" width="36" height="36" rx="2" fill="currentColor" />
  </svg>
);
