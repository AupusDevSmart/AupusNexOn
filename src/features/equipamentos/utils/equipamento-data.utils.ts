// src/features/equipamentos/utils/equipamento-data.utils.ts
// Utilitários para processar e validar dados de equipamentos antes do envio

export interface EquipamentoFormData {
  // Campos básicos obrigatórios
  nome: string;
  proprietarioId: string;
  plantaId: string;
  tipo: string; // Mapeado de tipoEquipamento
  criticidade: string;
  
  // Campos básicos opcionais
  classificacao?: string;
  numeroSerie?: string;
  fabricante?: string;
  modelo?: string;
  fornecedor?: string;
  centroCusto?: string;
  emOperacao?: string;
  tipoDepreciacao?: string;
  planoManutencao?: string;
  
  // Valores numéricos
  valorImobilizado?: number;
  vidaUtil?: number;
  valorDepreciacao?: number;
  valorContabil?: number;
  
  // Datas
  dataImobilizacao?: string;
  
  // MCPSE
  mcpse?: boolean;
  tuc?: string;
  a1?: string;
  a2?: string;
  a3?: string;
  a4?: string;
  a5?: string;
  a6?: string;
  
  // Arrays
  camposAdicionais?: any[];
  componentesUAR?: any[];
  
  // Campos técnicos dinâmicos
  [key: string]: any;
}

export interface EquipamentoCreateRequest {
  nome: string;
  proprietarioId: string;
  plantaId: string;
  tipo: string;
  criticidade: string;
  classificacao?: string;
  numeroSerie?: string;
  fabricante?: string;
  modelo?: string;
  fornecedor?: string;
  centroCusto?: string;
  emOperacao?: string;
  tipoDepreciacao?: string;
  planoManutencao?: string;
  valorImobilizado?: number;
  vidaUtil?: number;
  valorDepreciacao?: number;
  valorContabil?: number;
  dataImobilizacao?: string;
  mcpse?: boolean;
  dadosTecnicos?: Array<{
    campo: string;
    valor: any;
    tipo?: string;
  }>;
  camposPersonalizados?: Array<{
    nome: string;
    valor: string;
    tipo: string;
  }>;
}

// Campos que não devem ser enviados para a API
const CAMPOS_INTERNOS = [
  'tipoEquipamento', // Mapeado para 'tipo'
  'camposAdicionais', // Transformado em camposPersonalizados
  'componentesUAR', // Não enviado no create
  'totalPlantas', // Campo interno do proprietário
  'label' // Campo de UI
];

// Campos MCPSE
const CAMPOS_MCPSE = ['tuc', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];

export class EquipamentoDataUtils {
  
  /**
   * Limpa e valida dados do formulário para envio à API
   */
  static prepareForAPI(formData: EquipamentoFormData): EquipamentoCreateRequest {
    console.log('🔧 [DATA UTILS] Preparando dados para API...');
    console.log('📥 [DATA UTILS] Dados recebidos:', formData);
    
    // Criar objeto base com campos obrigatórios
    const apiData: EquipamentoCreateRequest = {
      nome: formData.nome?.trim(),
      proprietarioId: formData.proprietarioId,
      plantaId: formData.plantaId,
      tipo: formData.tipo || formData.tipoEquipamento,
      criticidade: formData.criticidade
    };
    
    // Adicionar campos opcionais se preenchidos
    const camposOpcionais = [
      'classificacao', 'numeroSerie', 'fabricante', 'modelo', 
      'fornecedor', 'centroCusto', 'emOperacao', 'tipoDepreciacao', 
      'planoManutencao', 'valorImobilizado', 'vidaUtil', 
      'valorDepreciacao', 'valorContabil', 'dataImobilizacao'
    ];
    
    camposOpcionais.forEach(campo => {
      const valor = formData[campo];
      if (valor !== undefined && valor !== null && valor !== '') {
        // Converter valores numéricos
        if (['valorImobilizado', 'vidaUtil', 'valorDepreciacao', 'valorContabil'].includes(campo)) {
          const numeroValor = Number(valor);
          if (!isNaN(numeroValor) && numeroValor > 0) {
            (apiData as any)[campo] = numeroValor;
          }
        } else {
          (apiData as any)[campo] = valor;
        }
      }
    });
    
    // Processar MCPSE
    if (formData.mcpse) {
      apiData.mcpse = true;
    }
    
    // Processar todos os campos técnicos (MCPSE + dinâmicos) como array
    const dadosTecnicosArray: Array<{ campo: string; valor: any; tipo?: string }> = [];
    
    // Adicionar campos MCPSE se habilitado
    if (formData.mcpse) {
      CAMPOS_MCPSE.forEach(campo => {
        const valor = formData[campo];
        if (valor && typeof valor === 'string' && valor.trim()) {
          dadosTecnicosArray.push({
            campo: campo,
            valor: valor.trim(),
            tipo: 'text'
          });
        }
      });
    }
    
    // Adicionar campos técnicos dinâmicos
    Object.keys(formData).forEach(key => {
      // Pular campos internos e campos já processados
      if (CAMPOS_INTERNOS.includes(key) || 
          camposOpcionais.includes(key) || 
          CAMPOS_MCPSE.includes(key) ||
          ['nome', 'proprietarioId', 'plantaId', 'tipo', 'criticidade', 'mcpse'].includes(key)) {
        return;
      }
      
      const valor = formData[key];
      if (valor !== undefined && valor !== null && valor !== '') {
        dadosTecnicosArray.push({
          campo: key,
          valor: valor,
          tipo: typeof valor === 'number' ? 'number' : 
                typeof valor === 'boolean' ? 'boolean' : 'text'
        });
      }
    });
    
    if (dadosTecnicosArray.length > 0) {
      apiData.dadosTecnicos = dadosTecnicosArray;
    }
    
    // Processar campos personalizados
    if (formData.camposAdicionais && Array.isArray(formData.camposAdicionais)) {
      const camposPersonalizados = formData.camposAdicionais
        .filter(campo => campo.nome && campo.valor)
        .map(campo => ({
          nome: campo.nome.trim(),
          valor: campo.valor.toString().trim(),
          tipo: campo.tipo || 'text'
        }));
      
      if (camposPersonalizados.length > 0) {
        apiData.camposPersonalizados = camposPersonalizados;
      }
    }
    
    console.log('📤 [DATA UTILS] Dados preparados para API:', apiData);
    
    return apiData;
  }
  
