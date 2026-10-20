import type { LinhaPivo, OcorrenciaIrrigacao, RelatorioIrrigacao } from './tipos';
import type { Indicador } from './documento';
import {
  TRACO, dataCurta, duracaoMin, energia, juntarE, nf, nfOu, reais, partes, SEMANA_CURTA, SEMANA_LONGA,
} from './formatos';
import { COR } from './tema';

/** Limiares do mockup (laranja só em exceção). */
export const LIMIAR_IRRIGACAO = {
  progMinPct: 85,
  efFatorMedia: 1.1,
  paradasMin: 2,
  pontaMaxPct: 5,
} as const;

export interface PivoCalculado {
  pivo: LinhaPivo;
  eficiencia: number | null; // kWh/mm/ha
  progPct: number | null;
  rsMmHa: number | null;
  alertaProg: boolean;
  alertaEf: boolean;
  alertaParadas: boolean;
}

export interface TotaisIrrigacao {
  areaHa: number;
  voltas: number | null;
  horas: number;
  kwh: number | null;
  paradas: number;
  chamados: number;
  laminaMedia: number | null;
  progPct: number | null;
  volumeM3: number | null;
  eficienciaMedia: number | null;
  rsMmHa: number | null;
  custo: number | null;
  disponibilidadePct: number | null;
}

const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

export function calcularPivos(d: RelatorioIrrigacao): { pivos: PivoCalculado[]; totais: TotaisIrrigacao } {
  const T = d.tarifaKwh;
  let area = 0, mmha = 0, areaLam = 0, mmhaProg = 0, progha = 0, kwhEf = 0, mmhaEf = 0, kwh = 0, temKwh = false;
  let voltas = 0, temVoltas = false, horas = 0, paradas = 0, chamados = 0, dispSoma = 0, dispN = 0;
  for (const p of d.linhas) {
    if (ok(p.areaHa)) area += p.areaHa;
    if (ok(p.areaHa) && ok(p.laminaMm)) {
      mmha += p.areaHa * p.laminaMm;
      areaLam += p.areaHa;
      if (ok(p.programadoMm)) {
        mmhaProg += p.areaHa * p.laminaMm;
        progha += p.areaHa * p.programadoMm;
      }
      if (ok(p.kwh)) {
        kwhEf += p.kwh;
        mmhaEf += p.areaHa * p.laminaMm;
      }
    }
    if (ok(p.kwh)) { kwh += p.kwh; temKwh = true; }
    if (ok(p.voltas)) { voltas += p.voltas; temVoltas = true; }
    horas += p.horas;
    paradas += p.paradas;
    chamados += p.chamados.abertos + p.chamados.atendidos;
    if (ok(p.disponibilidadePct)) { dispSoma += p.disponibilidadePct; dispN++; }
  }
  const eficienciaMedia = mmhaEf > 0 ? kwhEf / mmhaEf : null;
  const pivos = d.linhas.map((p): PivoCalculado => {
    const eficiencia = ok(p.kwh) && ok(p.laminaMm) && ok(p.areaHa) && p.laminaMm * p.areaHa > 0 ? p.kwh / (p.laminaMm * p.areaHa) : null;
    const progPct = ok(p.laminaMm) && ok(p.programadoMm) && p.programadoMm > 0 ? (p.laminaMm / p.programadoMm) * 100 : null;
    return {
      pivo: p,
      eficiencia,
      progPct,
      rsMmHa: eficiencia != null && ok(T) ? eficiencia * T : null,
      alertaProg: progPct != null && progPct < LIMIAR_IRRIGACAO.progMinPct,
      alertaEf: eficiencia != null && eficienciaMedia != null && eficiencia > eficienciaMedia * LIMIAR_IRRIGACAO.efFatorMedia,
      alertaParadas: p.paradas >= LIMIAR_IRRIGACAO.paradasMin,
    };
  });
  const totais: TotaisIrrigacao = {
    areaHa: area,
    voltas: temVoltas ? voltas : null,
    horas,
    kwh: temKwh ? kwh : null,
    paradas,
    chamados,
    laminaMedia: areaLam > 0 ? mmha / areaLam : null,
    progPct: progha > 0 ? (mmhaProg / progha) * 100 : null,
    volumeM3: mmha > 0 ? mmha * 10 : null,
    eficienciaMedia,
    rsMmHa: eficienciaMedia != null && ok(T) ? eficienciaMedia * T : null,
    custo: temKwh && ok(T) ? kwh * T : null,
    disponibilidadePct: dispN ? dispSoma / dispN : null,
  };
  return { pivos, totais };
}

