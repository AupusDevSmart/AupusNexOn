/**
 * ConnectionsOverlayLegacy.tsx
 *
 * Componente de fallback quando feature flag 'habilitarConexoesSvg' está desabilitada.
 * Renderiza conexões de forma simplificada ou esconde completamente.
 *
 * Usado como rollback seguro em caso de regressão em produção.
 */

import React from 'react';
import type { Connection, ComponenteDU } from './DomAnchoredConnectionsOverlay';

interface ConnectionsOverlayLegacyProps {
  connections: Connection[];
  componentes: ComponenteDU[];
  containerRef?: React.RefObject<HTMLDivElement | null>;
  modoEdicao?: boolean;
}

/**
 * Opção 1: Renderizar nada (modo mais seguro)
 */
export function ConnectionsOverlayLegacy({
  connections,
  componentes,
}: ConnectionsOverlayLegacyProps) {
  // Log para debugging
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[ConnectionsOverlayLegacy] Feature flag desabilitada - conexões SVG não renderizadas',
      {
        connections: connections.length,
        componentes: componentes.length,
      }
    );
  }

  // Opção 1: Retornar null (sem renderização)
  return null;

  // Opção 2: Renderizar mensagem de fallback (descomente se preferir)
  /*
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        padding: '8px 12px',
        background: 'rgba(255, 165, 0, 0.9)',
        color: 'white',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      ⚠️ Conexões temporariamente desabilitadas
    </div>
  );
  */

  // Opção 3: Renderizar linhas CSS simples (descomente se preferir)
  /*
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {connections.map((conn) => {
        const fromComp = componentes.find((c) => c.id === conn.from);
        const toComp = componentes.find((c) => c.id === conn.to);

        if (!fromComp || !toComp) return null;

        // Linha CSS simples (sem SVG)
        return (
          <div
            key={conn.id}
            style={{
              position: 'absolute',
              left: `${fromComp.posicao.x}%`,
              top: `${fromComp.posicao.y}%`,
              width: `${Math.abs(toComp.posicao.x - fromComp.posicao.x)}%`,
              height: '2px',
              background: '#3b82f6',
              transformOrigin: 'left center',
            }}
          />
        );
      })}
    </div>
  );
  */
}

export default ConnectionsOverlayLegacy;