  /**
   * Valida dados antes do envio
   */
  static validate(data: EquipamentoCreateRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validações obrigatórias
    if (!data.nome?.trim()) {
      errors.push('Nome é obrigatório');
    }
    
    if (!data.proprietarioId) {
      errors.push('Proprietário é obrigatório');
    }
    
    if (!data.plantaId) {
      errors.push('Planta é obrigatória');
    }
    
    if (!data.tipo) {
      errors.push('Tipo de equipamento é obrigatório');
    }
    
    if (!data.criticidade) {
      errors.push('Criticidade é obrigatória');
    }
    
    // Validações de formato
    if (data.valorImobilizado !== undefined && (isNaN(data.valorImobilizado) || data.valorImobilizado < 0)) {
      errors.push('Valor imobilizado deve ser um número positivo');
    }
    
    if (data.vidaUtil !== undefined && (isNaN(data.vidaUtil) || data.vidaUtil <= 0)) {
      errors.push('Vida útil deve ser um número positivo');
    }
    
    if (data.dataImobilizacao && !this.isValidDate(data.dataImobilizacao)) {
      errors.push('Data de imobilização inválida');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Verifica se uma data está em formato válido
   */
  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
  
  /**
   * Limpa dados desnecessários ou vazios
   */
  static cleanData(data: any): any {
    const cleaned: any = {};
    
    Object.keys(data).forEach(key => {
      const value = data[key];
      
      // Pular valores undefined, null ou strings vazias
      if (value === undefined || value === null || value === '') {
        return;
      }
      
      // Pular arrays vazios
      if (Array.isArray(value) && value.length === 0) {
        return;
      }
      
      // Pular objetos vazios
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
        return;
      }
      
      cleaned[key] = value;
    });
    
    return cleaned;
  }
  
  /**
   * Debug: mostra estrutura dos dados de forma organizada
   */
  static debugData(data: any, title: string = 'Dados'): void {
    console.group(`🐛 [DEBUG] ${title}`);
    console.log('📊 Estrutura completa:', data);
    
    console.log('📋 Campos obrigatórios:');
    ['nome', 'proprietarioId', 'plantaId', 'tipo', 'criticidade'].forEach(campo => {
      console.log(`- ${campo}:`, data[campo]);
    });
    
    console.log('💰 Campos numéricos:');
    ['valorImobilizado', 'vidaUtil', 'valorDepreciacao', 'valorContabil'].forEach(campo => {
      if (data[campo] !== undefined) {
        console.log(`- ${campo}:`, data[campo], typeof data[campo]);
      }
    });
    
    if (data.dadosTecnicos && Array.isArray(data.dadosTecnicos) && data.dadosTecnicos.length > 0) {
      console.log('🔧 Dados técnicos (array):');
      data.dadosTecnicos.forEach((item: any, index: number) => {
        console.log(`  [${index}] ${item.campo}: ${item.valor} (${item.tipo || 'text'})`);
      });
    }
    
    if (data.camposPersonalizados && data.camposPersonalizados.length > 0) {
      console.log('✏️ Campos personalizados:');
      data.camposPersonalizados.forEach((item: any, index: number) => {
        console.log(`  [${index}] ${item.nome}: ${item.valor} (${item.tipo})`);
      });
    }
    
    if (data.mcpse) {
      console.log('🏭 MCPSE habilitado');
    }
    
    console.groupEnd();
  }
}