// src/features/equipamentos/hooks/useLocationCascade.ts
import { useState, useEffect, useCallback } from 'react';
import { PlantasService } from '@/services/plantas.services';
import { getUnidadesByPlanta } from '@/services/unidades.services';
import type { PlantaResponse, ProprietarioBasico } from '@/services/plantas.services';
import type { Unidade } from '@/features/unidades/types';

interface LocationData {
  proprietarioId?: string;
  plantaId?: string;
  unidadeId?: string;
}

export const useLocationCascade = (initialData?: LocationData) => {
  const [proprietarios, setProprietarios] = useState<ProprietarioBasico[]>([]);
  const [plantas, setPlantas] = useState<PlantaResponse[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  const [selectedProprietarioId, setSelectedProprietarioId] = useState<string>(initialData?.proprietarioId || '');
  const [selectedPlantaId, setSelectedPlantaId] = useState<string>(initialData?.plantaId || '');
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>(initialData?.unidadeId || '');

  const [loadingProprietarios, setLoadingProprietarios] = useState(false);
  const [loadingPlantas, setLoadingPlantas] = useState(false);
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Carregar proprietários
  const loadProprietarios = useCallback(async () => {
    try {
      setLoadingProprietarios(true);
      setError(null);

      // Buscar TODOS os usuários com roles válidas (não apenas os que têm plantas)
      const proprietariosList = await PlantasService.getProprietarios();
      setProprietarios(proprietariosList);

      console.log('✅ [useLocationCascade] Proprietários carregados:', proprietariosList.length);

    } catch (err) {
      console.error('❌ [useLocationCascade] Erro ao carregar proprietários:', err);
      setError('Erro ao carregar proprietários');
    } finally {
      setLoadingProprietarios(false);
    }
  }, []);

  // Carregar plantas de um proprietário
  const loadPlantasByProprietario = useCallback(async (proprietarioId: string) => {
    if (!proprietarioId) {
      setPlantas([]);
      setUnidades([]);
      return;
    }

    try {
      setLoadingPlantas(true);
      setError(null);

      // Buscar todas as plantas paginadas (limite máximo: 100)
      const todasPlantas: PlantaResponse[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await PlantasService.getAllPlantas({
          limit: 100,
          page,
          proprietarioId
        });

        todasPlantas.push(...response.data);

        // Verificar se há mais páginas
        hasMore = page < response.pagination.totalPages;
        page++;
      }

      setPlantas(todasPlantas);

    } catch (err) {
      console.error('Erro ao carregar plantas:', err);
      setError('Erro ao carregar plantas');
      setPlantas([]);
    } finally {
      setLoadingPlantas(false);
    }
  }, []);

  // Carregar unidades de uma planta
  const loadUnidadesByPlanta = useCallback(async (plantaId: string) => {
    if (!plantaId) {
      setUnidades([]);
      return;
    }

    try {
      setLoadingUnidades(true);
      setError(null);

      const unidadesData = await getUnidadesByPlanta(plantaId);
      setUnidades(unidadesData || []);

    } catch (err) {
      console.error('Erro ao carregar unidades:', err);
      setError('Erro ao carregar unidades');
      setUnidades([]);
    } finally {
      setLoadingUnidades(false);
    }
  }, []);

  // Handlers para mudanças
  const handleProprietarioChange = useCallback((proprietarioId: string) => {
    setSelectedProprietarioId(proprietarioId);
    setSelectedPlantaId('');
    setSelectedUnidadeId('');
    setPlantas([]);
    setUnidades([]);

    if (proprietarioId) {
      loadPlantasByProprietario(proprietarioId);
    }
  }, [loadPlantasByProprietario]);

  const handlePlantaChange = useCallback((plantaId: string) => {
    setSelectedPlantaId(plantaId);
    setSelectedUnidadeId('');
    setUnidades([]);

    if (plantaId) {
      loadUnidadesByPlanta(plantaId);
    }
  }, [loadUnidadesByPlanta]);

  const handleUnidadeChange = useCallback((unidadeId: string) => {
    setSelectedUnidadeId(unidadeId);
  }, []);

  // Carregar proprietários ao montar
  useEffect(() => {
    loadProprietarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar plantas se proprietário inicial foi fornecido
  useEffect(() => {
    if (initialData?.proprietarioId) {
      loadPlantasByProprietario(initialData.proprietarioId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.proprietarioId]);

  // Carregar unidades se planta inicial foi fornecida
  useEffect(() => {
    if (initialData?.plantaId) {
      loadUnidadesByPlanta(initialData.plantaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.plantaId]);

  return {
    proprietarios,
    plantas,
    unidades,
    selectedProprietarioId,
    selectedPlantaId,
    selectedUnidadeId,
    loadingProprietarios,
    loadingPlantas,
    loadingUnidades,
    error,
    handleProprietarioChange,
    handlePlantaChange,
    handleUnidadeChange,
    reset: () => {
      setSelectedProprietarioId('');
      setSelectedPlantaId('');
      setSelectedUnidadeId('');
      setPlantas([]);
      setUnidades([]);
    }
  };
};
