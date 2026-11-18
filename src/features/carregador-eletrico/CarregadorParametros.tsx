import { useState } from 'react';
import { api } from '@/config/api';
import { unwrap } from '@/features/supervisorio/v2/components/sheets/equipUi';
import { NX, s, NxDialog, NxDialogButtons } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { col, secao } from '@/features/supervisorio/v2/components/sheets/pivoPartes';
import { MONO, botaoLinha, campoLargo } from './carregador.estilos';
import { Resultado } from './carregadorUi';
import { erroMsg, filtrarParametros, respostaParametro, type Parametro } from './carregador.util';

/**
 * Configuração › Parâmetros do equipamento (só analista, carregador vinculado).
 * A lista é a do próprio carregador (GET :id/ocpp/parametros) e não carrega sozinha: a leitura
 * conversa com o equipamento. Quem não é somente leitura se altera um por vez
 * (PUT { chave, valor }), com confirmação, e a resposta do carregador fica na linha.
 */

export function CarregadorParametros({ id, conectado }: { id: string; conectado: boolean }) {
  const [lista, setLista] = useState<Parametro[] | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  // O parâmetro em edição fica guardado depois de fechar: o diálogo não esvazia enquanto some.
  const [edit, setEdit] = useState({ chave: '', atual: '', novo: '' });
  const [aberto, setAberto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [res, setRes] = useState<{ chave: string; ok: boolean; texto: string } | null>(null);

  const ler = async () => {
    setLendo(true); setErro(''); setRes(null);
    try {
      const d = unwrap<{ parametros?: Parametro[] }>(await api.get(`/carregador-eletrico/${id}/ocpp/parametros`));
      setLista(Array.isArray(d?.parametros) ? d.parametros : []);
    } catch (e) { setErro(erroMsg(e, 'Não foi possível ler os parâmetros do carregador.')); }
    finally { setLendo(false); }
  };

  const novo = edit.novo.trim();
  const gravar = async () => {
    const { chave } = edit;
    setGravando(true); setRes(null);
    try {
      const d = unwrap<{ resposta?: string }>(await api.put(`/carregador-eletrico/${id}/ocpp/parametros`, { chave, valor: novo }));
      const r = respostaParametro(d?.resposta);
      if (r.gravou) setLista((l) => (l ?? []).map((p) => (p.chave === chave ? { ...p, valor: novo } : p)));
      setRes({ chave, ok: r.gravou, texto: r.reiniciar ? `${r.texto}. Reinicie o carregador, em Comandos, para o valor valer.` : r.texto });
    } catch (e) {
      setRes({ chave, ok: false, texto: erroMsg(e, 'Falha ao gravar o parâmetro') });
    } finally { setGravando(false); setAberto(false); }
  };

  const off = lendo || !conectado;
  const visiveis = lista ? filtrarParametros(lista, busca) : [];
  const semComunicacao = !conectado && (
    <span style={{ fontSize: 12, color: NX.mudo }}>Sem comunicação com o carregador: a leitura volta quando ele reconectar.</span>
  );

  return (
    <>
      {secao('PARÂMETROS DO EQUIPAMENTO', 10)}
      {lista == null ? (
        <div style={{ ...s.card, padding: '12px 16px', ...col(8) }}>
          <span style={{ fontSize: 13, color: NX.mudo }}>A lista vem do próprio carregador e não é lida sozinha. A leitura leva alguns segundos.</span>
          <button type="button" disabled={off} onClick={() => void ler()} style={{ ...botaoLinha(off), width: '100%' }}>
            {lendo ? 'Lendo…' : erro ? 'Tentar de novo' : 'Ler parâmetros do carregador'}
          </button>
          {semComunicacao}
          {erro && <Resultado ok={false}>{erro}</Resultado>}
        </div>
      ) : (
        <div style={{ ...s.card, padding: '12px 16px 2px 16px', ...col(8) }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input className="nxc-campo" type="search" aria-label="Buscar parâmetro" placeholder="Buscar parâmetro" autoComplete="off" spellCheck={false}
              value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...campoLargo(), flex: '1 1 180px', fontWeight: 600 }} />
            <button type="button" disabled={off} onClick={() => void ler()} style={botaoLinha(off)}>{lendo ? 'Lendo…' : 'Ler de novo'}</button>
          </div>
          <span style={{ fontSize: 12, color: NX.mudo }}>
            {busca.trim() ? `${visiveis.length} de ${lista.length} parâmetros` : `${lista.length} ${lista.length === 1 ? 'parâmetro' : 'parâmetros'}`}
          </span>
          {semComunicacao}
          {erro && <Resultado ok={false}>{erro}</Resultado>}
          <div>
            {lista.length === 0 && <div style={{ padding: '10px 0', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>O carregador não informou nenhum parâmetro.</div>}
            {lista.length > 0 && visiveis.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '10px 0', borderTop: `1px solid ${NX.linha}` }}>
                <span style={{ fontSize: 14, color: NX.mudo }}>Nenhum parâmetro com esse texto.</span>
                <button type="button" onClick={() => setBusca('')} style={botaoLinha()}>Limpar busca</button>
              </div>
            )}
            {visiveis.map((p) => (
              <div key={p.chave} className="nxc-par" style={{ padding: '10px 0', borderTop: `1px solid ${NX.linha}` }}>
                <span style={{ gridArea: 'k', ...MONO, fontSize: 13, fontWeight: 700 }}>{p.chave}</span>
                <span style={{ gridArea: 'v', ...col(4), minWidth: 0 }}>
                  <span style={{ ...MONO, fontSize: 13, color: NX.caixaTx }}>{p.valor == null || p.valor === '' ? '—' : p.valor}</span>
                  {res?.chave === p.chave && <Resultado ok={res.ok}>{res.texto}</Resultado>}
                </span>
                <span style={{ gridArea: 'a', display: 'flex', justifyContent: 'flex-end' }}>
                  {p.somente_leitura
                    ? <span style={{ fontSize: 12, color: NX.mudo, whiteSpace: 'nowrap' }}>Só leitura</span>
                    : (
                      <button type="button" disabled={!conectado} aria-label={`Alterar ${p.chave}`} style={botaoLinha(!conectado)}
                        onClick={() => { const atual = String(p.valor ?? ''); setEdit({ chave: p.chave, atual, novo: atual }); setAberto(true); }}>
                        Alterar
                      </button>
                    )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <NxDialog open={aberto} onClose={() => { if (!gravando) setAberto(false); }} label="Alterar parâmetro" width={420}>
        <div style={col(10)}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Alterar parâmetro</span>
          <label htmlFor="w-par-valor" style={col(4)}>
            <span style={{ ...MONO, fontSize: 14, fontWeight: 700 }}>{edit.chave}</span>
            <input id="w-par-valor" className="nxc-campo" value={edit.novo} disabled={gravando} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              onChange={(e) => setEdit((x) => ({ ...x, novo: e.target.value }))} style={{ ...campoLargo(gravando), ...MONO }} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15, padding: '6px 0', borderBottom: `1px solid ${NX.linha}` }}>
            <span>Valor</span>
            <span style={{ ...MONO, textAlign: 'right', minWidth: 0 }}><span style={{ color: NX.mudo }}>{edit.atual || '—'}</span> → <b>{novo || '—'}</b></span>
          </div>
          <span style={{ fontSize: 13, color: NX.mudo }}>O valor é gravado no carregador na hora. Alguns parâmetros só valem depois de reiniciar.</span>
          <NxDialogButtons onCancel={() => { if (!gravando) setAberto(false); }} onConfirm={gravar} confirmLabel="Gravar" disabled={novo === edit.atual.trim()} busy={gravando} marginTop={8} />
        </div>
      </NxDialog>
    </>
  );
}
