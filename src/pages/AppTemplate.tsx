import { CustomBreadcrumbs } from "@/components/common/CustomBreadcrumbs";
import { NotificacoesSheet } from "@/components/common/notification-sheet";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CommandPallete } from "@/features/navigation/components/CommandPallete";
import { AppSidebar } from "@/features/navigation/components/Sidebar/app-sidebar";
import { useUserStore } from "@/store/useUserStore";
import { useSincronizarSessao } from "@/hooks/useSincronizarSessao";
import { QueryClient, QueryClientProvider } from "react-query";
import { Outlet, useNavigate } from "react-router-dom";
const queryClient = new QueryClient();

export function AppTemplate() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  // Papel e permissões salvos podem estar velhos: relê /auth/me ao abrir (PER-21f).
  useSincronizarSessao();

  // useEffect(() => {
  //   if (!user) navigate('/login');
  // }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider defaultOpen={false}>
        <div className="flex h-[100dvh] w-full overflow-hidden bg-secondary">
          <AppSidebar />
            {/* `SidebarInset` ja e `flex-1`. O `w-full` que estava aqui pedia
                100% da LINHA — que tambem contem a sidebar. Aberta a sidebar, o
                conteudo passava a medir viewport + 256px e o `overflow-hidden`
                do pai cortava a sobra: a tabela era empurrada para fora da area
                visivel, sem nem barra de rolagem para alcanca-la.

                `min-w-0` e o que permite encolher de verdade. Item flex tem
                `min-width: auto`, entao se recusa a ficar menor que o proprio
                conteudo e transborda em vez de ceder — e uma tabela larga nunca
                cede sozinha. Com `min-w-0`, a area util acompanha a sidebar e o
                scroll horizontal da propria tabela passa a funcionar. */}
          <SidebarInset className="flex flex-col min-w-0 h-full bg-secondary">
            {/* No celular o header quebra em duas linhas: breadcrumb + notificacoes em
                cima e o slot da pagina (abas do sinoptico) embaixo, rolando na
                horizontal. Antes tudo ficava numa linha de ~800px e empurrava o
                app inteiro para o lado. */}
            <header className="flex-none flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 min-w-0 overflow-hidden bg-secondary">
              <div className="flex h-12 min-w-0 flex-1 sm:flex-none items-center gap-2 px-3 sm:px-4 bg-secondary overflow-hidden">
                <SidebarTrigger className="w-4 h-4 mr-2" />
                <CustomBreadcrumbs className="min-w-0" />
              </div>
              {/* Slot pra acoes da pagina na linha dos breadcrumbs (preenchido via
                  portal — ex.: toggle Unifilar/IoT do sinoptico). Vazio nas demais telas. */}
              <div id="app-header-slot" className="flex empty:hidden max-sm:order-last max-sm:basis-full max-sm:justify-start max-sm:pb-2 flex-1 items-center justify-end gap-2 min-w-0 px-2 overflow-x-auto scrollbar-none" />
              <NotificacoesSheet />
            </header>
            <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-secondary">
              <Outlet />
            </main>
            <CommandPallete />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </QueryClientProvider>
  );
}
