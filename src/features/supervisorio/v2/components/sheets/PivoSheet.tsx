import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { SheetShell, EstadoHero, GrupoTitulo, Section, FasesTable, useDados, getPath, fmt, tsInfo, BadgeFrescor } from './sheetParts';

/**
 * Sheet do Pivô de irrigação — operação em SEQUÊNCIA com o bombeamento
 * (docs/IOT-PIVO-BOMBEAMENTO.md). O bombeamento é funcionalidade do pivô: fica na
 * aba Configuração (TON da bomba, modo, BOs, BI). Um clique em "Girar ←/→" faz o
 * backend ligar a bomba, confirmar, esperar a pressurização e só então girar o pivô;
 * "Desligar" para o pivô e desliga a bomba se nenhum outro pivô dela estiver girando.
 */

type Bin = 0 | 1 | null;
interface Passo { t: string; etapa: string; msg: string; ok: boolean | null }
interface Estado {
  pivo: { comandos: { direita: boolean; esquerda: boolean; desligar: boolean }; status: { direita: Bin; esquerda: Bin; desligado: Bin; erro: Bin } };
  bombeamento: null | {
    ton_id: string; ton_nome: string | null; ton_removida: boolean; modo: 'pulso' | 'mantido';
    bo_liga: number; bo_desliga?: number | null; bi_confirma?: number | null; confirma_s?: number; pulso_ms?: number;
    ligada: Bin; compartilhada_com: string[];
  };
  sequencia_cfg: { pressurizacao_s: number; confirma_giro_s: number };
  sequencia: null | { id: string; acao: string; status: string; passos: Passo[]; erro: string | null; created_at: string; finished_at: string | null };
}

/** Resposta da API vem com envelope simples ou duplo ({data:{data}}). */
const corpo = (r: any) => {
  const d = r?.data?.data ?? r?.data;
  return d && typeof d === 'object' && 'data' in d && Object.keys(d).length <= 3 ? d.data : d;
};
const erroMsg = (e: any) => e?.response?.data?.message ?? e?.response?.data?.data?.message ?? e?.message ?? 'Falha';
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const ACAO_LABEL: Record<string, string> = { girar_direita: 'Girar à direita', girar_esquerda: 'Girar à esquerda', desligar: 'Desligar' };

function usePivoEstado(id: string) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() =>
    api.get(`/pivos/${id}/estado`).then((r) => { setEstado(corpo(r)); setErro(null); }).catch((e) => setErro(erroMsg(e))), [id]);
  const executando = estado?.sequencia?.status === 'executando';
  useEffect(() => {
    void carregar();
    const t = setInterval(carregar, executando ? 1500 : 10000);
    return () => clearInterval(t);
  }, [carregar, executando]);
  return { estado, erro, carregar, executando };
}

