import { ChevronsUpDown, Building } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useQueryClient } from "@tanstack/react-query";
import { useConcessionariasStore } from "@/store/useConcessionariasStore";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/theme-provider"; // Ajuste o caminho conforme sua implementação

export function TeamSwitcher() {
  const navigate = useNavigate();
  const { theme } = useTheme(); // Obtém o tema atual
  
  const handleNavigateHome = () => {
    navigate('/');
  };

  const logoSrc = theme === 'dark' ? 'logoaupus.png' : 'logoaupus-blue.jpg';
  const textColorClass = theme === 'dark' ? 'text-white' : 'text-black';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-card-accent data-[state=open]:text-card-accent-foreground"
          onClick={handleNavigateHome}
        >
          <div className="flex items-center text-center w-full gap-5">
            <img 
              src={logoSrc} 
              alt="Logo AUPUS" 
              className="h-6 w-auto" 
            />
            <span className={`font-semibold text-sm md:text-base ${textColorClass}`}>
              Aupus Energia
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}