import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";

/**
 * Topo da sidebar, na mesma medida do seletor de Nexus do Smart Nexus: ícone
 * do app (32px aberto, 44px no trilho recolhido) e o nome ao lado. O logo por
 * extenso fica no começo do breadcrumb.
 */
export function TeamSwitcher() {
  const navigate = useNavigate();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="NexON"
          className="data-[state=open]:bg-card-accent data-[state=open]:text-card-accent-foreground"
          onClick={() => navigate('/')}
        >
          <img
            src="/brand/nexon-icone.svg"
            alt=""
            aria-hidden
            className="aspect-square size-8 shrink-0 rounded-lg group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:rounded-xl"
          />
          {/* No trilho recolhido fica só o ícone: o nome não cabe. */}
          <div className="ml-2 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold">NexON</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
