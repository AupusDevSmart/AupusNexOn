import type { RelatorioOperacao, TipoRelatorioOperacao } from './tipos';
import { mesDe, mesExtenso, somarMes } from './formatos';

export const TIPOS_RELATORIO: Array<{ valor: TipoRelatorioOperacao; rotulo: string }> = [
  { valor: 'irrigacao', rotulo: 'Irrigação' },
  { valor: 'geracao', rotulo: 'Geração' },
  { valor: 'consumo', rotulo: 'Consumo' },
  { valor: 'recargas', rotulo: 'Recargas' },
];

export function ehTipo(v: string | null | undefined): v is TipoRelatorioOperacao {
  return TIPOS_RELATORIO.some((t) => t.valor === v);
}

/** Título da aba/PDF: "Relatório de irrigação - Planta - Unidade - 2026-10". */
export function tituloDocumento(tipo: TipoRelatorioOperacao, dados: RelatorioOperacao): string {
  const nome = TIPOS_RELATORIO.find((t) => t.valor === tipo)?.rotulo.toLowerCase() ?? tipo;
  const c = dados.cabecalho;
  return `Relatório de ${nome} - ${c.plantaNome} - ${c.unidadeNome} - ${c.mes}`;
}

export function descricaoRelatorio(dados: RelatorioOperacao): string {
  return `${dados.cabecalho.plantaNome} · ${dados.cabecalho.unidadeNome} · ${mesExtenso(dados.cabecalho.mes)}`;
}

/** Mês corrente + 12 anteriores, do mais recente para o mais antigo. */
export function opcoesMes(hoje = new Date()): string[] {
  const atual = mesDe(hoje);
  return Array.from({ length: 13 }, (_, i) => somarMes(atual, -i));
}
