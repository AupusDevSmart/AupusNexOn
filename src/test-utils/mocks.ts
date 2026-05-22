/**
 * Factories de mocks reutilizaveis em testes.
 *
 * `vi.mock` eh hoisted dentro de cada arquivo de teste — nao podemos
 * centralizar o mock aqui. Exportamos a FACTORY do retorno (objeto com
 * os spies), e cada spec chama:
 *
 *   vi.mock('sonner', () => sonnerMockFactory());
 *
 * O retorno tem `vi.fn()`s nominalmente acessiveis pra assertions:
 *
 *   import { toast } from 'sonner';
 *   ...
 *   expect(toast.error).toHaveBeenCalledWith('mensagem esperada');
 */
import { vi } from 'vitest';

/** Mock do `sonner` — toast.error/success/info/warning como vi.fn(). */
export function sonnerMockFactory() {
  return {
    toast: {
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      message: vi.fn(),
      promise: vi.fn(),
      dismiss: vi.fn(),
    },
  };
}

/**
 * Mock simples do useNavigate do react-router-dom — captura chamadas pra
 * verificar redirecionamentos.
 *
 * Uso:
 *   const navigate = navigateMockFactory();
 *   vi.mock('react-router-dom', async () => ({
 *     ...(await vi.importActual('react-router-dom')),
 *     useNavigate: () => navigate,
 *   }));
 *   ...
 *   expect(navigate).toHaveBeenCalledWith('/login');
 */
export function navigateMockFactory() {
  return vi.fn();
}
