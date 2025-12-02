import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/config/api';
import type { ConfiguracaoDemanda, EquipamentoConfig } from '@/features/supervisorio/components/ConfiguracaoDemandaModal';

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
  detalhes?: {
    equipamentosUsados?: number;
    equipamentosOffline?: number;
    perdaAplicada?: number;
    formula?: string;
  };
}

// Remover dados simulados - usar apenas dados reais

export function useDadosDemanda(configuracao: ConfiguracaoDemanda, unidadeId?: string) {
  const [dadosDemanda, setDadosDemanda] = useState<ResultadoDemanda>({
    dados: [],
    fonte: 'AGRUPAMENTO',
    confiabilidade: 0
  });

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
    enabled: !!(unidadeId && (configuracao.fonte === 'A966' || configuracao.fonte === 'AUTO'))
  });

  // Query para equipamentos do agrupamento
  const { data: dadosAgrupamento, isLoading: loadingAgrupamento } = useQuery({
    queryKey: ['demanda', 'agrupamento', configuracao.equipamentos, configuracao.intervaloAtualizacao, unidadeId],
    queryFn: async () => {
      if (!unidadeId) return null;

      const equipamentosSelecionados = configuracao.equipamentos.filter(e => e.selecionado);

      if (equipamentosSelecionados.length === 0) {
        return null;
      }

      try {
        // Buscar dados de cada equipamento selecionado
        const promises = equipamentosSelecionados.map(async (equip) => {
          try {
            const response = await api.get(`/equipamentos-dados/${equip.id}/grafico-dia`);

            // A resposta vem em response.data.data quando encapsulada
            const responseData = response.data?.data || response.data;

            // Aceitar dados mesmo que a potência seja zero (inversores à noite, etc.)
            if (responseData && responseData.dados && responseData.dados.length > 0) {
              return {
                id: equip.id,
                tipo: equip.tipo,
                fluxoEnergia: equip.fluxoEnergia,
                multiplicador: equip.multiplicador,
                dados: responseData.dados
              };
            }
            return null;
          } catch (error) {
            // Erro silencioso - equipamento sem dados
            return null;
          }
        });

        const resultados = await Promise.all(promises);
        return resultados.filter(r => r !== null);
      } catch (error) {
        console.error('Erro ao buscar dados do agrupamento:', error);
        return null;
      }
    },
    refetchInterval: configuracao.intervaloAtualizacao * 1000,
    enabled: !!(unidadeId && (configuracao.fonte === 'AGRUPAMENTO' || (configuracao.fonte === 'AUTO' && !dadosA966)))
  });

  // Processar dados do agrupamento
  const processarAgrupamento = useCallback((dadosEquipamentos: any[]) => {
    if (!dadosEquipamentos || dadosEquipamentos.length === 0) {
      return null;
    }

    // Criar mapa de timestamps únicos
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
        // 0. Estrutura de INVERSOR do endpoint /grafico-dia (potencia_kw direto)
        if (leitura.potencia_kw !== undefined) {
          potenciaEquipamento = leitura.potencia_kw * 1000; // Converter kW para W
        }
        // 1. Estrutura M-160 (multimedidor)
        else
        if (leitura.Dados) {
          // M-160: soma das potências das 3 fases (Pa + Pb + Pc)
          const potenciaFases = (leitura.Dados.Pa || 0) + (leitura.Dados.Pb || 0) + (leitura.Dados.Pc || 0);
          potenciaEquipamento = potenciaFases; // Já vem em Watts
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
          resultado = {
            dados: dadosProcessados,
            fonte: 'AGRUPAMENTO',
            confiabilidade: 80,
            detalhes: {
              equipamentosUsados: dadosAgrupamento?.length || 0,
              formula: 'A966 não disponível, usando agrupamento'
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

        resultado = {
          dados: dadosProcessados,
          fonte: 'AGRUPAMENTO',
          confiabilidade: equipamentosOffline > 0 ? 70 : 85,
          detalhes: {
            equipamentosUsados,
            equipamentosOffline,
            perdaAplicada: configuracao.aplicarPerdas ? configuracao.fatorPerdas : 0,
            formula: `Σ(Geração × ${configuracao.aplicarPerdas ? (1 - configuracao.fatorPerdas/100).toFixed(2) : '1'}) - Σ(Consumo)`
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
          resultado = {
            dados: dadosProcessados,
            fonte: 'AGRUPAMENTO',
            confiabilidade: 80,
            detalhes: {
              equipamentosUsados: dadosAgrupamento?.length || 0,
              formula: 'Auto: A966 indisponível, usando agrupamento'
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
  }, [configuracao, dadosA966, dadosAgrupamento, processarAgrupamento]);

  return {
    ...dadosDemanda,
    isLoading: loadingA966 || loadingAgrupamento,
    refetch: () => {
      // Força atualização dos dados
      setDadosDemanda(prev => ({ ...prev }));
    }
  };
}