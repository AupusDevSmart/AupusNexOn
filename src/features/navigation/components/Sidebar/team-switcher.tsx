import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/theme-provider"; // Ajuste o caminho conforme sua implementação

export function TeamSwitcher() {
  const navigate = useNavigate();
  const { theme } = useTheme(); // Obtém o tema atual

  const handleNavigateHome = () => {
    navigate('/');
  };

  // O provider tem TRÊS temas: 'dark', 'light' e 'system'. Comparar só com
  // 'dark' jogava o 'system' — que é o padrão — no ramo claro, e a logo azul
  // aparecia sobre a sidebar escura.
  const [sistemaEscuro, setSistemaEscuro] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = (e: MediaQueryListEvent) => setSistemaEscuro(e.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  const escuro = theme === 'dark' || (theme === 'system' && sistemaEscuro);

  const logoSrc = escuro ? '/logoaupus.svg' : '/logo-aupus-blue.png';
  const textColorClass = escuro ? 'text-white' : 'text-black';

  // Se a imagem falhar, some com ela em vez de exibir o ícone de imagem
  // quebrada. O onError anterior reatribuía o MESMO src que acabara de falhar,
  // o que só reiniciava o erro em loop.
  const [logoFalhou, setLogoFalhou] = useState(false);
  useEffect(() => setLogoFalhou(false), [logoSrc]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-card-accent data-[state=open]:text-card-accent-foreground"
          onClick={handleNavigateHome}
        >
          <div className="flex items-center text-center w-full gap-5">
            {!logoFalhou && (
              <img
                src={logoSrc}
                alt="Logo AUPUS"
                className="h-6 w-auto object-contain"
                onError={() => setLogoFalhou(true)}
              />
            )}
            <span className={`font-semibold text-sm md:text-base ${textColorClass}`}>
              Aupus Energia
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}