/**
 * Feature Flags Configuration
 *
 * Sistema de feature flags para controle de funcionalidades em produção.
 * Permite desabilitar features sem rollback de código.
 *
 * PRIORIDADE DE FLAGS:
 * 1. API remota (runtime)
 * 2. localStorage (override manual)
 * 3. .env (build time)
 * 4. Default (fallback)
 */

// ========================================
// TIPOS
// ========================================

export interface FeatureFlags {
  // Supervisório - Conexões SVG
  habilitarConexoesSvg: boolean;

  // Outras features (exemplo)
  habilitarModoEdicao: boolean;
  habilitarFullscreen: boolean;
}

export type FeatureFlagKey = keyof FeatureFlags;

// ========================================
// DEFAULTS (FALLBACK)
// ========================================

const DEFAULT_FLAGS: FeatureFlags = {
  habilitarConexoesSvg: true,
  habilitarModoEdicao: true,
  habilitarFullscreen: true,
};

// ========================================
// ENV FLAGS (BUILD TIME)
// ========================================

const ENV_FLAGS: Partial<FeatureFlags> = {
  habilitarConexoesSvg: import.meta.env.VITE_FEATURE_CONEXOES_SVG !== 'false',
  habilitarModoEdicao: import.meta.env.VITE_FEATURE_MODO_EDICAO !== 'false',
  habilitarFullscreen: import.meta.env.VITE_FEATURE_FULLSCREEN !== 'false',
};

// ========================================
// LOCALSTORAGE FLAGS (OVERRIDE MANUAL)
// ========================================

const STORAGE_KEY = 'nexon_feature_flags';

function getLocalStorageFlags(): Partial<FeatureFlags> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as Partial<FeatureFlags>;
  } catch (error) {
    console.warn('Erro ao carregar feature flags do localStorage:', error);
    return {};
  }
}

function setLocalStorageFlag(key: FeatureFlagKey, value: boolean): void {
  try {
    const current = getLocalStorageFlags();
    const updated = { ...current, [key]: value };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Erro ao salvar feature flag no localStorage:', error);
  }
}

// ========================================
// API FLAGS (RUNTIME - REMOTO)
// ========================================

let apiFlags: Partial<FeatureFlags> = {};
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function fetchRemoteFlags(): Promise<Partial<FeatureFlags>> {
  const now = Date.now();

  // Cache: não buscar se já buscou recentemente
  if (now - lastFetchTime < CACHE_TTL) {
    return apiFlags;
  }

  try {
    const apiUrl = import.meta.env.VITE_FEATURE_FLAGS_API_URL;

    if (!apiUrl) {
      // Sem API configurada, usar flags locais
      return {};
    }

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout de 3 segundos
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    apiFlags = data.flags || {};
    lastFetchTime = now;

    console.log('[FeatureFlags] Flags carregadas da API:', apiFlags);
    return apiFlags;
  } catch (error) {
    console.warn('[FeatureFlags] Erro ao buscar flags da API, usando cache:', error);
    return apiFlags;
  }
}

// ========================================
// RESOLUÇÃO DE FLAGS (PRIORIDADE)
// ========================================

function resolveFlags(): FeatureFlags {
  const localStorageFlags = getLocalStorageFlags();

  // Prioridade: API > localStorage > ENV > Default
  return {
    ...DEFAULT_FLAGS,
    ...ENV_FLAGS,
    ...localStorageFlags,
    ...apiFlags,
  };
}

// ========================================
// API PÚBLICA
// ========================================

/**
 * Verifica se uma feature está habilitada
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  const flags = resolveFlags();
  return flags[key] ?? DEFAULT_FLAGS[key];
}

/**
 * Obtém todas as flags resolvidas
 */
export function getAllFlags(): FeatureFlags {
  return resolveFlags();
}

/**
 * Override manual de flag (persiste no localStorage)
 */
export function setFeatureFlag(key: FeatureFlagKey, value: boolean): void {
  setLocalStorageFlag(key, value);
  console.log(`[FeatureFlags] Override manual: ${key} = ${value}`);
}

/**
 * Limpa override manual (remove do localStorage)
 */
export function clearFeatureFlagOverride(key: FeatureFlagKey): void {
  try {
    const current = getLocalStorageFlags();
    delete current[key];
    if (Object.keys(current).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
    console.log(`[FeatureFlags] Override removido: ${key}`);
  } catch (error) {
    console.warn('Erro ao remover override:', error);
  }
}

/**
 * Limpa todos os overrides manuais
 */
export function clearAllOverrides(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[FeatureFlags] Todos os overrides removidos');
  } catch (error) {
    console.warn('Erro ao limpar overrides:', error);
  }
}

/**
 * Atualiza flags da API (runtime)
 */
export async function refreshFlags(): Promise<void> {
  await fetchRemoteFlags();
}

/**
 * Hook de inicialização (chamar no app bootstrap)
 */
export async function initializeFeatureFlags(): Promise<void> {
  console.log('[FeatureFlags] Inicializando...');
  await fetchRemoteFlags();
  const flags = resolveFlags();
  console.log('[FeatureFlags] Flags ativas:', flags);
}

// ========================================
// UTILITÁRIOS DE DEBUG
// ========================================

/**
 * Expõe API de feature flags no console (apenas em dev)
 */
if (import.meta.env.DEV) {
  (window as any).FeatureFlags = {
    get: getAllFlags,
    check: isFeatureEnabled,
    enable: (key: FeatureFlagKey) => setFeatureFlag(key, true),
    disable: (key: FeatureFlagKey) => setFeatureFlag(key, false),
    clear: clearFeatureFlagOverride,
    clearAll: clearAllOverrides,
    refresh: refreshFlags,

    // Atalhos para flags específicas
    enableConexoesSvg: () => setFeatureFlag('habilitarConexoesSvg', true),
    disableConexoesSvg: () => setFeatureFlag('habilitarConexoesSvg', false),
  };

  console.log('%c[FeatureFlags] API disponível: window.FeatureFlags', 'color: #00ff00; font-weight: bold');
  console.log('Exemplo: FeatureFlags.disableConexoesSvg()');
}