export function postoPct(d: RelatorioIrrigacao) {
  const e = d.energiaPorPosto;
  if (!e) return null;
  const t = e.pontaKwh + e.foraPontaKwh + e.reservadoKwh;
  if (!(t > 0)) return null;
  return { ponta: (e.pontaKwh / t) * 100, foraPonta: (e.foraPontaKwh / t) * 100, reservado: (e.reservadoKwh / t) * 100, total: t };
}

/** Coluna CHAM.: "1 ab." laranja · "1 ✓" verde · "—". */
export function celulaChamados(c: LinhaPivo['chamados']): { texto: string; cor: string } {
  if (c.abertos > 0) return { texto: `${c.abertos} ab.`, cor: COR.alerta };
  if (c.atendidos > 0) return { texto: `${c.atendidos} ✓`, cor: COR.ok };
  return { texto: TRACO, cor: COR.neutro };
}

export function indicadoresIrrigacao(d: RelatorioIrrigacao): Indicador[] {
  const { pivos, totais: t } = calcularPivos(d);
  const abaixo = pivos.filter((p) => p.alertaProg);
  const posto = postoPct(d);
  const en = t.kwh != null ? energia(t.kwh) : null;
  const k: Indicador[] = [
    { rotulo: 'Lâmina média', valor: nfOu(t.laminaMedia, 1), unidade: 'mm', contexto: 'média ponderada por área' },
    {
      rotulo: 'Programado × aplicado',
      valor: nfOu(t.progPct),
      unidade: '%',
      contexto: abaixo.length === 1
        ? `${abaixo[0].pivo.nome} abaixo de ${LIMIAR_IRRIGACAO.progMinPct}%`
        : abaixo.length > 1
          ? `${abaixo.length} pivôs abaixo de ${LIMIAR_IRRIGACAO.progMinPct}%`
          : t.progPct == null ? 'sem lâmina programada' : `todos acima de ${LIMIAR_IRRIGACAO.progMinPct}%`,
      alerta: abaixo.length > 0,
    },
    { rotulo: 'Volume estimado', valor: nfOu(t.volumeM3), unidade: 'm³', contexto: 'lâmina × área' },
    { rotulo: 'Horas irrigadas', valor: nf(t.horas), unidade: 'h', contexto: t.voltas != null ? `${t.voltas} voltas` : 'voltas sem dado' },
    { rotulo: 'Energia', valor: en ? en.valor : TRACO, unidade: en?.unidade, contexto: 'pivôs + bombeamento' },
  ];
  if (d.tarifaKwh != null) {
    k.push(
      { rotulo: 'Custo estimado', valor: t.custo != null ? reais(t.custo, 0) : TRACO, contexto: 'tarifa com impostos' },
      {
        rotulo: 'Custo por mm/ha',
        valor: t.rsMmHa != null ? reais(t.rsMmHa, 2) : TRACO,
        contexto: t.eficienciaMedia != null ? `${nf(t.eficienciaMedia, 2)} kWh/mm/ha` : 'sem lâmina',
      },
    );
  } else {
    const comParadas = pivos.filter((p) => p.alertaParadas);
    k.push(
      { rotulo: 'Energia por mm/ha', valor: nfOu(t.eficienciaMedia, 2), unidade: 'kWh', contexto: 'média dos pivôs' },
      {
        rotulo: 'Paradas',
        valor: nf(t.paradas),
        contexto: comParadas.length ? `${juntarE(comParadas.map((p) => p.pivo.nome))} com ${LIMIAR_IRRIGACAO.paradasMin} ou mais` : 'não programadas',
        alerta: comParadas.length > 0,
      },
    );
  }
  k.push({
    rotulo: 'Energia em ponta',
    valor: posto ? nf(posto.ponta, 1) : TRACO,
    unidade: '%',
    contexto: d.energiaPorPosto ? `${nf(d.energiaPorPosto.pontaKwh)} kWh` : 'sem medição por horário',
    alerta: posto != null && posto.ponta > LIMIAR_IRRIGACAO.pontaMaxPct,
  });
  return k;
}

export interface Destaque {
  cor: string;
  negrito?: string;
  texto: string;
}

