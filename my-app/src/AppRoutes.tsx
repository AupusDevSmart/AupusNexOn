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
import { UsinasPage } from "@/pages/usinas";
import { createBrowserRouter } from "react-router-dom";

// Lazy load para evitar problemas de import
import { lazy, Suspense } from "react";

const COAPage = lazy(() =>
  import("@/pages/supervisorio/coa").then((module) => ({
    default: module.COAPage,
  }))
);

const CadastroUnidadesPage = lazy(() =>
  import("@/pages/supervisorio/cadastro-unidades").then((module) => ({
    default: module.CadastroUnidadesPage,
  }))
);

// ✅ CORRIGIDO: Lazy load para Logs de Eventos (caminho correto)
const LogsEventosPage = lazy(() =>
  import("@/pages/logs-eventos").then((module) => ({
    default: module.LogsEventosPage,
  }))
);

// ✅ CORRIGIDO: Lazy load para Sinóptico do Ativo (caminho correto)
const SinopticoAtivoPage = lazy(() =>
  import("@/pages/supervisorio/sinoptico-ativo").then((module) => ({
    default: module.SinopticoAtivoPage,
  }))
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
            <UsinasPage />
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
        path: "supervisorio/coa",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <COAPage />
            </Suspense>
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
      // ✅ ROTA: Logs de eventos
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
      // ✅ ROTA: Sinóptico do ativo
      {
        path: "supervisorio/sinoptico-ativo/:ativoId",
        element: (
          <FeatureWrapper feature="supervisorio">
            <Suspense fallback={<div>Carregando...</div>}>
              <SinopticoAtivoPage />
            </Suspense>
          </FeatureWrapper>
        ),
      },
    ],
  },
]);
