/**
 * DiagramGrid.tsx
 *
 * Componente que renderiza um grid (quadriculado) de fundo para facilitar
 * o alinhamento e posicionamento simétrico dos componentes no diagrama.
 *
 * Features:
 * - Grid principal e sub-grid (linhas mais finas)
 * - Configurável: tamanho, cor, opacidade
 * - Responsivo: se adapta ao tamanho do container
 * - Performance: usa SVG patterns para eficiência
 */

import React, { useEffect, useState } from 'react';

// Função para detectar se está em modo escuro
const useThemeDetection = () => {
  const [isDarkBackground, setIsDarkBackground] = useState(true);

  useEffect(() => {
    // Detecta se o tema é escuro baseado no HTML ou body
    const checkTheme = () => {
      const htmlElement = document.documentElement;
      const isDark =
        htmlElement.classList.contains('dark') ||
        htmlElement.dataset.theme === 'dark' ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkBackground(isDark);
    };

    checkTheme();

    // Observer para mudanças de classe no HTML
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    // Listener para mudanças de preferência do sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkTheme);
    };
  }, []);

  return isDarkBackground;
};

interface DiagramGridProps {
  /** Largura do container em pixels */
  width: number;
  /** Altura do container em pixels */
  height: number;
  /** Tamanho do quadrado do grid principal em pixels (default: 50) */
  gridSize?: number;
  /** Número de subdivisões dentro de cada quadrado (default: 5) */
  subdivisions?: number;
  /** Cor das linhas do grid principal (default: #e5e7eb) */
  gridColor?: string;
  /** Cor das linhas do sub-grid (default: #f3f4f6) */
  subGridColor?: string;
  /** Opacidade do grid (default: 0.5) */
  opacity?: number;
  /** Se o grid está visível (default: true) */
  visible?: boolean;
  /** Espessura da linha do grid principal (default: 1) */
  strokeWidth?: number;
  /** Espessura da linha do sub-grid (default: 0.5) */
  subStrokeWidth?: number;
  /** Classe CSS adicional */
  className?: string;
}

export const DiagramGrid: React.FC<DiagramGridProps> = ({
  width,
  height,
  gridSize = 50,
  subdivisions = 5,
  gridColor: customGridColor,
  subGridColor: customSubGridColor,
  opacity = 0.2,
  visible = true,
  strokeWidth = 0.8,  // Reduzido para ser menos intrusivo
  subStrokeWidth = 0.3,  // Mais fino para subdivisões
  className = ''
}) => {
  // Como o diagrama SEMPRE tem fundo preto (bg-black),
  // vamos usar cores claras que contrastam bem com preto
  const gridColor = customGridColor || '#ffffff';  // Branco para linhas principais
  const subGridColor = customSubGridColor || '#d1d5db';  // Cinza mais claro para subdivisões

  if (!visible || width <= 0 || height <= 0) {
    return null;
  }

  const subGridSize = gridSize / subdivisions;

  // IDs únicos para os patterns
  const patternId = `grid-pattern-${gridSize}`;
  const subPatternId = `sub-grid-pattern-${subGridSize}`;

  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{
        zIndex: 0, // Fica atrás de tudo
        opacity
      }}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Pattern para o grid principal com quadrados preenchidos */}
        <pattern
          id={patternId}
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
        >
          {/* Quadrado com preenchimento sutil */}
          <rect
            width={gridSize}
            height={gridSize}
            fill={gridColor}
            fillOpacity="0.03"  // Preenchimento muito sutil
          />

          {/* Bordas do quadrado */}
          <rect
            width={gridSize}
            height={gridSize}
            fill="none"
            stroke={gridColor}
            strokeWidth={strokeWidth}
            strokeOpacity="0.3"  // Bordas visíveis mas sutis
          />
        </pattern>
      </defs>

      {/* Aplicar o pattern em todo o canvas */}
      <rect
        width="100%"
        height="100%"
        fill={`url(#${patternId})`}
      />

      {/* Linhas de borda para fechar o grid */}
      <rect
        width="100%"
        height="100%"
        fill="none"
        stroke={gridColor}
        strokeWidth={strokeWidth}
      />

      {/* Opcional: Linhas centrais mais destacadas para referência */}
      <g className="center-lines">
        {/* Linha vertical central */}
        <line
          x1={width / 2}
          y1="0"
          x2={width / 2}
          y2={height}
          stroke={gridColor}
          strokeWidth={strokeWidth * 1.5}
          strokeDasharray="5,5"
          opacity={0.3}
        />

        {/* Linha horizontal central */}
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={gridColor}
          strokeWidth={strokeWidth * 1.5}
          strokeDasharray="5,5"
          opacity={0.3}
        />
      </g>

      {/* Indicadores de coordenadas (opcional) */}
      <g className="grid-labels" opacity={0.3}>
        {/* Labels no eixo X */}
        {Array.from({ length: Math.floor(width / gridSize) + 1 }, (_, i) => {
          const x = i * gridSize;
          if (i % 2 === 0 && i > 0) { // Mostrar apenas alguns labels
            return (
              <text
                key={`x-${i}`}
                x={x}
                y={15}
                fontSize="10"
                fill={gridColor}
                textAnchor="middle"
              >
                {x}
              </text>
            );
          }
          return null;
        })}

        {/* Labels no eixo Y */}
        {Array.from({ length: Math.floor(height / gridSize) + 1 }, (_, i) => {
          const y = i * gridSize;
          if (i % 2 === 0 && i > 0) { // Mostrar apenas alguns labels
            return (
              <text
                key={`y-${i}`}
                x={10}
                y={y + 3}
                fontSize="10"
                fill={gridColor}
                textAnchor="start"
              >
                {y}
              </text>
            );
          }
          return null;
        })}
      </g>
    </svg>
  );
};

// Hook para gerenciar o estado do grid (apenas visual)
export const useGridSettings = () => {
  const [gridSettings, setGridSettings] = React.useState({
    visible: true,  // Inicia ligado por padrão
    gridSize: 100,  // Tamanho padrão 100px
    subdivisions: 5,
    opacity: 1,  // Opacidade total (100%)
    showLabels: false
  });

  const toggleGrid = () => {
    setGridSettings(prev => ({ ...prev, visible: !prev.visible }));
  };

  const updateGridSize = (size: number) => {
    setGridSettings(prev => ({ ...prev, gridSize: size }));
  };

  const updateOpacity = (opacity: number) => {
    setGridSettings(prev => ({ ...prev, opacity }));
  };

  const toggleLabels = () => {
    setGridSettings(prev => ({ ...prev, showLabels: !prev.showLabels }));
  };

  return {
    gridSettings,
    toggleGrid,
    updateGridSize,
    updateOpacity,
    toggleLabels
  };
};

export default DiagramGrid;