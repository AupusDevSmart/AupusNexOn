// src/features/unidades/hooks/useUnidades.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getAllUnidades,
  getUnidadesByPlanta,
  getUnidadeById,
  createUnidade,
  updateUnidade,
  deleteUnidade,
  getUnidadeEstatisticas,
  getUnidadeEquipamentos,
} from '@/services/unidades.services';
import type {
  UnidadeFilters,
  CreateUnidadeDto,
  UpdateUnidadeDto,
} from '@/features/unidades/types';

/**
 * Hook principal para gerenciar unidades
 */
export const useUnidades = (filters?: UnidadeFilters) => {
  const queryClient = useQueryClient();

  // Query: Listar unidades com filtros
  const {
    data: unidadesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['unidades', filters],
    queryFn: () => getAllUnidades(filters),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Mutation: Criar unidade
  const createMutation = useMutation({
    mutationFn: createUnidade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades'] });
    },
  });

  // Mutation: Atualizar unidade
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUnidadeDto }) =>
      updateUnidade(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades'] });
    },
  });

  // Mutation: Deletar unidade
  const deleteMutation = useMutation({
    mutationFn: deleteUnidade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades'] });
    },
  });

  return {
    unidades: unidadesData?.data || [],
    pagination: unidadesData?.pagination,
    isLoading,
    error,
    refetch,
    createUnidade: createMutation.mutateAsync,
    updateUnidade: updateMutation.mutateAsync,
    deleteUnidade: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

/**
 * Hook para buscar unidades por planta (para seletores em cascata)
 */
export const useUnidadesByPlanta = (plantaId?: string) => {
  const {
    data: unidades,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['unidades', 'planta', plantaId],
    queryFn: () => getUnidadesByPlanta(plantaId!),
    enabled: !!plantaId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  return {
    unidades: unidades || [],
    isLoading,
    error,
  };
};

/**
 * Hook para buscar uma unidade específica
 */
export const useUnidade = (id?: string) => {
  const {
    data: unidade,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['unidade', id],
    queryFn: () => getUnidadeById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  return {
    unidade,
    isLoading,
    error,
  };
};

/**
 * Hook para buscar estatísticas de uma unidade
 */
export const useUnidadeEstatisticas = (id?: string) => {
  const {
    data: estatisticas,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['unidade', id, 'estatisticas'],
    queryFn: () => getUnidadeEstatisticas(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });

  return {
    estatisticas,
    isLoading,
    error,
  };
};

/**
 * Hook para buscar equipamentos de uma unidade
 */
export const useUnidadeEquipamentos = (
  id?: string,
  filters?: { page?: number; limit?: number; search?: string }
) => {
  const {
    data: equipamentosData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['unidade', id, 'equipamentos', filters],
    queryFn: () => getUnidadeEquipamentos(id!, filters),
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });

  return {
    equipamentos: equipamentosData?.data || [],
    pagination: equipamentosData?.pagination,
    unidade: equipamentosData?.unidade,
    isLoading,
    error,
  };
};
