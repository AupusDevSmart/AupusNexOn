import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UsuarioDTO } from '@/types/dtos/usuarios-dto';

type UserStoreState = {
  user: UsuarioDTO | null;
  acessivel: string[];
  setUser: (newUser: UsuarioDTO) => void;
  updateUser: (partialUser: Partial<UsuarioDTO>) => void;
  clearUser: () => void;
  getUserRole: () => string;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
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

      setUser: (newUser: UsuarioDTO) =>
        set((state) => ({
          user: newUser,
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
          const newAcessivel =
            partialUser.all_permissions !== undefined
              ? nomesDePermissao(partialUser.all_permissions)
              : state.acessivel;
          return { user: updatedUser, acessivel: newAcessivel };
        }),

      clearUser: () => set({ user: null, acessivel: [] }),

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

      // Checa se o usuario possui uma permission Spatie (mesma fonte usada pela
      // navegacao: `acessivel` carrega os nomes de all_permissions vindos do backend).
      hasPermission: (permission: string) => {
        const { acessivel } = get();
        return Array.isArray(acessivel) && acessivel.includes(permission);
      },
    }),
    {
      name: 'user-storage',
      version: 4, // ✅ Incrementado para forçar recriação do cache
      storage: createJSONStorage(() => localStorage),
    },
  ),
);