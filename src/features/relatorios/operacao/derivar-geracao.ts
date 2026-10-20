import type { RelatorioGeracao } from './tipos';
import type { Indicador } from './documento';
import {
  TRACO, dataCurta, desvio, energia, energiaTexto, hora, juntarE, nf, nfOu, nomeMes, partes, reais, somarMes,
  tetoRedondo, SEMANA_LONGA,
} from './formatos';
import { COR } from './tema';

export const LIMIAR_GERACAO = {
  /** Dia (ou mês) abaixo desta razão gerado/esperado fica laranja. */
  razaoMin: 0.9,
  /** Inversor com desvio ≤ −5% da média fica laranja. */
  desvioInversorPct: -5,
} as const;

export function indicadoresGeracao(d: RelatorioGeracao): Indicador[] {
  const mesAnt = nomeMes(somarMes(d.cabecalho.mes, -1));
  const e = energia(d.energiaKwh);
  const varAnt = d.energiaMesAnteriorKwh != null ? variacaoTexto(d.energiaKwh, d.energiaMesAnteriorKwh, mesAnt) : null;
  const pctEsp = d.esperadoKwh ? (d.energiaKwh / d.esperadoKwh) * 100 : null;
  const rend = d.potenciaKwp ? d.energiaKwh / d.potenciaKwp : null;
  const dias = d.diario.length || 30;
  const auto = d.autoconsumoKwh != null && d.energiaKwh > 0 ? (d.autoconsumoKwh / d.energiaKwh) * 100 : null;
  const inj = d.injetadaKwh != null ? energia(d.injetadaKwh) : null;
  const k: Indicador[] = [
    { rotulo: 'Energia gerada', valor: e.valor, unidade: e.unidade, contexto: varAnt ?? 'sem mês anterior' },
    {
      rotulo: '% do esperado',
      valor: nfOu(pctEsp, 1),
      unidade: '%',
      contexto: d.esperadoKwh != null ? `esperado ${energiaTexto(d.esperadoKwh)}` : 'sem estimativa de esperado',
      alerta: pctEsp != null && pctEsp < LIMIAR_GERACAO.razaoMin * 100,
    },
    {
      rotulo: 'Rendimento',
      valor: nfOu(rend),
      unidade: 'kWh/kWp',
      contexto: rend != null ? `${nf(rend / dias, 1)} kWh/kWp por dia` : 'potência instalada sem cadastro',
    },
    {
      rotulo: 'Disponibilidade',
      valor: nfOu(d.disponibilidadePct, 1),
      unidade: '%',
      contexto: d.diasComInversorParado > 0
        ? `${d.diasComInversorParado} ${d.diasComInversorParado === 1 ? 'dia' : 'dias'} com inversor parado`
        : 'nenhum inversor parado',
      alerta: d.diasComInversorParado > 0,
    },
    {
      rotulo: 'Geração máxima',
      valor: nfOu(d.potenciaMaxKw),
      unidade: 'kW',
      contexto: d.potenciaMaxEm ? `${dataCurta(d.potenciaMaxEm)} · ${hora(d.potenciaMaxEm)}` : 'sem registro',
    },
    {
      rotulo: 'Autoconsumo',
      valor: nfOu(auto),
      unidade: '%',
      contexto: d.autoconsumoKwh != null ? `${energiaTexto(d.autoconsumoKwh)} consumidos no local` : 'sem medição de consumo',
    },
    {
      rotulo: 'Injetada',
      valor: inj ? inj.valor : TRACO,
      unidade: inj?.unidade,
      contexto: d.injecaoMaxKw != null ? `máx. ${nf(d.injecaoMaxKw)} kW` : 'sem medidor de injeção',
    },
  ];
  if (d.tarifaReferencia != null) {
    k.push({ rotulo: 'Valor estimado', valor: reais(d.energiaKwh * d.tarifaReferencia, 0), contexto: 'tarifa de referência' });
  } else {
    const baixos = diasAbaixo(d).length;
    k.push({
      rotulo: 'Dias abaixo de 90%',
      valor: d.fonteEsperado ? nf(baixos) : TRACO,
      contexto: 'do esperado no dia',
      alerta: baixos > 0,
    });
  }
  return k;
}

