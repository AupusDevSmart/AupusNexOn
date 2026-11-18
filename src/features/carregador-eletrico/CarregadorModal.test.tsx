import { afterEach, beforeAll, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '@/config/api';
import { CarregadorModal } from './CarregadorModal';
import { CSS } from './carregador.estilos';
import type { Estado } from './carregador.util';

// NEXON-130 — o modal inteiro contra o contrato da API (docs/carregador/API-CARREGADOR-OCPP.md):
// o que aparece para cada estado e perfil, e o que é enviado. Sem rede: a `api` é de teste.
vi.mock('@/config/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
const rede = api as unknown as { get: Mock; post: Mock; put: Mock; delete: Mock };

beforeAll(() => {
  const hd = (window as unknown as { happyDOM?: { settings?: { disableCSSFileLoading?: boolean; handleDisabledFileLoadingAsSuccess?: boolean } } }).happyDOM;
  if (hd?.settings) { hd.settings.disableCSSFileLoading = true; hd.settings.handleDisabledFileLoadingAsSuccess = true; }
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const agora = () => new Date().toISOString();
const PODE_TUDO = { comandar: true, limites: true, bloquear: true, tecnico: true };
const LIMITES = { tempo_min: 120, energia_kwh: 20, inicio_automatico: false, corrente_a: null, corrente_min_a: 6, corrente_max_a: 32, corrente_suportada: null };
const OCPP = { conectado: true, ultima_comunicacao: agora(), disponivel: true, fabricante: 'CHINT', modelo: 'NTW-EC2A22W1-L' };
const BASE: Estado = { papel: 'analista', tarifa_kwh: 0.9, potencia_kw: 22, soc: null, sessao_ativa: null, sessoes: [] };
const ocppEstado = (e: Partial<Estado> = {}): Estado => ({ ...BASE, estado: 'disponivel', fonte_kwh: 'ocpp', ocpp: OCPP, leitura: null, falha: null, limites: LIMITES, pode: PODE_TUDO, ...e });

/**
 * A API responde com o `estado` dado; `atual` deixa trocar a resposta no meio do teste.
 * `tarifaLista` = valor do kWh na lista de carregadores (null para quem a API não mostra R$).
 */
function servir(estado: Estado, tarifaLista: number | null = 0.9) {
  const atual = { estado };
  rede.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/estado')) return { data: atual.estado };
    if (url === '/carregador-eletrico/carregadores') return { data: [{ id: 'c1', nome: 'Vaga 12', potencia_kw: 22, tarifa_kwh: tarifaLista, planta_id: 'p1' }] };
    if (url === '/carregador-eletrico/sessoes') return { data: atual.estado.sessoes ?? [] };
    if (url === '/carregador-eletrico/moradores') return { data: [{ id: 'm1', nome: 'Ana', apartamento: 'Apto 302', ativo: true }] };
    if (url.endsWith('/ocpp')) return { data: { vinculado: !!atual.estado.ocpp, charge_point_id: atual.estado.ocpp ? 'SERIE123' : null, conectado: true, recusadas: [] } };
    return { data: [] };
  });
  return atual;
}
async function abrir(estado: Estado, tarifaLista?: number | null) {
  const atual = servir(estado, tarifaLista);
  render(<CarregadorModal open onOpenChange={() => undefined} carregador={{ id: 'c1', nome: 'Vaga 12' }} />);
  await waitFor(() => expect(rede.get).toHaveBeenCalledWith('/carregador-eletrico/moradores', expect.anything()));
  await waitFor(() => expect(tela()).toMatch(/Recargas de todos os moradores|Minhas recargas/));
  return atual;
}
function tela() { return document.body.textContent ?? ''; }
const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome }) as HTMLButtonElement;
const temBotao = (nome: string | RegExp) => screen.queryByRole('button', { name: nome }) != null;