/** Motivo de parada mais frequente de um pivô (só as fora do padrão). */
function motivoPrincipal(ocorrencias: OcorrenciaIrrigacao[], pivo: string): string | null {
  const cont = new Map<string, number>();
  for (const o of ocorrencias) if (o.pivo === pivo && o.problema) cont.set(o.motivo, (cont.get(o.motivo) ?? 0) + 1);
  let melhor: string | null = null, n = 0;
  for (const [m, c] of cont) if (c > n) { melhor = m; n = c; }
  return melhor;
}

/** "Destaques do mês": um destaque = uma linha (máx. 4). */
export function destaquesIrrigacao(d: RelatorioIrrigacao): Destaque[] {
  const { pivos, totais } = calcularPivos(d);
  const out: Destaque[] = [];
  const ef = pivos.filter((p) => p.alertaEf).sort((a, b) => (b.eficiencia ?? 0) - (a.eficiencia ?? 0));
  for (const p of ef.slice(0, 1)) {
    const acima = ((p.eficiencia as number) / (totais.eficienciaMedia as number) - 1) * 100;
    out.push({
      cor: COR.alerta,
      negrito: p.pivo.nome,
      texto: ` gastou ${nf(p.eficiencia as number, 2)} kWh/mm/ha, ${nf(acima)}% acima da média. Verificar bomba e pressão.`,
    });
  }
  const prog = pivos.filter((p) => p.alertaProg).sort((a, b) => (a.progPct ?? 0) - (b.progPct ?? 0));
  for (const p of prog.slice(0, 2)) {
    const motivo = motivoPrincipal(d.ocorrencias, p.pivo.nome);
    const causa = p.pivo.paradas > 0
      ? `: ${p.pivo.paradas} ${p.pivo.paradas === 1 ? 'parada' : 'paradas'}${motivo ? ` por ${motivo.toLowerCase()}` : ''}.`
      : '.';
    out.push({ cor: COR.alerta, negrito: p.pivo.nome, texto: ` aplicou ${nf(p.progPct as number)}% do programado${causa}` });
  }
  const posto = postoPct(d);
  if (posto && posto.ponta > LIMIAR_IRRIGACAO.pontaMaxPct) {
    out.push({ cor: COR.alerta, texto: `${nf(posto.ponta, 1)}% da energia no horário de ponta, com tarifa mais cara.` });
  }
  if (posto && posto.reservado > 0) {
    out.push({ cor: COR.ok, texto: `${nf(posto.reservado)}% da energia no horário reservado, com tarifa reduzida.` });
  }
  if (!out.some((x) => x.cor === COR.alerta) && pivos.length) {
    out.unshift({ cor: COR.ok, texto: 'Nenhum pivô fora do padrão no mês.' });
  }
  return out.slice(0, 4);
}

// ───────────────────────── Página 2 ─────────────────────────

export interface SegmentoTL { x: number; w: number; cor: string }
export interface LinhaTL { nome: string; segmentos: SegmentoTL[]; paradas: number[] }

export const TL_LARGURA = 616;

