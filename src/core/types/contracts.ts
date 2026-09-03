import type { AxiosInstance } from 'axios';
import type { Pagination } from './base';

// ============================================================
// STORES
// ============================================================

export interface UserBasic {
  id: string;
  nome: string;
  email: string;
  status: string;
  roles: string[];
  all_permissions: string[];
}

export interface UserStoreContract {
  user: UserBasic | null;
  acessivel: string[];
  getUserRole: () => string;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
}

export interface ConcessionariaBasic {
  id: string;
  nome: string;
  estado?: string;
  logoUrl?: string;
  documento?: string;
}

export interface ConcessionariasStoreContract {
  concessionarias: ConcessionariaBasic[] | null;
  concessionariaAtual: ConcessionariaBasic | null;
  selectedConcessionarias: ConcessionariaBasic[];
  selectAllConcessionarias: boolean;
  setConcessionarias: (items: ConcessionariaBasic[]) => void;
  setConcessionariaAtual: (id: string) => void;
  toggleConcessionaria: (item: ConcessionariaBasic) => void;
  setSelectAllConcessionarias: (selectAll: boolean) => void;
  clearConcessionarias: () => void;
  clearConcessionaria: () => void;
}

export interface SharedStores {
  useUserStore: () => UserStoreContract;
  useConcessionariasStore: () => ConcessionariasStoreContract;
}

// ============================================================
// SHARED TYPES (used across contracts)
// ============================================================

export interface FilterOption {
  value: string;
  label: string;
}

export interface ProprietarioBasico {
  id: string;
  nome?: string;
  email?: string;
  razaoSocial?: string;
  cnpjCpf?: string;
  cpf_cnpj?: string;
  tipo: 'pessoa_fisica' | 'pessoa_juridica';
}

export interface PlantaBasic {
  id: string;
  nome: string;
  localizacao?: string;
  cnpj?: string;
  proprietarioId?: string;
  proprietario?: ProprietarioBasico;
}

export interface UnidadeBasic {
  id: string;
  nome: string;
  tipo: string;
  estado?: string;
  cidade?: string;
  plantaId?: string;
}

export interface LocationData {
  proprietarioId?: string;
  plantaId?: string;
  unidadeId?: string;
}

export interface SelectionOption {
  value: string;
  label: string;
}

// ============================================================
// EQUIPAMENTOS CONTRACTS
// ============================================================

export interface UseEquipamentosContract {
  loading: boolean;
  error: string | null;
  equipamentos: any[];
  equipamentosUC: any[];
  componentesUAR: any[];
  totalPages: number;
  currentPage: number;
  total: number;
  createEquipamento: (data: any) => Promise<any>;
  updateEquipamento: (id: string, data: any) => Promise<any>;
  deleteEquipamento: (id: string) => Promise<void>;
  getEquipamento: (id: string) => Promise<any>;
  fetchEquipamentos: (params?: any) => Promise<any[]>;
  fetchEquipamentosByPlanta: (plantaId: string, params?: any) => Promise<{
    equipamentos: any[];
    planta: { id: string; nome: string; localizacao: string };
  }>;
  fetchComponentesByEquipamento: (equipamentoId: string) => Promise<any[]>;
  fetchEquipamentosUCDisponiveis: () => Promise<any[]>;
  fetchComponentesParaGerenciar: (ucId: string) => Promise<{
    equipamentoUC: any;
    componentes: any[];
  }>;
  salvarComponentesUARLote: (ucId: string, componentes: any[]) => Promise<{
    message: string;
    componentes: any[];
  }>;
  getEstatisticasPlanta: (plantaId: string) => Promise<any>;
  uploadFoto: (id: string, file: File) => Promise<{ fotoUrl: string }>;
  removeFoto: (id: string) => Promise<{ fotoUrl: null }>;
  /**
   * Cadastra vários equipamentos iguais de uma vez. O bloco comum vale para
   * todos; `itens` traz o que muda entre eles.
   */
  createEquipamentosLote: (
    data: any,
    itens: EquipamentoDoLote[],
  ) => Promise<{ total: number; equipamentos: any[] }>;
  /**
   * De onde continuar a numeração de nomes e TAGs, a partir do que já existe.
   */
  proximoSequencial: (params: {
    unidade_id?: string;
    base_nome?: string;
    base_tag?: string;
  }) => Promise<{ proximo_nome: number; proximo_tag: number }>;
  /** Copia a lista de anexos de um equipamento para outros. */
  replicarAnexos: (
    origemId: string,
    destinoIds: string[],
  ) => Promise<{ total: number; anexos_por_equipamento: number }>;
  clearError: () => void;
  refreshData: () => Promise<void>;
}

/** O que varia entre equipamentos de um mesmo lote. */
export interface EquipamentoDoLote {
  nome: string;
  tag?: string;
  numero_serie?: string;
  localizacao_especifica?: string;
}