function variacaoTexto(atual: number, anterior: number, mesAnt: string): string | null {
  if (!anterior) return null;
  return `${desvio((atual / anterior - 1) * 100)} vs ${mesAnt}`;
}

export function diasAbaixo(d: RelatorioGeracao): string[] {
  return d.diario
    .filter((x) => x.geradoKwh != null && x.esperadoKwh && x.geradoKwh / x.esperadoKwh < LIMIAR_GERACAO.razaoMin)
    .map((x) => x.dia);
}

export const DIARIO = { largura: 664, altura: 150 } as const;

export function graficoDiario(d: RelatorioGeracao) {
  const n = d.diario.length;
  if (!n || d.diario.every((x) => x.geradoKwh == null && x.esperadoKwh == null)) return null;
  const maxV = Math.max(...d.diario.flatMap((x) => [x.geradoKwh ?? 0, x.esperadoKwh ?? 0]));
  const MAX = tetoRedondo(maxV * 1.05);
  const H = 148, passo = DIARIO.largura / n;
  const wBarra = Math.min(14, passo * 0.65);
  const barras = d.diario.map((x, i) => {
    const g = x.geradoKwh, ex = x.esperadoKwh;
    const xb = (passo - wBarra) / 2 + i * passo;
    const baixo = g != null && ex ? g / ex < LIMIAR_GERACAO.razaoMin : false;
    return {
      dia: x.dia,
      x: xb,
      w: wBarra,
      y: g != null ? 149 - (g / MAX) * H : null,
      h: g != null ? (g / MAX) * H : 0,
      cor: baixo ? COR.alerta : COR.ok,
      ey: ex != null ? 148 - (ex / MAX) * H : null,
      ex: xb - 2,
      ew: wBarra + 4,
    };
  });
  const emMwh = MAX >= 10_000;
  const rotuloY = emMwh
    ? [`${nf(MAX / 1000, MAX % 1000 ? 1 : 0)} MWh`, nf(MAX / 2000, (MAX / 2) % 1000 ? 1 : 0), '0']
    : [`${nf(MAX)} kWh`, nf(MAX / 2), '0'];
  const ultimo = partes(d.diario[n - 1].dia).dia;
  const marcas = [1, 5, 10, 15, 20, 25].filter((x) => x < ultimo - 2).concat(ultimo).map((x) => String(x).padStart(2, '0'));
  const baixos = diasAbaixo(d);
  const leitura = !d.fonteEsperado
    ? 'Sem estimativa de esperado: barras mostram só o gerado.'
    : baixos.length === 0
      ? 'Todos os dias acima de 90% do esperado.'
      : `${baixos.length} ${baixos.length === 1 ? 'dia abaixo' : 'dias abaixo'} de 90% do esperado: ${juntarE(baixos.slice(0, 6).map((x) => dataCurta(x)))}${baixos.length > 6 ? '…' : ''}.`;
  const aria = !d.fonteEsperado
    ? 'Geração diária do mês; sem estimativa de esperado'
    : baixos.length === 0
      ? 'Geração diária do mês comparada ao esperado; todos os dias acima de 90%'
      : `Geração diária do mês comparada ao esperado; ${baixos.length} ${baixos.length === 1 ? 'dia' : 'dias'} abaixo de 90%`;
  return { MAX, barras, rotuloY, marcas, leitura, aria };
}

export function perdas(d: RelatorioGeracao) {
  const p = d.perdas;
  if (!p) return null;
  const itens = [
    { rotulo: 'Indisponibilidade', kwh: p.indisponibilidadeKwh, cor: COR.alerta, nota: p.notaIndisponibilidade ?? '' },
    { rotulo: 'Limitação externa', kwh: p.limitacaoExternaKwh, cor: COR.limitacaoExterna, nota: 'limite de injeção' },
    { rotulo: 'Limitação de projeto', kwh: p.limitacaoProjetoKwh, cor: COR.neutro, nota: 'informativo' },
    { rotulo: 'Outras perdas', kwh: p.outrasKwh, cor: COR.serie, nota: 'sujeira, strings, temperatura' },
  ];
  const total = itens.reduce((s, x) => s + Math.max(0, x.kwh), 0);
  return { itens, total };
}

