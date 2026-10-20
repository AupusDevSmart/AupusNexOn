import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UsuarioDTO } from '@/types/dtos/usuarios-dto';
import { type Capacidades, type Papel, capacidadesDoPapel, papelECapacidades } from './papeis';

type UserStoreState = {
  user: UsuarioDTO | null;
  acessivel: string[];
  /** Papel canônico (NEXON-20). Vem do login / `/auth/me`; fallback pela role. */
  papel: Papel;
  /** O que o papel pode (para esconder botão; quem protege é o backend). */
  capacidades: Capacidades;
  setUser: (newUser: UsuarioDTO) => void;
  updateUser: (partialUser: Partial<UsuarioDTO>) => void;
  clearUser: () => void;
  getUserRole: () => string;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  isCliente: () => boolean;
  hasPermission: (permission: string) => boolean;
};

/**
 * Nomes das permissoes, venham elas como for.
 *
 * O backend nao fala uma lingua so: `/auth/login` e `/auth/me` devolvem
 * `all_permissions` como array de STRINGS (`permissionNames`), enquanto
 * `PATCH /usuarios/:id` devolve array de OBJETOS (`{ id, name, guard_name }`).
 *
 * Guardar o array cru fazia o `acessivel.includes('alguma.permissao')` das
 * rotas comparar string com objeto e devolver false para tudo — o usuario
 * perdia o menu inteiro depois de salvar o proprio perfil, e so voltava ao
 * normal deslogando, porque o login grava a forma certa.
 */
const nomesDePermissao = (valor: unknown): string[] => {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((p) => (typeof p === 'string' ? p : (p as { name?: string })?.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
};

export const useUserStore = create(
  persist<UserStoreState>(
    (set, get) => ({
      user: null,
      acessivel: [],
      papel: 'outro',
      capacidades: capacidadesDoPapel('outro'),

      setUser: (newUser: UsuarioDTO) =>
        set((state) => ({
          user: newUser,
          ...papelECapacidades(newUser),
          // Campo ausente NAO zera o que ja havia. Nem toda resposta que passa
          // por aqui e uma sessao: a de atualizar perfil traz o cadastro, sem
          // permissao nenhuma, e zerar deixaria o usuario preso na tela.
          // Para revogar de fato existe o clearUser, no logout.
          acessivel:
            newUser.all_permissions === undefined
              ? state.acessivel
              : nomesDePermissao(newUser.all_permissions),
        })),

      updateUser: (partialUser: Partial<UsuarioDTO>) =>
        set((state) => {
          if (!state.user) return { user: null, acessivel: [] };
          const updatedUser = { ...state.user, ...partialUser };
          const papelMudou =
            (partialUser as any).papel !== undefined ||
            (partialUser as any).capacidades !== undefined ||
            partialUser.roles !== undefined ||
            partialUser.role_details !== undefined;
          const newAcessivel =
            partialUser.all_permissions !== undefined
              ? nomesDePermissao(partialUser.all_permissions)
              : state.acessivel;
          return {
            user: updatedUser,
            acessivel: newAcessivel,
            ...(papelMudou ? papelECapacidades(updatedUser) : {}),
          };
        }),

      clearUser: () =>
        set({ user: null, acessivel: [], papel: 'outro', capacidades: capacidadesDoPapel('outro') }),

      getUserRole: () => {
        const roles = get().user?.roles;
        if (!roles || roles.length === 0) return '';

        // ✅ Suportar tanto string quanto objeto
        const firstRole = roles[0];
        return typeof firstRole === 'string' ? firstRole : firstRole?.name || '';
      },

      isSuperAdmin: () => get().getUserRole() === 'super_admin',

      isAdmin: () => {
        const role = get().getUserRole();
        return role === 'admin' || role === 'super_admin';
      },

      // Cliente = proprietário da usina. Por enquanto vê só monitoramento (COA +
      // Sinóptico › Visão Geral); nada de Cadastros. Ajuste part-by-part.
      isCliente: () => get().getUserRole() === 'proprietario',

      // Checa se o usuario possui uma permission Spatie (mesma fonte usada pela
      // navegacao: `acessivel` carrega os nomes de all_permissions vindos do backend).
      hasPermission: (permission: string) => {
        const { acessivel } = get();
        return Array.isArray(acessivel) && acessivel.includes(permission);
      },
    }),
    {
      name: 'user-storage',
      // v5 (NEXON-20): papel + capacidades. A migração deriva da sessão salva em
      // vez de descartá-la — sem migrate o zustand jogaria fora o usuário.
      version: 5,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted: any) => {
        const st = (persisted ?? {}) as Partial<UserStoreState>;
        return {
          ...st,
          ...papelECapacidades(st.user ?? null),
        } as UserStoreState;
      },
    },
  ),
);

/** Papel canônico do usuário logado (NEXON-20). */
export const usePapel = (): Papel => useUserStore((s) => s.papel);

/** Capacidades do usuário logado (NEXON-20). */
export const useCapacidades = (): Capacidades => useUserStore((s) => s.capacidades);

export type { Papel, Capacidades };
