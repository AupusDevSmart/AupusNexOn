/**
 * SOFT-STARTER ICON — mesma caixa sólida do DisjuntorIcon (corpo 22..58, a linha de
 * conexão encosta nela), com o par de tiristores em antiparalelo desenhado dentro:
 * é o que distingue a partida suave de um DJ no unifilar.
 *
 * A COR da caixa segue o estado, como no DJ (vermelho = ligado/fechado, verde =
 * desligado/aberto, cinza = sem status) — decidida no EquipmentNode.
 */

import React from 'react';

interface SoftStarterIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  estado?: 'aberto' | 'fechado' | null;
}

/** Desenho legível sobre a caixa: grafite em cor clara, branco em cor escura (igual ao DJ). */
const corDoDesenho = (cor: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#1F2937' : '#ffffff';
};

export const SoftStarterIcon: React.FC<SoftStarterIconProps> = ({
  width = 80,
  height = 80,
  color = 'currentColor',
  strokeWidth = 2.4,
  className = '',
}) => {
  const tr = corDoDesenho(color);
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
      <rect x="22" y="22" width="36" height="36" rx="2" fill="currentColor" />
      <g stroke={tr} strokeWidth={2.2}>
        {/* entrada / saída e barramentos do par */}
        <line x1="40" y1="22" x2="40" y2="28" />
        <line x1="40" y1="52" x2="40" y2="58" />
        <line x1="32" y1="28" x2="48" y2="28" />
        <line x1="32" y1="52" x2="48" y2="52" />
        {/* tiristor 1: conduz para baixo */}
        <line x1="32" y1="28" x2="32" y2="35" />
        <polygon points="28,35 36,35 32,42" fill={tr} />
        <line x1="28" y1="42" x2="36" y2="42" />
        <line x1="32" y1="42" x2="32" y2="52" />
        <line x1="35" y1="42" x2="37.5" y2="45.5" />
        {/* tiristor 2: conduz para cima (antiparalelo) */}
        <line x1="48" y1="52" x2="48" y2="45" />
        <polygon points="44,45 52,45 48,38" fill={tr} />
        <line x1="44" y1="38" x2="52" y2="38" />
        <line x1="48" y1="38" x2="48" y2="28" />
        <line x1="45" y1="38" x2="42.5" y2="34.5" />
      </g>
    </svg>
  );
};
