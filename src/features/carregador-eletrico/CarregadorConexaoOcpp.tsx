import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '@/config/api';
import { unwrap } from '@/features/supervisorio/v2/components/sheets/equipUi';
import { NX, s, NxDialog, NxDialogButtons } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { Linha, col, secao } from '@/features/supervisorio/v2/components/sheets/pivoPartes';
import { MONO, botaoLinha, campoLargo } from './carregador.estilos';
import { Resultado } from './carregadorUi';
import { dataHora, dataHoraCurta, erroMsg, identidadeValida, type ConexaoOcpp, type Credenciais } from './carregador.util';

/**
 * Configuração › Conexão OCPP (só analista; aparece em qualquer carregador, para vincular).
 * GET :id/ocpp traz o vínculo e as tentativas recusadas; PUT vincula ou troca a identidade;
 * POST :id/ocpp/chave gera chave nova; DELETE desvincula. A chave e as URLs vêm UMA vez na
 * resposta: ficam guardadas no modal (não somem ao trocar de aba) até "Já guardei" ou fechar.
 */

type Acao = 'trocar' | 'chave' | 'desvincular';
const VALOR: CSSProperties = { fontSize: 15, color: NX.mudo, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' };

/** Texto que se copia com um toque; sem permissão de área de transferência, fica selecionado. */
function Copiavel({ rotulo, sub, valor }: { rotulo: string; sub: string; valor: string }) {
  const [situacao, setSituacao] = useState<'' | 'copiado' | 'falhou'>('');
  const ref = useRef<HTMLElement>(null);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setSituacao('copiado');
      window.setTimeout(() => setSituacao(''), 2500);
    } catch {
      const sel = window.getSelection();
      if (ref.current && sel) sel.selectAllChildren(ref.current);
      setSituacao('falhou');
    }
  };
  return (
    <div style={col(6)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ ...col(2), minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{rotulo}</span>
          <span style={{ fontSize: 12, color: NX.mudo }}>{sub}</span>
        </span>
        <button type="button" aria-label={`Copiar ${rotulo}`} onClick={() => void copiar()} style={botaoLinha()}>{situacao === 'copiado' ? 'Copiado' : 'Copiar'}</button>
      </div>
      <code ref={ref} style={{ ...MONO, display: 'block', fontSize: 13, background: NX.caixa, color: NX.caixaTx, borderRadius: 10, padding: '8px 10px', userSelect: 'all' }}>{valor}</code>
      {situacao === 'falhou' && <span role="alert" style={{ fontSize: 12, color: NX.bad }}>Não copiou. O texto ficou selecionado: copie pelo teclado.</span>}
    </div>
  );
}

