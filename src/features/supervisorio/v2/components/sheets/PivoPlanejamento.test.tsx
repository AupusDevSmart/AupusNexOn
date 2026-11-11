import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IrrigacaoAvancada, CONFIG_PADRAO, paradaValida, type ConfigIrrigacao, type EnvioIrrigacao } from './PivoIrrigacao';
import { AtalhosRapidos, envioDoRascunho, mudancas, rascunhoDe, type Rascunho } from './PivoRapido';

// NEXON-98 — o botão principal da ficha abre o "Planejamento de irrigação": parado liga; ligado
// mostra Desligar e, ao editar, "Salvar e enviar" (reinício com as novas opções).

const EM_CURSO: ConfigIrrigacao = { ...CONFIG_PADRAO, direcao: 'Avanço', percentual: 60 };

function abrir(props: Partial<Parameters<typeof IrrigacaoAvancada>[0]> = {}) {
  const onEnviar = vi.fn<(e: EnvioIrrigacao) => void>();
  const onDesligar = vi.fn();
  render(
    <IrrigacaoAvancada
      nome="Pivô 3" angulo={90} ultima={CONFIG_PADRAO} lamina100={7.15} tempoVolta100={21} ponta={null} enviando={false}
      programacoes={[]} onRemoverProgramacao={() => undefined} onSalvarProgramacao={async () => true}
      onEnviar={onEnviar} onClose={() => undefined} onDesligar={onDesligar} {...props}
    />,
  );
  return { onEnviar, onDesligar };
}

describe('Planejamento de irrigação', () => {
  it('parado: chama Planejamento de irrigação e o botão é Ligar', () => {
    const { onEnviar } = abrir();
    expect(screen.getByText('Planejamento de irrigação')).toBeTruthy();
    expect(screen.queryByText('Desligar')).toBeNull();
    fireEvent.click(screen.getByText('Ligar'));
    expect(onEnviar).toHaveBeenCalledTimes(1);
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ modo: 'simples', inicio: null, config: { direcao: 'Reverso', percentual: 60 } });
  });

  it('ligado sem edição: só Desligar, partindo da irrigação em curso', () => {
    const { onDesligar } = abrir({ ligado: true, emCurso: { config: EM_CURSO, parada: { tipo: 'porVoltas', voltas: 2 } } });
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
    expect(screen.queryByText('Ligar')).toBeNull();
    // parte do que está girando (Direita), não da última enviada (Esquerda)
    expect(screen.getByText('Direita').getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('Voltas') as HTMLInputElement).value).toBe('2');
    fireEvent.click(screen.getByText('Desligar'));
    expect(onDesligar).toHaveBeenCalledTimes(1);
  });

  it('ligado e editado: o botão vira Salvar e enviar, avisa do reinício e envia as novas opções', () => {
    const { onEnviar } = abrir({ ligado: true, emCurso: { config: EM_CURSO, parada: { tipo: 'semParar' } } });
    fireEvent.click(screen.getByText('Esquerda'));
    expect(screen.getByText(/desliga e liga de novo com as novas opções/)).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ modo: 'simples', inicio: null, config: { direcao: 'Reverso', percentual: 60 } });
    // desfazer a edição volta a mostrar só o Desligar
    fireEvent.click(screen.getByText('Direita'));
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
  });

  it('ligado fora do NexON (sem irrigação registrada): avisa e deixa enviar sem editar', () => {
    const { onEnviar } = abrir({ ligado: true, semRegistro: true, emCurso: { config: EM_CURSO, parada: null } });
    expect(screen.getByText(/ligado fora do NexON/)).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar).toHaveBeenCalledTimes(1);
  });

  it('redigitar o mesmo percentual ou a lâmina equivalente não conta como edição', () => {
    abrir({ ligado: true, emCurso: { config: EM_CURSO, parada: { tipo: 'semParar' } } });
    const [pct] = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(pct, { target: { value: '60' } });
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
    fireEvent.change(pct, { target: { value: '70' } });
    expect(screen.getByText('Salvar e enviar')).toBeTruthy();
  });

  it('parada automática em curso: avisa que é mantida enquanto a Parada não muda', () => {
    abrir({ ligado: true, notaParada: 'Parada em curso mantida: término previsto 11/11 22:00.', emCurso: { config: EM_CURSO, parada: { tipo: 'porVoltas', voltas: 2 } } });
    expect(screen.getByText(/Parada em curso mantida/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'semParar' } });
    expect(screen.queryByText(/Parada em curso mantida/)).toBeNull();
  });

  it('tirar a parada em curso: conta como edição e o envio vai com manterParada false', () => {
    const { onEnviar } = abrir({ ligado: true, notaParada: 'Parada em curso mantida: término previsto 11/11 22:00.', emCurso: { config: EM_CURSO, parada: { tipo: 'porTempo' } } });
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
    fireEvent.click(screen.getByText('Tirar a parada'));
    expect(screen.getByText('A parada em curso será removida.')).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ manterParada: false, parada: { tipo: 'semParar' } });
  });

  it('tirar a parada por voltas em curso: vai sem parar, não recomeça as voltas', () => {
    const { onEnviar } = abrir({ ligado: true, notaParada: 'Parada em curso mantida.', emCurso: { config: EM_CURSO, parada: { tipo: 'porVoltas', voltas: 3 } } });
    fireEvent.click(screen.getByText('Tirar a parada'));
    fireEvent.click(screen.getByText('Salvar e enviar'));
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ manterParada: false, parada: { tipo: 'semParar' } });
  });

  it('no seco o percentual não conta: Molhado → mexe no % → Seco de novo não é edição', () => {
    abrir({ ligado: true, emCurso: { config: { ...EM_CURSO, semAgua: true }, parada: { tipo: 'semParar' } } });
    const seco = screen.getByRole('switch', { name: /Girar sem água/ });
    fireEvent.click(seco);
    fireEvent.change((screen.getAllByRole('textbox') as HTMLInputElement[])[0], { target: { value: '80' } });
    expect(screen.getByText('Salvar e enviar')).toBeTruthy();
    fireEvent.click(seco);
    expect(screen.queryByText('Salvar e enviar')).toBeNull();
  });

  it('parada de programação (por tempo) vira "sem parar" no formulário', () => {
    expect(paradaValida({ tipo: 'porTempo' })).toEqual({ tipo: 'semParar' });
    expect(paradaValida({ tipo: 'porAngulo', angulo: 45 })).toEqual({ tipo: 'porAngulo', angulo: 45 });
    expect(paradaValida(null)).toEqual({ tipo: 'semParar' });
  });
});

