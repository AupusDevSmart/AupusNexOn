import { ConcessionariaDTO } from '@/types/dtos/concessionaria-dto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ConcessionariaStoreState = {
  concessionarias: ConcessionariaDTO[] | null;
  setConcessionarias: (newConcessionarias: ConcessionariaDTO[]) => void;
  updateConcessionaria: (partialConcessionaria: Partial<ConcessionariaDTO>) => void;
  clearConcessionarias: () => void;

  concessionariaAtual: ConcessionariaDTO | null;
  setConcessionariaAtual: (concessionariaId: string) => void;
  clearConcessionaria: () => void;

  selectedConcessionarias: ConcessionariaDTO[];
  toggleConcessionaria: (item: ConcessionariaDTO) => void;
  setSelectAllConcessionarias: (selectAll: boolean) => void;
  selectAllConcessionarias: boolean;
};

export const useConcessionariasStore = create(
  persist<ConcessionariaStoreState>(
    (set, get) => ({
      concessionarias: null,
      setConcessionarias: (newConcessionarias: ConcessionariaDTO[]) =>
        set({ concessionarias: newConcessionarias }),

      updateConcessionaria: (partialConcessionaria: Partial<ConcessionariaDTO>) =>
        set((state) => ({
          concessionarias: state.concessionarias?.map((org) =>
            org.id === partialConcessionaria.id
              ? { ...org, ...partialConcessionaria }
              : org,
          ) ?? null,
        })),

      clearConcessionarias: () => set({ concessionarias: null }),

      concessionariaAtual: null,
      setConcessionariaAtual: (concessionariaId: string) => {
        const concessionaria = get().concessionarias?.find(
          (org) => org.id === concessionariaId,
        );
        if (concessionaria) {
          set({
            concessionariaAtual: concessionaria,
          });
        }
      },

      clearConcessionaria: () => set({ concessionariaAtual: null }),

      selectedConcessionarias: [],
      toggleConcessionaria: (item: ConcessionariaDTO) => {
        set((state) => {
          const exists = state.selectedConcessionarias.find((c) => c.id === item.id);
          const updated = exists
            ? state.selectedConcessionarias.filter((c) => c.id !== item.id)
            : [...state.selectedConcessionarias, item];
          return {
            selectedConcessionarias: updated,
            selectAllConcessionarias: updated.length === state.concessionarias?.length,
          };
        });
      },
      setSelectAllConcessionarias: (selectAll: boolean) => {
        set((state) => ({
          selectAllConcessionarias: selectAll,
          selectedConcessionarias: selectAll && state.concessionarias
            ? state.concessionarias
            : state.selectedConcessionarias.length === state.concessionarias?.length
            ? []
            : state.selectedConcessionarias,
        }));
      },
      selectAllConcessionarias: true,
    }),
    {
      name: 'concessionaria-storage',
      version: 3,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);