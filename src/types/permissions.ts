/**
 * TIPOS DE PERMISSÕES - SISTEMA PADRONIZADO
 *
 * Sincronizado com: aupus-service-api/prisma/permissions-structure.ts
 */

// ==============================================================================
// TIPO PRINCIPAL DE PERMISSÃO
// ==============================================================================

export type Permission =
  // Dashboard
  | 'dashboard.view'
  | 'dashboard.view_analytics'

  // Usuários
  | 'usuarios.view'
  | 'usuarios.create'
  | 'usuarios.edit'
  | 'usuarios.delete'
  | 'usuarios.manage'
  | 'usuarios.manage_permissions'

  // Organizações
  | 'organizacoes.view'
  | 'organizacoes.create'
  | 'organizacoes.edit'
  | 'organizacoes.delete'
  | 'organizacoes.manage'

  // Plantas
  | 'plantas.view'
  | 'plantas.create'
  | 'plantas.edit'
  | 'plantas.delete'
  | 'plantas.manage'
  | 'plantas.view_own'

  // Unidades Consumidoras
  | 'unidades.view'
  | 'unidades.create'
  | 'unidades.edit'
  | 'unidades.delete'
  | 'unidades.manage'

  // Equipamentos
  | 'equipamentos.view'
  | 'equipamentos.create'
  | 'equipamentos.edit'
  | 'equipamentos.delete'
  | 'equipamentos.manage'

  // Monitoramento
  | 'monitoramento.view'
  | 'monitoramento.view_consumo'
  | 'monitoramento.view_geracao'
  | 'monitoramento.view_analytics'
  | 'monitoramento.export'

  // SCADA
  | 'scada.view'
  | 'scada.control'
  | 'scada.view_logs'
  | 'scada.view_alarms'
  | 'scada.acknowledge_alarms'

  // Supervisório
  | 'supervisorio.view'
  | 'supervisorio.view_sinoptico'
  | 'supervisorio.view_logs'
  | 'supervisorio.manage'

  // Prospecção
  | 'prospeccao.view'
  | 'prospeccao.create'
  | 'prospeccao.edit'
  | 'prospeccao.delete'
  | 'prospeccao.manage'
  | 'prospeccao.view_own'

  // Oportunidades
  | 'oportunidades.view'
  | 'oportunidades.create'
  | 'oportunidades.edit'
  | 'oportunidades.delete'
  | 'oportunidades.manage'

  // Financeiro
  | 'financeiro.view'
  | 'financeiro.view_reports'
  | 'financeiro.view_admin'
  | 'financeiro.manage'
  | 'financeiro.export'

  // Clube Aupus
  | 'clube.view'
  | 'clube.view_associado'
  | 'clube.view_proprietario'
  | 'clube.manage'

  // Concessionárias
  | 'concessionarias.view'
  | 'concessionarias.create'
  | 'concessionarias.edit'
  | 'concessionarias.delete'
  | 'concessionarias.manage'

  // Configurações
  | 'configuracoes.view'
  | 'configuracoes.edit'
  | 'configuracoes.manage'

  // Documentos
  | 'documentos.view'
  | 'documentos.upload'
  | 'documentos.download'
  | 'documentos.delete'
  | 'documentos.manage'

  // Relatórios
  | 'relatorios.view'
  | 'relatorios.export'
  | 'relatorios.create'

  // Administração
  | 'admin.super'
  | 'admin.impersonate'
  | 'admin.view_logs'
  | 'admin.manage_permissions';

// ==============================================================================
// CATEGORIAS DE PERMISSÕES
// ==============================================================================

export const PERMISSION_CATEGORIES = {
  Dashboard: 'Dashboard',
  Gestao: 'Gestão',
  GestaoEnergia: 'Gestão de Energia',
  Monitoramento: 'Monitoramento',
  Supervisorio: 'Supervisório',
  Comercial: 'Comercial',
  Financeiro: 'Financeiro',
  Clube: 'Clube',
  Sistema: 'Sistema',
  Administracao: 'Administração',
} as const;

