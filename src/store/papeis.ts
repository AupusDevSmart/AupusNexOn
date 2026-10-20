/**
 * Papéis do NexON e o que cada um pode (spec "NexON — Permissões e controle de
 * acesso", NEXON-20). Espelho de `aupus-nexon-api/src/core/modules/auth/papeis.ts`.
 *
 * O backend manda `papel` e `capacidades` no login e no `/auth/me`; esta cópia só
 * serve de fallback quando a resposta não trouxe (sessão salva antes da mudança,
 * API antiga). O front usa para esconder botão — quem protege é o backend.
 */
export type Papel =
  | 'admin'
  | 'analista_automacao'
  | 'analista_operacao'
  | 'proprietario'
  | 'operador'
  | 'outro';

export const PAPEIS: readonly Exclude<Papel, 'outro'>[] = [
  'admin',
  'analista_automacao',
  'analista_operacao',
  'proprietario',
  'operador',
];

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Admin',
  analista_automacao: 'Analista de automação',
  analista_operacao: 'Analista de operação',
  proprietario: 'Proprietário',
  operador: 'Operador',
  outro: 'Sem papel',
};

export interface Capacidades {
  global: boolean;
  cadastroTecnico: boolean;
  verUnifilar: boolean;
  verComunicacao: boolean;
  contadorFalhas: boolean;
  verNomeProprietario: boolean;
  comandar: boolean;
  configTecnica: boolean;
  configOperacional: boolean;
  configUsina: boolean;
  tarifas: boolean;
  analiseGeracao: boolean;
  verValores: boolean;
  marcarPlantaTeste: boolean;
  liberarVerGeracao: boolean;
  gerirAcessoOperador: boolean;
  exportarRecargas: boolean;
  cadastra: Papel[];
}

/** Nome da tabela `roles` (ou legado) → papel canônico. */
export function papelCanonico(role?: string | null): Papel {
  const r = String(role ?? '').trim().toLowerCase().replace(/[-\s]/g, '_');
  switch (r) {
    case 'super_admin':
    case 'superadmin':
    case 'admin':
      return 'admin';
    case 'analista_automacao':
    case 'analista':
      return 'analista_automacao';
    case 'analista_operacao':
    case 'gerente':
      return 'analista_operacao';
    case 'proprietario':
    case 'propietario':
      return 'proprietario';
    case 'operador':
      return 'operador';
    default:
      return 'outro';
  }
}

/** Rótulo para exibir um nome de role, inclusive os legados. */
export function rotuloDaRole(role?: string | null): string {
  const p = papelCanonico(role);
  if (p === 'outro') return role ? String(role) : ROTULO_PAPEL.outro;
  return ROTULO_PAPEL[p];
}

const CADASTRA: Record<Papel, readonly Papel[]> = {
  admin: ['admin', 'analista_automacao', 'analista_operacao', 'proprietario', 'operador'],
  analista_automacao: ['analista_operacao', 'proprietario', 'operador'],
  analista_operacao: ['proprietario', 'operador'],
  proprietario: ['operador'],
  operador: [],
  outro: [],
};

export function isGlobal(papel: Papel): boolean {
  return papel === 'admin' || papel === 'analista_automacao' || papel === 'analista_operacao';
}

export function capacidadesDoPapel(papel: Papel): Capacidades {
  const global = isGlobal(papel);
  const dono = global || papel === 'proprietario';
  const operador = papel === 'operador';
  return {
    global,
    cadastroTecnico: papel === 'admin' || papel === 'analista_automacao',
    verUnifilar: dono,
    verComunicacao: dono,
    contadorFalhas: global,
    verNomeProprietario: papel !== 'proprietario',
    comandar: dono || operador,
    configTecnica: global,
    configOperacional: dono || operador,
    configUsina: global,
    tarifas: global,
    analiseGeracao: dono || operador,
    verValores: dono || operador,
    marcarPlantaTeste: papel === 'admin' || papel === 'analista_automacao',
    liberarVerGeracao: dono,
    gerirAcessoOperador: dono,
    exportarRecargas: dono,
    cadastra: [...CADASTRA[papel]],
  };
}

const PAPEIS_VALIDOS = new Set<string>([...PAPEIS, 'outro']);

/** Primeiro nome de role de um usuário, aceitando os vários formatos do backend. */
export function roleDoUsuario(user: unknown): string {
  const u = (user ?? {}) as {
    role?: unknown;
    role_details?: { name?: string } | null;
    roles?: unknown[];
  };
  const primeiro = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles[0] : undefined;
  const doArray =
    typeof primeiro === 'string' ? primeiro : (primeiro as { name?: string } | undefined)?.name;
  return (
    doArray ||
    u.role_details?.name ||
    (typeof u.role === 'string' ? u.role : '') ||
    ''
  );
}

/**
 * Papel e capacidades de um usuário vindo da API. Usa o que o backend mandou
 * (`papel`/`capacidades`) e completa o que faltar pela role.
 */
export function papelECapacidades(user: unknown): { papel: Papel; capacidades: Capacidades } {
  const u = (user ?? {}) as { papel?: unknown; capacidades?: unknown };
  const papel: Papel =
    typeof u.papel === 'string' && PAPEIS_VALIDOS.has(u.papel)
      ? (u.papel as Papel)
      : papelCanonico(roleDoUsuario(user));
  const base = capacidadesDoPapel(papel);
  const vindas =
    u.capacidades && typeof u.capacidades === 'object'
      ? (u.capacidades as Partial<Capacidades>)
      : {};
  return {
    papel,
    capacidades: {
      ...base,
      ...vindas,
      cadastra: Array.isArray(vindas.cadastra) ? vindas.cadastra : base.cadastra,
    },
  };
}

export const MSG_SOMENTE_LEITURA = 'Somente leitura para este perfil';
