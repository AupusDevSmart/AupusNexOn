import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IrrigacaoAvancada, CONFIG_PADRAO, complementoFaixas, fimDoSegmento, paradaValida, segmentoDoGiro, previsao, resumoConfig, type ConfigIrrigacao, type EnvioIrrigacao } from './PivoIrrigacao';
import { AtalhosRapidos, PainelRapido, comMovimento, envioDoRascunho, mudancas, rascunhoDe, type Rascunho } from './PivoRapido';
import { linhasParaItens, textoAgenda } from './pivoAgendaPlanilha';

// NEXON-98 — o botão principal da ficha abre o "Planejamento de irrigação": uma tela só, com
// Movimento (Direita, Esquerda ou Parado). Parado liga; ligado mostra Desligar e, ao editar,
// "Salvar e enviar" (reinício com as novas opções).

const EM_CURSO: ConfigIrrigacao = { ...CONFIG_PADRAO, direcao: 'Avanço', percentual: 60 };

function abrir(props: Partial<Parameters<typeof IrrigacaoAvancada>[0]> = {}) {
  const onEnviar = vi.fn<(e: EnvioIrrigacao) => void>();
  const onDesligar = vi.fn();
  render(
    <IrrigacaoAvancada
      nome="Pivô 3" angulo={90} ultima={CONFIG_PADRAO} lamina100={7.15} tempoVolta100={21} ponta={null} enviando={false} podeParado
      programacoes={[]} onRemoverProgramacao={() => undefined} onSalvarProgramacao={async () => true}
      onEnviar={onEnviar} onClose={() => undefined} onDesligar={onDesligar} {...props}
    />,
  );
  return { onEnviar, onDesligar };
}
const marcado = (nome: string) => screen.getByRole('radio', { name: nome }).getAttribute('aria-checked') === 'true';
// Água é um switch (o nome acessível começa pelo título da linha)
const chave = (nome: 'Água') => screen.getByRole('switch', { name: new RegExp(`^${nome}`) }) as HTMLButtonElement;
const ligada = (nome: 'Água') => chave(nome).getAttribute('aria-checked') === 'true';

