import type { RelatorioRecargas } from './tipos';
import type { Indicador } from './documento';
import { desvio, duracaoMin, nf, nfAuto, nomeMes, reais, somarMes } from './formatos';

/** "101" na tabela geral; "Apto 101" nos blocos por carregador (como no mockup). */
export const aptoCurto = (a: string) => a.replace(/^ap(to|artamento)?\.?\s*/i, '');
export const aptoLongo = (a: string) => `Apto ${aptoCurto(a)}`;

export interface LinhaApartamento {
  apartamento: string;
  morador: string;
  recargas: number;
  kwh: number;
  minutos: number;
  valor: number | null;
}

/** Soma por apartamento (todos os carregadores), ordenado pelo número do apartamento. */
export function porApartamento(d: RelatorioRecargas): LinhaApartamento[] {
  const by = new Map<string, LinhaApartamento>();
  for (const c of d.carregadores) {
    for (const m of c.moradores) {
      const a = by.get(m.apartamento) ?? { apartamento: m.apartamento, morador: m.morador, recargas: 0, kwh: 0, minutos: 0, valor: null };
      a.recargas += m.recargas;
      a.kwh += m.kwh;
      a.minutos += m.minutos;
      by.set(m.apartamento, a);
    }
  }
  const lista = [...by.values()].sort((a, b) => a.apartamento.localeCompare(b.apartamento, 'pt-BR', { numeric: true }));
  if (d.valorKwh != null) for (const a of lista) a.valor = a.kwh * d.valorKwh;
  return lista;
}

export function totaisRecargas(d: RelatorioRecargas) {
  const lista = porApartamento(d);
  const kwh = lista.reduce((s, a) => s + a.kwh, 0);
  const recargas = lista.reduce((s, a) => s + a.recargas, 0);
  const minutos = lista.reduce((s, a) => s + a.minutos, 0);
  return { apartamentos: lista.length, kwh, recargas, minutos, valor: d.valorKwh != null ? kwh * d.valorKwh : null };
}

export function indicadoresRecargas(d: RelatorioRecargas): Indicador[] {
  const t = totaisRecargas(d);
  const mesAnt = nomeMes(somarMes(d.cabecalho.mes, -1));
  const primeiro: Indicador = t.valor != null
    ? { rotulo: 'Valor total a cobrar', valor: reais(t.valor), contexto: `estimado · ${t.apartamentos} ${t.apartamentos === 1 ? 'apartamento' : 'apartamentos'}` }
    : { rotulo: 'Tempo de recarga', valor: duracaoMin(t.minutos), contexto: `${t.apartamentos} ${t.apartamentos === 1 ? 'apartamento' : 'apartamentos'}` };
  return [
    primeiro,
    {
      rotulo: 'Energia',
      valor: nf(t.kwh, 1),
      unidade: 'kWh',
      contexto: d.energiaMesAnteriorKwh ? `${desvio((t.kwh / d.energiaMesAnteriorKwh - 1) * 100, 0)} vs ${mesAnt}` : 'sem mês anterior',
    },
    { rotulo: 'Recargas', valor: nf(t.recargas), contexto: t.recargas ? `${nf(t.kwh / t.recargas, 1)} kWh por recarga` : 'nenhuma no mês' },
    { rotulo: 'Moradores ativos', valor: nf(t.apartamentos), contexto: 'com recarga no mês' },
  ];
}

export function blocosCarregadores(d: RelatorioRecargas) {
  return d.carregadores.map((c) => {
    const recargas = c.moradores.reduce((s, m) => s + m.recargas, 0);
    const kwh = c.moradores.reduce((s, m) => s + m.kwh, 0);
    const sub = [
      c.disponibilidadePct != null ? `Disponibilidade ${nfAuto(c.disponibilidadePct)}%` : null,
      `${recargas} ${recargas === 1 ? 'recarga' : 'recargas'}`,
      c.chamadosNoMes > 0 ? `${c.chamadosNoMes} ${c.chamadosNoMes === 1 ? 'chamado' : 'chamados'} no mês` : null,
    ].filter(Boolean).join(' · ');
    return {
      id: c.equipamentoId,
      nome: c.nome,
      potencia: c.potenciaKw != null ? `${nfAuto(c.potenciaKw)} kW` : '',
      sub,
      linhas: c.moradores.map((m) => ({ ...m, valor: d.valorKwh != null ? m.kwh * d.valorKwh : null })),
      recargas,
      kwh,
      valor: d.valorKwh != null ? kwh * d.valorKwh : null,
    };
  });
}

export function subtituloRecargas(d: RelatorioRecargas, mesTexto: string): string {
  const n = d.carregadores.length;
  return [
    mesTexto,
    `${n} ${n === 1 ? 'carregador' : 'carregadores'}`,
    d.valorKwh != null ? `valor do kWh ${reais(d.valorKwh)}` : null,
    d.valorKwh != null ? `para cobrança no boleto de ${nomeMes(somarMes(d.cabecalho.mes, 1))}` : null,
  ].filter(Boolean).join(' · ');
}

export function resumoRecargas(d: RelatorioRecargas): Array<[string, number | null, string]> {
  const t = totaisRecargas(d);
  return [
    ['Carregadores', d.carregadores.length, ''],
    ['Apartamentos', t.apartamentos, ''],
    ['Recargas', t.recargas, ''],
    ['Energia', t.kwh, 'kWh'],
    ['Energia do mês anterior', d.energiaMesAnteriorKwh, 'kWh'],
    ['Tempo de recarga', t.minutos, 'min'],
    ...(d.valorKwh != null
      ? ([
          ['Valor do kWh', d.valorKwh, 'R$/kWh'],
          ['Valor total a cobrar', t.valor, 'R$'],
        ] as Array<[string, number | null, string]>)
      : []),
  ];
}
