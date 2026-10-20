import type { RelatorioConsumo } from './tipos';
import type { Indicador } from './documento';
import {
  TRACO, dataHora, desvio, energia, mesAbrev, nf, nfOu, nomeMes, somarMes, tetoRedondo,
} from './formatos';
import { COR } from './tema';

export const LIMIAR_CONSUMO = {
  fpMin: 0.92,
  pontaMaxPct: 5,
} as const;

/** Horário de ponta usado na faixa da curva típica (o contrato não traz o posto da distribuidora). */
export const PONTA_PADRAO = { inicioH: 18, fimH: 21 } as const;

export function postoConsumo(d: RelatorioConsumo) {
  const e = d.energiaPorPosto;
  if (!e) return null;
  const t = e.pontaKwh + e.foraPontaKwh + e.reservadoKwh;
  if (!(t > 0)) return null;
  return { ponta: (e.pontaKwh / t) * 100, foraPonta: (e.foraPontaKwh / t) * 100, reservado: (e.reservadoKwh / t) * 100, total: t };
}

/** Faixa de horas com a menor carga (madrugada) na curva de dia útil: "02–04h". */
export function faixaCargaBase(d: RelatorioConsumo): string | null {
  const c = d.curvaTipica?.diaUtil;
  if (!c || c.length < 24) return null;
  let min = Infinity, h0 = -1;
  for (let h = 0; h < 7; h++) {
    const v = c[h];
    if (v != null && v < min) { min = v; h0 = h; }
  }
  if (h0 < 0) return null;
  let h1 = h0;
  while (h1 + 1 < 7 && c[h1 + 1] === min) h1++;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h0)}–${p(h1 + 1)}h`;
}

export function indicadoresConsumo(d: RelatorioConsumo): Indicador[] {
  const mesAnt = nomeMes(somarMes(d.cabecalho.mes, -1));
  const total = d.consumoTotalKwh != null ? energia(d.consumoTotalKwh) : null;
  const rede = d.daRedeKwh != null ? energia(d.daRedeKwh) : null;
  const posto = postoConsumo(d);
  const pctContr = d.demandaMaxKw != null && d.demandaContratadaKw ? (d.demandaMaxKw / d.demandaContratadaKw) * 100 : null;
  const fpBaixo = (d.fpMedio != null && d.fpMedio < LIMIAR_CONSUMO.fpMin) || (d.intervalosFpBaixo ?? 0) > 0;
  const faixa = faixaCargaBase(d);
  return [
    { rotulo: 'Consumo total', valor: total ? total.valor : TRACO, unidade: total?.unidade, contexto: 'rede + usina' },
    {
      rotulo: 'Da rede',
      valor: rede ? rede.valor : TRACO,
      unidade: rede?.unidade,
      contexto: d.daRedeKwh != null && d.daRedeMesAnteriorKwh
        ? `${desvio((d.daRedeKwh / d.daRedeMesAnteriorKwh - 1) * 100)} vs ${mesAnt}`
        : 'sem mês anterior',
    },
    {
      rotulo: 'Energia em ponta',
      valor: posto ? nf(posto.ponta, 1) : TRACO,
      unidade: '%',
      contexto: d.energiaPorPosto ? `${nf(d.energiaPorPosto.pontaKwh)} kWh` : 'sem medição por horário',
      alerta: posto != null && posto.ponta > LIMIAR_CONSUMO.pontaMaxPct,
    },
    {
      rotulo: 'Demanda máxima',
      valor: nfOu(d.demandaMaxKw),
      unidade: 'kW',
      contexto: pctContr != null ? `${nf(pctContr)}% da contratada` : d.demandaMaxEm ? dataHora(d.demandaMaxEm) : 'sem contratada cadastrada',
      alerta: pctContr != null && pctContr > 100,
    },
    {
      rotulo: 'Ultrapassagens',
      valor: nfOu(d.ultrapassagens),
      contexto: 'no mês',
      alerta: (d.ultrapassagens ?? 0) > 0,
    },
    {
      rotulo: 'FP médio',
      valor: nfOu(d.fpMedio, 2),
      contexto: d.intervalosFpBaixo != null
        ? `${nf(d.intervalosFpBaixo)} ${d.intervalosFpBaixo === 1 ? 'intervalo' : 'intervalos'} abaixo de 0,92`
        : 'sem intervalos de 15 min',
      alerta: fpBaixo,
    },
    {
      rotulo: 'Reativo excedente',
      valor: nfOu(d.reativoExcedenteKvarh),
      unidade: 'kvarh',
      contexto: d.reativoIndutivoPct != null
        ? `indutivo ${nf(d.reativoIndutivoPct)}% · capacitivo ${nf(100 - d.reativoIndutivoPct)}%`
        : 'sem medição de reativo',
    },
    {
      rotulo: 'Carga de base',
      valor: nfOu(d.cargaBaseKw),
      unidade: 'kW',
      contexto: faixa ? `madrugada (${faixa})` : 'madrugada',
    },
  ];
}

export function leituraPosto(d: RelatorioConsumo): string | null {
  const p = postoConsumo(d);
  if (!p) return null;
  if (p.ponta > LIMIAR_CONSUMO.pontaMaxPct) return `Ponta acima de ${LIMIAR_CONSUMO.pontaMaxPct}% da energia da rede: rever cargas nesse horário.`;
  return `${nf(p.foraPonta + p.reservado)}% da energia da rede fora do horário de ponta.`;
}

export const DEMANDA = { largura: 320, altura: 120 } as const;

export function graficoDemanda(d: RelatorioConsumo) {
  const vals = d.demanda12m.map((x) => x.maxKw).filter((v): v is number => v != null);
  if (!vals.length) return null;
  const contr = d.demandaContratadaKw;
  const tol = contr != null ? contr * (1 + d.toleranciaPct / 100) : null;
  const MAX = tetoRedondo(Math.max(...vals, tol ?? 0) * 1.05);
  const H = 116;
  const toY = (v: number) => 118 - (v / MAX) * H;
  const passo = DEMANDA.largura / Math.max(12, d.demanda12m.length);
  const n = d.demanda12m.length;
  const barras = d.demanda12m.map((x, i) => ({
    mes: mesAbrev(x.mes),
    x: i * passo + (passo - 18) / 2,
    y: x.maxKw != null ? toY(x.maxKw) : null,
    h: x.maxKw != null ? (x.maxKw / MAX) * H : 0,
    cor: x.maxKw != null && contr != null && x.maxKw > contr ? COR.alerta : i === n - 1 ? COR.texto : COR.neutro,
  }));
  const acima = d.demanda12m.filter((x) => x.maxKw != null && contr != null && x.maxKw > contr);
  const foraTol = acima.filter((x) => tol != null && (x.maxKw as number) > tol);
  const aria = contr == null
    ? 'Demanda máxima mensal dos últimos 12 meses; sem demanda contratada cadastrada'
    : acima.length === 0
      ? 'Demanda máxima mensal dos últimos 12 meses; todos os meses abaixo da contratada'
      : `Demanda máxima mensal dos últimos 12 meses; ${acima.map((x) => nomeMes(x.mes)).join(', ')} acima da contratada${foraTol.length ? ', fora da tolerância' : ', dentro da tolerância'}`;
  return { MAX, barras, cY: contr != null ? toY(contr) : null, tY: tol != null ? toY(tol) : null, tol, aria };
}

export const CURVA = { largura: 320, altura: 120 } as const;

export function graficoCurva(d: RelatorioConsumo) {
  const c = d.curvaTipica;
  if (!c) return null;
  const todos = [...c.diaUtil, ...c.fimDeSemana].filter((v): v is number => v != null);
  if (!todos.length) return null;
  const MAX = tetoRedondo(Math.max(...todos) * 1.05);
  const caminho = (arr: Array<number | null>) => {
    let s = '', novo = true;
    arr.forEach((v, i) => {
      if (v == null) { novo = true; return; }
      s += `${novo ? 'M' : 'L'}${((i * CURVA.largura) / 23).toFixed(1)} ${(118 - (v / MAX) * 112).toFixed(1)} `;
      novo = false;
    });
    return s.trim();
  };
  // Pico do dia útil para a descrição acessível.
  let pico = -1, hPico = 0;
  c.diaUtil.forEach((v, i) => { if (v != null && v > pico) { pico = v; hPico = i; } });
  return {
    diaUtil: caminho(c.diaUtil),
    fimDeSemana: caminho(c.fimDeSemana),
    pX: (PONTA_PADRAO.inicioH * CURVA.largura) / 23,
    pW: ((PONTA_PADRAO.fimH - PONTA_PADRAO.inicioH) * CURVA.largura) / 23,
    aria: `Curva de carga média por hora: pico em dia útil às ${String(hPico).padStart(2, '0')}h com ${nf(pico)} kW${d.cargaBaseKw != null ? `, carga de base de ${nf(d.cargaBaseKw)} kW de madrugada` : ''}`,
  };
}

export function balanco(d: RelatorioConsumo) {
  const b = d.balanco;
  const autoss = b.autoconsumoKwh != null && b.daRedeKwh != null && b.autoconsumoKwh + b.daRedeKwh > 0
    ? (b.autoconsumoKwh / (b.autoconsumoKwh + b.daRedeKwh)) * 100
    : null;
  const cel = (rotulo: string, v: number | null) => {
    const e = v != null ? energia(v) : null;
    return { rotulo, valor: e ? e.valor : TRACO, unidade: e?.unidade ?? '', destaque: false };
  };
  return {
    celulas: [
      cel('Geração', b.geracaoKwh),
      cel('Autoconsumo', b.autoconsumoKwh),
      cel('Da rede', b.daRedeKwh),
      cel('Injetada', b.injetadaKwh),
      { rotulo: 'Autossuficiência', valor: nfOu(autoss), unidade: '%', destaque: true },
    ],
    autossuficiencia: autoss,
  };
}

export function subtituloConsumo(d: RelatorioConsumo, mesTexto: string): string {
  return [
    mesTexto,
    d.modalidade,
    d.demandaContratadaKw != null ? `demanda contratada ${nf(d.demandaContratadaKw)} kW` : null,
  ].filter(Boolean).join(' · ');
}

export function resumoConsumo(d: RelatorioConsumo): Array<[string, number | null, string]> {
  const e = d.energiaPorPosto;
  return [
    ['Consumo total', d.consumoTotalKwh, 'kWh'],
    ['Da rede', d.daRedeKwh, 'kWh'],
    ['Da rede no mês anterior', d.daRedeMesAnteriorKwh, 'kWh'],
    ['Energia na ponta', e ? e.pontaKwh : null, 'kWh'],
    ['Energia fora de ponta', e ? e.foraPontaKwh : null, 'kWh'],
    ['Energia no reservado', e ? e.reservadoKwh : null, 'kWh'],
    ['Demanda contratada', d.demandaContratadaKw, 'kW'],
    ['Demanda máxima', d.demandaMaxKw, 'kW'],
    ['Ultrapassagens', d.ultrapassagens, ''],
    ['FP médio', d.fpMedio, ''],
    ['Intervalos com FP < 0,92', d.intervalosFpBaixo, ''],
    ['Reativo excedente', d.reativoExcedenteKvarh, 'kvarh'],
    ['Reativo indutivo', d.reativoIndutivoPct, '%'],
    ['Carga de base', d.cargaBaseKw, 'kW'],
    ['Geração', d.balanco.geracaoKwh, 'kWh'],
    ['Autoconsumo', d.balanco.autoconsumoKwh, 'kWh'],
    ['Injetada', d.balanco.injetadaKwh, 'kWh'],
    ['Autossuficiência', balanco(d).autossuficiencia, '%'],
  ];
}
