import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/config/api';

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
  tipo: string;
}

export function useDadosM160(unidadeId?: string, equipamentoId?: string) {
  const [dados, setDados] = useState<DadosM160[]>([]);

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

        console.log('📊 [useDadosM160] Resposta completa da API:', response);
        console.log('📊 [useDadosM160] response.data:', response.data);
        console.log('📊 [useDadosM160] response.data.data:', response.data?.data);
        console.log('📊 [useDadosM160] response.data.data.data:', response.data?.data?.data);

        // A API de equipamentos retorna: { success: true, data: { data: [...], pagination: {...} } }
        const equipamentos = response.data?.data?.data || [];
        console.log('📊 [useDadosM160] Equipamentos extraídos:', equipamentos);
        console.log('📊 [useDadosM160] É array?', Array.isArray(equipamentos));

        if (!Array.isArray(equipamentos)) {
          console.error('❌ [useDadosM160] equipamentos não é um array:', equipamentos);
          return [];
        }

        // Filtrar apenas M160 pelo código do tipo de equipamento
        const equipamentosM160 = equipamentos.filter((eq: any) => {
          const codigo = eq.tipoEquipamento?.codigo || eq.tipo_equipamento_rel?.codigo;
          console.log(`📊 [useDadosM160] Equipamento ${eq.nome}: código=${codigo}`);
          return codigo === 'M160' || codigo === 'M-160' || codigo === 'MEDIDOR';
        });

        console.log('📊 [useDadosM160] Equipamentos M-160 filtrados:', equipamentosM160);

        return equipamentosM160.map((eq: any) => ({
          id: eq.id?.trim(),
          nome: eq.nome || eq.tag || 'M-160',
          tipo: eq.tipoEquipamento?.codigo || eq.tipo_equipamento_rel?.codigo || 'M-160'
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
        const responseData = response.data?.data || response.data;

        if (!responseData?.dados || responseData.dados.length === 0) {
          return null;
        }

        return responseData.dados;
      } catch (error) {
        console.error('Erro ao buscar dados do M160:', error);
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

    const dadosProcessados: DadosM160[] = dadosM160.map((item: any) => {
      // Extrair dados do M160
      const dados = item.Dados || {};

      return {
        timestamp: item.timestamp || item.hora,
        tensaoA: dados.Va || 0,
        tensaoB: dados.Vb || 0,
        tensaoC: dados.Vc || 0,
        fatorPotenciaA: dados.FPa || 0,
        fatorPotenciaB: dados.FPb || 0,
        fatorPotenciaC: dados.FPc || 0,
      };
    });

    setDados(dadosProcessados);
  }, [dadosM160]);

  return {
    dados,
    equipamentosM160: equipamentosM160 || [],
    isLoading
  };
}
