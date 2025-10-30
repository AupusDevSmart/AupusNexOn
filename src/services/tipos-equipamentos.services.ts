// src/services/tipos-equipamentos.services.ts
import { api } from '@/config/api';

// ============================================================================
// TIPOS
// ============================================================================

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
  categoria: string;
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
   * Buscar todos os tipos de equipamentos ativos
   */
  async getAll(params?: { categoria?: string; ativo?: boolean }): Promise<TipoEquipamento[]> {
    try {
      const response = await api.get<TipoEquipamentoResponse>(this.baseEndpoint, {
        params: {
          ativo: params?.ativo !== undefined ? params.ativo : true,
          categoria: params?.categoria,
        },
      });

      console.log('📦 [TIPOS-EQUIPAMENTOS] Resposta da API:', response.data);

      // A resposta tem estrutura: { success, data: { data: [...], meta }, meta }
      // Precisamos acessar response.data.data.data
      let data: TipoEquipamento[] = [];

      if (Array.isArray(response.data)) {
        // Se response.data já é array
        data = response.data;
      } else if (Array.isArray(response.data?.data)) {
        // Se response.data.data é array
        data = response.data.data;
      } else if (Array.isArray(response.data?.data?.data)) {
        // Se response.data.data.data é array (estrutura aninhada)
        data = response.data.data.data;
      }

      console.log('✅ [TIPOS-EQUIPAMENTOS] Tipos carregados da API:', data.length);

      // Garantir que sempre retorna array
      return Array.isArray(data) ? data : [];
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
      const response = await api.get<{ success: boolean; data: TipoEquipamento }>(
        `${this.baseEndpoint}/${id}`
      );
      return response.data.data || null;
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao buscar tipo por ID:', error);
      return null;
    }
  }

  /**
   * Buscar categorias únicas
   */
  async getCategorias(): Promise<string[]> {
    try {
      const tipos = await this.getAll();
      const categorias = [...new Set(tipos.map((t) => t.categoria))];
      return categorias.sort();
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao buscar categorias:', error);
      return [];
    }
  }

  /**
   * Buscar tipos por categoria
   */
  async findByCategoria(categoria: string): Promise<TipoEquipamento[]> {
    try {
      return await this.getAll({ categoria });
    } catch (error) {
      console.error('❌ [TIPOS-EQUIPAMENTOS] Erro ao buscar tipos por categoria:', error);
      return [];
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
  categoria: string;
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
// EXPORTAÇÃO DA INSTÂNCIA
// ============================================================================

export const tiposEquipamentosApi = new TiposEquipamentosApiService();
