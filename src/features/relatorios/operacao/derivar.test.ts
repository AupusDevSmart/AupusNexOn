import { describe, expect, it } from 'vitest';
import { consumoFixture, geracaoFixture, irrigacaoFixture, recargasFixture } from './__fixtures__/relatorios';
import {
  calcularPivos, celulaChamados, destaquesIrrigacao, indicadoresIrrigacao, linhaDoTempo, ocorrencias, setores,
  subtituloIrrigacao,
} from './derivar-irrigacao';
import { diasAbaixo, graficoDiario, indicadoresGeracao, perdas, rankingInversores, subtituloGeracao } from './derivar-geracao';
import { balanco, faixaCargaBase, graficoDemanda, indicadoresConsumo } from './derivar-consumo';
import { blocosCarregadores, indicadoresRecargas, porApartamento, subtituloRecargas, totaisRecargas } from './derivar-recargas';
import { linhasChamados, resumoChamados } from './derivar-chamados';
import { COR } from './tema';
import type { RelatorioIrrigacao } from './tipos';

const porRotulo = (itens: Array<{ rotulo: string }>, r: string) => itens.find((k) => k.rotulo === r) as {
  valor: string; unidade?: string; contexto: string; alerta?: boolean;
};

describe('irrigação', () => {
  it('totais ponderados por área e limiares por pivô', () => {
    const { pivos, totais } = calcularPivos(irrigacaoFixture);
    expect(totais.areaHa).toBe(760);
    expect(totais.laminaMedia).toBeCloseTo(40.24, 2);
    expect(totais.eficienciaMedia).toBeCloseTo(3.971, 3);
    expect(pivos.filter((p) => p.alertaProg).map((p) => p.pivo.nome)).toEqual(['Pivô 6']);
    expect(pivos.filter((p) => p.alertaEf).map((p) => p.pivo.nome)).toEqual(['Pivô 3']);
    expect(pivos.filter((p) => p.alertaParadas).map((p) => p.pivo.nome)).toEqual(['Pivô 6']);
  });

  it('indicadores', () => {
    const k = indicadoresIrrigacao(irrigacaoFixture);
    expect(k).toHaveLength(8);
    expect(porRotulo(k, 'Lâmina média').valor).toBe('40,2');
    expect(porRotulo(k, 'Programado × aplicado')).toMatchObject({ valor: '93', contexto: 'Pivô 6 abaixo de 85%', alerta: true });
    expect(porRotulo(k, 'Volume estimado').valor).toBe('305.840');
    expect(porRotulo(k, 'Horas irrigadas')).toMatchObject({ valor: '1.254', contexto: '44 voltas' });
    expect(porRotulo(k, 'Energia')).toMatchObject({ valor: '121,5', unidade: 'MWh' });
    expect(porRotulo(k, 'Custo estimado').valor).toBe('R$ 75.305');
    expect(porRotulo(k, 'Custo por mm/ha')).toMatchObject({ valor: 'R$ 2,46', contexto: '3,97 kWh/mm/ha' });
    expect(porRotulo(k, 'Energia em ponta')).toMatchObject({ valor: '4,1', contexto: '5.020 kWh', alerta: false });
  });

  it('sem R$ troca os cards de custo e não inventa valor', () => {
    const k = indicadoresIrrigacao({ ...irrigacaoFixture, tarifaKwh: null });
    expect(k.map((x) => x.rotulo)).not.toContain('Custo estimado');
    expect(k.some((x) => x.valor.startsWith('R$'))).toBe(false);
    expect(porRotulo(k, 'Paradas')).toMatchObject({ valor: '5', alerta: true });
  });

  it('destaques do mês', () => {
    const d = destaquesIrrigacao(irrigacaoFixture);
    expect(d[0]).toMatchObject({ cor: COR.alerta, negrito: 'Pivô 3' });
    expect(d[0].texto).toContain('4,60 kWh/mm/ha, 16% acima da média');
    expect(d[1]).toMatchObject({ negrito: 'Pivô 6', texto: ' aplicou 73% do programado: 3 paradas por pressão baixa.' });
    expect(d[2]).toMatchObject({ cor: COR.ok, texto: '37% da energia no horário reservado, com tarifa reduzida.' });
  });

  it('subtítulo e coluna CHAM.', () => {
    expect(subtituloIrrigacao(irrigacaoFixture, 'Outubro de 2026')).toBe('Outubro de 2026 · Safra 2026/27 · 8 pivôs · 760 ha');
    expect(celulaChamados({ abertos: 1, atendidos: 0 })).toEqual({ texto: '1 ab.', cor: COR.alerta });
    expect(celulaChamados({ abertos: 0, atendidos: 1 })).toEqual({ texto: '1 ✓', cor: COR.ok });
    expect(celulaChamados({ abertos: 0, atendidos: 0 }).texto).toBe('—');
  });

  it('linha do tempo separa irrigação na ponta', () => {
    const tl = linhaDoTempo(irrigacaoFixture)!;
    expect(tl.periodo).toBe('20 a 26/10');
    expect(tl.dias[0]).toBe('Ter 20');
    expect(tl.faixas).toHaveLength(5);
    const p5 = tl.linhas.find((l) => l.nome === 'Pivô 5')!;
    const laranja = p5.segmentos.filter((s) => s.cor === COR.alerta);
    expect(laranja).toHaveLength(1);
    expect(laranja[0].w).toBeCloseTo((3 * 616) / 168, 5);
    expect(tl.leitura).toContain('Pivô 5 irrigou 3 h na ponta na quinta (22/10)');
    expect(tl.leitura).toContain('Sábado e domingo não têm horário de ponta.');
    expect(linhaDoTempo({ ...irrigacaoFixture, linhaDoTempo: null })).toBeNull();
  });

  it('lâmina por setor e ocorrências', () => {
    const s = setores(irrigacaoFixture)!;
    expect(s.max).toBe(45);
    expect(s.fatias).toHaveLength(12);
    expect(s.leitura).toEqual({ faixa: '120° a 180°', valores: '12 e 8 mm', programado: '40 mm' });
    expect(s.datas).toEqual(['03/10', '11/10', '19/10']);
    const oc = ocorrencias(irrigacaoFixture);
    expect(oc.resumo).toBe('5 paradas · 12 h 55 min');
    expect(oc.motivos.map((m) => m.motivo)).toEqual(['Pressão baixa', 'Desalinhamento', 'Falta de energia', 'Bloqueio de ponta']);
    expect(oc.motivos[3].cor).toBe(COR.neutro);
    expect(oc.motivos[0].texto).toBe('10 h 55');
  });

  it('tolera campos nulos', () => {
    const vazio: RelatorioIrrigacao = { ...irrigacaoFixture, linhas: [], energiaPorPosto: null, setores: null, ocorrencias: [], chamados: [] };
    const k = indicadoresIrrigacao(vazio);
    expect(porRotulo(k, 'Lâmina média').valor).toBe('—');
    expect(setores(vazio)).toBeNull();
    expect(destaquesIrrigacao(vazio)).toEqual([]);
  });
});

