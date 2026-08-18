import { useCallback, useEffect, useState } from 'react';
import { FileText, Eye, Loader2, AlertCircle, CheckCircle2, Power, AlertTriangle, Send } from 'lucide-react';
import { api } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const unwrap = (r: any) => r?.data?.data ?? r?.data;

interface Unidade { id: string; nome: string; provedor?: string }
interface Grupo { jid: string; nome: string; participantes: number }
interface Config {
  ativo: boolean; dia_semana: number; horario: string;
  grupo_jid: string | null; enviar_grupo: boolean; enviar_individual: boolean; ultimo_envio: string | null;
}
interface Alvo { destino: string; tipo: string; nome?: string; status: string; texto?: string; erro?: string }

const DIAS = [
  { v: 1, n: 'Segunda' }, { v: 2, n: 'Terça' }, { v: 3, n: 'Quarta' }, { v: 4, n: 'Quinta' },
  { v: 5, n: 'Sexta' }, { v: 6, n: 'Sábado' }, { v: 7, n: 'Domingo' },
];

export function BoletimSemanalFvPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [data, setData] = useState('');
  const [carregando, setCarregando] = useState<'pdf' | 'html' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [html, setHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [cfg, setCfg] = useState<Config | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [alvos, setAlvos] = useState<Alvo[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([
        api.get('/monitoramento-fv/notificacao/envio/unidades'),
        api.get('/relatorios/semanal/config'),
      ]);
      setUnidades(unwrap(u) ?? []);
      setCfg(unwrap(c));
      api.get('/monitoramento-fv/notificacao/envio/grupos').then((g) => setGrupos(unwrap(g) ?? [])).catch(() => setGrupos([]));
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao carregar');
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Render inline na tela (igual o de consumo): busca o HTML da semana anterior da usina selecionada.
  useEffect(() => {
    if (!unidadeId) { setHtml(''); return; }
    setPreviewLoading(true); setErro(null); setHtml('');
    const qs = new URLSearchParams({ unidadeId, formato: 'html' });
    if (data) qs.set('data', data);
    api.get(`/relatorios/semanal/preview?${qs.toString()}`, { responseType: 'text' })
      .then((r) => setHtml(typeof r.data === 'string' ? r.data : ''))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao gerar o boletim desta usina.'))
      .finally(() => setPreviewLoading(false));
  }, [unidadeId, data]);

  const abrir = async (formato: 'pdf' | 'html') => {
    if (!unidadeId) { setErro('Selecione uma usina'); return; }
    setErro(null); setCarregando(formato);
    try {
      const qs = new URLSearchParams({ unidadeId, formato });
      if (data) qs.set('data', data);
      const r = await api.get(`/relatorios/semanal/preview?${qs.toString()}`, { responseType: 'blob' });
      const blob = new Blob([r.data], { type: formato === 'pdf' ? 'application/pdf' : 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      let msg = 'Falha ao gerar o boletim';
      try { const txt = e?.response?.data && (await e.response.data.text?.()); if (txt) msg = JSON.parse(txt)?.message || msg; } catch { /* */ }
      setErro(msg);
    } finally { setCarregando(null); }
  };

  const salvarConfig = async (patch: Partial<Config>) => {
    try {
      const r = await api.put('/relatorios/semanal/config', patch);
      setCfg(unwrap(r));
      setStatus({ tipo: 'ok', msg: 'Configuração salva.' });
    } catch (e: any) {
      setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha ao salvar' });
    }
  };

  const toggleAtivo = async () => {
    if (!cfg) return;
    if (!cfg.ativo) {
      const ok = confirm('ATENÇÃO: ativar liga o ENVIO REAL do boletim semanal por WhatsApp no dia/horário configurado. Confirmar?');
      if (!ok) return;
    }
    await salvarConfig({ ativo: !cfg.ativo });
  };

  const preview = async () => {
    setAlvos(null);
    try {
      const r = await api.post('/relatorios/semanal/disparar?dryRun=true');
      setAlvos(unwrap(r)?.alvos ?? []);
    } catch (e: any) { setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha no preview' }); }
  };

  const enviarReal = async () => {
    const ok = confirm('ENVIO REAL: vai disparar o boletim semanal AGORA (links do PDF) para o grupo e destinatários ativos. NÃO tem desfazer. Confirmar?');
    if (!ok) return;
    setEnviando(true);
    try {
      const r = await api.post('/relatorios/semanal/disparar?dryRun=false');
      const res = unwrap(r);
      setAlvos(res?.alvos ?? []);
      const okN = (res?.alvos ?? []).filter((a: Alvo) => a.status === 'ok').length;
      setStatus({ tipo: 'ok', msg: `Envio concluído: ${okN} enviado(s).` });
    } catch (e: any) { setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha no envio' }); }
    finally { setEnviando(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Boletim semanal em <b>PDF</b> (A4, 1 página) da <b>semana anterior</b>. Campos sem dado são omitidos.
        O envio é o <b>link do PDF</b> por WhatsApp (a API só manda texto), reusando os destinatários da aba <b>Envio</b>.
      </p>

      {erro && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 p-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{erro}</span>
        </div>
      )}
      {status && (
        <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${status.tipo === 'ok' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-red-500/40 text-red-600 dark:text-red-400'}`}>
          {status.tipo === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}<span>{status.msg}</span>
        </div>
      )}

      {/* Preview por usina — render inline na tela (igual o de consumo) */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Usina</label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger><SelectValue placeholder="Selecionar usina" /></SelectTrigger>
                <SelectContent>{unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data de referência (opcional)</label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-[170px]" />
            </div>
            <Button variant="outline" onClick={() => abrir('pdf')} disabled={!!carregando || !unidadeId}>
              {carregando === 'pdf' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}Abrir PDF
            </Button>
            {previewLoading && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> gerando…
              </span>
            )}
          </div>

          {!unidadeId && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 opacity-50" />
              <p className="text-sm">Selecione uma usina para ver o boletim da semana anterior.</p>
            </div>
          )}
          {unidadeId && html && (
            <div style={{ overflowX: 'auto' }}>
              <iframe
                title="Boletim semanal"
                srcDoc={html}
                style={{ width: '820px', height: '1180px', border: 'none', background: '#fff', margin: '0 auto', display: 'block', boxShadow: '0 1px 8px rgba(0,0,0,.12)' }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config de envio */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Envio automático semanal</span>
              <Button size="sm" variant={cfg?.ativo ? 'default' : 'outline'} onClick={toggleAtivo}
                className={cfg?.ativo ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                <Power className="mr-1 h-3.5 w-3.5" />{cfg?.ativo ? 'Ativo' : 'Desativado'}
              </Button>
            </div>
            {cfg?.ultimo_envio && <span className="text-xs text-muted-foreground">Último envio: {cfg.ultimo_envio}</span>}
          </div>

          {!cfg?.ativo && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 p-2 text-xs text-amber-600 dark:text-amber-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Desligado: use o <b>Pré-visualizar</b> abaixo. Ao ativar, o envio real passa a ocorrer no dia/horário.</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Dia da semana</label>
              <Select value={String(cfg?.dia_semana ?? 1)} onValueChange={(v) => salvarConfig({ dia_semana: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DIAS.map((d) => <SelectItem key={d.v} value={String(d.v)}>{d.n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Horário (HH:MM, SP)</label>
              <Input value={cfg?.horario ?? ''} onChange={(e) => setCfg((p) => p && { ...p, horario: e.target.value })}
                onBlur={() => cfg && salvarConfig({ horario: cfg.horario })} placeholder="07:00" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Grupo destino ({grupos.length})</label>
              <Select value={cfg?.grupo_jid ?? ''} onValueChange={(v) => salvarConfig({ grupo_jid: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar grupo" /></SelectTrigger>
                <SelectContent>
                  {grupos.map((g) => <SelectItem key={g.jid} value={g.jid}>{g.nome} ({g.participantes})</SelectItem>)}
                  {cfg?.grupo_jid && !grupos.find((g) => g.jid === cfg.grupo_jid) && <SelectItem value={cfg.grupo_jid}>{cfg.grupo_jid} (atual)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="rounded" checked={cfg?.enviar_grupo ?? false} onChange={(e) => salvarConfig({ enviar_grupo: e.target.checked })} /> Enviar para o grupo
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="rounded" checked={cfg?.enviar_individual ?? false} onChange={(e) => salvarConfig({ enviar_individual: e.target.checked })} /> Enviar individual (por dono)
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button size="sm" variant="outline" onClick={preview}><Eye className="mr-1 h-3.5 w-3.5" />Pré-visualizar envio (dry-run)</Button>
            <Button size="sm" variant="destructive" onClick={enviarReal} disabled={enviando}>
              <Send className="mr-1 h-3.5 w-3.5" />{enviando ? 'Enviando…' : 'Enviar agora (real)'}
            </Button>
          </div>

          {alvos && (
            <div className="space-y-2">
              {alvos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alvo (sem grupo/destinatários).</p>}
              {alvos.map((a, i) => (
                <div key={i} className="rounded-md border p-2">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 ${a.status === 'ok' ? 'bg-emerald-500/15 text-emerald-600' : a.status === 'erro' ? 'bg-red-500/15 text-red-600' : a.status === 'sem_dados' ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'}`}>{a.status}</span>
                    <span className="font-medium">{a.tipo === 'grupo' ? '📣 Grupo' : `👤 ${a.nome ?? ''}`}</span>
                    <span className="text-muted-foreground">{a.destino}</span>
                  </div>
                  {a.erro && <p className="text-xs text-red-600">{a.erro}</p>}
                  {a.texto && <pre className="whitespace-pre-wrap rounded bg-muted/50 p-2 font-sans text-xs">{a.texto}</pre>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BoletimSemanalFvPage;
