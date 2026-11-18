import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, onTestFinished, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '@/config/api';
import { AvisoFalha, LimitesAoIniciar, MedicoesRecarga } from './CarregadorOperacao';
import { CarregadorLimites } from './CarregadorLimites';
import { CarregadorComandos } from './CarregadorComandos';
import { CarregadorConexaoOcpp } from './CarregadorConexaoOcpp';
import { CarregadorParametros } from './CarregadorParametros';
import { RASCUNHO_VAZIO, type Credenciais, type Limites, type RascunhoConfig } from './carregador.util';

// NEXON-130 — seções novas do carregador OCPP, cada uma no seu arquivo. Sem rede: a `api` é
// trocada por funções de teste e cada caso diz o que a API responderia (contrato da seção 2).
vi.mock('@/config/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
const rede = api as unknown as { get: Mock; post: Mock; put: Mock; delete: Mock };

// Os diálogos (NxDialog) trazem o <link> da fonte: o happy-dom não deve ir buscá-la na rede.
beforeAll(() => {
  const hd = (window as unknown as { happyDOM?: { settings?: { disableCSSFileLoading?: boolean; handleDisabledFileLoadingAsSuccess?: boolean } } }).happyDOM;
  if (hd?.settings) { hd.settings.disableCSSFileLoading = true; hd.settings.handleDisabledFileLoadingAsSuccess = true; }
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome }) as HTMLButtonElement;
const LIMITES: Limites = { tempo_min: 120, energia_kwh: 20, inicio_automatico: false, corrente_a: 16, corrente_min_a: 6, corrente_max_a: 32, corrente_suportada: true };

describe('Operação: falha e medições', () => {
  const falha = { codigo: 'E07', ocpp: 'OtherError', titulo: 'Botão de parada de emergência pressionado', solucao: 'Gire o botão no sentido indicado para liberar.', desde: new Date().toISOString() };

  it('aviso de falha: código, título, solução e desde quando', () => {
    render(<AvisoFalha falha={falha} tecnico={false} />);
    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toContain('Falha E07');
    expect(aviso.textContent).toContain('Botão de parada de emergência pressionado');
    expect(aviso.textContent).toContain('Gire o botão no sentido indicado para liberar.');
    expect(aviso.textContent).toMatch(/desde \d{2}:\d{2}/);
    // Código do protocolo é jargão: proprietário e morador não veem.
    expect(aviso.textContent).not.toContain('OtherError');
  });
  it('o analista vê também o código do protocolo; falha sem código do manual continua clara', () => {
    render(<AvisoFalha falha={{ ...falha, codigo: null }} tecnico />);
    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toContain('OtherError');
    expect(aviso.textContent).not.toContain('Falha null');
  });

  it('medições da recarga em andamento, com a linha secundária só do que veio', () => {
    render(
      <MedicoesRecarga ativa potenciaKw={7.21} energiaKwh={3.254} duracaoMin={65} valor="R$ 2,93"
        leitura={{ corrente_a: 31.4, tensao_v: 221, temperatura_c: null, lido_em: new Date().toISOString() }}
        limite={{ limite: '120 min · 20 kWh', falta: 'Faltam 55 min · 16,7 kWh' }} />,
    );
    const tela = document.body.textContent ?? '';
    expect(tela).toContain('Potência agora7,2 kW');
    expect(tela).toContain('Energia da recarga3,3 kWh');
    expect(tela).toContain('Tempo da recarga1 h 05 min');
    expect(tela).toContain('Valor estimadoR$ 2,93');
    expect(tela).toContain('Corrente 31,4 A');
    expect(tela).toContain('Tensão 221 V');
    expect(tela).not.toContain('Temperatura');
    expect(tela).toMatch(/lido às \d{2}:\d{2}/);
    expect(tela).toContain('Limite: 120 min · 20 kWh');
    expect(tela).toContain('Faltam 55 min · 16,7 kWh');
  });
  it('sem recarga: zeros e nada de linha secundária sem leitura', () => {
    render(<MedicoesRecarga ativa={false} potenciaKw={7.2} energiaKwh={3} duracaoMin={10} valor="R$ 0,00" leitura={null} limite={null} />);
    const tela = document.body.textContent ?? '';
    expect(tela).toContain('Potência agora0,0 kW');
    expect(tela).toContain('Energia da recarga0,0 kWh');
    expect(tela).toContain('Tempo da recarga—');
    expect(tela).not.toContain('Corrente');
    expect(tela).not.toContain('Limite:');
  });
});

describe('Iniciar com limite', () => {
  function Campos({ limites }: { limites: Limites }) {
    const [t, setT] = useState('120'); const [e, setE] = useState('20');
    return <LimitesAoIniciar limites={limites} tempo={t} energia={e} onTempo={setT} onEnergia={setE} />;
  }
  it('vem com o padrão do carregador e diz que ele é o máximo', () => {
    render(<Campos limites={LIMITES} />);
    const tempo = screen.getByLabelText(/Limite de tempo \(min\)/) as HTMLInputElement;
    const energia = screen.getByLabelText(/Limite de energia \(kWh\)/) as HTMLInputElement;
    expect(tempo.value).toBe('120');
    expect(energia.value).toBe('20');
    expect(document.body.textContent).toContain('Opcional · máximo 120');
    expect(document.body.textContent).toContain('Opcional · máximo 20');
    // Celular: alvo de 44 px e a classe que põe o campo em 16 px (sem zoom no iOS).
    expect(tempo.style.height).toBe('44px');
    expect(tempo.className).toContain('nxc-campo');
  });
  it('acima do padrão avisa a faixa; sem padrão vale a faixa inteira', () => {
    render(<Campos limites={LIMITES} />);
    const tempo = screen.getByLabelText(/Limite de tempo \(min\)/) as HTMLInputElement;
    fireEvent.change(tempo, { target: { value: '121' } });
    expect(document.body.textContent).toContain('Use de 5 a 120');
    expect(tempo.getAttribute('aria-invalid')).toBe('true');
    cleanup();
    render(<Campos limites={{ ...LIMITES, tempo_min: null, energia_kwh: null }} />);
    expect(document.body.textContent).toContain('Opcional · 5 a 1440');
    expect(document.body.textContent).toContain('Opcional · 1 a 200');
  });
});

describe('Configuração › Limites de uso e Corrente máxima', () => {
  function Tela(props: { podeLimites: boolean; podeCorrente: boolean; limites?: Limites; onRascunho?: (p: Partial<RascunhoConfig>) => void }) {
    const [r, setR] = useState<RascunhoConfig>(RASCUNHO_VAZIO);
    return (
      <CarregadorLimites limites={props.limites ?? LIMITES} rascunho={r} ruins={{ tarifa: false, tempo: false, energia: false, corrente: false }}
        onRascunho={(p) => { props.onRascunho?.(p); setR((x) => ({ ...x, ...p })); }} podeLimites={props.podeLimites} podeCorrente={props.podeCorrente} />
    );
  }
  it('quem pode edita: campos com o valor gravado, vazio = sem limite', () => {
    const onRascunho = vi.fn();
    render(<Tela podeLimites podeCorrente onRascunho={onRascunho} />);
    const tempo = screen.getByLabelText(/Tempo padrão por recarga/) as HTMLInputElement;
    expect(tempo.value).toBe('120');
    expect((screen.getByLabelText(/Energia padrão por recarga/) as HTMLInputElement).value).toBe('20');
    expect((screen.getByLabelText(/Limite de corrente/) as HTMLInputElement).value).toBe('16');
    expect(document.body.textContent).toContain('6 a 32 A · vazio = sem limite');
    fireEvent.change(tempo, { target: { value: '' } });
    expect(onRascunho).toHaveBeenLastCalledWith({ tempo: '' });
    expect(tempo.value).toBe('');
  });
  it('início automático: a chave explica que a recarga fica sem morador', () => {
    const onRascunho = vi.fn();
    render(<Tela podeLimites podeCorrente={false} onRascunho={onRascunho} />);
    const chave = screen.getByRole('switch', { name: /Iniciar sozinho ao conectar o carro/ });
    expect(chave.textContent).toContain('não entra na cobrança por morador');
    expect(chave.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(chave);
    expect(onRascunho).toHaveBeenLastCalledWith({ auto: true });
    expect(chave.getAttribute('aria-checked')).toBe('true');
  });
  it('quem não pode vê em leitura: sem campo, valor escrito', () => {
    render(<Tela podeLimites={false} podeCorrente={false} limites={{ ...LIMITES, energia_kwh: null }} />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(document.body.textContent).toContain('Tempo padrão por recarga120 min');
    expect(document.body.textContent).toContain('Energia padrão por recargaSem limite');
    expect(document.body.textContent).toContain('16 A');
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
  });
  it('proprietário edita os limites e só vê a corrente', () => {
    render(<Tela podeLimites podeCorrente={false} />);
    expect(screen.getByLabelText(/Tempo padrão por recarga/)).toBeTruthy();
    expect(screen.queryByLabelText(/Limite de corrente/)).toBeNull();
  });
  it('avisa quando o carregador recusou o limite de corrente', () => {
    render(<Tela podeLimites podeCorrente limites={{ ...LIMITES, corrente_suportada: false }} />);
    expect(screen.getByRole('status').textContent).toBe('Este carregador recusou o limite de corrente.');
    cleanup();
    render(<Tela podeLimites podeCorrente limites={{ ...LIMITES, corrente_suportada: null }} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Configuração › Comandos', () => {
  const abrir = (props: Partial<Parameters<typeof CarregadorComandos>[0]> = {}) => {
    const onExecutado = vi.fn();
    render(<CarregadorComandos id="c1" ocpp={{ conectado: true, disponivel: true }} tecnico={false} onExecutado={onExecutado} {...props} />);
    return { onExecutado };
  };

  it('Reiniciar é só do analista; bloqueado oferece Liberar', () => {
    abrir();
    expect(botao('Bloquear carregador')).toBeTruthy();
    expect(botao('Destravar conector')).toBeTruthy();
    expect(botao('Atualizar leitura')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reiniciar carregador' })).toBeNull();
    cleanup();
    abrir({ tecnico: true, ocpp: { conectado: true, disponivel: false } });
    expect(botao('Reiniciar carregador')).toBeTruthy();
    expect(botao('Liberar carregador')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bloquear carregador' })).toBeNull();
  });

  it('confirma dizendo o efeito, envia o comando e mostra a resposta na tela', async () => {
    let responder: (v: unknown) => void = () => undefined;
    rede.post.mockReturnValueOnce(new Promise((ok) => { responder = ok; }));
    const { onExecutado } = abrir();
    fireEvent.click(botao('Bloquear carregador'));
    expect(screen.getByText('Bloquear carregador?')).toBeTruthy();
    expect(screen.getByText(/Ninguém consegue iniciar recarga até o carregador ser liberado/)).toBeTruthy();
    expect(rede.post).not.toHaveBeenCalled();

    fireEvent.click(botao('Bloquear'));
    expect(rede.post).toHaveBeenCalledWith('/carregador-eletrico/c1/comando', { comando: 'bloquear' });
    await waitFor(() => expect(screen.getAllByText('Executando…').length).toBeGreaterThan(0));

    responder({ data: { ok: true, resposta: 'Accepted', mensagem: 'Carregador bloqueado.' } });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Carregador bloqueado.'));
    expect(onExecutado).toHaveBeenCalledTimes(1);
  });

  it('erro da API aparece com a mensagem dela', async () => {
    // Corpo de erro como a API manda de verdade (filtro global): a mensagem fica em `error.message`.
    rede.post.mockRejectedValueOnce({ response: { status: 409, data: { success: false, error: { code: 'CONFLICT', message: 'O carregador não aceitou o comando (Rejected).' } } } });
    const { onExecutado } = abrir();
    fireEvent.click(botao('Destravar conector'));
    fireEvent.click(botao('Destravar'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('O carregador não aceitou o comando (Rejected).'));
    expect(rede.post).toHaveBeenCalledWith('/carregador-eletrico/c1/comando', { comando: 'destravar' });
    expect(onExecutado).toHaveBeenCalledTimes(1);
  });

  it('sem comunicação: tudo desligado e a razão escrita', () => {
    abrir({ tecnico: true, ocpp: { conectado: false, disponivel: true } });
    expect(screen.getByRole('status').textContent).toBe('Sem comunicação com o carregador. Os comandos voltam quando ele reconectar.');
    for (const nome of ['Bloquear carregador', 'Destravar conector', 'Atualizar leitura', 'Reiniciar carregador']) {
      const b = botao(nome);
      expect(b.disabled).toBe(true);
      expect(b.style.height).toBe('44px');
    }
  });
});

describe('Configuração › Conexão OCPP', () => {
  const CRED = { charge_point_id: 'SERIE123', chave: 'chave-secreta', url: 'wss://api.exemplo/ocpp/chave-secreta', url_completa: 'wss://api.exemplo/ocpp/chave-secreta/SERIE123' };
  function Tela({ onMudou = () => undefined }: { onMudou?: () => void }) {
    const [c, setC] = useState<Credenciais | null>(null);
    return <CarregadorConexaoOcpp id="c1" relerEm={0} credenciais={c} onCredenciais={setC} onMudou={onMudou} />;
  }
  const campo = () => screen.getByLabelText(/Identidade do carregador \(número de série\)/) as HTMLInputElement;

  it('sem vínculo: a tentativa recusada preenche a identidade e o vínculo mostra a chave uma vez', async () => {
    rede.get.mockResolvedValue({ data: { vinculado: false, recusadas: [{ quando: new Date().toISOString(), identidade: 'SERIE123', motivo: 'Identidade não cadastrada', ip: '10.0.0.7' }] } });
    rede.put.mockResolvedValueOnce({ data: CRED });
    const onMudou = vi.fn();
    render(<Tela onMudou={onMudou} />);
    await waitFor(() => expect(campo()).toBeTruthy());
    expect(rede.get).toHaveBeenCalledWith('/carregador-eletrico/c1/ocpp');
    expect(botao('Vincular').disabled).toBe(true);
    expect(screen.queryByText('Situação')).toBeNull();
    expect(document.body.textContent).toContain('Identidade não cadastrada');
    expect(document.body.textContent).toContain('10.0.0.7');

    fireEvent.click(botao('Usar esta identidade'));
    expect(campo().value).toBe('SERIE123');
    fireEvent.click(botao('Vincular'));
    await waitFor(() => expect(screen.getByText('Guarde agora: a chave não aparece de novo.')).toBeTruthy());
    expect(rede.put).toHaveBeenCalledWith('/carregador-eletrico/c1/ocpp', { charge_point_id: 'SERIE123' });
    expect(document.body.textContent).toContain('chave-secreta');
    expect(document.body.textContent).toContain('wss://api.exemplo/ocpp/chave-secreta/SERIE123');
    expect(screen.getAllByRole('button', { name: /^Copiar / })).toHaveLength(3);
    expect(document.body.textContent).toContain('1. No carregador, entre na rede Wi-Fi dele e abra "OCPP URL Settings".');
    expect(document.body.textContent).toContain('2. Cole a URL e envie.');
    expect(onMudou).toHaveBeenCalled();

    fireEvent.click(botao('Já guardei'));
    expect(screen.queryByText('Guarde agora: a chave não aparece de novo.')).toBeNull();
  });

  it('identidade com espaço ou barra não vincula', async () => {
    rede.get.mockResolvedValue({ data: { vinculado: false, recusadas: [] } });
    render(<Tela />);
    await waitFor(() => expect(campo()).toBeTruthy());
    expect(screen.queryByText('TENTATIVAS RECUSADAS')).toBeNull();
    fireEvent.change(campo(), { target: { value: 'serie 123' } });
    expect(botao('Vincular').disabled).toBe(true);
    expect(document.body.textContent).toContain('Sem espaço, barra, ? nem #.');
    fireEvent.change(campo(), { target: { value: 'SERIE123' } });
    expect(botao('Vincular').disabled).toBe(false);
  });

  it('com vínculo: situação, dados do equipamento, chave nova e desvincular com confirmação', async () => {
    rede.get.mockResolvedValue({
      data: {
        vinculado: true, charge_point_id: 'SERIE123', conectado: true, ultima_conexao: new Date(2026, 10, 18, 14, 11).toISOString(),
        ultimo_heartbeat: null, fabricante: 'CHINT', modelo: 'NTW-EC2A22W1-L', numero_serie: 'SERIE123', firmware: 'v1.4', perfis: ['Core', 'SmartCharging'], recusadas: [],
      },
    });
    rede.post.mockResolvedValueOnce({ data: { chave: 'nova', url: 'wss://api.exemplo/ocpp/nova', url_completa: 'wss://api.exemplo/ocpp/nova/SERIE123' } });
    rede.delete.mockResolvedValueOnce({ data: { ok: true } });
    render(<Tela />);
    await waitFor(() => expect(screen.getByText('Conectado')).toBeTruthy());
    const tela = () => document.body.textContent ?? '';
    expect(tela()).toContain('Última conexão18/11/2026 14:11');
    expect(tela()).toContain('Último heartbeat—');
    expect(tela()).toContain('FabricanteCHINT');
    expect(tela()).toContain('ModeloNTW-EC2A22W1-L');
    expect(tela()).toContain('Firmwarev1.4');
    expect(tela()).toContain('Perfis suportadosCore, SmartCharging');
    expect(campo().value).toBe('SERIE123');
    expect(botao('Trocar identidade').disabled).toBe(true);

    fireEvent.click(botao('Gerar nova chave'));
    expect(screen.getByText(/A chave atual deixa de valer e a conexão do carregador cai/)).toBeTruthy();
    fireEvent.click(botao('Gerar chave'));
    await waitFor(() => expect(screen.getByText('Guarde agora: a chave não aparece de novo.')).toBeTruthy());
    expect(rede.post).toHaveBeenCalledWith('/carregador-eletrico/c1/ocpp/chave');

    fireEvent.click(botao('Desvincular'));
    expect(screen.getByText('Desvincular carregador?')).toBeTruthy();
    expect(rede.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Desvincular' }).at(-1)!);
    await waitFor(() => expect(rede.delete).toHaveBeenCalledWith('/carregador-eletrico/c1/ocpp'));
    // Desvinculou: a chave que estava na tela não vale mais e some.
    await waitFor(() => expect(screen.queryByText('Guarde agora: a chave não aparece de novo.')).toBeNull());
  });

  it('com vínculo, trocar a identidade pede confirmação e mantém a chave', async () => {
    rede.get.mockResolvedValue({ data: { vinculado: true, charge_point_id: 'ERRADA', conectado: false, recusadas: [{ quando: 'agora', identidade: 'CERTA', motivo: 'Identidade não cadastrada' }] } });
    rede.put.mockResolvedValueOnce({ data: { charge_point_id: 'CERTA' } });
    render(<Tela />);
    await waitFor(() => expect(screen.getByText('Desconectado')).toBeTruthy());
    fireEvent.click(botao('Usar esta identidade'));
    fireEvent.click(botao('Trocar identidade'));
    expect(screen.getByText(/passa a aceitar só o carregador que se apresentar como CERTA/)).toBeTruthy();
    expect(rede.put).not.toHaveBeenCalled();
    fireEvent.click(botao('Trocar'));
    await waitFor(() => expect(rede.put).toHaveBeenCalledWith('/carregador-eletrico/c1/ocpp', { charge_point_id: 'CERTA' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Identidade trocada para CERTA.'));
    expect(screen.queryByText('Guarde agora: a chave não aparece de novo.')).toBeNull();
  });

  it('trocar a identidade com a chave ainda na tela tira a URL completa, que terminava na identidade antiga', async () => {
    // API de teste com memória: o primeiro vínculo devolve a chave; a troca de identidade, só a identidade.
    // (Sai no fim do teste: os outros casos dizem resposta por resposta o que a API devolve.)
    onTestFinished(() => { rede.get.mockReset(); rede.put.mockReset(); });
    let gravada: string | null = null;
    rede.get.mockImplementation(async () => ({ data: { vinculado: !!gravada, charge_point_id: gravada, conectado: false, recusadas: [] } }));
    rede.put.mockImplementation(async (_url: string, corpo: { charge_point_id: string }) => {
      const primeiro = !gravada;
      gravada = corpo.charge_point_id;
      return { data: primeiro ? CRED : { charge_point_id: gravada } };
    });
    render(<Tela />);
    await waitFor(() => expect(campo()).toBeTruthy());
    fireEvent.change(campo(), { target: { value: 'SERIE123' } });
    fireEvent.click(botao('Vincular'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Copiar / })).toHaveLength(3));
    await waitFor(() => expect(botao('Trocar identidade')).toBeTruthy());

    fireEvent.change(campo(), { target: { value: 'SERIE999' } });
    fireEvent.click(botao('Trocar identidade'));
    fireEvent.click(botao('Trocar'));
    await waitFor(() => expect(rede.put).toHaveBeenLastCalledWith('/carregador-eletrico/c1/ocpp', { charge_point_id: 'SERIE999' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Copiar / })).toHaveLength(2));
    const tela = document.body.textContent ?? '';
    // A chave não mudou: continua na tela com a URL sem identidade, que vale para qualquer identidade.
    expect(tela).toContain('Guarde agora: a chave não aparece de novo.');
    expect(tela).toContain('wss://api.exemplo/ocpp/chave-secreta');
    expect(tela).not.toContain('wss://api.exemplo/ocpp/chave-secreta/SERIE123');
    expect(screen.getByRole('button', { name: 'Copiar URL' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar Chave' })).toBeTruthy();
    await waitFor(() => expect(campo().value).toBe('SERIE999'));
  });

  it('falha ao ler: diz o que houve e deixa tentar de novo', async () => {
    rede.get.mockRejectedValueOnce({ response: { data: {} } }).mockResolvedValue({ data: { vinculado: false, recusadas: [] } });
    render(<Tela />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Não foi possível ler a conexão do carregador.'));
    fireEvent.click(botao('Tentar de novo'));
    await waitFor(() => expect(campo()).toBeTruthy());
  });
});

describe('Configuração › Parâmetros do equipamento', () => {
  const PARAMETROS = [
    { chave: 'HeartbeatInterval', valor: '240', somente_leitura: false },
    { chave: 'MeterValueSampleInterval', valor: '60', somente_leitura: false },
    { chave: 'NumberOfConnectors', valor: '1', somente_leitura: true },
  ];

  it('não lê sozinho; lê quando pedem, busca por texto e deixa limpar a busca', async () => {
    rede.get.mockResolvedValueOnce({ data: { parametros: PARAMETROS, desconhecidas: [] } });
    render(<CarregadorParametros id="c1" conectado />);
    expect(rede.get).not.toHaveBeenCalled();
    fireEvent.click(botao('Ler parâmetros do carregador'));
    await waitFor(() => expect(screen.getByText('HeartbeatInterval')).toBeTruthy());
    expect(rede.get).toHaveBeenCalledWith('/carregador-eletrico/c1/ocpp/parametros');
    expect(document.body.textContent).toContain('3 parâmetros');
    // Somente leitura não tem botão de alterar.
    expect(screen.queryByRole('button', { name: 'Alterar NumberOfConnectors' })).toBeNull();
    expect(botao('Alterar HeartbeatInterval')).toBeTruthy();

    const busca = screen.getByLabelText('Buscar parâmetro') as HTMLInputElement;
    fireEvent.change(busca, { target: { value: 'interval' } });
    expect(screen.queryByText('NumberOfConnectors')).toBeNull();
    expect(document.body.textContent).toContain('2 de 3 parâmetros');
    fireEvent.change(busca, { target: { value: 'nada disso' } });
    expect(screen.getByText('Nenhum parâmetro com esse texto.')).toBeTruthy();
    fireEvent.click(botao('Limpar busca'));
    expect(screen.getByText('NumberOfConnectors')).toBeTruthy();
  });

  it('altera com confirmação e mostra a resposta do carregador', async () => {
    rede.get.mockResolvedValueOnce({ data: { parametros: PARAMETROS } });
    rede.put.mockResolvedValueOnce({ data: { resposta: 'RebootRequired' } }).mockResolvedValueOnce({ data: { resposta: 'Rejected' } });
    render(<CarregadorParametros id="c1" conectado />);
    fireEvent.click(botao('Ler parâmetros do carregador'));
    await waitFor(() => expect(botao('Alterar HeartbeatInterval')).toBeTruthy());

    fireEvent.click(botao('Alterar HeartbeatInterval'));
    const valor = screen.getByLabelText('HeartbeatInterval') as HTMLInputElement;
    expect(valor.value).toBe('240');
    // Sem mudar o valor não há o que gravar.
    expect(botao('Gravar').disabled).toBe(true);
    fireEvent.change(valor, { target: { value: '300' } });
    fireEvent.click(botao('Gravar'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Aceito, exige reiniciar. Reinicie o carregador, em Comandos, para o valor valer.'));
    expect(rede.put).toHaveBeenCalledWith('/carregador-eletrico/c1/ocpp/parametros', { chave: 'HeartbeatInterval', valor: '300' });
    expect(document.body.textContent).toContain('300');

    // Recusado: o valor da lista não muda.
    fireEvent.click(botao('Alterar MeterValueSampleInterval'));
    fireEvent.change(screen.getByLabelText('MeterValueSampleInterval'), { target: { value: '5' } });
    fireEvent.click(botao('Gravar'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Recusado'));
    expect(screen.getByText('60')).toBeTruthy();
  });

  it('sem comunicação não lê e diz por quê; erro da leitura deixa tentar de novo', async () => {
    render(<CarregadorParametros id="c1" conectado={false} />);
    expect(botao('Ler parâmetros do carregador').disabled).toBe(true);
    expect(document.body.textContent).toContain('Sem comunicação com o carregador: a leitura volta quando ele reconectar.');
    cleanup();

    rede.get.mockRejectedValueOnce({ response: { data: { message: 'Carregador sem comunicação.' } } });
    render(<CarregadorParametros id="c1" conectado />);
    fireEvent.click(botao('Ler parâmetros do carregador'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Carregador sem comunicação.'));
    expect(botao('Tentar de novo')).toBeTruthy();
  });
});
