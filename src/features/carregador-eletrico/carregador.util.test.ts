import { describe, expect, it } from 'vitest';
import {
  FAIXA_ENERGIA, FAIXA_TEMPO, RASCUNHO_VAZIO, bloqueioIniciar, corpoLiberar, dataHora, dataHoraCurta, desdeTxt, duracaoTxt, durTxt, erroMsg,
  faixaComTeto, faixaCorrente, faltaDoLimite, filtrarParametros, identidadeValida, kwDe, lidoTxt, limiteTxt, notaDaRevisao, numTxt,
  orientacaoOcioso, respostaParametro, revisarConfig, rotuloOrigem, situacaoDe, subRecarga, textoSituacao, validarLimite,
  type Limites,
} from './carregador.util';

// Datas montadas no horário do aparelho: o teste não depende do fuso de quem roda.
const iso = (ano: number, mes: number, dia: number, h: number, min: number) => new Date(ano, mes - 1, dia, h, min).toISOString();
const OCPP = { conectado: true, disponivel: true };

describe('situacaoDe (estado do carregador → rótulo e tom)', () => {
  it.each([
    ['disponivel', 'Disponível', 'ok'],
    ['conectado', 'Carro conectado', 'ok'],
    ['carregando', 'Carregando', 'ok'],
    ['pausado', 'Pausado', 'warn'],
    ['finalizando', 'Finalizando', 'ok'],
    ['reservado', 'Reservado', 'off'],
    ['indisponivel', 'Indisponível', 'warn'],
    ['falha', 'Falha', 'bad'],
    ['sem_comunicacao', 'Sem comunicação', 'off'],
  ])('%s → %s (%s)', (estado, rotulo, tom) => {
    expect(situacaoDe({ estado, ocpp: OCPP })).toEqual({ chave: estado, rotulo, tom });
  });

  it('indisponível com o carregador bloqueado pelo NexON vira Bloqueado', () => {
    expect(situacaoDe({ estado: 'indisponivel', ocpp: { conectado: true, disponivel: false } })).toEqual({ chave: 'bloqueado', rotulo: 'Bloqueado', tom: 'off' });
  });
  it('bloqueio só muda o rótulo de indisponível', () => {
    expect(situacaoDe({ estado: 'carregando', ocpp: { conectado: true, disponivel: false } }).rotulo).toBe('Carregando');
  });
  it('aceita maiúscula e espaço em volta', () => {
    expect(situacaoDe({ estado: ' Sem_Comunicacao ', ocpp: OCPP }).rotulo).toBe('Sem comunicação');
  });

  it('valor desconhecido mantém o de sempre: Carregando com recarga, senão Disponível', () => {
    expect(situacaoDe({ estado: 'Charging', ocpp: OCPP, sessao_ativa: { id: 's1' } })).toEqual({ chave: 'legado', rotulo: 'Carregando', tom: 'ok' });
    expect(situacaoDe({ estado: 'desconhecido', ocpp: OCPP, sessao_ativa: null })).toEqual({ chave: 'legado', rotulo: 'Disponível', tom: 'ok' });
    expect(situacaoDe({ estado: 'bloqueado', ocpp: OCPP })).toMatchObject({ chave: 'legado' });
    expect(situacaoDe(null)).toEqual({ chave: 'legado', rotulo: 'Disponível', tom: 'ok' });
  });
  it('carregador que não é OCPP não usa o mapa, mesmo com valor conhecido', () => {
    expect(situacaoDe({ estado: 'falha', ocpp: null, sessao_ativa: null })).toEqual({ chave: 'legado', rotulo: 'Disponível', tom: 'ok' });
    expect(situacaoDe({ estado: 'disponivel', sessao_ativa: { id: 's1' } })).toEqual({ chave: 'legado', rotulo: 'Carregando', tom: 'ok' });
  });
});

