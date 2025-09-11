// IMPORTANTE: Este arquivo deve ser criado em:
// src/features/supervisorio/hooks/useHistory.ts

import { useCallback, useRef, useState } from "react";

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UseHistoryReturn<T> {
  state: T;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  setState: (newState: T, shouldAddToHistory?: boolean) => void;
  clearHistory: () => void;
}

/**
 * Hook para gerenciar histórico de estados com funcionalidade undo/redo
 * @param initialState Estado inicial
 * @param maxHistorySize Tamanho máximo do histórico (padrão: 50)
 */
export function useHistory<T>(
  initialState: T,
  maxHistorySize: number = 50
): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Referência para evitar adicionar o mesmo estado consecutivo
  const lastState = useRef<T>(initialState);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory((prev) => {
      const newPast = [...prev.past];
      const previous = newPast.pop()!;

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory((prev) => {
      const newFuture = [...prev.future];
      const next = newFuture.shift()!;

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, [canRedo]);

  const setState = useCallback(
    (newState: T, shouldAddToHistory: boolean = true) => {
      // Evita adicionar estados duplicados consecutivos
      if (JSON.stringify(newState) === JSON.stringify(lastState.current)) {
        return;
      }

      lastState.current = newState;

      if (!shouldAddToHistory) {
        setHistory((prev) => ({
          ...prev,
          present: newState,
        }));
        return;
      }

      setHistory((prev) => {
        const newPast = [...prev.past, prev.present];

        // Limita o tamanho do histórico
        if (newPast.length > maxHistorySize) {
          newPast.shift();
        }

        return {
          past: newPast,
          present: newState,
          future: [], // Limpa o futuro quando um novo estado é definido
        };
      });
    },
    [maxHistorySize]
  );

  const clearHistory = useCallback(() => {
    setHistory((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }));
  }, []);

  return {
    state: history.present,
    canUndo,
    canRedo,
    undo,
    redo,
    setState,
    clearHistory,
  };
}
