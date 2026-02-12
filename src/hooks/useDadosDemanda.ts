import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/config/api';
import type { ConfiguracaoDemanda, EquipamentoConfig } from '@/features/supervisorio/components/ConfiguracaoDemandaModal';

// Desabilitar logs de debug em produção
const noop = () => {};
if (import.meta.env.PROD) {
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}


interface DadosDemanda {
  timestamp: string;
  potencia: number; // kW
  tensao?: number;
  fatorPotencia?: number;
}

interface DadosEquipamento {
  id: string;
  timestamp: string;
  potencia: number;
  online: boolean;
}

interface ResultadoDemanda {
  dados: DadosDemanda[];
  fonte: 'A966' | 'AGRUPAMENTO' | 'SIMULADO';
  confiabilidade: number;
  energiaDia?: number; // kWh - Energia acumulada do dia
  detalhes?: {
    equipamentosUsados?: number;
    equipamentosOffline?: number;
    perdaAplicada?: number;
    formula?: string;
    energiaDetalhes?: string; // Detalhe do cálculo da energia
  };
}

// Remover dados simulados - usar apenas dados reais

export function useDadosDemanda(configuracao: ConfiguracaoDemanda, unidadeId?: string) {
  const [dadosDemanda, setDadosDemanda] = useState<ResultadoDemanda>({
    dados: [],
    fonte: 'AGRUPAMENTO',
    confiabilidade: 0,
    energiaDia: 0
  });
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Query para A966 (medidor principal)
  const { data: dadosA966, isLoading: loadingA966 } = useQuery({
    queryKey: ['demanda', 'A966', configuracao.intervaloAtualizacao, unidadeId],
    queryFn: async () => {
      if (!unidadeId) return null;

      try {
        // Buscar ID do A966 na unidade específica
        const equipamentos = await api.get(`/unidades/${unidadeId}/equipamentos`, {
          params: { tipo: 'A966', limit: 1 }
        });

        if (equipamentos.data.data?.length > 0) {
          const a966Id = equipamentos.data.data[0].id;

          // Buscar dados históricos
          const response = await api.get(`/equipamentos-dados/${a966Id}/grafico-dia`);

          if (response.data.dados) {
            return response.data.dados.map((item: any) => ({
              timestamp: item.timestamp,
              potencia: item.power?.active_total || 0,
              tensao: item.voltage?.line_average || 0,
              fatorPotencia: item.power_factor?.average || 0
            }));
          }
        }
        return null;
      } catch (error) {
        console.error('Erro ao buscar dados A966:', error);
        return null;
      }
    },
    refetchInterval: configuracao.intervaloAtualizacao * 1000,
    enabled: !!(unidadeId && (configuracao.fonte === 'A966' || configuracao.fonte === 'AUTO')),
    staleTime: 5000, // OTIMIZAÇÃO: Cache curto para evitar refetch imediato
    gcTime: 30000 // OTIMIZAÇÃO: Manter em cache por 30s
  });

  // Query para buscar últimos dados dos equipamentos (para energia do dia)
  const { data: dadosEnergia } = useQuery({
    queryKey: ['energia-dia', configuracao.equipamentos, unidadeId],
    queryFn: async () => {
      if (!unidadeId) return null;

      const equipamentosSelecionados = configuracao.equipamentos.filter(e => e.selecionado);
      if (equipamentosSelecionados.length === 0) return null;

      try {
        // Buscar último dado de cada equipamento
        const promises = equipamentosSelecionados.map(async (equip) => {
          try {
            const response = await api.get(`/equipamentos-dados/${equip.id}/latest`);
            return {
              id: equip.id,
              tipo: equip.tipo,
              fluxoEnergia: equip.fluxoEnergia,
              dados: response.data?.data || response.data
            };
          } catch (error) {
            console.error(`Erro ao buscar último dado do equipamento ${equip.nome}:`, error);
            return null;
          }
        });

        const resultados = await Promise.all(promises);
        return resultados.filter(r => r !== null);
      } catch (error) {
        console.error('Erro ao buscar dados de energia:', error);
        return null;
      }
    },
    refetchInterval: configuracao.intervaloAtualizacao * 1000,
    enabled: !!(unidadeId && configuracao.equipamentos.some(e => e.selecionado)),
    staleTime: 5000, // OTIMIZAÇÃO: Cache curto
    gcTime: 30000 // OTIMIZAÇÃO: Manter em cache por 30s
  });

  // Query para equipamentos do agrupamento
  const { data: dadosAgrupamento, isLoading: loadingAgrupamento } = useQuery({
    queryKey: ['demanda', 'agrupamento', configuracao.equipamentos, configuracao.intervaloAtualizacao, unidadeId],
    queryFn: async () => {
      if (!unidadeId) return null;

      const equipamentosSelecionados = configuracao.equipamentos.filter(e => e.selecionado);

      if (equipamentosSelecionados.length === 0) return null;

      try {
        const promises = equipamentosSelecionados.map(async (equip) => {
          try {
            const response = await api.get(`/equipamentos-dados/${equip.id}/grafico-dia`);

            // A resposta vem em response.data.data quando encapsulada
            const responseData = response.data?.data || response.data;

            // Aceitar dados mesmo que a potência seja zero (inversores à noite, etc.)
            if (responseData && responseData.dados && responseData.dados.length > 0) {
              return {
                id: equip.id,
                multiplicador: equip.multiplicador || 1,
                fluxoEnergia: equip.fluxoEnergia,
                dados: responseData.dados
              };
            }
            return null;
          } catch (error) {
            console.error(`Erro ao buscar dados do equipamento ${equip.nome}:`, error);
            return null;
          }
        });

        const resultados = await Promise.all(promises);
        const resultadosValidos = resultados.filter(r => r !== null);
        return resultadosValidos;
      } catch (error) {
        console.error('Erro ao buscar dados do agrupamento:', error);
        return null;
      }
    },
    refetchInterval: configuracao.intervaloAtualizacao * 1000,
    enabled: !!(unidadeId && (configuracao.fonte === 'AGRUPAMENTO' || (configuracao.fonte === 'AUTO' && !dadosA966))),
    staleTime: 5000, // OTIMIZAÇÃO: Cache curto
    gcTime: 30000 // OTIMIZAÇÃO: Manter em cache por 30s
  });

  // Calcular energia do dia a partir dos equipamentos
  const calcularEnergiaDia = useCallback((dadosEquipamentos: any[]) => {
    if (!dadosEquipamentos || dadosEquipamentos.length === 0) {
      return { energiaTotal: 0, detalhes: 'Nenhum dado disponível' };
    }

    let energiaTotal = 0;
    const detalhesEquipamentos: string[] = [];

    dadosEquipamentos.forEach((equipDados: any) => {
      if (!equipDados || !equipDados.dados) return;

      const dadosReais = equipDados.dados;
      let energiaEquipamento = 0;

      // Extrair energia baseado no tipo de equipamento
      // M160: campo Dados.phf (energia acumulada em kWh)
      if (dadosReais.Dados?.phf !== undefined) {
        energiaEquipamento = dadosReais.Dados.phf; // kWh
      }
      // Inversor: campo energia_dia_kwh
      else if (dadosReais.energia_dia_kwh !== undefined) {
        energiaEquipamento = dadosReais.energia_dia_kwh;
      }
      // Outros formatos possíveis
      else if (dadosReais.energy?.day_total !== undefined) {
        energiaEquipamento = dadosReais.energy.day_total;
      }

      // Aplicar sinal baseado no fluxo de energia
      if (equipDados.fluxoEnergia === 'GERACAO') {
        energiaTotal += energiaEquipamento; // Soma (positivo)
      } else if (equipDados.fluxoEnergia === 'CONSUMO') {
        energiaTotal -= energiaEquipamento; // Subtrai (negativo)
      } else if (equipDados.fluxoEnergia === 'BIDIRECIONAL') {
        energiaTotal += energiaEquipamento; // Bidirecional mantém sinal do equipamento
      }

      if (energiaEquipamento !== 0) {
        detalhesEquipamentos.push(`${equipDados.tipo}: ${energiaEquipamento.toFixed(2)} kWh`);
      }
    });

    return {
      energiaTotal,
      detalhes: detalhesEquipamentos.length > 0
        ? detalhesEquipamentos.join(' | ')
        : 'Nenhum dado de energia disponível'
    };
  }, []);

  // Processar dados do agrupamento
  const processarAgrupamento = useCallback((dadosEquipamentos: any[]) => {
    if (!dadosEquipamentos || dadosEquipamentos.length === 0) {
      return [];
    }

    const mapaTimestamps = new Map<string, DadosDemanda>();

    dadosEquipamentos.forEach((equip) => {
      if (!equip || !equip.dados) return;

      equip.dados.forEach((leitura: any) => {
        const timestamp = leitura.timestamp || leitura.hora;

        if (!mapaTimestamps.has(timestamp)) {
          mapaTimestamps.set(timestamp, {
            timestamp,
            potencia: 0,
            tensao: leitura.voltage?.line_average || 0,
            fatorPotencia: leitura.power_factor?.average || 0
          });
        }

        const dadoAtual = mapaTimestamps.get(timestamp)!;
        let potenciaEquipamento = 0;

        // Extrair potência baseado na estrutura dos dados
        // 0. ✅ NOVO: Formato M160 Resumo e INVERSOR (potencia_kw direto no root)
        if (leitura.potencia_kw !== undefined) {
          potenciaEquipamento = leitura.potencia_kw * 1000; // Converter kW para W
        }
        // 1. Estrutura M-160 legado (multimedidor com campo Dados)
        else if (leitura.Dados) {
          // ✅ ATUALIZADO: Priorizar potencia_kw se disponível no Dados
          if (leitura.Dados.potencia_kw !== undefined) {
            potenciaEquipamento = leitura.Dados.potencia_kw * 1000; // Converter kW para W
          } else {
            // M-160 legado: soma das potências das 3 fases (Pa + Pb + Pc)
            const potenciaFases = (leitura.Dados.Pa || 0) + (leitura.Dados.Pb || 0) + (leitura.Dados.Pc || 0);
            potenciaEquipamento = potenciaFases; // Já vem em Watts
          }
        }
        // 2. Estrutura Inversor (nested power object)
        else if (leitura.power?.active_total !== undefined) {
          potenciaEquipamento = leitura.power.active_total; // Watts
        }
        // 3. Estrutura agregada legada
        else if (leitura.power_avg !== undefined) {
          potenciaEquipamento = leitura.power_avg * 1000; // Converter kW para W
        }
        // 4. Estrutura A966/Landis
        else if (leitura.active_power_total !== undefined) {
          potenciaEquipamento = leitura.active_power_total; // Watts
        }
        // 5. Estrutura simples (power direto)
        else if (leitura.power !== undefined && typeof leitura.power === 'number') {
          potenciaEquipamento = leitura.power; // Watts
        }
        // 6. Estrutura com potencia_ativa_kw (campo do banco)
        else if (leitura.potencia_ativa_kw !== undefined) {
          potenciaEquipamento = leitura.potencia_ativa_kw * 1000; // Converter kW para W
        }

        // Aplicar multiplicador
        potenciaEquipamento *= equip.multiplicador || 1;

        // Aplicar sinal baseado no fluxo de energia
        if (equip.fluxoEnergia === 'GERACAO') {
          dadoAtual.potencia += potenciaEquipamento; // Soma (positivo)
        } else if (equip.fluxoEnergia === 'CONSUMO') {
          dadoAtual.potencia -= potenciaEquipamento; // Subtrai (negativo)
        } else if (equip.fluxoEnergia === 'BIDIRECIONAL') {
          // Para bidirecional, o sinal já vem correto do equipamento
          dadoAtual.potencia += potenciaEquipamento;
        }
      });
    });

    // Converter mapa para array e ordenar por timestamp
    const dadosProcessados = Array.from(mapaTimestamps.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(d => ({
        ...d,
        potencia: d.potencia / 1000 // Converter de W para kW para o gráfico
      }));

    // Log removido

    // Aplicar fator de perdas se configurado
    if (configuracao.aplicarPerdas && configuracao.fatorPerdas > 0) {
      dadosProcessados.forEach(dado => {
        // Aplicar perdas apenas na geração (reduz a potência positiva)
        if (dado.potencia > 0) {
          dado.potencia *= (1 - configuracao.fatorPerdas / 100);
        }
      });
    }

    return dadosProcessados;
  }, [configuracao.aplicarPerdas, configuracao.fatorPerdas]);

  // Determinar qual fonte usar e processar os dados
  useEffect(() => {
    let resultado: ResultadoDemanda;

    // Lógica de seleção baseada na configuração
    if (configuracao.fonte === 'A966') {
      if (dadosA966 && dadosA966.length > 0) {
        resultado = {
          dados: dadosA966,
          fonte: 'A966',
          confiabilidade: 100,
          detalhes: {
            formula: 'Medição direta do A966'
          }
        };
      } else {
        // Se A966 não disponível, tentar agrupamento
        const dadosProcessados = processarAgrupamento(dadosAgrupamento || []);

        if (dadosProcessados && dadosProcessados.length > 0) {
          // Calcular energia do dia
          const { energiaTotal, detalhes: energiaDetalhes } = calcularEnergiaDia(dadosEnergia || []);

          resultado = {
            dados: dadosProcessados,
            fonte: 'AGRUPAMENTO',
            confiabilidade: 80,
            energiaDia: energiaTotal,
            detalhes: {
              equipamentosUsados: dadosAgrupamento?.length || 0,
              formula: 'A966 não disponível, usando agrupamento',
              energiaDetalhes
            }
          };
        } else {
          // Sem dados disponíveis
          const equipamentosSelecionados = configuracao.equipamentos.filter(e => e.selecionado);

          resultado = {
            dados: [],
            fonte: 'AGRUPAMENTO',
            confiabilidade: 0,
            detalhes: {
              formula: equipamentosSelecionados.length === 0
                ? 'A966 não disponível. Configure equipamentos para agrupamento.'
                : 'A966 não disponível. Aguardando dados do agrupamento.',
              equipamentosUsados: 0
            }
          };
        }
      }
    } else if (configuracao.fonte === 'AGRUPAMENTO') {
      const dadosProcessados = processarAgrupamento(dadosAgrupamento || []);

      if (dadosProcessados && dadosProcessados.length > 0) {
        const equipamentosUsados = dadosAgrupamento?.length || 0;
        const equipamentosOffline = configuracao.equipamentos
          .filter(e => e.selecionado && !e.online).length;

        // Calcular energia do dia
        const { energiaTotal, detalhes: energiaDetalhes } = calcularEnergiaDia(dadosEnergia || []);

        resultado = {
          dados: dadosProcessados,
          fonte: 'AGRUPAMENTO',
          confiabilidade: equipamentosOffline > 0 ? 70 : 85,
          energiaDia: energiaTotal,
          detalhes: {
            equipamentosUsados,
            equipamentosOffline,
            perdaAplicada: configuracao.aplicarPerdas ? configuracao.fatorPerdas : 0,
            formula: `Σ(Geração × ${configuracao.aplicarPerdas ? (1 - configuracao.fatorPerdas/100).toFixed(2) : '1'}) - Σ(Consumo)`,
            energiaDetalhes
          }
        };
      } else {
        // Sem dados do agrupamento
        const equipamentosSelecionados = configuracao.equipamentos.filter(e => e.selecionado);

        let mensagemFormula = '';
        if (equipamentosSelecionados.length === 0) {
          mensagemFormula = 'Nenhum equipamento selecionado. Configure os equipamentos no botão de configuração.';
        } else {
          mensagemFormula = `Aguardando dados de ${equipamentosSelecionados.length} equipamento(s) selecionado(s)`;
        }

        resultado = {
          dados: [],
          fonte: 'AGRUPAMENTO',
          confiabilidade: 0,
          detalhes: {
            formula: mensagemFormula,
            equipamentosUsados: 0,
            equipamentosOffline: equipamentosSelecionados.filter(e => !e.online).length
          }
        };
      }
    } else { // AUTO
      // Prioridade: A966 > Agrupamento > Simulado
      if (dadosA966 && dadosA966.length > 0) {
        resultado = {
          dados: dadosA966,
          fonte: 'A966',
          confiabilidade: 100,
          detalhes: {
            formula: 'Auto: usando A966 (melhor disponível)'
          }
        };
      } else {
        const dadosProcessados = processarAgrupamento(dadosAgrupamento || []);

        if (dadosProcessados && dadosProcessados.length > 0) {
          // Calcular energia do dia
          const { energiaTotal, detalhes: energiaDetalhes } = calcularEnergiaDia(dadosEnergia || []);

          resultado = {
            dados: dadosProcessados,
            fonte: 'AGRUPAMENTO',
            confiabilidade: 80,
            energiaDia: energiaTotal,
            detalhes: {
              equipamentosUsados: dadosAgrupamento?.length || 0,
              formula: 'Auto: A966 indisponível, usando agrupamento',
              energiaDetalhes
            }
          };
        } else {
          const equipamentosSelecionados = configuracao.equipamentos.filter(e => e.selecionado);

          resultado = {
            dados: [],
            fonte: 'AGRUPAMENTO',
            confiabilidade: 0,
            detalhes: {
              formula: equipamentosSelecionados.length === 0
                ? 'Configure os equipamentos no botão de configuração ⚙️'
                : `Aguardando dados de ${equipamentosSelecionados.length} equipamento(s)`,
              equipamentosUsados: 0
            }
          };
        }
      }
    }

    setDadosDemanda(resultado);

    // ✅ Marcar que já carregou pelo menos uma vez
    if (!hasInitialLoad && (resultado.dados.length > 0 || (!loadingA966 && !loadingAgrupamento))) {
      setHasInitialLoad(true);
    }
  }, [configuracao, dadosA966, dadosAgrupamento, dadosEnergia, processarAgrupamento, calcularEnergiaDia, hasInitialLoad, loadingA966, loadingAgrupamento]);

  return {
    ...dadosDemanda,
    isLoading: loadingA966 || loadingAgrupamento,
    isInitialLoading: !hasInitialLoad && (loadingA966 || loadingAgrupamento), // ✅ NOVO: só true no PRIMEIRO load
    refetch: () => {
      // Força atualização dos dados
      setDadosDemanda(prev => ({ ...prev }));
    }
  };
}