describe('Planejamento de irrigação', () => {
  it('uma tela só: sem as abas Ângulo e Segmentos, sem Carregar última', () => {
    abrir();
    expect(screen.getByText('Planejamento de irrigação')).toBeTruthy();
    expect(screen.queryByText('Ângulo')).toBeNull();
    expect(screen.queryByText('Segmentos')).toBeNull();
    expect(screen.queryByText(/Carregar última/)).toBeNull();
    expect(screen.getByText('Irrigação')).toBeTruthy();
    expect(screen.getByText('Agenda')).toBeTruthy();
  });

  it('parada por ângulo mostra o gráfico para escolher o ângulo final, na própria tela', () => {
    const { onEnviar } = abrir();
    expect(screen.queryByRole('img', { name: 'Ângulo final' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'porAngulo' } });
    expect(screen.getByRole('img', { name: 'Ângulo final' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Ângulo de parada'), { target: { value: '135' } });
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ modo: 'simples', parada: { tipo: 'porAngulo', angulo: 135 } });
  });

  it('parada por segmento: o anel aparece na tela e o pivô para no fim do segmento escolhido', () => {
    const { onEnviar } = abrir();
    expect(screen.queryByRole('switch', { name: /Por segmentos/ })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Segmentos do pivô' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'porSegmento' } });
    expect(screen.getByRole('img', { name: 'Segmentos do pivô' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Segmento 3' }));
    fireEvent.click(screen.getByText('Ligar'));
    // Esquerda diminui o ângulo: o segmento 3 (180–270°) acaba em 180°
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ modo: 'segmentos', segmento: 3, parada: { tipo: 'porAngulo', angulo: 180 }, config: { direcao: 'Reverso' } });
  });

  it('parada por segmento segue a direção: trocar para Direita leva a parada para o outro lado do segmento', () => {
    const { onEnviar } = abrir();
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'porSegmento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Segmento 3' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Direita' }));
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].parada).toEqual({ tipo: 'porAngulo', angulo: 270 });
    expect([fimDoSegmento(0, 'Avanço'), fimDoSegmento(3, 'Avanço'), fimDoSegmento(0, 'Reverso'), fimDoSegmento(3, 'Reverso')]).toEqual([90, 0, 0, 270]);
    // em cima da divisa (90°): para a direita entra no segmento 2, para a esquerda no 1 — nunca distância zero
    expect([segmentoDoGiro(90, 'Avanço'), segmentoDoGiro(90, 'Reverso'), segmentoDoGiro(0, 'Reverso'), segmentoDoGiro(359, 'Avanço')]).toEqual([1, 0, 3, 3]);
  });

  it('direção é só Direita ou Esquerda; Água é um switch', () => {
    const { onEnviar } = abrir();
    expect(screen.queryByRole('radio', { name: 'Parado' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Molhado' })).toBeNull();
    expect(ligada('Água')).toBe(true);
    fireEvent.click(chave('Água'));
    expect(ligada('Água')).toBe(false);
    expect(screen.queryByLabelText('Percentímetro')).toBeNull();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config).toMatchObject({ semAgua: true });
  });

  it('parada: abre em 1 volta e não oferece "Sem parar"', () => {
    const { onEnviar } = abrir();
    expect((screen.getByLabelText('Parada') as HTMLSelectElement).value).toBe('porVoltas');
    expect(screen.queryByRole('option', { name: 'Sem parar' })).toBeNull();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].parada).toEqual({ tipo: 'porVoltas', voltas: 1 });
  });

  it('irrigação em curso sem parada: "Sem parar" aparece só para mostrar o que está valendo', () => {
    abrir({ ligado: true, emCurso: { config: EM_CURSO, parada: { tipo: 'semParar' } } });
    expect((screen.getByLabelText('Parada') as HTMLSelectElement).value).toBe('semParar');
    expect(screen.getByRole('option', { name: 'Sem parar' })).toBeTruthy();
  });

  it('parado: o botão é Ligar e o envio sai simples, agora', () => {
    const { onEnviar } = abrir();
    expect(screen.queryByText('Desligar')).toBeNull();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ modo: 'simples', inicio: null, config: { direcao: 'Reverso', percentual: 60, semAgua: false } });
  });

  it('ligar parado saiu da tela: não há switch nem opção Parado, e uma última irrigação em 0 % abre girando', () => {
    const { onEnviar } = abrir({ podeParado: true, ultima: { ...CONFIG_PADRAO, direcao: 'Avanço', percentual: 0 } });
    expect(screen.queryByRole('switch', { name: /^Parado/ })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Parado' })).toBeNull();
    expect(screen.queryByText('Ligar parado')).toBeNull();
    expect(screen.getByLabelText('Percentímetro')).toBeTruthy();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config).toMatchObject({ direcao: 'Avanço', percentual: 100, semAgua: false });
  });

  it('irrigação em curso parada: escolher a direção volta a girar', () => {
    const { onEnviar } = abrir({ ligado: true, emCurso: { config: { ...EM_CURSO, percentual: 0 }, parada: { tipo: 'semParar' } } });
    expect(screen.getByText(/Irrigando parado/)).toBeTruthy();
    expect(marcado('Direita')).toBe(false);
    expect(marcado('Esquerda')).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'Direita' }));
    expect(screen.queryByText(/Irrigando parado/)).toBeNull();
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar.mock.calls[0][0].config).toMatchObject({ direcao: 'Avanço', semAgua: false });
    expect(onEnviar.mock.calls[0][0].config.percentual).toBeGreaterThan(0);
  });

  it('sem o ponto, uma última irrigação em 0 % não abre como Parado: sobe para 100 % girando', () => {
    const { onEnviar } = abrir({ podeParado: false, ultima: { ...CONFIG_PADRAO, direcao: 'Avanço', percentual: 0 } });
    expect(marcado('Direita')).toBe(true);
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config).toMatchObject({ direcao: 'Avanço', percentual: 100, semAgua: false });
  });

  it('seco com percentual 0: voltar para Molhado não vira Parado por tabela', () => {
    const { onEnviar } = abrir({ ultima: { ...CONFIG_PADRAO, semAgua: true, percentual: 0 } });
    fireEvent.click(chave('Água'));
    expect(ligada('Água')).toBe(true);
    expect(screen.getByLabelText('Percentímetro')).toBeTruthy();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config.percentual).toBeGreaterThan(0);
  });

  it('em curso parado com parada por ângulo: mostra a parada como é e avisa que só para por tempo', () => {
    abrir({ ligado: true, emCurso: { config: { ...EM_CURSO, percentual: 0 }, parada: { tipo: 'porAngulo', angulo: 90 } } });
    expect((screen.getByLabelText('Parada') as HTMLSelectElement).value).toBe('porAngulo');
    expect(screen.getByText(/Parado só para por tempo/)).toBeTruthy();
  });

  it('minutos: dá para apagar e digitar de novo sem virar 190', () => {
    const { onEnviar } = abrir();
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'porTempo' } });
    const campo = screen.getByLabelText('Minutos') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: '' } });
    expect(campo.value).toBe('');
    fireEvent.change(campo, { target: { value: '90' } });
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].parada).toEqual({ tipo: 'porTempo', minutos: 90 });
  });

  it('ligado: redigitar os mesmos minutos conta como parada nova (não herda o resto)', () => {
    const { onEnviar } = abrir({ ligado: true, notaParada: 'Parada em curso mantida: término previsto 11/11 22:00.', emCurso: { config: EM_CURSO, parada: { tipo: 'porTempo', minutos: 480 } } });
    // intacta: a caixa mostra o término em curso, sem previsão nova
    expect(screen.getByText(/Parada em curso mantida/)).toBeTruthy();
    expect(screen.queryByText(/Término previsto (hoje|amanhã)/)).toBeNull();
    // apaga um dígito e digita de novo: o valor é o mesmo, mas o operador mexeu
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '48' } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '480' } });
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ manterParada: false, parada: { tipo: 'porTempo', minutos: 480 } });
  });

  it('percentímetro vai de 1 a 100: digitar 0 não zera, aponta o Parado', () => {
    const { onEnviar } = abrir();
    fireEvent.change(screen.getByLabelText('Percentímetro'), { target: { value: '0' } });
    expect(screen.getByText('De 1 a 100 %.')).toBeTruthy();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config.percentual).toBe(60);
  });

  it('parada por tempo: vai com os minutos e a previsão mostra o término', () => {
    const { onEnviar } = abrir();
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'porTempo' } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '90' } });
    expect(screen.getByText(/Término previsto/)).toBeTruthy();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].parada).toEqual({ tipo: 'porTempo', minutos: 90 });
  });

  it('ligado sem edição: só Desligar, partindo da irrigação em curso', () => {
    const { onDesligar } = abrir({ ligado: true, emCurso: { config: EM_CURSO, parada: { tipo: 'porVoltas', voltas: 2 } } });
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
    expect(screen.queryByText('Ligar')).toBeNull();
    expect(screen.queryByLabelText('Início')).toBeNull();
    // parte do que está girando (Direita), não da última enviada (Esquerda)
    expect(marcado('Direita')).toBe(true);
    expect((screen.getByLabelText('Voltas') as HTMLInputElement).value).toBe('2');
    fireEvent.click(screen.getByText('Desligar'));
    expect(onDesligar).toHaveBeenCalledTimes(1);
  });

  it('ligado e editado: vira Salvar e enviar, avisa do reinício; desfazer a edição volta ao Desligar', () => {
    const { onEnviar } = abrir({ ligado: true, emCurso: { config: EM_CURSO, parada: { tipo: 'semParar' } } });
    fireEvent.click(screen.getByRole('radio', { name: 'Esquerda' }));
    expect(screen.getByText(/desliga e liga de novo com as novas opções/)).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ modo: 'simples', inicio: null, config: { direcao: 'Reverso', percentual: 60 } });
    fireEvent.click(screen.getByRole('radio', { name: 'Direita' }));
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
  });

  it('irrigação em curso a 0 % abre como Parado e não conta como edição', () => {
    abrir({ ligado: true, emCurso: { config: { ...EM_CURSO, percentual: 0 }, parada: { tipo: 'semParar' } } });
    expect(screen.getByText(/Irrigando parado/)).toBeTruthy();
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
  });

  it('ligado fora do NexON (sem irrigação registrada): avisa e deixa enviar sem editar', () => {
    const { onEnviar } = abrir({ ligado: true, semRegistro: true, emCurso: { config: EM_CURSO, parada: null } });
    expect(screen.getByText(/ligado fora do NexON/)).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar).toHaveBeenCalledTimes(1);
  });

  it('redigitar o mesmo percentual não conta como edição; no seco o percentual também não', () => {
    abrir({ ligado: true, emCurso: { config: EM_CURSO, parada: { tipo: 'semParar' } } });
    fireEvent.change(screen.getByLabelText('Percentímetro'), { target: { value: '60' } });
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
    fireEvent.change(screen.getByLabelText('Percentímetro'), { target: { value: '70' } });
    expect(screen.getByText('Salvar e enviar')).toBeTruthy();
  });

  it('parada da programação (por tempo) aparece como é; mantida enquanto não muda, "Sem parar" tira', () => {
    const { onEnviar } = abrir({ ligado: true, notaParada: 'Parada em curso mantida: término previsto 11/11 22:00.', emCurso: { config: EM_CURSO, parada: { tipo: 'porTempo', minutos: 480 } } });
    expect((screen.getByLabelText('Minutos') as HTMLInputElement).value).toBe('480');
    expect(screen.getByText(/Parada em curso mantida/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'semParar' } });
    expect(screen.queryByText(/Parada em curso mantida/)).toBeNull();
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar.mock.calls[0][0].parada).toEqual({ tipo: 'semParar' });
  });

  it('canhão: abre ligado a volta toda e o operador marca onde NÃO irrigar; vai para a API a faixa ligada', () => {
    const { onEnviar } = abrir();
    expect(screen.queryByText('Canhão')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /Canhão final/ }));
    expect(screen.getByText('Ligado a volta toda')).toBeTruthy();
    fireEvent.click(screen.getByText('Marcar onde não irrigar'));
    expect(screen.getByRole('img', { name: 'Canhão final, 0 trecho(s) sem irrigar' })).toBeTruthy();
    fireEvent.click(screen.getByText('+ Marcar trecho sem irrigar'));
    expect(screen.getByRole('img', { name: 'Canhão final, 1 trecho(s) sem irrigar' })).toBeTruthy();
    const de = Number((screen.getByLabelText('Trecho 1 sem irrigar, de') as HTMLInputElement).value);
    const ate = Number((screen.getByLabelText('Trecho 1 sem irrigar, até') as HTMLInputElement).value);
    fireEvent.click(screen.getByText('Ligar'));
    const cfg = onEnviar.mock.calls[0][0].config;
    expect(cfg.canhao).toBe(true);
    // o canhão fica ligado do fim do trecho marcado até o começo dele (o resto da volta)
    expect(cfg.faixasCanhao).toEqual([expect.objectContaining({ liga: ate, desliga: de })]);
  });

  it('canhão com a volta toda marcada sem irrigar vai DESLIGADO (não "ligado a volta toda")', () => {
    const { onEnviar } = abrir();
    fireEvent.click(screen.getByRole('switch', { name: /Canhão final/ }));
    fireEvent.click(screen.getByText('Marcar onde não irrigar'));
    fireEvent.click(screen.getByText('+ Marcar trecho sem irrigar'));
    // estica o trecho até encostar nele mesmo: De 0 até 0 não é representável, então dois trechos encostados
    fireEvent.change(screen.getByLabelText('Trecho 1 sem irrigar, de'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Trecho 1 sem irrigar, até'), { target: { value: '180' } });
    fireEvent.click(screen.getByText('+ Marcar trecho sem irrigar'));
    fireEvent.change(screen.getByLabelText('Trecho 2 sem irrigar, de'), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText('Trecho 2 sem irrigar, até'), { target: { value: '0' } });
    expect(screen.getByText('A volta toda está marcada: o canhão vai desligado.')).toBeTruthy();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config).toMatchObject({ canhao: false, faixasCanhao: [] });
  });

  it('canhão sem nada marcado vai sem faixas (ligado a volta toda); faixas em curso não mexidas vão como vieram', () => {
    const { onEnviar } = abrir();
    fireEvent.click(screen.getByRole('switch', { name: /Canhão final/ }));
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config).toMatchObject({ canhao: true, faixasCanhao: [] });
    const faixas = [{ id: 'a', liga: 10, desliga: 40 }, { id: 'b', liga: 200, desliga: 260 }];
    expect(complementoFaixas(faixas).map(({ liga, desliga }) => [liga, desliga])).toEqual([[40, 200], [260, 10]]);
    // o complemento do complemento são as mesmas faixas
    expect(complementoFaixas(complementoFaixas(faixas)).map(({ liga, desliga }) => [liga, desliga]).sort((x, y) => x[0] - y[0])).toEqual([[10, 40], [200, 260]]);
    expect(complementoFaixas([{ id: 'a', liga: 350, desliga: 20 }]).map(({ liga, desliga }) => [liga, desliga])).toEqual([[20, 350]]);
    expect(complementoFaixas([])).toEqual([]);
  });

  it('agenda: usa as opções da aba Irrigação em vez de repetir os campos', async () => {
    const onSalvar = vi.fn(async () => true);
    abrir({ onSalvarProgramacao: onSalvar });
    fireEvent.click(screen.getByRole('radio', { name: 'Direita' }));
    fireEvent.click(screen.getByText('Agenda'));
    fireEvent.click(screen.getByText('+ Adicionar horário'));
    expect(screen.getByText('Direita · 60% · Molhado')).toBeTruthy();
    expect(screen.queryByLabelText('Percentímetro')).toBeNull();
    fireEvent.click(screen.getByText('Salvar agendamento'));
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ sentido: 'horario', velocidade: 60, com_agua: true }));
    // sem canhão o campo nem vai (API antiga recusaria o corpo)
    expect((onSalvar.mock.calls[0] as unknown[])[0]).not.toHaveProperty('canhao');
  });

  it('agenda: o canhão ligado na Irrigação vai junto no agendamento', async () => {
    const onSalvar = vi.fn(async () => true);
    abrir({ onSalvarProgramacao: onSalvar });
    fireEvent.click(screen.getByRole('radio', { name: 'Direita' }));
    fireEvent.click(screen.getByRole('switch', { name: /Canhão final/ }));
    fireEvent.click(screen.getByText('Agenda'));
    fireEvent.click(screen.getByText('+ Adicionar horário'));
    expect(screen.getByText('Direita · 60% · Molhado · canhão')).toBeTruthy();
    expect(screen.getByText('Canhão final: liga junto com o pivô, a volta toda.')).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar agendamento'));
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ com_agua: true, canhao: true }));
  });

  it('agenda não liga parado: com a irrigação em curso parada o agendamento não salva', () => {
    const onSalvar = vi.fn(async () => true);
    abrir({ onSalvarProgramacao: onSalvar, ligado: true, emCurso: { config: { ...EM_CURSO, percentual: 0 }, parada: { tipo: 'semParar' } } });
    fireEvent.click(screen.getByText('Agenda'));
    fireEvent.click(screen.getByText('+ Adicionar horário'));
    expect(screen.getByText(/A agenda não liga parado/)).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar agendamento'));
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('funções de apoio: parada, previsão e resumo', () => {
    expect(paradaValida({ tipo: 'porTempo', minutos: 30 } as never)).toEqual({ tipo: 'porTempo', minutos: 30 });
    expect(paradaValida({ tipo: 'outra' })).toEqual({ tipo: 'semParar' });
    expect(paradaValida(null)).toEqual({ tipo: 'semParar' });
    expect(resumoConfig({ ...EM_CURSO, percentual: 0 })).toBe('Parado · Molhado');
    expect(previsao({ ...EM_CURSO, percentual: 0 }, { tipo: 'porVoltas', voltas: 1 }, 'Avanço', 0, 21, new Date()).fim).toBeNull();
    expect(previsao({ ...EM_CURSO, percentual: 0 }, { tipo: 'porTempo', minutos: 60 }, 'Avanço', 0, 21, new Date(0)).fim).toEqual(new Date(3600000));
  });
});

