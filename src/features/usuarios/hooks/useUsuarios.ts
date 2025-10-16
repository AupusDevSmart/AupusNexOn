// src/features/usuarios/hooks/useUsuarios.ts - COMPATÍVEL COM DTO
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/config/api';
console.log('🔧 [useUsuarios] API importada:', { baseURL: api.defaults.baseURL });
import { 
  Usuario, 
  UsuariosFilters, 
  UsuariosResponse, 
  UsuarioFormData,
  UsuarioStatus,
  UsuarioRole,
  mapFormDataToCreateDto,
  mapUsuarioToFormData,
  ChangePasswordDto,
  ResetPasswordDto
} from '../types';
import { 
  userPermissionsService,
  UserPermissionsResponse,
  UserPermissionsSummary 
} from '@/services/user-permissions.service';

// ✅ SERVICE PARA COMUNICAÇÃO COM API
class UsuariosApiService {

  async findAll(filters: UsuariosFilters): Promise<UsuariosResponse> {
    console.log('🔍 [UsuariosApiService] Iniciando findAll com filtros:', filters);
    
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.role && filters.role !== 'all') params.append('role', filters.role);
    if (filters.cidade) params.append('cidade', filters.cidade);
    if (filters.estado) params.append('estado', filters.estado);
    if (filters.concessionariaId) params.append('concessionariaId', filters.concessionariaId);
    if (filters.organizacaoId) params.append('organizacaoId', filters.organizacaoId);
    if (filters.includeInactive) params.append('includeInactive', 'true');
    if (filters.permissions?.length) {
      filters.permissions.forEach(p => params.append('permissions', p));
    }

    const url = `/usuarios?${params}`;
    console.log('📡 [UsuariosApiService] Fazendo chamada GET para:', url);
    
    const response = await api.get(url, {
      timeout: 10000, // 10 segundos timeout
    });
    console.log('📨 [UsuariosApiService] Resposta raw da API:', {
      status: response.status,
      statusText: response.statusText,
      dataType: typeof response.data,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
      dataPreview: response.data
    });
    
    const data = response.data;
    
    // ✅ MAPEAR DADOS PARA COMPATIBILIDADE COM FRONTEND
    // Para listagem, enriquecer dados com permissões para os primeiros usuários
    const mappedData = {
      ...data,
      data: await Promise.all(
        data.data.map(async (usuario: any, index: number) => {
          // Para os primeiros 5 usuários da primeira página, buscar dados completos
          if (index < 5 && filters.page === 1) {
            try {
              const usuarioCompleto = await api.get(`/usuarios/${usuario.id}`);
              return this.mapApiResponseToUsuario(usuarioCompleto.data);
            } catch (error) {
              console.warn(`Erro ao buscar dados completos do usuário ${usuario.id}:`, error);
              return this.mapApiResponseToUsuario(usuario);
            }
          }
          return this.mapApiResponseToUsuario(usuario);
        })
      )
    };
    
