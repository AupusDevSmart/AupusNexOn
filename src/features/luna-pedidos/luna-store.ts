import { create } from "zustand";
import type { UsuarioDTO } from "@/types/dtos/usuarios-dto";
import type { LunaMeus } from "./luna-api";

/**
 * Só a equipe interna (analista, admin, super admin) cria card no Luna. O NexON também tem
 * gerente, consultor, vendedor, operador e proprietario, que ficam de fora. O useUserStore do
 * NexON não tem `hasRole` (o `getUserRole` olha só o primeiro papel), então a conferência lê
 * todos os papéis do usuário, venham como string ou como objeto.
 */
export const PAPEIS_LUNA = ["super_admin", "admin", "analista"];

export function papeisDoUsuario(user?: UsuarioDTO | null): string[] {
  return (user?.roles ?? [])
    .map((r) => (typeof r === "string" ? r : r?.name))
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

export function temPapelLuna(user?: UsuarioDTO | null): boolean {
  return papeisDoUsuario(user).some((p) => PAPEIS_LUNA.includes(p));
}

export type LunaAba = "novo" | "meus" | "duvidas";
export type LunaAvisoPedido = { titulo: string; texto: string };

// O botão mora no sidebar (que no celular é uma gaveta que se fecha) e o painel mora fora dele;
// os dois conversam por aqui. `ancora` é onde o botão estava, para o painel abrir perto dele.
// `meus` é o resumo dos pedidos da pessoa (NEXUS-141), mantido pela LunaVigia; null = sem sessão
// ou sem a rota no Luna. `tick` pede uma conferência fora de hora (depois de entrar ou enviar).
type LunaPedidosState = {
  aberto: boolean;
  ancora: DOMRect | null;
  aba: LunaAba;
  meus: LunaMeus | null;
  aviso: LunaAvisoPedido | null;
  tick: number;
  abrir: (ancora?: DOMRect | null, aba?: LunaAba) => void;
  fechar: () => void;
  setAba: (aba: LunaAba) => void;
  setMeus: (meus: LunaMeus | null) => void;
  setAviso: (aviso: LunaAvisoPedido | null) => void;
  atualizarMeus: () => void;
};

export const useLunaPedidos = create<LunaPedidosState>((set) => ({
  aberto: false,
  ancora: null,
  aba: "novo",
  meus: null,
  aviso: null,
  tick: 0,
  abrir: (ancora = null, aba = "novo") => set({ aberto: true, ancora, aba, aviso: null }),
  fechar: () => set({ aberto: false }),
  setAba: (aba) => set({ aba }),
  setMeus: (meus) => set({ meus }),
  setAviso: (aviso) => set({ aviso }),
  atualizarMeus: () => set((s) => ({ tick: s.tick + 1 })),
}));
