/** Mensagem de erro da API (`{ error: { message } }` ou `{ message }`) ou o texto padrão. */
export function mensagemErro(e: unknown, padrao: string): string {
  const corpo = (e as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } } | null)?.response?.data;
  const m = corpo?.error?.message ?? corpo?.message;
  return typeof m === 'string' && m.trim() ? m : padrao;
}
