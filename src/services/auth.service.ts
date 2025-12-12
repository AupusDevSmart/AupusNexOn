import api from '@/config/api';
import {
  LoginDto,
  AuthResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from '@/types/dtos/auth-dto';
import { UsuarioDTO } from '@/types/dtos/usuarios-dto';

/**
 * Chaves de armazenamento no localStorage
 * ✅ Detecta contexto: usa chaves do Service quando rodando nele
 */
const isRunningInService = () => !!document.querySelector('[data-app="aupus-service"]');

const AUTH_TOKEN_KEY = isRunningInService() ? 'service_authToken' : 'authToken';
const REFRESH_TOKEN_KEY = isRunningInService() ? 'service_refreshToken' : 'refreshToken';

/**
 * Serviço de autenticação do frontend
 * Gerencia login, logout, refresh token e armazenamento de tokens
 */
export const AuthService = {
  /**
   * Realiza login no sistema
   * @param credentials Credenciais (email e senha)
   * @returns Dados de autenticação com tokens e usuário
   */
  async login(credentials: LoginDto): Promise<AuthResponseDto> {
    try {
      const response = await api.post<any>('/auth/login', credentials);

      // O backend retorna { success: true, data: {...}, meta: {...} }
      // Extrair os dados do wrapper
      const authData = response.data?.data || response.data;

      // Salva tokens no localStorage
      this.setTokens(authData.access_token, authData.refresh_token);

      return authData;
    } catch (error: any) {
      console.error('❌ [AUTH SERVICE] Erro ao fazer login:', error);
      throw error;
    }
  },

  /**
   * Renova o access token usando refresh token
   * @returns Novos tokens
   */
  async refreshToken(): Promise<RefreshTokenResponseDto> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('Refresh token não encontrado');
    }

    try {
      const response = await api.post<any>('/auth/refresh', {
        refresh_token: refreshToken,
      });

      // O backend retorna { success: true, data: {...}, meta: {...} }
      const tokenData = response.data?.data || response.data;

      // Salva novos tokens
      this.setTokens(tokenData.access_token, tokenData.refresh_token);

      return tokenData;
    } catch (error: any) {
      console.error('❌ [AUTH SERVICE] Erro ao renovar token:', error);
      // Se falhar, limpa tokens (força novo login)
      this.clearTokens();
      throw error;
    }
  },

  /**
   * Realiza logout do sistema
   * Remove tokens e notifica o backend (opcional)
   */
  async logout(): Promise<void> {
    try {
      // Tenta notificar o backend sobre o logout
      await api.post('/auth/logout');
    } catch (error) {
      // Ignora erros do backend no logout
      console.error('⚠️ [AUTH SERVICE] Erro ao fazer logout no backend:', error);
    } finally {
      // Sempre limpa os tokens localmente
      this.clearTokens();
    }
  },

  /**
   * Busca dados do usuário atual autenticado
   * @returns Dados do usuário
   */
  async getCurrentUser(): Promise<UsuarioDTO> {
    try {
      const response = await api.get<any>('/auth/me');
      // O backend retorna { success: true, data: {...}, meta: {...} }
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('❌ [AUTH SERVICE] Erro ao buscar usuário atual:', error);
      throw error;
    }
  },

  /**
   * Verifica se o usuário está autenticado
   * @returns true se possui token válido
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  /**
   * Obtém o access token do localStorage
   * @returns Access token ou null
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  /**
   * Obtém o refresh token do localStorage
   * @returns Refresh token ou null
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Salva os tokens no localStorage
   * @param accessToken Access token JWT
   * @param refreshToken Refresh token JWT
   */
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  /**
   * Remove os tokens do localStorage
   */
  clearTokens(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export default AuthService;