describe('textoSituacao (linha de status)', () => {
  it('carregador antigo: o texto de sempre', () => {
    const s = situacaoDe({ estado: 'x', sessao_ativa: { id: 's1' } });
    expect(textoSituacao(s, { sessao_ativa: { id: 's1' } }, 7.21)).toBe('Carregando · 7,2 kW');
    expect(textoSituacao(s, { sessao_ativa: { id: 's1', ocioso_inicio: '10:00', ocioso_por_nome: 'Ana' } }, 7.21)).toBe('Carregando · 7,2 kW · vaga pedida por Ana');
    expect(textoSituacao(s, { sessao_ativa: { id: 's1' } }, null)).toBe('Carregando');
    expect(textoSituacao(situacaoDe(null), null, null)).toBe('Disponível');
  });
  it('pedido que ainda espera o carro', () => {
    const e = { estado: 'disponivel', ocpp: OCPP, sessao_ativa: { id: 's1', aguardando_inicio: true } };
    expect(textoSituacao(situacaoDe(e), e, null)).toBe('Aguardando o carro ser conectado');
  });
  it('sem comunicação mostra a última comunicação quando houver', () => {
    const e = { estado: 'sem_comunicacao', ocpp: { conectado: false, ultima_comunicacao: iso(2026, 11, 18, 14, 11) } };
    expect(textoSituacao(situacaoDe(e), e, null)).toBe('Última comunicação: 18/11/2026 14:11');
    const semData = { estado: 'sem_comunicacao', ocpp: { conectado: false } };
    expect(textoSituacao(situacaoDe(semData), semData, null)).toBe('Sem registro de comunicação');
  });
  it('falha mostra o título; carregando mostra a potência', () => {
    const f = { estado: 'falha', ocpp: OCPP, falha: { titulo: 'Botão de parada de emergência pressionado' } };
    expect(textoSituacao(situacaoDe(f), f, null)).toBe('Botão de parada de emergência pressionado');
    const c = { estado: 'carregando', ocpp: OCPP, sessao_ativa: { id: 's1' } };
    expect(textoSituacao(situacaoDe(c), c, 7.21)).toBe('7,2 kW');
    expect(textoSituacao(situacaoDe(c), c, null)).toBe('Recarga em andamento');
  });
});

describe('orientacaoOcioso e bloqueioIniciar', () => {
  const de = (estado: string, disponivel = true) => situacaoDe({ estado, ocpp: { conectado: true, disponivel } });
  it('orientação com o carregador livre', () => {
    expect(orientacaoOcioso(situacaoDe(null))).toBe('Conecte o carro e inicie a recarga');
    expect(orientacaoOcioso(de('disponivel'))).toBe('Conecte o carro e inicie a recarga');
    expect(orientacaoOcioso(de('conectado'))).toBe('Carro conectado. Inicie a recarga.');
  });
  it.each(['sem_comunicacao', 'falha', 'indisponivel'])('%s não deixa iniciar e diz a razão', (estado) => {
    expect(bloqueioIniciar(de(estado))).toEqual(expect.any(String));
  });
  it('bloqueado pelo NexON não deixa iniciar', () => {
    expect(bloqueioIniciar(de('indisponivel', false))).toBe('Carregador bloqueado. Só inicia depois de liberado.');
  });
  it.each(['disponivel', 'conectado', 'reservado', 'finalizando', 'qualquer'])('%s deixa tentar', (estado) => {
    expect(bloqueioIniciar(de(estado))).toBeNull();
  });
});

describe('duracaoTxt (minutos → "1 h 05 min")', () => {
  it.each([
    [65, '1 h 05 min'], [27, '0 h 27 min'], [0, '0 h 00 min'], [60, '1 h 00 min'], [1440, '24 h 00 min'], [64.6, '1 h 05 min'], [-3, '0 h 00 min'],
  ])('%s → %s', (min, txt) => {
    expect(duracaoTxt(min)).toBe(txt);
  });
  it('sem valor vira traço', () => {
    expect(duracaoTxt(null)).toBe('—');
    expect(duracaoTxt(undefined)).toBe('—');
    expect(duracaoTxt(NaN)).toBe('—');
  });
  it('durTxt faz a conta entre duas datas', () => {
    expect(durTxt(new Date(2026, 10, 18, 18, 40), new Date(2026, 10, 18, 19, 45))).toBe('1 h 05 min');
    expect(durTxt(null, new Date())).toBe('—');
  });
});

