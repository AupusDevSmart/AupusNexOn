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
};

export const useUserStore = create(
  persist<UserStoreState>(
    (set, get) => ({
      user: null,
      acessivel: [],

      setUser: (newUser: UsuarioDTO) =>
        set({
          user: newUser,
          acessivel: newUser.all_permissions || [],
        }),

      updateUser: (partialUser: Partial<UsuarioDTO>) =>
        set((state) => {
          if (!state.user) return { user: null, acessivel: [] };
          const updatedUser = { ...state.user, ...partialUser };
          const newAcessivel =
            partialUser.all_permissions !== undefined
              ? partialUser.all_permissions
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
    }),
    {
      name: 'user-storage',
      version: 4, // ✅ Incrementado para forçar recriação do cache
      storage: createJSONStorage(() => localStorage),
    },
  ),
);