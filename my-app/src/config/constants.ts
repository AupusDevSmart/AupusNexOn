import { env } from '@/config/env';

// Vite Environment
export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;

// Development constants
export const isMock = env.VITE_STANDALONE;
export const hasWebVitals = env.VITE_WEB_VITALS;
export const apiUrl = env.VITE_API_URL;

// URLs
// export const sentryDNS = env.VITE_SENTRY_DSN;

export const BASE_URL = isMock ? '' : apiUrl;

// TIMES
export const ONE_MINUTE = 1000 * 60;
export const FIVE_MINUTES = ONE_MINUTE * 5;
export const FIFTEEN_MINUTES = ONE_MINUTE * 15;
export const TWENTY_FOUR_HOURS = ONE_MINUTE * 60 * 24;

export const DEFAULT_DOMAIN = env.VITE_DEFAULT_DOMAIN;