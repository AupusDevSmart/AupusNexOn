import { describe, expect, it } from 'vitest';
import {
  defaultUnidadeFormValues,
  formDataToDto,
  StatusUnidade,
  TipoUnidade,
} from '@/core/features/unidades/types';

// Nov/2026: da instalacao so o nome e a planta sao obrigatorios. O que fica
// vazio vai como null (no update apaga o gravado), nunca 0 nem NaN.
describe('formDataToDto da instalacao', () => {
  const base = { ...defaultUnidadeFormValues, plantaId: 'p1', nome: 'UFV 1' };

  it('campos opcionais vazios vao como null', () => {
    const dto = formDataToDto({
      ...base,
      tipo: '',
      estado: '',
      cidade: '  ',
      latitude: '',
      longitude: '',
      potencia: '',
    });
    expect(dto).toMatchObject({
      planta_id: 'p1',
      nome: 'UFV 1',
      tipo: null,
      estado: null,
      cidade: null,
      latitude: null,
      longitude: null,
      potencia: null,
    });
  });

  it('valores preenchidos seguem convertidos; 0 e coordenada, nao vazio', () => {
    const dto = formDataToDto({
      ...base,
      tipo: TipoUnidade.GERACAO,
      status: StatusUnidade.ATIVO,
      estado: 'GO',
      cidade: 'Goiânia',
      latitude: '-16,6869',
      longitude: 0,
      potencia: '75.5',
    });
    expect(dto).toMatchObject({
      tipo: TipoUnidade.GERACAO,
      estado: 'GO',
      cidade: 'Goiânia',
      latitude: -16.6869,
      longitude: 0,
      potencia: 75.5,
    });
  });
});