/** Linha do tempo: faixas de ponta, segmentos (verde / laranja na ponta) e paradas. Coordenadas em px de 0..616. */
export function linhaDoTempo(d: RelatorioIrrigacao) {
  const lt = d.linhaDoTempo;
  if (!lt) return null;
  const H = TL_LARGURA / 168;
  const faixas: Array<[number, number]> = lt.dias
    .map((dia, i) => (dia.temPonta ? ([i * 24 + lt.pontaInicioH, i * 24 + lt.pontaFimH] as [number, number]) : null))
    .filter((x): x is [number, number] => x != null);
  const linhas: LinhaTL[] = lt.pivos.map((p) => {
    const segmentos: SegmentoTL[] = [];
    for (const s of p.segmentos) {
      const a0 = Math.max(0, s.inicioH), a1 = Math.min(168, s.fimH);
      if (a1 <= a0) continue;
      const cortes = [a0, a1];
      for (const [f0, f1] of faixas) for (const c of [f0, f1]) if (c > a0 && c < a1) cortes.push(c);
      cortes.sort((x, y) => x - y);
      for (let i = 0; i < cortes.length - 1; i++) {
        const c0 = cortes[i], c1 = cortes[i + 1];
        if (c1 <= c0) continue;
        const meio = (c0 + c1) / 2;
        const naPonta = faixas.some(([f0, f1]) => meio >= f0 && meio < f1);
        segmentos.push({ x: c0 * H, w: (c1 - c0) * H, cor: naPonta ? COR.alerta : COR.ok });
      }
    }
    return { nome: p.nome, segmentos, paradas: p.paradasH.filter((h) => h >= 0 && h <= 168).map((h) => h * H) };
  });
  const dias = lt.dias.map((x) => {
    const p = partes(x.data);
    return `${SEMANA_CURTA[p.semana]} ${String(p.dia).padStart(2, '0')}`;
  });
  const ini = lt.dias[0]?.data ?? lt.inicio;
  const fim = lt.dias[lt.dias.length - 1]?.data ?? lt.inicio;
  const pi = partes(ini), pf = partes(fim);
  const periodo = pi.mes === pf.mes
    ? `${String(pi.dia).padStart(2, '0')} a ${dataCurta(fim)}`
    : `${dataCurta(ini)} a ${dataCurta(fim)}`;

  // Leitura: quem irrigou na ponta (horas por dia) e quais dias não têm ponta.
  const naPonta: string[] = [];
  lt.pivos.forEach((p) => {
    lt.dias.forEach((dia, i) => {
      if (!dia.temPonta) return;
      const f0 = i * 24 + lt.pontaInicioH, f1 = i * 24 + lt.pontaFimH;
      const h = p.segmentos.reduce((s, sg) => s + Math.max(0, Math.min(sg.fimH, f1) - Math.max(sg.inicioH, f0)), 0);
      if (h > 0) {
        const pd = partes(dia.data);
        naPonta.push(`${p.nome} irrigou ${nf(h, Number.isInteger(h) ? 0 : 1)} h na ponta na ${SEMANA_LONGA[pd.semana]} (${dataCurta(dia.data)})`);
      }
    });
  });
  const semPonta = lt.dias.filter((x) => !x.temPonta).map((x) => SEMANA_LONGA[partes(x.data).semana]);
  let leitura = naPonta.length === 0
    ? 'Nenhum pivô irrigou no horário de ponta.'
    : naPonta.length <= 2
      ? `${juntarE(naPonta)}.`
      : `${naPonta.slice(0, 2).join('; ')} e mais ${naPonta.length - 2} ocorrência(s) na ponta.`;
  if (semPonta.length) {
    const lista = juntarE(semPonta);
    leitura += ` ${lista.charAt(0).toUpperCase()}${lista.slice(1)} ${semPonta.length === 1 ? 'não tem' : 'não têm'} horário de ponta.`;
  }
  return {
    faixas: faixas.map(([a, b]) => ({ x: a * H, w: (b - a) * H })),
    linhas,
    dias,
    periodo,
    leitura,
    irrigouNaPonta: naPonta.length > 0,
  };
}

/** Escala azul do mapa de setores: #EEF3FD → #1F4FB8. */
export function corSetor(v: number | null, max: number): string {
  if (v == null) return COR.trilho;
  const t = Math.max(0, Math.min(1, v / max));
  const a = [238, 243, 253], b = [31, 79, 184];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})`;
}

export function setores(d: RelatorioIrrigacao) {
  const s = d.setores;
  if (!s || !s.mm.length) return null;
  const vals = s.mm.filter((v): v is number => v != null);
  const ref = Math.max(s.programadoMm ?? 0, ...vals, 1);
  const max = Math.ceil((ref * 1.1) / 5) * 5;
  const pt = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(120 + r * Math.cos(a)).toFixed(1)} ${(120 + r * Math.sin(a)).toFixed(1)}`;
  };
  const passo = 360 / s.mm.length;
  const fatias = s.mm.map((v, i) => {
    const a0 = i * passo, a1 = a0 + passo, R = 112, r = 26;
    return {
      cor: corSetor(v, max),
      d: `M${pt(a0, r)} L${pt(a0, R)} A${R} ${R} 0 0 1 ${pt(a1, R)} L${pt(a1, r)} A${r} ${r} 0 0 0 ${pt(a0, r)} Z`,
    };
  });
  // Maior trecho contínuo de setores abaixo de 85% do programado.
  const prog = s.programadoMm;
  let leitura: { faixa: string; valores: string; programado: string } | null = null;
  if (prog != null && prog > 0) {
    const baixo = s.mm.map((v) => v != null && v < prog * (LIMIAR_IRRIGACAO.progMinPct / 100));
    let melhor: [number, number] | null = null;
    for (let i = 0; i < baixo.length; i++) {
      if (!baixo[i]) continue;
      let j = i;
      while (j + 1 < baixo.length && baixo[j + 1]) j++;
      if (!melhor || j - i > melhor[1] - melhor[0]) melhor = [i, j];
      i = j;
    }
    if (melhor) {
      const [i, j] = melhor;
      const valores = s.mm.slice(i, j + 1).map((v) => nf(v as number));
      leitura = {
        faixa: `${nf(i * passo)}° a ${nf((j + 1) * passo)}°`,
        valores: `${juntarE(valores)} mm`,
        programado: `${nf(prog)} mm`,
      };
    }
  }
  const paradas = d.ocorrencias.filter((o) => o.pivo === s.pivo && o.problema).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const motivo = motivoPrincipal(d.ocorrencias, s.pivo);
  const datas = paradas.filter((o) => o.motivo === motivo).slice(0, 3).map((o) => dataCurta(o.inicio));
  return { pivo: s.pivo, max, fatias, leitura, motivo, datas };
}

