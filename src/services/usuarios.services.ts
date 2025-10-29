// src/services/usuarios.services.ts - ENUM CORRIGIDO
import { api } from '@/config/api';

// ============================================================================
// TIPOS - CORRIGIDOS BASEADOS NO BACKEND
// ============================================================================

export enum UsuarioStatus {
  ATIVO = 'Ativo',      // Backend usa 'Ativo' (primeira letra maiúscula)
  INATIVO = 'Inativo',  // Backend usa 'Inativo' (primeira letra maiúscula)
  PENDENTE = 'Pendente',
  BLOQUEADO = 'Bloqueado'
}

export interface UsuarioBasico {
  id: string;
  nome: string;
  email: string;
  status: UsuarioStatus;
  cpf_cnpj?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  created_at: string;
}

export interface UsuarioResponse extends UsuarioBasico {
  instagram?: string;
  endereco?: string;
  cep?: string;
  manager_id?: string;
  concessionaria_atual_id?: string;
  organizacao_atual_id?: string;
  role: string; // Campo role simples do banco
  is_active: boolean;
  deleted_at?: string;
  // Campos computados pela API (se houver)
  all_permissions?: string[];
  roles?: string[];
  updated_at: string;
}

export interface UsuarioQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UsuarioStatus;
  role?: string;
  cidade?: string;
  estado?: string;
  concessionariaId?: string;
  organizacaoId?: string;
  includeInactive?: boolean;
}

export interface PaginatedUsuariosResponse {
  data: UsuarioResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateUsuarioRequest {
  nome: string;
  email: string;
  telefone?: string;
  instagram?: string;
  status?: UsuarioStatus;
  cpfCnpj?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  cep?: string;
  managerId?: string;
  concessionariaAtualId?: string;
  organizacaoAtualId?: string;
  // Campos para roles/permissions
  roleNames?: string[];
  permissions?: string[];
}

export interface UpdateUsuarioRequest extends Partial<CreateUsuarioRequest> {}

// ============================================================================
// SERVICE - COM LOGGING MELHORADO
// ============================================================================

export class UsuariosService {
  private static readonly BASE_PATH = '/usuarios';

  /**
   * Buscar todos os usuários com paginação e filtros
   */
  static async getAllUsuarios(params?: UsuarioQueryParams): Promise<PaginatedUsuariosResponse> {
    try {
      // console.log('🔍 [USUARIOS SERVICE] Buscando usuários com params:', params);
      
      const response = await api.get(this.BASE_PATH, { params });
      
      // console.log('✅ [USUARIOS SERVICE] Usuários encontrados:', response.data.data.length);
      
      return response.data;
    } catch (error: any) {
      // console.error('❌ [USUARIOS SERVICE] Erro ao buscar usuários:', error);
      // console.error('❌ [USUARIOS SERVICE] Response data:', error.response?.data);
      throw this.handleError(error, 'Erro ao buscar usuários');
    }
  }

  /**
   * Buscar usuários básicos para filtros/selects - SEM STATUS FILTER
   */
  static async getUsuariosBasicos(params?: { 
    search?: string; 
    limit?: number;
    status?: UsuarioStatus;
  }): Promise<UsuarioBasico[]> {
    try {
      // console.log('🔍 [USUARIOS SERVICE] Buscando usuários básicos:', params);
      
      // Não filtrar por status inicialmente para evitar erro
      const queryParams: UsuarioQueryParams = {
        limit: params?.limit || 100, // Limite maior para select
        search: params?.search,
        // status: params?.status || UsuarioStatus.ATIVO, // REMOVIDO TEMPORARIAMENTE
        includeInactive: false
      };
      
      const response = await this.getAllUsuarios(queryParams);
      
      // Mapear para formato básico
      const usuariosBasicos: UsuarioBasico[] = response.data.map(usuario => ({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        status: usuario.status,
        cpf_cnpj: usuario.cpf_cnpj,
        cidade: usuario.cidade,
        estado: usuario.estado,
        telefone: usuario.telefone,
        created_at: usuario.created_at
      }));

      // Filtrar por status no frontend se necessário
      let usuariosFiltrados = usuariosBasicos;
      if (params?.status) {
        usuariosFiltrados = usuariosBasicos.filter(u => u.status === params.status);
      } else {
        // Por padrão, apenas usuários ativos
        usuariosFiltrados = usuariosBasicos.filter(u => 
          u.status === UsuarioStatus.ATIVO || 
          u.status === 'ativo' || // Fallback para lowercase
          u.status === 'Ativo'    // Fallback para capitalize
        );
      }

      // console.log('✅ [USUARIOS SERVICE] Usuários básicos mapeados:', usuariosFiltrados.length);
      // console.log('📊 [USUARIOS SERVICE] Status encontrados:', [...new Set(usuariosBasicos.map(u => u.status))]);
      
      return usuariosFiltrados;
    } catch (error: any) {
      // console.error('❌ [USUARIOS SERVICE] Erro ao buscar usuários básicos:', error);
      throw this.handleError(error, 'Erro ao buscar usuários');
    }
  }

