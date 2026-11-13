import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { paramData, paramFlag, paramLista, paramOpcao, paramTexto, useEscreverParamsUrl, useParamUrl } from './useParamUrl';

const ABA = paramOpcao(['visao', 'cameras', 'alarmes'] as const, 'visao');
const TIPOS = paramLista(['pessoa', 'veiculo', 'animal'] as const);
const VISTOS = paramFlag();
const CAMERA = paramTexto();
const DIA = paramData('dia');

function comRota(url: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
}

function useTudo() {
  const [aba, setAba] = useParamUrl('aba', ABA, 'push');
  const [tipos, setTipos] = useParamUrl('tipos', TIPOS);
  const [vistos, setVistos] = useParamUrl('naoVistos', VISTOS);
  const [camera, setCamera] = useParamUrl('camera', CAMERA);
  const [dia] = useParamUrl('data', DIA);
  const escrever = useEscreverParamsUrl();
  const loc = useLocation();
  return { aba, setAba, tipos, setTipos, vistos, setVistos, camera, setCamera, dia, escrever, loc, tipoNav: useNavigationType() };
}

describe('useParamUrl', () => {
  it('lê e valida: desconhecido vira o padrão, lista descarta o que não conhece', () => {
    const { result } = renderHook(useTudo, {
      wrapper: comRota('/s?aba=xpto&tipos=pessoa,foo,animal&naoVistos=1&camera=c1&data=2026-13'),
    });
    expect(result.current.aba).toBe('visao');
    expect(result.current.tipos).toEqual(['pessoa', 'animal']);
    expect(result.current.vistos).toBe(true);
    expect(result.current.camera).toBe('c1');
    expect(result.current.dia).toBeNull();
  });

  it('sem nada na URL, tudo no padrão', () => {
    const { result } = renderHook(useTudo, { wrapper: comRota('/s') });
    expect(result.current).toMatchObject({ aba: 'visao', tipos: [], vistos: false, camera: null, dia: null });
  });

  it('escreve só o que difere do padrão; push na aba, replace no filtro', () => {
    const { result } = renderHook(useTudo, { wrapper: comRota('/s?x=1#topo') });
    act(() => result.current.setAba('cameras'));
    expect(result.current.loc.search).toBe('?aba=cameras&x=1');
    expect(result.current.loc.hash).toBe('#topo');
    expect(result.current.tipoNav).toBe('PUSH');

    act(() => result.current.setTipos(['veiculo', 'pessoa']));
    expect(result.current.tipos).toEqual(['veiculo', 'pessoa']);
    expect(result.current.tipoNav).toBe('REPLACE');

    act(() => {
      result.current.setAba('visao');
      result.current.setTipos([]);
    });
    expect(result.current.loc.search).toBe('?x=1');
  });

  it('várias escritas no mesmo clique se somam numa entrada só', () => {
    const { result } = renderHook(useTudo, { wrapper: comRota('/s?camera=c1&naoVistos=1') });
    act(() => {
      result.current.setCamera('c2');
      result.current.setVistos(false);
      result.current.setAba('alarmes', { historico: 'push' });
    });
    expect(result.current.loc.search).toBe('?aba=alarmes&camera=c2');
    expect(result.current.loc.pathname).toBe('/s');
  });

  it('limpar troca a busca inteira (troca de aba descarta o estado da anterior)', () => {
    const { result } = renderHook(useTudo, { wrapper: comRota('/s?camera=c1&evento=e1') });
    act(() => result.current.escrever({ aba: 'alarmes' }, 'push', { limpar: true }));
    expect(result.current.loc.search).toBe('?aba=alarmes');
  });

  it('mantém o location.state da navegação', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[{ pathname: '/s', state: { unidade: 'u1' } }]}>{children}</MemoryRouter>
    );
    const { result } = renderHook(useTudo, { wrapper });
    act(() => result.current.setCamera('c9'));
    expect(result.current.loc.state).toEqual({ unidade: 'u1' });
  });
});
