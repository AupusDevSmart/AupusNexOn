import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Cloud } from 'lucide-react';
import { api } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FusionUnidade { unidade_id: string; nome: string }
interface HuaweiInv { devId: string; esn: string | null; name: string; model: string | null }
interface Candidato { id: string; nome: string; classificacao: string | null }
interface MapRow { equipamento_id: string; device_id: string; device_esn: string | null; device_name: string | null }
interface Dispositivos { plant_code: string; huawei: HuaweiInv[]; candidatos: Candidato[]; mapa: MapRow[] }

const NONE = '__none__';

/**
 * Config do fallback por-inversor (nuvem Fusion/Huawei). Admin escolhe uma usina
 * Fusion, vê os inversores da nuvem e vincula cada um ao equipamento NexON que o
 * representa. Depois disso, quando a TON fica obsoleta (> 40 min), o modal "Dados
 * em Tempo Real" do inversor mostra a leitura da nuvem no lugar do "sem dado".
 */
export function InversorNuvemConfig({ fusionUnidades }: { fusionUnidades: FusionUnidade[] }) {
  const [unidadeId, setUnidadeId] = useState('');
  const [data, setData] = useState<Dispositivos | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregar = useCallback(async (uid: string) => {
    if (!uid) { setData(null); return; }
    setLoading(true); setMsg(null);
    try {
      const r = await api.get(`/monitoramento-fv/inversores-nuvem/dispositivos?unidadeId=${encodeURIComponent(uid)}`);
      setData((r?.data?.data ?? r?.data) as Dispositivos);
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e?.response?.data?.message || 'Falha ao carregar dispositivos' });
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(unidadeId); }, [unidadeId, carregar]);

  const mapaPorDevice = useMemo(
    () => new Map((data?.mapa ?? []).map((m) => [m.device_id, m])),
    [data],
  );

  const vincular = async (deviceId: string, equipamentoId: string) => {
    setMsg(null);
    try {
      if (equipamentoId) {
        await api.post('/monitoramento-fv/inversores-nuvem/mapa', { equipamentoId, deviceId });
      } else {
        const m = mapaPorDevice.get(deviceId);
        if (m) await api.delete(`/monitoramento-fv/inversores-nuvem/mapa?equipamentoId=${encodeURIComponent(m.equipamento_id)}`);
      }
      await carregar(unidadeId);
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e?.response?.data?.message || 'Falha ao salvar vínculo' });
    }
  };

  const rodarAgora = async () => {
    setMsg(null);
    try {
      const r = await api.post('/monitoramento-fv/inversores-nuvem/sync', {});
      const d = (r?.data?.data ?? r?.data) as { escritos: number; pulados_ton_viva: number; erros: string[] };
      setMsg({
        tipo: 'ok',
        texto: `Gravados ${d.escritos} · pulados (TON viva) ${d.pulados_ton_viva}` +
          (d.erros?.length ? ` · ${d.erros.join('; ')}` : ''),
      });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e?.response?.data?.message || 'Falha ao rodar o fallback' });
    }
  };

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-sky-500" />
        <span className="font-medium">Fallback por-inversor (nuvem Fusion/Huawei)</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Quando a TON fica <b>&gt; 40 min sem dado</b>, o modal “Dados em Tempo Real” do inversor
        passa a mostrar a leitura da nuvem (potência, temperatura, FP, geração) — de hora em hora.
        Só <b>Fusion/Huawei</b> expõe dado por inversor (iSolar e Deye ficam só no total da planta).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={unidadeId} onValueChange={setUnidadeId}>
          <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Selecione uma usina Fusion" /></SelectTrigger>
          <SelectContent>
            {fusionUnidades.length === 0
              ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma usina Fusion configurada</div>
              : fusionUnidades.map((u) => <SelectItem key={u.unidade_id} value={u.unidade_id}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={rodarAgora}>
          <RefreshCw className="h-4 w-4 mr-1" />Rodar agora
        </Button>
        {data?.plant_code && <span className="text-xs text-muted-foreground">Planta: <code>{data.plant_code}</code></span>}
      </div>

      {msg && (
        <div className={`text-xs px-2 py-1 rounded ${msg.tipo === 'ok' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
          {msg.texto}
        </div>
      )}
      {loading && <div className="text-xs text-muted-foreground">Carregando dispositivos…</div>}

      {data && data.huawei.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inversor (Huawei)</TableHead>
              <TableHead>ESN</TableHead>
              <TableHead>Vinculado ao equipamento NexON</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.huawei.map((inv) => {
              const m = mapaPorDevice.get(inv.devId);
              return (
                <TableRow key={inv.devId}>
                  <TableCell>
                    {inv.name}
                    {inv.model && <span className="ml-1 text-xs text-muted-foreground">{inv.model}</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inv.esn ?? '—'}</TableCell>
                  <TableCell>
                    <Select
                      value={m?.equipamento_id ?? NONE}
                      onValueChange={(v) => vincular(inv.devId, v === NONE ? '' : v)}
                    >
                      <SelectTrigger className="h-8 w-64"><SelectValue placeholder="— nenhum —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— nenhum —</SelectItem>
                        {data.candidatos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}{c.classificacao ? ` (${c.classificacao})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {data && data.huawei.length === 0 && !loading && (
        <div className="text-xs text-muted-foreground">Nenhum inversor retornado pela nuvem desta planta.</div>
      )}
    </CardContent></Card>
  );
}

export default InversorNuvemConfig;
