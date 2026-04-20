import { env } from '@/config/env';
/**
 * Constrói a URL completa do avatar do usuário
 * @param avatarUrl - URL parcial ou completa do avatar
 * @returns URL completa do avatar ou null se não houver
 */
export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;

  // Se já for uma URL completa, retorna como está
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }

  // Constrói a URL completa baseada no ambiente
  const apiUrl = env.VITE_API_URL;
  const baseUrl = apiUrl.replace(/\/api\/v1$/, '');

  // Garante que não haja barras duplas
  const cleanAvatarUrl = avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;

  // Adiciona o prefixo /api/v1 para rotas de upload
  return `${baseUrl}/api/v1${cleanAvatarUrl}`;
}