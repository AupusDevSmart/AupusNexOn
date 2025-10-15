// src/hooks/useGenericModal.ts

import { useState } from 'react';
import { ModalState, ModalMode } from '@/types/base';

interface UseGenericModalReturn<T> {
  modalState: ModalState<T>;
  openModal: (mode: ModalMode, entity?: T) => void;
  closeModal: () => void;
  setModalEntity: (entity: T | undefined) => void;
}

/**
 * Generic hook for managing modal state
 * Handles open/close state, mode (create/edit/view), and entity data
 */
export function useGenericModal<T = any>(): UseGenericModalReturn<T> {
  const [modalState, setModalState] = useState<ModalState<T>>({
    isOpen: false,
    mode: 'create',
    entity: undefined,
  });

  const openModal = (mode: ModalMode, entity?: T) => {
    setModalState({
      isOpen: true,
      mode,
      entity,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      mode: 'create',
      entity: undefined,
    });
  };

  const setModalEntity = (entity: T | undefined) => {
    setModalState((prev) => ({
      ...prev,
      entity,
    }));
  };

  return {
    modalState,
    openModal,
    closeModal,
    setModalEntity,
  };
}
