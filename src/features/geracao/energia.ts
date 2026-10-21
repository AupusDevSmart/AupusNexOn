import { nice, tickStep } from 'd3-array';
import type { PeriodoFiltro, PontoDemanda as PontoDemandaApi } from '@/hooks/useDemandaAgregada';
import {
  mesclarFluxo,
  montarPontosDemanda,
  PERCENTUAL_LIMITE_CARGA,
  PERCENTUAL_LIMITE_GERACAO,
  type Dominio,
  type PontoDemanda,
} from '@/features/supervisorio/components/sinoptico-graficos-v2/dados';
import type { ReferenciasDemanda } from '@/features/supervisorio/components/sinoptico-graficos-v2/GraficoDemanda';
import type { AnaliseGeracao, PeriodoAnalise, PontoAnalise } from './api';

/**
 * Cartão "Energia" da Visão Geral (NEXON-37): funções puras que juntam a geração da análise
 * (já na fonte escolhida, TON ou nuvem) com a carga da Demanda (equipamentos de consumo da
 * configuração de demanda). Dia = potência (kW); Semana/Mês/Ano/Total = energia (kWh).
 */

export type Serie = 'carga' | 'geracao' | 'esperado';
export type SeriesLigadas = Record<Serie, boolean>;
/** fluxo = carga e geração juntas, espelhadas (consumo para cima, geração para baixo). */
export type ModoEnergia = 'fluxo' | 'geracao' | 'carga';

export interface SeriesEfetivas extends SeriesLigadas {
  modo: ModoEnergia;
}

/**
 * O que aparece de fato: carga só se existe e está ligada; geração sempre que a carga não
 * aparece (nunca gráfico vazio); esperado só com fonte de irradiância e geração na tela.
 */
export function seriesEfetivas(ligadas: SeriesLigadas, disponivel: SeriesLigadas): SeriesEfetivas {
  const carga = disponivel.carga && ligadas.carga;
  const geracao = !carga || ligadas.geracao;
  const esperado = disponivel.esperado && ligadas.esperado && geracao;
  return { carga, geracao, esperado, modo: carga && geracao ? 'fluxo' : carga ? 'carga' : 'geracao' };
}

