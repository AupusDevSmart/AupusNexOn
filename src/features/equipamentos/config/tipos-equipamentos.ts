// src/features/equipamentos/config/tipos-equipamentos.ts - TIPOS E DADOS TÉCNICOS
export interface CampoTecnico {
  campo: string;
  tipo: 'text' | 'number' | 'select';
  unidade?: string;
  opcoes?: string[];
  obrigatorio?: boolean;
}

export interface TipoEquipamento {
  value: string;
  label: string;
  categoria: string;
  camposTecnicos: CampoTecnico[];
}

export const tiposEquipamentos: TipoEquipamento[] = [
  // ============================================================================
  // MÓDULO GERAL (MG) - CIVIL E COMUM
  // ============================================================================
  {
    value: 'mg_tipo_fundacao',
    label: 'MG - Tipo de Fundação',
    categoria: 'civil',
    camposTecnicos: [
      { campo: 'Tipo', tipo: 'select', opcoes: ['Abrigo', 'Cercamento', 'Casa Comando', 'Pátio'], obrigatorio: true }
    ]
  },

  // ============================================================================
  // EQUIPAMENTOS ELÉTRICOS
  // ============================================================================
  {
    value: 'motor_inducao',
    label: 'Motor de Indução',
    categoria: 'elétrico',
    camposTecnicos: [
      { campo: 'Potência', tipo: 'number', unidade: 'kW', obrigatorio: true },
      { campo: 'Tensão nominal', tipo: 'text', unidade: 'V', obrigatorio: true },
      { campo: 'Corrente nominal', tipo: 'text', unidade: 'A', obrigatorio: true },
      { campo: 'Fator de serviço', tipo: 'number', obrigatorio: true },
      { campo: 'Número de polos', tipo: 'number', obrigatorio: true },
      { campo: 'Grau de proteção (IP)', tipo: 'select', opcoes: ['IP21', 'IP44', 'IP54', 'IP55', 'IP65', 'IP66'], obrigatorio: true },
      { campo: 'Classe de isolamento', tipo: 'select', opcoes: ['A', 'B', 'F', 'H'], obrigatorio: true },
      { campo: 'Tipo de partida', tipo: 'select', opcoes: ['Direta', 'Estrela-Triângulo', 'Soft-Start', 'Inversor'] }
    ]
  },
  
  {
    value: 'banco_capacitor',
    label: 'Banco de Capacitor',
    categoria: 'elétrico',
    camposTecnicos: [
      { campo: 'Potência reativa', tipo: 'number', unidade: 'kVAr', obrigatorio: true },
      { campo: 'Tensão nominal', tipo: 'text', unidade: 'V', obrigatorio: true },
      { campo: 'Frequência', tipo: 'number', unidade: 'Hz', obrigatorio: true },
      { campo: 'Número de etapas', tipo: 'number', obrigatorio: true },
      { campo: 'Tipo de controle', tipo: 'select', opcoes: ['Manual', 'Automático'], obrigatorio: true },
      { campo: 'Proteção contra sobrecorrente', tipo: 'text' }
    ]
  },

  {
    value: 'transformador',
    label: 'Transformador',
    categoria: 'elétrico',
    camposTecnicos: [
      { campo: 'Potência nominal', tipo: 'number', unidade: 'kVA', obrigatorio: true },
      { campo: 'Tensão primária', tipo: 'text', unidade: 'V', obrigatorio: true },
      { campo: 'Tensão secundária', tipo: 'text', unidade: 'V', obrigatorio: true },
      { campo: 'Tipo de refrigeração', tipo: 'select', opcoes: ['ONAN', 'ONAF', 'A SECO'], obrigatorio: true },
      { campo: 'Impedância', tipo: 'number', unidade: '%', obrigatorio: true },
      { campo: 'Grupo de ligação', tipo: 'text', obrigatorio: true },
      { campo: 'Nível de isolamento', tipo: 'text', unidade: 'kV' }
    ]
  },

  {
    value: 'pde',
    label: 'PDE - Poste de Distribuição de Energia',
    categoria: 'infraestrutura',
    camposTecnicos: [
      { campo: 'Altura', tipo: 'number', unidade: 'm', obrigatorio: true },
      { campo: 'Tipo de material', tipo: 'select', opcoes: ['Concreto', 'Madeira', 'Aço'], obrigatorio: true },
      { campo: 'Classe de esforço', tipo: 'text', obrigatorio: true },
      { campo: 'Número de fases atendidas', tipo: 'select', opcoes: ['1', '2', '3'], obrigatorio: true },
      { campo: 'Tipo de estrutura', tipo: 'select', opcoes: ['DT', 'CC'], obrigatorio: true }
    ]
  },

  {
    value: 'cabine_blindada',
    label: 'Cabine Blindada ao Tempo',
    categoria: 'infraestrutura',
    camposTecnicos: [
      { campo: 'Tensão de operação', tipo: 'text', unidade: 'kV', obrigatorio: true },
      { campo: 'Corrente nominal', tipo: 'text', unidade: 'A', obrigatorio: true },
      { campo: 'Grau de proteção (IP)', tipo: 'select', opcoes: ['IP23', 'IP33', 'IP54', 'IP65'], obrigatorio: true },
      { campo: 'Tipo de ventilação', tipo: 'select', opcoes: ['Natural', 'Forçada'], obrigatorio: true },
      { campo: 'Material da carcaça', tipo: 'select', opcoes: ['Aço inox', 'Aço carbono', 'Alumínio'] },
      { campo: 'Sistema de intertravamento', tipo: 'select', opcoes: ['Mecânico', 'Elétrico', 'Eletromecânico'] }
    ]
  },

  {
    value: 'cabine_alvenaria',
    label: 'Cabine de Alvenaria',
    categoria: 'civil',
    camposTecnicos: [
      { campo: 'Área interna', tipo: 'number', unidade: 'm²', obrigatorio: true },
      { campo: 'Material de construção', tipo: 'select', opcoes: ['Bloco', 'Tijolo', 'Concreto'], obrigatorio: true },
      { campo: 'Espessura das paredes', tipo: 'number', unidade: 'cm', obrigatorio: true },
      { campo: 'Ventilação', tipo: 'select', opcoes: ['Natural', 'Forçada'], obrigatorio: true },
      { campo: 'Número de acessos', tipo: 'number', obrigatorio: true }
    ]
  },

  // ============================================================================
  // QUADROS ELÉTRICOS
  // ============================================================================
  {
    value: 'qgbt',
    label: 'QGBT - Quadro Geral de Baixa Tensão',
    categoria: 'quadro_eletrico',
    camposTecnicos: [
      { campo: 'Corrente nominal', tipo: 'text', unidade: 'A', obrigatorio: true },
      { campo: 'Número de barramentos', tipo: 'number', obrigatorio: true },
      { campo: 'Tipo de disjuntores', tipo: 'text', obrigatorio: true },
      { campo: 'Grau de proteção (IP)', tipo: 'select', opcoes: ['IP20', 'IP30', 'IP40', 'IP54'], obrigatorio: true },
      { campo: 'Forma de separação interna', tipo: 'text' },
      { campo: 'Capacidade de curto-circuito', tipo: 'text', unidade: 'kA' }
    ]
  },

  {
    value: 'qd',
    label: 'QD - Quadro de Distribuição',
    categoria: 'quadro_eletrico',
    camposTecnicos: [
      { campo: 'Número de circuitos', tipo: 'number', obrigatorio: true },
      { campo: 'Corrente máxima por circuito', tipo: 'text', unidade: 'A', obrigatorio: true },
      { campo: 'Tipo de disjuntores', tipo: 'text', obrigatorio: true },
      { campo: 'Grau de proteção (IP)', tipo: 'select', opcoes: ['IP20', 'IP30', 'IP40', 'IP54'], obrigatorio: true },
      { campo: 'Número de fases', tipo: 'select', opcoes: ['1', '2', '3'], obrigatorio: true },
      { campo: 'Tipo de montagem', tipo: 'select', opcoes: ['Embutido', 'Sobrepor'], obrigatorio: true }
    ]
  },

  // ============================================================================
  // ILUMINAÇÃO E SISTEMAS
  // ============================================================================
  {
    value: 'iluminacao',
    label: 'Iluminação',
    categoria: 'iluminacao',
    camposTecnicos: [
      { campo: 'Tipo de luminária', tipo: 'text', obrigatorio: true },
      { campo: 'Potência da lâmpada', tipo: 'number', unidade: 'W', obrigatorio: true },
      { campo: 'Tipo de lâmpada', tipo: 'select', opcoes: ['LED', 'Vapor Metálico', 'Vapor de Sódio', 'Fluorescente'], obrigatorio: true },
      { campo: 'Grau de proteção (IP)', tipo: 'select', opcoes: ['IP44', 'IP54', 'IP65', 'IP66'], obrigatorio: true },
      { campo: 'Altura de instalação', tipo: 'number', unidade: 'm', obrigatorio: true },
      { campo: 'Distribuição luminosa', tipo: 'text' }
    ]
  },

  {
    value: 'cftv',
    label: 'CFTV - Circuito Fechado de TV',
    categoria: 'seguranca',
    camposTecnicos: [
      { campo: 'Número de câmeras', tipo: 'number', obrigatorio: true },
      { campo: 'Tipo de câmera', tipo: 'select', opcoes: ['Bullet', 'Dome', 'PTZ', 'Speed Dome'], obrigatorio: true },
      { campo: 'Resolução', tipo: 'select', opcoes: ['HD', 'Full HD', '4K', '8K'], obrigatorio: true },
      { campo: 'Alcance infravermelho', tipo: 'number', unidade: 'm' },
      { campo: 'Tipo de gravação', tipo: 'select', opcoes: ['Local', 'Nuvem', 'Híbrido'], obrigatorio: true },
      { campo: 'Capacidade de armazenamento', tipo: 'text', unidade: 'TB' }
    ]
  },

  {
    value: 'monitoramento',
    label: 'Monitoramento',
    categoria: 'automacao',
    camposTecnicos: [
      { campo: 'Variáveis monitoradas', tipo: 'text', obrigatorio: true },
      { campo: 'Tipo de sensores', tipo: 'text', obrigatorio: true },
      { campo: 'Frequência de amostragem', tipo: 'text', obrigatorio: true },
      { campo: 'Protocolo de comunicação', tipo: 'select', opcoes: ['Modbus', 'MQTT', 'OPC-UA', 'DNP3', 'IEC 61850'], obrigatorio: true },
      { campo: 'Tipo de alimentação', tipo: 'select', opcoes: ['24VCC', '220VCA', 'Solar', 'Bateria'], obrigatorio: true },
      { campo: 'Nível de precisão', tipo: 'text', unidade: '%' }
    ]
  },

  // ============================================================================
  // ATERRAMENTO E SPDA
  // ============================================================================
  {
    value: 'aterramento_spda',
    label: 'Aterramento / SPDA',
    categoria: 'protecao',
    camposTecnicos: [
      { campo: 'Tipo de sistema', tipo: 'select', opcoes: ['Malha', 'Anel', 'Haste', 'Misto'], obrigatorio: true },
      { campo: 'Resistência de aterramento', tipo: 'number', unidade: 'Ω', obrigatorio: true },
      { campo: 'Número de hastes', tipo: 'number', obrigatorio: true },
      { campo: 'Tipo de condutor', tipo: 'select', opcoes: ['Cobre nu', 'Cabo de aço', 'Fita de aço'], obrigatorio: true },
      { campo: 'Tipo de conectores', tipo: 'select', opcoes: ['Solda exotérmica', 'Conector mecânico', 'Braçadeira'], obrigatorio: true }
    ]
  },

  // ============================================================================
  // ENERGIA SOLAR
  // ============================================================================
  {
    value: 'inversor_solar',
    label: 'Inversor Solar',
    categoria: 'energia_solar',
    camposTecnicos: [
      { campo: 'Potência nominal', tipo: 'number', unidade: 'kW', obrigatorio: true },
      { campo: 'Tensão de entrada (CC)', tipo: 'text', unidade: 'V', obrigatorio: true },
      { campo: 'Tensão de saída (CA)', tipo: 'text', unidade: 'V', obrigatorio: true },
      { campo: 'Rendimento', tipo: 'number', unidade: '%', obrigatorio: true },
      { campo: 'Número de MPPTs', tipo: 'number', obrigatorio: true },
      { campo: 'Tipo de comunicação', tipo: 'select', opcoes: ['RS485', 'Wi-Fi', 'Ethernet', 'Bluetooth'], obrigatorio: true }
    ]
  },

  {
    value: 'placa_solar',
    label: 'Placa Solar',
    categoria: 'energia_solar',
    camposTecnicos: [
      { campo: 'Potência nominal', tipo: 'number', unidade: 'Wp', obrigatorio: true },
      { campo: 'Tensão de operação', tipo: 'text', unidade: 'V', obrigatorio: true },
      { campo: 'Corrente de operação', tipo: 'text', unidade: 'A', obrigatorio: true },
      { campo: 'Tipo de célula', tipo: 'select', opcoes: ['Monocristalina', 'Policristalina', 'Filme Fino'], obrigatorio: true },
      { campo: 'Eficiência', tipo: 'number', unidade: '%', obrigatorio: true },
      { campo: 'Número de células', tipo: 'number', obrigatorio: true },
      { campo: 'Garantia do fabricante', tipo: 'text', unidade: 'anos' }
    ]
  },

  {
    value: 'estrutura_fixa',
    label: 'Estrutura Fixa',
    categoria: 'energia_solar',
    camposTecnicos: [
      { campo: 'Tipo de material', tipo: 'select', opcoes: ['Aço galvanizado', 'Alumínio', 'Aço inox'], obrigatorio: true },
      { campo: 'Inclinação', tipo: 'number', unidade: 'graus', obrigatorio: true },
      { campo: 'Tipo de fixação', tipo: 'select', opcoes: ['Chumbada', 'Estaca', 'Lastro'], obrigatorio: true },
      { campo: 'Tratamento anticorrosivo', tipo: 'text', obrigatorio: true },
      { campo: 'Capacidade de módulos', tipo: 'number', obrigatorio: true }
    ]
  },

  {
    value: 'estrutura_tracker',
    label: 'Estrutura Tracker',
    categoria: 'energia_solar',
    camposTecnicos: [
      { campo: 'Número de eixos', tipo: 'select', opcoes: ['1', '2'], obrigatorio: true },
      { campo: 'Tipo de acionamento', tipo: 'select', opcoes: ['Elétrico', 'Mecânico'], obrigatorio: true },
      { campo: 'Faixa de movimento', tipo: 'text', unidade: 'graus', obrigatorio: true },
      { campo: 'Tipo de controle', tipo: 'select', opcoes: ['Centralizado', 'Autônomo'], obrigatorio: true },
      { campo: 'Velocidade de rastreamento', tipo: 'text', unidade: 'graus/min' }
    ]
  },

  // ============================================================================
  // CERCAMENTO E SEGURANÇA
  // ============================================================================
  {
    value: 'cercamento',
    label: 'Cercamento',
    categoria: 'seguranca',
    camposTecnicos: [
      { campo: 'Tipo de cerca', tipo: 'select', opcoes: ['Alambrado', 'Tela', 'Muro', 'Grade'], obrigatorio: true },
      { campo: 'Altura total', tipo: 'number', unidade: 'm', obrigatorio: true },
      { campo: 'Material da cerca', tipo: 'text', obrigatorio: true },
      { campo: 'Espessura dos postes', tipo: 'text', unidade: 'mm', obrigatorio: true },
      { campo: 'Distância entre postes', tipo: 'number', unidade: 'm', obrigatorio: true },
      { campo: 'Sistema de fixação', tipo: 'select', opcoes: ['Cimento', 'Estaca metálica', 'Base de concreto'], obrigatorio: true }
    ]
  }
];

// Helper para buscar tipo por value
export const getTipoEquipamento = (value: string): TipoEquipamento | undefined => {
  return tiposEquipamentos.find(tipo => tipo.value === value);
};

// Helper para obter categorias únicas
export const getCategorias = (): string[] => {
  return [...new Set(tiposEquipamentos.map(tipo => tipo.categoria))];
};

// Helper para obter tipos por categoria
export const getTiposPorCategoria = (categoria: string): TipoEquipamento[] => {
  return tiposEquipamentos.filter(tipo => tipo.categoria === categoria);
};