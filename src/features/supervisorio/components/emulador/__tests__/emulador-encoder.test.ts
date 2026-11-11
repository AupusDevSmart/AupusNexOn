import { describe, it, expect } from 'vitest';
import { encodeRaw, decodeRaw, montarTabela, configPadrao, floatToU32 } from '../emulador-encoder';
import { listarPontosAi, listarPontosBi, resolverModeloRtu, isModeloRtu, listarModelosRtu, type CatalogModel } from '../emulador-catalog';

describe('encodeRaw / decodeRaw', () => {
  const casos: [string, number, 'high_first' | 'low_first'][] = [
    ['U16', 2200, 'high_first'], ['U16', 0, 'high_first'], ['S16', -1234, 'high_first'],
    ['U32', 123456789, 'high_first'], ['U32', 123456789, 'low_first'],
    ['S32', -987654, 'high_first'], ['S32', -987654, 'low_first'],
    ['COSFI', -235, 'high_first'], ['COSFI', 235, 'high_first'],
  ];
  it.each(casos)('%s %d %s ida e volta', (dt, raw, wo) => {
    const { words, clamped } = encodeRaw(dt, raw, wo);
    expect(clamped).toBe(false);
    expect(decodeRaw(dt, words, wo)).toBe(raw);
  });

  it('FLOAT respeita word_order', () => {
    const hf = encodeRaw('FLOAT', 220.5, 'high_first').words;
    const lf = encodeRaw('FLOAT', 220.5, 'low_first').words;
    const u = floatToU32(220.5);
    expect(hf).toEqual([u >>> 16, u & 0xffff]);
    expect(lf).toEqual([u & 0xffff, u >>> 16]);
    expect(decodeRaw('FLOAT', lf, 'low_first')).toBeCloseTo(220.5, 4);
  });

  it('limita valores fora do tipo', () => {
    expect(encodeRaw('U16', 70000, 'high_first')).toEqual({ words: [0xffff], clamped: true });
    expect(encodeRaw('U16', -5, 'high_first')).toEqual({ words: [0], clamped: true });
    expect(encodeRaw('S16', 40000, 'high_first')).toEqual({ words: [0x7fff], clamped: true });
  });

  it('U32_SUM3 soma volta ao total', () => {
    const { words } = encodeRaw('U32_SUM3', 100001, 'high_first', { count: 3, regs_per: 2 });
    expect(words).toHaveLength(6);
    expect(decodeRaw('U32_SUM3', words, 'high_first', { count: 3, regs_per: 2 })).toBe(100001);
  });
});

// Modelo sintético cobrindo decimal_regs + tp_tc + word_order + overlay rtu.
const M: CatalogModel = {
  fabricante: 'X', modelo: 'Y', tipo: 'medidor_energia', protocolo: 'rtu',
  word_order: 'high_first',
  scales: { voltage: 10 },
  ai_blocks: [{ start: 100, count: 10, func: 3 }, { start: 200, count: 4, func: 4 }],
  ai_map: {
    va: { block: 0, offset: 0, scale: 'voltage', dataType: 'U16', decimal_src: 'dpt' },
    ia: { block: 0, offset: 1, scale: 100, dataType: 'U16', apply_factor: 'tc' },
    pt: { block: 1, offset: 0, scale: 1, dataType: 'S32', apply_factor: 'tp_tc' },
    phf: { block: 0, offset: 4, scale: 1000, dataType: 'U32', mode: 'last' },
    consumo_phf: { block: 0, offset: 4, scale: 1000, dataType: 'U32', mode: 'delta' },
  },
  tp_tc: { register: 3, count: 2, tp_offset: 0, tc_offset: 1, scale_tp: 1, scale_tc: 1 },
  decimal_regs: { register: 35, count: 2, layout: { dpt: { word: 0, byte: 'hi', baseline: 3 } } },
};

