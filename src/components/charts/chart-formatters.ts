// Formatadores dos gráficos (bklit) em pt-BR. O registry vem em en-US com
// rótulo fixo "MMM d"; aqui o eixo X, o pill de data e o título do tooltip
// falam português e entendem série intradiária.
//
// Regra do rótulo: ponto com hora (série de leituras do dia) mostra "14:30";
// ponto à meia-noite mostra o dia ("16 out"), como em painéis de supervisão.
// Para série diária/mensal, monte a data em horário local (`new Date(a, m, d)`),
// nunca por string ISO em UTC, senão o dia vira 21:00 da véspera.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const pad2 = (n: number) => String(n).padStart(2, '0');

export const temHora = (d: Date) => d.getHours() !== 0 || d.getMinutes() !== 0;

/** "16 out" */
export const formatDiaMes = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()]}`;

/** "out/26" */
export const formatMesAno = (d: Date) => `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;

/** "14:30" */
export const formatHoraMinuto = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Rótulo curto do eixo X e do pill: "14:30" em série intradiária, "16 out" no resto. */
export const shortDateFmt = {
  format: (d: Date): string => (temHora(d) ? formatHoraMinuto(d) : formatDiaMes(d)),
};

/** Título do tooltip: "qua, 16 out" ou "qua, 16 out 14:30". */
export const weekdayDateFmt = {
  format: (d: Date): string => {
    const base = `${DIAS[d.getDay()]}, ${formatDiaMes(d)}`;
    return temHora(d) ? `${base} ${formatHoraMinuto(d)}` : base;
  },
};

export const hmsTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// `Intl.NumberFormat.prototype.format` é um getter vinculado — seguro de extrair.
export const intFmt = new Intl.NumberFormat('pt-BR').format;
