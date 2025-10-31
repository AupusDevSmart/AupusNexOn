// src/config/feature-flags.ts

/**
 * Configuração de Feature Flags
 *
 * Use este arquivo para controlar a visibilidade de features na aplicação.
 * Defina como 'true' para habilitar ou 'false' para desabilitar.
 */

export interface FeatureFlags {
  /** Habilita a página SCADA */
  enableScada: boolean;

  /** Habilita o módulo de Financeiro */
  enableFinanceiro: boolean;

  /** Habilita o módulo de Cadastros */
  enableCadastros: boolean;

  /** Habilita o módulo de Supervisório */
  enableSupervisorio: boolean;

  /** Habilita o COA (Centro de Operação de Ativos) */
  enableCOA: boolean;

  /** Habilita a página Cadastro de Unidades do Supervisório */
  enableCadastroUnidadesSupervisorio: boolean;
}

/**
 * Configuração padrão das feature flags
 * Modifique os valores abaixo para habilitar/desabilitar features
 */
export const featureFlags: FeatureFlags = {
  enableScada: false,         // SCADA está desabilitado
  enableFinanceiro: true,      // Financeiro está habilitado
  enableCadastros: true,       // Cadastros está habilitado
  enableSupervisorio: true,    // Supervisório está habilitado
  enableCOA: true,             // COA está habilitado
  enableCadastroUnidadesSupervisorio: false,  // Cadastro de Unidades (Supervisório) está desabilitado
};

/**
 * Função helper para verificar se uma feature está habilitada
 * @param flag - Nome da feature flag a ser verificada
 * @returns true se a feature está habilitada, false caso contrário
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag] ?? false;
}
