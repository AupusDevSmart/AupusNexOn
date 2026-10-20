import { api } from '@/config/api';
import type { EscopoRelatorio, FormatoRelatorio, RelatorioOperacao, TipoRelatorioOperacao } from './tipos';

const unwrap = <T,>(r: { data?: unknown }): T => {
  const d = r?.data as { data?: unknown } | undefined;
  return (d && typeof d === 'object' && 'data' in d ? d.data : d) as T;
};

export async function buscarEscopos(tipo: TipoRelatorioOperacao): Promise<EscopoRelatorio[]> {
  const r = await api.get(`/relatorios/operacao/escopos?tipo=${encodeURIComponent(tipo)}`);
  return unwrap<EscopoRelatorio[]>(r) ?? [];
}

export async function buscarRelatorio(
  tipo: TipoRelatorioOperacao,
  unidadeId: string,
  mes: string,
  formato: FormatoRelatorio,
): Promise<RelatorioOperacao> {
  const q = new URLSearchParams({ unidadeId, mes, formato });
  const r = await api.get(`/relatorios/operacao/${encodeURIComponent(tipo)}?${q.toString()}`);
  return unwrap<RelatorioOperacao>(r);
}

export function mensagemErro(e: unknown, padrao: string): string {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof m === 'string' && m) return m;
  if (Array.isArray(m) && m.length) return String(m[0]);
  return padrao;
}
