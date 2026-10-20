import { describe, expect, it } from 'vitest';
import { navigationLinks } from './navigation-links';

describe('menu: Chamados (NEXON-24)', () => {
  it('é item de topo logo depois de Relatórios, com contador de abertos', () => {
    const chaves = navigationLinks.map((l) => l.key);
    expect(chaves.indexOf('chamados')).toBe(chaves.indexOf('relatorios') + 1);
    const chamados = navigationLinks.find((l) => l.key === 'chamados')!;
    expect(chamados.path).toBe('/chamados');
    expect(chamados.contador).toBe('chamados-abertos');
    expect(chamados.links).toBeUndefined();
  });
});
