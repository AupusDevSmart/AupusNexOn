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

function badgeEstado(estado?: string) {
  if (estado === 'bombeando') return <Badge className="bg-emerald-600">Bombeando</Badge>;
  if (estado === 'idle') return <Badge variant="secondary">Ociosa</Badge>;
  return <Badge variant="outline">Desconhecido</Badge>;
}

export function BombaModal({ bomba, open, onOpenChange }: { bomba: Bomba | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [estado, setEstado] = useState<any>(null);
  const [rfids, setRfids] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [novo, setNovo] = useState({ uid: '', maquina_nome: '', operador: '' });

  const id = bomba?.id;

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [e, r] = await Promise.all([
        api.get(`/bomba-combustivel/${id}/estado`),
        api.get(`/bomba-combustivel/rfid?bombaId=${encodeURIComponent(id)}`),
      ]);
      setEstado(unwrap(e)); setRfids(unwrap(r) ?? []);
    } catch { /* */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  const addRfid = async () => {
    if (!novo.uid.trim()) return;
    setMsg('');
    try {
      await api.post('/bomba-combustivel/rfid', { ...novo, uid: novo.uid.trim().toUpperCase(), bomba_id: id });
      setNovo({ uid: '', maquina_nome: '', operador: '' });
      await carregar();
      setMsg('Cartão adicionado e whitelist sincronizada.');
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao adicionar'); }
  };
  const delRfid = async (rid: string) => {
    try { await api.delete(`/bomba-combustivel/rfid/${rid}`); await carregar(); } catch { /* */ }
  };
  const publicar = async () => {
    setMsg('');
    try { const r = await api.post(`/bomba-combustivel/${id}/whitelist/publicar`); const d = unwrap(r); setMsg(d?.enviado ? `Whitelist enviada (${d.total} UIDs).` : 'Bomba sem tópico MQTT — não enviada.'); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao publicar'); }
  };
  const nivel = estado?.nivel_pct;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" /> {bomba?.nome ?? 'Bomba'}
            {estado && badgeEstado(estado.estado)}
            <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={carregar} title="Atualizar">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {msg && <div className="rounded bg-muted p-2 text-xs text-muted-foreground">{msg}</div>}

        <Tabs defaultValue="visao">
          <TabsList>
            <TabsTrigger value="visao">Visão</TabsTrigger>
            <TabsTrigger value="rfid">RFID ({rfids.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-muted-foreground text-xs">Unidade</div>{bomba?.unidade_nome ?? '—'}</div>
              <div><div className="text-muted-foreground text-xs">Cartões autorizados</div>{estado?.rfid_autorizados ?? 0}</div>
              <div><div className="text-muted-foreground text-xs">Última leitura</div>{estado?.ultima_leitura ?? '—'}</div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Nível do tanque</span><span>{nivel != null ? `${Number(nivel).toFixed(0)}%` : '—'}</span>
              </div>
              <Progress value={nivel != null ? Number(nivel) : 0} />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Últimos abastecimentos</div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Quando</TableHead><TableHead>Máquina</TableHead><TableHead>Litros</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(estado?.ultimos_abastecimentos ?? []).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.created_at}</TableCell>
                      <TableCell>{a.maquina_nome ?? a.uid ?? '—'}</TableCell>
                      <TableCell>{a.litros != null ? Number(a.litros).toFixed(1) : '—'}</TableCell>
                      <TableCell><span className="text-xs">{a.status ?? '—'}</span></TableCell>
                    </TableRow>
                  ))}
                  {(!estado?.ultimos_abastecimentos || estado.ultimos_abastecimentos.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Sem abastecimentos ainda.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="rfid" className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="UID do cartão" value={novo.uid} onChange={(e) => setNovo((p) => ({ ...p, uid: e.target.value }))} className="w-[160px]" />
              <Input placeholder="Máquina" value={novo.maquina_nome} onChange={(e) => setNovo((p) => ({ ...p, maquina_nome: e.target.value }))} className="w-[160px]" />
              <Input placeholder="Operador" value={novo.operador} onChange={(e) => setNovo((p) => ({ ...p, operador: e.target.value }))} className="w-[140px]" />
              <Button size="sm" onClick={addRfid}><Plus className="mr-1 h-4 w-4" />Autorizar</Button>
              <Button size="sm" variant="outline" onClick={publicar} className="ml-auto"><Send className="mr-1 h-4 w-4" />Publicar whitelist</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>UID</TableHead><TableHead>Máquina</TableHead><TableHead>Operador</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {rfids.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.uid}</TableCell>
                    <TableCell>{r.maquina_nome ?? '—'}</TableCell>
                    <TableCell>{r.operador ?? '—'}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delRfid(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {rfids.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Nenhum cartão autorizado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default BombaModal;