describe('limite da recarga (quanto falta)', () => {
  const sa = { limite_tempo_min: 60, limite_energia_kwh: 15, duracao_min: 27, kwh_total: 3.3 };
  it('falta de tempo e de energia', () => {
    expect(faltaDoLimite(sa)).toEqual({ tempo_min: 33, energia_kwh: 11.7, atingido: false });
    expect(limiteTxt(sa)).toEqual({ limite: '60 min · 15 kWh', falta: 'Faltam 33 min · 11,7 kWh' });
  });
  it('a energia informada vale mais que a da recarga', () => {
    expect(faltaDoLimite(sa, 10).energia_kwh).toBe(5);
  });
  it('só um limite', () => {
    expect(limiteTxt({ limite_tempo_min: 120, limite_energia_kwh: null, duracao_min: 27 })).toEqual({ limite: '120 min', falta: 'Faltam 93 min' });
    expect(limiteTxt({ limite_tempo_min: null, limite_energia_kwh: 15.5, kwh_total: 3 })).toEqual({ limite: '15,5 kWh', falta: 'Faltam 12,5 kWh' });
    expect(limiteTxt({ limite_tempo_min: 60, duracao_min: 59 })?.falta).toBe('Falta 1 min');
  });
  it('minuto quebrado arredonda para cima; nunca fica negativo', () => {
    expect(faltaDoLimite({ limite_tempo_min: 60, duracao_min: 59.2 }).tempo_min).toBe(1);
    expect(faltaDoLimite({ limite_tempo_min: 60, limite_energia_kwh: 15, duracao_min: 75, kwh_total: 16 })).toEqual({ tempo_min: 0, energia_kwh: 0, atingido: true });
  });
  it('limite atingido', () => {
    expect(limiteTxt({ limite_tempo_min: 60, duracao_min: 60 })).toEqual({ limite: '60 min', falta: 'Limite atingido' });
    expect(limiteTxt({ limite_tempo_min: 60, limite_energia_kwh: 15, duracao_min: 10, kwh_total: 15 })?.falta).toBe('Limite atingido');
  });
  it('esperando o carro mostra só o limite; sem medida não inventa o que falta', () => {
    expect(limiteTxt({ limite_tempo_min: 60, duracao_min: 0, aguardando_inicio: true })).toEqual({ limite: '60 min', falta: null });
    expect(limiteTxt({ limite_tempo_min: 60 })).toEqual({ limite: '60 min', falta: null });
  });
  it('recarga sem limite', () => {
    expect(limiteTxt({ limite_tempo_min: null, limite_energia_kwh: null })).toBeNull();
    expect(limiteTxt(null)).toBeNull();
    expect(faltaDoLimite(null)).toEqual({ tempo_min: null, energia_kwh: null, atingido: false });
  });
  it('número em texto (decimal do banco) também vale', () => {
    expect(limiteTxt({ limite_tempo_min: '60', limite_energia_kwh: '15.000', duracao_min: '27', kwh_total: '3.300' })).toEqual({ limite: '60 min · 15 kWh', falta: 'Faltam 33 min · 11,7 kWh' });
  });
});

