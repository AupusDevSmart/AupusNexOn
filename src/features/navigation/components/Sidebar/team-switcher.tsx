import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";

/**
 * Marca no topo da sidebar. Logo compacto do NexON (sem a linha de sinal,
 * que é a versão indicada para cabeçalho de app). Claro/escuro é resolvido
 * só com CSS pela classe `dark` do <html>, que o ThemeProvider já aplica
 * também no tema 'system'.
 */
export function TeamSwitcher() {
  const navigate = useNavigate();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-card-accent data-[state=open]:text-card-accent-foreground"
          onClick={() => navigate('/')}
          aria-label="NexON — início"
        >
          {/* Sidebar recolhida: só o ícone do app cabe. */}
          <img
            src="/brand/nexon-icone.svg"
            alt="NexON"
            className="hidden size-8 shrink-0 rounded-lg group-data-[collapsible=icon]:block"
          />
          <div className="flex w-full items-center group-data-[collapsible=icon]:hidden">
            <img
              src="/brand/nexon-logo-compacto-colorido.svg"
              alt="NexON"
              className="h-7 w-auto object-contain dark:hidden"
            />
            <img
              src="/brand/nexon-logo-compacto-negativo.svg"
              alt="NexON"
              className="hidden h-7 w-auto object-contain dark:block"
            />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
