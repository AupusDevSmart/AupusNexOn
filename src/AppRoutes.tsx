import { FeatureWrapper } from "@/components/common/FeatureWrapper";
import { AppTemplate } from "@/pages/AppTemplate";
import { Settings } from "@/pages/settings";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardPage } from "./pages/dashboard";
import { LoginPage } from "@/pages/login/LoginPage";
import { useUserStore } from "@/store/useUserStore";

// Shared pages (from @aupus/shared-pages)
import {
  EquipamentosPage,
  UnidadesPage,
  UsuariosPage,
  PlantasPage,
  ConcessionariasPage,
} from "@aupus/shared-pages";

// Lazy load para evitar problemas de import
import { lazy, Suspense } from "react";

/**
 * Componente de rota protegida
 * Verifica se o usuário está autenticado antes de renderizar
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUserStore();

  if (!user?.id) {
    const currentPath = window.location.pathname;
    return <Navigate to={`/login?redirectTo=${currentPath}`} replace />;
  }

  return <>{children}</>;
}

const CadastroUnidadesPage = lazy(() =>
  import("@/pages/supervisorio/cadastro-unidades").then((module) => ({
    default: module.CadastroUnidadesPage,
  }))
);

// ✅ Lazy load para Logs de Eventos
const LogsEventosPage = lazy(() =>
  import("@/pages/logs-eventos").then((module) => ({
    default: module.LogsEventosPage,
  }))
);

const DemoMqttPage = lazy(() =>
  import("@/pages/supervisorio/demo-mqtt").then((module) => ({
    default: module.default,
  }))
);

const SinopticoPage = lazy(() =>
  import("@/pages/supervisorio/sinoptico-ativo").then((module) => ({
    default: module.SinopticoAtivoPage,
  }))
);

const SelecionarUnidadePage = lazy(() =>
  import("@/pages/supervisorio/selecionar-unidade").then((module) => ({
    default: module.SelecionarUnidadePage,
  }))
);

// ✅ Sinóptico V2 (Refatorado)
const SinopticoV2Page = lazy(() =>
  import("@/pages/supervisorio/sinoptico-v2").then((module) => ({
    default: module.SinopticoAtivoV2Page,
  }))
);

// ✅ COA Antigo (Layout Original com Mock)
const CoaAntigoPage = lazy(() =>
  import("@/pages/supervisorio/coa-com-mock-completo").then((module) => ({
    default: module.COAPage,
  }))
);

// ✅ IoT - Sinóptico
const IotPage = lazy(() =>
  import("@/pages/supervisorio/iot").then((module) => ({
    default: module.IotPage,
  }))
);


// Shared pages are now imported directly from @aupus/shared-pages (see top of file)

const CadastroRegrasLogsPage = lazy(() =>
  import("@/pages/cadastros/regras-logs")
);

const LogsMqttPage = lazy(() =>
  import("@/pages/logs/logs-mqtt")
);

// ✅ Lazy load para Design System Test Page
const DesignSystemTestPage = lazy(() =>
  import("@/pages/DesignSystemTest").then((module) => ({
    default: module.DesignSystemTest,
  }))
);

export const appRoutes = createBrowserRouter([
  // ✅ Rota pública de login
  {
    path: "/login",
    element: <LoginPage />,
  },

  // ✅ Rotas protegidas
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppTemplate />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: (
          <FeatureWrapper feature="Dashboard">
            <DashboardPage />
          </FeatureWrapper>
        ),
      },
      // {
      //   path: "scada",
      //   element: (
      //     <FeatureWrapper feature="SCADA">
      //       <ScadaPage />
      //     </FeatureWrapper>
      //   ),
      // },
      {
        path: "configuracoes/perfil",
        index: true,
        element: (
          <FeatureWrapper feature="Configuracoes">
            <Settings />
          </FeatureWrapper>
        ),
      },
      // {
      //   path: "financeiro/contas-a-pagar",
      //   index: true,
      //   element: (
      //     <FeatureWrapper feature="Financeiro">
      //       <ContasAPagarPage />
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "financeiro/contas-a-receber",
      //   index: true,
      //   element: (
      //     <FeatureWrapper feature="Financeiro">
      //       <ContasAReceberPage />
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "financeiro/cadastrar-despesa",
      //   index: true,
      //   element: (
      //     <FeatureWrapper feature="Financeiro">
      //       <CadastrarDespesaPage />
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "financeiro/cadastrar-receita",
      //   index: true,
      //   element: (
      //     <FeatureWrapper feature="Financeiro">
      //       <CadastrarReceitaPage />
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "financeiro/fluxo-caixa",
      //   index: true,
      //   element: (
      //     <FeatureWrapper feature="Financeiro">
      //       <FluxoDeCaixaPage />
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "financeiro/centros-custo",
      //   index: true,
      //   element: (
      //     <FeatureWrapper feature="Financeiro">
      //       <CentrosCustoPage />
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "supervisorio/cadastro-unidades",
      //   element: (
      //     <FeatureWrapper feature="supervisorio">
      //       <Suspense fallback={<div>Carregando...</div>}>
      //         <CadastroUnidadesPage />
      //       </Suspense>
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "supervisorio/logs-eventos",
      //   element: (
      //     <FeatureWrapper feature="supervisorio">
      //       <Suspense fallback={<div>Carregando...</div>}>
      //         <LogsEventosPage />
      //       </Suspense>
      //     </FeatureWrapper>
      //   ),
      // },
      {
        path: "supervisorio/sinoptico",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <SelecionarUnidadePage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      {
        path: "supervisorio/sinoptico-ativo",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <SelecionarUnidadePage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      {
        path: "supervisorio/sinoptico-ativo/:ativoId",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <SinopticoPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      // ✅ Sinóptico V2 (Refatorado) - Nova arquitetura modular
      // {
      //   path: "supervisorio/sinoptico-v2",
      //   element: (
      //     <FeatureWrapper feature="supervisorio">
      //       <Suspense fallback={<div>Carregando...</div>}>
      //         <SinopticoV2Page />
      //       </Suspense>
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "supervisorio/sinoptico-v2/:ativoId",
      //   element: (
      //     <FeatureWrapper feature="supervisorio">
      //       <Suspense fallback={<div>Carregando...</div>}>
      //         <SinopticoV2Page />
      //       </Suspense>
      //     </FeatureWrapper>
      //   ),
      // },
      // ✅ IoT - Sinóptico
      {
        path: "supervisorio/iot",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <IotPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      // {
      //   path: "supervisorio/demo-mqtt",
      //   element: (
      //     <FeatureWrapper feature="supervisorio">
      //       <Suspense fallback={<div>Carregando...</div>}>
      //         <DemoMqttPage />
      //       </Suspense>
      //     </FeatureWrapper>
      //   ),
      // },
      // {
      //   path: "coa-antigo",
      //   element: (
      //     <FeatureWrapper feature="Dashboard">
      //       <Suspense fallback={<div>Carregando...</div>}>
      //         <CoaAntigoPage />
      //       </Suspense>
      //     </FeatureWrapper>
      //   ),
      // },
      // ✅ Rotas de Cadastros
      {
        path: "cadastros/usuarios",
        element: (
          <FeatureWrapper feature="Usuarios">
            <UsuariosPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "cadastros/plantas",
        element: (
          <FeatureWrapper feature="Plantas">
            <PlantasPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "cadastros/unidades",
        element: (
          <FeatureWrapper feature="UnidadesConsumidoras">
            <UnidadesPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "cadastros/equipamentos",
        element: (
          <FeatureWrapper feature="Equipamentos">
            <EquipamentosPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "cadastros/concessionarias",
        element: (
          <FeatureWrapper feature="Concessionarias">
            <ConcessionariasPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "cadastros/regras-logs",
        element: (
          <Suspense fallback={<div>Carregando...</div>}>
            <CadastroRegrasLogsPage />
          </Suspense>
        ),
      },
      {
        path: "logs/logs-mqtt",
        element: (
          <Suspense fallback={<div>Carregando...</div>}>
            <LogsMqttPage />
          </Suspense>
        ),
      },
      // ✅ Design System Test Page (Para visualizar componentes minimalistas)
      // {
      //   path: "design-system-test",
      //   element: (
      //     <Suspense fallback={<div>Carregando...</div>}>
      //       <DesignSystemTestPage />
      //     </Suspense>
      //   ),
      // },
    ],
  },

  // ✅ Rota 404 - Redireciona para login
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
]);
