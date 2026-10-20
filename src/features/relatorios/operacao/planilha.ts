/**
 * Planilha (XLSX) dos relatórios de operação: dados brutos, números crus nas células.
 * Uma aba por tabela + "Resumo" com os indicadores.
 */
import type {
  ChamadoRelatorio, RelatorioConsumo, RelatorioGeracao, RelatorioIrrigacao, RelatorioOperacao, RelatorioRecargas,
  TipoRelatorioOperacao,
} from './tipos';
import { dataHoraPlanilha, slug } from './formatos';
import { calcularPivos, resumoIrrigacao } from './derivar-irrigacao';
import { resumoGeracao } from './derivar-geracao';
import { resumoConsumo } from './derivar-consumo';
import { porApartamento, resumoRecargas } from './derivar-recargas';
import { chamadoAtendido } from './derivar-chamados';

export type Celula = string | number | null;
export interface Aba {
  nome: string;
  linhas: Celula[][];
}

const arred = (v: number | null | undefined, d = 2): number | null =>
  v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;

function abaResumo(d: RelatorioOperacao, linhas: Array<[string, number | null, string]>): Aba {
  const c = d.cabecalho;
  return {
    nome: 'Resumo',
    linhas: [
      ['Planta', c.plantaNome, null],
      ['Unidade', c.unidadeNome, null],
      ['Mês', c.mes, null],
      ['Gerado em', dataHoraPlanilha(c.geradoEm), null],
      [],
      ['Indicador', 'Valor', 'Unidade'],
      ...linhas.map(([k, v, u]) => [k, arred(v, 4), u] as Celula[]),
    ],
  };
}

function abaChamados(chamados: ChamadoRelatorio[]): Aba {
  return {
    nome: 'Chamados',
    linhas: [
      ['Número', 'Equipamento', 'Título', 'Aberto em', 'Aberto por', 'Papel', 'Notificado', 'Status', 'Atendido em', 'Situação'],
      ...chamados.map((c) => [
        c.numero,
        c.equipamento,
        c.titulo,
        dataHoraPlanilha(c.abertoEm),
        c.abertoPor,
        c.abertoPorPapel,
        c.notificado.join(' · '),
        c.status,
        c.atendidoEm ? dataHoraPlanilha(c.atendidoEm) : null,
        chamadoAtendido(c) ? 'Atendido' : 'Em aberto',
      ]),
    ],
  };
}

function abasIrrigacao(d: RelatorioIrrigacao): Aba[] {
  const { pivos } = calcularPivos(d);
  const rs = d.tarifaKwh != null;
  return [
    abaResumo(d, resumoIrrigacao(d)),
    {
      nome: 'Pivôs',
      linhas: [
        ['Pivô', 'Área (ha)', 'Cultura', 'Voltas', 'Lâmina (mm)', 'Programado (mm)', 'Prog. (%)', 'Horas', 'kWh', 'kWh/mm/ha',
          ...(rs ? ['R$/mm/ha'] : []), 'Paradas', 'Chamados abertos', 'Chamados atendidos', 'Disponibilidade (%)'],
        ...pivos.map((p) => [
          p.pivo.nome, p.pivo.areaHa, p.pivo.cultura, p.pivo.voltas, p.pivo.laminaMm, p.pivo.programadoMm, arred(p.progPct, 1),
          p.pivo.horas, p.pivo.kwh, arred(p.eficiencia, 3), ...(rs ? [arred(p.rsMmHa, 2)] : []), p.pivo.paradas,
          p.pivo.chamados.abertos, p.pivo.chamados.atendidos, p.pivo.disponibilidadePct,
        ]),
      ],
    },
    {
      nome: 'Ocorrências',
      linhas: [
        ['Início', 'Pivô', 'Motivo', 'Duração (min)', 'mm perdidos', 'Fora do padrão'],
        ...[...d.ocorrencias]
          .sort((a, b) => a.inicio.localeCompare(b.inicio))
          .map((o) => [dataHoraPlanilha(o.inicio), o.pivo, o.motivo, o.duracaoMin, o.mmPerdidos, o.problema ? 'sim' : 'não']),
      ],
    },
    ...(d.setores
      ? [{
          nome: 'Lâmina por setor',
          linhas: [
            ['Pivô', 'Setor (graus)', 'Lâmina (mm)', 'Programado (mm)'],
            ...d.setores.mm.map((v, i, arr) => [
              d.setores!.pivo, `${Math.round((i * 360) / arr.length)}–${Math.round(((i + 1) * 360) / arr.length)}`, v,
              d.setores!.programadoMm,
            ]),
          ] as Celula[][],
        }]
      : []),
    abaChamados(d.chamados),
  ];
}

