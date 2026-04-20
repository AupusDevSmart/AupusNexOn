import axios, { InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { useUserStore } from '@/store/useUserStore';
import { AuthService } from '@/services/auth.service';
import qs from 'qs';

/**
 * Instância configurada do Axios para comunicação com a API
 */
export const api = axios.create({
  baseURL: env.VITE_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  withXSRFToken: true,
});

/**
 * Configuração do serializador de parâmetros
 */
axios.defaults.paramsSerializer = (params) => {
  return qs.stringify(params, { arrayFormat: 'repeat' });
};

/**
 * Flag para controlar se já está fazendo refresh
 * Evita múltiplas tentativas simultâneas
 */
let isRefreshing = false;

/**
 * Fila de requisições que falharam e estão aguardando o refresh
 */
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: any) => void;
}> = [];

/**
 * Processa a fila de requisições após refresh bem-sucedido ou falha
 */
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * Interceptor de REQUEST
 * Adiciona o token de autenticação automaticamente
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = AuthService.getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Interceptor de RESPONSE
 * Trata erro 401 e tenta renovar o token automaticamente
 */
api.interceptors.response.use(
  (response) => {
    // Desempacota resposta padrao da API: { success: true, data: {...}, meta: {...} }
    if (response.data && response.data.success && response.data.data !== undefined) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Se erro 401 e não é tentativa de login ou refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      // Se já está fazendo refresh, adiciona na fila
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Marca que está fazendo refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('🔄 [API INTERCEPTOR] Token expirado, tentando renovar...');

        // Tenta renovar o token
        const { access_token } = await AuthService.refreshToken();

        console.log('✅ [API INTERCEPTOR] Token renovado com sucesso');

        // Processa fila de requisições pendentes
        processQueue(null, access_token);

        // Retenta a requisição original com novo token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('❌ [API INTERCEPTOR NexOn] Falha ao renovar token:', refreshError);

        // Processa fila com erro
        processQueue(refreshError, null);

        // ✅ DETECÇÃO DE CONTEXTO: Verificar se está rodando no Service ou standalone
        // Quando importado no Service, há um FeatureWrapper do Service no DOM
        const isRunningInService = document.querySelector('[data-app="aupus-service"]');

        if (isRunningInService) {
          // Rodando no Service: Deixar o Service lidar com autenticação
          console.warn('⚠️ [API INTERCEPTOR NexOn] Token refresh falhou. Rodando no Service, deixando Service lidar com auth.');
        } else {
          // Rodando standalone: Lidar com autenticação normalmente
          console.error('❌ [API INTERCEPTOR NexOn] Token refresh falhou. Limpando sessão e redirecionando...');

          const { clearUser } = useUserStore.getState();
          clearUser();
          AuthService.clearTokens();

          const currentPath = window.location.pathname;
          if (currentPath !== '/login') {
            window.location.href = `/login?redirectTo=${currentPath}`;
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Outros erros, apenas rejeita
    return Promise.reject(error);
  }
);

/**
 * Função helper para configurar axios manualmente (se necessário)
 * @deprecated Use os interceptors automáticos
 */
export function configureAxios() {
  const token = AuthService.getToken();
  if (token) {
    api.defaults.headers['Authorization'] = `Bearer ${token}`;
  }
}

export default api;
