import { describe, expect, it } from 'vitest';
import { capacidadesDoPapel, papelCanonico, papelECapacidades, rotuloDaRole } from './papeis';

describe('papéis (NEXON-20)', () => {
  it('nomes legados viram o papel de hoje', () => {
    expect(papelCanonico('super_admin')).toBe('admin');
    expect(papelCanonico('analista')).toBe('analista_automacao');
    expect(papelCanonico('gerente')).toBe('analista_operacao');
    expect(papelCanonico('propietario')).toBe('proprietario');
    expect(papelCanonico('cativo')).toBe('outro');
    expect(rotuloDaRole('gerente')).toBe('Analista de operação');
    expect(rotuloDaRole('super_admin')).toBe('Admin');
    expect(rotuloDaRole('vendedor')).toBe('vendedor');
  });

  it('matriz de quem cadastra quem', () => {
    expect(capacidadesDoPapel('admin').cadastra).toHaveLength(5);
    expect(capacidadesDoPapel('analista_automacao').cadastra).toEqual(['analista_operacao', 'proprietario', 'operador']);
    expect(capacidadesDoPapel('analista_operacao').cadastra).toEqual(['proprietario', 'operador']);
    expect(capacidadesDoPapel('proprietario').cadastra).toEqual(['operador']);
    expect(capacidadesDoPapel('operador').cadastra).toEqual([]);
  });

  it('o que cada papel vê', () => {
    const op = capacidadesDoPapel('operador');
    expect(op.verUnifilar || op.verComunicacao || op.configTecnica).toBe(false);
    expect(op.comandar && op.configOperacional).toBe(true);
    const prop = capacidadesDoPapel('proprietario');
    expect(prop.verNomeProprietario).toBe(false);
    expect(prop.verUnifilar && prop.comandar && prop.gerirAcessoOperador).toBe(true);
    expect(prop.configTecnica || prop.contadorFalhas || prop.global).toBe(false);
    expect(capacidadesDoPapel('analista_operacao').cadastroTecnico).toBe(false);
  });

  it('usa o que a API mandou e deriva da role quando falta', () => {
    expect(papelECapacidades({ roles: ['gerente'] }).papel).toBe('analista_operacao');
    expect(papelECapacidades({ roles: [{ name: 'operador' }] }).capacidades.verUnifilar).toBe(false);
    expect(papelECapacidades({ role_details: { name: 'admin' } }).capacidades.global).toBe(true);
    const r = papelECapacidades({ papel: 'proprietario', capacidades: { verUnifilar: false } });
    expect(r.papel).toBe('proprietario');
    expect(r.capacidades.verUnifilar).toBe(false);
    expect(r.capacidades.cadastra).toEqual(['operador']);
    expect(papelECapacidades(null).papel).toBe('outro');
  });
});
