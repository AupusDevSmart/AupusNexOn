import axios, { AxiosError, AxiosResponse } from 'axios';
import { env } from '@/config/env';

// Configuração base da API
const api = axios.create({
  baseURL: env.VITE_WEBSOCKET_URL,
  timeout: 30000, // Aumentar timeout para 30s
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptador de requisições (para adicionar token de auth se necessário)
api.interceptors.request.use(
  (config) => {
    // Log apenas em desenvolvimento
    if (import.meta.env.DEV) {
      console.log(`🔄 ${config.method?.toUpperCase()} ${config.url}`);
    }
    // Aqui você pode adicionar token de autenticação
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    console.error('❌ Erro na configuração da requisição:', error);
    return Promise.reject(error);
  }
);

// Interceptador de respostas para tratamento de erros
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ Erro na requisição:', error);
    let errorMessage = 'Erro inesperado. Tente novamente.';

    if (error.response) {
      // Erro com resposta do servidor
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 400:
          errorMessage = data?.message || 'Dados inválidos. Verifique as informações.';
          break;
        case 401:
          errorMessage = 'Acesso não autorizado. Faça login novamente.';
          // Redirecionar para login se necessário
          break;
        case 403:
          errorMessage = 'Você não tem permissão para esta ação.';
          break;
        case 404:
          errorMessage = 'Recurso não encontrado.';
          break;
        case 422:
          errorMessage = data?.message || 'Dados inválidos.';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
          break;
        default:
          errorMessage = data?.message || `Erro ${status}. Tente novamente.`;
      }
    } else if (error.request) {
      // Erro de rede/conexão
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout: A API demorou muito para responder. Verifique se a API está rodando.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Conexão recusada: Verifique se a API está rodando em http://localhost:3001';
      } else {
        errorMessage = 'Erro de conexão. Verifique sua internet e se a API está rodando.';
      }
    } else {
      // Outros erros
      errorMessage = error.message || 'Erro inesperado. Tente novamente.';
    }

    // Exibir erro via alert
    alert(errorMessage);

    return Promise.reject(error);
  }
);

export default api;