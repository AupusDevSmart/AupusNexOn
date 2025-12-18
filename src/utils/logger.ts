/**
 * Sistema de logging condicional para performance
 * Logs só são executados em desenvolvimento
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  error: (...args: any[]) => {
    if (isDev) {
      console.error(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  // Sempre loga erros críticos mesmo em produção
  critical: (...args: any[]) => {
    console.error('[CRITICAL]', ...args);
  }
};