describe('edição rápida na ficha', () => {
  const base: Rascunho = rascunhoDe(EM_CURSO, { tipo: 'semParar' });

  it('mudancas lista só o que mudou', () => {
    expect(mudancas(base, base)).toEqual([]);
    expect(mudancas(base, { ...base, percentual: 80 })).toEqual([{ campo: 'percentual', label: 'Percentímetro', de: '60%', para: '80%' }]);
    expect(mudancas(base, { ...base, direcao: 'Reverso', semAgua: true, percentual: 10 }).map((m) => m.campo)).toEqual(['direcao', 'agua']);
    expect(mudancas(base, { ...base, parada: { tipo: 'porVoltas', voltas: 1 } })[0]).toMatchObject({ campo: 'parada', de: 'sem parar', para: '1 volta' });
    expect(mudancas(base, { ...base, parada: { tipo: 'porTempo', minutos: 45 } })[0]).toMatchObject({ campo: 'parada', para: '45 min' });
  });

  it('Parado é só o percentímetro em 0: sai sem reiniciar e tira a parada por ângulo', () => {
    const comAngulo: Rascunho = { ...base, parada: { tipo: 'porAngulo', angulo: 90 } };
    const p = comMovimento(comAngulo, 'Parado', comAngulo);
    expect(p).toMatchObject({ direcao: 'Avanço', semAgua: false, percentual: 0, parada: { tipo: 'semParar' } });
    expect(mudancas(base, comMovimento(base, 'Parado', base))).toEqual([{ campo: 'percentual', label: 'Percentímetro', de: '60%', para: 'Parado (0%)' }]);
    // voltar a girar retoma o percentual em curso e a parada que o Parado tirou
    expect(comMovimento(p, 'Reverso', comAngulo)).toMatchObject({ direcao: 'Reverso', percentual: 60, parada: { tipo: 'porAngulo', angulo: 90 } });
  });

  it('envioDoRascunho mantém canhão e faixas em curso, e tira o canhão no seco', () => {
    const emCurso: ConfigIrrigacao = { ...EM_CURSO, canhao: true, faixasCanhao: [{ id: 'a', liga: 10, desliga: 40 }] };
    expect(envioDoRascunho({ ...base, percentual: 75 }, emCurso)).toMatchObject({
      modo: 'simples', inicio: null, parada: { tipo: 'semParar' },
      config: { direcao: 'Avanço', percentual: 75, canhao: true, faixasCanhao: [{ id: 'a', liga: 10, desliga: 40 }] },
    });
    expect(envioDoRascunho({ ...base, semAgua: true }, emCurso).config).toMatchObject({ semAgua: true, canhao: false, faixasCanhao: [] });
  });

  it('atalhos: um toque muda o movimento e o percentímetro, de 1 a 100', () => {
    const onChange = vi.fn<(r: Rascunho) => void>();
    const { rerender } = render(<AtalhosRapidos valor={{ ...base, percentual: 95 }} base={base} onChange={onChange} lamina100={7.15} onMaisOpcoes={() => undefined} podeParado />);
    fireEvent.click(screen.getByText('Esquerda'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ direcao: 'Reverso' }));
    fireEvent.click(screen.getByLabelText('Mais 10%'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ percentual: 100 }));
    // ligar parado saiu da tela: a opção só existe quando a irrigação em curso já é parada
    expect(screen.queryByText('Parado')).toBeNull();
    rerender(<AtalhosRapidos valor={{ ...base, percentual: 5 }} base={base} onChange={onChange} lamina100={7.15} onMaisOpcoes={() => undefined} podeParado />);
    fireEvent.click(screen.getByLabelText('Menos 10%'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ percentual: 1 }));
  });

  it('painel: Parado esconde o percentímetro e a parada por ângulo', () => {
    render(<PainelRapido valor={{ ...base, percentual: 0 }} base={base} onChange={() => undefined} lamina100={7.15} onMaisOpcoes={() => undefined} podeParado />);
    expect(screen.queryByLabelText('Percentímetro')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Por ângulo' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Por tempo' })).toBeTruthy();
  });
});