/** Liga/desliga uma série. Carga e geração nunca ficam as duas desligadas. */
export function alternarSerie(ligadas: SeriesLigadas, qual: Serie, disponivel: SeriesLigadas): SeriesLigadas {
  const ef = seriesEfetivas(ligadas, disponivel);
  if (qual === 'esperado') return { ...ligadas, esperado: !ef.esperado };
  if (qual === 'geracao') {
    if (!disponivel.carga) return ligadas; // geração é a única série: não desliga
    if (ef.geracao && !ef.carga) return { ...ligadas, geracao: false, carga: true };
    return { ...ligadas, geracao: !ef.geracao };
  }
  if (!disponivel.carga) return ligadas;
  if (ef.carga && !ef.geracao) return { ...ligadas, carga: false, geracao: true };
  return { ...ligadas, carga: !ef.carga };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Consultas de consumo (endpoints da Demanda) que cobrem o período da análise. Total não
 * tem agregado de consumo na API (null). A semana pode cruzar dois meses: duas consultas.
 */
export function periodosConsumo(a: Pick<AnaliseGeracao, 'periodo' | 'referencia' | 'inicio' | 'fim'>): PeriodoFiltro[] {
  if (a.periodo === 'dia') return [{ tipo: 'dia', data: a.referencia }];
  if (a.periodo === 'ano') return [{ tipo: 'ano', ano: a.inicio.slice(0, 4) }];
  if (a.periodo === 'mes') return [{ tipo: 'mes', mes: a.inicio.slice(0, 7) }];
  if (a.periodo === 'semana') {
    const ini = a.inicio.slice(0, 7);
    const fim = a.fim.slice(0, 7);
    return ini === fim ? [{ tipo: 'mes', mes: ini }] : [{ tipo: 'mes', mes: ini }, { tipo: 'mes', mes: fim }];
  }
  return [];
}

/**
 * kWh consumido por dia ('YYYY-MM-DD', consulta de mês) ou por mês ('YYYY-MM', consulta de
 * ano). O consumo vem negativo do backend (sinal −1): aqui sempre positivo.
 */
export function consumoPorChave(dados: PontoDemandaApi[], periodo: PeriodoFiltro, mapa = new Map<string, number>()): Map<string, number> {
  for (const d of dados) {
    const v = Number(d.energia_kwh);
    if (!Number.isFinite(v)) continue;
    let chave: string | null = null;
    if (periodo.tipo === 'mes' && periodo.mes && d.dia != null) chave = `${periodo.mes}-${pad2(d.dia)}`;
    else if (periodo.tipo === 'ano' && periodo.ano && d.mes_numero != null) chave = `${periodo.ano}-${pad2(d.mes_numero)}`;
    if (chave) mapa.set(chave, Math.abs(v));
  }
  return mapa;
}

/** Chave do ponto da análise no mapa de consumo: dia na semana/mês, mês no ano. */
export const chaveConsumo = (periodo: PeriodoAnalise, p: Pick<PontoAnalise, 'data'>) => (periodo === 'ano' ? p.data.slice(0, 7) : p.data);

// ---------------------------------------------------------------- Dia (kW)

const FMT_BRASILIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/**
 * Instante (ISO com fuso, "Z" ou Date) → relógio de Brasília sem fuso ("2026-10-20T06:15:00"),
 * que o `new Date()` lê como horário local. O eixo do dia é montado em horário local
 * (`parseDiaLocal`): quem abre fora do fuso de Brasília vê 06:15 onde a usina gerou às 06:15,
 * como o `dataLocal()` antigo da análise. Geração e carga passam pelas mesmas mãos.
 */
export function horaBrasilia(instante: string | Date | undefined): string | undefined {
  if (instante == null) return undefined;
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return undefined;
  const p = Object.fromEntries(FMT_BRASILIA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

export interface PontoEsperado {
  date: Date;
  valor: number | null;
}

export interface DiaEnergia {
  pontos: PontoDemanda[];
  dominio?: Dominio;
  referencias?: ReferenciasDemanda;
  /** Já com o sinal do desenho (negativo no espelhado). Vazio = sem esperado. */
  esperado: PontoEsperado[];
}

/**
 * Curva do dia: geração da análise (15 min; nuvem = horária) e carga da Demanda (5 min),
 * com contratado + tolerância (carga +5%, geração +1%) como a Demanda já faz.
 */
export function montarDiaEnergia({
  data,
  geracao,
  consumo,
  ef,
  contratadoGeracao,
  contratadoCarga,
}: {
  data: string;
  geracao: PontoAnalise[];
  consumo: PontoDemandaApi[];
  ef: SeriesEfetivas;
  contratadoGeracao: number | null;
  contratadoCarga: number | null;
}): DiaEnergia {
  const periodo: PeriodoFiltro = { tipo: 'dia', data };
  const gerApi: PontoDemandaApi[] = geracao
    .filter((p) => !p.futuro && p.real_kw != null && p.inicio)
    .map((p) => ({ timestamp: horaBrasilia(p.inicio), potencia_kw: p.real_kw as number, energia_kwh: 0 }));
  const conApi = consumo.map((d) => ({
    ...d,
    timestamp: horaBrasilia(d.timestamp),
    potencia_kw: d.potencia_kw == null ? d.potencia_kw : Math.abs(Number(d.potencia_kw)),
  }));
  const refGer = contratadoGeracao
    ? { contratado: contratadoGeracao, adicional: contratadoGeracao * (1 + PERCENTUAL_LIMITE_GERACAO / 100), percentualAdicional: PERCENTUAL_LIMITE_GERACAO }
    : undefined;
  const refCarga = contratadoCarga
    ? { contratado: contratadoCarga, adicional: contratadoCarga * (1 + PERCENTUAL_LIMITE_CARGA / 100), percentualAdicional: PERCENTUAL_LIMITE_CARGA }
    : undefined;

  let base: { pontos: PontoDemanda[]; dominio?: Dominio; referencias?: ReferenciasDemanda };
  if (ef.modo === 'carga') {
    base = { ...montarPontosDemanda(conApi, periodo, contratadoCarga ?? 0, PERCENTUAL_LIMITE_CARGA), referencias: refCarga };
  } else if (ef.modo === 'geracao') {
    base = { ...montarPontosDemanda(gerApi, periodo, contratadoGeracao ?? 0, PERCENTUAL_LIMITE_GERACAO), referencias: refGer };
  } else {
    const g = montarPontosDemanda(gerApi, periodo, contratadoGeracao ?? 0, PERCENTUAL_LIMITE_GERACAO);
    const c = montarPontosDemanda(conApi, periodo, 0, 0);
    const pontos = mesclarFluxo(g.pontos, c.pontos, refCarga, { interpolar: true });
    const dominio = g.dominio && c.dominio ? (g.dominio[1] >= c.dominio[1] ? g.dominio : c.dominio) : g.dominio ?? c.dominio;
    base = { pontos, dominio, referencias: refGer };
  }

  const sinal = ef.modo === 'fluxo' ? -1 : 1;
  const esperado: PontoEsperado[] = ef.esperado
    ? geracao
        .filter((p) => !p.futuro && horaBrasilia(p.inicio))
        .map((p) => ({ date: new Date(horaBrasilia(p.inicio) as string), valor: p.esperado_kw == null ? null : sinal * p.esperado_kw }))
    : [];
  const tetoEsperado = Math.max(0, ...esperado.map((e) => Math.abs(e.valor ?? 0)));
  // Chave constante que só estica o eixo até o esperado (o bklit não tem yDomain).
  const pontos = tetoEsperado > 0 ? base.pontos.map((p) => ({ ...p, tetoEsperado: sinal * tetoEsperado })) : base.pontos;
  return { ...base, pontos, esperado: esperado.some((e) => e.valor != null) ? esperado : [] };
}

// ---------------------------------------------------------------- Semana / Mês / Ano / Total (kWh)

/** Linha do BarChart. Valores crus para o tooltip; chaves de desenho conforme o modo. */
export interface LinhaEnergia extends Record<string, unknown> {
  rotulo: string;
  ponto: PontoAnalise;
  geracao: number | null;
  consumo: number | null;
  esperado: number | null;
  /** Desenho: base transparente (espelhado), barras, folga até o esperado, marcador. */
  base?: number;
  barraGeracao?: number | null;
  barraConsumo?: number | null;
  folga?: number;
  marcaEsperado: number | null;
}

/**
 * Linha do zero do espelhado. O BarChart do bklit não tem barra negativa: a geração "pende"
 * de uma linha em `zero` (base transparente empilhada) e o consumo sobe a partir dela. O zero
 * cai num múltiplo do passo dos ticks do eixo (domínio [0, máx × 1,1] arredondado, como o
 * BarChart faz), para os rótulos |v − zero| saírem redondos.
 */
export function zeroEspelho(maxGeracao: number, maxConsumo: number, numTicks = 4): number {
  if (!(maxGeracao > 0)) return 0;
  let zero = maxGeracao;
  for (let i = 0; i < 8; i++) {
    const [, topo] = nice(0, (zero + Math.max(0, maxConsumo)) * 1.1, 10);
    const passo = tickStep(0, topo, numTicks);
    const novo = Math.ceil(maxGeracao / passo - 1e-9) * passo;
    if (Math.abs(novo - zero) < 1e-9) break;
    zero = novo;
  }
  return zero;
}

export function montarBarrasEnergia(
  pontos: PontoAnalise[],
  periodo: PeriodoAnalise,
  consumo: Map<string, number>,
  ef: SeriesEfetivas,
  numTicks = 4,
): { linhas: LinhaEnergia[]; zero: number } {
  const crus = pontos.map((p) => {
    const con = ef.carga && !p.futuro ? consumo.get(chaveConsumo(periodo, p)) ?? null : null;
    return { p, ger: p.real_kwh, con, esp: ef.esperado ? p.esperado_kwh : null };
  });
  const zero = ef.modo === 'fluxo'
    ? zeroEspelho(Math.max(0, ...crus.map((c) => Math.max(c.ger ?? 0, c.esp ?? 0))), Math.max(0, ...crus.map((c) => c.con ?? 0)), numTicks)
    : 0;
  const linhas = crus.map(({ p, ger, con, esp }): LinhaEnergia => {
    const linha: LinhaEnergia = { rotulo: p.rotulo, ponto: p, geracao: ger, consumo: con, esperado: esp, marcaEsperado: null };
    if (ef.modo === 'geracao') {
      linha.barraGeracao = ger;
      // Folga empilhada e transparente: estica o eixo até o esperado sem alargar a barra.
      linha.folga = Math.max(0, (esp ?? 0) - (ger ?? 0));
      linha.marcaEsperado = esp;
    } else if (ef.modo === 'carga') {
      linha.barraConsumo = con;
    } else {
      linha.base = zero - (ger ?? 0);
      linha.barraGeracao = ger ?? 0;
      linha.barraConsumo = con;
      linha.marcaEsperado = esp == null ? null : zero - esp;
    }
    return linha;
  });
  return { linhas, zero };
}

/** Soma do consumo nos pontos do período (cabeçalho do cartão). */
export function consumoNoPeriodo(pontos: PontoAnalise[], periodo: PeriodoAnalise, consumo: Map<string, number>): number | null {
  let soma = 0;
  let algum = false;
  for (const p of pontos) {
    const v = consumo.get(chaveConsumo(periodo, p));
    if (v != null) { soma += v; algum = true; }
  }
  return algum ? soma : null;
}
