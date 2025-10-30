// src/services/selection-data.services.ts - COM PROPRIETÁRIOS COM PLANTAS
import { api } from '@/config/api';
import { UsuariosService } from './usuarios.services';
import { PlantasService } from './plantas.services';

// ============================================================================
// TIPOS PARA DADOS DE SELEÇÃO
// ============================================================================

export interface SelectionOption {
  id: string;
  nome: string;
  label?: string;
}

export interface ProprietarioSelection extends SelectionOption {
  cpf_cnpj: string;
  tipo: 'pessoa_fisica' | 'pessoa_juridica';
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  totalPlantas?: number; // Novo campo para contar plantas
}

export interface PlantaSelection extends SelectionOption {
  localizacao?: string;
  cnpj?: string;
  proprietario_id: string;
}

export interface TipoEquipamento {
  value: string;
  label: string;
  categoria: 'eletrico' | 'mecanico' | 'hidraulico' | 'pneumatico' | 'eletronica' | 'outro';
  campos_tecnicos?: CampoTecnico[];
}

export interface CampoTecnico {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  unit?: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

// ============================================================================
// SERVIÇO - COM INTEGRAÇÃO COM PLANTAS
// ============================================================================

export class SelectionDataService {
  
  // ============================================================================
  // PROPRIETÁRIOS - TODOS OS USUÁRIOS COM ROLES VÁLIDAS
  // ============================================================================
  async getProprietarios(): Promise<ProprietarioSelection[]> {
    try {
      // console.log('🔍 [SELECTION] Buscando todos os proprietários...');

      // Buscar TODOS os usuários com roles válidas
      const response = await api.get('/usuarios', {
        params: {
          roles: 'admin,gerente,proprietario',
          limit: 1000  // Buscar todos
        }
      });

      const usuariosData = response.data.data || response.data;
      const usuarios = usuariosData.data || usuariosData || [];

      if (usuarios.length === 0) {
        // console.warn('⚠️ [SELECTION] Nenhum usuário encontrado.');
        return [];
      }

      // Mapear usuários para formato de proprietários
      const proprietarios: ProprietarioSelection[] = usuarios.map((usuario: any) => ({
        id: usuario.id,
        nome: usuario.nome,
        cpf_cnpj: usuario.cpf_cnpj || '',
        tipo: this.detectTipoPessoa(usuario.cpf_cnpj),
        email: usuario.email,
        telefone: usuario.telefone,
        cidade: usuario.cidade,
        estado: usuario.estado,
        totalPlantas: 0, // Não precisamos contar plantas aqui
        label: `${usuario.nome}${usuario.cpf_cnpj ? ` (${UsuariosService.formatCpfCnpj(usuario.cpf_cnpj)})` : ''}`
      }));

      // Ordenar por nome
      proprietarios.sort((a, b) => a.nome.localeCompare(b.nome));

      // console.log('✅ [SELECTION] Proprietários carregados:', proprietarios.length);

      return proprietarios;

    } catch (error) {
      // console.error('❌ [SELECTION] Erro ao carregar proprietários:', error);
      throw error;
    }
  }

