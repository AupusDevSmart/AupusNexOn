/**
 * GRUPOS DO UNIFILAR (NEXON-31)
 *
 * - GrupoCard: o grupo recolhido, um bloco com nome, o que tem dentro e o pior
 *   status. Clique abre (zoom animado nos membros); no modo edição arrasta.
 * - GrupoMoldura: o grupo aberto, moldura tracejada em volta dos membros com o
 *   nome; clicar no nome recolhe.
 */

import React, { useRef, type MouseEvent } from 'react';
import { motion } from 'motion/react';
import { useDiagramStore } from '../../hooks/useDiagramStore';
import { GRID, LABEL, getThemeColors } from '../../utils/diagramConstants';
import { TAMANHO_CARD, resumoDoGrupo, type CardDeGrupo, type GrupoAberto } from '../../utils/grupos';
import type { Equipment } from '../../types/diagram.types';

/** Verde da marca: cor do grupo quando ele não tem uma própria. */
export const COR_GRUPO_PADRAO = '#70C04B';

const COR_STATUS: Record<NonNullable<Equipment['status']>, string> = {
  normal: '#70C04B',
  alerta: '#F59E0B',
  falha: '#EF4444',
  desconhecido: '#94A3B8',
};

const MOLA = { type: 'spring', stiffness: 320, damping: 26 } as const;

const encurtar = (texto: string, max: number) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);

const plural = (rotulo: string, n: number) => {
  if (n === 1) return rotulo;
  if (rotulo.endsWith('r')) return `${rotulo}es`; // Inversor → Inversores
  if (rotulo.endsWith('el')) return `${rotulo.slice(0, -2)}éis`; // Painel → Painéis
  return `${rotulo}s`;
};

// ============================================================================
// BLOCO RECOLHIDO
// ============================================================================

interface GrupoCardProps {
  card: CardDeGrupo;
}