describe('edição rápida na ficha', () => {
  const base: Rascunho = rascunhoDe(EM_CURSO, { tipo: 'semParar' });

  it('mudancas lista só o que mudou', () => {
    expect(mudancas(base, base)).toEqual([]);
    expect(mudancas(base, { ...base, percentual: 80 })).toEqual([{ campo: 'percentual', label: 'Percentímetro', de: '60%', para: '80%' }]);
    expect(mudancas(base, { ...base, direcao: 'Reverso', semAgua: true, percentual: 10 }).map((m) => m.campo)).toEqual(['direcao', 'agua']);
    expect(mudancas(base, { ...base, parada: { tipo: 'porVoltas', voltas: 1 } })[0]).toMatchObject({ campo: 'parada', de: 'sem parar', para: '1 volta' });
  });

  it('envioDoRascunho mantém canhão e faixas em curso, e tira o canhão no seco', () => {
    const emCurso: ConfigIrrigacao = { ...EM_CURSO, canhao: true, faixasCanhao: [{ id: 'a', liga: 10, desliga: 40 }] };
    expect(envioDoRascunho({ ...base, percentual: 75 }, emCurso)).toMatchObject({
      modo: 'simples', inicio: null, parada: { tipo: 'semParar' },
      config: { direcao: 'Avanço', percentual: 75, canhao: true, faixasCanhao: [{ id: 'a', liga: 10, desliga: 40 }] },
    });
    expect(envioDoRascunho({ ...base, semAgua: true }, emCurso).config).toMatchObject({ semAgua: true, canhao: false, faixasCanhao: [] });
  });

  it('atalhos: um toque muda direção e percentímetro, sem passar de 0–100', () => {
    const onChange = vi.fn<(r: Rascunho) => void>();
    render(<AtalhosRapidos valor={{ ...base, percentual: 95 }} base={base} onChange={onChange} lamina100={7.15} onMaisOpcoes={() => undefined} />);
    fireEvent.click(screen.getByText('Esquerda'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ direcao: 'Reverso' }));
    fireEvent.click(screen.getByLabelText('Mais 10%'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ percentual: 100 }));
    fireEvent.click(screen.getByLabelText('Menos 1%'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ percentual: 94 }));
  });
});
