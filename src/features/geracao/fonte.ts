import type { FonteGeracao, FonteGeracaoConfig, ResumoFonteGeracao } from './api';
import { nf } from './formato';

/**
 * Rótulos da fonte da geração (NEXON-37): TON × nuvem do fabricante × manual. Funções puras,
 * usadas no selo da análise, no tooltip das barras e no KPI "Energia hoje" da Visão Geral.
 */

export const ROTULO_FONTE_GERACAO: Record<FonteGeracao, string> = {
  ton: 'TON',
  nuvem: 'nuvem',
  manual: 'manual',
  mista: 'TON e nuvem',
};

export const ROTULO_CONFIG_FONTE: Record<FonteGeracaoConfig, string> = {
  automatico: 'Automático',
  ton: 'TON',
  nuvem: 'Nuvem do fabricante',
};

/** Selo curto a partir só da fonte (COA não manda o texto pronto). */
export function seloDaFonte(fonte: FonteGeracao | null | undefined, divergem = false): string | null {
  if (!fonte) return null;
  if (divergem && fonte === 'ton') return 'Fontes divergem — usando TON';
  if (fonte === 'mista') return 'Fontes: TON e nuvem';
  return `Fonte: ${ROTULO_FONTE_GERACAO[fonte]}`;
}

/** |ton − nuvem| / max(ton, nuvem), em %. Null sem as duas ou com as duas zeradas. */
export function divergenciaPct(ton: number | null | undefined, nuvem: number | null | undefined): number | null {
  if (ton == null || nuvem == null) return null;
  const maior = Math.max(ton, nuvem);
  if (maior <= 0) return null;
  return (Math.abs(ton - nuvem) / maior) * 100;
}

/** "TON 6.100 kWh · nuvem 6.080 kWh" — só quando as duas medições existem. */
export function textoTonNuvem(ton: number | null | undefined, nuvem: number | null | undefined): string | null {
  if (ton == null || nuvem == null) return null;
  return `TON ${nf(ton, 0)} kWh · nuvem ${nf(nuvem, 0)} kWh`;
}

export interface LinhaFonte {
  label: string;
  value: string;
}

/** Linhas do tooltip de uma barra (dia/mês/ano): fonte usada e, havendo as duas, TON × nuvem. */
export function linhasFonteDoPonto(p: {
  fonte?: FonteGeracao | null;
  kwh_ton?: number | null;
  kwh_nuvem?: number | null;
  divergem?: boolean;
}): LinhaFonte[] {
  const linhas: LinhaFonte[] = [];
  if (p.fonte) linhas.push({ label: 'Fonte', value: `${ROTULO_FONTE_GERACAO[p.fonte]}${p.divergem ? ' (divergem)' : ''}` });
  const ambas = textoTonNuvem(p.kwh_ton, p.kwh_nuvem);
  if (ambas) linhas.push({ label: 'Medições', value: ambas });
  return linhas;
}

/** Linhas do tooltip do selo: como a fonte foi escolhida e as somas do período. */
export function linhasSelo(f: ResumoFonteGeracao): LinhaFonte[] {
  const linhas: LinhaFonte[] = [
    { label: 'Configuração', value: f.config === 'automatico' ? 'Automático' : `Fixada em ${ROTULO_CONFIG_FONTE[f.config]}` },
  ];
  if (f.kwh_ton != null) linhas.push({ label: 'TON', value: `${nf(f.kwh_ton, 0)} kWh` });
  if (f.kwh_nuvem != null) linhas.push({ label: 'Nuvem', value: `${nf(f.kwh_nuvem, 0)} kWh` });
  const pct = divergenciaPct(f.kwh_ton, f.kwh_nuvem);
  if (pct != null) linhas.push({ label: 'Diferença', value: `${nf(pct, 1)}%` });
  const diasDiv = (f.dias ?? []).filter((d) => d.motivo === 'divergem').length;
  if (diasDiv > 0 && (f.dias?.length ?? 0) > 1) linhas.push({ label: 'Dias com divergência', value: String(diasDiv) });
  return linhas;
}
