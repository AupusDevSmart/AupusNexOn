import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';

/**
 * Estado de tela na query string (`?aba=cameras&camera=x`): F5, voltar/avançar e link
 * compartilhado abrem a mesma vista. O valor padrão não vai para a URL, valor
 * desconhecido vira o padrão. Nada de segredo/token aqui: a URL vai para histórico,
 * logs e mensagens.
 *
 * `push` cria entrada no histórico (troca de aba, abrir evento/modal); `replace` só
 * reescreve a atual (filtro, data, o que muda a toda hora).
 */
export type Historico = 'push' | 'replace';

/** Como ler/escrever um parâmetro. `escrever` devolve `null` quando o valor é o padrão. */
export interface TipoParam<T> {
  ler: (bruto: string | null) => T;
  escrever: (valor: T) => string | null;
}

/** Texto livre (id de câmera, evento…); vazio = ausente. `valido` filtra o que vem da URL. */
export function paramTexto(valido?: (s: string) => boolean): TipoParam<string | null> {
  return {
    ler: (b) => (b && (!valido || valido(b)) ? b : null),
    escrever: (v) => (v ? v : null),
  };
}

/** Um valor de uma lista fechada; fora dela vale o padrão. */
export function paramOpcao<T extends string>(valores: readonly T[], padrao: T): TipoParam<T> {
  return {
    ler: (b) => (b !== null && (valores as readonly string[]).includes(b) ? (b as T) : padrao),
    escrever: (v) => (v === padrao ? null : v),
  };
}

/** Vários valores de uma lista fechada, separados por vírgula; os desconhecidos caem fora. */
export function paramLista<T extends string>(valores: readonly T[]): TipoParam<T[]> {
  return {
    ler: (b) => (b ? b.split(',').filter((x): x is T => (valores as readonly string[]).includes(x)) : []),
    escrever: (v) => (v.length ? v.join(',') : null),
  };
}

/** Liga/desliga: presente (`=1`) é ligado. */
export function paramFlag(): TipoParam<boolean> {
  return {
    ler: (b) => b === '1' || b === 'true',
    escrever: (v) => (v ? '1' : null),
  };
}

/** Data `YYYY-MM-DD` (ou `YYYY-MM`, `YYYY` com `formato`). Inválida = padrão (ausente). */
export function paramData(formato: 'dia' | 'mes' | 'ano' = 'dia'): TipoParam<string | null> {
  const re = formato === 'dia' ? /^\d{4}-\d{2}-\d{2}$/ : formato === 'mes' ? /^\d{4}-\d{2}$/ : /^\d{4}$/;
  return paramTexto((s) => re.test(s));
}

// Duas escritas no mesmo clique (trocar câmera + fechar evento) precisam se somar: o
// `location` do render ainda é o antigo até o router re-renderizar. Guardamos a última
// busca escrita enquanto o location não muda.
let pendente: { chave: string; caminho: string; busca: string; empurrou: boolean } | null = null;

function baseAtual(loc: Location): { busca: string; noMesmoTurno: boolean } {
  if (pendente && pendente.chave === loc.key && pendente.caminho === loc.pathname) {
    return { busca: pendente.busca, noMesmoTurno: true };
  }
  return { busca: loc.search, noMesmoTurno: false };
}

/**
 * Escreve vários parâmetros de uma vez (`null` remove). Mantém caminho, hash e
 * `location.state`. Use para mudanças que andam juntas (troca de aba limpa os
 * parâmetros da aba anterior).
 */
export function useEscreverParamsUrl() {
  const location = useLocation();
  const navigate = useNavigate();
  const locRef = useRef(location);
  locRef.current = location;

  useEffect(() => {
    if (pendente && pendente.chave !== location.key) pendente = null;
  }, [location.key]);

  return useCallback(
    (mudancas: Record<string, string | null>, historico: Historico = 'replace', opcoes: { limpar?: boolean } = {}) => {
      const loc = locRef.current;
      const { busca, noMesmoTurno } = baseAtual(loc);
      const antes = new URLSearchParams(busca);
      const depois = opcoes.limpar ? new URLSearchParams() : new URLSearchParams(antes);
      for (const [k, v] of Object.entries(mudancas)) {
        if (v === null || v === '') depois.delete(k);
        else depois.set(k, v);
      }
      depois.sort();
      antes.sort();
      if (depois.toString() === antes.toString()) return;
      const nova = depois.toString() ? `?${depois.toString()}` : '';
      // Já criou entrada neste mesmo turno: as próximas escritas só completam a mesma.
      const empurrar = historico === 'push' && !(noMesmoTurno && pendente?.empurrou);
      navigate(
        { pathname: loc.pathname, search: nova, hash: loc.hash },
        { replace: !empurrar, state: loc.state, preventScrollReset: true },
      );
      pendente = {
        chave: loc.key,
        caminho: loc.pathname,
        busca: nova,
        empurrou: empurrar || (noMesmoTurno && !!pendente?.empurrou),
      };
    },
    [navigate],
  );
}

/**
 * useState espelhado num parâmetro da URL. `tipo` deve ser estável (fora do componente
 * ou em useMemo). `historico` é o padrão do setter e pode ser trocado por chamada.
 */
export function useParamUrl<T>(
  nome: string,
  tipo: TipoParam<T>,
  historico: Historico = 'replace',
): [T, (valor: T, opcoes?: { historico?: Historico }) => void] {
  const { search } = useLocation();
  const bruto = useMemo(() => new URLSearchParams(search).get(nome), [search, nome]);
  const valor = useMemo(() => tipo.ler(bruto), [tipo, bruto]);
  const escrever = useEscreverParamsUrl();
  const definir = useCallback(
    (v: T, opcoes?: { historico?: Historico }) => escrever({ [nome]: tipo.escrever(v) }, opcoes?.historico ?? historico),
    [escrever, nome, tipo, historico],
  );
  return [valor, definir];
}
