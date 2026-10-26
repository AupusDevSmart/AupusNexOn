import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";
import type { ConfiguracaoDemanda, EquipamentoConfig } from "../ConfiguracaoDemandaModal";
import { CATEGORIA_FLUXO, resolverFluxoEquipamento } from "../../utils/categoria-fluxo";
import { corpoConfiguracaoDemanda, estaNoDiagrama, useDemandasUnidade } from "../../sinoptico/hooks/useConfiguracaoDemanda";

/**
 * Configuração de demanda da unidade (GET/PUT /configuracao-demanda/unidade/:id) e os
 * equipamentos que entram na conta, já separados em geração e consumo. Extraído do
 * SinopticoGraficosV2 (NEXON-37) para o cartão "Energia" da Visão Geral usar a mesma
 * regra (quem é carga, quem é geração) e o mesmo modal de configuração.
 */

/** Configuração salva na API, já convertida para o formato do front. */
interface ConfiguracaoApi {
  fonte: string;
  mostrarDetalhes: boolean;
  intervaloAtualizacao: number;
  aplicarPerdas: boolean;
  fatorPerdas: number;
  valorContratado: number;
  percentualAdicional: number;
  /** IDs selecionados, processados depois que os equipamentos chegam. */
  equipamentosIds: string[];
  fluxoManual: NonNullable<ConfiguracaoDemanda['fluxoManual']>;
}

/** Equipamento como vem de GET /unidades/:id/equipamentos. */
interface EquipamentoApi {
  id: string;
  nome: string;
  status?: string;
  tipo_equipamento?: string;
  tipo_equipamento_rel?: { codigo?: string; categoria?: { nome?: string } };
  noDiagrama?: boolean;
  diagrama_id?: string | null;
}

interface Args {
  unidadeId?: string;
  /** Fallback do contratado quando a config salva não tem valor. */
  valorContratado: number;
  /** Tolerância de quem chama (geração 1%, carga 5% — NEXON-14). */
  percentualAdicional: number;
  onConfigSaved?: () => void;
}