describe('geração', () => {
  it('indicadores', () => {
    const k = indicadoresGeracao(geracaoFixture);
    expect(porRotulo(k, 'Energia gerada')).toMatchObject({ valor: '214,2', unidade: 'MWh', contexto: '+6,2% vs setembro' });
    expect(porRotulo(k, '% do esperado')).toMatchObject({ valor: '94,4', contexto: 'esperado 226,8 MWh', alerta: false });
    expect(porRotulo(k, 'Rendimento')).toMatchObject({ valor: '140', contexto: '4,5 kWh/kWp por dia' });
    expect(porRotulo(k, 'Disponibilidade')).toMatchObject({ valor: '99,2', alerta: true });
    expect(porRotulo(k, 'Geração máxima')).toMatchObject({ valor: '1.012', contexto: '12/10 · 12:30' });
    expect(porRotulo(k, 'Autoconsumo')).toMatchObject({ valor: '61', contexto: '130,7 MWh consumidos no local' });
    expect(porRotulo(k, 'Injetada')).toMatchObject({ valor: '83,5', contexto: 'máx. 512 kW' });
    expect(porRotulo(k, 'Valor estimado').valor).toBe('R$ 132.804');
    expect(subtituloGeracao(geracaoFixture, 'Outubro de 2026')).toBe('Outubro de 2026 · 1.530 kWp · 19 inversores · esperado por satélite');
  });

  it('dias abaixo de 90% ficam laranja', () => {
    expect(diasAbaixo(geracaoFixture)).toEqual(['2026-10-09', '2026-10-10']);
    const g = graficoDiario(geracaoFixture)!;
    expect(g.MAX).toBe(10000);
    expect(g.rotuloY).toEqual(['10 MWh', '5', '0']);
    expect(g.barras.filter((b) => b.cor === COR.alerta).map((b) => b.dia)).toEqual(['2026-10-09', '2026-10-10']);
    expect(g.marcas).toEqual(['01', '05', '10', '15', '20', '25', '31']);
    expect(g.leitura).toBe('2 dias abaixo de 90% do esperado: 09/10 e 10/10.');
  });

  it('perdas e ranking de inversores', () => {
    expect(perdas(geracaoFixture)!.total).toBe(12600);
    const r = rankingInversores(geracaoFixture)!;
    expect(r.total).toBe(19);
    expect(Math.round(r.media)).toBe(140);
    expect(r.linhas).toHaveLength(6);
    expect(r.linhas[0]).toMatchObject({ nome: 'Inversor 2 · UFV 1', alerta: true });
    expect(r.linhas.filter((x) => x.alerta).map((x) => x.nome)).toEqual(['Inversor 2 · UFV 1', 'Inversor 7 · UFV 2']);
  });

  it('sem tarifa não mostra R$', () => {
    const k = indicadoresGeracao({ ...geracaoFixture, tarifaReferencia: null });
    expect(k.some((x) => x.valor.startsWith('R$'))).toBe(false);
    expect(porRotulo(k, 'Dias abaixo de 90%')).toMatchObject({ valor: '2', alerta: true });
  });
});