export interface UseEquipamentoFiltersContract {
  loadingProprietarios: boolean;
  loadingPlantas: boolean;
  loadingUnidades: boolean;
  proprietarios: FilterOption[];
  plantas: FilterOption[];
  unidades: FilterOption[];
  loadPlantasByProprietario: (proprietarioId: string) => Promise<void>;
  loadUnidadesByPlanta: (plantaId: string) => Promise<void>;
  loadUnidadesByProprietario: (proprietarioId: string) => Promise<void>;
  loadInitialData: () => Promise<void>;
  resetPlantas: () => void;
  resetUnidades: () => void;
  error: string | null;
  clearError: () => void;
}

export interface UseLocationCascadeContract {
  proprietarios: ProprietarioBasico[];
  plantas: PlantaBasic[];
  unidades: UnidadeBasic[];
  selectedProprietarioId: string;
  selectedPlantaId: string;
  selectedUnidadeId: string;
  loadingProprietarios: boolean;
  loadingPlantas: boolean;
  loadingUnidades: boolean;
  error: string | null;
  handleProprietarioChange: (proprietarioId: string) => void;
  handlePlantaChange: (plantaId: string) => void;
  handleUnidadeChange: (unidadeId: string) => void;
  reset: () => void;
}

export interface UseSelectionDataContract {
  loadingProprietarios: boolean;
  loadingPlantas: boolean;
  loadingHierarquia: boolean;
  loadingTipos: boolean;
  loadingUCs: boolean;
  proprietarios: any[];
  plantas: any[];
  tiposEquipamentos: any[];
  equipamentosUC: SelectionOption[];
  fetchProprietarios: () => Promise<any[]>;
  fetchPlantas: (proprietarioId?: string) => Promise<any[]>;
  fetchHierarquiaNivel: (nivel: string, parentId?: string) => Promise<any[]>;
  fetchTiposEquipamentos: () => Promise<any[]>;
  fetchEquipamentosUC: (plantaId?: string) => Promise<SelectionOption[]>;
  getProprietarioById: (id: string) => any | null;
  getPlantaById: (id: string) => any | null;
  getTipoEquipamentoById: (id: string) => any | null;
  getCamposTecnicosPorTipo: (tipo: string) => any[];
  error: string | null;
  clearError: () => void;
}

// ============================================================
// UNIDADES CONTRACTS
// ============================================================