export function useEquipamentosDemanda({ unidadeId, valorContratado, percentualAdicional, onConfigSaved }: Args) {
  const [modalOpen, setModalOpen] = useState(false);

  // OTIMIZAÇÃO: Buscar configuração da API com prioridade alta
  const { data: configData, refetch: refetchConfig } = useQuery({
    queryKey: ['configuracao-demanda', unidadeId],
    queryFn: async (): Promise<ConfiguracaoApi | null> => {
      if (!unidadeId) return null;

      try {
        const response = await api.get(`/configuracao-demanda/unidade/${unidadeId}`);

        // Converter formato do banco para formato do frontend
        if (response.data) {
          // A API retorna dentro de response.data.data
          const apiData = response.data.data || response.data;

          return {
            fonte: apiData.fonte || 'AGRUPAMENTO',
            mostrarDetalhes: apiData.mostrar_detalhes !== false,
            intervaloAtualizacao: apiData.intervalo_atualizacao || 30,
            aplicarPerdas: apiData.aplicar_perdas !== false,
            fatorPerdas: Number(apiData.fator_perdas) || 3,
            valorContratado: Number(apiData.valor_contratado) || valorContratado,
            // Regra (NEXON-14): o limite vem de quem chama (geração 1%, carga 5%), não do valor antigo salvo.
            percentualAdicional,
            // Guardar os IDs selecionados para processar depois
            equipamentosIds: Array.isArray(apiData.equipamentos_ids) ? apiData.equipamentos_ids : [],
            fluxoManual: apiData.fluxo_manual ?? apiData.fluxoManual ?? {},
          };
        }
      } catch {
        // Erro silencioso - não há config salva ainda
      }
      return null;
    },
    enabled: !!unidadeId,
    refetchOnMount: true,
    staleTime: 10000, // OTIMIZAÇÃO: Reduzido para 10s
    networkMode: 'online' // OTIMIZAÇÃO: Forçar carregamento imediato
  });

  // Estado local da configuração (inicializa com valores padrão ou da API)
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDemanda>(() => ({
    equipamentos: [],
    fluxoManual: {},
    mostrarDetalhes: true,
    intervaloAtualizacao: 30,
    aplicarPerdas: true,
    fatorPerdas: 3,
  }));
  const { demandaGeracao, demandaCarga } = useDemandasUnidade(unidadeId);
  const queryClient = useQueryClient();
  // Modal recebe as demandas da unidade (geração e carga) junto da config.
  const configuracaoModal = useMemo<ConfiguracaoDemanda>(
    () => ({ ...configuracao, demandaGeracao, demandaCarga }),
    [configuracao, demandaGeracao, demandaCarga],
  );

  // Buscar equipamentos disponíveis
  const {
    data: equipamentosData,
    refetch: refetchEquipamentos
  } = useQuery({
    queryKey: ['equipamentos-agrupamento', unidadeId],
    queryFn: async (): Promise<EquipamentoConfig[]> => {
      if (!unidadeId) return [];

      try {
        const response = await api.get(`/unidades/${unidadeId}/equipamentos`, {
          params: {
            mqtt_habilitado: true,
            limit: 100
          }
        });

        const equipamentosArray: EquipamentoApi[] = response.data?.data || [];

        if (equipamentosArray && equipamentosArray.length > 0) {
          // Mapear para formato do modal. Fluxo padrao vem da categoria —
          // ver utils/categoria-fluxo.ts pra tabela completa. AMBIGUO fica
          // como literal aqui; resolveFluxoManual() embaixo substitui pela
          // escolha do admin quando aplicavel.
          return equipamentosArray.map((equip): EquipamentoConfig => {
            const tipo = equip.tipo_equipamento_rel?.codigo || equip.tipo_equipamento || '';
            const categoria = equip.tipo_equipamento_rel?.categoria?.nome || '';
            const fluxoPadrao = CATEGORIA_FLUXO[categoria] ?? 'NEUTRO';
            return {
              id: equip.id.trim(),
              nome: equip.nome,
              tipo,
              categoria,
              fluxoEnergia: fluxoPadrao,
              selecionado: false,
              multiplicador: 1,
              online: equip.status === 'ONLINE' || equip.status === 'online' || true,
              noDiagrama: estaNoDiagrama(equip),
            };
          });
        }
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!unidadeId,
    staleTime: 10000, // OTIMIZAÇÃO: Reduzido para 10s
    gcTime: 60000, // OTIMIZAÇÃO: Reduzido para 1 minuto
    refetchOnWindowFocus: false,
    refetchOnMount: 'always' // OTIMIZAÇÃO: Sempre refaz ao montar
  });

  // Forçar refetch quando modal abrir
  useEffect(() => {
    if (modalOpen && unidadeId) {
      refetchEquipamentos();
    }
  }, [modalOpen, unidadeId, refetchEquipamentos]);

  // Atualizar configuração quando dados da API chegarem
  useEffect(() => {
    if (configData && equipamentosData && equipamentosData.length > 0) {
      // Limpar espaços dos IDs para comparação
      const equipamentosIdsTrimmed = configData.equipamentosIds.map((id) => id.trim());

      // Mesclar equipamentos disponíveis com os IDs selecionados da configuração
      const equipamentosComSelecao = equipamentosData.map(equip => ({
        ...equip,
        selecionado: equipamentosIdsTrimmed.includes(equip.id.trim()),
      }));

      setConfiguracao({
        equipamentos: equipamentosComSelecao,
        fluxoManual: configData.fluxoManual,
        mostrarDetalhes: configData.mostrarDetalhes,
        intervaloAtualizacao: configData.intervaloAtualizacao,
        aplicarPerdas: configData.aplicarPerdas,
        fatorPerdas: configData.fatorPerdas,
      });
    } else if (equipamentosData && equipamentosData.length > 0 && !configData) {
      // Se não tem config na API, usar equipamentos disponíveis
      setConfiguracao(prev => ({
        ...prev,
        equipamentos: equipamentosData,
      }));
    }
  }, [configData, equipamentosData]);

  // Resolve fluxo final por equipamento: substitui AMBIGUO pela escolha manual
  // do admin (configuracao.fluxoManual). NEUTRO continua NEUTRO e eh filtrado
  // dentro do hook (nao entra no request).
  const equipamentosResolvidos = useMemo<EquipamentoConfig[]>(() => {
    const fluxoManual = configuracao.fluxoManual ?? {};
    return configuracao.equipamentos.map((e) => ({
      ...e,
      fluxoEnergia: resolverFluxoEquipamento(e.categoria, e.id, fluxoManual),
    }));
  }, [configuracao.equipamentos, configuracao.fluxoManual]);

  // Dados de demanda — período selecionável (dia/mes/ano/custom), agregados no backend.
  // Geração e consumo em consultas separadas: o gráfico mostra geração para cima e
  // consumo para baixo (antes era um traço só = geração − consumo, que virava saldo
  // negativo assim que um medidor de carga entrava na conta).
  // Três grupos independentes, cada um com a sua curva: geração (inversores), consumo
  // (medidores de carga) e rede (medidor bidirecional do ramal de entrada: A966 / SSU da
  // TON V2). A rede NUNCA soma na geração nem no consumo — é outra grandeza (o líquido no
  // ponto de entrega) e somar contaria a usina em dobro.
  const equipamentosGeracao = useMemo(
    () => equipamentosResolvidos.filter((e) => e.fluxoEnergia !== 'CONSUMO' && e.fluxoEnergia !== 'BIDIRECIONAL'),
    [equipamentosResolvidos],
  );
  const equipamentosRede = useMemo(
    () => equipamentosResolvidos.filter((e) => e.fluxoEnergia === 'BIDIRECIONAL'),
    [equipamentosResolvidos],
  );
  const equipamentosConsumo = useMemo(
    () => equipamentosResolvidos.filter((e) => e.fluxoEnergia === 'CONSUMO'),
    [equipamentosResolvidos],
  );
  const temConsumo = equipamentosConsumo.some((e) => e.selecionado);
  const temGeracao = equipamentosGeracao.some((e) => e.selecionado && e.fluxoEnergia !== 'NEUTRO');
  const temRede = equipamentosRede.some((e) => e.selecionado);

  // Salvar configuração na API
  const handleSalvarConfiguracao = async (novaConfig: ConfiguracaoDemanda) => {
    if (!unidadeId) return;

    // Persistência. NÃO engolir erro aqui: se o PUT falhar (ex: 400), propaga
    // pro modal exibir o erro real (toast.error) e manter-se aberto. A API grava
    // as demandas de geração/carga na unidade e registra na trilha (NEXON-19).
    await api.put(`/configuracao-demanda/unidade/${unidadeId}`, corpoConfiguracaoDemanda(novaConfig, percentualAdicional));
    queryClient.invalidateQueries({ queryKey: ['unidade-demanda', unidadeId.trim()] });
    queryClient.invalidateQueries({ queryKey: ['sinoptico-cfgd-config', unidadeId.trim()] });

    // Sucesso: atualizar estado local e fechar.
    setConfiguracao(novaConfig);
    setModalOpen(false);

    // Revalidação é secundária — uma falha de refetch não invalida o save.
    try {
      await refetchConfig();
      await refetchEquipamentos();
      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (error) {
      console.error('Erro ao revalidar dados após salvar:', error);
    }
  };

  return {
    modalOpen,
    setModalOpen,
    configuracao,
    configuracaoModal,
    equipamentosData,
    equipamentosGeracao,
    equipamentosConsumo,
    equipamentosRede,
    temConsumo,
    temGeracao,
    temRede,
    handleSalvarConfiguracao,
  };
}
