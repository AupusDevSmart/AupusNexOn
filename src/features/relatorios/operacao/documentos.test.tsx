import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { consumoFixture, geracaoFixture, irrigacaoFixture, recargasFixture } from './__fixtures__/relatorios';
import { RelatorioOperacaoDoc } from './RelatorioOperacaoDoc';
import { tituloDocumento } from './catalogo';
import type { RelatorioIrrigacao } from './tipos';

describe('documentos A4 (render)', () => {
  it('irrigação: 2 páginas com cabeçalho, tabela, destaques e chamados', () => {
    const { container } = render(<RelatorioOperacaoDoc tipo="irrigacao" dados={irrigacaoFixture} />);
    expect(container.querySelectorAll('.rel-op-pagina')).toHaveLength(2);
    expect(screen.getAllByText('RELATÓRIO DE IRRIGAÇÃO')).toHaveLength(2);
    expect(screen.getByText('Fazenda Pontal · Sede')).toBeInTheDocument();
    expect(screen.getByText('Destaques do mês')).toBeInTheDocument();
    expect(screen.getByText('1 ab.')).toBeInTheDocument();
    expect(screen.getByText('Gerado em 01/11/2026 · 2/2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Lâmina aplicada por setor do Pivô 6/ })).toBeInTheDocument();
    expect(screen.getByText('Em aberto')).toBeInTheDocument();
  });

  it('irrigação sem dados de blocos mantém o layout com "Sem dados no período"', () => {
    const d: RelatorioIrrigacao = { ...irrigacaoFixture, linhaDoTempo: null, setores: null, energiaPorPosto: null, chamados: [] };
    render(<RelatorioOperacaoDoc tipo="irrigacao" dados={d} />);
    expect(screen.getAllByText('Sem dados no período').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Nenhum chamado no período')).toBeInTheDocument();
  });

  it('geração', () => {
    const { container } = render(<RelatorioOperacaoDoc tipo="geracao" dados={geracaoFixture} />);
    expect(container.querySelectorAll('.rel-op-pagina')).toHaveLength(1);
    expect(screen.getByText('Inversores com menor rendimento')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /2 dias abaixo de 90%/ })).toBeInTheDocument();
    expect(screen.getByText('R$ 132.804')).toBeInTheDocument();
  });

  it('consumo', () => {
    render(<RelatorioOperacaoDoc tipo="consumo" dados={consumoFixture} />);
    expect(screen.getByText('Balanço de energia')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /julho acima da contratada/ })).toBeInTheDocument();
    expect(screen.getByText('Atendido 22/10 09:10')).toBeInTheDocument();
  });

  it('recargas', () => {
    render(<RelatorioOperacaoDoc tipo="recargas" dados={recargasFixture} />);
    expect(screen.getByText('Cobrança por apartamento')).toBeInTheDocument();
    expect(screen.getByText('Carregador Vaga 12')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 1.346,84').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('CARREGADOR')).toBeInTheDocument();
  });

  it('título do PDF', () => {
    expect(tituloDocumento('irrigacao', irrigacaoFixture)).toBe('Relatório de irrigação - Fazenda Pontal - Sede - 2026-10');
  });
});
