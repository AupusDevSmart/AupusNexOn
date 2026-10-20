// Monta as séries dos gráficos do sinóptico no formato do bklit: ponto com
// `date` (Date em horário local), ordenado no tempo, sem `null` (valor não
// numérico vira zero no desenho da linha, então ponto sem leitura fica de fora
// e o eixo é fixado por `xDomain`).
import type { PeriodoFiltro, PontoDemanda as PontoDemandaApi } from '@/hooks/useDemandaAgregada';
import { corSerie } from '@/components/graficos/cores';
import { ehDiaAtual, parseDiaLocal } from './periodo';
import { MESES_PT_CURTOS } from './formatos';

export type Dominio = [Date, Date];

/** Ponto da série de demanda (período "dia" ou personalizado). */
export interface PontoDemanda extends Record<string, unknown> {
  date: Date;
  potencia: number;
  /** Linhas de referência — só no período "dia". */
  valorContratado?: number;
  valorAdicional?: number;
  /** Fluxo separado: geração para cima (≥ 0), consumo para baixo (≤ 0). */
  geracao?: number;
  consumo?: number;
  /** Contratado da carga, desenhado no lado negativo (consumo). */
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
 * num eixo só: geração positiva, consumo negativo. As consultas são separadas, então
 * os instantes nem sempre coincidem — cada série repete o último valor até o próximo
 * ponto dela (0 antes do primeiro). `potencia` = saldo (geração − consumo), usado
 * pelo zoom/brush.
 */
export function mesclarFluxo(
  ger: PontoDemanda[],
  con: PontoDemanda[],
  carga?: { contratado: number; adicional: number },
): PontoDemanda[] {
  const tempos = Array.from(new Set([...ger, ...con].map((p) => p.date.getTime()))).sort((a, b) => a - b);
  const refGer = ger[0];
  let ig = 0;
  let ic = 0;
  let g = 0;
  let c = 0;
  return tempos.map((t) => {
    while (ig < ger.length && ger[ig].date.getTime() <= t) g = ger[ig++].potencia;
    while (ic < con.length && con[ic].date.getTime() <= t) c = -Math.abs(con[ic++].potencia);
    const ponto: PontoDemanda = { date: new Date(t), potencia: g + c, consumo: c };
    if (ger.length) ponto.geracao = g;
    if (refGer?.valorContratado != null) {
      ponto.valorContratado = refGer.valorContratado;
      ponto.valorAdicional = refGer.valorAdicional;
    }
    if (carga && con.length) {
      ponto.valorContratadoCarga = -carga.contratado;
      ponto.valorAdicionalCarga = -carga.adicional;
    }
    return ponto;
  });
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
