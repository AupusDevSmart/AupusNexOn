import { useState, useEffect } from 'react';

/**
 * Hook para gerenciar estado de "página pronta" aguardando múltiplas condições
 * Só marca como pronto quando TODOS os dados necessários estão carregados
 */
export function usePageReadyState(conditions: {
  diagramaCarregado: boolean;
  graficosCarregados: boolean;
  unidadeId?: string;
}) {
  const [isReady, setIsReady] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  useEffect(() => {
    const { diagramaCarregado, graficosCarregados, unidadeId } = conditions;

    // Só pode ficar "pronto" se tiver unidade selecionada
    if (!unidadeId) {
      setIsReady(false);
      setHasInitialLoad(false);
      return;
    }

    // Aguardar TUDO estar carregado antes de marcar como pronto
    if (diagramaCarregado && graficosCarregados && !hasInitialLoad) {
      // Pequeno delay para garantir que componentes renderizaram
      const timer = setTimeout(() => {
        setIsReady(true);
        setHasInitialLoad(true);
      }, 100);

      return () => clearTimeout(timer);
    }

    // Depois do primeiro load, manter sempre pronto (evita flicker em reloads)
    if (hasInitialLoad && diagramaCarregado) {
      setIsReady(true);
    }
  }, [conditions.diagramaCarregado, conditions.graficosCarregados, conditions.unidadeId, hasInitialLoad]);

  return {
    isReady,
    isInitialLoad: !hasInitialLoad
  };
}
