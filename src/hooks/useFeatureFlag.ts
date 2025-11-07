/**
 * useFeatureFlag Hook
 *
 * React hook para verificar feature flags com reatividade.
 */

import { useState, useEffect } from 'react';
import { isFeatureEnabled, type FeatureFlagKey } from '@/config/featureFlags';

/**
 * Hook para verificar se uma feature está habilitada
 *
 * @example
 * const conexoesSvgHabilitadas = useFeatureFlag('habilitarConexoesSvg');
 *
 * if (!conexoesSvgHabilitadas) {
 *   return <ConexoesLegacy />;
 * }
 */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState(() => isFeatureEnabled(key));

  useEffect(() => {
    // Re-avaliar flag quando localStorage mudar
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nexon_feature_flags' || e.key === null) {
        setEnabled(isFeatureEnabled(key));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Re-avaliar periodicamente (caso API atualize)
    const interval = setInterval(() => {
      const current = isFeatureEnabled(key);
      if (current !== enabled) {
        setEnabled(current);
      }
    }, 10000); // Check a cada 10 segundos

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [key, enabled]);

  return enabled;
}

/**
 * Hook para obter múltiplas flags de uma vez
 *
 * @example
 * const { habilitarConexoesSvg, habilitarModoEdicao } = useFeatureFlags();
 */
export function useFeatureFlags() {
  const habilitarConexoesSvg = useFeatureFlag('habilitarConexoesSvg');
  const habilitarModoEdicao = useFeatureFlag('habilitarModoEdicao');
  const habilitarFullscreen = useFeatureFlag('habilitarFullscreen');

  return {
    habilitarConexoesSvg,
    habilitarModoEdicao,
    habilitarFullscreen,
  };
}
