import { useState } from 'react';
import { api } from '@/config/api';
import { unwrap } from '@/features/supervisorio/v2/components/sheets/equipUi';
import { NX, s, NxDialog, NxDialogButtons } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { Linha, col, secao } from '@/features/supervisorio/v2/components/sheets/pivoPartes';
import { botaoLinha } from './carregador.estilos';
import { Aviso, Resultado } from './carregadorUi';
import { erroMsg, type Comando, type OcppResumo } from './carregador.util';

/**
 * Configuração › Comandos do carregador OCPP (NEXON-130): POST :id/comando { comando }.
 * Cada comando confirma num diálogo que diz o efeito; a resposta do carregador (ou o erro)
 * fica escrita na tela. Sem comunicação, os botões ficam desligados e a razão aparece.
 */

interface Texto { titulo: string; sub: string; botao: string; pergunta: string; efeito: string; feito: string; falha: string }
const COMANDOS: Record<Comando, Texto> = {
  bloquear: {
    titulo: 'Bloquear carregador', sub: 'Deixa de aceitar recargas até ser liberado.', botao: 'Bloquear', pergunta: 'Bloquear carregador?',
    efeito: 'Ninguém consegue iniciar recarga até o carregador ser liberado. Se houver recarga em andamento, o bloqueio vale quando ela terminar.',
    feito: 'Carregador bloqueado.', falha: 'Falha ao bloquear o carregador',
  },
  liberar: {
    titulo: 'Liberar carregador', sub: 'Volta a aceitar recargas.', botao: 'Liberar', pergunta: 'Liberar carregador?',
    efeito: 'O carregador volta a aceitar recargas.',
    feito: 'Carregador liberado.', falha: 'Falha ao liberar o carregador',
  },
  destravar: {
    titulo: 'Destravar conector', sub: 'Solta o cabo preso no carregador.', botao: 'Destravar', pergunta: 'Destravar conector?',
    efeito: 'O carregador solta a trava do cabo. Se houver recarga em andamento, ela é encerrada.',
    feito: 'Conector destravado.', falha: 'Falha ao destravar o conector',
  },
  atualizar: {
    titulo: 'Atualizar leitura', sub: 'Pede a situação e as medições de agora.', botao: 'Atualizar', pergunta: 'Atualizar leitura?',
    efeito: 'O NexON pede ao carregador a situação e as medições de agora. A tela atualiza em alguns segundos.',
    feito: 'Leitura pedida ao carregador.', falha: 'Falha ao atualizar a leitura',
  },
  reiniciar: {
    titulo: 'Reiniciar carregador', sub: 'Desliga e liga de novo. Fica alguns minutos fora do ar.', botao: 'Reiniciar', pergunta: 'Reiniciar carregador?',
    efeito: 'O carregador reinicia e fica alguns minutos sem comunicação. Se houver recarga em andamento, ela é encerrada.',
    feito: 'Carregador reiniciando.', falha: 'Falha ao reiniciar o carregador',
  },
};

export function CarregadorComandos({ id, ocpp, tecnico, onExecutado }: {
  id: string; ocpp: OcppResumo;
  /** Reiniciar é só do analista. */
  tecnico: boolean;
  /** Depois de qualquer comando: o modal relê o estado e atualiza mais rápido por 1 minuto. */
  onExecutado: () => void;
}) {
  // O comando fica guardado depois de fechar: o diálogo não esvazia enquanto some.
  const [cmd, setCmd] = useState<Comando>('atualizar');
  const [aberto, setAberto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null);

  const semComunicacao = ocpp.conectado === false;
  const off = semComunicacao || busy;
  const lista: Comando[] = [ocpp.disponivel === false ? 'liberar' : 'bloquear', 'destravar', 'atualizar', ...(tecnico ? ['reiniciar' as const] : [])];
  const t = COMANDOS[cmd];

  const executar = async () => {
    setBusy(true); setRes(null);
    try {
      const r = unwrap<{ mensagem?: string }>(await api.post(`/carregador-eletrico/${id}/comando`, { comando: cmd }));
      setRes({ ok: true, texto: r?.mensagem || t.feito });
    } catch (e) {
      setRes({ ok: false, texto: erroMsg(e, t.falha) });
    } finally {
      setBusy(false); setAberto(false); onExecutado();
    }
  };

  return (
    <>
      {secao('COMANDOS', 10)}
      {semComunicacao && (
        <Aviso role="status"><span>Sem comunicação com o carregador. Os comandos voltam quando ele reconectar.</span></Aviso>
      )}
      <div style={{ ...s.card, padding: '0 16px' }}>
        {lista.map((c, i) => (
          <Linha key={c} first={i === 0} titulo={COMANDOS[c].titulo} sub={COMANDOS[c].sub} minHeight={64}>
            <button type="button" disabled={off} aria-label={COMANDOS[c].titulo} onClick={() => { setCmd(c); setAberto(true); }} style={botaoLinha(off)}>
              {busy && cmd === c ? 'Executando…' : COMANDOS[c].botao}
            </button>
          </Linha>
        ))}
      </div>
      {res && <Resultado ok={res.ok}>{res.texto}</Resultado>}

      <NxDialog open={aberto} onClose={() => { if (!busy) setAberto(false); }} label="Confirmar comando" width={400}>
        <div style={col(10)}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{t.pergunta}</span>
          <span style={{ fontSize: 14, color: NX.mudo }}>{t.efeito}</span>
          <NxDialogButtons onCancel={() => { if (!busy) setAberto(false); }} onConfirm={executar} confirmLabel={t.botao} busy={busy} marginTop={8} />
        </div>
      </NxDialog>
    </>
  );
}
