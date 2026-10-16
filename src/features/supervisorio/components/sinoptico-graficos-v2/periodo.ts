import type { PeriodoFiltro } from '@/hooks/useDemandaAgregada';

// ---- Navegação ‹ › do período (dia/mês/ano) — referência em periodo.data/mes/ano ----
export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Hoje em YYYY-MM-DD no fuso do navegador (o mesmo que o backend usa pra montar o dia). */
export const hojeLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** 'YYYY-MM-DD' → Date local à meia-noite (sem o deslocamento de UTC do `new Date(iso)`). */
export const parseDiaLocal = (iso?: string): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

export const ehDiaAtual = (p: PeriodoFiltro) => p.tipo !== 'dia' || !p.data || p.data === hojeLocalISO();

export const deslocarPeriodo = (p: PeriodoFiltro, passo: number): PeriodoFiltro => {
  const hoje = new Date();
  if (p.tipo === 'dia') {
    const base = parseDiaLocal(p.data) ?? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    base.setDate(base.getDate() + passo);
    return { tipo: 'dia', data: `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}` };
  }
  if (p.tipo === 'mes') {
    const [y, m] = (p.mes ?? `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}`).split('-').map(Number);
    const base = new Date(y, m - 1 + passo, 1);
    return { tipo: 'mes', mes: `${base.getFullYear()}-${pad2(base.getMonth() + 1)}` };
  }
  if (p.tipo === 'ano') {
    const y = Number(p.ano ?? hoje.getFullYear());
    return { tipo: 'ano', ano: String(y + passo) };
  }
  return p;
};

export const podeAvancarPeriodo = (p: PeriodoFiltro): boolean => {
  const prox = deslocarPeriodo(p, 1);
  const hoje = hojeLocalISO();
  if (prox.tipo === 'dia') return (prox.data ?? '') <= hoje;
  if (prox.tipo === 'mes') return (prox.mes ?? '') <= hoje.slice(0, 7);
  if (prox.tipo === 'ano') return (prox.ano ?? '') <= hoje.slice(0, 4);
  return false;
};

export const rotuloPeriodo = (p: PeriodoFiltro): string => {
  const hoje = new Date();
  if (p.tipo === 'dia') {
    if (!p.data || p.data === hojeLocalISO()) return 'Hoje';
    const [y, m, d] = p.data.split('-');
    return `${d}/${m}/${y}`;
  }
  if (p.tipo === 'mes') {
    const [y, m] = (p.mes ?? `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}`).split('-').map(Number);
    const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (p.tipo === 'ano') return String(p.ano ?? hoje.getFullYear());
  return '';
};

/** Date → 'YYYY-MM-DDTHH:mm' em horário local, valor do input datetime-local. */
export function inicioISO(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Qualidade dos dados — limitado a SEM_DADOS e DESATUALIZADO.
 * Só faz sentido para período "dia" (live); mês/ano são consultas históricas.
 */
export function analisarQualidadeDados(dados: Array<{ timestamp?: string }>) {
  if (!dados || dados.length === 0) {
    return { status: 'SEM_DADOS' as const, mensagem: 'Nenhum dado disponível' };
  }
  const ultimo = dados[dados.length - 1]?.timestamp;
  if (!ultimo) return { status: 'OK' as const, mensagem: '' };
  const diferencaHoras = (Date.now() - new Date(ultimo).getTime()) / 3_600_000;
  if (diferencaHoras > 2) {
    return {
      status: 'DESATUALIZADO' as const,
      mensagem: `Último dado: ${Math.floor(diferencaHoras)}h atrás`,
    };
  }
  return { status: 'OK' as const, mensagem: '' };
}