describe('validarLimite (faixas)', () => {
  it('vazio é sem limite', () => {
    expect(validarLimite('', FAIXA_TEMPO)).toEqual({ valor: null, ok: true });
    expect(validarLimite('  ', FAIXA_ENERGIA)).toEqual({ valor: null, ok: true });
    expect(validarLimite(null, FAIXA_TEMPO)).toEqual({ valor: null, ok: true });
  });
  it.each([['5', 5], ['60', 60], ['1440', 1440], [' 90 ', 90]])('tempo %s vale', (txt, valor) => {
    expect(validarLimite(txt, FAIXA_TEMPO)).toEqual({ valor, ok: true });
  });
  it.each(['4', '1441', '0', '60,5', '60.5', '-10', 'abc', '1e2', '10 min'])('tempo %s não vale', (txt) => {
    expect(validarLimite(txt, FAIXA_TEMPO)).toEqual({ valor: null, ok: false });
  });
  it.each([['1', 1], ['15,5', 15.5], ['15.5', 15.5], ['200', 200]])('energia %s vale', (txt, valor) => {
    expect(validarLimite(txt, FAIXA_ENERGIA)).toEqual({ valor, ok: true });
  });
  it.each(['0,9', '200,1', '201', '0', ',5'])('energia %s não vale', (txt) => {
    expect(validarLimite(txt, FAIXA_ENERGIA).ok).toBe(false);
  });
  it('o padrão do carregador é o teto ao iniciar', () => {
    const f = faixaComTeto(FAIXA_TEMPO, 120);
    expect(f).toEqual({ min: 5, max: 120, inteiro: true });
    expect(validarLimite('120', f).ok).toBe(true);
    expect(validarLimite('121', f).ok).toBe(false);
    expect(faixaComTeto(FAIXA_TEMPO, null)).toBe(FAIXA_TEMPO);
    expect(faixaComTeto(FAIXA_ENERGIA, '20.000').max).toBe(20);
  });
  it('corrente: inteiro entre o mínimo e o máximo do carregador', () => {
    const f = faixaCorrente({ corrente_min_a: 6, corrente_max_a: 32 });
    expect(f).toEqual({ min: 6, max: 32, inteiro: true });
    expect(validarLimite('16', f)).toEqual({ valor: 16, ok: true });
    expect(validarLimite('6', f).ok).toBe(true);
    expect(validarLimite('32', f).ok).toBe(true);
    expect(validarLimite('5', f).ok).toBe(false);
    expect(validarLimite('33', f).ok).toBe(false);
    expect(validarLimite('16,5', f).ok).toBe(false);
    expect(validarLimite('', f)).toEqual({ valor: null, ok: true });
    expect(faixaCorrente({ corrente_min_a: 6, corrente_max_a: 16 }).max).toBe(16);
    expect(faixaCorrente(null)).toEqual({ min: 6, max: 32, inteiro: true });
  });
});

describe('corpoLiberar (POST :id/liberar)', () => {
  const limites = { tempo_min: 120, energia_kwh: 20 };
  it('limite vazio não vai no corpo', () => {
    expect(corpoLiberar('m1', '', '', limites)).toEqual({ morador_id: 'm1' });
  });
  it('limites preenchidos vão como número', () => {
    expect(corpoLiberar('m1', '60', '15,5', limites)).toEqual({ morador_id: 'm1', limite_tempo_min: 60, limite_energia_kwh: 15.5 });
    expect(corpoLiberar('m1', '60', '', limites)).toEqual({ morador_id: 'm1', limite_tempo_min: 60 });
  });
  it('acima do padrão do carregador, fora da faixa ou sem morador não envia', () => {
    expect(corpoLiberar('m1', '121', '', limites)).toBeNull();
    expect(corpoLiberar('m1', '', '21', limites)).toBeNull();
    expect(corpoLiberar('m1', '4', '', limites)).toBeNull();
    expect(corpoLiberar('', '60', '15', limites)).toBeNull();
  });
  it('sem padrão no carregador vale a faixa inteira', () => {
    expect(corpoLiberar('m1', '1440', '200', { tempo_min: null, energia_kwh: null })).toEqual({ morador_id: 'm1', limite_tempo_min: 1440, limite_energia_kwh: 200 });
    expect(corpoLiberar('m1', '1441', '', { tempo_min: null, energia_kwh: null })).toBeNull();
  });
  it('carregador que não é OCPP manda só o morador, como sempre', () => {
    expect(corpoLiberar('m1', '60', '15', null)).toEqual({ morador_id: 'm1' });
    expect(corpoLiberar('m1', 'lixo', '', undefined)).toEqual({ morador_id: 'm1' });
  });
});

