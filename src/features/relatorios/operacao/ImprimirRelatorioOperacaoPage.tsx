import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RelatorioOperacao } from './tipos';
import { buscarRelatorio, mensagemErro } from './api';
import { RelatorioOperacaoDoc } from './RelatorioOperacaoDoc';
import { ehTipo, tituloDocumento } from './catalogo';

/** Espera fontes e imagens do documento antes de imprimir (logo e Nunito no PDF). */
async function esperarRecursos(raiz: HTMLElement | null): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    /* sem Font Loading API */
  }
  const imgs = Array.from(raiz?.querySelectorAll('img') ?? []);
  await Promise.all(
    imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((ok) => { img.onload = () => ok(); img.onerror = () => ok(); }),
    ),
  );
}

/**
 * /relatorios/operacao/imprimir?tipo&unidadeId&mes — só as folhas A4, sem o layout do app.
 * Busca com formato=pdf (trilha de exportação) e abre o diálogo de impressão ("Salvar como PDF").
 */
export function ImprimirRelatorioOperacaoPage() {
  const [params] = useSearchParams();
  const tipo = params.get('tipo');
  const unidadeId = params.get('unidadeId') ?? '';
  const mes = params.get('mes') ?? '';
  const [dados, setDados] = useState<RelatorioOperacao | null>(null);
  const [erro, setErro] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const impresso = useRef(false);

  useEffect(() => {
    document.body.classList.add('rel-op-imprimindo');
    return () => document.body.classList.remove('rel-op-imprimindo');
  }, []);

  useEffect(() => {
    if (!ehTipo(tipo) || !unidadeId || !/^\d{4}-\d{2}$/.test(mes)) {
      setErro('Link de impressão incompleto: falta tipo, unidade ou mês.');
      return;
    }
    let vivo = true;
    buscarRelatorio(tipo, unidadeId, mes, 'pdf')
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(mensagemErro(e, 'Não foi possível gerar o relatório.')));
    return () => {
      vivo = false;
    };
  }, [tipo, unidadeId, mes]);

  useEffect(() => {
    if (!dados || !ehTipo(tipo) || impresso.current) return;
    const anterior = document.title;
    document.title = tituloDocumento(tipo, dados);
    let cancelado = false;
    esperarRecursos(raiz.current).then(() => {
      if (cancelado || impresso.current) return;
      impresso.current = true;
      // Um quadro de folga para o layout final das fontes.
      requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelado = true;
      document.title = anterior;
    };
  }, [dados, tipo]);

  return (
    <div style={{ minHeight: '100vh', background: '#E9EBF0' }}>
      <div
        className="rel-op-nao-imprimir"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '12px 16px', fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#1B1D3A' }}
      >
        {erro ? (
          <span role="alert" style={{ color: '#C2410C' }}>{erro}</span>
        ) : dados ? (
          <>
            <span>Na janela de impressão, escolha “Salvar como PDF”.</span>
            <button
              type="button"
              onClick={() => window.print()}
              style={{ border: '1px solid #C9CDD8', borderRadius: 6, background: '#fff', padding: '6px 12px', cursor: 'pointer' }}
            >
              Imprimir de novo
            </button>
          </>
        ) : (
          <span>Gerando relatório…</span>
        )}
      </div>
      {dados && ehTipo(tipo) && (
        <div ref={raiz} className="rel-op-folhas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '0 0 24px' }}>
          <RelatorioOperacaoDoc tipo={tipo} dados={dados} />
        </div>
      )}
    </div>
  );
}

export default ImprimirRelatorioOperacaoPage;
