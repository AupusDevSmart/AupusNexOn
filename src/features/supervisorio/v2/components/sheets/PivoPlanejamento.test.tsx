import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IrrigacaoAvancada, CONFIG_PADRAO, paradaValida, previsao, resumoConfig, type ConfigIrrigacao, type EnvioIrrigacao } from './PivoIrrigacao';
import { AtalhosRapidos, PainelRapido, comMovimento, envioDoRascunho, mudancas, rascunhoDe, type Rascunho } from './PivoRapido';

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

  it('por segmentos: o anel aparece na própria tela e o envio leva o segmento escolhido e as opções dele', () => {
    const { onEnviar } = abrir();
    expect(screen.queryByRole('img', { name: 'Segmentos do pivô' })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /Por segmentos/ }));
    expect(screen.getByRole('img', { name: 'Segmentos do pivô' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Percentímetro'), { target: { value: '35' } });
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ modo: 'segmentos', segmento: 1, config: { percentual: 35, direcao: 'Reverso' } });
  });

  it('parado: o botão é Ligar e o envio sai simples, agora', () => {
    const { onEnviar } = abrir();
    expect(screen.queryByText('Desligar')).toBeNull();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ modo: 'simples', inicio: null, config: { direcao: 'Reverso', percentual: 60, semAgua: false } });
  });

  it('Movimento Parado: liga sem girar (0 %, com água), sem percentímetro nem parada por ângulo', () => {
    const { onEnviar } = abrir();
    fireEvent.click(screen.getByRole('radio', { name: 'Parado' }));
    expect(screen.queryByLabelText('Percentímetro')).toBeNull();
    expect(screen.getByText(/irriga no lugar onde está/)).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Por ângulo' })).toBeNull();
    expect(screen.getByText(/irriga no mesmo lugar até alguém desligar/)).toBeTruthy();
    fireEvent.click(screen.getByText('Ligar parado'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ config: { percentual: 0, semAgua: false }, parada: { tipo: 'semParar' } });
  });

  it('Parado e de volta a girar: retoma o percentual que estava', () => {
    const { onEnviar } = abrir();
    fireEvent.click(screen.getByRole('radio', { name: 'Parado' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Direita' }));
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ config: { direcao: 'Avanço', percentual: 60 } });
  });

  it('sem o ponto Percentímetro na TON não dá para ligar parado', () => {
    abrir({ podeParado: false });
    expect((screen.getByRole('radio', { name: 'Parado' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/precisa do ponto Percentímetro/)).toBeTruthy();
  });

  it('sem o ponto, uma última irrigação em 0 % não abre como Parado: sobe para 100 % girando', () => {
    const { onEnviar } = abrir({ podeParado: false, ultima: { ...CONFIG_PADRAO, direcao: 'Avanço', percentual: 0 } });
    expect(marcado('Parado')).toBe(false);
    expect(marcado('Direita')).toBe(true);
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config).toMatchObject({ direcao: 'Avanço', percentual: 100, semAgua: false });
  });

  it('seco com percentual 0: voltar para Molhado não vira Parado por tabela', () => {
    const { onEnviar } = abrir({ ultima: { ...CONFIG_PADRAO, semAgua: true, percentual: 0 } });
    fireEvent.click(screen.getByRole('radio', { name: 'Molhado' }));
    expect(marcado('Parado')).toBe(false);
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].config.percentual).toBeGreaterThan(0);
  });

  it('Parado tira a parada por ângulo e a devolve ao voltar a girar', () => {
    const { onEnviar } = abrir();
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'porAngulo' } });
    fireEvent.change(screen.getByLabelText('Ângulo de parada'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Parado' }));
    expect((screen.getByLabelText('Parada') as HTMLSelectElement).value).toBe('semParar');
    fireEvent.click(screen.getByRole('radio', { name: 'Esquerda' }));
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar.mock.calls[0][0].parada).toEqual({ tipo: 'porAngulo', angulo: 90 });
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
    expect(screen.getByText(/escolha Parado em Movimento/)).toBeTruthy();
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
    expect(marcado('Parado')).toBe(true);
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

  it('canhão: as faixas ficam na própria tela, sem aba', () => {
    const { onEnviar } = abrir();
    expect(screen.queryByText('Canhão')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /Canhão final/ }));
    fireEvent.click(screen.getByText('Ligar o canhão só em parte da volta'));
    fireEvent.click(screen.getByText('+ Adicionar faixa'));
    fireEvent.click(screen.getByText('Ligar'));
    const cfg = onEnviar.mock.calls[0][0].config;
    expect(cfg.canhao).toBe(true);
    expect(cfg.faixasCanhao).toHaveLength(1);
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
  });

  it('agenda não liga parado: com Movimento Parado o agendamento não salva', () => {
    const onSalvar = vi.fn(async () => true);
    abrir({ onSalvarProgramacao: onSalvar });
    fireEvent.click(screen.getByRole('radio', { name: 'Parado' }));
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
    fireEvent.click(screen.getByText('Parado'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ percentual: 0, semAgua: false }));
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