describe('kwDe (potência da leitura em kW)', () => {
  it('potencia_kw vale direto, sem dividir por 1000', () => {
    expect(kwDe({ potencia_kw: 7.21 })).toBe(7.21);
    expect(kwDe({ potencia_kw: 150 })).toBe(150);
    expect(kwDe({ potencia_kw: '7.5' })).toBe(7.5);
    expect(kwDe({ potencia_kw: 0 })).toBe(0);
  });
  it('potencia_kw ganha de Pt (80 W no fim da recarga não vira 80 kW)', () => {
    expect(kwDe({ Pt: 80, potencia_kw: 0.08 })).toBe(0.08);
    expect(kwDe({ Pt: 7210, potencia_kw: 7.21 })).toBe(7.21);
  });
  it('sem potencia_kw segue a regra antiga: acima de 100 é W', () => {
    expect(kwDe({ Pt: 7200 })).toBe(7.2);
    expect(kwDe({ Pt: 7.2 })).toBe(7.2);
    expect(kwDe({ potencia: 3500 })).toBe(3.5);
    expect(kwDe({ power: 11 })).toBe(11);
    expect(kwDe({ potencia_kw: null, Pt: 7200 })).toBe(7.2);
  });
  it('sem leitura de potência', () => {
    expect(kwDe({})).toBeNull();
    expect(kwDe(null)).toBeNull();
    expect(kwDe({ Pt: 'abc' })).toBeNull();
  });
});

describe('tabela de recargas', () => {
  it('origem só aparece quando não foi pelo NexON', () => {
    expect(rotuloOrigem('cartao')).toBe('Cartão');
    expect(rotuloOrigem('automatico')).toBe('Automático');
    expect(rotuloOrigem('nexon')).toBeNull();
    expect(rotuloOrigem(undefined)).toBeNull();
  });
  it('segunda linha: origem e como terminou', () => {
    expect(subRecarga({ origem: 'nexon', motivo_fim_texto: 'Limite de tempo' })).toBe('Terminou: Limite de tempo');
    expect(subRecarga({ origem: 'cartao', motivo_fim_texto: 'Carro desconectado' })).toBe('Cartão · Terminou: Carro desconectado');
    expect(subRecarga({ origem: 'automatico' })).toBe('Automático');
    expect(subRecarga({ origem: 'nexon', motivo_fim_texto: null })).toBe('');
    expect(subRecarga({})).toBe('');
  });
});

