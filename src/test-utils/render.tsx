/**
 * Helper de render pra componentes que dependem de providers globais
 * (React Query, React Router).
 *
 * Uso minimo:
 *   renderWithProviders(<MeuComponente />);
 *
 * Com rota especifica:
 *   renderWithProviders(<MeuComponente />, { initialRoute: '/foo' });
 *
 * Sem QueryClient/Router (componente puro):
 *   renderWithProviders(<MeuComponente />, { withQueryClient: false, withRouter: false });
 *
 * Cada chamada cria um QueryClient novo (defaults: retry off, gcTime 0)
 * pra isolar testes entre si.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RenderOptions, render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

interface ProvidersOptions {
  /** Wrap em <MemoryRouter>. Default true. */
  withRouter?: boolean;
  /** Rota inicial quando withRouter=true. Default "/". */
  initialRoute?: string;
  /** Wrap em <QueryClientProvider>. Default true. */
  withQueryClient?: boolean;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function AllProviders({
  children,
  withRouter = true,
  initialRoute = '/',
  withQueryClient = true,
}: { children: ReactNode } & ProvidersOptions) {
  let content: ReactNode = children;

  if (withQueryClient) {
    const client = makeQueryClient();
    content = <QueryClientProvider client={client}>{content}</QueryClientProvider>;
  }

  if (withRouter) {
    content = <MemoryRouter initialEntries={[initialRoute]}>{content}</MemoryRouter>;
  }

  return <>{content}</>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProvidersOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { withRouter, initialRoute, withQueryClient, ...renderOpts } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders
        withRouter={withRouter}
        initialRoute={initialRoute}
        withQueryClient={withQueryClient}
      >
        {children}
      </AllProviders>
    ),
    ...renderOpts,
  });
}
