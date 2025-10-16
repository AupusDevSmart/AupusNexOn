import { FeatureWrapper } from "@/components/common/FeatureWrapper";
import { AppTemplate } from "@/pages/AppTemplate";
import { CadastrarDespesaPage } from "@/pages/cadastrar-despesa";
import { CadastrarReceitaPage } from "@/pages/cadastrar-receita";
import { CentrosCustoPage } from "@/pages/centros-custo";
import { ContasAPagarPage } from "@/pages/contas-a-pagar";
import { ContasAReceberPage } from "@/pages/contas-a-receber";
import { FluxoDeCaixaPage } from "@/pages/fluxo-de-caixa";
import ScadaPage from "@/pages/scada";
import { Settings } from "@/pages/settings";
import { createBrowserRouter } from "react-router-dom";
import { DashboardPage } from "./pages/dashboard";

// Lazy load para evitar problemas de import
import { lazy, Suspense } from "react";

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

// ✅ Lazy load para Cadastros
const CadastroUsuariosPage = lazy(() =>
  import("@/pages/cadastros/usuarios")
);

const CadastroPlantasPage = lazy(() =>
  import("@/pages/cadastros/plantas")
);

const CadastroUnidadesPageWrapper = lazy(() =>
  import("@/pages/cadastros/unidades")
);

export const appRoutes = createBrowserRouter([
  {
    path: "/",
    element: <AppTemplate />,
    children: [
      {
        path: "dashboard",
        element: (
          <FeatureWrapper feature="Dashboard">
            <DashboardPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "scada",
        element: (
          <FeatureWrapper feature="SCADA">
            <ScadaPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "configuracoes/perfil",
        index: true,
        element: (
          <FeatureWrapper feature="Configuracoes">
            <Settings />
          </FeatureWrapper>
        ),
      },
      {
        path: "financeiro/contas-a-pagar",
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <ContasAPagarPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "financeiro/contas-a-receber",
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <ContasAReceberPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "financeiro/cadastrar-despesa",
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <CadastrarDespesaPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "financeiro/cadastrar-receita",
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <CadastrarReceitaPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "financeiro/fluxo-caixa",
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <FluxoDeCaixaPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "financeiro/centros-custo",
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <CentrosCustoPage />
          </FeatureWrapper>
        ),
      },
      {
        path: "supervisorio/cadastro-unidades",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <CadastroUnidadesPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      {
        path: "supervisorio/logs-eventos",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <LogsEventosPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      {
        path: "supervisorio/sinoptico",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <SinopticoPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      {
        path: "supervisorio/demo-mqtt",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <DemoMqttPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      // ✅ Rotas de Cadastros
      {
        path: "cadastros/usuarios",
        element: (
          <FeatureWrapper feature="Usuarios">
            <Suspense fallback={<div>Carregando...</div>}>
              <CadastroUsuariosPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      {
        path: "cadastros/plantas",
        element: (
          <FeatureWrapper feature="Plantas">
            <Suspense fallback={<div>Carregando...</div>}>
              <CadastroPlantasPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      {
        path: "cadastros/unidades",
        element: (
          <FeatureWrapper feature="UnidadesConsumidoras">
            <Suspense fallback={<div>Carregando...</div>}>
              <CadastroUnidadesPageWrapper />
            </Suspense>
          </FeatureWrapper>
        ),
      },
      // ✅ CORRIGIDO: Rota para Editor de Diagrama com lazy loading correto
    ],
  },
]);
