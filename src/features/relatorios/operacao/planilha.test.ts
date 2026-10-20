import { describe, expect, it } from 'vitest';
import { consumoFixture, geracaoFixture, irrigacaoFixture, recargasFixture } from './__fixtures__/relatorios';
import { montarAbas, nomeArquivoPlanilha } from './planilha';

const aba = (abas: ReturnType<typeof montarAbas>, nome: string) => abas.find((a) => a.nome === nome)!;

describe('planilha', () => {
  it('irrigação: Resumo, Pivôs, Ocorrências, Lâmina por setor e Chamados com números crus', () => {
    const abas = montarAbas('irrigacao', irrigacaoFixture);
    expect(abas.map((a) => a.nome)).toEqual(['Resumo', 'Pivôs', 'Ocorrências', 'Lâmina por setor', 'Chamados']);
    const piv = aba(abas, 'Pivôs');
    expect(piv.linhas[0]).toContain('R$/mm/ha');
    expect(piv.linhas[1].slice(0, 6)).toEqual(['Pivô 1', 112, 'Soja', 6, 42, 45]);
    expect(piv.linhas).toHaveLength(9);
    const resumo = aba(abas, 'Resumo');
    expect(resumo.linhas).toContainEqual(['Energia', 121460, 'kWh']);
    const oc = aba(abas, 'Ocorrências');
    expect(oc.linhas[1]).toEqual(['2026-10-03 14:12', 'Pivô 6', 'Pressão baixa', 160, 4.1, 'sim']);
    expect(aba(abas, 'Chamados').linhas[1].slice(0, 4)).toEqual([2318, 'Pivô 6', 'Pressão baixa recorrente na adutora', '2026-10-11 07:02']);
  });

  it('sem R$ a coluna some', () => {
    const abas = montarAbas('irrigacao', { ...irrigacaoFixture, tarifaKwh: null });
    expect(aba(abas, 'Pivôs').linhas[0]).not.toContain('R$/mm/ha');
    expect(aba(abas, 'Resumo').linhas.some((l) => String(l[0]).startsWith('Custo'))).toBe(false);
  });

  it('geração, consumo e recargas', () => {
    const g = montarAbas('geracao', geracaoFixture);
    expect(g.map((a) => a.nome)).toEqual(['Resumo', 'Diário', 'Inversores', 'Chamados']);
    expect(aba(g, 'Diário').linhas[9]).toEqual(['2026-10-09', 6720, 8000, 84]);
    const c = montarAbas('consumo', consumoFixture);
    expect(c.map((a) => a.nome)).toEqual(['Resumo', 'Demanda 12m', 'Consumidores', 'Curva', 'Chamados']);
    expect(aba(c, 'Curva').linhas).toHaveLength(25);
    expect(aba(c, 'Demanda 12m').linhas[9]).toEqual(['2026-07', 1468, 1400]);
    const r = montarAbas('recargas', recargasFixture);
    expect(r.map((a) => a.nome)).toEqual(['Resumo', 'Apartamentos', 'Sessões por carregador', 'Chamados']);
    expect(aba(r, 'Apartamentos').linhas[2]).toEqual(['204', 'Carla S.', 10, 239.7, 666, 263.67]);
    expect(aba(r, 'Sessões por carregador').linhas).toHaveLength(9);
  });

  it('nome do arquivo', () => {
    expect(nomeArquivoPlanilha('irrigacao', irrigacaoFixture)).toBe('relatorio-irrigacao-sede-2026-10.xlsx');
    expect(nomeArquivoPlanilha('geracao', geracaoFixture)).toBe('relatorio-geracao-ufv-1-e-ufv-2-2026-10.xlsx');
  });
});
