import { Navigate, createBrowserRouter } from 'react-router-dom';
// import { Login } from './pages/login';
import { AppTemplate } from './pages/AppTemplate';
import { FeatureWrapper } from './components/common/FeatureWrapper';
import { DefaultRedirect } from './components/common/default-redirect';
import { DashboardPage } from './pages/dashboard'; // Importando o novo componente
import { Settings } from './pages/settings';
import { ContasAPagarPage } from './pages/contas-a-pagar';
import { ContasAReceberPage } from './pages/contas-a-receber';
import { CadastrarDespesaPage } from './pages/cadastrar-despesa';
import { CadastrarReceitaPage } from './pages/cadastrar-receita';
import { FluxoDeCaixaPage } from './pages/fluxo-de-caixa'
import { CentrosCustoPage } from './pages/centros-custo'
import { UsinasPage } from './pages/usinas';


export const appRoutes = createBrowserRouter([
//   {
//     path: '/login',
//     element: <Login />,
//   },
//   {
//     path: '/reset-password',
//     element: <ResetPassword />,
//   },
  {
    path: '/',
    element: <AppTemplate />,
    children: [
      // {
      //   index: true,
      //   element: <DefaultRedirect />,
      // },
      {
        path: 'dashboard',
        element: (
          <FeatureWrapper feature="Dashboard">
            <UsinasPage />
          </FeatureWrapper>
        ),
      },
      {
        path: 'configuracoes/perfil',
        index: true,
        element: (
          <FeatureWrapper feature="Configuracoes">
            <Settings />
          </FeatureWrapper>
        )
      },
      {
        path: 'financeiro/contas-a-pagar',
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <ContasAPagarPage />
          </FeatureWrapper>
        )
      },
      {
        path: 'financeiro/contas-a-receber',
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <ContasAReceberPage />
          </FeatureWrapper>
        )
      },
      {
        path: 'financeiro/cadastrar-despesa',
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <CadastrarDespesaPage />
          </FeatureWrapper>
        )
      },
      {
        path: 'financeiro/cadastrar-receita',
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <CadastrarReceitaPage />
          </FeatureWrapper>
        )
      },
      {
        path: 'financeiro/fluxo-caixa',
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <FluxoDeCaixaPage />
          </FeatureWrapper>
        )
      },
      {
        path: 'financeiro/centros-custo',
        index: true,
        element: (
          <FeatureWrapper feature="Financeiro">
            <CentrosCustoPage />
          </FeatureWrapper>
        )
      },
    ],
  },
]);