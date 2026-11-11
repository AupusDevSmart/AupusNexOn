import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PainelCalibracao } from './PivoCalibracao';
import { MapaPivo } from './PivoSheet';
import type { Calibracao, CalibracaoTela, CorpoCalibracao } from './pivoCalibracaoContas';

// NEXON-103 — aba Calibração do pivô (sem rede: a PainelCalibracao recebe o que o GET devolveu)
// e o desenho do pivô (seta de sentido, parado em cinza, sem leitura, sem calibração).

const CAL: Calibracao = {
  id: 'c1', bruto_cal: 147, sentido: 1, az_cal: 43.87, centro_lat: -16, centro_lon: -48, ponta_lat: -15.997, ponta_lon: -47.997,
  resolucao: 360, zero: -103.13, origem: 'calibracao', ativa: true, usuario_id: 'u1', usuario_nome: 'Fulano', criado_em: '2026-11-10T12:00:00.000Z', desativada_em: null,
};
const TELA: CalibracaoTela = {
  pode_editar: true,
  encoder: { equipamento_id: 'e1', nome: 'Encoder_1', resolucao: 360 },
  vigente: null, anterior: null,
  precondicoes: { parado: true, modo_ton: true, tem_modo_ton: true, pendencias: [] },
  leitura: { bruto: 147, lido_em: '2026-11-11T20:00:00.000Z', angulo: null, motivo: 'Sem calibração: mostrando só a leitura bruta do encoder' },
  ultima_leitura_valida: null, distancia_min_m: 50, leituras_exigidas: 5,
};
const LIDA = { valor: 147, leituras: [147, 147, 147, 147, 147], em: '2026-11-11T20:00:00.000Z' };

// Os diálogos (NxDialog) trazem o <link> da fonte: o happy-dom não deve ir buscá-la na rede.
beforeAll(() => {
  const hd = (window as unknown as { happyDOM?: { settings?: { disableCSSFileLoading?: boolean; handleDisabledFileLoadingAsSuccess?: boolean } } }).happyDOM;
  if (hd?.settings) { hd.settings.disableCSSFileLoading = true; hd.settings.handleDisabledFileLoadingAsSuccess = true; }
});

let n = 0;
function abrir(tela: Partial<CalibracaoTela> = {}, props: Partial<Parameters<typeof PainelCalibracao>[0]> = {}) {
  const onLer = vi.fn();
  const onSalvar = vi.fn<(c: CorpoCalibracao) => Promise<boolean>>(async () => true);
  const onRestaurar = vi.fn(async () => true);
  render(
    <PainelCalibracao pivoId={`pivo-${++n}`} tela={{ ...TELA, ...tela }} podeEditar acao={null} geoDisponivel={false}
      onLer={onLer} onSalvar={onSalvar} onRestaurar={onRestaurar} {...props} />,
  );
  return { onLer, onSalvar, onRestaurar };
}
const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement;
const digitar = (nome: string, v: string) => fireEvent.change(campo(nome), { target: { value: v } });
const salvarBtn = () => screen.getByRole('button', { name: 'Salvar calibração' }) as HTMLButtonElement;
function preencher() {
  digitar('Posição do centro · latitude', '-16,0000000');
  digitar('Posição do centro · longitude', '-48.0000000');
  digitar('Posição da ponta · latitude', '-15,9970000');
  digitar('Posição da ponta · longitude', '-47,9970000');
}

