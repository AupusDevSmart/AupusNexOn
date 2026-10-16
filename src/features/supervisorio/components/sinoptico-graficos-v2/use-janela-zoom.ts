import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dominio } from './dados';

interface Janela {
  inicio: number;
  fim: number;
}

export interface JanelaZoom {
  /** Índices visíveis (inclusive) sobre os pontos. */
  inicio: number;
  fim: number;
  total: number;
  zoomAtivo: boolean;
  /** Domínio X do gráfico principal: a janela quando há zoom, senão o eixo base. */
  xDomain?: Dominio;
  /** Posição (0 a 1) de cada ponto no eixo da visão geral — entrada do BrushOverlay. */
  fracoes: number[];
  definir: (inicio: number, fim: number) => void;
  resetar: () => void;
  /** Zoom pela roda: deltaY > 0 afasta; fracaoCursor (0 a 1) é o ponto que fica parado. */
  rolar: (deltaY: number, fracaoCursor: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Recorta a janela quando a série encolhe; janela que cobre tudo vira `null`.
 * Janela de um ponto só (inicio === fim) é mantida: é o clique inicial do
 * BrushOverlay, que a desfaz sozinho se o ponteiro soltar sem arrastar.
 */
function recortar(janela: Janela | null, total: number): Janela | null {
  if (!janela || total < 3) return null;
  const fim = clamp(janela.fim, 0, total - 1);
  const inicio = clamp(janela.inicio, 0, fim);
  if (inicio === 0 && fim === total - 1) return null;
  return inicio === janela.inicio && fim === janela.fim ? janela : { inicio, fim };
}

/**
 * Janela de zoom em índices sobre uma série ordenada no tempo. `null` = tudo
 * visível. Quando a série cresce (refetch ao vivo) a janela fica onde está;
 * `chave` mudando (período, medidor) volta ao total.
 */
export function useJanelaZoom<T extends { date: Date }>(
  pontos: T[],
  dominioBase: Dominio | undefined,
  chave: string,
): JanelaZoom {
  const total = pontos.length;
  const [estado, setEstado] = useState<{ chave: string; janela: Janela | null }>({ chave, janela: null });
  const janelaBruta = estado.chave === chave ? estado.janela : null;
  const janela = useMemo(() => recortar(janelaBruta, total), [janelaBruta, total]);
  const gravar = useCallback((nova: Janela | null) => setEstado({ chave, janela: nova }), [chave]);

  const inicio = janela ? janela.inicio : 0;
  const fim = janela ? janela.fim : Math.max(0, total - 1);

  const xDomain = useMemo<Dominio | undefined>(() => {
    if (!janela) return dominioBase;
    const a = pontos[janela.inicio]?.date;
    const b = pontos[janela.fim]?.date;
    if (!a || !b || a.getTime() >= b.getTime()) return dominioBase;
    return [a, b];
  }, [janela, pontos, dominioBase]);

  const fracoes = useMemo(() => {
    if (total === 0) return [];
    const ini = dominioBase ? dominioBase[0].getTime() : pontos[0].date.getTime();
    const fimEixo = dominioBase ? dominioBase[1].getTime() : pontos[total - 1].date.getTime();
    const extensao = fimEixo - ini;
    if (extensao <= 0) return pontos.map(() => 0);
    return pontos.map((p) => clamp((p.date.getTime() - ini) / extensao, 0, 1));
  }, [pontos, total, dominioBase]);

  const definir = useCallback(
    (a: number, b: number) => {
      if (total < 2) return;
      const inicioNovo = clamp(Math.min(a, b), 0, total - 1);
      const fimNovo = clamp(Math.max(a, b), 0, total - 1);
      gravar(inicioNovo === 0 && fimNovo === total - 1 ? null : { inicio: inicioNovo, fim: fimNovo });
    },
    [total, gravar],
  );

  const resetar = useCallback(() => gravar(null), [gravar]);

  const rolar = useCallback(
    (deltaY: number, fracaoCursor: number) => {
      if (total < 3) return;
      const atual = janela ?? { inicio: 0, fim: total - 1 };
      const largura = atual.fim - atual.inicio;
      const novaLargura = clamp(Math.round(largura * (deltaY < 0 ? 0.8 : 1.25)), 2, total - 1);
      if (novaLargura >= total - 1) {
        gravar(null);
        return;
      }
      const cursor = atual.inicio + fracaoCursor * largura;
      let inicioNovo = Math.round(cursor - fracaoCursor * novaLargura);
      let fimNovo = inicioNovo + novaLargura;
      if (inicioNovo < 0) {
        inicioNovo = 0;
        fimNovo = novaLargura;
      }
      if (fimNovo > total - 1) {
        fimNovo = total - 1;
        inicioNovo = fimNovo - novaLargura;
      }
      gravar({ inicio: Math.max(0, inicioNovo), fim: fimNovo });
    },
    [janela, total, gravar],
  );

  // Janela de um ponto só ainda não é zoom (clique sem arrastar).
  const zoomAtivo = janela !== null && janela.fim > janela.inicio;

  return { inicio, fim, total, zoomAtivo, xDomain, fracoes, definir, resetar, rolar };
}

/**
 * Roda do mouse sobre `el` vira zoom. Listener nativo não-passivo para o
 * `preventDefault` valer (senão a página rola junto). `noCursor` mantém parado
 * o ponto sob o cursor; senão o zoom é pelo centro da janela.
 */
export function useRodaZoom(el: HTMLElement | null, rolar: JanelaZoom['rolar'], noCursor: boolean) {
  useEffect(() => {
    if (!el) return;
    const aoRolar = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      let fracao = 0.5;
      if (noCursor) {
        const r = el.getBoundingClientRect();
        fracao = r.width > 0 ? clamp((e.clientX - r.left) / r.width, 0, 1) : 0.5;
      }
      rolar(e.deltaY, fracao);
    };
    el.addEventListener('wheel', aoRolar, { passive: false });
    return () => el.removeEventListener('wheel', aoRolar);
  }, [el, rolar, noCursor]);
}
