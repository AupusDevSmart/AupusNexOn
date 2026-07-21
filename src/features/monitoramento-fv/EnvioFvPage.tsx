import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Send, Eye, AlertCircle, CheckCircle2, Power, AlertTriangle } from 'lucide-react';
import { api } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// A API responde { data: <payload> }. NAO descer um nivel a mais: o payload do
// disparo tem um campo `data` (a data do boletim, string), e a busca gulosa de 3
// niveis devolvia essa string em vez do resultado — zerando os alvos em silencio.
const unwrap = (r: any) => r?.data?.data ?? r?.data;

interface EnvioConfig {
  ativo: boolean;
  horario: string;
  grupo_jid: string | null;
  enviar_grupo: boolean;
  enviar_individual: boolean;
  ultimo_envio_data: string | null;
}
interface Grupo { jid: string; nome: string; participantes: number }
interface Unidade { id: string; nome: string; provedor?: string; sync_ativo?: boolean }
interface Destinatario {
  id: string; unidade_id: string | null; unidade_nome: string | null;
  nome: string; telefone: string; ativo: boolean;
}
interface Alvo { destino: string; tipo: string; nome?: string; status: string; texto?: string; erro?: string }

const hojeSP = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function EnvioFvPage() {
  const [cfg, setCfg] = useState<EnvioConfig | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [dests, setDests] = useState<Destinatario[]>([]);
  const [status, setStatus] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // input de "adicionar número" por usina (keyed por unidade_id)
  const [novoPorUsina, setNovoPorUsina] = useState<Record<string, { nome: string; telefone: string }>>({});
  const inputUsina = (uid: string) => novoPorUsina[uid] ?? { nome: '', telefone: '' };
  const setInputUsina = (uid: string, patch: Partial<{ nome: string; telefone: string }>) =>
    setNovoPorUsina((p) => ({ ...p, [uid]: { ...inputUsina(uid), ...patch } }));

  // preview
  const [data, setData] = useState(hojeSP());
  const [alvos, setAlvos] = useState<Alvo[] | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [c, u, d] = await Promise.all([
        api.get('/monitoramento-fv/notificacao/envio/config'),
        api.get('/monitoramento-fv/notificacao/envio/unidades'),
        api.get('/monitoramento-fv/notificacao/envio/destinatarios'),
      ]);
      setCfg(unwrap(c));
      setUnidades(unwrap(u) ?? []);
      setDests(unwrap(d) ?? []);
      // grupos podem falhar (API wpp fora) — não bloqueia a tela
      api.get('/monitoramento-fv/notificacao/envio/grupos')
        .then((g) => setGrupos(unwrap(g) ?? [])).catch(() => setGrupos([]));
    } catch (e: any) {
      setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha ao carregar' });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvarConfig = async (patch: Partial<EnvioConfig>) => {
    try {
      const r = await api.put('/monitoramento-fv/notificacao/envio/config', patch);
      setCfg(unwrap(r));
      setStatus({ tipo: 'ok', msg: 'Configuração salva.' });
    } catch (e: any) {
      setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha ao salvar' });
    }
  };

  const toggleAtivo = async () => {
    if (!cfg) return;
    if (!cfg.ativo) {
      const ok = confirm(
        'ATENÇÃO: ativar liga o ENVIO REAL de WhatsApp no horário configurado, para o grupo e destinatários. Confirmar?',
      );
      if (!ok) return;
    }
    await salvarConfig({ ativo: !cfg.ativo });
  };

  const addDestinatario = async (unidadeId: string) => {
    const inp = inputUsina(unidadeId);
    if (!inp.nome.trim() || !inp.telefone.trim()) { setStatus({ tipo: 'erro', msg: 'Nome e número obrigatórios' }); return; }
    try {
      await api.post('/monitoramento-fv/notificacao/envio/destinatarios', {
        unidade_id: unidadeId, nome: inp.nome.trim(), telefone: inp.telefone.trim(), ativo: true,
      });
      setNovoPorUsina((p) => ({ ...p, [unidadeId]: { nome: '', telefone: '' } }));
      setStatus({ tipo: 'ok', msg: 'Número adicionado.' });
      await carregar();
    } catch (e: any) { setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha ao adicionar' }); }
  };

  const removerDest = async (d: Destinatario) => {
    if (!confirm(`Remover ${d.nome} (${d.telefone})?`)) return;
    await api.delete(`/monitoramento-fv/notificacao/envio/destinatarios/${d.id}`);
    await carregar();
  };

  const preview = async () => {
    setAlvos(null);
    try {
      const r = await api.post(`/monitoramento-fv/notificacao/envio/disparar?dryRun=true&data=${data}`);
      setAlvos(unwrap(r)?.alvos ?? []);
    } catch (e: any) { setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha no preview' }); }
  };

  const enviarReal = async () => {
    const ok = confirm(
      `ENVIO REAL: vai disparar o boletim de ${data} AGORA para o grupo e todos os destinatários ativos. Esta ação NÃO tem desfazer. Confirmar?`,
    );
    if (!ok) return;
    setEnviando(true);
    try {
      const r = await api.post(`/monitoramento-fv/notificacao/envio/disparar?dryRun=false&data=${data}`);
      const res = unwrap(r);
      setAlvos(res?.alvos ?? []);
      const okN = (res?.alvos ?? []).filter((a: Alvo) => a.status === 'ok').length;
      setStatus({ tipo: 'ok', msg: `Envio concluído: ${okN} enviado(s).` });
    } catch (e: any) { setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha no envio' }); }
    finally { setEnviando(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Envio do boletim diário de geração por WhatsApp (grupo + individual por dono). Os dados são os já
        consolidados no NexON. Enquanto <b>Ativo</b> estiver desligado, nada é enviado automaticamente.
      </p>

      {status && (
        <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${status.tipo === 'ok' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-red-500/40 text-red-600 dark:text-red-400'}`}>
          {status.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}<span>{status.msg}</span>
        </div>
      )}

      {/* Config */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Envio automático</span>
              <Button size="sm" variant={cfg?.ativo ? 'default' : 'outline'} onClick={toggleAtivo}
                className={cfg?.ativo ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                <Power className="h-3.5 w-3.5 mr-1" />{cfg?.ativo ? 'Ativo' : 'Desativado'}
              </Button>
            </div>
            {cfg?.ultimo_envio_data && <span className="text-xs text-muted-foreground">Último envio: {cfg.ultimo_envio_data}</span>}
          </div>

          {!cfg?.ativo && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 text-amber-600 dark:text-amber-500 p-2 text-xs">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Desligado: use o <b>Pré-visualizar</b> abaixo para revisar. Ao ativar, o envio real passa a ocorrer todo dia no horário.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Horário (HH:MM, SP)</label>
              <Input value={cfg?.horario ?? ''} onChange={(e) => setCfg((p) => p && { ...p, horario: e.target.value })}
                onBlur={() => cfg && salvarConfig({ horario: cfg.horario })} placeholder="21:05" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Grupo destino ({grupos.length} disponíveis)</label>
              <Select value={cfg?.grupo_jid ?? ''} onValueChange={(v) => salvarConfig({ grupo_jid: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar grupo" /></SelectTrigger>
                <SelectContent>
                  {grupos.map((g) => <SelectItem key={g.jid} value={g.jid}>{g.nome} ({g.participantes})</SelectItem>)}
                  {cfg?.grupo_jid && !grupos.find((g) => g.jid === cfg.grupo_jid) && (
                    <SelectItem value={cfg.grupo_jid}>{cfg.grupo_jid} (atual)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={cfg?.enviar_grupo ?? false}
                onChange={(e) => salvarConfig({ enviar_grupo: e.target.checked })} /> Enviar para o grupo
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={cfg?.enviar_individual ?? false}
                onChange={(e) => salvarConfig({ enviar_individual: e.target.checked })} /> Enviar individual (por dono)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Destinatários por usina */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-medium">Destinatários por usina (envio individual)</h3>
          <p className="text-xs text-muted-foreground">
            Cada usina envia só para os números listados. <b>Usina sem número não recebe.</b> Pode adicionar
            mais de um por usina. Só aparecem as usinas cadastradas no sync — o que não está em nenhuma API não tem geração pra enviar.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">Usina</TableHead>
                <TableHead>Números</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unidades.length === 0 && <TableRow><TableCell colSpan={2} className="text-sm text-muted-foreground">Nenhuma usina cadastrada no sync.</TableCell></TableRow>}
              {unidades.map((u) => {
                const nums = dests.filter((d) => d.unidade_id === u.id);
                const inp = inputUsina(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="align-top">
                      <div className="font-medium">{u.nome}</div>
                      {u.provedor && <div className="text-[11px] text-muted-foreground">{u.provedor}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        {nums.length === 0 && <span className="text-xs text-muted-foreground">— não recebe —</span>}
                        {nums.map((d) => (
                          <div key={d.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{d.nome}</span>
                            <span className="text-muted-foreground">{d.telefone}</span>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removerDest(d)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Input value={inp.nome} onChange={(e) => setInputUsina(u.id, { nome: e.target.value })}
                            placeholder="Nome" className="h-8 w-[140px]" />
                          <Input value={inp.telefone} onChange={(e) => setInputUsina(u.id, { telefone: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && addDestinatario(u.id)}
                            placeholder="(62) 99999-9999" className="h-8 w-[170px]" />
                          <Button size="sm" className="h-8" onClick={() => addDestinatario(u.id)}>
                            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview / envio manual */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data do boletim</label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-[160px]" />
            </div>
            <Button size="sm" variant="outline" onClick={preview}><Eye className="h-3.5 w-3.5 mr-1" />Pré-visualizar (dry-run)</Button>
            <Button size="sm" variant="destructive" onClick={enviarReal} disabled={enviando}>
              <Send className="h-3.5 w-3.5 mr-1" />{enviando ? 'Enviando…' : 'Enviar agora (real)'}
            </Button>
          </div>

          {alvos && (
            <div className="space-y-2">
              {alvos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alvo (sem grupo/destinatários ou sem dados no dia).</p>}
              {alvos.map((a, i) => (
                <div key={i} className="rounded-md border p-2">
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className={`px-1.5 py-0.5 rounded ${a.status === 'ok' ? 'bg-emerald-500/15 text-emerald-600' : a.status === 'erro' ? 'bg-red-500/15 text-red-600' : a.status === 'sem_dados' ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'}`}>{a.status}</span>
                    <span className="font-medium">{a.tipo === 'grupo' ? '📣 Grupo' : `👤 ${a.nome ?? ''}`}</span>
                    <span className="text-muted-foreground">{a.destino}</span>
                  </div>
                  {a.erro && <p className="text-xs text-red-600">{a.erro}</p>}
                  {a.texto && <pre className="text-xs whitespace-pre-wrap font-sans bg-muted/50 rounded p-2">{a.texto}</pre>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EnvioFvPage;
