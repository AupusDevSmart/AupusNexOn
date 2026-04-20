// src/shared-pages-adapter.tsx
// Adapter to integrate @aupus/shared-pages into the AupusNexOn project.
// Maps NexOn hooks/stores to the SharedHooks/SharedStores contracts.

import React from 'react';
import { SharedPagesProvider } from '@aupus/shared-pages';
import type { SharedHooks, SharedStores } from '@aupus/shared-pages';
import { api } from '@/config/api';

// Stores
import { useUserStore } from '@/store/useUserStore';
import { useConcessionariasStore } from '@/store/useConcessionariasStore';

// Equipamentos hooks
import { useEquipamentos } from '@/features/equipamentos/hooks/useEquipamentos';
import { useEquipamentoFilters } from '@/features/equipamentos/hooks/useEquipamentoFilters';
import { useLocationCascade } from '@/features/equipamentos/hooks/useLocationCascade';
import { useSelectionData } from '@/features/equipamentos/hooks/useSelectionData';

// Unidades hooks
import {
  useUnidades,
  useUnidadesByPlanta,
  useUnidade,
  useUnidadeEstatisticas,
  useUnidadeEquipamentos,
} from '@/features/unidades/hooks/useUnidades';
import { usePlantas as usePlantasForUnidadesNexOn } from '@/features/unidades/hooks/usePlantas';
import { useProprietarios as useProprietariosForUnidadesNexOn } from '@/features/unidades/hooks/useProprietarios';

// Usuarios hooks
import { useUsuarios } from '@/features/usuarios/hooks/useUsuarios';

// Plantas hooks (feature-level)
import { usePlantas as usePlantasNexOn } from '@/features/plantas/hooks/usePlantas';
import { useProprietarios as useProprietariosForPlantasNexOn } from '@/features/plantas/config/filter-config';

// Concessionarias service
import { ConcessionariasService } from '@/services/concessionarias.services';

// Permissoes & Roles hooks
import { usePermissoes, usePermissoesGrouped } from '@/hooks/usePermissoes';
import { useRoles } from '@/hooks/useRoles';
import { useUserPermissions, useAvailableRolesAndPermissions } from '@/hooks/useUserPermissions';

// Auxiliar hooks
import { useCategorias } from '@/hooks/useCategorias';
import { useModelos } from '@/hooks/useModelos';
import { useOrganizacoes } from '@/hooks/useOrganizacoes';

// ============================================================
// WRAPPER HOOKS
// These adapt NexOn hook signatures/names to match SharedHooks contracts.
// ============================================================

/**
 * usePlantasFeature - wraps NexOn's usePlantas from features/plantas
 * Contract expects: { loading, plantas, carregarPlantasSimples, obterPlanta }
 */
function usePlantasFeature() {
  return usePlantasNexOn();
}

/**
 * useProprietariosForPlantas - wraps NexOn's useProprietarios from plantas/config/filter-config
 * Contract expects: { proprietarios, loading, error, refetch }
 */
function useProprietariosForPlantas() {
  return useProprietariosForPlantasNexOn();
}

/**
 * usePlantasForUnidades - wraps NexOn's usePlantas from features/unidades
 * Contract expects: { plantas, loading, error, refetch }
 */
function usePlantasForUnidades() {
  return usePlantasForUnidadesNexOn();
}

/**
 * useProprietariosForUnidades - wraps NexOn's useProprietarios from features/unidades
 * Contract expects: { proprietarios, loading, error }
 */
function useProprietariosForUnidades() {
  return useProprietariosForUnidadesNexOn();
}

/**
 * useConcessionariasFeature - creates a hook that wraps the ConcessionariasService
 * to satisfy the UseConcessionariasFeatureContract.
 * NexOn does not have this as a hook, so we build it inline.
 */