export function ocorrencias(d: RelatorioIrrigacao) {
  const lista = [...d.ocorrencias].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const problemas = lista.filter((o) => o.problema);
  const minProblema = problemas.reduce((s, o) => s + o.duracaoMin, 0);
  const grupos = new Map<string, { min: number; problema: boolean }>();
  for (const o of lista) {
    const k = o.motivo.replace(/\s*\([^)]*\)\s*$/, '').trim() || o.motivo;
    const g = grupos.get(k) ?? { min: 0, problema: false };
    g.min += o.duracaoMin;
    g.problema = g.problema || o.problema;
    grupos.set(k, g);
  }
  const motivos = [...grupos.entries()]
    .map(([motivo, g]) => ({ motivo, ...g }))
    .sort((a, b) => Number(b.problema) - Number(a.problema) || b.min - a.min)
    .slice(0, 5);
  const maxMin = Math.max(1, ...motivos.map((m) => m.min));
  return {
    linhas: lista,
    resumo: `${problemas.length} ${problemas.length === 1 ? 'parada' : 'paradas'} · ${duracaoMin(minProblema)} min`,
    motivos: motivos.map((m) => ({ ...m, pct: (m.min / maxMin) * 100, cor: m.problema ? COR.alerta : COR.neutro, texto: duracaoMin(m.min) })),
  };
}

export function subtituloIrrigacao(d: RelatorioIrrigacao, mesTexto: string): string {
  const area = d.areaHa ?? calcularPivos(d).totais.areaHa;
  return [
    mesTexto,
    d.safra ? `Safra ${d.safra}` : null,
    `${d.linhas.length} ${d.linhas.length === 1 ? 'pivô' : 'pivôs'}`,
    area ? `${nf(area)} ha` : null,
  ].filter(Boolean).join(' · ');
}

/** Números crus para a aba "Resumo" da planilha. */
export function resumoIrrigacao(d: RelatorioIrrigacao): Array<[string, number | null, string]> {
  const { totais: t } = calcularPivos(d);
  const e = d.energiaPorPosto;
  return [
    ['Área', d.areaHa ?? t.areaHa, 'ha'],
    ['Lâmina média', t.laminaMedia, 'mm'],
    ['Programado × aplicado', t.progPct, '%'],
    ['Volume estimado', t.volumeM3, 'm³'],
    ['Horas irrigadas', t.horas, 'h'],
    ['Voltas', t.voltas, ''],
    ['Energia', t.kwh, 'kWh'],
    ['Energia por mm/ha', t.eficienciaMedia, 'kWh/mm/ha'],
    ['Paradas não programadas', t.paradas, ''],
    ['Disponibilidade média', t.disponibilidadePct, '%'],
    ['Energia na ponta', e ? e.pontaKwh : null, 'kWh'],
    ['Energia fora de ponta', e ? e.foraPontaKwh : null, 'kWh'],
    ['Energia no reservado', e ? e.reservadoKwh : null, 'kWh'],
    ...(d.tarifaKwh != null
      ? ([
          ['Tarifa com impostos', d.tarifaKwh, 'R$/kWh'],
          ['Custo estimado', t.custo, 'R$'],
          ['Custo por mm/ha', t.rsMmHa, 'R$'],
        ] as Array<[string, number | null, string]>)
      : []),
  ];
}