describe('revisarConfig (PUT :id/config)', () => {
  const limites: Limites = { tempo_min: 120, energia_kwh: 20, inicio_automatico: false, corrente_a: null, corrente_min_a: 6, corrente_max_a: 32, corrente_suportada: null };
  const atual = { tarifa: 0.9, limites };
  const tudo = { tarifa: true, limites: true, corrente: true };

  it('nada mexido: nada a gravar', () => {
    expect(revisarConfig(atual, RASCUNHO_VAZIO, tudo)).toMatchObject({ mudancas: [], corpo: {}, invalido: false });
  });
  it('valor igual ao gravado não é alteração', () => {
    const r = revisarConfig(atual, { ...RASCUNHO_VAZIO, tarifa: '0,90', tempo: '120', energia: '20', auto: false, corrente: '' }, tudo);
    expect(r.mudancas).toEqual([]);
    expect(r.corpo).toEqual({});
  });
  it('valor do kWh: de → para e faixa de R$ 0,30 a R$ 5,00', () => {
    const r = revisarConfig(atual, { ...RASCUNHO_VAZIO, tarifa: '1,05' }, tudo);
    expect(r.mudancas).toEqual([{ label: 'Valor do kWh', de: 'R$ 0,90', para: 'R$ 1,05' }]);
    expect(r.corpo).toEqual({ tarifa_kwh: 1.05 });
    for (const ruim of ['', '0,29', '5,01', 'abc']) {
      const x = revisarConfig(atual, { ...RASCUNHO_VAZIO, tarifa: ruim }, tudo);
      expect(x.ruins.tarifa).toBe(true);
      expect(x.invalido).toBe(true);
      expect(x.corpo).toEqual({});
    }
  });
  it('limite vazio tira o limite (null)', () => {
    const r = revisarConfig(atual, { ...RASCUNHO_VAZIO, tempo: '', energia: '15,5' }, tudo);
    expect(r.mudancas).toEqual([
      { label: 'Tempo padrão por recarga', de: '120 min', para: 'Sem limite' },
      { label: 'Energia padrão por recarga', de: '20 kWh', para: '15,5 kWh' },
    ]);
    expect(r.corpo).toEqual({ limite_tempo_min: null, limite_energia_kwh: 15.5 });
  });
  it('início automático e corrente máxima', () => {
    const r = revisarConfig(atual, { ...RASCUNHO_VAZIO, auto: true, corrente: '16' }, tudo);
    expect(r.mudancas).toEqual([
      { label: 'Iniciar sozinho ao conectar o carro', de: 'Desligado', para: 'Ligado' },
      { label: 'Corrente máxima', de: 'Sem limite', para: '16 A' },
    ]);
    expect(r.corpo).toEqual({ inicio_automatico: true, limite_corrente_a: 16 });
  });
  it('fora da faixa trava o Salvar e marca o campo', () => {
    const r = revisarConfig(atual, { ...RASCUNHO_VAZIO, tempo: '4', energia: '201', corrente: '33' }, tudo);
    expect(r.ruins).toEqual({ tarifa: false, tempo: true, energia: true, corrente: true });
    expect(r.invalido).toBe(true);
    expect(r.corpo).toEqual({});
  });
  it('só entra o que o perfil pode mudar', () => {
    const rascunho = { tarifa: '1,05', tempo: '60', energia: '10', auto: true, corrente: '16' };
    // Proprietário: limites sim; valor do kWh e corrente não.
    expect(revisarConfig(atual, rascunho, { tarifa: false, limites: true, corrente: false }).corpo)
      .toEqual({ limite_tempo_min: 60, limite_energia_kwh: 10, inicio_automatico: true });
    // Operador: nada.
    expect(revisarConfig(atual, rascunho, { tarifa: false, limites: false, corrente: false })).toMatchObject({ mudancas: [], corpo: {}, invalido: false });
  });
  it('carregador que não é OCPP: só o valor do kWh', () => {
    const r = revisarConfig({ tarifa: null, limites: null }, { ...RASCUNHO_VAZIO, tarifa: '0,95', tempo: '60', corrente: '16' }, tudo);
    expect(r.mudancas).toEqual([{ label: 'Valor do kWh', de: '—', para: 'R$ 0,95' }]);
    expect(r.corpo).toEqual({ tarifa_kwh: 0.95 });
  });
  it('aviso da revisão diz o efeito de cada alteração', () => {
    expect(notaDaRevisao({ tarifa_kwh: 1 })).toBe('O novo valor vale a partir de agora. Recargas já fechadas não são recalculadas.');
    expect(notaDaRevisao({ limite_tempo_min: null })).toBe('Os limites de uso valem para as próximas recargas.');
    expect(notaDaRevisao({ tarifa_kwh: 1, limite_corrente_a: 16 }))
      .toBe('O novo valor do kWh vale a partir de agora. Recargas já fechadas não são recalculadas. A corrente máxima é enviada ao carregador agora.');
    expect(notaDaRevisao({})).toBe('');
  });
});

describe('conexão e parâmetros', () => {
  it('resposta do carregador ao gravar parâmetro', () => {
    expect(respostaParametro('Accepted')).toEqual({ texto: 'Aceito', gravou: true, reiniciar: false });
    expect(respostaParametro('RebootRequired')).toEqual({ texto: 'Aceito, exige reiniciar', gravou: true, reiniciar: true });
    expect(respostaParametro('Rejected')).toEqual({ texto: 'Recusado', gravou: false, reiniciar: false });
    expect(respostaParametro('NotSupported')).toEqual({ texto: 'Não suportado', gravou: false, reiniciar: false });
    expect(respostaParametro('Outra')).toEqual({ texto: 'Outra', gravou: false, reiniciar: false });
    expect(respostaParametro(undefined).texto).toBe('Sem resposta');
  });
  it('busca na chave e no valor, sem diferenciar maiúscula nem acento', () => {
    const lista = [
      { chave: 'HeartbeatInterval', valor: '240' },
      { chave: 'MeterValueSampleInterval', valor: '60', somente_leitura: true },
      { chave: 'SupportedFeatureProfiles', valor: 'Core,RemoteTrigger' },
      { chave: 'Descrição', valor: null },
    ];
    expect(filtrarParametros(lista, '')).toBe(lista);
    expect(filtrarParametros(lista, ' interval ').map((p) => p.chave)).toEqual(['HeartbeatInterval', 'MeterValueSampleInterval']);
    expect(filtrarParametros(lista, 'remotetrigger').map((p) => p.chave)).toEqual(['SupportedFeatureProfiles']);
    expect(filtrarParametros(lista, 'descricao').map((p) => p.chave)).toEqual(['Descrição']);
    expect(filtrarParametros(lista, 'nada')).toEqual([]);
  });
  it('identidade do carregador: vai na URL', () => {
    expect(identidadeValida('20260703000025')).toBe(true);
    expect(identidadeValida(' CHINT-01_a.b ')).toBe(true);
    expect(identidadeValida('')).toBe(false);
    expect(identidadeValida('com espaço')).toBe(false);
    expect(identidadeValida('a/b')).toBe(false);
    expect(identidadeValida('a?b')).toBe(false);
    expect(identidadeValida('x'.repeat(65))).toBe(false);
  });
});

