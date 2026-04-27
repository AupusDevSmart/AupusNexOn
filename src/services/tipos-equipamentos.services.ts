// src/services/tipos-equipamentos.services.ts
import { api } from '@/config/api';

// ============================================================================
// TIPOS
// ============================================================================

export interface CategoriaEquipamento {
  id: string;
  nome: string;
  _count?: {
    modelos: number;
  };
}

export interface CampoTecnico {
  nome: string;
  tipo: 'text' | 'number' | 'select' | 'boolean';
  obrigatorio?: boolean;
  unidade?: string;
  opcoes?: string[];
  placeholder?: string;
}

export interface TipoEquipamento {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  categoriaId: string;
  categoria: CategoriaEquipamento;
  fabricante: string;
  propriedadesSchema?: {  // ✅ CORRIGIDO: backend retorna camelCase
    campos?: CampoTecnico[];
  };
  propriedades_schema?: {  // Manter para compatibilidade
    campos?: CampoTecnico[];
  };
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TipoEquipamentoResponse {
  success: boolean;
  data: TipoEquipamento[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// ============================================================================
// SERVIÇO API
// ============================================================================

class TiposEquipamentosApiService {
  private readonly baseEndpoint = '/tipos-equipamentos';

  /**
   * Buscar todos os tipos de equipamentos (modelos)
   * @param params.categoria_id - Filtrar por ID da categoria
   * @param params.ativo - Filtrar por tipos ativos
   * @param params.search - Buscar por código, nome ou fabricante
   */
  async getAll(params?: { categoria_id?: string; ativo?: boolean; search?: string }): Promise<TipoEquipamento[]> {
    try {
      const response = await api.get<any>(this.baseEndpoint, {
        params: {
          categoria_id: params?.categoria_id,
          search: params?.search,
        },
      });

      // Backend retorna { data: tipos[], categorias, total } — o interceptor desembrulha
      // { success, data: {...} } pra este objeto. Tentamos array direto primeiro, depois .data.
      const payload = response.data;
      const data: TipoEquipamento[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      console.log('✅ [TIPOS-EQUIPAMENTOS] Tipos carregados da API:', data.length);
      return data;
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao carregar tipos:', error);
      return []; // Retornar array vazio em caso de erro ao invés de throw
    }
  }

  /**
   * Buscar tipo de equipamento por código
   */
  async findByCode(codigo: string): Promise<TipoEquipamento | null> {
    try {
      const tipos = await this.getAll();
      return tipos.find((t) => t.codigo === codigo) || null;
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao buscar tipo por código:', error);
      return null;
    }
  }

  /**
   * Buscar tipo de equipamento por ID
   */
  async findById(id: string): Promise<TipoEquipamento | null> {
    try {
      const response = await api.get<TipoEquipamento>(
        `${this.baseEndpoint}/${id}`
      );
      return response.data || null;
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao buscar tipo por ID:', error);
      return null;
    }
  }

  /**
   * @deprecated Use categoriasEquipamentosApi.getAll() instead
   * Buscar categorias únicas (mantido para compatibilidade)
   */
  async getCategorias(): Promise<CategoriaEquipamento[]> {
    try {
      const response = await api.get<CategoriaEquipamento[]>(`${this.baseEndpoint}/categorias`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao buscar categorias:', error);
      return [];
    }
  }

  /**
   * Buscar tipos (modelos) por categoria_id
   */
  async findByCategoriaId(categoria_id: string): Promise<TipoEquipamento[]> {
    try {
      return await this.getAll({ categoria_id });
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao buscar tipos por categoria:', error);
      return [];
    }
  }

  /**
   * Criar novo tipo de equipamento (modelo)
   */
  async create(data: {
    codigo: string;
    nome: string;
    categoriaId: string;
    fabricante: string;
    descricao?: string;
  }): Promise<TipoEquipamento | null> {
    try {
      const response = await api.post<TipoEquipamento>(this.baseEndpoint, data);
      return response.data || null;
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao criar tipo:', error);
      throw error; // Re-throw para mostrar erro ao usuário
    }
  }
}

// ============================================================================
// HELPERS PARA COMPATIBILIDADE COM MODAIS
// ============================================================================

/**
 * Converter TipoEquipamento da API para formato esperado pelos modais
 */
export interface TipoEquipamentoModal {
  value: string;
  label: string;
  categoria: string | CategoriaEquipamento;
  camposTecnicos: Array<{
    campo: string;
    tipo: 'text' | 'number' | 'select';
    unidade?: string;
    opcoes?: string[];
    obrigatorio?: boolean;
  }>;
}

export const convertToModalFormat = (tipo: TipoEquipamento): TipoEquipamentoModal => {
  // ✅ CORRIGIDO: aceitar tanto camelCase (do backend) quanto snake_case (compatibilidade)
  const campos = tipo.propriedadesSchema?.campos || tipo.propriedades_schema?.campos || [];

  return {
    value: tipo.codigo,
    label: tipo.nome,
    categoria: tipo.categoria,
    camposTecnicos: campos.map((campo) => ({
      campo: campo.nome,
      tipo: campo.tipo === 'boolean' ? 'select' : campo.tipo,
      unidade: campo.unidade,
      opcoes: campo.opcoes || (campo.tipo === 'boolean' ? ['Sim', 'Não'] : undefined),
      obrigatorio: campo.obrigatorio,
    })),
  };
};

/**
 * Helper para buscar tipo formatado por código
 */
export const getTipoEquipamento = async (
  codigo: string
): Promise<TipoEquipamentoModal | undefined> => {
  const tipo = await tiposEquipamentosApi.findByCode(codigo);
  return tipo ? convertToModalFormat(tipo) : undefined;
};

/**
 * Helper para obter todos os tipos formatados
 */
export const getTiposEquipamentos = async (): Promise<TipoEquipamentoModal[]> => {
  const tipos = await tiposEquipamentosApi.getAll();
  return tipos.map(convertToModalFormat);
};

// ============================================================================
// SERVIÇO API - CATEGORIAS DE EQUIPAMENTOS
// ============================================================================

class CategoriasEquipamentosApiService {
  private readonly baseEndpoint = '/categorias-equipamentos';

  /**
   * Buscar todas as categorias de equipamentos
   */
  async getAll(): Promise<CategoriaEquipamento[]> {
    try {
      const response = await api.get<{ success: boolean; data: CategoriaEquipamento[] }>(this.baseEndpoint);

      console.log('📦 [CATEGORIAS-EQUIPAMENTOS] Resposta da API:', response.data);

      // ✅ CORRIGIDO: Extrair array de response.data
      const categorias = response.data || [];
      console.log('✅ [CATEGORIAS-EQUIPAMENTOS] Categorias extraídas:', categorias);

      // Garantir que sempre retorna array
      return Array.isArray(categorias) ? categorias : [];
    } catch (error) {
      console.error('❌ [CATEGORIAS-EQUIPAMENTOS] Erro ao carregar categorias:', error);
      return [];
    }
  }

  /**
   * Buscar categoria por ID com modelos
   */
  async findById(id: string): Promise<CategoriaEquipamento & { modelos?: TipoEquipamento[] } | null> {
    try {
      const response = await api.get<CategoriaEquipamento & { modelos?: TipoEquipamento[] }>(
        `${this.baseEndpoint}/${id}`
      );
      return response.data || null;
    } catch (error) {
      console.error('❌ [CATEGORIAS-EQUIPAMENTOS] Erro ao buscar categoria por ID:', error);
      return null;
    }
  }

  /**
   * Criar nova categoria
   */
  async create(nome: string): Promise<CategoriaEquipamento | null> {
    try {
      const response = await api.post<CategoriaEquipamento>(this.baseEndpoint, { nome });
      return response.data || null;
    } catch (error) {
      console.error('❌ [CATEGORIAS-EQUIPAMENTOS] Erro ao criar categoria:', error);
      throw error;
    }
  }

  /**
   * Atualizar categoria
   */
  async update(id: string, nome: string): Promise<CategoriaEquipamento | null> {
    try {
      const response = await api.patch<CategoriaEquipamento>(`${this.baseEndpoint}/${id}`, { nome });
      return response.data || null;
    } catch (error) {
      console.error('❌ [CATEGORIAS-EQUIPAMENTOS] Erro ao atualizar categoria:', error);
      return null;
    }
  }

  /**
   * Excluir categoria (somente se não tiver modelos)
   */
  async delete(id: string): Promise<boolean> {
    try {
      await api.delete(`${this.baseEndpoint}/${id}`);
      return true;
    } catch (error) {
      console.error('❌ [CATEGORIAS-EQUIPAMENTOS] Erro ao excluir categoria:', error);
      return false;
    }
  }
}

// ============================================================================
// EXPORTAÇÃO DAS INSTÂNCIAS
// ============================================================================

export const tiposEquipamentosApi = new TiposEquipamentosApiService();
export const categoriasEquipamentosApi = new CategoriasEquipamentosApiService();