function abasGeracao(d: RelatorioGeracao): Aba[] {
  return [
    abaResumo(d, resumoGeracao(d)),
    {
      nome: 'Diário',
      linhas: [
        ['Dia', 'Gerado (kWh)', 'Esperado (kWh)', '% do esperado'],
        ...d.diario.map((x) => [
          x.dia, x.geradoKwh, x.esperadoKwh,
          x.geradoKwh != null && x.esperadoKwh ? arred((x.geradoKwh / x.esperadoKwh) * 100, 1) : null,
        ]),
      ],
    },
    {
      nome: 'Inversores',
      linhas: [
        ['Inversor', 'Potência (kWp)', 'Energia (kWh)', 'kWh/kWp', 'Dias parado', 'Provável causa'],
        ...d.inversores.map((x) => [x.nome, x.potenciaKwp, x.energiaKwh, arred(x.kwhPorKwp, 1), x.diasParado, x.causa]),
      ],
    },
    abaChamados(d.chamados),
  ];
}

function abasConsumo(d: RelatorioConsumo): Aba[] {
  const curva = d.curvaTipica;
  return [
    abaResumo(d, resumoConsumo(d)),
    {
      nome: 'Demanda 12m',
      linhas: [['Mês', 'Demanda máxima (kW)', 'Contratada (kW)'], ...d.demanda12m.map((x) => [x.mes, x.maxKw, d.demandaContratadaKw])],
    },
    {
      nome: 'Consumidores',
      linhas: [['Consumidor', 'kWh'], ...d.maioresConsumidores.map((x) => [x.nome, x.kwh])],
    },
    {
      nome: 'Curva',
      linhas: [
        ['Hora', 'Dia útil (kW)', 'Fim de semana (kW)'],
        ...(curva ? Array.from({ length: 24 }, (_, h) => [h, curva.diaUtil[h] ?? null, curva.fimDeSemana[h] ?? null]) : []),
      ],
    },
    abaChamados(d.chamados),
  ];
}

function abasRecargas(d: RelatorioRecargas): Aba[] {
  const rs = d.valorKwh;
  return [
    abaResumo(d, resumoRecargas(d)),
    {
      nome: 'Apartamentos',
      linhas: [
        ['Apartamento', 'Morador', 'Recargas', 'kWh', 'Tempo (min)', ...(rs != null ? ['Valor (R$)'] : [])],
        ...porApartamento(d).map((a) => [a.apartamento, a.morador, a.recargas, arred(a.kwh, 3), a.minutos, ...(rs != null ? [arred(a.valor, 2)] : [])]),
      ],
    },
    {
      nome: 'Sessões por carregador',
      linhas: [
        ['Carregador', 'Potência (kW)', 'Disponibilidade (%)', 'Apartamento', 'Morador', 'Recargas', 'kWh', 'Tempo (min)', ...(rs != null ? ['Valor (R$)'] : [])],
        ...d.carregadores.flatMap((c) =>
          c.moradores.map((m) => [
            c.nome, c.potenciaKw, c.disponibilidadePct, m.apartamento, m.morador, m.recargas, arred(m.kwh, 3), m.minutos,
            ...(rs != null ? [arred(m.kwh * rs, 2)] : []),
          ]),
        ),
      ],
    },
    abaChamados(d.chamados),
  ];
}

export function montarAbas(tipo: TipoRelatorioOperacao, d: RelatorioOperacao): Aba[] {
  switch (tipo) {
    case 'irrigacao': return abasIrrigacao(d as RelatorioIrrigacao);
    case 'geracao': return abasGeracao(d as RelatorioGeracao);
    case 'consumo': return abasConsumo(d as RelatorioConsumo);
    case 'recargas': return abasRecargas(d as RelatorioRecargas);
    default: return [];
  }
}

export function nomeArquivoPlanilha(tipo: TipoRelatorioOperacao, d: RelatorioOperacao): string {
  return `relatorio-${tipo}-${slug(d.cabecalho.unidadeNome) || 'unidade'}-${d.cabecalho.mes}.xlsx`;
}

/** Gera e baixa o XLSX (xlsx carregado sob demanda). */
export async function baixarPlanilha(tipo: TipoRelatorioOperacao, d: RelatorioOperacao): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const aba of montarAbas(tipo, d)) {
    const ws = XLSX.utils.aoa_to_sheet(aba.linhas);
    const larguras = aba.linhas.reduce<number[]>((acc, l) => {
      l.forEach((v, i) => { acc[i] = Math.max(acc[i] ?? 8, Math.min(48, String(v ?? '').length + 2)); });
      return acc;
    }, []);
    ws['!cols'] = larguras.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, aba.nome.slice(0, 31));
  }
  XLSX.writeFile(wb, nomeArquivoPlanilha(tipo, d));
}