describe('montarTabela', () => {
  it('esconde derivados (delta) e lista os demais', () => {
    const { pontos, derivados } = listarPontosAi(M, {});
    expect(pontos.map((p) => p.pid).sort()).toEqual(['ia', 'phf', 'pt', 'va']);
    expect(derivados).toEqual(['consumo_phf']);
  });

  it('valores neutros: TP/TC=1 e casas = baseline', () => {
    const r = montarTabela({ model: M, props: {}, valores: { va: 220.4, ia: 12.34, pt: -5000, phf: 1234.567 }, cfg: configPadrao(M) });
    expect(r.table.holding.get(3)).toBe(1);
    expect(r.table.holding.get(4)).toBe(1);
    expect(r.table.holding.get(35)).toBe(3 << 8);
    expect(r.table.holding.get(100)).toBe(2204);
    expect(r.table.holding.get(101)).toBe(1234);
    expect(r.table.input.get(200)).toBe(0xffff);
    expect(r.leituras.va).toBeCloseTo(220.4, 3);
    expect(r.leituras.pt).toBe(-5000);
    expect(r.leituras.phf).toBeCloseTo(1234.567, 3);
    // registrador do bloco sem ponto existe (zero) → TON não recebe exceção
    expect(r.table.holding.get(109)).toBe(0);
  });

  it('aplica TC e casa decimal no inverso', () => {
    const cfg = { tp: 1, tc: 80, decimais: { dpt: 2 } }; // dpt 2 vs baseline 3 → ×0.1
    const r = montarTabela({ model: M, props: {}, valores: { va: 220, ia: 400, pt: 0, phf: 0 }, cfg });
    expect(r.table.holding.get(4)).toBe(80);
    expect(r.table.holding.get(101)).toBe(500); // 400 A × 100 / 80
    expect(r.table.holding.get(100)).toBe(22000); // 220 × 10 / 0.1
    expect(r.leituras.ia).toBeCloseTo(400, 3);
  });

  it('override tc_ratio do nó prevalece sobre o registrador', () => {
    const r = montarTabela({ model: M, props: { tc_ratio: '40' }, valores: { ia: 400 }, cfg: { tp: 1, tc: 80, decimais: {} } });
    expect(r.table.holding.get(101)).toBe(1000); // usa 40, não 80
  });

  it('avisa valor que não cabe e TP/TC zero', () => {
    const r = montarTabela({ model: M, props: {}, valores: { ia: 99999 }, cfg: { tp: 0, tc: 1, decimais: {} } });
    expect(r.avisos.some((a) => a.nivel === 'aviso' && a.pid === 'ia')).toBe(true);
    expect(r.avisos.some((a) => a.nivel === 'erro')).toBe(true);
  });
});

describe('catálogo', () => {
  it('filtra só RTU e aplica overlay rtu', () => {
    const models: Record<string, CatalogModel> = {
      a: { tipo: 'rele_protecao', protocolo: 'tcp/rtu', fabricante: 'S', modelo: 'A',
        ai_map: { x: { block: 0, offset: 0 } }, por_transporte: { rtu: { ai_map: { y: { block: 0, offset: 1 } } } } },
      b: { tipo: 'rele_protecao', protocolo: 'tcp' },
      c: { tipo: 'rele_protecao', protocolo: 'tcp_usr' },
      d: { tipo: 'rele_protecao', protocolo: 'rtu', fabricante: 'S', modelo: 'D' },
    };
    expect(listarModelosRtu(models, 'rele_protecao').map((m) => m.id)).toEqual(['a', 'd']);
    expect(isModeloRtu(models.c)).toBe(false);
    expect(Object.keys(resolverModeloRtu(models.a).ai_map!)).toEqual(['y']);
  });

  it('BI: esquema novo (bi_blocks) e legado (bi_block+coil)', () => {
    const novo = listarPontosBi({ bi_blocks: [{ start: 12, count: 2, func: 2 }, { start: 99, count: 1, func: 2 }], bi_map: { a: { block: 0, bit: 1 }, b: { block: 1, bit: 0 }, w: { register: 5, func: 4 } as never } });
    expect(novo).toEqual([{ pid: 'a', label: 'a', address: 13, func: 2 }, { pid: 'b', label: 'b', address: 99, func: 2 }]);
    const leg = listarPontosBi({ bi_block: { start: 101, count: 302, func: 2 }, bi_map: { f51a: { coil: 20 } } });
    expect(leg).toEqual([{ pid: 'f51a', label: 'f51a', address: 121, func: 2 }]);
  });
});

describe('erros de catálogo', () => {
  const C: CatalogModel = {
    tipo: 'inversor_solar', protocolo: 'rtu',
    ai_blocks: [{ start: 1000, count: 10, func: 4 }],
    ai_map: {
      potencia_aparente: { block: 0, offset: 2, dataType: 'U32', mode: 'last' },
      apparent_total: { block: 0, offset: 2, dataType: 'U32', mode: 'last' },
      temp: { block: 0, offset: 74, dataType: 'S16' },
    },
  };
  it('pids no mesmo registrador viram apelidos; ponto fora do bloco é ignorado com aviso', () => {
    const { pontos, foraDoBloco } = listarPontosAi(C, {});
    expect(pontos).toHaveLength(1);
    expect(pontos[0].aliases).toEqual(['apparent_total']);
    expect(foraDoBloco).toEqual(['temp']);
    const r = montarTabela({ model: C, props: {}, valores: { potencia_aparente: 5000 }, cfg: configPadrao(C) });
    expect(r.leituras.apparent_total).toBe(5000);
    expect(r.avisos.some((a) => /fora do bloco/.test(a.texto))).toBe(true);
    expect(r.table.input.has(1074)).toBe(false);
  });
});

describe('sobreposição de registradores no catálogo', () => {
  it('avisa mesmo sem valores digitados', () => {
    const C: CatalogModel = {
      tipo: 'inversor_solar', protocolo: 'rtu',
      ai_blocks: [{ start: 0, count: 20, func: 4 }],
      ai_map: { pa: { block: 0, offset: 9, dataType: 'U32' }, pa2: { block: 0, offset: 10, dataType: 'U32' } },
    };
    expect(listarPontosAi(C, {}).sobrepostos).toEqual([['pa', 'pa2']]);
    const r = montarTabela({ model: C, props: {}, valores: {}, cfg: configPadrao(C) });
    expect(r.avisos.some((a) => /usam registradores em comum/.test(a.texto))).toBe(true);
  });
});
