import React, { createContext, useContext } from 'react';
import type { AxiosInstance } from 'axios';
import type { SharedHooks, SharedStores } from '../types/contracts';

interface SharedPagesContextValue {
  httpClient: AxiosInstance;
  hooks: SharedHooks;
  stores: SharedStores;
}

const SharedPagesContext = createContext<SharedPagesContextValue | null>(null);

export interface SharedPagesProviderProps {
  httpClient: AxiosInstance;
  hooks: SharedHooks;
  stores: SharedStores;
  children: React.ReactNode;
}

export function SharedPagesProvider({
  httpClient,
  hooks,
  stores,
  children,
}: SharedPagesProviderProps) {
  return (
    <SharedPagesContext.Provider value={{ httpClient, hooks, stores }}>
      {children}
    </SharedPagesContext.Provider>
  );
}

export function useSharedPages(): SharedPagesContextValue {
  const context = useContext(SharedPagesContext);
  if (!context) {
    throw new Error(
      'useSharedPages deve ser usado dentro de <SharedPagesProvider>. ' +
      'Envolva sua aplicacao com o provider antes de usar paginas do nucleo.'
    );
  }
  return context;
}