export function CarregadorConexaoOcpp({ id, relerEm, credenciais, onCredenciais, onMudou }: {
  id: string;
  /** Muda a cada atualização do modal: a conexão e as tentativas recusadas são relidas junto. */
  relerEm: number;
  credenciais: Credenciais | null; onCredenciais: (c: Credenciais | null) => void;
  /** Vínculo mudou: o modal relê o estado do carregador. */
  onMudou: () => void;
}) {
  const [info, setInfo] = useState<ConexaoOcpp | null>(null);
  const [erroLer, setErroLer] = useState('');
  /** Identidade digitada; null = a que está gravada. */
  const [identidade, setIdentidade] = useState<string | null>(null);
  // A ação fica guardada depois de fechar: o diálogo não esvazia enquanto some.
  const [acao, setAcao] = useState<Acao>('chave');
  const [novaIdentidade, setNovaIdentidade] = useState('');
  const [aberto, setAberto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const ler = useCallback(async () => {
    try {
      const d = unwrap<ConexaoOcpp>(await api.get(`/carregador-eletrico/${id}/ocpp`));
      setInfo(d && typeof d === 'object' ? d : {});
      setErroLer('');
    } catch (e) { setErroLer(erroMsg(e, 'Não foi possível ler a conexão do carregador.')); }
  }, [id]);
  useEffect(() => { void ler(); }, [ler, relerEm]);

  const gravada = String(info?.charge_point_id ?? '').trim();
  const vinculado = info?.vinculado ?? !!gravada;
  const valor = identidade ?? gravada;
  const alvo = valor.trim();
  const ruim = alvo !== '' && !identidadeValida(alvo);
  const semMudanca = alvo === '' || ruim || (vinculado && alvo === gravada);
  const recusadas = (info?.recusadas ?? []).slice(0, 10);

  const pedir = (a: Acao) => { setAcao(a); setNovaIdentidade(alvo); setAberto(true); };
  const fechar = () => { if (!busy) setAberto(false); };
  /** Roda a chamada, mostra o resultado na tela e relê a conexão. */
  const rodar = async (fn: () => Promise<string>, falha: string) => {
    setBusy(true); setRes(null);
    try { setRes({ ok: true, texto: await fn() }); }
    catch (e) { setRes({ ok: false, texto: erroMsg(e, falha) }); }
    finally { setBusy(false); setAberto(false); await ler(); onMudou(); }
  };
  const guardar = (c: Credenciais | null | undefined) => { if (c?.chave) onCredenciais({ chave: c.chave, url: c.url, url_completa: c.url_completa }); };

  const gravarIdentidade = () => rodar(async () => {
    const c = unwrap<Credenciais>(await api.put(`/carregador-eletrico/${id}/ocpp`, { charge_point_id: alvo }));
    if (c?.chave) guardar(c);
    // Só a identidade mudou (a API não manda chave nova) e a chave ainda está na tela: a URL
    // completa guardada termina na identidade antiga e seria recusada. Sai; a URL sem
    // identidade e a chave continuam valendo.
    else if (credenciais?.chave) onCredenciais({ ...credenciais, url_completa: null });
    setIdentidade(null);
    return vinculado ? `Identidade trocada para ${alvo}.` : c?.chave ? 'Carregador vinculado. Agora configure a URL no carregador.' : 'Carregador vinculado.';
  }, vinculado ? 'Falha ao trocar a identidade' : 'Falha ao vincular o carregador');
  const gerarChave = () => rodar(async () => {
    guardar(unwrap<Credenciais>(await api.post(`/carregador-eletrico/${id}/ocpp/chave`)));
    return 'Chave nova gerada. Configure a URL nova no carregador.';
  }, 'Falha ao gerar a chave');
  const desvincular = () => rodar(async () => {
    await api.delete(`/carregador-eletrico/${id}/ocpp`);
    onCredenciais(null); setIdentidade(null);
    return 'Carregador desvinculado.';
  }, 'Falha ao desvincular o carregador');

  const dialogo: Record<Acao, { pergunta: string; efeito: string; confirmar: string; onConfirm: () => void }> = {
    trocar: {
      pergunta: 'Trocar identidade?', confirmar: 'Trocar', onConfirm: gravarIdentidade,
      efeito: `O NexON passa a aceitar só o carregador que se apresentar como ${novaIdentidade}. A chave continua a mesma.`,
    },
    chave: {
      pergunta: 'Gerar nova chave?', confirmar: 'Gerar chave', onConfirm: gerarChave,
      efeito: 'A chave atual deixa de valer e a conexão do carregador cai. Depois, configure a URL nova no carregador.',
    },
    desvincular: {
      pergunta: 'Desvincular carregador?', confirmar: 'Desvincular', onConfirm: desvincular,
      efeito: 'O carregador deixa de conectar ao NexON e a conexão atual cai. As recargas já registradas continuam no histórico.',
    },
  };
  const d = dialogo[acao];

  return (
    <>
      {secao('CONEXÃO OCPP', 10)}
      {info == null ? (
        <div style={{ ...s.card, padding: '0 16px' }}>
          {erroLer ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '10px 0' }}>
              <span role="alert" style={{ fontSize: 14, color: NX.bad, minWidth: 0 }}>{erroLer}</span>
              <button type="button" onClick={() => void ler()} style={botaoLinha()}>Tentar de novo</button>
            </div>
          ) : (
            <div style={{ minHeight: 58, display: 'flex', alignItems: 'center', fontSize: 14, color: NX.mudo }}>Carregando…</div>
          )}
        </div>
      ) : (
        <>
          <div style={{ ...s.card, padding: '12px 16px', ...col(8) }}>
            <label htmlFor="w-ocpp-identidade" style={col(2)}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Identidade do carregador (número de série)</span>
              <span style={{ fontSize: 12, color: ruim ? NX.bad : NX.mudo }}>
                {ruim ? 'Sem espaço, barra, ? nem #.' : vinculado ? 'É o que o carregador envia ao conectar. Trocar a identidade não muda a chave.' : 'É o que o carregador envia ao conectar. Em geral, o número de série da etiqueta.'}
              </span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <input id="w-ocpp-identidade" ref={campo} className="nxc-campo" value={valor} placeholder="ex.: 20260703000025" aria-invalid={ruim}
                autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
                onChange={(e) => setIdentidade(e.target.value)} style={{ ...campoLargo(false, ruim), ...MONO, flex: '1 1 180px' }} />
              <button type="button" disabled={semMudanca || busy} onClick={() => (vinculado ? pedir('trocar') : void gravarIdentidade())} style={botaoLinha(semMudanca || busy)}>
                {busy && !aberto ? 'Executando…' : vinculado ? 'Trocar identidade' : 'Vincular'}
              </button>
            </div>
          </div>

          {credenciais?.chave && (
            <div style={{ ...s.card, border: `1.5px solid ${NX.acao}`, padding: '14px 16px', ...col(12) }}>
              <span role="alert" style={{ fontSize: 15, fontWeight: 800 }}>Guarde agora: a chave não aparece de novo.</span>
              {credenciais.url_completa && <Copiavel rotulo="URL completa" sub="Com a identidade no fim. Para carregador que usa a URL como está." valor={credenciais.url_completa} />}
              {credenciais.url && <Copiavel rotulo="URL" sub="Sem a identidade no fim. Para carregador que acrescenta a identidade sozinho." valor={credenciais.url} />}
              <Copiavel rotulo="Chave" sub="Para carregador que pede usuário e senha: o usuário é a identidade e a senha é a chave." valor={credenciais.chave} />
              <div style={{ background: NX.caixa, borderRadius: 12, padding: '10px 14px', ...col(4), fontSize: 13, color: NX.caixaTx }}>
                <span>1. No carregador, entre na rede Wi-Fi dele e abra "OCPP URL Settings".</span>
                <span>2. Cole a URL e envie.</span>
              </div>
              <button type="button" onClick={() => onCredenciais(null)} style={{ ...botaoLinha(), width: '100%' }}>Já guardei</button>
            </div>
          )}

          {vinculado && (
            <>
              <div style={{ ...s.card, padding: '0 16px' }}>
                <Linha first titulo="Situação" minHeight={50}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={s.stDot(info.conectado ? 'ok' : 'off')} />
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{info.conectado ? 'Conectado' : 'Desconectado'}</span>
                  </span>
                </Linha>
                <Linha titulo="Última conexão" minHeight={50}><span style={VALOR}>{dataHora(info.ultima_conexao) ?? '—'}</span></Linha>
                <Linha titulo="Último heartbeat" minHeight={50}><span style={VALOR}>{dataHora(info.ultimo_heartbeat) ?? '—'}</span></Linha>
                <Linha titulo="Fabricante" minHeight={50}><span style={VALOR}>{info.fabricante || '—'}</span></Linha>
                <Linha titulo="Modelo" minHeight={50}><span style={VALOR}>{info.modelo || '—'}</span></Linha>
                <Linha titulo="Número de série" minHeight={50}><span style={VALOR}>{info.numero_serie || '—'}</span></Linha>
                <Linha titulo="Firmware" minHeight={50}><span style={VALOR}>{info.firmware || '—'}</span></Linha>
                <Linha titulo="Perfis suportados" minHeight={50}><span style={VALOR}>{info.perfis?.length ? info.perfis.join(', ') : '—'}</span></Linha>
              </div>
              <div style={{ ...s.card, padding: '0 16px' }}>
                <Linha first titulo="Chave de conexão" sub={dataHora(info.chave_gerada_em) ? `Gerada em ${dataHora(info.chave_gerada_em)}` : 'A chave só aparece quando é gerada'} minHeight={64}>
                  <button type="button" disabled={busy} onClick={() => pedir('chave')} style={botaoLinha(busy)}>Gerar nova chave</button>
                </Linha>
                <Linha titulo="Vínculo" sub="Tira o carregador do NexON" minHeight={64}>
                  <button type="button" disabled={busy} onClick={() => pedir('desvincular')} style={botaoLinha(busy, true)}>Desvincular</button>
                </Linha>
              </div>
            </>
          )}
          {res && <Resultado ok={res.ok}>{res.texto}</Resultado>}

          {recusadas.length > 0 && (
            <>
              {secao('TENTATIVAS RECUSADAS', 10)}
              <div style={{ ...s.card, padding: '0 16px' }}>
                {recusadas.map((r, i) => {
                  const ident = String(r.identidade ?? '').trim();
                  return (
                    <div key={`${r.quando ?? ''}-${ident}-${i}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', padding: '10px 0', ...(i > 0 ? { borderTop: `1px solid ${NX.linha}` } : {}) }}>
                      <span style={{ ...col(2), flex: '1 1 160px', minWidth: 0 }}>
                        <span style={{ ...MONO, fontSize: 14, fontWeight: 700 }}>{ident || 'Sem identidade'}</span>
                        <span style={{ fontSize: 12, color: NX.mudo, overflowWrap: 'anywhere' }}>{[dataHoraCurta(r.quando), r.motivo, r.ip].filter(Boolean).join(' · ')}</span>
                      </span>
                      {ident && ident !== gravada && (
                        <button type="button" onClick={() => { setIdentidade(ident); campo.current?.focus(); }} style={botaoLinha()}>Usar esta identidade</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <NxDialog open={aberto} onClose={fechar} label="Confirmar" width={400}>
        <div style={col(10)}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{d.pergunta}</span>
          <span style={{ fontSize: 14, color: NX.mudo, overflowWrap: 'anywhere' }}>{d.efeito}</span>
          <NxDialogButtons onCancel={fechar} onConfirm={d.onConfirm} confirmLabel={d.confirmar} busy={busy} marginTop={8} />
        </div>
      </NxDialog>
    </>
  );
}