describe('antes da primeira leitura', () => {
  it('não afirma nada do carregador nem deixa iniciar; se a leitura falha, diz e deixa tentar de novo', async () => {
    rede.get.mockRejectedValue(new Error('rede'));
    render(<CarregadorModal open onOpenChange={() => undefined} carregador={{ id: 'c1', nome: 'Vaga 12' }} />);
    expect(screen.getAllByText('Lendo…').length).toBeGreaterThanOrEqual(2);
    expect(botao('Iniciar recarga').disabled).toBe(true);
    expect(temBotao('Configurações')).toBe(false);

    const erro = await screen.findByRole('alert');
    expect(erro.textContent).toContain('Não foi possível ler o carregador.');
    expect(screen.getAllByText('Sem leitura').length).toBeGreaterThanOrEqual(2);
    expect(botao('Iniciar recarga').disabled).toBe(true);

    servir({ ...BASE, estado: 'desconhecido' });
    fireEvent.click(botao('Tentar de novo'));
    await waitFor(() => expect(tela()).toContain('NormalDisponível'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(botao('Iniciar recarga').disabled).toBe(false);
    expect(temBotao('Configurações')).toBe(true);
  });

  it('a leitura recusada pela API mostra a mensagem dela', async () => {
    rede.get.mockRejectedValue({ response: { status: 403, data: { success: false, error: { code: 'FORBIDDEN', message: 'Você não tem acesso a este carregador.' } } } });
    render(<CarregadorModal open onOpenChange={() => undefined} carregador={{ id: 'c1', nome: 'Vaga 12' }} />);
    const erro = await screen.findByRole('alert');
    expect(erro.textContent).toContain('Você não tem acesso a este carregador.');
    expect(erro.textContent).not.toContain('Não foi possível ler o carregador.');
    expect(temBotao('Tentar de novo')).toBe(true);
  });
});

describe('carregador que não é OCPP: a tela de sempre', () => {
  it('livre: Disponível, linha Normal, cartões Energia e Previsto, sem nada de OCPP', async () => {
    await abrir({ ...BASE, estado: 'desconhecido', papel: 'proprietario' });
    await waitFor(() => expect(tela()).toContain('NormalDisponível'));
    expect(tela()).toContain('Energia0,0 kWh');
    expect(tela()).toContain('PrevistoR$ 0,00');
    expect(tela()).toContain('Conecte o carro e inicie a recarga');
    expect(tela()).not.toContain('Potência agora');
    expect(botao('Iniciar recarga').disabled).toBe(false);
    fireEvent.click(botao('Configurações'));
    expect(tela()).toContain('TARIFA');
    expect(tela()).toContain('MORADORES AUTORIZADOS');
    for (const novo of ['LIMITES DE USO', 'CORRENTE MÁXIMA', 'COMANDOS', 'CONEXÃO OCPP', 'PARÂMETROS DO EQUIPAMENTO']) expect(tela()).not.toContain(novo);
    // Proprietário não edita o valor do kWh: sem botão de salvar.
    expect(temBotao('Salvar')).toBe(false);
  });

  it('carregando: mesmo com `estado` conhecido não usa o mapa do OCPP e inicia só com o morador', async () => {
    const sessao = { id: 's1', status: 'ativa', morador_nome: 'Ana', morador_id: 'm1', kwh_total: 3.3, tarifa_kwh: 0.9, inicio_iso: new Date(Date.now() - 27 * 60000).toISOString() };
    await abrir({ ...BASE, estado: 'falha', sessao_ativa: sessao, sessoes: [sessao] });
    await waitFor(() => expect(tela()).toContain('NormalCarregando'));
    expect(tela()).toContain('Energia3,3 kWh');
    expect(tela()).toContain('PrevistoR$ 2,97');
    expect(botao('Parar recarga')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('iniciar manda só o morador; o analista ainda vê a Conexão OCPP para vincular', async () => {
    rede.post.mockResolvedValue({ data: { id: 's1', morador: 'Ana' } });
    await abrir({ ...BASE, estado: 'desconhecido', pode: PODE_TUDO });
    fireEvent.click(botao('Iniciar recarga'));
    expect(tela()).toContain('Bateria do carro');
    expect(tela()).not.toContain('Limite de tempo (min)');
    fireEvent.click(botao('Iniciar'));
    await waitFor(() => expect(rede.post).toHaveBeenCalledWith('/carregador-eletrico/c1/liberar', { morador_id: 'm1' }));

    fireEvent.click(botao('Configurações'));
    await waitFor(() => expect(screen.getByLabelText(/Identidade do carregador/)).toBeTruthy());
    expect(tela()).toContain('CONEXÃO OCPP');
    for (const novo of ['LIMITES DE USO', 'COMANDOS', 'PARÂMETROS DO EQUIPAMENTO']) expect(tela()).not.toContain(novo);
    // O Salvar do valor do kWh continua no fim, desligado enquanto nada muda.
    expect(botao('Salvar').disabled).toBe(true);
  });
});

describe('carregador OCPP: estado real e medições', () => {
  it('sem comunicação: pílula, última comunicação e Iniciar desligado com a razão', async () => {
    const quando = new Date(2026, 10, 18, 14, 11).toISOString();
    await abrir(ocppEstado({ estado: 'sem_comunicacao', ocpp: { ...OCPP, conectado: false, ultima_comunicacao: quando } }));
    await waitFor(() => expect(tela()).toContain('Última comunicação: 18/11/2026 14:11'));
    expect(screen.getAllByText('Sem comunicação').length).toBeGreaterThanOrEqual(2);
    expect(botao('Iniciar recarga').disabled).toBe(true);
    expect(tela()).toContain('Sem comunicação com o carregador. Não dá para iniciar agora.');
  });

  it('pílula de estado: uma ao lado do título (tela larga) e outra embaixo do subtítulo (celular); o CSS mostra só uma', async () => {
    await abrir(ocppEstado({ estado: 'sem_comunicacao', ocpp: { ...OCPP, conectado: false } }));
    await waitFor(() => expect(document.querySelector('.nxc-selo-topo')?.textContent).toBe('Sem comunicação'));
    expect(document.querySelector('.nxc-selo-sub')?.textContent).toBe('Sem comunicação');
    // Tela larga: só a de cima. Abaixo de 760 px: só a de baixo.
    expect(CSS).toContain('.nxc-selo-sub{display:none}');
    expect(CSS).toMatch(/@media \(max-width: 759px\)\{[^@]*\.nxc-selo-topo\{display:none\}[^@]*\.nxc-selo-sub\{display:flex/);
  });

  it('bloqueado pelo NexON aparece como Bloqueado', async () => {
    await abrir(ocppEstado({ estado: 'indisponivel', ocpp: { ...OCPP, disponivel: false } }));
    await waitFor(() => expect(screen.getAllByText('Bloqueado').length).toBeGreaterThanOrEqual(2));
    expect(botao('Iniciar recarga').disabled).toBe(true);
  });

  it('falha: aviso em destaque no topo da Operação', async () => {
    await abrir(ocppEstado({ estado: 'falha', falha: { codigo: 'E07', ocpp: 'OtherError', titulo: 'Botão de parada de emergência pressionado', solucao: 'Gire o botão no sentido indicado para liberar.', desde: agora() } }));
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('Falha E07');
    expect(aviso.textContent).toContain('Gire o botão no sentido indicado para liberar.');
  });

  it('carregando: potência da leitura, energia, tempo, medidas e o limite com o que falta', async () => {
    const sessao = {
      id: 's1', status: 'ativa', morador_nome: 'Ana', morador_id: 'm1', kwh_total: 3.254, tarifa_kwh: 0.9, inicio_iso: new Date(Date.now() - 27 * 60000).toISOString(),
      aguardando_inicio: false, origem: 'nexon', duracao_min: 27, limite_tempo_min: 60, limite_energia_kwh: 15,
    };
    await abrir(ocppEstado({
      estado: 'carregando', sessao_ativa: sessao, sessoes: [sessao],
      leitura: { potencia_kw: 7.21, corrente_a: 31.4, tensao_v: 221, temperatura_c: 41, energia_sessao_kwh: 3.254, lido_em: agora() },
    }));
    await waitFor(() => expect(tela()).toContain('Potência agora7,2 kW'));
    expect(screen.getAllByText('Carregando').length).toBeGreaterThanOrEqual(2);
    expect(tela()).toContain('Energia da recarga3,3 kWh');
    expect(tela()).toContain('Tempo da recarga0 h 27 min');
    expect(tela()).toContain('Valor estimadoR$ 2,93');
    expect(tela()).toContain('Corrente 31,4 A');
    expect(tela()).toContain('Tensão 221 V');
    expect(tela()).toContain('Temperatura 41 °C');
    expect(tela()).toContain('Limite: 60 min · 15 kWh');
    expect(tela()).toContain('Faltam 33 min · 11,7 kWh');
    expect(botao('Parar recarga').disabled).toBe(false);
  });

  it('recarga iniciada pelo cartão, antes da primeira medição: a energia não sai da leitura, que ainda é a da recarga anterior', async () => {
    const sessao = {
      id: 's2', morador_nome: 'Ana', morador_id: 'm1', kwh_total: null, tarifa_kwh: 0.9, inicio_iso: new Date(Date.now() - 20000).toISOString(),
      aguardando_inicio: false, origem: 'cartao', duracao_min: 0, limite_tempo_min: null, limite_energia_kwh: null,
    };
    await abrir(ocppEstado({
      estado: 'carregando', sessao_ativa: sessao, sessoes: [],
      // Última leitura recebida: o fecho da recarga anterior (12,3 kWh), uma hora atrás.
      leitura: { potencia_kw: 0, corrente_a: null, tensao_v: null, temperatura_c: null, energia_sessao_kwh: 12.3, lido_em: new Date(Date.now() - 3600000).toISOString() },
    }));
    await waitFor(() => expect(tela()).toContain('Energia da recarga0,0 kWh'));
    expect(tela()).toContain('Valor estimadoR$ 0,00');
    expect(tela()).not.toContain('12,3 kWh');
  });

  it('quem não vê R$ (a API manda o valor do kWh nulo): valor estimado "—" em vez de "R$ 0,00"', async () => {
    const sessao = {
      id: 's1', morador_nome: 'Ana', morador_id: 'm1', kwh_total: 3.3, tarifa_kwh: null, inicio_iso: new Date(Date.now() - 27 * 60000).toISOString(),
      aguardando_inicio: false, origem: 'nexon', duracao_min: 27, limite_tempo_min: null, limite_energia_kwh: null,
    };
    await abrir(ocppEstado({
      papel: 'operador', tarifa_kwh: null, estado: 'carregando', sessao_ativa: sessao, sessoes: [],
      pode: { comandar: true, limites: false, bloquear: true, tecnico: false },
    }), null);
    await waitFor(() => expect(tela()).toContain('Energia da recarga3,3 kWh'));
    expect(tela()).toContain('Valor estimado—');
    expect(tela()).not.toContain('R$ 0,00');
  });

  it('tabela: como terminou e a origem quando não foi pelo NexON', async () => {
    const fim = new Date(Date.now() - 3600000).toISOString();
    await abrir(ocppEstado({
      sessoes: [
        { id: 's1', status: 'encerrada', morador_nome: 'Ana', kwh_total: 12.3, inicio_iso: new Date(Date.now() - 2 * 3600000).toISOString(), fim_iso: fim, duracao_min: 61, motivo_fim: 'limite_tempo', motivo_fim_texto: 'Limite de tempo', origem: 'nexon' },
        { id: 's2', status: 'encerrada', morador_nome: null, kwh_total: 5, inicio_iso: new Date(Date.now() - 5 * 3600000).toISOString(), fim_iso: fim, duracao_min: 40, motivo_fim: 'desconectado', motivo_fim_texto: 'Carro desconectado', origem: 'automatico' },
        { id: 's3', status: 'encerrada', morador_nome: 'Ana', kwh_total: 2, inicio_iso: new Date(Date.now() - 8 * 3600000).toISOString(), fim_iso: fim, duracao_min: 15, motivo_fim: 'parado_no_carregador', motivo_fim_texto: 'Parado no carregador', origem: 'cartao' },
      ],
    }));
    await waitFor(() => expect(screen.getByText('Terminou: Limite de tempo')).toBeTruthy());
    expect(screen.getByText('Automático · Terminou: Carro desconectado')).toBeTruthy();
    expect(screen.getByText('Cartão · Terminou: Parado no carregador')).toBeTruthy();
    expect(screen.getByText('Sem morador')).toBeTruthy();
    expect(tela()).toContain('1 h 01 min');
  });
});

describe('tabelas em tela estreita', () => {
  /** Largura que a linha da tabela pede: colunas (o mínimo da flexível) + espaços + margem interna dos dois lados. */
  function larguraPedida(cabecalho: HTMLElement) {
    const estilo = cabecalho.getAttribute('style') ?? '';
    const px = (prop: string) => [...(new RegExp(`${prop}:([^;]+)`).exec(estilo)?.[1] ?? '').matchAll(/(\d+)px/g)].map((m) => Number(m[1]));
    const colunas = px('grid-template-columns');
    const [espaco] = px('gap');
    const margem = px('padding').at(-1) ?? 0;
    return { colunas: colunas.length, total: colunas.reduce((a, b) => a + b, 0) + (colunas.length - 1) * espaco + 2 * margem };
  }
  const minimoDoCartao = (cabecalho: HTMLElement) => Number.parseInt(cabecalho.parentElement?.style.minWidth ?? '', 10);

  // Com a largura mínima menor que a soma das colunas, cada linha saía com uma largura e as colunas desalinhavam.
  it('recargas (todos os moradores) e moradores autorizados: a largura mínima comporta as colunas', async () => {
    await abrir({ ...BASE, estado: 'desconhecido' });
    const recargas = screen.getByText('INÍCIO → FIM').parentElement as HTMLElement;
    expect(larguraPedida(recargas)).toEqual({ colunas: 6, total: 712 });
    expect(minimoDoCartao(recargas)).toBe(712);

    fireEvent.click(botao('Configurações'));
    const moradores = screen.getByText('VALIDADE').parentElement as HTMLElement;
    expect(larguraPedida(moradores)).toEqual({ colunas: 4, total: 658 });
    expect(minimoDoCartao(moradores)).toBe(658);
  });

  it('minhas recargas (morador): a largura mínima comporta as colunas', async () => {
    await abrir({ ...BASE, estado: 'desconhecido', papel: 'morador', meu_morador: { id: 'm1', nome: 'Ana' } });
    const recargas = screen.getByText('INÍCIO → FIM').parentElement as HTMLElement;
    expect(larguraPedida(recargas)).toEqual({ colunas: 5, total: 590 });
    expect(minimoDoCartao(recargas)).toBe(590);
  });
});

describe('carregador OCPP: iniciar, aguardar o carro e atualização', () => {
  it('iniciar com limite: vem com o padrão, respeita o teto e envia os dois limites', async () => {
    rede.post.mockResolvedValue({ data: { id: 's1', morador: 'Ana', aguardando_inicio: true } });
    await abrir(ocppEstado());
    await waitFor(() => expect(botao('Iniciar recarga').disabled).toBe(false));
    fireEvent.click(botao('Iniciar recarga'));
    const tempo = screen.getByLabelText(/Limite de tempo \(min\)/) as HTMLInputElement;
    const energia = screen.getByLabelText(/Limite de energia \(kWh\)/) as HTMLInputElement;
    expect(tempo.value).toBe('120');
    expect(energia.value).toBe('20');
    expect(tela()).toContain('Opcional · máximo 120');
    // O carregador OCPP não lê a bateria do carro: a linha não aparece.
    expect(tela()).not.toContain('Bateria do carro');

    fireEvent.change(tempo, { target: { value: '121' } });
    expect(botao('Iniciar').disabled).toBe(true);
    fireEvent.change(tempo, { target: { value: '60' } });
    fireEvent.change(energia, { target: { value: '' } });
    fireEvent.click(botao('Iniciar'));
    await waitFor(() => expect(rede.post).toHaveBeenCalledWith('/carregador-eletrico/c1/liberar', { morador_id: 'm1', limite_tempo_min: 60 }));
  });

  it('aguardando o carro: aviso dos 3 minutos, botão Cancelar no mesmo POST de parar e atualização a cada 5 s', async () => {
    const intervalos = vi.spyOn(globalThis, 'setInterval');
    rede.post.mockResolvedValue({ data: { ok: true } });
    const sessao = { id: 's1', status: 'ativa', morador_nome: 'Ana', morador_id: 'm1', kwh_total: 0, inicio_iso: agora(), aguardando_inicio: true, origem: 'nexon', duracao_min: 0, limite_tempo_min: 120, limite_energia_kwh: null };
    // Contrato: `aguardando_inicio` e os limites só vêm em `sessao_ativa`; a linha de `sessoes` não traz.
    const linha = { id: 's1', status: 'ativa', morador_nome: 'Ana', morador_id: 'm1', kwh_total: 0, inicio_iso: sessao.inicio_iso, origem: 'nexon', duracao_min: 0, motivo_fim: null, motivo_fim_texto: null };
    const atual = await abrir(ocppEstado({ sessao_ativa: sessao, sessoes: [linha] }));
    await waitFor(() => expect(screen.getAllByText('Aguardando o carro ser conectado').length).toBeGreaterThanOrEqual(1));
    expect(tela()).toContain('Se o carro não for conectado em 3 minutos, o pedido é cancelado.');
    expect(temBotao('Parar recarga')).toBe(false);
    // Na tabela, a linha do pedido não diz "em andamento": ainda espera o carro.
    expect(tela()).toContain('→ aguardando o carro');
    expect(tela()).not.toContain('→ em andamento');
    // Ainda não é recarga: nada de energia nem de tempo correndo, só o limite pedido.
    expect(tela()).toContain('Tempo da recarga—');
    expect(tela()).toContain('Limite: 120 min');
    expect(tela()).not.toContain('Faltam');
    expect(intervalos.mock.calls.some(([, ms]) => ms === 5000)).toBe(true);

    atual.estado = ocppEstado();
    fireEvent.click(botao('Cancelar'));
    await waitFor(() => expect(rede.post).toHaveBeenCalledWith('/carregador-eletrico/c1/parar'));
    await waitFor(() => expect(botao('Iniciar recarga')).toBeTruthy());
  });

  it('parado: 30 s; depois de um comando cai para 5 s e avisa que a parada espera o carregador', async () => {
    const intervalos = vi.spyOn(globalThis, 'setInterval');
    rede.post.mockResolvedValue({ data: { ok: true, sessao: 's1', aguardando_carregador: true } });
    const sessao = { id: 's1', status: 'ativa', morador_nome: 'Ana', morador_id: 'm1', kwh_total: 3, inicio_iso: new Date(Date.now() - 600000).toISOString(), aguardando_inicio: false, duracao_min: 10 };
    await abrir(ocppEstado({ estado: 'carregando', sessao_ativa: sessao, sessoes: [sessao] }));
    await waitFor(() => expect(botao('Parar recarga')).toBeTruthy());
    const ms = () => intervalos.mock.calls.map(([, t]) => t);
    expect(ms()).toContain(30000);
    expect(ms()).not.toContain(5000);

    fireEvent.click(botao('Parar recarga'));
    fireEvent.click(botao('Parar'));
    await waitFor(() => expect(rede.post).toHaveBeenCalledWith('/carregador-eletrico/c1/parar'));
    await waitFor(() => expect(ms()).toContain(5000));
    await waitFor(() => expect(tela()).toContain('Parada enviada. A recarga fecha quando o carregador confirmar.'));
  });
});

describe('carregador OCPP: Configuração por perfil', () => {
  it('morador não tem Configuração; quem não pode comandar não vê o botão', async () => {
    await abrir(ocppEstado({ papel: 'morador', meu_morador: { id: 'm1', nome: 'Ana' }, pode: { comandar: false, limites: false, bloquear: false, tecnico: false } }));
    await waitFor(() => expect(tela()).toContain('Minhas recargas'));
    expect(temBotao('Configurações')).toBe(false);
    expect(temBotao('Iniciar recarga')).toBe(false);
  });

  it('operador com o carregador liberado: entra pelos Comandos, vê limites em leitura e não vê moradores', async () => {
    await abrir(ocppEstado({ papel: 'operador', pode: { comandar: true, limites: false, bloquear: true, tecnico: false } }));
    await waitFor(() => expect(temBotao('Configurações')).toBe(true));
    fireEvent.click(botao('Configurações'));
    expect(tela()).toContain('COMANDOS');
    expect(tela()).toContain('LIMITES DE USO');
    expect(tela()).toContain('Tempo padrão por recarga120 min');
    expect(tela()).toContain('ModeloCHINT NTW-EC2A22W1-L');
    expect(tela()).not.toContain('MORADORES AUTORIZADOS');
    expect(tela()).not.toContain('CONEXÃO OCPP');
    expect(tela()).not.toContain('PARÂMETROS DO EQUIPAMENTO');
    expect(temBotao('Reiniciar carregador')).toBe(false);
    expect(temBotao('Salvar')).toBe(false);
  });

  it('proprietário: edita os limites com revisão "de → para" e grava só o que mudou', async () => {
    rede.put.mockResolvedValue({ data: { limites: { ...LIMITES, tempo_min: 90 } } });
    await abrir(ocppEstado({ papel: 'proprietario', pode: { comandar: true, limites: true, bloquear: true, tecnico: false } }));
    await waitFor(() => expect(temBotao('Configurações')).toBe(true));
    fireEvent.click(botao('Configurações'));
    expect(screen.queryByLabelText(/Limite de corrente/)).toBeNull();
    expect(tela()).not.toContain('CONEXÃO OCPP');
    expect(botao('Salvar').disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Tempo padrão por recarga/), { target: { value: '2000' } });
    expect(botao('Valor fora da faixa').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Tempo padrão por recarga/), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('switch', { name: /Iniciar sozinho ao conectar o carro/ }));
    fireEvent.click(botao('Revisar 2 alterações'));
    // Título do diálogo: o visível e o que o leitor de tela anuncia.
    expect(screen.getAllByText('Confirmar alterações').length).toBeGreaterThanOrEqual(1);
    expect(tela()).toContain('Tempo padrão por recarga120 min → 90 min');
    expect(tela()).toContain('Iniciar sozinho ao conectar o carroDesligado → Ligado');
    expect(tela()).toContain('Os limites de uso valem para as próximas recargas.');
    fireEvent.click(botao('Confirmar'));
    await waitFor(() => expect(rede.put).toHaveBeenCalledWith('/carregador-eletrico/c1/config', { limite_tempo_min: 90, inicio_automatico: true }));
  });

  it('analista: corrente máxima no mesmo Salvar; o 409 da API aparece na tela', async () => {
    // Corpo de erro como a API manda de verdade (filtro global): a mensagem fica em `error.message`.
    rede.put.mockRejectedValue({ response: { status: 409, data: { success: false, error: { code: 'CONFLICT', message: 'O carregador recusou o limite de corrente.' } } } });
    await abrir(ocppEstado());
    fireEvent.click(botao('Configurações'));
    await waitFor(() => expect(screen.getByLabelText(/Identidade do carregador/)).toBeTruthy());
    for (const secao of ['LIMITES DE USO', 'CORRENTE MÁXIMA', 'COMANDOS', 'CONEXÃO OCPP', 'PARÂMETROS DO EQUIPAMENTO', 'MORADORES AUTORIZADOS']) expect(tela()).toContain(secao);
    expect(temBotao('Reiniciar carregador')).toBe(true);

    fireEvent.change(screen.getByLabelText(/Limite de corrente/), { target: { value: '16' } });
    fireEvent.click(botao('Revisar 1 alteração'));
    expect(tela()).toContain('Corrente máximaSem limite → 16 A');
    expect(tela()).toContain('A corrente máxima é enviada ao carregador agora.');
    fireEvent.click(botao('Confirmar'));
    await waitFor(() => expect(rede.put).toHaveBeenCalledWith('/carregador-eletrico/c1/config', { limite_corrente_a: 16 }));
    await waitFor(() => expect(screen.getByText('O carregador recusou o limite de corrente.')).toBeTruthy());
    // O que foi digitado continua no campo para tentar de novo.
    expect((screen.getByLabelText(/Limite de corrente/) as HTMLInputElement).value).toBe('16');
  });
});