const GrupoCardImpl: React.FC<GrupoCardProps> = ({ card }) => {
  const theme = useDiagramStore(st => st.theme);
  const modo = useDiagramStore(st => st.editor.mode);
  const arrastando = useDiagramStore(st => st.editor.draggingEquipmentId === card.no.id);
  const cores = getThemeColors(theme);
  const escuro = theme === 'dark';

  const { grupo, no, membros } = card;
  const cor = grupo.cor || COR_GRUPO_PADRAO;
  const x = no.posicaoX * GRID.SIZE;
  const y = no.posicaoY * GRID.SIZE;
  const w = TAMANHO_CARD.width * GRID.SIZE;
  const h = TAMANHO_CARD.height * GRID.SIZE;
  const status = no.status ?? 'normal';

  const resumo = resumoDoGrupo(membros)
    .slice(0, 2)
    .map(r => `${r.quantidade} ${plural(r.rotulo, r.quantidade)}`)
    .join(' · ');

  // Clique sem arrastar = abrir. Guarda onde o mouse desceu para distinguir.
  const descida = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    descida.current = { x: e.clientX, y: e.clientY };
    if (modo !== 'edit') return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const st = useDiagramStore.getState();
    st.clearSelection();
    st.startDraggingEquipamento(no.id, { x: p.x - x, y: p.y - y });
  };

  const handleClick = (e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    const d = descida.current;
    descida.current = null;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return; // foi arraste
    useDiagramStore.getState().alternarGrupo(grupo.id);
  };

  const fundo = escuro ? '#1B1B3A' : '#FFFFFF';
  const pilha = escuro ? '#26264A' : '#F1F5F9';

  return (
    <motion.g
      className="grupo-card"
      data-grupo-id={grupo.id}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      whileHover={modo === 'edit' ? undefined : { scale: 1.04 }}
      transition={MOLA}
      style={{
        transformBox: 'fill-box',
        transformOrigin: 'center',
        cursor: modo === 'edit' ? (arrastando ? 'grabbing' : 'grab') : 'pointer',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <title>{`${grupo.nome} — ${membros.length} equipamento(s). Clique para abrir.`}</title>
      {/* "Pilha" atrás do bloco: lembra que há vários dentro */}
      <rect x={x + 8} y={y + 8} width={w} height={h} rx={12} fill={pilha} stroke={cor} strokeOpacity={0.25} />
      <rect x={x + 4} y={y + 4} width={w} height={h} rx={12} fill={pilha} stroke={cor} strokeOpacity={0.4} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill={fundo}
        stroke={cor}
        strokeWidth={2}
        filter="url(#unifilar-node-shadow)"
      />
      {/* Faixa de cor à esquerda */}
      <rect x={x} y={y} width={6} height={h} rx={3} fill={cor} />

      {/* Status (pior entre os membros) */}
      <circle cx={x + w - 16} cy={y + 16} r={6} fill={COR_STATUS[status]}>
        {status === 'falha' && (
          <animate attributeName="opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite" />
        )}
      </circle>

      <text
        x={x + 18}
        y={y + 30}
        fontSize={16}
        fontWeight={600}
        fontFamily={LABEL.FONT_FAMILY}
        fill={cores.labelColor}
        pointerEvents="none"
      >
        {encurtar(grupo.nome, 15)}
      </text>
      <text
        x={x + 18}
        y={y + 52}
        fontSize={12}
        fontFamily={LABEL.FONT_FAMILY}
        fill={cores.labelColor}
        opacity={0.7}
        pointerEvents="none"
      >
        {encurtar(resumo, 22)}
      </text>
      {/* Contador + "abrir" */}
      <g pointerEvents="none">
        <rect x={x + w - 46} y={y + h - 26} width={36} height={18} rx={9} fill={cor} fillOpacity={0.15} />
        <text
          x={x + w - 28}
          y={y + h - 13}
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          fontFamily={LABEL.FONT_FAMILY}
          fill={cor}
        >
          {`+${membros.length}`}
        </text>
      </g>
    </motion.g>
  );
};

export const GrupoCard = React.memo(GrupoCardImpl);

// ============================================================================
// MOLDURA DO GRUPO ABERTO
// ============================================================================

interface GrupoMolduraProps {
  aberto: GrupoAberto;
}

const GrupoMolduraImpl: React.FC<GrupoMolduraProps> = ({ aberto }) => {
  const theme = useDiagramStore(st => st.theme);
  const cores = getThemeColors(theme);
  const { grupo, caixa, membros } = aberto;
  const cor = grupo.cor || COR_GRUPO_PADRAO;

  // Folga em volta dos membros (os rótulos ficam embaixo/ao lado do símbolo)
  const x = (caixa.minX - 0.6) * GRID.SIZE;
  const y = (caixa.minY - 1.4) * GRID.SIZE;
  const w = (caixa.maxX - caixa.minX + 1.2) * GRID.SIZE;
  const h = (caixa.maxY - caixa.minY + 2.2) * GRID.SIZE;

  const titulo = `${encurtar(grupo.nome, 40)} · ${membros.length}`;
  const larguraTitulo = Math.max(120, titulo.length * 8 + 44);

  const recolher = (e: MouseEvent) => {
    e.stopPropagation();
    useDiagramStore.getState().alternarGrupo(grupo.id);
  };

  return (
    <motion.g
      className="grupo-moldura"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={MOLA}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={16}
        fill={cor}
        fillOpacity={0.05}
        stroke={cor}
        strokeOpacity={0.7}
        strokeWidth={1.5}
        strokeDasharray="10 6"
        pointerEvents="none"
      />
      <g
        style={{ cursor: 'pointer' }}
        onMouseDown={e => e.stopPropagation()}
        onClick={recolher}
      >
        <title>Recolher grupo</title>
        <rect x={x + 12} y={y - 14} width={larguraTitulo} height={28} rx={14} fill={cor} />
        <text
          x={x + 28}
          y={y + 5}
          fontSize={13}
          fontWeight={600}
          fontFamily={LABEL.FONT_FAMILY}
          fill="#FFFFFF"
          pointerEvents="none"
        >
          {titulo}
        </text>
        {/* seta "recolher" */}
        <path
          d={`M ${x + larguraTitulo - 8} ${y + 3} l -6 -6 l -6 6`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      </g>
      {/* rótulo discreto para quem não percebe o clique */}
      <text
        x={x + w - 12}
        y={y + h - 10}
        fontSize={10}
        textAnchor="end"
        fontFamily={LABEL.FONT_FAMILY}
        fill={cores.labelColor}
        opacity={0.45}
        pointerEvents="none"
      >
        clique no nome para recolher
      </text>
    </motion.g>
  );
};

export const GrupoMoldura = React.memo(GrupoMolduraImpl);