function useConcessionariasFeature() {
  const [concessionarias, setConcessionarias] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [filters, setFilters] = React.useState<any>({});

  const fetchConcessionarias = React.useCallback(async (currentFilters?: any) => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: currentFilters?.page || filters.page || 1,
        limit: currentFilters?.limit || filters.limit || 10,
        search: currentFilters?.search || filters.search || undefined,
        estado: currentFilters?.estado && currentFilters.estado !== 'all' ? currentFilters.estado : undefined,
        orderBy: 'nome',
        orderDirection: 'asc' as const,
      };
      const response = await ConcessionariasService.getAllConcessionarias(params);
      setConcessionarias(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar concessionarias');
      setConcessionarias([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createConcessionaria = React.useCallback(async (data: any) => {
    const result = await ConcessionariasService.createConcessionaria(data);
    await fetchConcessionarias();
    return result;
  }, [fetchConcessionarias]);

  const updateConcessionaria = React.useCallback(async (id: string, data: any) => {
    const result = await ConcessionariasService.updateConcessionaria(id, data);
    await fetchConcessionarias();
    return result;
  }, [fetchConcessionarias]);

  const deleteConcessionaria = React.useCallback(async (id: string) => {
    await ConcessionariasService.deleteConcessionaria(id);
    await fetchConcessionarias();
  }, [fetchConcessionarias]);

  const getConcessionaria = React.useCallback(async (id: string) => {
    return ConcessionariasService.getConcessionaria(id);
  }, []);

  const handleFilterChange = React.useCallback((newFilters: any) => {
    setFilters((prev: any) => ({ ...prev, ...newFilters }));
  }, []);

  const handlePageChange = React.useCallback((page: number) => {
    setFilters((prev: any) => ({ ...prev, page }));
  }, []);

  const refetch = React.useCallback(() => {
    fetchConcessionarias(filters);
  }, [fetchConcessionarias, filters]);

  return {
    concessionarias,
    loading,
    error,
    pagination,
    filters,
    fetchConcessionarias,
    createConcessionaria,
    updateConcessionaria,
    deleteConcessionaria,
    getConcessionaria,
    handleFilterChange,
    handlePageChange,
    refetch,
  };
}

/**
 * useConcessionariasService - wraps ConcessionariasService.getAllConcessionarias
 * into a hook satisfying UseConcessionariasServiceContract.
 */
function useConcessionariasServiceHook() {
  const getAllConcessionarias = React.useCallback(async (params?: {
    limit?: number;
    estado?: string;
    orderBy?: string;
    orderDirection?: string;
  }) => {
    const response = await ConcessionariasService.getAllConcessionarias({
      limit: params?.limit,
      estado: params?.estado,
      orderBy: params?.orderBy,
      orderDirection: params?.orderDirection as any,
    });
    return { data: response.data, pagination: response.pagination };
  }, []);

  return { getAllConcessionarias };
}

// ============================================================
// SHARED HOOKS & STORES
// ============================================================

const sharedHooks: SharedHooks = {
  // Equipamentos
  useEquipamentos,
  useEquipamentoFilters,
  useLocationCascade,
  useSelectionData: useSelectionData as any,

  // Unidades
  useUnidades: useUnidades as any,
  useUnidadesByPlanta,
  useUnidade,
  useUnidadeEstatisticas,
  useUnidadeEquipamentos,
  usePlantasForUnidades,
  useProprietariosForUnidades,

  // Usuarios
  useUsuarios,

  // Plantas
  usePlantasFeature,
  useProprietariosForPlantas,

  // Concessionarias
  useConcessionariasFeature,
  useConcessionariasService: useConcessionariasServiceHook,

  // Permissoes & Roles
  usePermissoes,
  usePermissoesGrouped,
  useRoles,
  useUserPermissions,
  useAvailableRolesAndPermissions,

  // Auxiliares
  useCategorias,
  useModelos,
  useOrganizacoes,
};

const sharedStores: SharedStores = {
  useUserStore: () => useUserStore() as any,
  useConcessionariasStore: () => useConcessionariasStore() as any,
};

// ============================================================
// PROVIDER COMPONENT
// ============================================================

export function NexOnSharedPagesProvider({ children }: { children: React.ReactNode }) {
  return (
    <SharedPagesProvider httpClient={api} hooks={sharedHooks} stores={sharedStores}>
      {children}
    </SharedPagesProvider>
  );
}
