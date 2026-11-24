import type { Usuario } from '../../types';

/** Identifica se o usuario tem role "operador" considerando os varios formatos do backend. */
export function isOperador(usuario: Usuario | null | undefined): boolean {
  if (!usuario) return false;
  if (usuario.role_details?.name === 'operador') return true;
  if (Array.isArray(usuario.roles)) {
    return (usuario.roles as unknown[]).some((r) =>
      typeof r === 'string' ? r === 'operador' : (r as { name?: string } | null)?.name === 'operador',
    );
  }
  return (usuario as { role?: unknown }).role === 'operador';
}
