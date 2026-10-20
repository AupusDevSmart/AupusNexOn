import axios, { InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { useUserStore } from '@/store/useUserStore';
import { AuthService } from '@/services/auth.service';
import qs from 'qs';
import { lunaLogout } from '@/features/luna-pedidos/luna-api';
import { toast } from 'sonner';

/**
 * 403 no detalhe de planta / instalação / equipamento (NEXON-20): o usuário
 * perdeu o acesso com o app aberto. Avisa uma vez, relê a sessão e volta para a
 * Home. Só o detalhe — 403 de lista ou endpoint auxiliar segue para a tela tratar.
 */
const RE_DETALHE_PROTEGIDO = /^\/?(plantas|unidades|equipamentos)\/(?=[^/?]*\d)[A-Za-z0-9_-]{16,}\/?(\?.*)?$/;
let ultimoAviso403 = 0;

export function ehDetalheProtegido(url?: string): boolean {
  if (!url) return false;
  const caminho = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/v1/, '');
  return RE_DETALHE_PROTEGIDO.test(caminho);
}

function tratarSemAcesso(error: any) {
  const cfg = error?.config;
  const metodo = String(cfg?.method ?? 'get').toLowerCase();
  if (metodo !== 'get' || !ehDetalheProtegido(cfg?.url)) return;
  const agora = Date.now();
  if (agora - ultimoAviso403 < 5000) return;
  ultimoAviso403 = agora;
  toast.error('Você não tem acesso a este recurso');

  const caminho = window.location.pathname;
  if (caminho === '/dashboard' || caminho === '/login' || caminho.startsWith('/cadastros')) return;
  // Relê a sessão (papel / plantas podem ter mudado) e volta para a Home.
  AuthService.getCurrentUser()
    .then((me) => me && useUserStore.getState().setUser(me))
    .catch(() => undefined);
  import('@/AppRoutes')
    .then((m) => m.appRoutes.navigate('/dashboard', { replace: true }))
    .catch(() => {
      window.location.href = '/dashboard';
    });
}

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
          // NEXON-8: sessão do NexON expirada encerra também a do pedido ao Luna.
          lunaLogout();

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

    if (error.response?.status === 403) tratarSemAcesso(error);

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