  /**
   * Teste de conexão com a API
   */
  static async testConnection(): Promise<boolean> {
    try {
      // console.log('🔌 [USUARIOS SERVICE] Testando conexão...');
      
      // Tentar buscar sem filtros
      const response = await api.get(this.BASE_PATH, { 
        params: { 
          limit: 1,
          page: 1
        }
      });
      
      // console.log('✅ [USUARIOS SERVICE] Conexão OK:', response.status);
      return true;
    } catch (error: any) {
      // console.error('❌ [USUARIOS SERVICE] Falha na conexão:', error.response?.status);
      // console.error('❌ [USUARIOS SERVICE] Erro detalhado:', error.response?.data);
      return false;
    }
  }

  /**
   * Buscar usuário específico
   */
  static async getUsuario(id: string): Promise<UsuarioResponse> {
    try {
      // console.log('🔍 [USUARIOS SERVICE] Buscando usuário:', id);
      
      const response = await api.get(`${this.BASE_PATH}/${id}`);
      
      // console.log('✅ [USUARIOS SERVICE] Usuário encontrado:', response.data.nome);
      
      return response.data;
    } catch (error: any) {
      // console.error('❌ [USUARIOS SERVICE] Erro ao buscar usuário:', error);
      throw this.handleError(error, 'Erro ao buscar usuário');
    }
  }

  /**
   * Criar novo usuário
   */
  static async createUsuario(data: CreateUsuarioRequest): Promise<UsuarioResponse> {
    try {
      // console.log('🔄 [USUARIOS SERVICE] Criando usuário:', data.nome);
      
      const response = await api.post(this.BASE_PATH, data);
      
      // console.log('✅ [USUARIOS SERVICE] Usuário criado:', response.data.id);
      
      return response.data;
    } catch (error: any) {
      // console.error('❌ [USUARIOS SERVICE] Erro ao criar usuário:', error);
      throw this.handleError(error, 'Erro ao criar usuário');
    }
  }

  /**
   * Atualizar usuário
   */
  static async updateUsuario(id: string, data: UpdateUsuarioRequest): Promise<UsuarioResponse> {
    try {
      // console.log('🔄 [USUARIOS SERVICE] Atualizando usuário:', id);
      // console.log('📝 [USUARIOS SERVICE] Dados enviados:', data);
      
      const response = await api.patch(`${this.BASE_PATH}/${id}`, data);
      
      // console.log('✅ [USUARIOS SERVICE] Usuário atualizado:', response.data.nome);
      
      return response.data;
    } catch (error: any) {
      // console.error('❌ [USUARIOS SERVICE] Erro ao atualizar usuário:', error);
      throw this.handleError(error, 'Erro ao atualizar usuário');
    }
  }

  /**
   * Excluir usuário (soft delete)
   */
  static async deleteUsuario(id: string): Promise<{ message: string }> {
    try {
      // console.log('🗑️ [USUARIOS SERVICE] Excluindo usuário:', id);
      
      const response = await api.delete(`${this.BASE_PATH}/${id}`);
      
      // console.log('✅ [USUARIOS SERVICE] Usuário excluído');
      
      return response.data;
    } catch (error: any) {
      // console.error('❌ [USUARIOS SERVICE] Erro ao excluir usuário:', error);
      throw this.handleError(error, 'Erro ao excluir usuário');
    }
  }

  // ============================================================================
  // UTILS
  // ============================================================================

  /**
   * Formatar CPF/CNPJ para exibição
   */
  static formatCpfCnpj(cpfCnpj?: string): string {
    if (!cpfCnpj) return '';
    
    // Remove caracteres não numéricos
    const numbers = cpfCnpj.replace(/\D/g, '');
    
    if (numbers.length === 11) {
      // CPF: 000.000.000-00
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (numbers.length === 14) {
      // CNPJ: 00.000.000/0000-00
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    
    return cpfCnpj; // Retorna original se não for CPF nem CNPJ
  }

  /**
   * Verificar se CPF/CNPJ está válido/completo
   */
  static isValidCpfCnpj(cpfCnpj?: string): boolean {
    if (!cpfCnpj) return false;
    
    const numbers = cpfCnpj.replace(/\D/g, '');
    return numbers.length === 11 || numbers.length === 14;
  }

  /**
   * Obter emoji do status
   */
  static getStatusEmoji(status: UsuarioStatus | string): string {
    const statusEmojis: Record<string, string> = {
      [UsuarioStatus.ATIVO]: '✅',
      [UsuarioStatus.INATIVO]: '❌', 
      [UsuarioStatus.PENDENTE]: '⏳',
      [UsuarioStatus.BLOQUEADO]: '🚫',
      // Fallbacks
      'ativo': '✅',
      'Ativo': '✅',
      'inativo': '❌',
      'Inativo': '❌'
    };
    
    return statusEmojis[status as string] || '❓';
  }

  /**
   * Obter cor do status
   */
  static getStatusColor(status: UsuarioStatus | string): string {
    const statusColors: Record<string, string> = {
      [UsuarioStatus.ATIVO]: 'text-green-600',
      [UsuarioStatus.INATIVO]: 'text-red-600',
      [UsuarioStatus.PENDENTE]: 'text-yellow-600',
      [UsuarioStatus.BLOQUEADO]: 'text-red-800',
      // Fallbacks
      'ativo': 'text-green-600',
      'Ativo': 'text-green-600',
      'inativo': 'text-red-600',
      'Inativo': 'text-red-600'
    };
    
    return statusColors[status as string] || 'text-gray-600';
  }

  // ============================================================================
  // PRIVATE
  // ============================================================================

  private static handleError(error: any, defaultMessage: string): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    
    if (error.message) {
      return new Error(error.message);
    }
    
    return new Error(defaultMessage);
  }
}