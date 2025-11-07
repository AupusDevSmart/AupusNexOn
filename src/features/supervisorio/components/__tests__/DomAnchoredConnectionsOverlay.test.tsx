/**
 * DomAnchoredConnectionsOverlay - Unit Tests
 *
 * Testes mínimos mas eficazes para garantir funcionalidade básica do overlay de conexões.
 *
 * Setup: npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
 * Run: npm run test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DomAnchoredConnectionsOverlay } from '../DomAnchoredConnectionsOverlay';
import type { ComponenteDU, Connection } from '../DomAnchoredConnectionsOverlay';

// Mock de window.NEXON_DEBUG
(window as any).NEXON_DEBUG = false;

describe('DomAnchoredConnectionsOverlay', () => {
  let containerRef: React.RefObject<HTMLDivElement>;
  let componentes: ComponenteDU[];
  let connections: Connection[];

  beforeEach(() => {
    // Setup container 800x500
    const container = document.createElement('div');
    container.id = 'test-container';
    container.style.width = '800px';
    container.style.height = '500px';
    container.style.position = 'relative';
    document.body.appendChild(container);

    containerRef = { current: container };

    // Setup componentes (2 nós)
    componentes = [
      {
        id: 'node1',
        tipo: 'MEDIDOR',
        nome: 'Medidor 1',
        posicao: { x: 12.5, y: 20 }, // 12.5% de 800 = 100px, 20% de 500 = 100px
        status: 'NORMAL',
        dados: {},
      },
      {
        id: 'node2',
        tipo: 'TRANSFORMADOR',
        nome: 'Transformador 1',
        posicao: { x: 31.25, y: 20 }, // 31.25% de 800 = 250px, 20% de 500 = 100px
        status: 'NORMAL',
        dados: {},
      },
    ];

    // Setup conexões
    connections = [
      {
        id: 'conn1',
        from: 'node1',
        to: 'node2',
        fromPort: 'right',
        toPort: 'left',
      },
    ];

    // Mock de nós no DOM
    componentes.forEach((comp) => {
      const node = document.createElement('div');
      node.setAttribute('data-node-id', comp.id);
      node.style.position = 'absolute';
      node.style.left = `${comp.posicao.x}%`;
      node.style.top = `${comp.posicao.y}%`;
      node.style.width = '64px';
      node.style.height = '64px';
      node.style.transform = 'translate(-50%, -50%)';
      container.appendChild(node);
    });

    // Mock de getBoundingClientRect para os nós
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-node-id') === 'node1') {
        return {
          x: 68, // 100 - 32 (transform -50% of 64px)
          y: 68, // 100 - 32
          width: 64,
          height: 64,
          left: 68,
          top: 68,
          right: 132,
          bottom: 132,
          toJSON: () => {},
        } as DOMRect;
      }
      if (this.getAttribute('data-node-id') === 'node2') {
        return {
          x: 218, // 250 - 32
          y: 68,
          width: 64,
          height: 64,
          left: 218,
          top: 68,
          right: 282,
          bottom: 132,
          toJSON: () => {},
        } as DOMRect;
      }
      if (this.id === 'test-container') {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 500,
          left: 0,
          top: 0,
          right: 800,
          bottom: 500,
          toJSON: () => {},
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        toJSON: () => {},
      } as DOMRect;
    });
  });

  it('renderiza SVG com classe correta', () => {
    render(
      <DomAnchoredConnectionsOverlay
        connections={connections}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={false}
      />
    );

    const svg = document.querySelector('.nexon-connections-overlay');
    expect(svg).toBeInTheDocument();
    expect(svg?.tagName).toBe('svg');
  });

  it('renderiza número correto de paths', () => {
    render(
      <DomAnchoredConnectionsOverlay
        connections={connections}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={false}
      />
    );

    const paths = document.querySelectorAll('.nexon-connection-path');
    expect(paths).toHaveLength(connections.length);
  });

  it('calcula path com coordenadas esperadas', () => {
    render(
      <DomAnchoredConnectionsOverlay
        connections={connections}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={false}
      />
    );

    const path = document.querySelector('.nexon-connection-path');
    const dAttribute = path?.getAttribute('d');

    // Path deve iniciar em node1 (right port = centerX + width/2 = 100 + 32 = 132)
    // e terminar em node2 (left port = centerX - width/2 = 250 - 32 = 218)
    expect(dAttribute).toBeDefined();
    expect(dAttribute).toContain('M'); // Move to
    expect(dAttribute).toContain('L'); // Line to

    // Verificar que contém coordenadas aproximadas
    // Node1 right port: x=132, y=100 (center)
    // Node2 left port: x=218, y=100
    const hasStartCoord = dAttribute?.includes('132') || dAttribute?.includes('100');
    const hasEndCoord = dAttribute?.includes('218') || dAttribute?.includes('100');

    expect(hasStartCoord).toBe(true);
    expect(hasEndCoord).toBe(true);
  });

  it('não renderiza SVG quando container tem dimensões zero', () => {
    // Alterar dimensões do container para 0
    if (containerRef.current) {
      containerRef.current.style.width = '0px';
      containerRef.current.style.height = '0px';
    }

    const { container } = render(
      <DomAnchoredConnectionsOverlay
        connections={connections}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={false}
      />
    );

    // Componente deve retornar null
    expect(container.firstChild).toBeNull();
  });

  it('ignora conexões com nós ausentes (anti-fantasma)', () => {
    const invalidConnection: Connection = {
      id: 'conn-invalid',
      from: 'node-nao-existe',
      to: 'node2',
      fromPort: 'right',
      toPort: 'left',
    };

    render(
      <DomAnchoredConnectionsOverlay
        connections={[...connections, invalidConnection]}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={false}
      />
    );

    const paths = document.querySelectorAll('.nexon-connection-path');

    // Deve renderizar apenas a conexão válida
    expect(paths).toHaveLength(1);
  });

  it('aplica data-edit-mode corretamente', () => {
    const { rerender } = render(
      <DomAnchoredConnectionsOverlay
        connections={connections}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={false}
      />
    );

    let svg = document.querySelector('.nexon-connections-overlay');
    expect(svg?.getAttribute('data-edit-mode')).toBe('false');

    // Re-render com modoEdicao=true
    rerender(
      <DomAnchoredConnectionsOverlay
        connections={connections}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={true}
      />
    );

    svg = document.querySelector('.nexon-connections-overlay');
    expect(svg?.getAttribute('data-edit-mode')).toBe('true');
  });

  it('renderiza <g data-layer="connections">', () => {
    render(
      <DomAnchoredConnectionsOverlay
        connections={connections}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={false}
      />
    );

    const layer = document.querySelector('[data-layer="connections"]');
    expect(layer).toBeInTheDocument();
    expect(layer?.tagName).toBe('g');
  });

  it('define viewBox com dimensões do container', () => {
    render(
      <DomAnchoredConnectionsOverlay
        connections={connections}
        componentes={componentes}
        containerRef={containerRef}
        modoEdicao={false}
      />
    );

    const svg = document.querySelector('.nexon-connections-overlay');
    const viewBox = svg?.getAttribute('viewBox');

    // Deve ser "0 0 800 500"
    expect(viewBox).toBe('0 0 800 500');
  });
});