export interface UseUnidadesContract {
  unidades: any[];
  pagination: Pagination;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  createUnidade: (data: any) => Promise<any>;
  updateUnidade: (params: { id: string; data: any }) => Promise<any>;
  deleteUnidade: (id: string) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export interface UseUnidadesByPlantaContract {
  unidades: any[];
  isLoading: boolean;
  error: Error | null;
}

export interface UseUnidadeContract {
  unidade: any | undefined;
  isLoading: boolean;
  error: Error | null;
}

export interface UseUnidadeEstatisticasContract {
  estatisticas: any | undefined;
  isLoading: boolean;
  error: Error | null;
}

export interface UseUnidadeEquipamentosContract {
  equipamentos: any[];
  pagination: Pagination;
  unidade: any;
  isLoading: boolean;
  error: Error | null;
}

export interface PlantaOption {
  id: string;
  nome: string;
  localizacao?: string;
  cidade?: string;
  uf?: string;
  proprietario?: ProprietarioBasico;
}

export interface UsePlantasForUnidadesContract {
  plantas: PlantaOption[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface ProprietarioOption {
  id: string;
  nome: string;
}

export interface UseProprietariosContract {
  proprietarios: ProprietarioOption[];
  loading: boolean;
  error: string | null;
}

// ============================================================
// USUARIOS CONTRACTS
// ============================================================

export interface UseUsuariosContract {
  usuarios: any[];
  loading: boolean;
  error: string | null;
  pagination: Pagination;
  filters: any;
  statistics: {
    totalUsuarios: number;
    usuariosAtivos: number;
    usuariosInativos: number;
    gerentes: number;
    administradores: number;
    vendedores: number;
    consultores: number;
  };
  handleFilterChange: (filters: any) => void;
  handlePageChange: (page: number) => void;
  refetch: () => void;
  createUsuario: (data: any) => Promise<any>;
  updateUsuario: (id: string, data: any) => Promise<any>;
  deleteUsuario: (id: string) => Promise<void>;
  findUsuario: (id: string) => Promise<any>;
  findUsuarioWithDebug?: (id: string) => Promise<any>;
  changeUserPassword: (id: string, data: { senhaAtual: string; novaSenha: string }) => Promise<{ message: string }>;
  resetUserPassword: (id: string, data: { novaSenha: string; confirmarSenha: string }) => Promise<{ message: string; senhaTemporaria: string }>;
  getUserPermissions: (id: string) => Promise<any>;
  getUserPermissionsSummary: (id: string) => Promise<any>;
  checkUserPermission: (id: string, permissionName: string) => Promise<boolean>;
  assignUserRole: (id: string, roleId: number) => Promise<void>;
  syncUserPermissions: (id: string, permissionIds: number[]) => Promise<void>;
  usuarioToFormData: (usuario: any) => any;
  usuarioToFormDataAsync: (usuario: any) => Promise<any>;
  clearError: () => void;
  isEmptyResult: boolean;
}

// ============================================================
// PLANTAS CONTRACTS
// ============================================================

export interface SimplePlanta {
  id: string;
  nome: string;
  localizacao: string;
}

export interface UsePlantasFeatureContract {
  loading: boolean;
  plantas: SimplePlanta[];
  carregarPlantasSimples: () => Promise<SimplePlanta[]>;
  obterPlanta: (id: string) => Promise<any | null>;
}

export interface UseProprietariosForPlantasContract {
  proprietarios: ProprietarioBasico[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================
// CONCESSIONARIAS CONTRACTS
// ============================================================

export interface UseConcessionariasFeatureContract {
  concessionarias: any[];
  loading: boolean;
  error: string | null;
  pagination: Pagination;
  filters: any;
  fetchConcessionarias: (filters?: any) => Promise<void>;
  createConcessionaria: (data: any) => Promise<any>;
  updateConcessionaria: (id: string, data: any) => Promise<any>;
  deleteConcessionaria: (id: string) => Promise<void>;
  getConcessionaria: (id: string) => Promise<any>;
  handleFilterChange: (filters: any) => void;
  handlePageChange: (page: number) => void;
  refetch: () => void;
}

export interface UseConcessionariasServiceContract {
  getAllConcessionarias: (params?: {
    limit?: number;
    estado?: string;
    orderBy?: string;
    orderDirection?: string;
  }) => Promise<{ data: any[]; pagination: Pagination }>;
}

// ============================================================
// PERMISSOES & ROLES CONTRACTS
// ============================================================

export interface UsePermissoesContract {
  permissoes: any[];
  permissoesPorCategoria: Record<string, any[]>;
  loading: boolean;
  error: string | null;
}

export interface UsePermissoesGroupedContract {
  permissoesPorCategoria: Record<string, any[]>;
  loading: boolean;
  error: string | null;
}

export interface UseRolesContract {
  roles: any[];
  loading: boolean;
  error: string | null;
}

export interface UseUserPermissionsContract {
  permissions: any[];
  roles: any[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseAvailableRolesAndPermissionsContract {
  roles: any[];
  permissions: any[];
  loading: boolean;
  error: string | null;
}

// ============================================================
// AUXILIAR CONTRACTS
// ============================================================

export interface UseCategoriasContract {
  categorias: any[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseModelosContract {
  modelos: any[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseOrganizacoesContract {
  organizacoes: any[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ============================================================
// MAIN SHARED HOOKS INTERFACE
// ============================================================

export interface SharedHooks {
  // Equipamentos
  useEquipamentos: () => UseEquipamentosContract;
  useEquipamentoFilters: () => UseEquipamentoFiltersContract;
  useLocationCascade: (initialData?: LocationData) => UseLocationCascadeContract;
  useSelectionData: () => UseSelectionDataContract;

  // Unidades
  useUnidades: (filters?: any) => UseUnidadesContract;
  useUnidadesByPlanta: (plantaId?: string) => UseUnidadesByPlantaContract;
  useUnidade: (id?: string) => UseUnidadeContract;
  useUnidadeEstatisticas: (id?: string) => UseUnidadeEstatisticasContract;
  useUnidadeEquipamentos: (id?: string, filters?: any) => UseUnidadeEquipamentosContract;
  usePlantasForUnidades: () => UsePlantasForUnidadesContract;
  useProprietariosForUnidades: () => UseProprietariosContract;

  // Usuarios
  useUsuarios: () => UseUsuariosContract;

  // Plantas
  usePlantasFeature: () => UsePlantasFeatureContract;
  useProprietariosForPlantas: () => UseProprietariosForPlantasContract;

  // Concessionarias
  useConcessionariasFeature: () => UseConcessionariasFeatureContract;
  useConcessionariasService: () => UseConcessionariasServiceContract;

  // Permissoes e Roles
  usePermissoes: () => UsePermissoesContract;
  usePermissoesGrouped: () => UsePermissoesGroupedContract;
  useRoles: () => UseRolesContract;
  useUserPermissions: (userId: string, autoFetch?: boolean) => UseUserPermissionsContract;
  useAvailableRolesAndPermissions: () => UseAvailableRolesAndPermissionsContract;

  // Auxiliares
  useCategorias: () => UseCategoriasContract;
  useModelos: (params?: { categoriaId?: string; search?: string; autoFetch?: boolean }) => UseModelosContract;
  useOrganizacoes: () => UseOrganizacoesContract;
}

// ============================================================
// PROVIDER PROPS
// ============================================================

export interface SharedPagesProviderProps {
  httpClient: AxiosInstance;
  hooks: SharedHooks;
  stores: SharedStores;
  children: React.ReactNode;
}
