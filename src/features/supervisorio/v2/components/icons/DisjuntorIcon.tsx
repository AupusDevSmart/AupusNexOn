/**
 * DISJUNTOR ICON — estilo SCADA (Elipse): CAIXA FECHADA (quadrado sólido) + terminais.
 *
 * A posição do disjuntor é comunicada pela COR do quadrado, não por um contato
 * desenhado dentro dele: vermelho = FECHADO, verde = ABERTO (convenção de sala de
 * controle). Quem decide a cor é o EquipmentNode (useDisjuntorEstado → `color`);
 * sem telemetria o quadrado fica na cor do tema (neutro), ainda como caixa.
 * Monocromático (currentColor) → recolorível pelo tema e serializável (export).
 *
 * `estado` é aceito só por compatibilidade com chamadas antigas — o símbolo é o
 * mesmo em qualquer estado; a diferença é a cor passada em `color`.
 */

import React from 'react';

interface DisjuntorIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  estado?: 'aberto' | 'fechado' | null;
}

export const DisjuntorIcon: React.FC<DisjuntorIconProps> = ({
  width = 80,
  height = 80,
  color = 'currentColor',
  strokeWidth = 2.4,
  className = '',
}) => {
  return (
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
      {/* terminais */}
      <line x1="40" y1="6" x2="40" y2="22" />
      <line x1="40" y1="58" x2="40" y2="74" />
      {/* corpo: caixa fechada (quadrado sólido), cantos quase retos como no Elipse */}
      <rect x="22" y="22" width="36" height="36" rx="2" fill="currentColor" />
    </svg>
  );
};
