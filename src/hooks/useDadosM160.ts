import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/config/api';

// Desabilitar logs de debug em produção
const noop = () => {};
if (import.meta.env.PROD) {
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}


interface DadosM160 {
  timestamp: string;
  tensaoA: number;
  tensaoB: number;
  tensaoC: number;
  fatorPotenciaA: number;
  fatorPotenciaB: number;
  fatorPotenciaC: number;
}

interface EquipamentoM160 {
  id: string;
  nome: string;
  tag?: string;
  tipo: string;
}

export function useDadosM160(unidadeId?: string, equipamentoId?: string) {
  const [dados, setDados] = useState<DadosM160[]>([]);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Buscar lista de M160 da unidade
  const { data: equipamentosM160 } = useQuery({
    queryKey: ['m160-lista', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];

      try {
        // Buscar todos os equipamentos da unidade com MQTT habilitado
        const response = await api.get(`/unidades/${unidadeId}/equipamentos`, {
          params: {
            mqtt_habilitado: true  // ✅ Filtrar apenas equipamentos com MQTT habilitado
          }
        });

        // console.log('📊 [useDadosM160] Resposta completa da API:', response);
        // console.log('📊 [useDadosM160] response.data:', response.data);
        // console.log('📊 [useDadosM160] response.data.data:', response.data?.data);
        // console.log('📊 [useDadosM160] response.data.data.data:', response.data?.data?.data);

        const equipamentos = response.data?.data || [];
        // console.log('📊 [useDadosM160] Equipamentos extraídos:', equipamentos);
        // console.log('📊 [useDadosM160] É array?', Array.isArray(equipamentos));

        if (!Array.isArray(equipamentos)) {
          console.error('❌ [useDadosM160] equipamentos não é um array:', equipamentos);
          return [];
        }

        // Filtrar apenas M160 pelo código do tipo de equipamento
        // ✅ CORRIGIDO: Ordem de fallback correta (tipo_equipamento_rel é a fonte autoritativa)
        const equipamentosM160 = equipamentos.filter((eq: any) => {
          const codigo = eq.tipo_equipamento_rel?.codigo || eq.tipoEquipamento?.codigo || '';
          // console.log(`📊 [useDadosM160] Equipamento ${eq.nome}: código=${codigo}`);
          return codigo === 'M160' || codigo === 'M-160' || codigo === 'METER_M160' || codigo === 'MEDIDOR';
        });

        // console.log('📊 [useDadosM160] Equipamentos M-160 filtrados:', equipamentosM160);

        // ✅ CORRIGIDO: Ordem de fallback correta em todos os campos
        return equipamentosM160.map((eq: any) => ({
          id: eq.id?.trim(),
          nome: eq.nome || 'M-160',
          tag: eq.tag,
          tipo: eq.tipo_equipamento_rel?.codigo || eq.tipoEquipamento?.codigo || 'M-160'
        }));
      } catch (error) {
        console.error('❌ Erro ao buscar M160:', error);
        return [];
      }
    },
    enabled: !!unidadeId,
    refetchInterval: false
  });

  // Buscar dados do M160 selecionado
  const { data: dadosM160, isLoading } = useQuery({
    queryKey: ['m160-dados', equipamentoId],
    queryFn: async () => {
      if (!equipamentoId) return null;

      try {
        const response = await api.get(`/equipamentos-dados/${equipamentoId}/grafico-dia`);
        const responseData = response.data;

        if (!responseData?.dados || responseData.dados.length === 0) {
          return null;
        }

        return responseData.dados;
      } catch (error) {
        console.error('Erro ao buscar dados M160:', error);
        return null;
      }
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
    enabled: !!equipamentoId
  });

  // Processar dados quando chegam
  useEffect(() => {
    if (!dadosM160 || dadosM160.length === 0) {
      setDados([]);
      return;
    }

    // 🔍 DEBUG: Log para ver estrutura dos dados
    console.log('🔍 [useDadosM160] Dados recebidos:', dadosM160.length, 'pontos');
    if (dadosM160.length > 0) {
      console.log('🔍 [useDadosM160] Primeiro item:', JSON.stringify(dadosM160[0], null, 2));
      console.log('🔍 [useDadosM160] Chaves do primeiro item:', Object.keys(dadosM160[0]));
    }

    const dadosProcessados: DadosM160[] = dadosM160.map((item: any) => {
      // ✅ CORRIGIDO: O campo é 'dados' (minúsculo), não 'Dados'
      const dados = item.dados || item.Dados || {};

      // 🔍 DEBUG: Log para ver estrutura dos dados
      if (!item.dados && !item.Dados) {
        console.warn('⚠️ [useDadosM160] Item sem campo dados/Dados:', item);
      } else {
        // Log dos campos disponíveis no primeiro item
        if (dadosM160.indexOf(item) === 0) {
          console.log('🔍 [useDadosM160] Campos disponíveis em dados:', Object.keys(dados));
        }
      }

      return {
        timestamp: item.timestamp || item.hora || item.timestamp_dados,
        // ✅ CORRIGIDO: Tentar múltiplas variações de nomes de campo
        tensaoA: dados.Va || dados.va || dados.VoltageA || dados.voltageA || 0,
        tensaoB: dados.Vb || dados.vb || dados.VoltageB || dados.voltageB || 0,
        tensaoC: dados.Vc || dados.vc || dados.VoltageC || dados.voltageC || 0,
        // ✅ Suportar múltiplas variações para fator de potência
        fatorPotenciaA: dados.FPa || dados.FPA || dados.fpa || dados.PowerFactorA || dados.powerFactorA || 0,
        fatorPotenciaB: dados.FPb || dados.FPB || dados.fpb || dados.PowerFactorB || dados.powerFactorB || 0,
        fatorPotenciaC: dados.FPc || dados.FPC || dados.fpc || dados.PowerFactorC || dados.powerFactorC || 0,
      };
    });

    console.log('🔍 [useDadosM160] Dados processados:', dadosProcessados.length, 'pontos');
    if (dadosProcessados.length > 0) {
      console.log('🔍 [useDadosM160] Primeiro ponto processado:', dadosProcessados[0]);
    }

    setDados(dadosProcessados);

    // ✅ Marcar que já carregou pelo menos uma vez
    if (!hasInitialLoad) {
      setHasInitialLoad(true);
    }
  }, [dadosM160, hasInitialLoad]);

  return {
    dados,
    equipamentosM160: equipamentosM160 || [],
    isLoading,
    isInitialLoading: !hasInitialLoad && isLoading // ✅ NOVO: só true no PRIMEIRO load
  };
}