export function PivoSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const id = equipamentoId.trim();
  const { dados, ts } = useDados(id);
  const { estado, erro, carregar, executando } = usePivoEstado(id);
  const [aba, setAba] = useState('op');
  const [ff, setFf] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);

  const g = (p: string) => getPath(dados, p);
  const num = (...ps: string[]) => { for (const p of ps) { const v = g(p); if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v); } return null; };
  const info = tsInfo(ts);
  const pt = num('Pt', 'power.active_total');

  const st = estado?.pivo.status;
  const b = estado?.bombeamento;
  const seq = estado?.sequencia;
  const hero = (() => {
    if (executando) return { label: seq?.acao === 'desligar' ? 'Desligando…' : 'Partindo…', tone: 'warn' as const };
    if (st?.erro === 1) return { label: 'Erro no pivô', tone: 'warn' as const };
    if (st?.direita === 1) return { label: 'Girando à direita', tone: 'ok' as const };
    if (st?.esquerda === 1) return { label: 'Girando à esquerda', tone: 'ok' as const };
    if (st?.desligado === 1 || st?.direita === 0 || st?.esquerda === 0) return { label: 'Desligado', tone: 'off' as const };
    return { label: 'Sem status do pivô', tone: 'off' as const };
  })();

  const acionar = async (acao: 'girar_direita' | 'girar_esquerda' | 'desligar') => {
    setEnviando(acao);
    try {
      await api.post(`/pivos/${id}/acionar`, { acao });
      toast.success(`${ACAO_LABEL[acao]}: sequência iniciada`, { description: 'Acompanhe os passos abaixo.' });
      await carregar();
    } catch (e) {
      toast.error(`${ACAO_LABEL[acao]}: não iniciou`, { description: String(erroMsg(e)) });
    } finally {
      setEnviando(null);
    }
  };

  const fasesFN: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['A', `${fmt(num('Va'), 0)} V`, `${fmt(num('Ia'), 1)} A`],
    ['B', `${fmt(num('Vb'), 0)} V`, `${fmt(num('Ib'), 1)} A`],
    ['C', `${fmt(num('Vc'), 0)} V`, `${fmt(num('Ic'), 1)} A`],
  ];
  const binTxt = (v: Bin, sim: string, nao: string) => (v == null ? '—' : v ? sim : nao);

  return (
    <SheetShell
      title={nome || 'Pivô'}
      subtitle={info.hasTs ? info.label : undefined}
      badge={<BadgeFrescor info={info} />}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      activeTab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'cfg' ? (
        <ConfigBombeamento pivoId={id} estado={estado} onSalvo={carregar} />
      ) : (
        <>
          <GrupoTitulo>Estado</GrupoTitulo>
          <EstadoHero label={hero.label} tone={hero.tone} />
          {erro && <p className="text-[11px] text-amber-600 mt-1.5">{erro}</p>}
          <div className="mt-2">
            <Section rows={[
              { k: 'Bombeamento', v: !b ? 'Não configurado' : binTxt(b.ligada, 'Ligado', 'Desligado'), mute: !b },
              ...(b ? [{ k: 'TON da bomba', v: `${b.ton_nome ?? '—'}${b.ton_removida ? ' (removida!)' : ''}`, mute: true }] : []),
              ...(b && b.compartilhada_com.length ? [{ k: 'Bomba compartilhada com', v: b.compartilhada_com.join(', '), mute: true }] : []),
              { k: 'Erro no painel', v: binTxt(st?.erro ?? null, 'Sim', 'Não') },
            ]} />
          </div>

          <GrupoTitulo>Controles</GrupoTitulo>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-50"
              style={{ background: '#177A3C' }}
              disabled={!!enviando || executando || !estado?.pivo.comandos.esquerda}
              onClick={() => acionar('girar_esquerda')}
            >↺ Esquerda</button>
            <button
              type="button"
              className="flex-1 py-2.5 rounded-lg border font-semibold text-sm disabled:opacity-50"
              disabled={!!enviando || (!estado?.pivo.comandos.desligar && !b)}
              onClick={() => acionar('desligar')}
            >Desligar</button>
            <button
              type="button"
              className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-50"
              style={{ background: '#177A3C' }}
              disabled={!!enviando || executando || !estado?.pivo.comandos.direita}
              onClick={() => acionar('girar_direita')}
            >Direita ↻</button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {b
              ? `Girar liga a bomba (${b.ton_nome ?? 'TON'}), confirma, espera ${estado?.sequencia_cfg.pressurizacao_s ?? 120}s de pressurização e gira o pivô. Desligar para o pivô e desliga a bomba se nenhum outro pivô dela estiver girando.`
              : 'Sem bombeamento configurado: os botões só comandam o pivô. Configure a bomba na aba Configuração.'}
          </p>

          {seq && (
            <>
              <GrupoTitulo right={<span className="text-[11px] text-muted-foreground">{hora(seq.created_at)}</span>}>
                Última sequência · {ACAO_LABEL[seq.acao] ?? seq.acao}
              </GrupoTitulo>
              <div className="rounded-lg border divide-y">
                {(seq.passos ?? []).map((p, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                    <span className={`mt-0.5 ${p.ok === true ? 'text-emerald-600' : p.ok === false ? 'text-red-600' : 'text-amber-600'}`}>
                      {p.ok === true ? '✓' : p.ok === false ? '✕' : '•'}
                    </span>
                    <span className="flex-1">{p.msg}</span>
                    <span className="text-muted-foreground tabular-nums">{hora(p.t)}</span>
                  </div>
                ))}
                <div className="px-3 py-1.5 text-xs font-medium">
                  {seq.status === 'executando' ? 'Em andamento…'
                    : seq.status === 'concluida' ? 'Concluída'
                    : seq.status === 'interrompida' ? 'Interrompida'
                    : `Falhou${seq.erro ? `: ${seq.erro}` : ''}`}
                </div>
              </div>
            </>
          )}

          <GrupoTitulo right={
            <button type="button" onClick={() => setFf((v) => !v)} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">{ff ? 'FF' : 'FN'}</button>
          }>Energia</GrupoTitulo>
          <FasesTable head={['Fase', 'Tensão', 'Corrente']} rows={fasesFN} />
          <div className="mt-2">
            <Section rows={[{ k: 'Potência', v: `${fmt(pt != null ? pt / (pt > 1000 ? 1000 : 1) : null)} kW` }]} />
          </div>
        </>
      )}
    </SheetShell>
  );
}