describe('agenda por planilha', () => {
  const CAB = ['Data', 'Início', 'Fim', 'Duração (min)', 'Sentido', 'Percentímetro (%)', 'Água'];

  it('lê as linhas pelo cabeçalho, ignora linha em branco e guarda o número da linha do arquivo', () => {
    const { itens, erro } = linhasParaItens([CAB, ['12/11/2026', '21:00', '05:00', '', 'Direita', '60', 'Sim'], ['', '', '', '', '', '', ''], ['13/11/2026', '21:00', '', '480', 'Esquerda', '80', '']]);
    expect(erro).toBeNull();
    expect(itens).toEqual([
      { linha: 2, data: '12/11/2026', hora_inicio: '21:00', hora_fim: '05:00', duracao_min: '', sentido: 'Direita', percentual: '60', com_agua: 'Sim', canhao: '' },
      { linha: 4, data: '13/11/2026', hora_inicio: '21:00', hora_fim: '', duracao_min: '480', sentido: 'Esquerda', percentual: '80', com_agua: '', canhao: '' },
    ]);
  });

  it('aceita cabeçalho com outro nome e fora de ordem; sem coluna obrigatória, explica', () => {
    const { itens } = linhasParaItens([['Sentido', 'Hora início', 'DATA', 'Percentimetro', 'Hora fim'], ['Direita', '08:00', '2026-11-12', '50', '10:00']]);
    expect(itens[0]).toMatchObject({ data: '2026-11-12', hora_inicio: '08:00', hora_fim: '10:00', sentido: 'Direita', percentual: '50' });
    expect(linhasParaItens([['Nome', 'Valor'], ['a', 'b']]).erro).toMatch(/coluna "Data"/);
    expect(linhasParaItens([['Data', 'Início', 'Sentido'], ['12/11/2026', '21:00', 'Direita']]).erro).toMatch(/coluna "Fim"/);
    expect(linhasParaItens([CAB]).erro).toMatch(/nenhuma linha/);
  });

  it('coluna Canhão: lida quando existe; planilha antiga, sem ela, fica em branco (= desligado)', () => {
    const { itens } = linhasParaItens([[...CAB, 'Canhão'], ['12/11/2026', '21:00', '05:00', '', 'Direita', '60', 'Sim', 'Sim']]);
    expect(itens[0].canhao).toBe('Sim');
    expect(linhasParaItens([CAB, ['12/11/2026', '21:00', '05:00', '', 'Direita', '60', 'Sim']]).itens[0].canhao).toBe('');
  });

  it('texto de uma irrigação agendada por data', () => {
    expect(textoAgenda({ id: 'x', data: '2026-11-12', hora_inicio: '21:00', duracao_min: 480, sentido: 'horario', velocidade: 60, com_agua: true }))
      .toEqual({ quando: '12/11/2026 · 21:00 → 05:00', det: '60% · Molhado · Direita' });
    expect(textoAgenda({ id: 'x', data: '2026-11-12', hora_inicio: '08:00', duracao_min: 120, sentido: 'anti_horario', velocidade: null, com_agua: false }).det).toBe('Seco · Esquerda');
    expect(textoAgenda({ id: 'x', data: '2026-11-12', hora_inicio: '21:00', duracao_min: 480, sentido: 'horario', velocidade: 60, com_agua: true, canhao: true }).det).toBe('60% · Molhado · Direita · canhão');
  });

  it('a Agenda mostra o modelo, o envio e o que já está agendado por data; apagar pede ao pai', () => {
    const onLimpar = vi.fn(async () => undefined);
    const onRemover = vi.fn();
    abrir({
      abaInicial: 'agenda', onLimparAgenda: onLimpar, onRemoverProgramacao: onRemover, onImportarAgenda: async () => null,
      agenda: [{ id: 'A1', data: '2026-11-12', hora_inicio: '21:00', duracao_min: 480, sentido: 'horario', velocidade: 60, com_agua: true }],
    });
    expect(screen.getByText('Baixar modelo')).toBeTruthy();
    expect(screen.getByText('Enviar planilha')).toBeTruthy();
    expect(screen.getByText('12/11/2026 · 21:00 → 05:00')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remover 12/11/2026 · 21:00 → 05:00'));
    expect(onRemover).toHaveBeenCalledWith('A1');
    // dois toques para apagar tudo
    fireEvent.click(screen.getByText('Apagar a agendada por data'));
    expect(onLimpar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirmar: apagar tudo'));
    expect(onLimpar).toHaveBeenCalledTimes(1);
  });
});
