/**
 * DISJUNTOR ICON (estilo Traço / IEC) — agora inline SVG (era <img> raster).
 * Símbolo: caixa com "×" (disjuntor de gaveta) + terminais.
 * Aceita `estado` opcional (aberto/fechado): fechado = contato ligado;
 * aberto = contato levantado. Sem estado, desenha o símbolo neutro (caixa + ×).
 * Monocromático (currentColor) → recolorível pelo tema e serializável (export).
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
  estado = null,
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
      <line x1="40" y1="6" x2="40" y2="20" />
      <line x1="40" y1="60" x2="40" y2="74" />
      {/* corpo */}
      <rect x="20" y="20" width="40" height="40" rx="5" />
      {estado === 'aberto' ? (
        // contato levantado (aberto)
        <line x1="40" y1="20" x2="26" y2="46" />
      ) : estado === 'fechado' ? (
        // contato ligado (fechado)
        <line x1="40" y1="20" x2="40" y2="60" />
      ) : (
        // neutro (estado desconhecido): contato de manobra do disjuntor — pivô na
        // base + haste do contato + contato fixo no topo. Lê como dispositivo de
        // manobra (IEC), não como "×" de erro. A cor (verde/vermelho) diferencia
        // aberto/fechado quando há telemetria.
        <>
          <circle cx="40" cy="54" r="2.9" fill="currentColor" stroke="none" />
          <line x1="40" y1="54" x2="47" y2="27" />
          <circle cx="40" cy="25.5" r="2.9" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
};
