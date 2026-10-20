import { ClipboardPlus } from "lucide-react";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { useUserStore } from "@/store/useUserStore";
import { temPapelLuna, useLunaPedidos } from "@/features/luna-pedidos/luna-store";

// NEXON-8 (port do NEXUS-136/139/141): pedido ao Luna (kanban da equipe), que vira card no quadro NexON.
// O formulário é próprio (features/luna-pedidos), com a identidade do NexON, falando
// direto com a API do widget do Luna; o widget.js pronto não é mais carregado.
// O selo mostra quantos pedidos da pessoa estão prontos esperando conferência.

/** Só a equipe interna (analista, admin, super admin) cria card no Luna. */
export function LunaButton() {
  const veLuna = useUserStore((s) => temPapelLuna(s.user));
  const abrir = useLunaPedidos((s) => s.abrir);
  const prontos = useLunaPedidos((s) => s.meus?.counts.ready ?? 0);
  const { isMobile, setOpenMobile } = useSidebar();

  if (!veLuna) return null;

  const dica = prontos ? `Luna · ${prontos} ${prontos === 1 ? "pronto" : "prontos"} para conferir` : "Luna";

  return (
    <SidebarMenuButton
      tooltip={dica}
      aria-label={dica}
      onClick={(e) => {
        // No celular o sidebar é uma gaveta: fecha antes, e o pedido abre como folha pelo rodapé.
        if (isMobile) setOpenMobile(false);
        abrir(e.currentTarget.getBoundingClientRect(), "novo");
      }}
      className="relative h-10 rounded-lg border border-[#70C04B]/60 bg-[#70C04B]/5 font-medium text-nexon-link-claro dark:text-nexon-verde transition hover:bg-[#70C04B]/15 hover:text-nexon-link-claro dark:hover:text-nexon-verde active:scale-[0.98] group-data-[collapsible=icon]:rounded-xl"
    >
      <ClipboardPlus className="!size-5 shrink-0 group-data-[collapsible=icon]:!size-[22px]" />
      <span className="flex min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">Luna</span>
      {prontos > 0 && (
        <>
          <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold leading-none text-white animate-in zoom-in-50 duration-300 group-data-[collapsible=icon]:hidden">
            {prontos > 9 ? "9+" : prontos}
          </span>
          {/* Sidebar recolhido: só um ponto pulsando sobre o ícone. */}
          <span className="absolute right-1 top-1 hidden size-2.5 group-data-[collapsible=icon]:flex" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/70" />
            <span className="relative size-2.5 rounded-full bg-amber-500" />
          </span>
        </>
      )}
    </SidebarMenuButton>
  );
}
