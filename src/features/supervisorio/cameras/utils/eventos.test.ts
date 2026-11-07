import { Car, User, WifiOff } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import {
  ehNaoLido,
  iconeEvento,
  paramTipo,
  subtituloResumo,
  textoChamado,
  textoNoite,
  tiposDoFiltro,
  tituloEvento,
} from './eventos';

describe('tituloEvento / iconeEvento', () => {
  it('usa o título da API e cai no padrão do tipo', () => {
    expect(tituloEvento({ tipo: 'pessoa', titulo: 'Pessoa na cabine' })).toBe('Pessoa na cabine');
    expect(tituloEvento({ tipo: 'veiculo', titulo: '' })).toBe('Veículo detectado');
    expect(tituloEvento({ tipo: 'sem_sinal', titulo: '  ' })).toBe('Câmera sem sinal');
    expect(tituloEvento({ tipo: 'sinal_restabelecido', titulo: '' })).toBe('Câmera voltou');
  });

  it('ícone por tipo', () => {
    expect(iconeEvento('pessoa')).toBe(User);
    expect(iconeEvento('veiculo')).toBe(Car);
    expect(iconeEvento('sem_sinal')).toBe(WifiOff);
  });
});

describe('filtros', () => {
  it('chip → tipos da API', () => {
    expect(tiposDoFiltro('todas')).toBeUndefined();
    expect(tiposDoFiltro('pessoas')).toEqual(['pessoa']);
    expect(tiposDoFiltro('veiculos')).toEqual(['veiculo']);
    expect(tiposDoFiltro('sistema')).toEqual(['sem_sinal', 'sinal_restabelecido']);
  });

  it('parâmetro tipo= separado por vírgula', () => {
    expect(paramTipo('todas')).toBeUndefined();
    expect(paramTipo('sistema')).toBe('sem_sinal,sinal_restabelecido');
  });
});

describe('ehNaoLido', () => {
  it('só alerta sem lido_em conta', () => {
    expect(ehNaoLido({ alerta: true, lido_em: null })).toBe(true);
    expect(ehNaoLido({ alerta: true, lido_em: '2026-11-07T08:00:00Z' })).toBe(false);
    expect(ehNaoLido({ alerta: false, lido_em: null })).toBe(false);
  });
});

describe('textos do resumo', () => {
  it('subtítulo armado/desarmado', () => {
    const ate = new Date(2026, 10, 7, 6, 30).toISOString();
    expect(subtituloResumo({ armado: true, armado_ate: ate, online: 5, total: 6 })).toBe('Armado até 06:30 · 5 de 6 online');
    expect(subtituloResumo({ armado: true, armado_ate: null, online: 6, total: 6 })).toBe('Armado · 6 de 6 online');
    expect(subtituloResumo({ armado: false, armado_ate: null, online: 5, total: 6 })).toBe('Desarmado · 5 de 6 online');
  });

  it('resumo da noite com câmera sem sinal', () => {
    const desde = new Date(2026, 10, 7, 5, 30).toISOString();
    expect(
      textoNoite({
        noite: { inicio: null, alertas: 1, descartados: 14 },
        sem_sinal: [{ camera_id: 'c', camera_nome: 'Arranjo IV3', desde }],
      }),
    ).toBe('Noite: 1 intrusão, 14 movimentos descartados. Arranjo IV3 sem sinal desde 05:30.');
  });

  it('plural, nenhuma intrusão e várias câmeras', () => {
    expect(
      textoNoite({
        noite: { inicio: null, alertas: 0, descartados: 1 },
        sem_sinal: [
          { camera_id: 'a', camera_nome: 'Portão', desde: null },
          { camera_id: 'b', camera_nome: 'Arranjo IV3', desde: null },
        ],
      }),
    ).toBe('Noite: nenhuma intrusão, 1 movimento descartado. Portão e Arranjo IV3 sem sinal.');
    expect(textoNoite({ noite: null, sem_sinal: [] })).toBe('');
  });

  it('texto do chamado com 4 dígitos', () => {
    expect(textoChamado({ chamado_numero: 412 })).toBe('chamado CH-0412 aberto');
    expect(textoChamado({ chamado_numero: null })).toBeNull();
  });
});