describe('consumo', () => {
  it('indicadores', () => {
    const k = indicadoresConsumo(consumoFixture);
    expect(porRotulo(k, 'Consumo total')).toMatchObject({ valor: '421,1', unidade: 'MWh' });
    expect(porRotulo(k, 'Da rede')).toMatchObject({ valor: '290,4', contexto: '−4,8% vs setembro' });
    expect(porRotulo(k, 'Energia em ponta')).toMatchObject({ valor: '6,5', contexto: '18.900 kWh', alerta: true });
    expect(porRotulo(k, 'Demanda máxima')).toMatchObject({ valor: '1.312', contexto: '94% da contratada', alerta: false });
    expect(porRotulo(k, 'Ultrapassagens')).toMatchObject({ valor: '0', alerta: false });
    expect(porRotulo(k, 'FP médio')).toMatchObject({ valor: '0,93', contexto: '58 intervalos abaixo de 0,92', alerta: true });
    expect(porRotulo(k, 'Reativo excedente').contexto).toBe('indutivo 82% · capacitivo 18%');
    expect(porRotulo(k, 'Carga de base')).toMatchObject({ valor: '86', contexto: 'madrugada (02–04h)' });
    expect(faixaCargaBase(consumoFixture)).toBe('02–04h');
  });

  it('demanda acima da contratada fica laranja e o mês do relatório escuro', () => {
    const g = graficoDemanda(consumoFixture)!;
    expect(g.MAX).toBe(1600);
    expect(g.tol).toBeCloseTo(1470, 6);
    expect(g.barras[8]).toMatchObject({ mes: 'jul', cor: COR.alerta });
    expect(g.barras[11].cor).toBe(COR.texto);
    expect(g.barras[0].cor).toBe(COR.neutro);
    expect(g.aria).toContain('julho acima da contratada, dentro da tolerância');
  });

  it('balanço', () => {
    const b = balanco(consumoFixture);
    expect(Math.round(b.autossuficiencia!)).toBe(31);
    expect(b.celulas.map((c) => c.valor)).toEqual(['214,2', '130,7', '290,4', '83,5', '31']);
  });
});

