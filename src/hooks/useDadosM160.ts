import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/config/api';
import { isPowerMeter } from '@/features/supervisorio/components/power-meter/helpers';


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

/**
 * Lista de Power Meters da unidade e a curva do dia do selecionado (tensão e FP).
 * `ativo=false` mantém só a lista (barata, sem polling): a curva de 30 em 30 s
 * só roda quando o gráfico de Tensão ou FP está na tela.
 */
export function useDadosM160(unidadeId?: string, equipamentoId?: string, ativo = true) {
  // Buscar lista de M160 da unidade
  const { data: equipamentosM160, isLoading: carregandoLista } = useQuery({
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

        // Filtrar QUALQUER Power Meter — decisao por CATEGORIA, nao pelo codigo do
        // tipo. Hoje toda a categoria "Power Meter (PM)" compartilha o mesmo payload
        // (Va/Vb/Vc, FPa/FPb/FPc), nao so o M160. isPowerMeter cai pra codigo/tag/nome
        // caso a categoria nao venha. tipo_equipamento_rel e a fonte autoritativa.
        const powerMeters = equipamentos.filter((eq: any) => {
          const categoria =
            eq.tipo_equipamento_rel?.categoria?.nome || eq.tipoEquipamento?.categoria?.nome || '';
          const codigo = eq.tipo_equipamento_rel?.codigo || eq.tipoEquipamento?.codigo || '';
          return isPowerMeter({ categoria, tipo: codigo, tag: eq.tag, nome: eq.nome });
        });

        return powerMeters.map((eq: any) => ({
          id: eq.id?.trim(),
          nome: eq.nome || eq.tag || 'Medidor',
          tag: eq.tag,
          tipo: eq.tipo_equipamento_rel?.codigo || eq.tipoEquipamento?.codigo || ''
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
    enabled: !!equipamentoId && ativo
  });

  // Processa na renderização (memo): antes era useEffect + setState, um render
  // a mais a cada poll e um JSON.stringify do primeiro ponto no console.
  const dados = useMemo<DadosM160[]>(() => {
    if (!dadosM160 || dadosM160.length === 0) return [];
    return dadosM160.map((item: any) => {
      // O campo é 'dados' (minúsculo); 'Dados' fica de fallback.
      const d = item.dados || item.Dados || {};
      return {
        timestamp: item.timestamp || item.hora || item.timestamp_dados,
        tensaoA: d.Va || d.va || d.VoltageA || d.voltageA || 0,
        tensaoB: d.Vb || d.vb || d.VoltageB || d.voltageB || 0,
        tensaoC: d.Vc || d.vc || d.VoltageC || d.voltageC || 0,
        fatorPotenciaA: d.FPa || d.FPA || d.fpa || d.PowerFactorA || d.powerFactorA || 0,
        fatorPotenciaB: d.FPb || d.FPB || d.fpb || d.PowerFactorB || d.powerFactorB || 0,
        fatorPotenciaC: d.FPc || d.FPC || d.fpc || d.PowerFactorC || d.powerFactorC || 0,
      };
    });
  }, [dadosM160]);

  return {
    dados,
    equipamentosM160: equipamentosM160 || [],
    carregandoLista,
    isLoading,
    // isLoading do react-query já é só o primeiro carregamento (sem dado em cache).
    isInitialLoading: isLoading && !!equipamentoId && ativo,
  };
}
