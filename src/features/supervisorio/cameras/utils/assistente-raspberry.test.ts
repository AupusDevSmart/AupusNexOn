import { beforeEach, describe, expect, it } from 'vitest';
import type { Agente } from '../types';
import {
  acharAparelhoNovo,
  duracaoTexto,
  gravarSessao,
  lerSessao,
  sessaoNova,
  sistemaDoComputador,
  VALIDADE_SESSAO_MS,
} from './assistente-raspberry';

const ag = (id: string, criado: string) => ({ id, created_at: criado }) as Agente;

describe('acharAparelhoNovo', () => {
  it('ignora os aparelhos que já existiam e devolve o novo', () => {
    const lista = [ag('a', '2026-11-01T00:00:00Z'), ag('b', '2026-11-17T10:00:00Z')];
    expect(acharAparelhoNovo(lista, ['a'])?.id).toBe('b');
    expect(acharAparelhoNovo(lista, ['a', 'b'])).toBeNull();
  });

  it('sem a lista inicial guardada, não aponta nada', () => {
    expect(acharAparelhoNovo([ag('a', '2026-11-01T00:00:00Z')], null)).toBeNull();
    expect(acharAparelhoNovo(undefined, [])).toBeNull();
  });

  it('com vários novos, fica com o criado por último', () => {
    const lista = [ag('x', '2026-11-17T10:00:00Z'), ag('y', '2026-11-17T11:00:00Z'), ag('z', '2026-11-17T09:00:00Z')];
    expect(acharAparelhoNovo(lista, [])?.id).toBe('y');
  });
});

describe('sessão do assistente', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('guarda e lê por usina', () => {
    const s = { ...sessaoNova('pendrive', 1_000), etapa: 2 as const, marcados: ['rede'] };
    gravarSessao('u1', s);
    expect(lerSessao('u1', 2_000)).toEqual(s);
    expect(lerSessao('u2', 2_000)).toBeNull();
  });

  it('descarta sessão vencida ou corrompida', () => {
    gravarSessao('u1', sessaoNova('pc', 0));
    expect(lerSessao('u1', VALIDADE_SESSAO_MS + 1)).toBeNull();
    window.sessionStorage.setItem('nexon.assistente-raspberry.u1', '{quebrado');
    expect(lerSessao('u1')).toBeNull();
    window.sessionStorage.setItem('nexon.assistente-raspberry.u1', JSON.stringify({ etapa: 9, iniciadoEm: Date.now() }));
    expect(lerSessao('u1')).toBeNull();
  });
});

describe('textos', () => {
  it('formata o tempo de espera', () => {
    expect(duracaoTexto(12_000)).toBe('12 s');
    expect(duracaoTexto(245_000)).toBe('4 min 05 s');
    expect(duracaoTexto(3_720_000)).toBe('1 h 02 min');
  });

  it('reconhece o sistema para recomendar o jeito de gravar', () => {
    expect(sistemaDoComputador('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('mac-linux');
    expect(sistemaDoComputador('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(sistemaDoComputador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile')).toBe('celular');
  });
});
