import { describe, expect, it } from 'vitest';
import { formatApiError } from './api-error';

describe('formatApiError', () => {
  it('1. retorna "Erro desconhecido" para null/undefined', () => {
    expect(formatApiError(null)).toBe('Erro desconhecido');
    expect(formatApiError(undefined)).toBe('Erro desconhecido');
  });

  it('2. retorna string direta quando err eh string', () => {
    expect(formatApiError('falha')).toBe('falha');
  });

  it('3. extrai message de Error generico', () => {
    expect(formatApiError(new Error('algo deu errado'))).toBe(
      'algo deu errado',
    );
  });

  it('4. extrai response.data.message string (NestJS BadRequest comum)', () => {
    const axiosErr = {
      response: { status: 400, data: { message: 'codigo invalido' } },
    };
    expect(formatApiError(axiosErr)).toBe('codigo invalido');
  });

  it('5. junta response.data.message string[] com "; " (NestJS ValidationPipe)', () => {
    const axiosErr = {
      response: {
        status: 400,
        data: { message: ['codigo eh obrigatorio', 'nome eh obrigatorio'] },
      },
    };
    expect(formatApiError(axiosErr)).toBe(
      'codigo eh obrigatorio; nome eh obrigatorio',
    );
  });

  it('6. usa response.data.error como fallback quando message ausente', () => {
    const axiosErr = {
      response: { status: 500, data: { error: 'Internal Server Error' } },
    };
    expect(formatApiError(axiosErr)).toBe('Internal Server Error');
  });

  it('7. usa status + statusText quando data sem message/error', () => {
    const axiosErr = {
      response: { status: 502, statusText: 'Bad Gateway', data: {} },
    };
    expect(formatApiError(axiosErr)).toBe('502 Bad Gateway');
  });

  it('8. traduz "Network Error" do axios pra mensagem clara', () => {
    const axiosErr = { message: 'Network Error' };
    expect(formatApiError(axiosErr)).toBe('Sem conexao com o servidor');
  });

  it('9. serializa message como objeto (caso raro)', () => {
    const axiosErr = {
      response: { status: 422, data: { message: { campo: 'invalido' } } },
    };
    expect(formatApiError(axiosErr)).toContain('campo');
    expect(formatApiError(axiosErr)).toContain('invalido');
  });
});
