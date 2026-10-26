// Monta as séries dos gráficos do sinóptico no formato do bklit: ponto com
// `date` (Date em horário local), ordenado no tempo, sem `null` (valor não
// numérico vira zero no desenho da linha, então ponto sem leitura fica de fora
// e o eixo é fixado por `xDomain`).
import type { PeriodoFiltro, PontoDemanda as PontoDemandaApi } from '@/hooks/useDemandaAgregada';
import { corSerie } from '@/components/graficos/cores';
import { ehDiaAtual, parseDiaLocal } from './periodo';
import { MESES_PT_CURTOS } from './formatos';

export type Dominio = [Date, Date];

/** Limite acima do contratado: geração 1% da demanda de geração; carga 5% (NEXON-14). */
export const PERCENTUAL_LIMITE_GERACAO = 1;
export const PERCENTUAL_LIMITE_CARGA = 5;

/** Ponto da série de demanda (período "dia" ou personalizado). */
export interface PontoDemanda extends Record<string, unknown> {
  date: Date;
  potencia: number;
  /** Linhas de referência — só no período "dia". */
  valorContratado?: number;
  valorAdicional?: number;
  /** Fluxo separado: consumo para cima (≥ 0), geração para baixo (≤ 0). */
  geracao?: number;
  consumo?: number;
  /** Contratado da carga, desenhado no lado positivo (consumo). Os de geração ficam negativos. */
  valorContratadoCarga?: number;
  valorAdicionalCarga?: number;
}

/** Barra de energia: por dia no mês, por mês no ano. */
export interface PontoEnergia extends Record<string, unknown> {
  label: string;
  energia: number;
  /** Energia consumida (kWh, positiva) — só quando há equipamento de consumo. */
  consumo?: number;
}

export type Fase = 'A' | 'B' | 'C';
export const FASES: readonly Fase[] = ['A', 'B', 'C'];
export type FasesAtivas = Record<Fase, boolean>;
/** Cor fixa de cada fase (sequência do tema; nunca branco). */
export const COR_FASE: Record<Fase, string> = { A: corSerie(0), B: corSerie(1), C: corSerie(2) };

export type Grandeza = 'tensao' | 'fp';

/** Leitura do medidor (M160/Power Meter) como sai do useDadosM160. */
export interface LeituraM160 {
  timestamp: string;
  tensaoA: number;
  tensaoB: number;
  tensaoC: number;
  fatorPotenciaA: number;
  fatorPotenciaB: number;
  fatorPotenciaC: number;
}

/** Ponto por fase (tensão em V ou fator de potência). */
export interface PontoFases extends Record<string, unknown> {
  date: Date;
  A: number;
  B: number;
  C: number;
}

const UM_DIA_MS = 86_400_000;
const UMA_HORA_MS = 3_600_000;

const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const ordenar = <T extends { date: Date }>(pontos: T[]): T[] =>
  pontos.sort((a, b) => a.date.getTime() - b.date.getTime());

/**
 * Eixo do dia: 00:00 até 24:00 num dia passado. No dia corrente vai até agora
 * (mínimo de 1 h, para não colapsar logo após a meia-noite) ou até o último
 * ponto, o que for mais tarde.
 */
export function dominioDoDia(dia: Date, ateAgora: boolean, ultimoPonto?: Date): Dominio {
  const inicio = new Date(dia);
  inicio.setHours(0, 0, 0, 0);
  const fimDoDia = inicio.getTime() + UM_DIA_MS;
  if (!ateAgora) return [inicio, new Date(fimDoDia)];
  const fim = Math.max(Date.now(), inicio.getTime() + UMA_HORA_MS, ultimoPonto?.getTime() ?? 0);
  return [inicio, new Date(Math.min(fim, fimDoDia))];
}

/**
 * Série de potência (kW). No período "dia" o eixo é o dia inteiro e só entram
 * leituras daquele dia; no personalizado o eixo é a extensão dos dados.
 */
export function montarPontosDemanda(
  dados: PontoDemandaApi[],
  periodo: PeriodoFiltro,
  valorContratado: number,
  percentualAdicional: number,
): { pontos: PontoDemanda[]; dominio?: Dominio } {
  if (periodo.tipo === 'dia') {
    const dia = parseDiaLocal(periodo.data) ?? new Date();
    dia.setHours(0, 0, 0, 0);
    const inicio = dia.getTime();
    const fimDoDia = inicio + UM_DIA_MS;
    const valorAdicional = valorContratado * (1 + percentualAdicional / 100);
    const pontos = ordenar(
      dados.flatMap((item): PontoDemanda[] => {
        const potencia = numero(item.potencia_kw);
        if (!item.timestamp || potencia === null) return [];
        const date = new Date(item.timestamp);
        const t = date.getTime();
        if (Number.isNaN(t) || t < inicio || t >= fimDoDia) return [];
        return [{ date, potencia, valorContratado, valorAdicional }];
      }),
    );
    return { pontos, dominio: dominioDoDia(dia, ehDiaAtual(periodo), pontos[pontos.length - 1]?.date) };
  }

  const pontos = ordenar(
    dados.flatMap((item): PontoDemanda[] => {
      const potencia = numero(item.potencia_kw);
      if (!item.timestamp || potencia === null) return [];
      const date = new Date(item.timestamp);
      if (Number.isNaN(date.getTime())) return [];
      return [{ date, potencia }];
    }),
  );
  return { pontos };
}

