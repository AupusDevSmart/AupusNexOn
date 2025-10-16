// src/features/plantas/config/table-config.tsx - ATUALIZADO PARA API
import { 
  Factory, 
  Building2, 
  MapPin, 
  Clock, 
  Calendar,
} from 'lucide-react';
import { TableColumn } from '@/types/base';
import { PlantaApiResponse } from '../types'; // ✅ Usando tipo da API

export const plantasTableColumns: TableColumn<PlantaApiResponse>[] = [
  {
    key: 'dados_principais',
    label: 'Planta',
    sortable: true,
    render: (planta) => (
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Factory className="h-4 w-4 text-blue-600" />
          <span className="truncate max-w-48" title={planta.nome}>
            {planta.nome}
          </span>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          CNPJ: {planta.cnpj}
        </div>
      </div>
    )
  },
  {
    key: 'proprietario',
    label: 'Proprietário',
    render: (planta) => (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-gray-500" />
        <div className="min-w-0 flex-1">
          {planta.proprietario ? (
            <div className="space-y-1">
              <span className="text-sm truncate block max-w-40" title={planta.proprietario.nome}>
                {planta.proprietario.nome}
              </span>
              <div className="text-xs text-muted-foreground">
                {planta.proprietario.tipo === 'pessoa_fisica' ? 'CPF' : 'CNPJ'}: {planta.proprietario.cpf_cnpj}
              </div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              Proprietário não informado
            </span>
          )}
        </div>
      </div>
    )
  },
  {
    key: 'endereco_localizacao',
    label: 'Localização',
    render: (planta) => (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">
            {planta.endereco.cidade}/{planta.endereco.uf}
          </span>
        </div>
        {planta.localizacao && (
          <div className="text-xs text-muted-foreground truncate max-w-32" title={planta.localizacao}>
            {planta.localizacao}
          </div>
        )}
      </div>
    )
  },
  {
    key: 'horario_funcionamento',
    label: 'Funcionamento',
    hideOnMobile: true,
    render: (planta) => (
      <div className="flex items-center gap-2">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm">
          {planta.horarioFuncionamento || 'Não informado'}
        </span>
      </div>
    )
  },
  {
    key: 'endereco_completo',
    label: 'Endereço',
    hideOnTablet: true,
    render: (planta) => (
      <div className="space-y-1">
        <div className="text-sm">
          {planta.endereco.logradouro && (
            <div className="truncate max-w-48" title={planta.endereco.logradouro}>
              {planta.endereco.logradouro}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {planta.endereco.bairro && (
            <div className="truncate" title={planta.endereco.bairro}>
              {planta.endereco.bairro}
            </div>
          )}
          {planta.endereco.cep && (
            <div>CEP: {planta.endereco.cep}</div>
          )}
        </div>
      </div>
    )
  },
  {
    key: 'informacoes_cadastro',
    label: 'Cadastro',
    hideOnMobile: true,
    render: (planta) => (
      <div className="space-y-1">
        {planta.criadoEm && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {formatDate(planta.criadoEm)}
            </span>
          </div>
        )}
        {planta.atualizadoEm && planta.atualizadoEm !== planta.criadoEm && (
          <div className="text-xs text-muted-foreground">
            Atualizada: {formatDate(planta.atualizadoEm)}
          </div>
        )}
      </div>
    )
  }
];

// ✅ HELPER: Formatação de data
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return 'Data inválida';
  }
}

// ✅ CONFIGURAÇÕES ADICIONAIS DA TABELA
export const plantasTableConfig = {
  // Configuração de responsividade
  breakpoints: {
    mobile: 640,
    tablet: 768,
    desktop: 1024
  },
  
  // Configuração de paginação padrão
  defaultPagination: {
    limit: 10,
    page: 1
  },
  
  // Mensagens da tabela
  messages: {
    empty: 'Nenhuma planta encontrada',
    loading: 'Carregando plantas...',
    error: 'Erro ao carregar plantas',
    noResults: 'Nenhum resultado encontrado para os filtros aplicados'
  },
  
  // Configuração de ordenação
  defaultSort: {
    column: 'nome',
    direction: 'asc' as const
  },
  
  // Configuração de ações
  actions: {
    view: {
      label: 'Visualizar',
      icon: 'eye',
      variant: 'ghost' as const
    },
    edit: {
      label: 'Editar',
      icon: 'edit',
      variant: 'ghost' as const
    }
  }
} as const;