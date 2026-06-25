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
import { QueryClient, QueryClientProvider } from "react-query";
import { Outlet, useNavigate } from "react-router-dom";
const queryClient = new QueryClient();

export function AppTemplate() {
  const { user } = useUserStore();
  const navigate = useNavigate();

  // useEffect(() => {
  //   if (!user) navigate('/login');
  // }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider defaultOpen={false}>
        <div className="flex h-[100dvh] w-screen overflow-hidden bg-secondary">
          <AppSidebar />
          <SidebarInset className="flex flex-col w-full h-full bg-secondary">
            <header className="flex-none flex items-center justify-between gap-2 bg-secondary">
              <div className="flex h-12 items-center gap-2 px-4 bg-secondary shrink-0">
                <SidebarTrigger className="w-4 h-4 mr-2" />
                <CustomBreadcrumbs />
              </div>
              {/* Slot pra acoes da pagina na linha dos breadcrumbs (preenchido via
                  portal — ex.: toggle Unifilar/IoT do sinoptico). Vazio nas demais telas. */}
              <div id="app-header-slot" className="flex flex-1 items-center justify-end gap-2 min-w-0 px-2" />
              <NotificacoesSheet />
            </header>
            <main className="flex-1 overflow-auto bg-secondary w-full min-h-0">
              <Outlet />
            </main>
            <CommandPallete />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </QueryClientProvider>
  );
}
