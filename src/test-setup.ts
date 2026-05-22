/**
 * Setup global do Vitest — roda antes de cada arquivo de teste.
 *
 * - Importa matchers do jest-dom (toBeInTheDocument, toBeVisible, etc.)
 * - Inicia MSW pra interceptar requests do axios/fetch durante os testes.
 * - Reseta handlers MSW entre testes pra evitar vazamento de estado.
 */
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './test-mocks/server';

// MSW: liga antes de todos os testes, reseta entre, desliga no final.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