/**
 * Junta as séries de geração e de consumo (cada uma montada por montarPontosDemanda)
 * num eixo só: consumo positivo (para cima), geração negativa (para baixo) — convenção
 * do medidor da concessionária. As consultas são separadas, então os instantes nem
 * sempre coincidem — cada série repete o último valor até o próximo ponto dela (0 antes
 * do primeiro). `potencia` = líquido da rede (consumo − geração), usado pelo zoom/brush.
 * `interpolar`: entre dois pontos da série o valor é a reta entre eles (séries com passos
 * diferentes, ex.: geração de 15 min × carga de 5 min, sem degrau).
 */
export function mesclarFluxo(
  ger: PontoDemanda[],
  con: PontoDemanda[],
  carga?: { contratado: number; adicional: number },
  opcoes: { interpolar?: boolean } = {},
): PontoDemanda[] {
  const tempos = Array.from(new Set([...ger, ...con].map((p) => p.date.getTime()))).sort((a, b) => a - b);
  const refGer = ger[0];
  let ig = 0;
  let ic = 0;
  let g = 0;
  let c = 0;
  return tempos.map((t) => {
    // `g` guarda o valor COM sinal da série de geração: inversor é sempre ≥ 0, mas um medidor
    // bidirecional (A966/SSU no ramal de entrada) entra como líquido exportado e fica
    // negativo quando a usina importa. Exportação → geração (para baixo); importação → consumo.
    while (ig < ger.length && ger[ig].date.getTime() <= t) g = ger[ig++].potencia;
    while (ic < con.length && con[ic].date.getTime() <= t) c = Math.abs(con[ic++].potencia);
    if (opcoes.interpolar) {
      if (ig > 0 && ig < ger.length) g = entre(ger[ig - 1], ger[ig], t);
      if (ic > 0 && ic < con.length) c = Math.abs(entre(con[ic - 1], con[ic], t));
    }
    const exportado = Math.max(0, g);
    const importado = Math.max(0, -g);
    const consumo = c + importado;
    const ponto: PontoDemanda = { date: new Date(t), potencia: consumo - exportado, consumo };
    if (ger.length) ponto.geracao = -exportado;
    if (refGer?.valorContratado != null) {
      ponto.valorContratado = -refGer.valorContratado;
      ponto.valorAdicional = refGer.valorAdicional != null ? -refGer.valorAdicional : undefined;
    }
    if (carga && con.length) {
      ponto.valorContratadoCarga = carga.contratado;
      ponto.valorAdicionalCarga = carga.adicional;
    }
    return ponto;
  });
}

/** Esperado mais próximo do instante (até 7,5 min), sem sinal. */
export function esperadoNoInstante(pontos: Array<{ date: Date; valor: number | null }>, date: Date): number | null {
  const t = date.getTime();
  let melhor: { date: Date; valor: number | null } | null = null;
  for (const e of pontos) {
    const d = Math.abs(e.date.getTime() - t);
    if (d <= 7.5 * 60_000 && (!melhor || d < Math.abs(melhor.date.getTime() - t))) melhor = e;
  }
  return melhor?.valor == null ? null : Math.abs(melhor.valor);
}

/** Valor da reta entre dois pontos no instante `t` (a ≤ t < b). */
function entre(a: PontoDemanda, b: PontoDemanda, t: number): number {
  const t0 = a.date.getTime();
  const t1 = b.date.getTime();
  if (t1 <= t0) return a.potencia;
  return a.potencia + ((b.potencia - a.potencia) * (t - t0)) / (t1 - t0);
}

/** Barras de energia (kWh): por dia no mês, por mês no ano. */
export function montarPontosEnergia(dados: PontoDemandaApi[], tipo: 'mes' | 'ano'): PontoEnergia[] {
  return dados.map((item) => ({
    label:
      tipo === 'mes'
        ? String(item.dia ?? '')
        : item.mes_nome
          ? item.mes_nome.slice(0, 3)
          : MESES_PT_CURTOS[(item.mes_numero ?? 1) - 1],
    energia: numero(item.energia_kwh) ?? 0,
  }));
}

/** Tensão ou FP por fase do dia corrente (o endpoint grafico-dia é sempre hoje). */
export function montarPontosFases(dados: LeituraM160[], grandeza: Grandeza): { pontos: PontoFases[]; dominio: Dominio } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = hoje.getTime();
  const fimDoDia = inicio + UM_DIA_MS;
  const pontos = ordenar(
    dados.flatMap((item): PontoFases[] => {
      const date = new Date(item.timestamp);
      const t = date.getTime();
      if (Number.isNaN(t) || t < inicio || t >= fimDoDia) return [];
      return [
        grandeza === 'tensao'
          ? { date, A: numero(item.tensaoA) ?? 0, B: numero(item.tensaoB) ?? 0, C: numero(item.tensaoC) ?? 0 }
          : {
              date,
              A: numero(item.fatorPotenciaA) ?? 0,
              B: numero(item.fatorPotenciaB) ?? 0,
              C: numero(item.fatorPotenciaC) ?? 0,
            },
      ];
    }),
  );
  return { pontos, dominio: dominioDoDia(hoje, true, pontos[pontos.length - 1]?.date) };
}

/** Barras de geração e consumo lado a lado (mês/ano). `energia` = gerada, `consumo` = consumida. */
export function mesclarEnergia(ger: PontoEnergia[], con: PontoEnergia[]): PontoEnergia[] {
  const porLabel = new Map<string, PontoEnergia>();
  for (const p of ger) porLabel.set(p.label, { label: p.label, energia: p.energia });
  for (const p of con) {
    const atual = porLabel.get(p.label) ?? { label: p.label, energia: 0 };
    atual.consumo = Math.abs(p.energia);
    porLabel.set(p.label, atual);
  }
  return [...porLabel.values()];
}
