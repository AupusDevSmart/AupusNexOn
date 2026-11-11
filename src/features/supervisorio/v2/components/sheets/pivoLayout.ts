import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Layout da aba Operação do pivô — três jeitos de editar a irrigação com o pivô ligado, para
 * testar em campo (NEXON-98). Preferência deste navegador; a escolha fica na aba Configuração.
 *
 *  - modal:   um botão só ("Desligar ou modificar") que abre o Planejamento de irrigação.
 *  - painel:  o formulário do planejamento fica aberto na própria ficha enquanto o pivô gira.
 *  - atalhos: a irrigação atual vira botões de um toque (direção, água, percentímetro).
 */
export type PivoLayout = 'modal' | 'painel' | 'atalhos';

export const PIVO_LAYOUTS: Array<{ v: PivoLayout; label: string; sub: string }> = [
  { v: 'modal', label: 'Modal', sub: 'Um botão abre o Planejamento de irrigação para desligar ou modificar.' },
  { v: 'painel', label: 'Painel', sub: 'Com o pivô ligado, o planejamento fica aberto na ficha para editar e enviar.' },
  { v: 'atalhos', label: 'Atalhos', sub: 'Com o pivô ligado, direção, água e percentímetro mudam com um toque.' },
];

const ehLayout = (v: unknown): v is PivoLayout => v === 'modal' || v === 'painel' || v === 'atalhos';

export const usePivoLayout = create(
  persist<{ layout: PivoLayout; setLayout: (l: PivoLayout) => void }>(
    (set) => ({ layout: 'modal', setLayout: (layout) => set({ layout }) }),
    {
      name: 'nexon:pivo:layout',
      storage: createJSONStorage(() => localStorage),
      // Valor desconhecido (versão antiga ou storage editado) cai no padrão.
      merge: (salvo, atual) => {
        const l = (salvo as { layout?: unknown } | null)?.layout;
        return { ...atual, layout: ehLayout(l) ? l : atual.layout };
      },
    },
  ),
);