describe('textos de apoio', () => {
  it('erroMsg: mensagem da API (texto ou lista) ou o padrão', () => {
    expect(erroMsg({ response: { data: { message: 'O carregador recusou o limite de corrente.' } } }, 'Falha')).toBe('O carregador recusou o limite de corrente.');
    expect(erroMsg({ response: { data: { message: ['a', 'b'] } } }, 'Falha')).toBe('a; b');
    expect(erroMsg({ response: { data: {} } }, 'Falha')).toBe('Falha');
    expect(erroMsg(new Error('rede'), 'Falha')).toBe('Falha');
    expect(erroMsg(null, 'Falha')).toBe('Falha');
  });
  it('erroMsg: o erro da API vem no envelope { success: false, error: { message } }', () => {
    const envelope = (message: unknown) => ({ response: { status: 409, data: { success: false, error: { code: 'CONFLICT', message }, meta: { requestId: 'r1' } } } });
    expect(erroMsg(envelope('O carregador não aceitou o comando (Rejected).'), 'Falha')).toBe('O carregador não aceitou o comando (Rejected).');
    expect(erroMsg(envelope(['a', 'b']), 'Falha')).toBe('a; b');
    expect(erroMsg(envelope(''), 'Falha')).toBe('Falha');
    // Resposta do Nest sem o envelope: `error` é o nome do status e a mensagem vem solta.
    expect(erroMsg({ response: { data: { statusCode: 400, message: 'Identidade inválida', error: 'Bad Request' } } }, 'Falha')).toBe('Identidade inválida');
    // Corpo que não é objeto (página de erro do proxy).
    expect(erroMsg({ response: { status: 502, data: '<html>Bad Gateway</html>' } }, 'Falha')).toBe('Falha');
  });
  it('datas no horário do aparelho', () => {
    const quando = iso(2026, 11, 18, 14, 2);
    expect(dataHora(quando)).toBe('18/11/2026 14:02');
    expect(dataHora(null)).toBeNull();
    expect(dataHora('lixo')).toBeNull();
    expect(dataHoraCurta(quando)).toBe('18/11 14:02');
    expect(dataHoraCurta('ontem')).toBe('ontem');
    expect(dataHoraCurta(null)).toBe('—');
  });
  it('desde e lido: só a hora quando é hoje', () => {
    const quando = iso(2026, 11, 18, 14, 2);
    expect(desdeTxt(quando, new Date(2026, 10, 18, 17, 0))).toBe('desde 14:02');
    expect(desdeTxt(quando, new Date(2026, 10, 19, 9, 0))).toBe('desde 18/11 14:02');
    expect(desdeTxt(null)).toBe('');
    expect(lidoTxt(quando, new Date(2026, 10, 18, 17, 0))).toBe('lido às 14:02');
    expect(lidoTxt(quando, new Date(2026, 10, 19, 9, 0))).toBe('lido em 18/11 14:02');
    expect(lidoTxt(undefined)).toBe('');
  });
  it('numTxt: número para o campo', () => {
    expect(numTxt(20)).toBe('20');
    expect(numTxt(15.5)).toBe('15,5');
    expect(numTxt('20.000')).toBe('20');
    expect(numTxt(null)).toBe('');
  });
});