// ==============================================================================
// MAPEAMENTO: PERMISSÃO → CATEGORIA
// ==============================================================================

export const PERMISSION_TO_CATEGORY: Record<string, string> = {
  // Dashboard
  'dashboard.view': PERMISSION_CATEGORIES.Dashboard,
  'dashboard.view_analytics': PERMISSION_CATEGORIES.Dashboard,

  // Gestão
  'usuarios.view': PERMISSION_CATEGORIES.Gestao,
  'usuarios.create': PERMISSION_CATEGORIES.Gestao,
  'usuarios.edit': PERMISSION_CATEGORIES.Gestao,
  'usuarios.delete': PERMISSION_CATEGORIES.Gestao,
  'usuarios.manage': PERMISSION_CATEGORIES.Gestao,
  'usuarios.manage_permissions': PERMISSION_CATEGORIES.Gestao,

  'organizacoes.view': PERMISSION_CATEGORIES.Gestao,
  'organizacoes.create': PERMISSION_CATEGORIES.Gestao,
  'organizacoes.edit': PERMISSION_CATEGORIES.Gestao,
  'organizacoes.delete': PERMISSION_CATEGORIES.Gestao,
  'organizacoes.manage': PERMISSION_CATEGORIES.Gestao,

  // Gestão de Energia
  'plantas.view': PERMISSION_CATEGORIES.GestaoEnergia,
  'plantas.create': PERMISSION_CATEGORIES.GestaoEnergia,
  'plantas.edit': PERMISSION_CATEGORIES.GestaoEnergia,
  'plantas.delete': PERMISSION_CATEGORIES.GestaoEnergia,
  'plantas.manage': PERMISSION_CATEGORIES.GestaoEnergia,
  'plantas.view_own': PERMISSION_CATEGORIES.GestaoEnergia,

  'unidades.view': PERMISSION_CATEGORIES.GestaoEnergia,
  'unidades.create': PERMISSION_CATEGORIES.GestaoEnergia,
  'unidades.edit': PERMISSION_CATEGORIES.GestaoEnergia,
  'unidades.delete': PERMISSION_CATEGORIES.GestaoEnergia,
  'unidades.manage': PERMISSION_CATEGORIES.GestaoEnergia,

  'equipamentos.view': PERMISSION_CATEGORIES.GestaoEnergia,
  'equipamentos.create': PERMISSION_CATEGORIES.GestaoEnergia,
  'equipamentos.edit': PERMISSION_CATEGORIES.GestaoEnergia,
  'equipamentos.delete': PERMISSION_CATEGORIES.GestaoEnergia,
  'equipamentos.manage': PERMISSION_CATEGORIES.GestaoEnergia,

  // Monitoramento
  'monitoramento.view': PERMISSION_CATEGORIES.Monitoramento,
  'monitoramento.view_consumo': PERMISSION_CATEGORIES.Monitoramento,
  'monitoramento.view_geracao': PERMISSION_CATEGORIES.Monitoramento,
  'monitoramento.view_analytics': PERMISSION_CATEGORIES.Monitoramento,
  'monitoramento.export': PERMISSION_CATEGORIES.Monitoramento,

  // Supervisório
  'scada.view': PERMISSION_CATEGORIES.Supervisorio,
  'scada.control': PERMISSION_CATEGORIES.Supervisorio,
  'scada.view_logs': PERMISSION_CATEGORIES.Supervisorio,
  'scada.view_alarms': PERMISSION_CATEGORIES.Supervisorio,
  'scada.acknowledge_alarms': PERMISSION_CATEGORIES.Supervisorio,

  'supervisorio.view': PERMISSION_CATEGORIES.Supervisorio,
  'supervisorio.view_sinoptico': PERMISSION_CATEGORIES.Supervisorio,
  'supervisorio.view_logs': PERMISSION_CATEGORIES.Supervisorio,
  'supervisorio.manage': PERMISSION_CATEGORIES.Supervisorio,

  // Comercial
  'prospeccao.view': PERMISSION_CATEGORIES.Comercial,
  'prospeccao.create': PERMISSION_CATEGORIES.Comercial,
  'prospeccao.edit': PERMISSION_CATEGORIES.Comercial,
  'prospeccao.delete': PERMISSION_CATEGORIES.Comercial,
  'prospeccao.manage': PERMISSION_CATEGORIES.Comercial,
  'prospeccao.view_own': PERMISSION_CATEGORIES.Comercial,

  'oportunidades.view': PERMISSION_CATEGORIES.Comercial,
  'oportunidades.create': PERMISSION_CATEGORIES.Comercial,
  'oportunidades.edit': PERMISSION_CATEGORIES.Comercial,
  'oportunidades.delete': PERMISSION_CATEGORIES.Comercial,
  'oportunidades.manage': PERMISSION_CATEGORIES.Comercial,

  // Financeiro
  'financeiro.view': PERMISSION_CATEGORIES.Financeiro,
  'financeiro.view_reports': PERMISSION_CATEGORIES.Financeiro,
  'financeiro.view_admin': PERMISSION_CATEGORIES.Financeiro,
  'financeiro.manage': PERMISSION_CATEGORIES.Financeiro,
  'financeiro.export': PERMISSION_CATEGORIES.Financeiro,

  // Clube
  'clube.view': PERMISSION_CATEGORIES.Clube,
  'clube.view_associado': PERMISSION_CATEGORIES.Clube,
  'clube.view_proprietario': PERMISSION_CATEGORIES.Clube,
  'clube.manage': PERMISSION_CATEGORIES.Clube,

  // Sistema
  'concessionarias.view': PERMISSION_CATEGORIES.Sistema,
  'concessionarias.create': PERMISSION_CATEGORIES.Sistema,
  'concessionarias.edit': PERMISSION_CATEGORIES.Sistema,
  'concessionarias.delete': PERMISSION_CATEGORIES.Sistema,
  'concessionarias.manage': PERMISSION_CATEGORIES.Sistema,

  'configuracoes.view': PERMISSION_CATEGORIES.Sistema,
  'configuracoes.edit': PERMISSION_CATEGORIES.Sistema,
  'configuracoes.manage': PERMISSION_CATEGORIES.Sistema,

  'documentos.view': PERMISSION_CATEGORIES.Sistema,
  'documentos.upload': PERMISSION_CATEGORIES.Sistema,
  'documentos.download': PERMISSION_CATEGORIES.Sistema,
  'documentos.delete': PERMISSION_CATEGORIES.Sistema,
  'documentos.manage': PERMISSION_CATEGORIES.Sistema,

  'relatorios.view': PERMISSION_CATEGORIES.Sistema,
  'relatorios.export': PERMISSION_CATEGORIES.Sistema,
  'relatorios.create': PERMISSION_CATEGORIES.Sistema,

  // Administração
  'admin.super': PERMISSION_CATEGORIES.Administracao,
  'admin.impersonate': PERMISSION_CATEGORIES.Administracao,
  'admin.view_logs': PERMISSION_CATEGORIES.Administracao,
  'admin.manage_permissions': PERMISSION_CATEGORIES.Administracao,
};

// ==============================================================================
// HELPERS
// ==============================================================================

/**
 * Retorna a categoria de uma permissão
 */
export function getPermissionCategory(permission: Permission): string {
  return PERMISSION_TO_CATEGORY[permission] || 'Outros';
}

/**
 * Agrupa permissões por categoria
 */
export function groupPermissionsByCategory(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce((acc, permission) => {
    const category = getPermissionCategory(permission);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);
}

/**
 * Verifica se uma permissão pertence a um recurso
 */
export function isPermissionOfResource(permission: Permission, resource: string): boolean {
  return permission.startsWith(`${resource}.`);
}

/**
 * Extrai o recurso de uma permissão
 * Ex: 'usuarios.view' → 'usuarios'
 */
export function getPermissionResource(permission: Permission): string {
  return permission.split('.')[0];
}

/**
 * Extrai a ação de uma permissão
 * Ex: 'usuarios.view' → 'view'
 */
export function getPermissionAction(permission: Permission): string {
  return permission.split('.')[1] || '';
}
