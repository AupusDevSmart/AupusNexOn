import { describe, expect, it } from 'vitest';
import {
  formToMapeamento,
  formToPontos,
  mapeamentoToForm,
  pontosToForm,
} from './iot-catalog-shapes';

describe('pontos <-> form', () => {
  it('round-trip preserva ai/bi/bo e campos top-level (group_order, publish)', () => {
    const pontos = {
      group_order: ['info'],
      publish: { timestamp_format: 'epoch', meta_fields: ['inverter_id'] },
      ai: [
        { id: 'va', label: 'Tensao', unit: 'V', group: 'tensao', json: 'info.va', format: 'hex' },
      ],
      bi: [{ id: 'sts', label: 'Status', group: 'estado' }],
      bo: [],
    };

    const back = formToPontos(pontosToForm(pontos));
    expect(back).toEqual(pontos);
  });

  it('linhas sem id sao ignoradas na serializacao', () => {
    const form = pontosToForm({ ai: [{ id: 'va', label: 'A' }], bi: [], bo: [] });
    form.ai.push({ _key: 'x', id: '', label: 'sem id', unit: '', group: '', json: '', format: '', _extra: {} });
    const back = formToPontos(form);
    expect((back.ai as unknown[]).length).toBe(1);
  });
});

// Pontos do tipo usados nos testes de mapeamento.
const TIPO_PONTOS = {
  ai: [
    { id: 'ia', label: 'Corrente A' },
    { id: 'va', label: 'Tensao A' },
    { id: 'freq', label: 'Frequencia' },
    { id: 'unused', label: 'Nao mapeado' },
  ],
  bi: [{ id: 'f27a', label: '27A' }],
  bo: [{ id: 'cmd_abrir', label: 'Abrir' }],
};

// Mapeamento real-ish (Pextron) com campos que o builder NAO expoe.
const MAP = {
  scales: { voltage: 128, current: 256 },
  ai_blocks: [{ start: 700, count: 23, func: 3, label: 'principais' }],
  ai_map: {
    ia: { block: 0, offset: 0, scale: 'current', dataType: 'U16' },
    va: { block: 0, offset: 5, scale: 'voltage', dataType: 'U16' },
    freq: { block: 0, offset: 11, scale: 256, dataType: 'U16' },
    // orfao: existe no mapa mas nao no tipo
    pa_total: { block: 0, offset: 17, scale: 'power', dataType: 'U32_SUM3', regs_per: 2, count: 3 },
  },
  bi_block: { start: 0, count: 53, func: 1 },
  bi_map: {
    f27a: { coil: 2 },
    // orfao com value_map (campo nao exposto)
    local_remoto: { register: 673, func: 3, value_map: { 0: 'LOCAL', 256: 'REMOTO' } },
  },
  bo_map: {
    cmd_abrir: { coil: 52, func: 5 },
  },
  handshake: { register: 136, count: 2, func: 3 },
};

describe('mapeamento <-> form', () => {
  it('gera uma linha por ponto do tipo + orfas no fim', () => {
    const form = mapeamentoToForm(MAP, TIPO_PONTOS);
    // 4 pontos AI do tipo + 1 orfao (pa_total)
    expect(form.aiRows.map((r) => r.pointId)).toEqual(['ia', 'va', 'freq', 'unused', 'pa_total']);
    expect(form.aiRows.find((r) => r.pointId === 'pa_total')?.orphan).toBe(true);
    expect(form.aiRows.find((r) => r.pointId === 'ia')?.orphan).toBe(false);
    // BI: f27a do tipo + local_remoto orfao
    expect(form.biRows.map((r) => r.pointId)).toEqual(['f27a', 'local_remoto']);
    expect(form.boRows.map((r) => r.pointId)).toEqual(['cmd_abrir']);
  });

  it('ponto do tipo sem mapeamento nao entra no ai_map', () => {
    const form = mapeamentoToForm(MAP, TIPO_PONTOS);
    const back = formToMapeamento(form);
    expect('unused' in (back.ai_map as Record<string, unknown>)).toBe(false);
  });

  it('round-trip e nao-destrutivo: preserva scales, bi_block, handshake, value_map, regs_per', () => {
    const form = mapeamentoToForm(MAP, TIPO_PONTOS);
    const back = formToMapeamento(form) as Record<string, unknown>;

    // top-level preservados via "avancado"
    expect(back.scales).toEqual({ voltage: 128, current: 256 });
    expect(back.bi_block).toEqual({ start: 0, count: 53, func: 1 });
    expect(back.handshake).toEqual({ register: 136, count: 2, func: 3 });

    // ai_blocks
    expect(back.ai_blocks).toEqual([{ start: 700, count: 23, func: 3, label: 'principais' }]);

    // ai_map: scale string preservado, scale numerico vira number, extras preservados
    const aiMap = back.ai_map as Record<string, Record<string, unknown>>;
    expect(aiMap.ia).toEqual({ block: 0, offset: 0, scale: 'current', dataType: 'U16' });
    expect(aiMap.freq.scale).toBe(256);
    expect(aiMap.pa_total).toEqual({
      block: 0,
      offset: 17,
      scale: 'power',
      dataType: 'U32_SUM3',
      regs_per: 2,
      count: 3,
    });

    // bi_map: coil e value_map (campo nao exposto) preservados
    const biMap = back.bi_map as Record<string, Record<string, unknown>>;
    expect(biMap.f27a).toEqual({ coil: 2 });
    expect(biMap.local_remoto).toEqual({
      register: 673,
      func: 3,
      value_map: { 0: 'LOCAL', 256: 'REMOTO' },
    });

    // bo_map
    expect(back.bo_map).toEqual({ cmd_abrir: { coil: 52, func: 5 } });
  });
});
