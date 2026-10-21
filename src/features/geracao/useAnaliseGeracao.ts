import { useCallback, useEffect, useRef, useState } from 'react';
import { geracaoApi, type AnaliseGeracao, type PeriodoAnalise } from './api';

/**
 * Estado da análise de geração (NEXON-16) de uma unidade: período, data de referência,
 * carregamento com "só a última resposta vale" e refresh de 5 min com hoje na tela.
 * Saiu do componente da análise para o cartão Energia (NEXON-37).
 */

export const hojeSP = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const dataBr = (d: string) => d.split('-').reverse().join('/');

export function rotuloReferencia(a: Pick<AnaliseGeracao, 'periodo' | 'inicio' | 'fim' | 'referencia'>): string {
  if (a.periodo === 'dia') return dataBr(a.referencia);
  if (a.periodo === 'semana') return `${dataBr(a.inicio).slice(0, 5)} – ${dataBr(a.fim)}`;
  if (a.periodo === 'total') return 'Desde o início';
  const [y, m] = a.inicio.split('-').map(Number);
  if (a.periodo === 'mes') {
    const s = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return String(y);
}

function mensagemErro(e: unknown): string {
  const msg = (e as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof msg === 'string' && msg ? msg : 'Não foi possível carregar a análise de geração.';
}

const status = (e: unknown) => (e as { response?: { status?: number } } | null)?.response?.status;

export function useAnaliseGeracao(unidadeId: string) {
  // Recalculado a cada render: a tela aberta passando da meia-noite não pode ficar no dia velho.
  const hoje = hojeSP();
  // Operador sem "Ver geração" recebe 403: a seção some, sem aviso (PER-40).
  const [semAcesso, setSemAcesso] = useState(false);
  // API sem o período "total" (antes do NEXON-37) responde 400: o botão some.
  const [semTotal, setSemTotal] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoAnalise>('dia');
  const [ref, setRef] = useState(hoje);
  const [a, setA] = useState<AnaliseGeracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Só a resposta do último pedido vale: clique rápido ou o refresh não podem trocar o período em tela.
  const pedido = useRef(0);
  const carregar = useCallback(async () => {
    if (!unidadeId) return;
    const meu = ++pedido.current;
    setLoading(true);
    setErro(null);
    try {
      const r = await geracaoApi.analise(unidadeId, periodo, periodo === 'total' ? undefined : ref);
      if (meu === pedido.current) { setA(r); setSemAcesso(false); }
    } catch (e: unknown) {
      if (meu !== pedido.current) return;
      if (periodo === 'total' && status(e) === 400) {
        setSemTotal(true);
        setPeriodo('ano');
        return;
      }
      setA(null);
      setSemAcesso(status(e) === 403);
      setErro(mensagemErro(e));
    } finally {
      if (meu === pedido.current) setLoading(false);
    }
  }, [unidadeId, periodo, ref]);

  useEffect(() => { carregar(); }, [carregar]);

  // Hoje: a geração anda minuto a minuto e o satélite chega de hora em hora.
  const incluiHoje = a != null && a.proximo == null;
  useEffect(() => {
    if (!incluiHoje) return undefined;
    const t = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [incluiHoje, carregar]);

  /** Troca de período volta para hoje. */
  const escolherPeriodo = useCallback((p: PeriodoAnalise) => { setPeriodo(p); setRef(hojeSP()); }, []);
  /** Abre um período numa data (toque na barra, ‹ ›, campo de data). */
  const abrir = useCallback((p: PeriodoAnalise, data: string) => { setPeriodo(p); setRef(data); }, []);

  return { hoje, periodo, ref, a, loading, erro, semAcesso, semTotal, carregar, escolherPeriodo, abrir };
}
