// src/features/concessionarias/config/table-config.tsx
import {
  Building2,
  MapPin,
  Calendar,
  Zap,
} from 'lucide-react';
import { TableColumn } from '@/types/base';
import type { ConcessionariaResponse } from '@/services/concessionarias.services';
import { Badge } from '@/components/ui/badge';

export const concessionariasTableColumns: TableColumn<ConcessionariaResponse>[] = [
  {
    key: 'dados_principais',
    label: 'Concessionária',
    sortable: true,
    render: (concessionaria) => (
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Zap className="h-4 w-4 text-yellow-600" />
          <span className="truncate max-w-48" title={concessionaria.nome}>
            {concessionaria.nome}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{concessionaria.estado}</span>
        </div>
      </div>
    )
  },
  {
    key: 'vigencia',
    label: 'Vigência',
    render: (concessionaria) => (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>{formatDate(concessionaria.data_inicio)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          até {formatDate(concessionaria.data_validade)}
        </div>
        <div className="mt-1">
          {isVigenciaAtiva(concessionaria.data_inicio, concessionaria.data_validade) ? (
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
              Vigente
            </Badge>
          ) : isVigenciaFutura(concessionaria.data_inicio) ? (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
              Futura
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">
              Expirada
            </Badge>
          )}
        </div>
      </div>
    )
  },
  {
    key: 'tarifas',
    label: 'Tarifas Cadastradas',
    hideOnMobile: true,
    render: (concessionaria) => {
      const tarifasCadastradas = [];

      if (hasTarifas(concessionaria.a4_verde)) {
        tarifasCadastradas.push('A4 Verde');
      }
      if (hasTarifas(concessionaria.a3a_verde)) {
        tarifasCadastradas.push('A3a Verde');
      }
      if (hasTarifas(concessionaria.b)) {
        tarifasCadastradas.push('Grupo B');
      }

      return (
        <div className="flex flex-wrap gap-1">
          {tarifasCadastradas.length > 0 ? (
            tarifasCadastradas.map((tarifa) => (
              <Badge
                key={tarifa}
                variant="outline"
                className="text-xs"
              >
                {tarifa}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">
              Nenhuma tarifa cadastrada
            </span>
          )}
        </div>
      );
    }
  },
  {
    key: 'anexos',
    label: 'Anexos',
    hideOnTablet: true,
    render: (concessionaria) => (
      <div className="flex items-center gap-2">
        <Building2 className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm">
          {concessionaria.anexos?.length || 0} {concessionaria.anexos?.length === 1 ? 'arquivo' : 'arquivos'}
        </span>
      </div>
    )
  },
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

// ✅ HELPER: Verificar se vigência está ativa
function isVigenciaAtiva(dataInicio: string, dataValidade: string): boolean {
  const hoje = new Date();
  const inicio = new Date(dataInicio);
  const validade = new Date(dataValidade);

  return hoje >= inicio && hoje <= validade;
}

// ✅ HELPER: Verificar se vigência é futura
function isVigenciaFutura(dataInicio: string): boolean {
  const hoje = new Date();
  const inicio = new Date(dataInicio);

  return inicio > hoje;
}

// ✅ HELPER: Verificar se tem tarifas cadastradas
function hasTarifas(tarifas: any): boolean {
  if (!tarifas) return false;

  return Object.values(tarifas).some(valor =>
    valor !== null && valor !== undefined && valor !== 0
  );
}

// ✅ CONFIGURAÇÕES ADICIONAIS DA TABELA
export const concessionariasTableConfig = {
  defaultPagination: {
    limit: 10,
    page: 1
  },

  messages: {
    empty: 'Nenhuma concessionária encontrada',
    loading: 'Carregando concessionárias...',
    error: 'Erro ao carregar concessionárias',
    noResults: 'Nenhum resultado encontrado para os filtros aplicados'
  },

  defaultSort: {
    column: 'nome',
    direction: 'asc' as const
  },
} as const;