    return mappedData;
  }

  async findOne(id: string): Promise<Usuario> {
    try {
      console.log(`🔍 [FIND ONE] Buscando usuário ${id} com dados completos...`);
      
      // Primeiro tentar buscar dados completos
      const response = await api.get(`/usuarios/${id}`);
      const data = response.data;
      
      console.log(`📋 [FIND ONE] Dados do usuário recebidos:`, {
        id: data.id,
        nome: data.nome,
        role_details: data.role_details,
        roles: data.roles,
        all_permissions: data.all_permissions?.length || 0
      });
      
      return this.mapApiResponseToUsuario(data);
    } catch (error) {
      console.error(`❌ [FIND ONE] Erro ao buscar usuário ${id}:`, error);
      throw error;
    }
  }

  async create(data: UsuarioFormData): Promise<Usuario> {
    // ✅ CONVERTER FORM DATA PARA DTO DA API
    const createDto = mapFormDataToCreateDto(data);

    const response = await api.post('/usuarios', createDto);
    const result = response.data;
    return this.mapApiResponseToUsuario(result);
  }

  async update(id: string, data: Partial<UsuarioFormData>): Promise<Usuario> {
    // ✅ CONVERTER FORM DATA PARA DTO DA API
    const updateDto = mapFormDataToCreateDto(data as UsuarioFormData);
    
    console.log('🔍 DEBUG - Dados enviados para API:', {
      id,
      originalData: data,
      updateDto
    });

    const response = await api.patch(`/usuarios/${id}`, updateDto);
    const result = response.data;
    return this.mapApiResponseToUsuario(result);
  }

  async remove(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/usuarios/${id}`);
    return response.data;
  }

  async changePassword(id: string, data: ChangePasswordDto): Promise<{ message: string }> {
    const response = await api.patch(`/usuarios/${id}/change-password`, data);
    return response.data;
  }

  async resetPassword(id: string, data: ResetPasswordDto): Promise<{ message: string; senhaTemporaria: string }> {
    const response = await api.patch(`/usuarios/${id}/reset-password`, data);
    return response.data;
  }

  // ✅ MAPEAR RESPOSTA DA API PARA FORMATO DO FRONTEND
  private mapApiResponseToUsuario(apiResponse: any): Usuario {
    console.log('🔄 [USUARIOS HOOK] Mapeando resposta da API:', {
      id: apiResponse.id,
      nome: apiResponse.nome,
      role: apiResponse.role,
      role_details: apiResponse.role_details,
      roles: apiResponse.roles,
      all_permissions: apiResponse.all_permissions,
      permissions: apiResponse.permissions,
      rawResponse: apiResponse
    });
    
    const mappedUser = {
      id: apiResponse.id,
      status: apiResponse.status,
      concessionaria_atual_id: apiResponse.concessionaria_atual_id,
      concessionaria_atual: apiResponse.concessionaria_atual,
      organizacao_atual: apiResponse.organizacao_atual,
      nome: apiResponse.nome,
      email: apiResponse.email,
      telefone: apiResponse.telefone,
      instagram: apiResponse.instagram,
      cpf_cnpj: apiResponse.cpf_cnpj,
      cidade: apiResponse.cidade,
      estado: apiResponse.estado,
      endereco: apiResponse.endereco,
      cep: apiResponse.cep,
      manager_id: apiResponse.manager_id,
      
      // ✅ CORREÇÃO: Mapear all_permissions da estrutura real da API
      all_permissions: (() => {
        // A API retorna all_permissions como array de objetos ou strings
        let perms = apiResponse.all_permissions || apiResponse.permissions || [];
        
        // Se não é array, tentar converter
        if (!Array.isArray(perms)) {
          perms = [];
        }
        
        // Mapear para strings (nomes das permissões)
        return perms.map((perm: any) => {
          if (typeof perm === 'string') {
            return perm;
          }
          if (perm && typeof perm === 'object') {
            return perm.name || perm.permission || String(perm);
          }
          return String(perm);
        }).filter(Boolean); // Remove valores vazios
      })(),
      
      // ✅ CORREÇÃO: Mapear roles da estrutura real da API
      roles: (() => {
        // Se tem role_details (dados completos), usar ele
        if (apiResponse.role_details && apiResponse.role_details.name) {
          return [apiResponse.role_details.name];
        }
        
        // Se tem roles array (dados completos), usar ele
        if (apiResponse.roles && Array.isArray(apiResponse.roles) && apiResponse.roles.length > 0) {
          return apiResponse.roles.map((role: any) => 
            typeof role === 'string' ? role : (role.name || String(role))
          );
        }
        
        // Se não tem dados Spatie, mas tem role na coluna legacy (versão otimizada)
        if (apiResponse.role && typeof apiResponse.role === 'string') {
          return [apiResponse.role];
        }
        
        // Fallback baseado na API: se não tem role definida, é vendedor por padrão
        return ['vendedor'];
      })(),
      
      // ✅ ADICIONAR role_details se existir
      role_details: apiResponse.role_details ? {
        id: apiResponse.role_details.id || '0',
        name: apiResponse.role_details.name || apiResponse.role_details,
        description: apiResponse.role_details.description || apiResponse.role_details.name || apiResponse.role_details
      } : undefined,
      
      created_at: new Date(apiResponse.created_at),
      updated_at: new Date(apiResponse.updated_at),
      
      // ✅ CAMPOS DE COMPATIBILIDADE COM FRONTEND EXISTENTE
      tipo: (() => {
        const primaryRole = apiResponse.role_details?.name || apiResponse.role || 
                           (apiResponse.roles && apiResponse.roles[0]?.name) || 
                           (apiResponse.roles && apiResponse.roles[0]) || 'vendedor';
        return this.mapRoleToTipo(primaryRole);
      })(),
      perfil: (() => {
        const primaryRole = apiResponse.role_details?.name || apiResponse.role || 
                           (apiResponse.roles && apiResponse.roles[0]?.name) || 
                           (apiResponse.roles && apiResponse.roles[0]) || 'vendedor';
        return this.mapRoleToTipo(primaryRole);
      })(),
      permissao: (() => {
        const perms = apiResponse.all_permissions || apiResponse.permissions || [];
        if (Array.isArray(perms)) {
          return perms.map((perm: any) => {
            if (typeof perm === 'string') return perm;
            if (perm && typeof perm === 'object' && perm.name) return perm.name;
            return String(perm);
          });
        }
        return [];
      })(),
      criadoEm: new Date(apiResponse.created_at),
      atualizadoEm: new Date(apiResponse.updated_at),
      isActive: apiResponse.status === UsuarioStatus.ATIVO || apiResponse.is_active,
      
      // ✅ CAMPOS EXTRAS SE PRESENTES
      senhaTemporaria: apiResponse.senhaTemporaria,
      primeiroAcesso: apiResponse.primeiroAcesso,
      plantas: apiResponse.plantas || 0,
    };
    
    console.log('✅ [USUARIOS HOOK] Usuário mapeado:', {
      id: mappedUser.id,
      nome: mappedUser.nome,
      tipo: mappedUser.tipo,
      perfil: mappedUser.perfil,
      roles: mappedUser.roles,
      role_details: mappedUser.role_details,
      all_permissions_count: mappedUser.all_permissions?.length || 0,
      permissao_count: mappedUser.permissao?.length || 0
    });
    
    return mappedUser;
  }

  // ✅ MAPEAR ROLE PARA TIPO (COMPATIBILIDADE) - BASEADO NO CONSTRAINT DB
  private mapRoleToTipo(role: string): string {
    const mapping = {
      'admin': 'Administrador',
      'consultor': 'Consultor', 
      'gerente': 'Gerente',
      'vendedor': 'Vendedor',
      // Adicionar mapeamentos para roles que podem estar no sistema Spatie mas não no constraint
      'proprietario': 'Proprietário', // Vai ser mapeado para role válida no DB
      'user': 'Vendedor', // Role padrão
    };
    return mapping[role as keyof typeof mapping] || role;
  }

  // ✅ MAPEAR TIPO/ROLE SPATIE PARA ROLE VÁLIDA NO CONSTRAINT DB
  private mapToValidDbRole(roleName: string): string {
    // Mapeamento inverso: do sistema Spatie para o constraint da coluna legacy
    const spatieToDbMapping = {
      'proprietario': 'gerente', // proprietario do Spatie vira gerente no DB legacy
      'user': 'vendedor', // user padrão vira vendedor
      'admin': 'admin',
      'consultor': 'consultor',
      'gerente': 'gerente', 
      'vendedor': 'vendedor',
    };
    
    const validRole = spatieToDbMapping[roleName as keyof typeof spatieToDbMapping];
    if (validRole) {
      return validRole;
    }
    
    // Se não encontrou mapeamento, tentar inferir baseado no nome
    const lowerRole = roleName.toLowerCase();
    if (lowerRole.includes('admin')) return 'admin';
    if (lowerRole.includes('gerente') || lowerRole.includes('manager') || lowerRole.includes('proprietario')) return 'gerente';
    if (lowerRole.includes('consultor') || lowerRole.includes('analyst')) return 'consultor';
    
    return 'vendedor'; // Fallback seguro
  }

  // ==========================================
  // 🔐 MÉTODOS DE PERMISSÕES
  // ==========================================

  async getUserPermissions(id: string): Promise<UserPermissionsResponse> {
    return await userPermissionsService.getUserPermissions(id);
  }

  async getUserPermissionsSummary(id: string): Promise<UserPermissionsSummary> {
    return await userPermissionsService.getUserPermissionsSummary(id);
  }

  async checkUserPermission(id: string, permissionName: string): Promise<boolean> {
    try {
      const result = await userPermissionsService.checkUserPermission(id, permissionName);
      return result.hasPermission;
    } catch (error) {
      console.error(`Erro ao verificar permissão ${permissionName} para usuário ${id}:`, error);
      return false;
    }
  }

  async assignUserRole(id: string, roleId: number): Promise<void> {
    await userPermissionsService.assignUserRole(id, roleId);
  }

  async syncUserPermissions(id: string, permissionIds: number[]): Promise<void> {
    await userPermissionsService.syncUserPermissions(id, permissionIds);
  }

  // ✅ MÉTODO AUXILIAR PARA BUSCAR DADOS COMPLETOS COM DEBUG
  async findOneWithDebug(id: string): Promise<{usuario: Usuario, debug: any}> {
    try {
      console.log(`🔍 [DEBUG] Buscando dados completos + debug para usuário ${id}`);
      
      const [usuarioResponse, debugResponse] = await Promise.allSettled([
        api.get(`/usuarios/${id}`),
        api.get(`/usuarios/debug-permissions/${id}`)
      ]);

      let usuario: Usuario;
      if (usuarioResponse.status === 'fulfilled') {
        usuario = this.mapApiResponseToUsuario(usuarioResponse.value.data);
      } else {
        throw usuarioResponse.reason;
      }

      let debug: any = {};
      if (debugResponse.status === 'fulfilled') {
        debug = debugResponse.value.data;
      } else {
        console.warn('Debug endpoint não disponível:', debugResponse.reason.message);
        debug = { error: debugResponse.reason.message };
      }

      return { usuario, debug };
    } catch (error) {
      console.error(`❌ [DEBUG] Erro ao buscar dados com debug:`, error);
      throw error;
    }
  }
}

// ✅ INSTÂNCIA DO SERVICE
const usuariosService = new UsuariosApiService();

// ✅ FILTROS INICIAIS
const initialFilters: UsuariosFilters = {
  search: '',
  status: 'all',
  role: 'all',
  page: 1,
  limit: 10,
  includeInactive: false,
};

// ✅ HOOK PRINCIPAL INTEGRADO COM API
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UsuariosFilters>(initialFilters);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // ✅ FUNÇÃO PARA CARREGAR USUÁRIOS DA API
  const loadUsuarios = useCallback(async (currentFilters: UsuariosFilters) => {
    console.log('🔄 [useUsuarios] Iniciando carregamento de usuários com filtros:', currentFilters);
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('📡 [useUsuarios] Fazendo chamada para API...');
      const response = await usuariosService.findAll(currentFilters);
      console.log('✅ [useUsuarios] Resposta da API recebida:', {
        totalUsuarios: response.data?.length,
        pagination: response.pagination,
        firstUser: response.data?.[0]
      });
      
      setUsuarios(response.data);
      setPagination(response.pagination);
      
      console.log('✅ [useUsuarios] Estado atualizado com sucesso');
    } catch (err) {
      console.error('❌ [useUsuarios] Erro ao carregar usuários:', err);
      console.error('❌ [useUsuarios] Detalhes do erro:', {
        message: err instanceof Error ? err.message : 'Erro desconhecido',
        stack: err instanceof Error ? err.stack : undefined,
        response: (err as any)?.response?.data
      });
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
      setUsuarios([]);
    } finally {
      setLoading(false);
      console.log('🏁 [useUsuarios] Carregamento finalizado');
    }
  }, []);

  // ✅ CARREGAR DADOS INICIAL E QUANDO FILTROS MUDAREM
  useEffect(() => {
    console.log('🎯 [useUsuarios] useEffect triggered with filters:', filters);
    console.log('🔗 [useUsuarios] API baseURL:', api.defaults.baseURL);
    console.log('🔑 [useUsuarios] API headers:', api.defaults.headers);
    loadUsuarios(filters);
  }, [filters, loadUsuarios]);

  // ✅ HANDLERS PARA FILTROS E PAGINAÇÃO
  const handleFilterChange = useCallback((newFilters: Partial<UsuariosFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset para primeira página ao filtrar
    }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  // ✅ FUNÇÃO PARA REFETCH
  const refetch = useCallback(() => {
    loadUsuarios(filters);
  }, [filters, loadUsuarios]);

  // ✅ OPERAÇÕES CRUD
  const createUsuario = useCallback(async (data: UsuarioFormData): Promise<Usuario> => {
    try {
      setError(null);
      const novoUsuario = await usuariosService.create(data);
      
      // Recarregar lista após criação
      await refetch();
      
      return novoUsuario;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar usuário';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [refetch]);

  const updateUsuario = useCallback(async (id: string, data: Partial<UsuarioFormData>): Promise<Usuario> => {
    try {
      setError(null);
      const usuarioAtualizado = await usuariosService.update(id, data);
      
      // Recarregar lista após atualização
      await refetch();
      
      return usuarioAtualizado;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar usuário';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [refetch]);

  const deleteUsuario = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await usuariosService.remove(id);
      
      // Recarregar lista após exclusão
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir usuário';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [refetch]);

  const changeUserPassword = useCallback(async (id: string, data: ChangePasswordDto) => {
    try {
      setError(null);
      return await usuariosService.changePassword(id, data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao alterar senha';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const resetUserPassword = useCallback(async (id: string, data: ResetPasswordDto) => {
    try {
      setError(null);
      return await usuariosService.resetPassword(id, data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao resetar senha';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // ✅ FUNÇÃO PARA TESTAR CONECTIVIDADE DA API
  const testApiConnection = useCallback(async () => {
    console.log('🧪 [useUsuarios] Testando conectividade da API...');
    try {
      // Teste simples com endpoint básico
      const response = await api.get('/');
      console.log('✅ [useUsuarios] API respondendo:', response.data);
      return true;
    } catch (err) {
      console.error('❌ [useUsuarios] API não está respondendo:', err);
      return false;
    }
  }, []);

  // ✅ FUNÇÃO PARA BUSCAR UM USUÁRIO ESPECÍFICO
  const findUsuario = useCallback(async (id: string): Promise<Usuario> => {
    try {
      setError(null);
      return await usuariosService.findOne(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar usuário';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // ✅ FUNÇÃO PARA BUSCAR USUÁRIO COM DEBUG (DESENVOLVIMENTO)
  const findUsuarioWithDebug = useCallback(async (id: string) => {
    try {
      setError(null);
      return await usuariosService.findOneWithDebug(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar usuário com debug';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // ✅ FUNÇÃO PARA CONVERTER USUÁRIO PARA FORM DATA
  const usuarioToFormData = useCallback((usuario: Usuario): UsuarioFormData => {
    return mapUsuarioToFormData(usuario);
  }, []);

  // ==========================================
  // 🔐 FUNÇÕES DE PERMISSÕES
  // ==========================================

  const getUserPermissions = useCallback(async (id: string): Promise<UserPermissionsResponse> => {
    try {
      setError(null);
      return await usuariosService.getUserPermissions(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar permissões';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const getUserPermissionsSummary = useCallback(async (id: string): Promise<UserPermissionsSummary> => {
    try {
      setError(null);
      return await usuariosService.getUserPermissionsSummary(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar resumo de permissões';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const checkUserPermission = useCallback(async (id: string, permissionName: string): Promise<boolean> => {
    try {
      setError(null);
      return await usuariosService.checkUserPermission(id, permissionName);
    } catch (err) {
      console.error(`Erro ao verificar permissão ${permissionName}:`, err);
      return false;
    }
  }, []);

  const assignUserRole = useCallback(async (id: string, roleId: number): Promise<void> => {
    try {
      setError(null);
      await usuariosService.assignUserRole(id, roleId);
      // Invalidar cache de permissões
      userPermissionsService.invalidateUserCache(id);
      // Recarregar lista se necessário
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atribuir role';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [refetch]);

  const syncUserPermissions = useCallback(async (id: string, permissionIds: number[]): Promise<void> => {
    try {
      setError(null);
      await usuariosService.syncUserPermissions(id, permissionIds);
      // Invalidar cache de permissões
      userPermissionsService.invalidateUserCache(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao sincronizar permissões';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // ✅ ESTATÍSTICAS RÁPIDAS
  const statistics = {
    totalUsuarios: pagination.total,
    usuariosAtivos: usuarios.filter(u => u.status === UsuarioStatus.ATIVO).length,
    usuariosInativos: usuarios.filter(u => u.status === UsuarioStatus.INATIVO).length,
    gerentes: usuarios.filter(u => u.roles?.some(r => r.name === UsuarioRole.GERENTE)).length,
    administradores: usuarios.filter(u => u.roles?.some(r => r.name === UsuarioRole.ADMIN)).length,
    vendedores: usuarios.filter(u => u.roles?.some(r => r.name === UsuarioRole.VENDEDOR)).length,
    consultores: usuarios.filter(u => u.roles?.some(r => r.name === UsuarioRole.CONSULTOR)).length,
  };

  return {
    // ✅ DADOS
    usuarios,
    loading,
    error,
    pagination,
    filters,
    statistics,

    // ✅ HANDLERS
    handleFilterChange,
    handlePageChange,
    refetch,

    // ✅ CRUD OPERATIONS
    createUsuario,
    updateUsuario,
    deleteUsuario,
    findUsuario,
    findUsuarioWithDebug,
    changeUserPassword,
    resetUserPassword,

    // ✅ PERMISSÕES
    getUserPermissions,
    getUserPermissionsSummary,
    checkUserPermission,
    assignUserRole,
    syncUserPermissions,

    // ✅ UTILITÁRIOS
    usuarioToFormData,
    clearError: () => setError(null),
    isEmptyResult: usuarios.length === 0 && !loading,
    
    // 🧪 TESTE E DEBUG
    testApiConnection,
  };
}

// ✅ HOOK SIMPLIFICADO PARA COMPATIBILIDADE
export function useUsuariosSimple() {
  const {
    usuarios,
    loading,
    pagination,
    filters,
    handleFilterChange,
    handlePageChange,
    refetch
  } = useUsuarios();

  return {
    usuarios,
    loading,
    pagination,
    filters,
    handleFilterChange,
    handlePageChange,
    refetch
  };
}

// ✅ HOOK PARA ESTATÍSTICAS
export function useUsuariosStats() {
  const { statistics, loading, error } = useUsuarios();
  return { statistics, loading, error };
}