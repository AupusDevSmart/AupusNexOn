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
        const response = await api.get(`/unidades/${unidadeId}/equipamentos`, {
          params: { tipo: 'M-160' }
        });

        const equipamentos = response.data?.data || response.data || [];
        return equipamentos.map((eq: any) => ({
          id: eq.id,
          nome: eq.nome || eq.tag || 'M-160',
          tipo: eq.tipo || 'M-160'
        }));
      } catch (error) {
        console.error('Erro ao buscar M160:', error);
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
