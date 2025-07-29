import axios from 'axios';
import { env } from '@/config/env';
import { useUserStore } from '@/store/useUserStore';
import qs from 'qs';

const { clearUser } = useUserStore.getState();

export const api = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true,
  withXSRFToken: true,

  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('authToken')}`,
  },
});

axios.defaults.paramsSerializer = params => {
  return qs.stringify(params, { arrayFormat: 'repeat' });
};

export function configureAxios() {
  const token = localStorage.getItem('authToken');
  if (token) {
    api.defaults.headers['Authorization'] = `Bearer ${token}`;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearUser();
      localStorage.removeItem('authToken');

      const from = window.location.pathname;
      if (from !== 'login') {
        window.location.href = `/login?redirectTo=${from}`;
      }
    }

    return Promise.reject(error);
  },
);