// src/features/plantas/hooks/usePlantas.ts
import { useState, useCallback } from 'react';
import { PlantasService, PlantaResponse, FindAllPlantasParams } from '@/services/plantas.services';

interface SimplePlanta {
  id: string;
  nome: string;
  localizacao: string;
}

export const usePlantas = () => {
  const [loading, setLoading] = useState(false);
  const [plantas, setPlantas] = useState<SimplePlanta[]>([]);

  // Carregar todas as plantas de forma simplificada para seletores
  const carregarPlantasSimples = useCallback(async () => {
    setLoading(true);
    try {
      const response = await PlantasService.getAllPlantas({
        page: 1,
        limit: 100, // Carregar mais plantas para não ter problemas com paginação
        orderBy: 'nome',
        orderDirection: 'asc'
      });

      const plantasSimples: SimplePlanta[] = response.data.map(planta => ({
        id: planta.id,
        nome: planta.nome,
        localizacao: planta.localizacao
      }));

      setPlantas(plantasSimples);
      return plantasSimples;
    } catch (error) {
      console.error('Erro ao carregar plantas:', error);
      setPlantas([]);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Obter planta específica
  const obterPlanta = useCallback(async (id: string): Promise<PlantaResponse | null> => {
    setLoading(true);
    try {
      const planta = await PlantasService.getPlanta(id);
      return planta;
    } catch (error) {
      console.error('Erro ao obter planta:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    plantas,
    carregarPlantasSimples,
    obterPlanta
  };
};