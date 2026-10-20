/**
 * DISJUNTOR ICON — estilo SCADA (Elipse): caixa sólida com o CONTATO desenhado
 * dentro, sem terminais (a linha de conexão encosta no corpo — ver
 * getEquipmentIconBody/getPortPoint).
 *
 * A posição do disjuntor é comunicada pela COR da caixa (vermelho = FECHADO,
 * verde = ABERTO, cinza = sem status — quem decide é o EquipmentNode via
 * useDisjuntorEstado → `color`) e também pelo contato desenhado dentro dela
 * (branco em caixa escura, grafite em caixa clara — ver corDoContato):
 *   - fechado: lâmina reta ligando os dois contatos fixos;
 *   - aberto / sem status: lâmina levantada (símbolo IEC de manobra).
 * Sem o contato a caixa cinza virava um "quadrado vazio" (NEXON-29).
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

/** Contato legível sobre a caixa: grafite em cor clara (cinza, verde, tema escuro), branco em cor escura. */
const corDoContato = (cor: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#1F2937' : '#ffffff';
};

export const DisjuntorIcon: React.FC<DisjuntorIconProps> = ({
  width = 80,
  height = 80,
  color = 'currentColor',
  strokeWidth = 2.4,
  className = '',
  estado = null,
}) => {
  const contato = corDoContato(color);
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
      {/* corpo: caixa fechada (quadrado sólido), cantos quase retos como no Elipse */}
      <rect x="22" y="22" width="36" height="36" rx="2" fill="currentColor" />
      {/* contato de manobra sobre a caixa */}
      <g stroke={contato} strokeWidth={3}>
        <line x1="40" y1="22" x2="40" y2="29" />
        <line x1="40" y1="51" x2="40" y2="58" />
        {estado === 'fechado' ? (
          <line x1="40" y1="29" x2="40" y2="51" />
        ) : (
          <line x1="40" y1="51" x2="30" y2="31" />
        )}
        <line x1="36" y1="29" x2="44" y2="29" />
        <circle cx="40" cy="51" r="2" fill={contato} stroke="none" />
      </g>
    </svg>
  );
};
