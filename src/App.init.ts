/**
 * App Initialization
 *
 * Inicialização do aplicativo - carregar feature flags e outras configurações
 */

import { initializeFeatureFlags } from './config/featureFlags';

/**
 * Inicializa o aplicativo antes do render
 */
export async function initializeApp(): Promise<void> {
  console.log('[App] Inicializando...');

  try {
    // Carregar feature flags
    await initializeFeatureFlags();

    console.log('[App] Inicialização completa');
  } catch (error) {
    console.error('[App] Erro na inicialização:', error);
    // Não bloquear app se feature flags falharem
  }
}
