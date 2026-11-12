import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CabecalhoCalibracao, PainelCalibracao } from './PivoCalibracao';
import { MapaPivo, SecaoEncoder } from './PivoSheet';
import { corpoParametros, parametrosEmJogo } from './pivoConfigContas';
import type { Calibracao, CalibracaoTela, CorpoCalibracao } from './pivoCalibracaoContas';

// NEXON-103 — Calibração do ângulo do pivô, sub-tela da Configuração (sem rede: a PainelCalibracao
// recebe o que o GET devolveu), a linha que a abre em Posição do pivô, o que a Configuração grava
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

describe('Calibração do ângulo (sub-tela da Configuração)', () => {
  it('topo da sub-tela: "‹ Configuração" volta e o título diz onde a pessoa está', () => {
    const onVoltar = vi.fn();
    render(<CabecalhoCalibracao onVoltar={onVoltar} />);
    expect(screen.getByRole('heading', { name: 'Calibração do ângulo' })).toBeTruthy();
    const voltar = screen.getByRole('button', { name: 'Configuração' });
    expect(voltar.textContent).toBe('‹Configuração');
    expect(voltar.style.minHeight).toBe('44px');
    fireEvent.click(voltar);
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it('pivô sem encoder gravado: diz o que fazer, volta para a Configuração e não mostra o formulário', () => {
    const onVoltar = vi.fn();
    abrir({ encoder: null }, { onVoltar });
    expect(screen.getByText('Pivô sem encoder gravado: escolha o encoder e a resolução em Posição do pivô, salve e volte aqui.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Salvar calibração' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ler encoder' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a Configuração' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);
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

describe('Configuração → Posição do pivô', () => {
  // 21:05 no fuso de quem roda o teste: a linha mostra dia/mês e hora locais.
  const GRAVADA_EM = new Date(2026, 10, 11, 21, 5).toISOString();
  const LIDO_EM = new Date(2026, 10, 12, 8, 30).toISOString();
  const ENC = { id: 'e1', nome: 'Encoder_1', bruto: 150, lido_em: LIDO_EM };
  type Props = Parameters<typeof SecaoEncoder>[0];
  const POS: NonNullable<Props['posicao']> = {
    fonte: 'encoder', angulo: 46.9, angulo_sem_zero: null, bruto: 150, lido_em: LIDO_EM, motivo: null,
    encoder: { equipamento_id: 'e1', resolucao: 360, invertido: false, zero: 0 }, sem_calibracao: false,
    calibracao: { id: 'c1', az_cal: 43.87, bruto_cal: 147, sentido: 1, criado_em: GRAVADA_EM },
  };
  const SEM_CAL: NonNullable<Props['posicao']> = { ...POS, angulo: null, sem_calibracao: true, calibracao: null, motivo: 'Sem calibração: mostrando só a leitura bruta do encoder' };
  function secaoEncoder(props: Partial<Props> = {}) {
    const onCalibrar = vi.fn();
    render(
      <SecaoEncoder encs={[ENC]} enc={{ id: 'e1', res: '360' }} setEnc={() => {}} encSel={ENC} encRes={360} encRuim={false} ro={false}
        zero="" setZero={() => {}} gravado={{ id: 'e1', res: 360 }} posicao={POS} onCalibrar={onCalibrar} {...props} />,
    );
    return { onCalibrar };
  }
  const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement;

  it('com calibração: resumo na linha, "Recalibrar" abre a sub-tela e a leitura mostra o ângulo calibrado', () => {
    const { onCalibrar } = secaoEncoder();
    expect(screen.getByText('Calibração do ângulo')).toBeTruthy();
    expect(screen.getByText('Azimute 43,9° · leitura 147 · Horário · 11/11 21:05')).toBeTruthy();
    expect(botao('Recalibrar').disabled).toBe(false);
    fireEvent.click(botao('Recalibrar'));
    expect(onCalibrar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('46,9°')).toBeTruthy();
    expect(screen.getByText('Contagem 150 · 12/11 08:30')).toBeTruthy();
  });

  it('sem calibração: avisa em cor de atenção, botão "Calibrar" e só a contagem bruta', () => {
    secaoEncoder({ posicao: SEM_CAL });
    const aviso = screen.getByText('Sem calibração: o pivô mostra só a leitura bruta do encoder');
    expect(aviso.style.color).toBe('#B7791F');
    expect(botao('Calibrar').disabled).toBe(false);
    expect(screen.getByText('—°')).toBeTruthy();
    expect(screen.getByText('Contagem 150 · 12/11 08:30')).toBeTruthy();
  });

  it('zero e sentido não ficam mais na Configuração de pivô com encoder', () => {
    secaoEncoder();
    expect(screen.queryByText('Sentido invertido')).toBeNull();
    expect(screen.queryByText('Correção do ângulo zero')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zerar aqui' })).toBeNull();
    expect(screen.queryByText(/aba Calibração/)).toBeNull();
  });

  it('ordem: Encoder → Resolução → Calibração do ângulo → Leitura agora', () => {
    secaoEncoder();
    const texto = document.body.textContent ?? '';
    const pos = ['Encoder absoluto', 'Resolução', 'Calibração do ângulo', 'Leitura agora'].map((r) => texto.indexOf(r));
    expect(pos.every((i) => i >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it.each([
    ['encoder escolhido e não salvo', { gravado: { id: null, res: null }, posicao: null }],
    ['encoder trocado e não salvo', { gravado: { id: 'e0', res: 360 } }],
    ['resolução trocada e não salva', { gravado: { id: 'e1', res: 4096 } }],
    ['resolução vazia', { enc: { id: 'e1', res: '' }, encRes: null, encRuim: true }],
  ] as Array<[string, Partial<Props>]>)('%s: botão desabilitado com o motivo no subtítulo', (_caso, props) => {
    const { onCalibrar } = secaoEncoder(props);
    expect(screen.getByText('Salve o encoder e a resolução para calibrar')).toBeTruthy();
    const b = screen.getByRole('button', { name: /^(Calibrar|Recalibrar)$/ }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onCalibrar).not.toHaveBeenCalled();
    // sem encoder gravado igual ao da tela, o ângulo do estado não é deste encoder
    expect(screen.getByText('—°')).toBeTruthy();
  });

  it('outra alteração não salva na Configuração: salvar antes (a sub-tela descartaria o rascunho)', () => {
    secaoEncoder({ pendente: true });
    expect(screen.getByText('Salve as alterações desta tela para abrir a calibração')).toBeTruthy();
    expect(botao('Recalibrar').disabled).toBe(true);
  });

  it('perfil só leitura: o botão vira "Ver"', () => {
    const { onCalibrar } = secaoEncoder({ ro: true });
    fireEvent.click(botao('Ver'));
    expect(onCalibrar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Recalibrar' })).toBeNull();
  });

  it('alvo de toque do botão: 44 px, sem encolher nem quebrar linha', () => {
    secaoEncoder();
    const b = botao('Recalibrar');
    expect(b.style.height).toBe('44px');
    expect(b.style.whiteSpace).toBe('nowrap');
    expect(b.style.flex).toMatch(/^(none|0 0 auto)$/);
  });

  it('pivô sem encoder: a "Correção do ângulo zero" antiga continua, sem linha de calibração', () => {
    const setZero = vi.fn();
    secaoEncoder({ enc: { id: '', res: '' }, encSel: null, encRes: null, gravado: { id: null, res: null }, posicao: null, zero: '30', setZero });
    const zero = screen.getByLabelText(/Correção do ângulo zero/) as HTMLInputElement;
    expect(zero.value).toBe('30');
    fireEvent.change(zero, { target: { value: '45' } });
    expect(setZero).toHaveBeenCalledWith('45');
    expect(screen.queryByText('Calibração do ângulo')).toBeNull();
    expect(screen.queryByText('Leitura agora')).toBeNull();
  });

  describe('o que a Configuração grava (PUT /pivos/:id/config)', () => {
    const DIGITADO: Record<string, number | null> = { pressao_minima: 2, lamina_100: 6.5, tempo_volta_100: 21, percentimetro_ciclo_s: 60, travado_min: 10, correcao_angulo_zero: 30 };
    const num = (k: string) => DIGITADO[k] ?? null;
    const GRAVADOS: Parameters<typeof corpoParametros>[2] = {
      pressao_minima: 2, lamina_100: 6.5, tempo_volta_100: 21, correcao_angulo_zero: -103.13, direcionamento: 'fisico', valvula_ton_id: null, valvula_bo: null,
      encoder_equipamento_id: 'e1', encoder_resolucao: 360, encoder_invertido: true,
    };
    const chaves = (enc: string, calibrado: boolean) => parametrosEmJogo(enc, calibrado).map((p) => p.key as string);

    it.each([[false], [true]])('com encoder (calibração vigente: %s): zero e sentido não entram no diff nem no corpo', (calibrado) => {
      expect(chaves('e1', calibrado)).not.toContain('correcao_angulo_zero');
      expect(chaves('e1', calibrado)).toContain('travado_min');
      const corpo = corpoParametros(num, { id: 'e1', res: 4096 }, GRAVADOS, { travadoMudou: false, calibrado });
      expect(corpo).toEqual({ pressao_minima: 2, lamina_100: 6.5, tempo_volta_100: 21, percentimetro_ciclo_s: 60, encoder_equipamento_id: 'e1', encoder_resolucao: 4096 });
      expect(corpo).not.toHaveProperty('correcao_angulo_zero');
      expect(corpo).not.toHaveProperty('encoder_invertido');
    });

    it('sem encoder: o zero legado segue no diff e no corpo, como antes', () => {
      expect(chaves('', false)).toContain('correcao_angulo_zero');
      expect(chaves('', false)).not.toContain('travado_min');
      expect(corpoParametros(num, { id: '', res: null }, { ...GRAVADOS, encoder_equipamento_id: null, encoder_invertido: false }, { travadoMudou: false, calibrado: false }))
        .toEqual({ pressao_minima: 2, lamina_100: 6.5, tempo_volta_100: 21, percentimetro_ciclo_s: 60, encoder_equipamento_id: null, encoder_resolucao: 360, correcao_angulo_zero: 30, encoder_invertido: false });
    });

    it('tirando o encoder de um pivô calibrado: zero e sentido ficam fora (a API recusa com calibração vigente)', () => {
      expect(chaves('', true)).not.toContain('correcao_angulo_zero');
      const corpo = corpoParametros(num, { id: '', res: null }, GRAVADOS, { travadoMudou: false, calibrado: true });
      expect(corpo).not.toHaveProperty('correcao_angulo_zero');
      expect(corpo).not.toHaveProperty('encoder_invertido');
      expect(corpo.encoder_equipamento_id).toBeNull();
    });

    it('"Alarme de pivô travado" só vai quando mudou, arredondado', () => {
      const corpo = corpoParametros((k) => (k === 'travado_min' ? 12.4 : num(k)), { id: 'e1', res: 360 }, GRAVADOS, { travadoMudou: true, calibrado: true });
      expect(corpo).toMatchObject({ travado_min: 12 });
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
    // o norte do pivô vem identificado: seta no topo com o "N" ao lado
    expect(container.querySelector('[data-norte]')?.textContent).toBe('N');
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
