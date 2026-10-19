import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";

// Estado de tela que sobrevive a sair e voltar para a página: filtros, busca,
// página da tabela, linha expandida, aba aberta. Fica no localStorage do
// navegador (por usuário/navegador), sob o prefixo abaixo.
const PREFIXO = "nexon:tela:";

function ler<T>(chave: string): T | undefined {
  try {
    const bruto = window.localStorage.getItem(PREFIXO + chave);
    return bruto === null ? undefined : (JSON.parse(bruto) as T);
  } catch {
    return undefined;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    if (valor === undefined) window.localStorage.removeItem(PREFIXO + chave);
    else window.localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    /* modo privado / cota cheia: segue sem lembrar */
  }
}

/** Limpa tudo que as telas lembraram (usado no logout). */
export function esquecerEstadosDeTela() {
  try {
    for (const area of [window.localStorage, window.sessionStorage]) {
      const chaves: string[] = [];
      for (let i = 0; i < area.length; i++) {
        const k = area.key(i);
        if (k?.startsWith(PREFIXO)) chaves.push(k);
      }
      chaves.forEach((k) => area.removeItem(k));
    }
  } catch {
    /* ignore */
  }
}

/**
 * useState que lembra o último valor da tela (linha aberta, aba, modo de
 * visualização). Mesma assinatura do useState.
 */
export function useEstadoLembrado<T>(
  chave: string,
  inicial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(() => {
    const salvo = ler<T>(chave);
    if (salvo !== undefined) return salvo;
    return typeof inicial === "function" ? (inicial as () => T)() : inicial;
  });

  useEffect(() => {
    gravar(chave, valor);
  }, [chave, valor]);

  return [valor, setValor];
}

type Primitivo = string | number | boolean | null | undefined;
type Filtros = Record<string, Primitivo>;

function converter(bruto: string, modelo: Primitivo): Primitivo {
  if (typeof modelo === "number") {
    const n = Number(bruto);
    return Number.isFinite(n) ? n : modelo;
  }
  if (typeof modelo === "boolean") return bruto === "true" || bruto === "1";
  return bruto;
}

function vazio(v: Primitivo) {
  return v === undefined || v === null || v === "";
}

/**
 * Filtros de listagem espelhados na URL (`?search=x&page=2`) e lembrados para
 * a próxima visita. A URL manda: link com filtro (`?plantaId=...`) abre já
 * filtrado. Sem nada na URL, volta o que a pessoa deixou da última vez.
 *
 * Só os campos de `inicial` vão para a URL, e só quando diferem do padrão.
 * `naoLembrar` lista campos que entram na URL mas não ficam guardados para a
 * próxima visita (ex.: filtro de contexto vindo de outro link).
 * `sobrepor` vence URL e memória (ex.: filtro passado em `location.state`).
 */
export function useFiltrosNaUrl<T extends { [K in keyof T]: Primitivo }>(
  chave: string,
  inicial: T,
  opcoes: { naoLembrar?: (keyof T)[]; sobrepor?: Partial<T> | null } = {},
): [T, Dispatch<SetStateAction<T>>] {
  const [params, setParams] = useSearchParams();
  const inicialRef = useRef(inicial);
  const naoLembrarRef = useRef(opcoes.naoLembrar ?? []);

  const [filtros, setFiltros] = useState<T>(() => {
    const base = inicialRef.current;
    if (opcoes.sobrepor && Object.keys(opcoes.sobrepor).length > 0) {
      return { ...base, ...opcoes.sobrepor };
    }
    const chaves = Object.keys(base) as (keyof T & string)[];
    const naUrl = chaves.filter((k) => params.has(k));
    if (naUrl.length > 0) {
      const lido = { ...base };
      for (const k of naUrl) {
        (lido as unknown as Filtros)[k] = converter(params.get(k) ?? "", base[k] as Primitivo);
      }
      return lido;
    }
    const salvo = ler<Partial<T>>(chave);
    if (!salvo) return base;
    const restaurado = { ...base };
    for (const k of chaves) {
      if (k in salvo && !naoLembrarRef.current.includes(k)) {
        (restaurado as unknown as Filtros)[k] = salvo[k] as Primitivo;
      }
    }
    return restaurado;
  });

  useEffect(() => {
    const base = inicialRef.current;
    const lembrar: Partial<T> = {};
    for (const k of Object.keys(base) as (keyof T & string)[]) {
      if (!naoLembrarRef.current.includes(k)) lembrar[k] = filtros[k];
    }
    gravar(chave, lembrar);

    setParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        for (const k of Object.keys(base)) {
          const v = (filtros as unknown as Filtros)[k];
          if (vazio(v) || v === (base as unknown as Filtros)[k]) proximo.delete(k);
          else proximo.set(k, String(v));
        }
        return proximo.toString() === atual.toString() ? atual : proximo;
      },
      { replace: true, preventScrollReset: true },
    );
    // setParams muda de identidade a cada navegação; só os filtros importam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, filtros]);

  return [filtros, setFiltros];
}

/**
 * Lembra a rolagem de um container (o <main> do Layout) por rota e devolve a
 * posição ao voltar, esperando o conteúdo carregar até alcançar a altura.
 * Fica no sessionStorage: vale para a aba aberta, não para a próxima sessão.
 */
export function useRolagemLembrada(ref: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation();
  const chave = `${PREFIXO}rolagem:${pathname}`;

  const salvar = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    try {
      window.sessionStorage.setItem(chave, String(Math.round(el.scrollTop)));
    } catch {
      /* ignore */
    }
  }, [chave, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let alvo = 0;
    try {
      alvo = Number(window.sessionStorage.getItem(chave)) || 0;
    } catch {
      /* ignore */
    }

    let restaurando = alvo > 0;
    let quadro = 0;
    const tentar = () => {
      if (!restaurando) return;
      if (el.scrollHeight - el.clientHeight >= alvo) {
        el.scrollTop = alvo;
        restaurando = false;
      }
    };
    // O conteúdo (tabela, linha expandida) chega depois do mount: tenta de
    // novo a cada mudança de tamanho, por até 4 s.
    const observador = new ResizeObserver(() => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(tentar);
    });
    if (restaurando) {
      Array.from(el.children).forEach((c) => observador.observe(c));
      tentar();
    }
    const desistir = window.setTimeout(() => {
      restaurando = false;
      observador.disconnect();
    }, 4000);
    // Rolar com a mão cancela a restauração.
    const parar = () => {
      restaurando = false;
    };
    el.addEventListener("wheel", parar, { passive: true });
    el.addEventListener("touchmove", parar, { passive: true });

    // Grava na hora: no unmount o elemento já saiu da tela e lê 0.
    const aoRolar = () => {
      if (!restaurando) salvar();
    };
    el.addEventListener("scroll", aoRolar, { passive: true });

    return () => {
      window.clearTimeout(desistir);
      cancelAnimationFrame(quadro);
      observador.disconnect();
      el.removeEventListener("wheel", parar);
      el.removeEventListener("touchmove", parar);
      el.removeEventListener("scroll", aoRolar);
    };
  }, [chave, ref, salvar]);
}