export function rankingInversores(d: RelatorioGeracao, limite = 6) {
  const com = d.inversores.filter((x) => x.kwhPorKwp != null) as Array<RelatorioGeracao['inversores'][number] & { kwhPorKwp: number }>;
  if (!com.length) return null;
  const media = com.reduce((s, x) => s + x.kwhPorKwp, 0) / com.length;
  const escala = Math.max(...com.map((x) => x.kwhPorKwp)) * 1.07;
  const linhas = [...com]
    .sort((a, b) => a.kwhPorKwp - b.kwhPorKwp)
    .slice(0, limite)
    .map((x) => {
      const dv = media ? (x.kwhPorKwp / media - 1) * 100 : 0;
      const alerta = dv <= LIMIAR_GERACAO.desvioInversorPct;
      return { nome: x.nome, valor: x.kwhPorKwp, desvio: dv, alerta, pct: (x.kwhPorKwp / escala) * 100, causa: x.causa };
    });
  return { media, total: com.length, linhas };
}

export function destinoTexto(d: RelatorioGeracao): string | null {
  if (d.injecaoMaxKw == null || !d.injecaoMaxEm) return null;
  const p = partes(d.injecaoMaxEm);
  return `Injeção máxima do mês: ${nf(d.injecaoMaxKw)} kW em ${dataCurta(d.injecaoMaxEm)} às ${hora(d.injecaoMaxEm)} (${SEMANA_LONGA[p.semana]}).`;
}

export function subtituloGeracao(d: RelatorioGeracao, mesTexto: string): string {
  return [
    mesTexto,
    d.potenciaKwp != null ? `${nf(d.potenciaKwp)} kWp` : null,
    `${d.inversores.length} ${d.inversores.length === 1 ? 'inversor' : 'inversores'}`,
    d.fonteEsperado === 'satelite' ? 'esperado por satélite' : null,
  ].filter(Boolean).join(' · ');
}

export function resumoGeracao(d: RelatorioGeracao): Array<[string, number | null, string]> {
  const p = d.perdas;
  return [
    ['Potência instalada', d.potenciaKwp, 'kWp'],
    ['Energia gerada', d.energiaKwh, 'kWh'],
    ['Energia do mês anterior', d.energiaMesAnteriorKwh, 'kWh'],
    ['Esperado', d.esperadoKwh, 'kWh'],
    ['% do esperado', d.esperadoKwh ? (d.energiaKwh / d.esperadoKwh) * 100 : null, '%'],
    ['Rendimento', d.potenciaKwp ? d.energiaKwh / d.potenciaKwp : null, 'kWh/kWp'],
    ['Disponibilidade', d.disponibilidadePct, '%'],
    ['Dias com inversor parado', d.diasComInversorParado, 'dias'],
    ['Geração máxima', d.potenciaMaxKw, 'kW'],
    ['Autoconsumo', d.autoconsumoKwh, 'kWh'],
    ['Injetada', d.injetadaKwh, 'kWh'],
    ['Injeção máxima', d.injecaoMaxKw, 'kW'],
    ['Perda por indisponibilidade', p ? p.indisponibilidadeKwh : null, 'kWh'],
    ['Perda por limitação externa', p ? p.limitacaoExternaKwh : null, 'kWh'],
    ['Perda por limitação de projeto', p ? p.limitacaoProjetoKwh : null, 'kWh'],
    ['Outras perdas', p ? p.outrasKwh : null, 'kWh'],
    ...(d.tarifaReferencia != null
      ? ([
          ['Tarifa de referência', d.tarifaReferencia, 'R$/kWh'],
          ['Valor estimado', d.energiaKwh * d.tarifaReferencia, 'R$'],
        ] as Array<[string, number | null, string]>)
      : []),
  ];
}
