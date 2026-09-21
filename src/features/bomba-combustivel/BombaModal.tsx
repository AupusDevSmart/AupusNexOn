import { useCallback, useEffect, useState } from 'react';
import { Loader2, Fuel, Trash2, Plus, Send, RefreshCw } from 'lucide-react';
import { api } from '@/config/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const unwrap = (r: any) => r?.data?.data ?? r?.data;

interface Bomba { id: string; nome: string; unidade_nome?: string }

/** Estados da máquina de estados da TON (lib bomba_posto) → rótulo/cor. */
const ESTADOS: Record<string, { label: string; cls: string }> = {
  ociosa: { label: 'Ociosa', cls: 'bg-slate-500' },
  aguardando_matricula: { label: 'Aguardando matrícula', cls: 'bg-sky-600' },
  validando: { label: 'Validando', cls: 'bg-sky-600' },
  partindo: { label: 'Partindo', cls: 'bg-amber-600' },
  abastecendo: { label: 'Abastecendo', cls: 'bg-emerald-600' },
  encerrando: { label: 'Encerrando', cls: 'bg-amber-600' },
  bloqueada: { label: 'Bloqueada', cls: 'bg-red-600' },
  manual: { label: 'Manual', cls: 'bg-orange-600' },
  // legado (firmware antigo)
  bombeando: { label: 'Bombeando', cls: 'bg-emerald-600' },
  idle: { label: 'Ociosa', cls: 'bg-slate-500' },
};
function badgeEstado(estado?: string) {
  const e = ESTADOS[String(estado || '').toLowerCase()];
  if (!e) return <Badge variant="outline">Desconhecido</Badge>;
  return <Badge className={e.cls}>{e.label}</Badge>;
}
const MOTIVOS: Record<string, string> = {
  concluido: 'Concluído (bico devolvido)', fluxo_parado: 'Fluxo parado', emergencia: 'Emergência', timeout: 'Tempo máximo',
  limite: 'Limite de litros', nivel_baixo: 'Nível baixo', manual: 'Manual', contator_colado: 'Contator colado',
  contator_caiu: 'Contator caiu', queda_energia: 'Queda de energia', rejeitado: 'Rejeitado',
  tag: 'Tag não cadastrada', matricula: 'Matrícula não cadastrada', par: 'Par tag/matrícula não permitido',
  timeout_matricula: 'Matrícula não digitada', bloqueada: 'Bomba bloqueada', ocupado: 'Bomba ocupada',
  inicializando: 'Inicializando', limite_diario: 'Limite diário atingido', sem_confirmacao_bi1: 'K1 não confirmou',
  contator_fechou_sem_comando: 'Contator fechou sem comando', chave: 'Chave em Manual', negado: 'Negado',
};
const motivo = (m?: string) => (m ? (MOTIVOS[m] ?? m) : '—');
const simNao = (v: any) => (v === 1 || v === true ? 'sim' : v === 0 || v === false ? 'não' : '—');

