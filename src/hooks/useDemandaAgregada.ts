import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { equipamentosDadosService, EquipamentoAgregacaoInput } from '@/services/equipamentos-dados.service';
import type { EquipamentoConfig } from '@/features/supervisorio/components/ConfiguracaoDemandaModal';

export type PeriodoTipo = 'dia' | 'mes' | 'ano' | 'custom';

export interface PeriodoFiltro {
  tipo: PeriodoTipo;
  data?: string;     // YYYY-MM-DD (dia)
  mes?: string;      // YYYY-MM (mes)
  ano?: string;      // YYYY (ano)
  inicio?: string;   // ISO (custom)
  fim?: string;      // ISO (custom)
}

export interface PontoDemanda {
  timestamp?: string;
  hora?: string;
  dia?: number;
  mes_numero?: number;
  mes_nome?: string;
  data?: string;
  potencia_kw?: number;
  energia_kwh: number;
}

export interface ResultadoDemandaAgregada {
  dados: PontoDemanda[];
  energiaPeriodo: number;
  agregacao: string;
  isLoading: boolean;
  isInitialLoading: boolean;
  fonteRangeInicio?: string;
  fonteRangeFim?: string;
}

function paraInput(equipamento: EquipamentoConfig): EquipamentoAgregacaoInput | null {
  if (!equipamento.selecionado) return null;
  // NEUTRO = nao soma (controladores, transformadores, chaves, AMBIGUO sem
  // decisão manual). Filtrado fora do request — backend nem ve esses ids.
  if (equipamento.fluxoEnergia === 'NEUTRO') return null;
  const sinal: 1 | -1 = equipamento.fluxoEnergia === 'CONSUMO' ? -1 : 1;
  return {
    id: equipamento.id.trim(),
    sinal,
    multiplicador: equipamento.multiplicador || 1,
  };
}

interface UseDemandaAgregadaArgs {
  equipamentos: EquipamentoConfig[];
  periodo: PeriodoFiltro;
  fatorPerdas?: number;
  intervaloAtualizacao?: number; // segundos, default 30
  ativo?: boolean; // false = gráfico fora da tela: não busca nem polla (default true)
  /** Períodos para pré-carregar em segundo plano depois que o principal chegar. */
  prefetch?: PeriodoFiltro[];
}

const SEM_PREFETCH: PeriodoFiltro[] = [];

function buscarDemanda(
  periodo: PeriodoFiltro,
  equipamentosInput: EquipamentoAgregacaoInput[],
  fatorPerdas: number,
) {
  if (periodo.tipo === 'dia') {
    return equipamentosDadosService.getGraficoDiaMultiplosInversores(
      equipamentosInput,
      { data: periodo.data, fatorPerdas },
    );
  }
  if (periodo.tipo === 'custom') {
    return equipamentosDadosService.getGraficoDiaMultiplosInversores(
      equipamentosInput,
      { inicio: periodo.inicio, fim: periodo.fim, fatorPerdas },
    );
  }
  if (periodo.tipo === 'mes') {
    return equipamentosDadosService.getGraficoMesMultiplosInversores(
      equipamentosInput,
      { mes: periodo.mes, fatorPerdas },
    );
  }
  return equipamentosDadosService.getGraficoAnoMultiplosInversores(
    equipamentosInput,
    { ano: periodo.ano, fatorPerdas },
  );
}

export function useDemandaAgregada({
  equipamentos,
  periodo,
  fatorPerdas = 0,
  intervaloAtualizacao = 30,
  ativo = true,
  prefetch = SEM_PREFETCH,
}: UseDemandaAgregadaArgs): ResultadoDemandaAgregada {
  const equipamentosInput = useMemo(
    () => equipamentos.map(paraInput).filter((e): e is EquipamentoAgregacaoInput => e !== null),
    [equipamentos],
  );

  const habilitado = ativo && equipamentosInput.length > 0 && (
    periodo.tipo !== 'custom' || (!!periodo.inicio && !!periodo.fim)
  );

  // Aba ATIVA polla a cada intervaloAtualizacao; abas históricas (mês/ano/custom)
  // só revalidam quando o usuário trocar de filtro.
  const refetchInterval = periodo.tipo === 'dia' ? intervaloAtualizacao * 1000 : false;

  const queryKey = useMemo(
    () => ['demanda-agregada', periodo, equipamentosInput, fatorPerdas],
    [periodo, equipamentosInput, fatorPerdas],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => buscarDemanda(periodo, equipamentosInput, fatorPerdas),
    enabled: habilitado,
    refetchInterval,
    staleTime: 5_000,
    // Mês/ano não pollam: ficam 10 min em cache para a troca de aba ser instantânea.
    gcTime: periodo.tipo === 'dia' ? 60_000 : 10 * 60_000,
  });

  // Pré-carrega as outras abas (mês e ano correntes) em segundo plano assim que a
  // principal chega: ao clicar, o gráfico já está em cache. Barato no servidor desde
  // o resumo diário da API (NEXON-28); uma vez por combinação de equipamentos.
  const queryClient = useQueryClient();
  const temDados = !!data;
  useEffect(() => {
    if (!habilitado || !temDados || !prefetch.length) return;
    for (const p of prefetch) {
      if (p.tipo === periodo.tipo && !p.data && !p.mes && !p.ano) continue;
      queryClient.prefetchQuery({
        queryKey: ['demanda-agregada', p, equipamentosInput, fatorPerdas],
        queryFn: () => buscarDemanda(p, equipamentosInput, fatorPerdas),
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
      });
    }
  }, [habilitado, temDados, prefetch, periodo.tipo, equipamentosInput, fatorPerdas, queryClient]);

  return useMemo(() => {
    if (!data) {
      return {
        dados: [],
        energiaPeriodo: 0,
        agregacao: '',
        isLoading: isLoading || isFetching,
        isInitialLoading: isLoading,
      };
    }

    // O response do endpoint grafico-dia traz um campo `data: "YYYY-MM-DD"` (string
    // com a data do dia consultado). O codigo antigo `data.data ?? data` pegava
    // essa string como "payload" e perdia o array `dados`. Fix: so usa `data.data`
    // como payload SE for objeto (caso de envelope nao desempacotado); senao usa
    // o proprio `data` (caso normal, ja desempacotado pelo interceptor do axios).
    const payload =
      typeof data?.data === 'object' && data.data !== null ? data.data : data;
    const dados: PontoDemanda[] = payload?.dados ?? [];
    const energiaPeriodo: number =
      payload?.energia_kwh ?? payload?.energia_total_kwh ?? 0;

    return {
      dados,
      energiaPeriodo,
      agregacao: payload?.agregacao ?? '',
      isLoading: isFetching,
      isInitialLoading: isLoading,
      fonteRangeInicio: payload?.inicio,
      fonteRangeFim: payload?.fim,
    };
  }, [data, isLoading, isFetching]);
}
