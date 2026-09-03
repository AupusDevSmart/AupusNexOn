import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2, Power } from 'lucide-react';
import { api } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InversorNuvemConfig } from './InversorNuvemConfig';

interface Config {
  unidade_id: string; nome: string; provedor: string; provedor_planta_id: string;
  predicao: number | null; frequencia_min: number; ativo: boolean; ultima_sync: string | null; req_hora: number;
}
interface Budget { provedor: string; req_hora: number; limite: number; folga: number; usinas_ativas: number }
interface UnidadeDisp { unidade_id: string; nome: string }

const PROVEDORES = [
  { v: 'isolarcloud', l: 'iSolarCloud' },
  { v: 'fusion_solar', l: 'Fusion Solar' },
  { v: 'deye', l: 'Deye' },
];
const FREQS = [
  { v: 1440, l: 'Diária' }, { v: 720, l: '12 em 12h' }, { v: 360, l: '6 em 6h' },
  { v: 60, l: 'A cada 1h' }, { v: 30, l: 'A cada 30 min' }, { v: 15, l: 'A cada 15 min' }, { v: 5, l: 'A cada 5 min' },
];
const freqLabel = (m: number) => FREQS.find((f) => f.v === m)?.l ?? `${m} min`;

export function ControleSyncFvPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [budget, setBudget] = useState<Budget[]>([]);
  const [disp, setDisp] = useState<UnidadeDisp[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);
  const [novo, setNovo] = useState({ unidadeId: '', provedor: 'isolarcloud', plantaId: '', predicao: '', freq: 1440 });
  const [plantasProv, setPlantasProv] = useState<Array<{ id: string; nome: string; capacidade_kwp: number | null }>>([]);
  const [loadingPlantas, setLoadingPlantas] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        api.get('/monitoramento-fv/config'),
        api.get('/monitoramento-fv/config/unidades-disponiveis'),
      ]);
      const data = r?.data?.data ?? r?.data;
      setConfigs(data?.configs ?? []);
      setBudget(data?.budget ?? []);
      setDisp((d?.data?.data ?? d?.data ?? []) as UnidadeDisp[]);
    } catch (e: any) {
      setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha ao carregar' });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Busca as plantas do provedor selecionado (pro seletor, em vez de digitar o ID).
  useEffect(() => {
    let vivo = true;
    setLoadingPlantas(true);
    setPlantasProv([]);
    api.get(`/monitoramento-fv/config/plantas-provedor?provedor=${novo.provedor}`)
      .then((r: any) => { if (vivo) setPlantasProv((r?.data?.data ?? r?.data ?? []) as any[]); })
      .catch(() => { if (vivo) setPlantasProv([]); })
      .finally(() => { if (vivo) setLoadingPlantas(false); });
    return () => { vivo = false; };
  }, [novo.provedor]);

  const salvar = async (c: Partial<Config> & { unidadeId: string; provedor: string; plantaId: string; predicao: number | null; freq: number; ativo: boolean }) => {
    try {
      await api.put('/monitoramento-fv/config', {
        unidadeId: c.unidadeId, provedorMonitoramento: c.provedor, provedorPlantaId: c.plantaId,
        predicaoDiariaKwh: c.predicao, frequenciaMin: c.freq, ativo: c.ativo,
      });
      setStatus({ tipo: 'ok', msg: 'Configuração salva.' });
      await carregar();
    } catch (e: any) {
      setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha ao salvar' });
    }
  };

  const salvarNovo = async () => {
    if (!novo.unidadeId) { setStatus({ tipo: 'erro', msg: 'Selecione a usina' }); return; }
    if (!novo.plantaId.trim()) { setStatus({ tipo: 'erro', msg: 'Informe o ID da planta no provedor' }); return; }
    await salvar({ unidadeId: novo.unidadeId, provedor: novo.provedor, plantaId: novo.plantaId.trim(),
      predicao: novo.predicao ? Number(novo.predicao) : null, freq: novo.freq, ativo: true });
    setNovo({ unidadeId: '', provedor: 'isolarcloud', plantaId: '', predicao: '', freq: 1440 });
  };

  const toggleAtivo = (c: Config) => salvar({ unidadeId: c.unidade_id, provedor: c.provedor, plantaId: c.provedor_planta_id, predicao: c.predicao, freq: c.frequencia_min, ativo: !c.ativo });
  const mudarFreq = (c: Config, freq: number) => salvar({ unidadeId: c.unidade_id, provedor: c.provedor, plantaId: c.provedor_planta_id, predicao: c.predicao, freq, ativo: c.ativo });

  const remover = async (c: Config) => {
    if (!confirm(`Remover a config de ${c.nome}? Ela deixa de ser sincronizada.`)) return;
    try {
      await api.delete(`/monitoramento-fv/config?unidadeId=${encodeURIComponent(c.unidade_id)}`);
      setStatus({ tipo: 'ok', msg: `${c.nome} removida do sync.` });
      await carregar();
    } catch (e: any) { setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha ao remover' }); }
  };

  const provLabel = (v: string) => PROVEDORES.find((p) => p.v === v)?.l ?? v;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gerencie quais usinas puxar da API, de qual provedor e com que periodicidade. O teto de <b>2000 requisições/hora por provedor</b> é imposto — o sistema bloqueia configs que estourem.
      </p>

      {status && (
        <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${status.tipo === 'ok' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-red-500/40 text-red-600 dark:text-red-400'}`}>
          {status.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}<span>{status.msg}</span>
        </div>
      )}

      {/* Budget por provedor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {budget.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma usina configurada ainda.</div>}
        {budget.map((b) => {
          const pct = Math.min(100, (b.req_hora / b.limite) * 100);
          const cor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <Card key={b.provedor}><CardContent className="p-4">
              <div className="flex justify-between items-baseline">
                <span className="font-medium">{provLabel(b.provedor)}</span>
                <span className="text-xs text-muted-foreground">{b.usinas_ativas} usina(s) ativa(s)</span>
              </div>
              <div className="mt-2 text-sm"><b>{b.req_hora}</b> / {b.limite} req/h</div>
              <div className="mt-1 h-2 rounded bg-muted overflow-hidden"><div className={`h-full ${cor}`} style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 text-xs text-muted-foreground">folga: {b.folga} req/h</div>
            </CardContent></Card>
          );
        })}
      </div>

      {/* Adicionar */}
      <Card><CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Usina (sem config)</label>
            <Select value={novo.unidadeId} onValueChange={(v) => setNovo((s) => ({ ...s, unidadeId: v }))}>
              <SelectTrigger><SelectValue placeholder={disp.length ? 'Selecionar…' : 'Todas já configuradas'} /></SelectTrigger>
              <SelectContent>{disp.map((u) => <SelectItem key={u.unidade_id} value={u.unidade_id}>{u.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Provedor</label>
            <Select value={novo.provedor} onValueChange={(v) => setNovo((s) => ({ ...s, provedor: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROVEDORES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Planta no provedor</label>
            {loadingPlantas || plantasProv.length > 0 ? (
              <Select value={novo.plantaId} onValueChange={(v) => setNovo((s) => ({ ...s, plantaId: v }))}>
                <SelectTrigger><SelectValue placeholder={loadingPlantas ? 'Buscando…' : 'Selecionar planta…'} /></SelectTrigger>
                <SelectContent>
                  {plantasProv.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={novo.plantaId} onChange={(e) => setNovo((s) => ({ ...s, plantaId: e.target.value }))} placeholder="ID (não listou — digite)" />
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Periodicidade</label>
            <Select value={String(novo.freq)} onValueChange={(v) => setNovo((s) => ({ ...s, freq: Number(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQS.map((f) => <SelectItem key={f.v} value={String(f.v)}>{f.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><label className="text-xs text-muted-foreground">Meta/dia (kWh)</label><Input inputMode="decimal" value={novo.predicao} onChange={(e) => setNovo((s) => ({ ...s, predicao: e.target.value }))} placeholder="opc." /></div>
            <Button size="sm" onClick={salvarNovo} disabled={!disp.length}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
        </div>
      </CardContent></Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Usina</TableHead><TableHead>Provedor</TableHead><TableHead>ID planta</TableHead>
            <TableHead>Periodicidade</TableHead><TableHead className="text-right">req/h</TableHead>
            <TableHead>Última sync</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {configs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{loading ? 'Carregando…' : 'Nenhuma config.'}</TableCell></TableRow>}
            {configs.map((c) => (
              <TableRow key={c.unidade_id} className={!c.ativo ? 'opacity-50' : undefined}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{provLabel(c.provedor)}</TableCell>
                <TableCell className="font-mono text-xs">{c.provedor_planta_id}</TableCell>
                <TableCell>
                  <Select value={String(c.frequencia_min)} onValueChange={(v) => mudarFreq(c, Number(v))}>
                    <SelectTrigger className="h-8 w-36"><SelectValue>{freqLabel(c.frequencia_min)}</SelectValue></SelectTrigger>
                    <SelectContent>{FREQS.map((f) => <SelectItem key={f.v} value={String(f.v)}>{f.l}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">{c.req_hora}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.ultima_sync ?? '—'}</TableCell>
                <TableCell>
                  <button onClick={() => toggleAtivo(c)} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${c.ativo ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                    <Power className="h-3 w-3" />{c.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => remover(c)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <InversorNuvemConfig
        fusionUnidades={configs
          .filter((c) => c.provedor === 'fusion_solar')
          .map((c) => ({ unidade_id: c.unidade_id, nome: c.nome }))}
      />
    </div>
  );
}

export default ControleSyncFvPage;
