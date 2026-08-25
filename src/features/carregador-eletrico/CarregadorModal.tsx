import { useCallback, useEffect, useState } from 'react';
import { Loader2, Zap, Trash2, Plus, RefreshCw, Download, PlayCircle, Hand } from 'lucide-react';
import { api } from '@/config/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const unwrap = (r: any) => r?.data?.data ?? r?.data;

interface Carregador { id: string; nome: string; unidade_nome?: string; planta_id?: string }

function badgeEstado(s?: any) {
  if (s?.sessao_ativa) return <Badge className="bg-emerald-600">Em recarga</Badge>;
  if (s?.estado === 'desconectado' || s?.estado === 'livre') return <Badge variant="secondary">Livre</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export function CarregadorModal({ carregador, open, onOpenChange }: { carregador: Carregador | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [estado, setEstado] = useState<any>(null);
  const [moradores, setMoradores] = useState<any[]>([]);
  const [plantaId, setPlantaId] = useState<string | undefined>(carregador?.planta_id);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [moradorLiberar, setMoradorLiberar] = useState('');
  const [moradorVaga, setMoradorVaga] = useState('');
  const [novo, setNovo] = useState({ nome: '', apartamento: '', tag_uid: '' });
  const [mes, setMes] = useState('');
  const [exportRows, setExportRows] = useState<any[] | null>(null);

  const id = carregador?.id;

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [e, m, cs] = await Promise.all([
        api.get(`/carregador-eletrico/${id}/estado`),
        api.get('/carregador-eletrico/moradores'),
        api.get('/carregador-eletrico/carregadores'),
      ]);
      setEstado(unwrap(e)); setMoradores(unwrap(m) ?? []);
      const meu = (unwrap(cs) ?? []).find((c: any) => String(c.id).trim() === String(id).trim());
      if (meu?.planta_id) setPlantaId(String(meu.planta_id).trim());
    } catch { /* */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  const liberar = async () => {
    if (!moradorLiberar) { setMsg('Escolha o morador.'); return; }
    setMsg('');
    try { await api.post(`/carregador-eletrico/${id}/liberar`, { morador_id: moradorLiberar }); setMoradorLiberar(''); await carregar(); setMsg('Recarga liberada.'); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao liberar'); }
  };
  const pedirVaga = async () => {
    if (!moradorVaga) { setMsg('Escolha quem está pedindo a vaga.'); return; }
    setMsg('');
    try { const r = await api.post(`/carregador-eletrico/${id}/pedir-vaga`, { morador_id: moradorVaga }); const d = unwrap(r); setMoradorVaga(''); await carregar(); setMsg(d?.ocioso_iniciado ? 'Vaga solicitada — tempo ocioso iniciado.' : 'Pedido registrado.'); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao pedir vaga'); }
  };
  const addMorador = async () => {
    if (!novo.nome.trim()) return;
    setMsg('');
    try { await api.post('/carregador-eletrico/moradores', { ...novo, tag_uid: novo.tag_uid.trim().toUpperCase() || null, planta_id: plantaId }); setNovo({ nome: '', apartamento: '', tag_uid: '' }); await carregar(); setMsg('Morador cadastrado.'); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao cadastrar'); }
  };
  const delMorador = async (mid: string) => {
    try { await api.delete(`/carregador-eletrico/moradores/${mid}`); await carregar(); } catch { /* */ }
  };
  const gerarExport = async () => {
    if (!/^\d{4}-\d{2}$/.test(mes)) { setMsg('Informe o mês (AAAA-MM).'); return; }
    setMsg('');
    try {
      const r = await api.get(`/carregador-eletrico/export`, { params: { mes, plantaId } });
      const d = unwrap(r); setExportRows(d?.linhas ?? []);
      if (d?.csv) {
        const blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `recargas_${mes}.csv`; a.click(); URL.revokeObjectURL(url);
      }
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha no export'); }
  };

  const sa = estado?.sessao_ativa;
  const sessoes = estado?.sessoes ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" /> {carregador?.nome ?? 'Carregador'}
            {badgeEstado(estado)}
            <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={carregar} title="Atualizar">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {msg && <div className="rounded bg-muted p-2 text-xs text-muted-foreground">{msg}</div>}

        <Tabs defaultValue="recarga">
          <TabsList>
            <TabsTrigger value="recarga">Recarga</TabsTrigger>
            <TabsTrigger value="sessoes">Sessões ({sessoes.length})</TabsTrigger>
            <TabsTrigger value="moradores">Moradores ({moradores.length})</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="recarga" className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-muted-foreground text-xs">Unidade</div>{carregador?.unidade_nome ?? '—'}</div>
              <div><div className="text-muted-foreground text-xs">Fonte kWh</div>{estado?.fonte_kwh === 'carregador' ? 'Carregador (broker)' : 'Medidor (TON)'}</div>
              <div><div className="text-muted-foreground text-xs">Tarifa</div>{estado?.tarifa_kwh != null ? `R$ ${Number(estado.tarifa_kwh).toFixed(2)}/kWh` : '—'}</div>
            </div>

            {sa ? (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm space-y-1">
                <div className="font-medium">Em recarga: {sa.morador_nome}</div>
                <div className="text-xs text-muted-foreground">Início {sa.inicio} · {sa.kwh_total != null ? `${Number(sa.kwh_total).toFixed(2)} kWh` : '0 kWh'}
                  {sa.ocioso_inicio ? ` · ⏳ ocioso desde ${new Date(sa.ocioso_inicio).toLocaleString('pt-BR')} (pedido por ${sa.ocioso_por_nome ?? '—'})` : ''}</div>
                <div className="pt-2 flex flex-wrap items-end gap-2">
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Outro morador quer a vaga?</div>
                    <Select value={moradorVaga} onValueChange={setMoradorVaga}>
                      <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue placeholder="Quem está pedindo..." /></SelectTrigger>
                      <SelectContent>{moradores.map((m) => <SelectItem key={m.id} value={m.id} className="text-xs">{m.nome}{m.apartamento ? ` (${m.apartamento})` : ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={pedirVaga}><Hand className="mr-1 h-4 w-4" />Pedir a vaga</Button>
                </div>
              </div>
            ) : (
              <div className="rounded border border-input p-3 text-sm space-y-2">
                <div className="text-muted-foreground text-xs">Vaga livre — libere a recarga no nome do morador:</div>
                <div className="flex flex-wrap items-end gap-2">
                  <Select value={moradorLiberar} onValueChange={setMoradorLiberar}>
                    <SelectTrigger className="w-[240px] h-8 text-xs"><SelectValue placeholder="Escolha o morador..." /></SelectTrigger>
                    <SelectContent>{moradores.map((m) => <SelectItem key={m.id} value={m.id} className="text-xs">{m.nome}{m.apartamento ? ` (${m.apartamento})` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" onClick={liberar}><PlayCircle className="mr-1 h-4 w-4" />Liberar recarga</Button>
                </div>
                <div className="text-[11px] text-muted-foreground">A recarga encerra sozinha ao desconectar o carro (a TON corta o fornecimento).</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sessoes" className="space-y-3">
            <Table>
              <TableHeader><TableRow><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Morador</TableHead><TableHead>kWh</TableHead><TableHead>Ocioso</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {sessoes.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.inicio}</TableCell>
                    <TableCell className="text-xs">{s.fim ?? '—'}</TableCell>
                    <TableCell>{s.morador_nome ?? '—'}</TableCell>
                    <TableCell>{s.kwh_total != null ? Number(s.kwh_total).toFixed(2) : '—'}</TableCell>
                    <TableCell>{s.ocioso_min != null ? `${s.ocioso_min} min` : '—'}</TableCell>
                    <TableCell><span className="text-xs">{s.status}</span></TableCell>
                  </TableRow>
                ))}
                {sessoes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">Sem sessões ainda.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="moradores" className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))} className="w-[180px]" />
              <Input placeholder="Apartamento" value={novo.apartamento} onChange={(e) => setNovo((p) => ({ ...p, apartamento: e.target.value }))} className="w-[120px]" />
              <Input placeholder="Tag (opcional)" value={novo.tag_uid} onChange={(e) => setNovo((p) => ({ ...p, tag_uid: e.target.value }))} className="w-[140px]" />
              <Button size="sm" onClick={addMorador}><Plus className="mr-1 h-4 w-4" />Cadastrar</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Apto</TableHead><TableHead>Tag</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {moradores.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.nome}</TableCell>
                    <TableCell>{m.apartamento ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{m.tag_uid ?? '—'}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delMorador(m.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {moradores.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Nenhum morador cadastrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="export" className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Mês (AAAA-MM)</div>
                <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-[160px]" />
              </div>
              <Button size="sm" onClick={gerarExport}><Download className="mr-1 h-4 w-4" />Gerar planilha (CSV)</Button>
            </div>
            {exportRows && (
              <Table>
                <TableHeader><TableRow><TableHead>Morador</TableHead><TableHead>kWh</TableHead><TableHead>Ocioso (min)</TableHead><TableHead>Valor (R$)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {exportRows.map((r, i) => (
                    <TableRow key={i}><TableCell>{r.morador ?? '—'}</TableCell><TableCell>{r.kwh}</TableCell><TableCell>{r.ocioso_min}</TableCell><TableCell>{Number(r.valor_reais).toFixed(2)}</TableCell></TableRow>
                  ))}
                  {exportRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Sem recargas encerradas no mês.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default CarregadorModal;
