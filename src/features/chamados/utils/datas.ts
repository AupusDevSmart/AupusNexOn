/** ISO → valor do <input type="datetime-local"> (hora local do navegador). */
export function paraInputLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valor do <input type="datetime-local"> → ISO; vazio vira null. */
export function deInputLocal(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "3 h", "1 d 4 h", "25 min". */
export function formatarDuracao(horas: number | null | undefined): string {
  if (horas == null) return '—';
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 24) return `${Math.round(horas * 10) / 10} h`.replace('.', ',');
  const d = Math.floor(horas / 24);
  const h = Math.round(horas - d * 24);
  return h ? `${d} d ${h} h` : `${d} d`;
}

/** Duração do chamado: da ocorrência (ou abertura) até o encerramento ou agora. */
export function duracaoDoChamado(c: {
  ocorrencia_em: string | null;
  aberto_em: string | null;
  created_at: string;
  fechado_em: string | null;
}): number {
  const inicio = new Date(c.ocorrencia_em ?? c.aberto_em ?? c.created_at).getTime();
  const fim = c.fechado_em ? new Date(c.fechado_em).getTime() : Date.now();
  return Math.max(0, (fim - inicio) / 36e5);
}

/** "2026-11" → "nov/26". */
export function rotuloMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[(m ?? 1) - 1]}/${String(a).slice(2)}`;
}
