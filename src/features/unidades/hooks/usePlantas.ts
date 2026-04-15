// src/features/unidades/hooks/usePlantas.ts

import { useState, useEffect } from 'react';
import { PlantasService, ProprietarioBasico } from '@/services/plantas.services';

export interface PlantaOption {
  id: string;
  nome: string;
  localizacao?: string;
  cidade?: string;
  uf?: string;
  proprietario?: ProprietarioBasico;
}

export const usePlantas = () => {
  const [plantas, setPlantas] = useState<PlantaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlantas = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 [USE PLANTAS] Carregando plantas...');

      // Buscar todas as plantas (limite máximo permitido pela API: 100)
      const response = await PlantasService.getAllPlantas({ page: 1, limit: 100 });

      const plantasData = response.data.map((planta) => ({
        id: planta.id,
        nome: planta.nome,
        localizacao: planta.localizacao,
        cidade: planta.endereco?.cidade,
        uf: planta.endereco?.uf,
        proprietario: planta.proprietario,
      }));

      console.log('✅ [USE PLANTAS] Plantas carregadas:', plantasData.length);
      console.log('🔍 [USE PLANTAS] Exemplo de planta com proprietário:', plantasData[0]);
      setPlantas(plantasData);
    } catch (err: any) {
      console.error('❌ [USE PLANTAS] Erro:', err);
      setError(err.message || 'Erro ao carregar plantas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlantas();
  }, []);

  return {
    plantas,
    loading,
    error,
    refetch: fetchPlantas,
  };
};

export const generatePlantaOptions = (plantas: PlantaOption[]) => {
  const options = [{ value: 'all', label: 'Todas as plantas' }];

  plantas.forEach((planta) => {
    let label = `🏭 ${planta.nome}`;

    if (planta.localizacao) {
      label += ` (${planta.localizacao})`;
    }

    options.push({
      value: planta.id,
      label: label,
    });
  });

  return options;
};