describe('aba Calibração', () => {
  it('pivô sem encoder: explica onde escolher e não mostra o formulário', () => {
    abrir({ encoder: null });
    expect(screen.getByText('Pivô sem encoder')).toBeTruthy();
    expect(screen.getByText(/Escolha o encoder e a resolução na aba Configuração/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Salvar calibração' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ler encoder' })).toBeNull();
  });

  it('sem calibração: avisa e mostra a leitura bruta', () => {
    abrir();
    expect(screen.getByText('Sem calibração')).toBeTruthy();
    expect(screen.getByText(/Contagem 147/)).toBeTruthy();
    expect(screen.getByLabelText('Azimute calculado').textContent).toBe('—');
  });

  it('textos de ajuda do sentido e da ponta', () => {
    abrir();
    expect(screen.getByText('Quando o pivô anda no sentido horário (visto de cima), o número do encoder aumenta ou diminui?')).toBeTruthy();
    expect(screen.getByText('Aumenta = Horário · Diminui = Anti-horário')).toBeTruthy();
    expect(screen.getByText('Use o ponto da última torre, não do meio do lance.')).toBeTruthy();
  });

  it('Salvar desabilitado com TODOS os motivos à vista', () => {
    abrir({ precondicoes: { parado: false, modo_ton: false, tem_modo_ton: true, pendencias: ['Pivô em movimento: a calibração só é feita com o pivô parado', 'Chave seletora em modo CLP: passe para o modo TON'] } });
    expect(salvarBtn().disabled).toBe(true);
    const falta = screen.getByRole('status', { name: 'O que falta para salvar' }).textContent ?? '';
    expect(falta).toContain('Pivô em movimento: a calibração só é feita com o pivô parado');
    expect(falta).toContain('Chave seletora em modo CLP: passe para o modo TON');
    expect(falta).toContain('Leia o encoder');
    expect(falta).toContain('Informe a posição do centro');
    expect(falta).toContain('Informe a posição da ponta');
  });

  it('leitura recusada pela TON aparece em vermelho e bloqueia o Salvar', () => {
    abrir({}, { recusa: { valida: false, valor: null, leituras: [147, 150, 147, 147, 147], motivo: 'Leitura instável: variou 3 posições em 5 leituras (o pivô está parado?)', lido_em: '2026-11-11T20:00:00.000Z' } });
    expect(screen.getByRole('alert').textContent).toContain('Leitura instável: variou 3 posições em 5 leituras');
    expect(screen.getByRole('alert').textContent).toContain('147 · 150 · 147');
    expect(screen.getByRole('status', { name: 'O que falta para salvar' }).textContent).toContain('Leitura do encoder recusada: Leitura instável');
  });

  it('Ler encoder chama a leitura; o valor nunca é digitável', () => {
    const { onLer } = abrir({ ultima_leitura_valida: LIDA });
    fireEvent.click(screen.getByRole('button', { name: 'Ler encoder' }));
    expect(onLer).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Leitura do encoder para a calibração').tagName).toBe('SPAN');
    expect(screen.getByLabelText('Leitura do encoder para a calibração').textContent).toBe('147');
    expect(screen.getByText(/Leituras: 147 · 147 · 147 · 147 · 147/)).toBeTruthy();
  });

  it('pontos muito próximos: motivo com a distância', () => {
    abrir({ ultima_leitura_valida: LIDA });
    preencher();
    digitar('Posição da ponta · latitude', '-15,9997');
    digitar('Posição da ponta · longitude', '-48');
    expect(salvarBtn().disabled).toBe(true);
    expect(screen.getByText('• Pontos muito próximos: 33 m (mínimo 50 m)')).toBeTruthy();
  });

  it('tudo certo: calcula 43,9°, confirma e envia só os seis campos', async () => {
    const { onSalvar } = abrir({ ultima_leitura_valida: LIDA, vigente: CAL });
    preencher();
    expect(screen.getByLabelText('Azimute calculado').textContent).toBe('43,9°');
    expect(screen.queryByRole('status', { name: 'O que falta para salvar' })).toBeNull();
    expect(salvarBtn().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Anti-horário' }));
    fireEvent.click(salvarBtn());
    expect(onSalvar).not.toHaveBeenCalled();   // só depois de confirmar
    expect(screen.getByRole('dialog').textContent).toContain('Confirmar calibração');
    expect(screen.getByText('CALIBRAÇÃO ATUAL · SERÁ SUBSTITUÍDA')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    expect(onSalvar.mock.calls[0][0]).toEqual({ bruto_cal: 147, sentido: -1, centro_lat: -16, centro_lon: -48, ponta_lat: -15.997, ponta_lon: -47.997 });
  });

  it('com calibração vigente: mostra a vigente, herda o sentido e o centro', () => {
    abrir({ vigente: { ...CAL, sentido: -1 } });
    expect(screen.getByText('por Fulano')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anti-horário' }).getAttribute('aria-pressed')).toBe('true');
    expect(campo('Posição do centro · latitude').value).toBe('-16,0000000');
    expect(campo('Posição da ponta · latitude').value).toBe('');
    expect(screen.getByText('Centro da calibração vigente: confira ou troque')).toBeTruthy();
  });

  it('sem calibração vigente, o sentido parte do "invertido" da Configuração', () => {
    abrir({}, { invertido: true });
    expect(screen.getByRole('button', { name: 'Anti-horário' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Restaurar só aparece com calibração anterior, confirma mostrando os valores dela', async () => {
    abrir();
    expect(screen.queryByRole('button', { name: 'Restaurar calibração anterior' })).toBeNull();
    const { onRestaurar } = abrir({ vigente: CAL, anterior: { ...CAL, id: 'c0', az_cal: 120.5, bruto_cal: 30, ativa: false, usuario_nome: 'Beltrano' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar calibração anterior' }));
    expect(onRestaurar).not.toHaveBeenCalled();
    expect(screen.getByText('Restaurar calibração anterior?')).toBeTruthy();
    expect(screen.getAllByText('120,5°').length).toBeGreaterThanOrEqual(2);   // no cartão e no diálogo
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(onRestaurar).toHaveBeenCalledTimes(1));
  });

  it('Restaurar fica desabilitado com o pivô em movimento', () => {
    abrir({ anterior: { ...CAL, id: 'c0', ativa: false }, precondicoes: { parado: false, modo_ton: true, tem_modo_ton: true, pendencias: ['Pivô em movimento: a calibração só é feita com o pivô parado'] } });
    expect((screen.getByRole('button', { name: 'Restaurar calibração anterior' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('somente leitura: vê a vigente e a leitura, sem ler, salvar nem restaurar', () => {
    abrir({ pode_editar: false, vigente: CAL, anterior: { ...CAL, id: 'c0', ativa: false } }, { podeEditar: false });
    expect(screen.getByText('CALIBRAÇÃO VIGENTE')).toBeTruthy();
    expect(screen.getByText('Somente leitura para este perfil')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ler encoder' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar calibração' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restaurar calibração anterior' })).toBeNull();
    expect(screen.queryByLabelText('Posição do centro · latitude')).toBeNull();
  });

  describe('Usar localização atual', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'geolocation');
    const comGeo = (getCurrentPosition: Geolocation['getCurrentPosition']) =>
      Object.defineProperty(globalThis.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    afterEach(() => {
      if (original) Object.defineProperty(globalThis.navigator, 'geolocation', original);
      else delete (globalThis.navigator as unknown as Record<string, unknown>).geolocation;
    });

    it('sem geolocalização: botões desabilitados com explicação; digitar continua valendo', () => {
      abrir();
      const botoes = screen.getAllByRole('button', { name: 'Usar localização atual' }) as HTMLButtonElement[];
      expect(botoes).toHaveLength(2);   // um para o centro, outro para a ponta
      expect(botoes.every((b) => b.disabled)).toBe(true);
      expect(screen.getAllByText(/Este navegador não informa a localização/)).toHaveLength(2);
      digitar('Posição da ponta · latitude', '-15,997');
      expect(campo('Posição da ponta · latitude').value).toBe('-15,997');
    });

    it('preenche o ponto pedido com alta precisão e mostra o ± m', () => {
      const pedir = vi.fn<Geolocation['getCurrentPosition']>((ok) => ok({ coords: { latitude: -15.997, longitude: -47.997, accuracy: 4.6 } } as GeolocationPosition));
      comGeo(pedir);
      abrir({}, { geoDisponivel: true });
      fireEvent.click(screen.getAllByRole('button', { name: 'Usar localização atual' })[1]);
      expect(pedir.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, timeout: 15000 });
      expect(campo('Posição da ponta · latitude').value).toBe('-15,9970000');
      expect(campo('Posição da ponta · longitude').value).toBe('-47,9970000');
      expect(campo('Posição do centro · latitude').value).toBe('');
      expect(screen.getByText(/precisão ± 5 m/)).toBeTruthy();
    });

    it('permissão negada: mensagem clara e o campo segue como estava', () => {
      comGeo((_ok, falha) => falha?.({ code: 1 } as GeolocationPositionError));
      abrir({}, { geoDisponivel: true });
      fireEvent.click(screen.getAllByRole('button', { name: 'Usar localização atual' })[0]);
      expect(screen.getByRole('alert').textContent).toMatch(/Localização negada/);
      expect(campo('Posição do centro · latitude').value).toBe('');
    });
  });
});

describe('desenho do pivô', () => {
  const base = { aviso: null, falha: false, direcao: 'Direita', faixas: [] };
  const braco = (c: HTMLElement) => c.querySelector('[data-braco]');
  const seta = (c: HTMLElement) => c.querySelector('[data-seta]');

  it('girando para a direita: braço branco e seta no sentido horário', () => {
    const { container } = render(<MapaPivo {...base} angulo={90} girando sentido="direita" />);
    expect(braco(container)?.getAttribute('stroke')).toBe('#FFFFFF');
    expect(seta(container)?.getAttribute('data-seta')).toBe('direita');
    // Braço a 90° aponta para a direita; a seta do horário fica abaixo dele (y maior que o do centro).
    const d = seta(container)!.getAttribute('d')!;
    expect(Number(d.split(' ')[1])).toBeGreaterThan(150);
  });

  it('girando para a esquerda: seta no anti-horário', () => {
    const { container } = render(<MapaPivo {...base} angulo={90} girando sentido="esquerda" />);
    expect(seta(container)?.getAttribute('data-seta')).toBe('esquerda');
    expect(Number(seta(container)!.getAttribute('d')!.split(' ')[1])).toBeLessThan(150);
  });

  it('parado: braço cinza e sem seta', () => {
    const { container } = render(<MapaPivo {...base} angulo={90} girando={false} sentido={null} />);
    expect(braco(container)?.getAttribute('stroke')).toBe('#A9ADBC');
    expect(seta(container)).toBeNull();
    expect(screen.getByText(/90,0°/)).toBeTruthy();
  });

  it('sem leitura válida: "—°" e sem braço', () => {
    const { container } = render(<MapaPivo {...base} angulo={null} aviso="Encoder sem leitura há mais de 15 min" girando sentido="direita" />);
    expect(braco(container)).toBeNull();
    expect(seta(container)).toBeNull();
    expect(screen.getByText(/—°/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Posição indisponível: Encoder sem leitura há mais de 15 min');
  });

  it('sem calibração: sem braço, só a leitura bruta com aviso (mesmo se vier um ângulo)', () => {
    const { container } = render(<MapaPivo {...base} angulo={12} semCalibracao bruto={147} aviso="Sem calibração: mostrando só a leitura bruta do encoder" girando sentido="direita" />);
    expect(braco(container)).toBeNull();
    expect(seta(container)).toBeNull();
    expect(screen.getByText(/—°/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Sem calibração · leitura bruta 147');
  });

  it('sem calibração e sem leitura atual do encoder: não mostra bruto velho', () => {
    render(<MapaPivo {...base} angulo={null} semCalibracao bruto={null} aviso="Encoder sem leitura há mais de 15 min" girando={false} sentido={null} />);
    expect(screen.getByRole('status').textContent).toBe('Sem calibração · Encoder sem leitura há mais de 15 min');
  });
});