export function BombaModal({ bomba, open, onOpenChange }: { bomba: Bomba | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [estado, setEstado] = useState<any>(null);
  const [rfids, setRfids] = useState<any[]>([]);
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [novo, setNovo] = useState({ uid: '', maquina_nome: '', matriculas: '', limite_litros_dia: '' });
  const [novoOp, setNovoOp] = useState({ matricula: '', nome: '' });

  const id = bomba?.id;

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [e, r, o] = await Promise.all([
        api.get(`/bomba-combustivel/${id}/estado`),
        api.get(`/bomba-combustivel/rfid?bombaId=${encodeURIComponent(id)}`),
        api.get(`/bomba-combustivel/operadores?bombaId=${encodeURIComponent(id)}`).catch(() => ({ data: { data: [] } })),
      ]);
      setEstado(unwrap(e)); setRfids(unwrap(r) ?? []); setOps(unwrap(o) ?? []);
    } catch { /* */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (open) carregar(); }, [open, carregar]);
  // enquanto aberto, acompanha a telemetria (a TON publica a cada 30 s e a cada mudança de estado)
  useEffect(() => {
    if (!open) return;
    const t = setInterval(carregar, 10000);
    return () => clearInterval(t);
  }, [open, carregar]);

  const addRfid = async () => {
    if (!novo.uid.trim()) return;
    setMsg('');
    try {
      await api.post('/bomba-combustivel/rfid', { ...novo, uid: novo.uid.trim().toUpperCase(), bomba_id: id });
      setNovo({ uid: '', maquina_nome: '', matriculas: '', limite_litros_dia: '' });
      await carregar();
      setMsg('Máquina autorizada e lista sincronizada com a TON.');
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao adicionar'); }
  };
  const delRfid = async (rid: string) => {
    try { await api.delete(`/bomba-combustivel/rfid/${rid}`); await carregar(); } catch { /* */ }
  };
  const addOp = async () => {
    if (!novoOp.matricula.trim()) return;
    setMsg('');
    try {
      await api.post('/bomba-combustivel/operadores', { ...novoOp, matricula: novoOp.matricula.trim(), bomba_id: id });
      setNovoOp({ matricula: '', nome: '' });
      await carregar();
      setMsg('Operador cadastrado e lista sincronizada com a TON.');
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao cadastrar'); }
  };
  const delOp = async (oid: string) => {
    try { await api.delete(`/bomba-combustivel/operadores/${oid}`); await carregar(); } catch { /* */ }
  };
  const publicar = async () => {
    setMsg('');
    try {
      const r = await api.post(`/bomba-combustivel/${id}/whitelist/publicar`); const d = unwrap(r);
      setMsg(d?.enviado ? `Lista v${d.versao} enviada (${d.total} máquinas) em ${(d.topics || []).join(', ')}.` : 'Nenhuma TON amarrada a esta bomba (mapeie os BO na TON) — lista não enviada.');
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao publicar'); }
  };

  const tel = estado?.telemetria ?? null;
  const nivel = estado?.nivel_pct;
  const desatualizada = estado?.lista_versao_ton != null && estado?.lista_versao_nexon != null && Number(estado.lista_versao_ton) !== Number(estado.lista_versao_nexon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" /> {bomba?.nome ?? 'Bomba'}
            {estado && badgeEstado(estado.estado)}
            {tel?.online != null && <Badge variant={tel.online ? 'secondary' : 'destructive'}>{tel.online ? 'online' : 'offline'}</Badge>}
            <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={carregar} title="Atualizar">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {msg && <div className="rounded bg-muted p-2 text-xs text-muted-foreground">{msg}</div>}

        <Tabs defaultValue="visao">
          <TabsList>
            <TabsTrigger value="visao">Visão</TabsTrigger>
            <TabsTrigger value="rfid">Máquinas ({rfids.length})</TabsTrigger>
            <TabsTrigger value="ops">Operadores ({ops.length})</TabsTrigger>
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><div className="text-muted-foreground text-xs">Unidade</div>{bomba?.unidade_nome ?? '—'}</div>
              <div><div className="text-muted-foreground text-xs">Máquinas / operadores</div>{estado?.rfid_autorizados ?? 0} / {estado?.operadores ?? 0}</div>
              <div>
                <div className="text-muted-foreground text-xs">Lista na TON</div>
                {estado?.lista_versao_ton != null ? `v${estado.lista_versao_ton}` : '—'}
                {desatualizada && <span className="ml-1 text-xs text-amber-600">(NexON v{estado.lista_versao_nexon})</span>}
              </div>
              <div><div className="text-muted-foreground text-xs">Última leitura</div>{estado?.ultima_leitura ? String(estado.ultima_leitura).replace('T', ' ').slice(0, 16) : '—'}</div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Nível do tanque</span><span>{nivel != null && Number(nivel) >= 0 ? `${Number(nivel).toFixed(0)}%` : '—'}</span>
              </div>
              <Progress value={nivel != null ? Math.max(0, Number(nivel)) : 0} />
            </div>
            {tel && (
              <div className="grid grid-cols-2 gap-2 rounded border p-2 text-xs sm:grid-cols-4">
                <div><span className="text-muted-foreground">Contator (K1): </span>{simNao(tel.contator)}</div>
                <div><span className="text-muted-foreground">Chave Auto: </span>{simNao(tel.automatico)}</div>
                <div><span className="text-muted-foreground">Emergência: </span>{simNao(tel.emergencia)}</div>
                <div><span className="text-muted-foreground">Bico no suporte: </span>{simNao(tel.bico_no_suporte)}</div>
                <div><span className="text-muted-foreground">Boia mínimo: </span>{simNao(tel.boia_min)}</div>
                <div><span className="text-muted-foreground">Boia alta: </span>{simNao(tel.boia_alta)}</div>
                <div><span className="text-muted-foreground">Fluxo: </span>{tel.fluxo_lpm != null ? `${Number(tel.fluxo_lpm).toFixed(1)} L/min` : '—'}</div>
                <div><span className="text-muted-foreground">Litros (sessão): </span>{tel.litros != null ? Number(tel.litros).toFixed(2) : '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Sessão: </span>{tel.uid || '—'}{tel.matricula ? ` · mat. ${tel.matricula}` : ''}{tel.validacao && tel.validacao !== 'nenhuma' ? ` · ${tel.validacao}` : ''}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Bloqueio: </span>{tel.motivo_bloqueio ? motivo(tel.motivo_bloqueio) : '—'}{tel.ver ? <span className="ml-2 text-muted-foreground">fw {tel.ver}</span> : null}</div>
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Últimos abastecimentos</div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Quando</TableHead><TableHead>Máquina</TableHead><TableHead>Operador</TableHead><TableHead>Litros</TableHead><TableHead>Fim</TableHead><TableHead>Validação</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(estado?.ultimos_abastecimentos ?? []).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.inicio ?? a.created_at}</TableCell>
                      <TableCell>{a.maquina_nome ?? a.uid ?? '—'}</TableCell>
                      <TableCell>{a.operador_nome ?? a.matricula ?? '—'}</TableCell>
                      <TableCell>{a.litros != null ? Number(a.litros).toFixed(1) : '—'}</TableCell>
                      <TableCell className="text-xs">{motivo(a.fim_motivo ?? a.status)}</TableCell>
                      <TableCell className="text-xs">{a.validacao ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {(!estado?.ultimos_abastecimentos || estado.ultimos_abastecimentos.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">Sem abastecimentos ainda.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="rfid" className="space-y-3">
            <div className="text-xs text-muted-foreground">A tag identifica a <b>máquina</b>. "Matrículas" restringe quais operadores podem abastecer esta máquina (vazio = qualquer operador cadastrado). O limite é por dia e por máquina.</div>
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="UID da tag (ex.: PC-07)" value={novo.uid} onChange={(e) => setNovo((p) => ({ ...p, uid: e.target.value }))} className="w-[150px]" />
              <Input placeholder="Máquina" value={novo.maquina_nome} onChange={(e) => setNovo((p) => ({ ...p, maquina_nome: e.target.value }))} className="w-[150px]" />
              <Input placeholder="Matrículas (1234, 5678)" value={novo.matriculas} onChange={(e) => setNovo((p) => ({ ...p, matriculas: e.target.value }))} className="w-[170px]" />
              <Input placeholder="Limite L/dia" value={novo.limite_litros_dia} onChange={(e) => setNovo((p) => ({ ...p, limite_litros_dia: e.target.value }))} className="w-[110px]" />
              <Button size="sm" onClick={addRfid}><Plus className="mr-1 h-4 w-4" />Autorizar</Button>
              <Button size="sm" variant="outline" onClick={publicar} className="ml-auto"><Send className="mr-1 h-4 w-4" />Publicar lista na TON</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>UID</TableHead><TableHead>Máquina</TableHead><TableHead>Matrículas</TableHead><TableHead>Limite/dia</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {rfids.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.uid}</TableCell>
                    <TableCell>{r.maquina_nome ?? '—'}</TableCell>
                    <TableCell className="text-xs">{Array.isArray(r.matriculas) && r.matriculas.length ? r.matriculas.join(', ') : 'qualquer'}</TableCell>
                    <TableCell className="text-xs">{r.limite_litros_dia ? `${Number(r.limite_litros_dia)} L` : '—'}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delRfid(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {rfids.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Nenhuma máquina autorizada.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="ops" className="space-y-3">
            <div className="text-xs text-muted-foreground">A matrícula é digitada na IHM do posto (ou pelo comando <code>mat</code> na bancada). Sem operadores cadastrados, a TON aceita qualquer matrícula (compatibilidade).</div>
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Matrícula (ex.: 1234)" value={novoOp.matricula} onChange={(e) => setNovoOp((p) => ({ ...p, matricula: e.target.value }))} className="w-[150px]" />
              <Input placeholder="Nome do operador" value={novoOp.nome} onChange={(e) => setNovoOp((p) => ({ ...p, nome: e.target.value }))} className="w-[220px]" />
              <Button size="sm" onClick={addOp}><Plus className="mr-1 h-4 w-4" />Cadastrar</Button>
              <Button size="sm" variant="outline" onClick={publicar} className="ml-auto"><Send className="mr-1 h-4 w-4" />Publicar lista na TON</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Matrícula</TableHead><TableHead>Nome</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {ops.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.matricula}</TableCell>
                    <TableCell>{o.nome ?? '—'}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delOp(o.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {ops.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Nenhum operador cadastrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="eventos" className="space-y-2">
            <div className="text-xs text-muted-foreground">Negações, falhas de partida, contator colado, acionamento não autorizado, modo manual e rearmes publicados pela TON em <code>&lt;base&gt;/evento</code>.</div>
            <Table>
              <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead><TableHead>Tag</TableHead><TableHead>Matrícula</TableHead></TableRow></TableHeader>
              <TableBody>
                {(estado?.eventos ?? []).map((ev: any) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs">{ev.quando}</TableCell>
                    <TableCell className="text-xs">{ev.tipo}</TableCell>
                    <TableCell className="text-xs">{motivo(ev.motivo)}</TableCell>
                    <TableCell className="font-mono text-xs">{ev.uid || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{ev.matricula || '—'}</TableCell>
                  </TableRow>
                ))}
                {(!estado?.eventos || estado.eventos.length === 0) && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Sem eventos.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default BombaModal;