describe('recargas', () => {
  it('soma por apartamento e totais', () => {
    const a = porApartamento(recargasFixture);
    expect(a.map((x) => x.apartamento)).toEqual(['101', '204', '302', '304', '403', '501', '602']);
    const carla = a.find((x) => x.apartamento === '204')!;
    expect(carla).toMatchObject({ recargas: 10, minutos: 666 });
    expect(carla.kwh).toBeCloseTo(239.7, 6);
    const t = totaisRecargas(recargasFixture);
    expect(t.kwh).toBeCloseTo(1224.4, 6);
    expect(t.recargas).toBe(53);
  });

  it('indicadores e blocos', () => {
    const k = indicadoresRecargas(recargasFixture);
    expect(k[0]).toMatchObject({ rotulo: 'Valor total a cobrar', valor: 'R$ 1.346,84', contexto: 'estimado · 7 apartamentos' });
    expect(k[1]).toMatchObject({ valor: '1.224,4', contexto: '+12% vs setembro' });
    expect(k[2]).toMatchObject({ valor: '53', contexto: '23,1 kWh por recarga' });
    const b = blocosCarregadores(recargasFixture);
    expect(b[0]).toMatchObject({ potencia: '22 kW', sub: 'Disponibilidade 100% · 25 recargas' });
    expect(b[1]).toMatchObject({ potencia: '7,4 kW', sub: 'Disponibilidade 98,9% · 28 recargas · 1 chamado no mês' });
    expect(subtituloRecargas(recargasFixture, 'Outubro de 2026')).toBe(
      'Outubro de 2026 · 2 carregadores · valor do kWh R$ 1,10 · para cobrança no boleto de novembro',
    );
  });

  it('sem valor do kWh não há R$', () => {
    const d = { ...recargasFixture, valorKwh: null };
    expect(indicadoresRecargas(d).some((x) => x.valor.startsWith('R$'))).toBe(false);
    expect(porApartamento(d).every((x) => x.valor == null)).toBe(true);
  });
});

describe('chamados (§9)', () => {
  it('atendido e em aberto', () => {
    const l = linhasChamados(irrigacaoFixture.chamados, irrigacaoFixture.cabecalho.fim);
    expect(l[0]).toMatchObject({
      equipamento: 'Pivô 6', aberto: '11/10 07:02', por: 'João Lima · operador', atendido: true,
      situacao: 'Atendido 13/10 10:40', detalhe: 'em 2 d 3 h', notificado: 'Smart Service (OS 2318) · WhatsApp do gerente',
    });
    expect(l[1]).toMatchObject({ atendido: false, situacao: 'Em aberto', detalhe: 'há 20 d (até 01/11)' });
    expect(resumoChamados(irrigacaoFixture.chamados)).toBe('2 no período · 1 em aberto');
    expect(resumoChamados(consumoFixture.chamados)).toBe('1 no período · nenhum em aberto');
    expect(resumoChamados([])).toBe('nenhum no período');
    const r = linhasChamados(recargasFixture.chamados, recargasFixture.cabecalho.fim);
    expect(r[0].detalhe).toBe('em 19 h 20');
    const g = linhasChamados(geracaoFixture.chamados, geracaoFixture.cabecalho.fim);
    expect(g[1].detalhe).toBe('há 11 d (até 01/11)');
  });
});
