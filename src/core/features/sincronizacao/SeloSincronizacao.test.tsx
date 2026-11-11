import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeloSincronizacao } from './SeloSincronizacao';
import type { EstadoSincronizacao } from './useSincronizacao';

const estado = (mudar: Partial<EstadoSincronizacao> = {}): EstadoSincronizacao => ({
  registro_id: 'P1',
  compartilhado: true,
  versao: 3,
  origem: 'service',
  atualizado_em: null,
  pendentes: 0,
  com_erro: false,
  recusado: null,
  ...mudar,
});

/** O selo diz se o registro chega ao outro produto; a recusa de lá não pode passar por "compartilhado" (10/11/2026) */
describe('SeloSincronizacao', () => {
  it('não compartilhado: nada', () => {
    const { container } = render(<SeloSincronizacao estado={estado({ compartilhado: false, recusado: 'qualquer' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('compartilhado e aceito: "Compartilhado"', () => {
    render(<SeloSincronizacao estado={estado()} />);
    expect(screen.getByText('Compartilhado')).toBeInTheDocument();
  });

  it('o outro lado recusou: "Recusado", com o porquê', () => {
    render(<SeloSincronizacao estado={estado({ recusado: 'lá este registro deixou de ser compartilhado' })} />);
    expect(screen.getByText('Recusado')).toHaveAttribute('title', expect.stringMatching(/deixou de ser compartilhado. Compartilhar de novo religa/));
    expect(screen.queryByText('Compartilhado')).not.toBeInTheDocument();
  });
});
