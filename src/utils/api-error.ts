/**
 * Normaliza erro do axios em mensagem legivel para toast.
 *
 * Tratamentos cobertos:
 * - `response.data.message` como string OU array (NestJS ValidationPipe
 *   retorna `string[]` quando varias regras falham — uniao com "; ").
 * - `response.data.message` como objeto (raro mas possivel).
 * - Network error (sem `response`).
 * - Status code sem `data.message` (usa statusText).
 * - Erro fora do axios (Error generico ou throw de string).
 */
export function formatApiError(err: unknown): string {
  if (!err) return 'Erro desconhecido';

  // Erro do axios com response do backend
  const response = (err as any)?.response;
  if (response) {
    const data = response.data;

    // NestJS padrao: { message: string | string[], error, statusCode }
    if (data?.message) {
      if (Array.isArray(data.message)) {
        return data.message.filter(Boolean).join('; ');
      }
      if (typeof data.message === 'string') return data.message;
      if (typeof data.message === 'object') {
        try {
          return JSON.stringify(data.message);
        } catch {
          return String(data.message);
        }
      }
    }

    // Sem message — usa error ou statusText
    if (typeof data?.error === 'string') return data.error;
    if (response.statusText) return `${response.status} ${response.statusText}`;
    return `HTTP ${response.status}`;
  }

  // Network error / timeout — axios sem response
  if ((err as any)?.message === 'Network Error') {
    return 'Sem conexao com o servidor';
  }

  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Erro desconhecido';
}
