import { useSharedPages } from './SharedPagesContext';
import type { LocationData } from '../types/contracts';

// ============================================================
// STORES
// ============================================================

export function useUserStore() {
  const { stores } = useSharedPages();
  return stores.useUserStore();
}

export function useConcessionariasStore() {
  const { stores } = useSharedPages();
  return stores.useConcessionariasStore();
}

// ============================================================
// EQUIPAMENTOS
// ============================================================

export function useEquipamentos() {
  const { hooks } = useSharedPages();
  return hooks.useEquipamentos();
}

export function useEquipamentoFilters() {
  const { hooks } = useSharedPages();
  return hooks.useEquipamentoFilters();
}

export function useLocationCascade(initialData?: LocationData) {
  const { hooks } = useSharedPages();
  return hooks.useLocationCascade(initialData);
}

export function useSelectionData() {
  const { hooks } = useSharedPages();
  return hooks.useSelectionData();
}

// ============================================================
// UNIDADES
// ============================================================

export function useUnidades(filters?: any) {
  const { hooks } = useSharedPages();
  return hooks.useUnidades(filters);
}

export function useUnidadesByPlanta(plantaId?: string) {
  const { hooks } = useSharedPages();
  return hooks.useUnidadesByPlanta(plantaId);
}

export function useUnidade(id?: string) {
  const { hooks } = useSharedPages();
  return hooks.useUnidade(id);
}

export function useUnidadeEstatisticas(id?: string) {
  const { hooks } = useSharedPages();
  return hooks.useUnidadeEstatisticas(id);
}

export function useUnidadeEquipamentos(id?: string, filters?: any) {
  const { hooks } = useSharedPages();
  return hooks.useUnidadeEquipamentos(id, filters);
}

export function usePlantasForUnidades() {
  const { hooks } = useSharedPages();
  return hooks.usePlantasForUnidades();
}

export function useProprietariosForUnidades() {
  const { hooks } = useSharedPages();
  return hooks.useProprietariosForUnidades();
}

// ============================================================
// USUARIOS
// ============================================================

export function useUsuarios() {
  const { hooks } = useSharedPages();
  return hooks.useUsuarios();
}

// ============================================================
// PLANTAS
// ============================================================

export function usePlantasFeature() {
  const { hooks } = useSharedPages();
  return hooks.usePlantasFeature();
}

export function useProprietariosForPlantas() {
  const { hooks } = useSharedPages();
  return hooks.useProprietariosForPlantas();
}

// ============================================================
// CONCESSIONARIAS
// ============================================================

export function useConcessionariasFeature() {
  const { hooks } = useSharedPages();
  return hooks.useConcessionariasFeature();
}

export function useConcessionariasService() {
  const { hooks } = useSharedPages();
  return hooks.useConcessionariasService();
}

// ============================================================
// PERMISSOES & ROLES
// ============================================================

export function usePermissoes() {
  const { hooks } = useSharedPages();
  return hooks.usePermissoes();
}

export function usePermissoesGrouped() {
  const { hooks } = useSharedPages();
  return hooks.usePermissoesGrouped();
}

export function useRoles() {
  const { hooks } = useSharedPages();
  return hooks.useRoles();
}

export function useUserPermissions(userId: string, autoFetch?: boolean) {
  const { hooks } = useSharedPages();
  return hooks.useUserPermissions(userId, autoFetch);
}

export function useAvailableRolesAndPermissions() {
  const { hooks } = useSharedPages();
  return hooks.useAvailableRolesAndPermissions();
}

// ============================================================
// AUXILIARES
// ============================================================

export function useCategorias() {
  const { hooks } = useSharedPages();
  return hooks.useCategorias();
}

export function useModelos(params?: { categoriaId?: string; search?: string; autoFetch?: boolean }) {
  const { hooks } = useSharedPages();
  return hooks.useModelos(params);
}

export function useOrganizacoes() {
  const { hooks } = useSharedPages();
  return hooks.useOrganizacoes();
}

// ============================================================
// HTTP CLIENT (acesso direto quando necessario)
// ============================================================

export function useHttpClient() {
  const { httpClient } = useSharedPages();
  return httpClient;
}