// ---------------------------------------------------------------------------
// Configuração do bombeamento (funcionalidade do pivô)
// ---------------------------------------------------------------------------
interface Opcoes {
  tons: Array<{ id: string; nome: string; topico: string | null; unidade: string }>;
  bombeamentos: Array<{ pivo_id: string; nome: string; bombeamento: any }>;
}

function Campo({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {sub && <span className="block text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      {children}
    </label>
  );
}
const inputCls = 'w-24 rounded-md border bg-background px-2 py-1 text-sm text-right tabular-nums';

function ConfigBombeamento({ pivoId, estado, onSalvo }: { pivoId: string; estado: Estado | null; onSalvo: () => void }) {
  const [op, setOp] = useState<Opcoes | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [f, setF] = useState<any>({ modo: 'pulso', bo_liga: 1, bo_desliga: 2, bi_confirma: 1, confirma_s: 30, pulso_ms: 1000, ton_id: '' });
  const [seq, setSeq] = useState({ pressurizacao_s: 120, confirma_giro_s: 30 });
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    api.get(`/pivos/${pivoId}/bombeamento/opcoes`).then((r) => setOp(corpo(r))).catch(() => setOp({ tons: [], bombeamentos: [] }));
  }, [pivoId]);
  useEffect(() => {
    if (!estado || carregado) return;
    const b = estado.bombeamento;
    setAtivo(!!b);
    if (b) setF({ ton_id: b.ton_id, modo: b.modo, bo_liga: b.bo_liga, bo_desliga: b.bo_desliga ?? '', bi_confirma: b.bi_confirma ?? '', confirma_s: b.confirma_s ?? 30, pulso_ms: b.pulso_ms ?? 1000 });
    setSeq(estado.sequencia_cfg);
    setCarregado(true);
  }, [estado, carregado]);

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const copiarDe = (pid: string) => {
    const o = op?.bombeamentos.find((x) => x.pivo_id === pid)?.bombeamento;
    if (!o) return;
    setAtivo(true);
    setF({ ton_id: o.ton_id, modo: o.modo, bo_liga: o.bo_liga, bo_desliga: o.bo_desliga ?? '', bi_confirma: o.bi_confirma ?? '', confirma_s: o.confirma_s ?? 30, pulso_ms: o.pulso_ms ?? 1000 });
    toast.info('Bombeamento copiado — os dois pivôs vão dividir a bomba. Salve para aplicar.');
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/pivos/${pivoId}/bombeamento`, {
        bombeamento: ativo ? { ...f, ativo: true } : null,
        sequencia: seq,
      });
      toast.success('Configuração do pivô salva');
      onSalvo();
    } catch (e) {
      toast.error('Não salvou', { description: String(erroMsg(e)) });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <GrupoTitulo>Bombeamento</GrupoTitulo>
      <div className="space-y-2">
        <Campo label="Este pivô tem bombeamento" sub="A bomba fica em outra TON; o NexON liga ela antes de girar">
          <input type="checkbox" className="h-4 w-4" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        </Campo>
        {ativo && (
          <>
            {op && op.bombeamentos.length > 0 && (
              <Campo label="Usar a bomba de outro pivô" sub="Mesma TON e BO = bomba compartilhada">
                <select className="rounded-md border bg-background px-2 py-1 text-sm" value="" onChange={(e) => copiarDe(e.target.value)}>
                  <option value="">—</option>
                  {op.bombeamentos.map((x) => <option key={x.pivo_id} value={x.pivo_id}>{x.nome}</option>)}
                </select>
              </Campo>
            )}
            <Campo label="TON da bomba">
              <select className="max-w-[12rem] rounded-md border bg-background px-2 py-1 text-sm" value={f.ton_id} onChange={(e) => set('ton_id', e.target.value)}>
                <option value="">Escolha…</option>
                {(op?.tons ?? []).map((t) => <option key={t.id} value={t.id}>{t.nome} · {t.unidade}</option>)}
              </select>
            </Campo>
            <Campo label="Acionamento" sub={f.modo === 'pulso' ? 'Pulso liga, outro pulso desliga (selo/soft-starter)' : 'A TON segura o relé; soltar desliga'}>
              <select className="rounded-md border bg-background px-2 py-1 text-sm" value={f.modo} onChange={(e) => set('modo', e.target.value)}>
                <option value="pulso">Pulso</option>
                <option value="mantido">Contato mantido</option>
              </select>
            </Campo>
            <Campo label="BO de ligar"><input className={inputCls} type="number" min={1} max={16} value={f.bo_liga} onChange={(e) => set('bo_liga', e.target.value)} /></Campo>
            {f.modo === 'pulso' && (
              <>
                <Campo label="BO de desligar"><input className={inputCls} type="number" min={1} max={16} value={f.bo_desliga} onChange={(e) => set('bo_desliga', e.target.value)} /></Campo>
                <Campo label="Duração do pulso" sub="ms"><input className={inputCls} type="number" min={100} max={10000} step={100} value={f.pulso_ms} onChange={(e) => set('pulso_ms', e.target.value)} /></Campo>
              </>
            )}
            <Campo label="BI de confirmação" sub="Retorno 'bomba ligada' na TON da bomba (vazio = sem confirmação)">
              <input className={inputCls} type="number" min={1} max={16} value={f.bi_confirma} onChange={(e) => set('bi_confirma', e.target.value)} />
            </Campo>
            <Campo label="Tempo para confirmar a bomba" sub="s"><input className={inputCls} type="number" min={5} max={300} value={f.confirma_s} onChange={(e) => set('confirma_s', e.target.value)} /></Campo>
          </>
        )}
      </div>

      <GrupoTitulo>Partida</GrupoTitulo>
      <div className="space-y-2">
        <Campo label="Pressurização" sub="Espera entre a bomba ligar e o pivô girar (s)">
          <input className={inputCls} type="number" min={0} max={900} value={seq.pressurizacao_s} onChange={(e) => setSeq((s) => ({ ...s, pressurizacao_s: Number(e.target.value) }))} />
        </Campo>
        <Campo label="Confirmação do giro" sub="Tempo para o status 'girando' aparecer (s)">
          <input className={inputCls} type="number" min={5} max={300} value={seq.confirma_giro_s} onChange={(e) => setSeq((s) => ({ ...s, confirma_giro_s: Number(e.target.value) }))} />
        </Campo>
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={salvando || (ativo && !f.ton_id)}
        className="mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: '#177A3C' }}
      >{salvando ? 'Salvando…' : 'Salvar'}</button>
      <p className="text-[11px] text-muted-foreground mt-2">
        Os comandos do pivô (Girar direita/esquerda, Desligar) e os status (Girando, Desligado, Erro) vêm dos pontos do pivô ligados às BO/BI da TON do pivô (editor IoT → TON → Configurar BOs/BIs).
      </p>
    </>
  );
}

export default PivoSheet;
