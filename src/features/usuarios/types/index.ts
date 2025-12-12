// src/features/usuarios/types/index.ts - CORRIGIDO PARA BACKEND HÍBRIDO
import { BaseEntity, type BaseFilters as BaseFiltersType, ModalMode } from '@/types/base';
import { type Permission } from '@/types/permissions';

// ============================================================================
// ENUMS E TYPES DO SISTEMA
// ============================================================================

export enum UsuarioStatus {
  ATIVO = 'Ativo',
  INATIVO = 'Inativo',
}

// ✅ ROLES ATIVOS NO SISTEMA (baseado nas constraints do banco)
export enum UsuarioRole {
  ADMIN = 'admin',
  CONSULTOR = 'consultor', 
  GERENTE = 'gerente',
  VENDEDOR = 'vendedor',
}

// ✅ TIPO DE PERMISSÃO - IMPORTADO DO ARQUIVO CENTRALIZADO
export type Permissao = Permission;

export interface Role {
  id: string;
  name: string;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface ConcessionariaDTO {
  id: string;
  nome: string;
  cnpj?: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizacaoDTO {
  id: string;
  nome: string;
  tipo?: string;
  created_at: Date;
  updated_at: Date;
}

// ✅ ESTRUTURA DE PERMISSÃO COMO RETORNA DO BACKEND
export interface UserPermission {
  id: number;
  name: string;
  guard_name: string;
  source: 'role' | 'direct';
}

// ✅ INTERFACE COMPATÍVEL COM BaseEntity E BACKEND HÍBRIDO
export interface Usuario extends BaseEntity {
  // ✅ BaseEntity fields - compatíveis
  id: string;
  created_at: Date;
  updated_at: Date;
  criadoEm?: Date;
  atualizadoEm?: Date;

  // Campos específicos do usuário
  status: UsuarioStatus;
  
  // Relacionamentos organizacionais
  concessionarias?: ConcessionariaDTO[];
  concessionaria_atual_id?: string;
  concessionaria_atual?: ConcessionariaDTO;
  organizacao_atual?: string; // ID da organização
  
  // Dados pessoais
  nome: string;
  email: string;
  telefone?: string;
  instagram?: string;
  cpf_cnpj?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  cep?: string;
  endereco_completo?: string;
  manager_id?: string;
  
  // ✅ CORREÇÃO: Permissões e roles como retorna do backend
  all_permissions: UserPermission[] | string[]; // Pode ser objetos completos ou strings simples
  roles: string[]; // Array de nomes de roles (ex: ["admin"])
  role_details?: Role; // Detalhes da role principal
  
  // ✅ CAMPOS EXTRAS PARA COMPATIBILIDADE COM FRONTEND EXISTENTE
  tipo?: string;
  perfil?: string;
  permissao?: Permissao[];
  
  // ✅ CAMPOS TEMPORÁRIOS (apenas na criação/reset)
  senhaTemporaria?: string;
  primeiroAcesso?: boolean;
  ultimoLogin?: string;
  
  // ✅ CAMPOS COMPUTADOS
  plantas?: number;
  isActive?: boolean;
}

// ✅ FORM DATA PARA CRIAÇÃO/EDIÇÃO
export interface UsuarioFormData {
  id?: string | number;
  nome: string;
  email: string;
  telefone?: string;
  instagram?: string;
  status?: string;
  cpfCnpj?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  cep?: string;
  concessionariaAtualId?: string;
  organizacaoAtualId?: string;
  managerId?: string;
  permissions?: Permissao[];
  roleNames?: string | string[]; // ✅ Pode ser string (do select) ou array
  
  // ✅ COMPATIBILIDADE COM FRONTEND EXISTENTE
  tipo?: string;
  permissao?: Permissao[];
}

// ✅ DTO PARA TROCA DE SENHA
export interface ChangePasswordDto {
  senhaAtual: string;
  novaSenha: string;
}

// ✅ DTO PARA RESET DE SENHA
export interface ResetPasswordDto {
  novaSenha: string;
  confirmarSenha: string;
}

// ✅ FILTROS COMPATÍVEIS
export interface UsuariosFilters extends BaseFiltersType {
  status?: UsuarioStatus | 'all';
  role?: UsuarioRole | 'all';
  cidade?: string;
  estado?: string;
  concessionariaId?: string;
  organizacaoId?: string;
  includeInactive?: boolean;
  permissions?: string[];
  
  // ✅ COMPATIBILIDADE COM FRONTEND EXISTENTE
  tipo?: string | 'all';
}

export interface ModalState {
  isOpen: boolean;
  mode: ModalMode;
  usuario: Usuario | null;
}

export { type ModalMode };

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ✅ RESPONSE TYPES DA API
export interface UsuariosResponse {
  data: Usuario[];
  pagination: Pagination;
}

export interface UsuarioResponse extends Usuario {
  senhaTemporaria?: string;
  primeiroAcesso?: boolean;
}

// ✅ MAPEAMENTOS PARA COMPATIBILIDADE FRONTEND ↔ API E DB CONSTRAINT
export const ROLE_TO_TIPO_MAPPING = {
  'super_admin': 'Super Admin',
  'admin': 'Administrador',
  'consultor': 'Consultor',
  'gerente': 'Gerente',
  'vendedor': 'Vendedor',
  'proprietario': 'Proprietário',
  'corretor': 'Corretor',
  'cativo': 'Cativo',
  'associado': 'Associado',
  'user': 'Vendedor',
} as const;

export const TIPO_TO_ROLE_MAPPING = {
  'Super Admin': 'super_admin',
  'Administrador': 'admin',
  'Consultor': 'consultor',
  'Gerente': 'gerente',
  'Vendedor': 'vendedor',
  'Proprietário': 'proprietario',
  'Corretor': 'corretor',
  'Cativo': 'cativo',
  'Associado': 'associado',
} as const;

// ✅ MAPEAMENTO ESPECÍFICO PARA CONSTRAINT DA COLUNA ROLE (LEGACY)
export const SPATIE_TO_DB_ROLE_MAPPING = {
  'proprietario': 'gerente', // proprietario do Spatie → gerente no DB legacy
  'user': 'vendedor', // user padrão → vendedor no DB legacy
  'admin': 'admin',
  'consultor': 'consultor',
  'gerente': 'gerente',
  'vendedor': 'vendedor',
} as const;

// ✅ FUNÇÃO AUXILIAR PARA EXTRAIR PERMISSÕES COMO STRINGS
const extractPermissionNames = (permissions: UserPermission[] | string[] | undefined): string[] => {
  if (!permissions) return [];
  
  return permissions.map(p => 
    typeof p === 'string' ? p : p.name
  );
};

// ✅ UTILITÁRIOS PARA CONVERSÃO - CORRIGIDOS
export const mapUsuarioToFormData = (usuario: Usuario): UsuarioFormData => {
  console.log('🔄 [mapUsuarioToFormData] Mapeando usuário para form:', {
    id: usuario.id,
    nome: usuario.nome,
    role_details: usuario.role_details,
    roles: usuario.roles,
    tipo: usuario.tipo,
    perfil: usuario.perfil,
    all_permissions: usuario.all_permissions,
    permissao: usuario.permissao,
    all_permissions_length: usuario.all_permissions?.length,
    permissao_length: usuario.permissao?.length
  });

  // ✅ CORREÇÃO CRÍTICA: Usar role_details primeiro, depois roles array, depois fallback
  let primaryRoleName = 'vendedor'; // Default
  
  if (usuario.role_details?.name) {
    primaryRoleName = usuario.role_details.name;
  } else if (usuario.roles && usuario.roles.length > 0) {
    primaryRoleName = usuario.roles[0];
  }
  
  console.log('🎯 [mapUsuarioToFormData] Role detectada:', primaryRoleName);

  // ✅ CORREÇÃO CRÍTICA: Converter permissões para array de strings
  const permissionsAsStrings = extractPermissionNames(usuario.all_permissions);
  
  console.log('🔧 [mapUsuarioToFormData] Permissões convertidas:', permissionsAsStrings.length);

  // Normalizar status
  let statusNormalizado = usuario.status;
  if (usuario.status === UsuarioStatus.ATIVO || String(usuario.status).toLowerCase() === 'ativo') {
    statusNormalizado = UsuarioStatus.ATIVO;
  } else if (usuario.status === UsuarioStatus.INATIVO || String(usuario.status).toLowerCase() === 'inativo') {
    statusNormalizado = UsuarioStatus.INATIVO;
  }
  
  const formData = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    instagram: usuario.instagram,
    status: statusNormalizado,
    cpfCnpj: usuario.cpf_cnpj,
    cidade: usuario.cidade,
    estado: usuario.estado,
    endereco: usuario.endereco,
    cep: usuario.cep,
    concessionariaAtualId: usuario.concessionaria_atual_id,
    organizacaoAtualId: usuario.organizacao_atual,
    managerId: usuario.manager_id,
    permissions: permissionsAsStrings as Permissao[], // ✅ CORREÇÃO: Array de strings
    roleNames: primaryRoleName, // ✅ CORREÇÃO: String única para o select
    // Compatibilidade
    tipo: ROLE_TO_TIPO_MAPPING[primaryRoleName as keyof typeof ROLE_TO_TIPO_MAPPING] || primaryRoleName,
    permissao: permissionsAsStrings as Permissao[],
  };
  
  console.log('✅ [mapUsuarioToFormData] FormData final:', {
    roleNames: formData.roleNames,
    permissions: formData.permissions?.length,
    tipo: formData.tipo
  });
  
  return formData;
};

export const mapFormDataToCreateDto = (formData: UsuarioFormData) => {
  // ✅ SIMPLIFICADO: roleNames é sempre uma string do select
  const roleName = typeof formData.roleNames === 'string' ? formData.roleNames : formData.roleNames?.[0] || 'vendedor';

  // Criar objeto limpo sem campos undefined
  const dto: any = {
    nome: formData.nome,
    email: formData.email,
    status: formData.status || UsuarioStatus.ATIVO,
    roleNames: [roleName], // Backend espera array
  };

  // Adicionar campos opcionais apenas se tiverem valor
  if (formData.telefone) dto.telefone = formData.telefone;
  if (formData.instagram) dto.instagram = formData.instagram;
  if (formData.cpfCnpj) dto.cpfCnpj = formData.cpfCnpj;
  if (formData.cidade) dto.cidade = formData.cidade;
  if (formData.estado) dto.estado = formData.estado;
  if (formData.cep) dto.cep = formData.cep;
  if (formData.endereco) dto.endereco = formData.endereco;

  if (formData.concessionariaAtualId) dto.concessionariaAtualId = formData.concessionariaAtualId;
  if (formData.organizacaoAtualId) dto.organizacaoAtualId = formData.organizacaoAtualId;
  if (formData.managerId) dto.managerId = formData.managerId;
  if (formData.permissions && formData.permissions.length > 0) {
    dto.permissions = formData.permissions;
  } else if (formData.permissao && formData.permissao.length > 0) {
    dto.permissions = formData.permissao;
  }

  return dto;
};

// ✅ FUNÇÕES DE UTILIDADE - CORRIGIDAS
export const getUserDisplayName = (usuario: Usuario): string => {
  return usuario.nome || usuario.email;
};

export const getUserPrimaryRole = (usuario: Usuario): Role | undefined => {
  // ✅ CORREÇÃO: Primeiro tentar role_details
  if (usuario.role_details) {
    return usuario.role_details;
  }
  
  // Senão, usar primeiro role do array roles
  if (usuario.roles && usuario.roles.length > 0) {
    return {
      id: '0',
      name: usuario.roles[0],
      description: usuario.roles[0],
      created_at: new Date(),
      updated_at: new Date()
    };
  }
  
  return undefined;
};

export const getUserRoleDisplay = (usuario: Usuario): string => {
  const primaryRole = getUserPrimaryRole(usuario);
  if (!primaryRole) return 'Sem role';
  
  return ROLE_TO_TIPO_MAPPING[primaryRole.name as keyof typeof ROLE_TO_TIPO_MAPPING] || primaryRole.name;
};

export const hasPermission = (usuario: Usuario, permission: Permissao): boolean => {
  const permissionNames = extractPermissionNames(usuario.all_permissions);
  return permissionNames.includes(permission);
};

export const isUsuarioAtivo = (usuario: Usuario): boolean => {
  return usuario.status === UsuarioStatus.ATIVO;
};