  // ============================================================================
  // PLANTAS - DINÂMICO POR PROPRIETÁRIO
  // ============================================================================
  async getPlantas(proprietarioId?: string): Promise<PlantaSelection[]> {
    try {
      // console.log('🔍 [SELECTION] Carregando plantas para proprietário:', proprietarioId);
      
      if (!proprietarioId || proprietarioId === 'all') {
        // console.log('⚠️ [SELECTION] Proprietário não especificado, retornando array vazio');
        return [];
      }

      // Buscar plantas do proprietário específico com paginação
      let todasPlantas: any[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const plantasPage = await PlantasService.getAllPlantas({
          proprietarioId,
          limit: 100,
          page: page
        });
        
        if (!plantasPage.data || plantasPage.data.length === 0) {
          hasMore = false;
        } else {
          todasPlantas = [...todasPlantas, ...plantasPage.data];
          hasMore = plantasPage.pagination.page < plantasPage.pagination.totalPages;
          page++;
        }
      }

      if (todasPlantas.length === 0) {
        // console.warn(`⚠️ [SELECTION] Nenhuma planta encontrada para proprietário ${proprietarioId}`);
        return [];
      }

      // Mapear plantas para formato de seleção
      const plantas: PlantaSelection[] = todasPlantas.map(planta => ({
        id: planta.id,
        nome: planta.nome,
        localizacao: planta.localizacao,
        cnpj: planta.cnpj,
        proprietario_id: planta.proprietarioId,
        label: `${planta.nome} - ${planta.localizacao || 'Localização não informada'}`
      }));

      // Ordenar por nome
      plantas.sort((a, b) => a.nome.localeCompare(b.nome));

      // console.log(`✅ [SELECTION] ${plantas.length} plantas carregadas para proprietário ${proprietarioId}`);
      
      return plantas;

    } catch (error) {
      // console.error(`❌ [SELECTION] Erro ao carregar plantas para proprietário ${proprietarioId}:`, error);
      throw error; // Re-throw ao invés de usar mock
    }
  }

  private detectTipoPessoa(documento?: string): 'pessoa_fisica' | 'pessoa_juridica' {
    if (!documento) return 'pessoa_fisica';
    const limpo = documento.replace(/\D/g, '');
    return limpo.length > 11 ? 'pessoa_juridica' : 'pessoa_fisica';
  }

  // ============================================================================
  // HIERARQUIA - MOCK (mantido como estava)
  // ============================================================================
  async getHierarquiaNivel(nivel: string, parentId?: string): Promise<any[]> {
    // console.warn(`⚠️ [SELECTION] Usando hierarquia mock para ${nivel}`);
    
    const mockData: Record<string, any[]> = {
      'area': [
        { id: '1', nome: 'Produção', parent_id: parentId },
        { id: '2', nome: 'Logística', parent_id: parentId },
        { id: '3', nome: 'Administrativo', parent_id: parentId },
        { id: '4', nome: 'Manutenção', parent_id: parentId }
      ],
      'subarea': [
        { id: '1', nome: 'Linha A', parent_id: parentId },
        { id: '2', nome: 'Linha B', parent_id: parentId },
        { id: '3', nome: 'Expedição', parent_id: parentId },
        { id: '4', nome: 'Recebimento', parent_id: parentId }
      ],
      'linha': [
        { id: '1', nome: 'Montagem Principal', parent_id: parentId },
        { id: '2', nome: 'Montagem Secundária', parent_id: parentId },
        { id: '3', nome: 'Linha de Embalagem', parent_id: parentId }
      ],
      'conjunto': [
        { id: '1', nome: 'Conjunto Motor Principal', parent_id: parentId },
        { id: '2', nome: 'Conjunto Hidráulico', parent_id: parentId },
        { id: '3', nome: 'Conjunto Pneumático', parent_id: parentId }
      ],
      'maquina': [
        { id: '1', nome: 'Motor Elétrico 01', parent_id: parentId },
        { id: '2', nome: 'Bomba Hidráulica Principal', parent_id: parentId },
        { id: '3', nome: 'Compressor de Ar', parent_id: parentId }
      ]
    };
    
    return (mockData[nivel] || []).map(item => ({
      ...item,
      label: item.nome
    }));
  }

