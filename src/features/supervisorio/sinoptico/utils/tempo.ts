// Utilitarios de tempo do sinoptico.
// Datas do backend chegam em ISO UTC; a formatacao para horario local fica no
// navegador (o JS resolve o fuso). Comparacoes usam epoch (Date.parse / getTime),
// que sao fuso-safe.

export function formatarHoraLocal(iso: string | null | undefined): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("pt-BR", { hour12: false });
}

export function minutosParaTexto(min: number | null | undefined): string {
  if (min == null) return "sem dados";
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function tempoRelativo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "agora";
  return `há ${minutosParaTexto(min)}`;
}
