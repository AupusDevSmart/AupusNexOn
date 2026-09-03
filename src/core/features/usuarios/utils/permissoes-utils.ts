// src/features/usuarios/utils/permissoes-utils.ts
import { Permissao } from '../types';

// ✅ NOVO: Função para extrair todas as permissões automaticamente
// Só precisa manter UMA lista - no tipo Permissao
export const obterTodasPermissoes = (): Permissao[] => {
  // ✅ LISTA TODAS AS PERMISSÕES REAIS DO BANCO
  return [
    // Painel
    'PainelGeral',
    'PainelGeralOrganizacoes',
    'PainelGeralCativos',
    'PainelGeralClube',
    // Dashboard
    'dashboard.view',
    // Monitoramento
    'MonitoramentoOrganizacoes',
    'Monitoramento',
    'MonitoramentoConsumo',
    // Sistemas
    'NET',
    'CRM',
    'Oportunidades',
    // Administração
    'Usuarios',
    'Organizacoes',
    'UnidadesConsumidoras',
    'Configuracoes',
    'Arquivos',
    // Configurações
    'configuracoes.view',
    'configuracoes.edit',
    // Cadastros
    'Cadastros',
    'CadastroOrganizacoes',
    'CadastroUsuarios',
    'CadastroUnidadesConsumidoras',
    'CadastroConcessionarias',
    // Financeiro
    'FinanceiroAdmin',
    'Financeiro',
    'FinanceiroConsultor',
    // Super Admin
    'SuperAdmin',
    // Energia
    'GeracaoEnergia',
    'Reclamacoes',
    // Áreas
    'Associados',
    'Documentos',
    'Prospeccao',
    'AreaDoAssociado',
    'AreaDoProprietario',
    'MinhasUsinas',
    // Prospecção
    'prospec.view',
    'prospec.create',
    'prospec.edit',
    'prospec.delete',
    // Controle
    'controle.view',
    'controle.manage',
    // UGs
    'ugs.view',
    'ugs.create',
    'ugs.edit',
    // Relatórios
    'relatorios.view',
    'relatorios.export',
    // Equipe
    'equipe.view',
    'equipe.create'
  ];
};

// Função para inferir categoria automaticamente pelo nome
const inferirCategoria = (permissao: string): string => {
  const permissaoLower = permissao.toLowerCase();
  
  // Regras simples baseadas no nome
  if (permissaoLower.includes('monitoramento')) return 'Monitoramento';
  if (permissaoLower.includes('geracao') || permissaoLower.includes('unidades')) return 'Energia';
  if (permissaoLower.includes('gestao') || permissaoLower.includes('oportunidad') || permissaoLower.includes('prospeccao')) return 'Gestão';
  if (permissaoLower.includes('financeiro')) return 'Financeiro';
  if (permissaoLower.includes('clube') || permissaoLower.includes('associad')) return 'Clube';
  if (permissaoLower.includes('usuario') || permissaoLower.includes('organizac') || permissaoLower.includes('configurac') || permissaoLower.includes('dashboard')) return 'Sistema';
  if (permissaoLower.includes('proprietario')) return 'Proprietários';
  if (permissaoLower.includes('equipamento') || permissaoLower.includes('planta') || permissaoLower.includes('usina')) return 'Operações';
  if (permissaoLower.includes('documento')) return 'Documentos';
  
  return 'Geral'; // Categoria padrão
};

// ✅ NOVO: Função para formatar nome automaticamente
const formatarNomePermissao = (permissao: string): string => {
  // Mapeamento manual só para casos especiais
  const mapeamentoEspecial: Record<string, string> = {
    'MonitoramentoConsumo': 'Monitoramento de Consumo',
    'MonitoramentoClientes': 'Monitoramento de Clientes', 
    'GeracaoEnergia': 'Geração de Energia',
    'UnidadesConsumidoras': 'Unidades Consumidoras',
    'GestaoOportunidades': 'Gestão de Oportunidades',
    'ProspeccaoListagem': 'Listagem de Prospecção',
    'ClubeAupus': 'Clube Aupus',
    'AreaDoAssociado': 'Área do Associado',
    'AreaDoProprietario': 'Área do Proprietário',
    'MinhasUsinas': 'Minhas Usinas'
  };

  // Se tem mapeamento especial, usa ele
  if (mapeamentoEspecial[permissao]) {
    return mapeamentoEspecial[permissao];
  }

  // Senão, formata automaticamente: "MinhasUsinas" → "Minhas Usinas"
  return permissao
    .replace(/([A-Z])/g, ' $1') // Adiciona espaço antes de maiúsculas
    .replace(/^./, str => str.toUpperCase()) // Primeira letra maiúscula
    .trim();
};

// ✅ NOVO: Função para gerar lista estruturada automaticamente
export const gerarPermissoesEstruturadas = () => {
  const todasPermissoes = obterTodasPermissoes();
  
  return todasPermissoes.map(permissao => ({
    value: permissao,
    label: formatarNomePermissao(permissao),
    group: inferirCategoria(permissao)
  }));
};

// ✅ NOVO: Função para agrupar permissões por categoria
export const agruparPermissoesPorCategoria = () => {
  const permissoesEstruturadas = gerarPermissoesEstruturadas();
  
  return permissoesEstruturadas.reduce((acc, permissao) => {
    if (!acc[permissao.group]) {
      acc[permissao.group] = [];
    }
    acc[permissao.group].push(permissao);
    return acc;
  }, {} as Record<string, Array<{ value: Permissao; label: string; group: string }>>);
};

// ✅ NOVO: Função para obter label de uma permissão
export const obterLabelPermissao = (permissao: Permissao): string => {
  return formatarNomePermissao(permissao);
};