  // ============================================================================
  // TIPOS DE EQUIPAMENTOS - MANTIDO COMO ESTAVA
  // ============================================================================
  async getTiposEquipamentos(): Promise<TipoEquipamento[]> {
    // console.log('🔍 [SELECTION] Carregando tipos de equipamentos...');
    
    return [
      {
        value: 'motor_inducao',
        label: 'Motor de Indução',
        categoria: 'eletrico',
        campos_tecnicos: [
          { key: 'potencia', label: 'Potência', type: 'number', unit: 'kW', required: true },
          { key: 'tensao_nominal', label: 'Tensão Nominal', type: 'number', unit: 'V', required: true },
          { key: 'corrente_nominal', label: 'Corrente Nominal', type: 'number', unit: 'A' },
          { key: 'fator_servico', label: 'Fator de Serviço', type: 'number', placeholder: 'Ex: 1.15' },
          { key: 'numero_polos', label: 'Número de Polos', type: 'select', options: ['2', '4', '6', '8'] },
          { key: 'grau_protecao', label: 'Grau de Proteção (IP)', type: 'select', options: ['IP20', 'IP54', 'IP55', 'IP65'] },
          { key: 'classe_isolamento', label: 'Classe de Isolamento', type: 'select', options: ['A', 'B', 'F', 'H'] },
          { key: 'tipo_partida', label: 'Tipo de Partida', type: 'select', options: ['Direta', 'Estrela-Triângulo', 'Soft-Starter', 'Inversor'] }
        ]
      },
      {
        value: 'transformador',
        label: 'Transformador',
        categoria: 'eletrico',
        campos_tecnicos: [
          { key: 'potencia_nominal', label: 'Potência Nominal', type: 'number', unit: 'kVA', required: true },
          { key: 'tensao_primaria', label: 'Tensão Primária', type: 'number', unit: 'V', required: true },
          { key: 'tensao_secundaria', label: 'Tensão Secundária', type: 'number', unit: 'V', required: true },
          { key: 'grupo_ligacao', label: 'Grupo de Ligação', type: 'text', placeholder: 'Ex: Dyn11' },
          { key: 'tipo_refrigeracao', label: 'Tipo de Refrigeração', type: 'select', options: ['ONAN', 'ONAF', 'ONAN/ONAF', 'A SECO'] },
          { key: 'impedancia', label: 'Impedância', type: 'number', unit: '%', placeholder: 'Ex: 4.5' }
        ]
      },
      {
        value: 'disjuntor',
        label: 'Disjuntor',
        categoria: 'eletrico',
        campos_tecnicos: [
          { key: 'corrente_nominal', label: 'Corrente Nominal', type: 'number', unit: 'A', required: true },
          { key: 'tensao_nominal', label: 'Tensão Nominal', type: 'number', unit: 'kV', required: true },
          { key: 'capacidade_interrupcao', label: 'Capacidade de Interrupção', type: 'number', unit: 'kA' },
          { key: 'tipo', label: 'Tipo', type: 'select', options: ['Caixa Moldada', 'Aberto', 'A Vácuo', 'SF6'] },
          { key: 'curva_disparo', label: 'Curva de Disparo', type: 'select', options: ['B', 'C', 'D', 'K'] }
        ]
      },
      {
        value: 'outro',
        label: 'Outro',
        categoria: 'outro',
        campos_tecnicos: [
          { key: 'descricao_equipamento', label: 'Descrição do Equipamento', type: 'text', required: true, placeholder: 'Descreva o tipo de equipamento' },
          { key: 'especificacao_tecnica', label: 'Especificação Técnica', type: 'text', placeholder: 'Dados técnicos relevantes' },
          { key: 'observacoes_tecnicas', label: 'Observações Técnicas', type: 'text', placeholder: 'Informações adicionais' }
        ]
      }
    ];
  }

  // ============================================================================
  // EQUIPAMENTOS UC DISPONÍVEIS
  // ============================================================================
  async getEquipamentosUCDisponiveis(plantaId?: string): Promise<SelectionOption[]> {
    try {
      const params = plantaId ? { planta_id: plantaId } : {};
      const response = await api.get('/equipamentos/ucs-disponiveis', { params });
      
      if (!response.data || !Array.isArray(response.data)) {
        // console.warn('⚠️ [SELECTION] Resposta de equipamentos UC inválida');
        return [];
      }

      return response.data.map((uc: any) => ({
        id: String(uc.id),
        nome: uc.nome || 'UC sem nome',
        label: uc.nome || 'UC sem nome'
      })).filter(uc => uc.id);
    } catch (error) {
      // console.error('❌ [SELECTION] Erro ao carregar equipamentos UC:', error);
      throw error; // Re-throw ao invés de usar mock
    }
  }
}

// Instância única do serviço
export const selectionDataService = new SelectionDataService();