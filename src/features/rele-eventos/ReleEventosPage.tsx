import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Clock, CheckCircle2, AlertCircle, Plus, Search } from 'lucide-react';
import { api } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEstadoLembrado } from '@/hooks/useEstadoLembrado';

const unwrap = (r: any) => r?.data?.data?.data ?? r?.data?.data ?? r?.data;

interface Evento {
  id: string;
  device: string;
  origem_protocolo: string;
  ts_fonte: string | null;
  ts_recebido: string;
  hora_confiavel: boolean;
  tipo_registro: number | null;
  fun: number | null;
  inf: number | null;
  evento: string | null;
  estado: string | null;
  tempo_relativo_ms: number | null;
  falta_num: number | null;
  valor: number | null;
  equipamento_nome: string | null;
}
interface CodigoDesconhecido { protocolo: string; fun: number; inf: number; ocorrencias: number }

/**
 * SOE — eventos de proteção com timestamp da FONTE (o relé).
 * Ordenado pela hora do relé, não a de chegada. Ver docs/IOT-SOE-EVENTOS-RELE.md.
 */
export function ReleEventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [desconhecidos, setDesconhecidos] = useState<CodigoDesconhecido[]>([]);
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useEstadoLembrado('rele-eventos:device', '');
  const [status, setStatus] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);
  const [nomeando, setNomeando] = useState<Record<string, string>>({});
  const [auto, setAuto] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [e, d] = await Promise.all([
        api.get(`/rele-eventos?limit=200${device.trim() ? `&device=${encodeURIComponent(device.trim())}` : ''}`),
        api.get('/rele-eventos/codigos/desconhecidos'),
      ]);
      setEventos(unwrap(e) ?? []);
      setDesconhecidos(unwrap(d) ?? []);
    } catch (err: any) {
      setStatus({ tipo: 'erro', msg: err?.response?.data?.message || 'Falha ao carregar eventos' });
    } finally { setLoading(false); }
  }, [device]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void carregar(), 10000);
    return () => clearInterval(t);
  }, [auto, carregar]);

  const salvarCodigo = async (c: CodigoDesconhecido) => {
    const key = `${c.protocolo}/${c.fun}/${c.inf}`;
    const nome = (nomeando[key] ?? '').trim();
    if (!nome) { setStatus({ tipo: 'erro', msg: 'Dê um nome ao evento' }); return; }
    try {
      const r = await api.post('/rele-eventos/codigos', { protocolo: c.protocolo, fun: c.fun, inf: c.inf, evento: nome });
      const n = unwrap(r)?.reprocessados ?? 0;
      setStatus({ tipo: 'ok', msg: `"${nome}" salvo — ${n} evento(s) do histórico reprocessado(s).` });
      setNomeando((p) => ({ ...p, [key]: '' }));
      await carregar();
    } catch (err: any) {
      setStatus({ tipo: 'erro', msg: err?.response?.data?.message || 'Falha ao salvar código' });
    }
  };

  const fmtHora = (ts: string | null) => {
    if (!ts) return '—';
    // "YYYY-MM-DD HH:MM:SS.mmm" -> "DD/MM HH:MM:SS.mmm"
    const [d, h] = ts.split(' ');
    const [, mo, da] = d.split('-');
    return `${da}/${mo} ${h ?? ''}`;
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col w-full">
          <TitleCard
            title="Alarmes e Eventos"
            description="Hora carimbada pelo próprio relé (ms). Ordenado pela hora da fonte, não a de chegada."
          />

          <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-start">
            <div className="relative flex-1 lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="Filtrar por relé…" className="pl-9" />
            </div>
            <div className="flex flex-row gap-2 w-full lg:w-auto lg:ml-auto">
              <button
                className={`${auto ? 'btn-minimal-primary' : 'btn-minimal-outline'} flex-1 lg:flex-none whitespace-nowrap`}
                onClick={() => setAuto((a) => !a)}
              >
                {auto ? 'Auto 10s' : 'Auto off'}
              </button>
              <button className="btn-minimal-outline flex-1 lg:flex-none whitespace-nowrap" onClick={() => void carregar()}>
                <RefreshCw className="h-4 w-4 mr-2" />Atualizar
              </button>
            </div>
          </div>

          {status && (
            <div className={`mb-4 flex items-start gap-2 rounded-md border p-2 text-sm ${status.tipo === 'ok' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-red-500/40 text-red-600 dark:text-red-400'}`}>
              {status.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}<span>{status.msg}</span>
            </div>
          )}

          {/* Fila de curadoria: códigos vistos em campo sem tradução */}
          {desconhecidos.length > 0 && (
            <div className="mb-4 rounded-md border border-amber-500/40 bg-card p-3 space-y-2">
              <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span><b>{desconhecidos.length} código(s) sem tradução.</b> Nomeie e o histórico é reprocessado — nada se perde.</span>
              </p>
              {desconhecidos.map((c) => {
                const key = `${c.protocolo}/${c.fun}/${c.inf}`;
                return (
                  <div key={key} className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono">FUN={c.fun} INF={c.inf}</span>
                    <span className="text-muted-foreground">({c.ocorrencias}×)</span>
                    <Input
                      value={nomeando[key] ?? ''}
                      onChange={(e) => setNomeando((p) => ({ ...p, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && void salvarCodigo(c)}
                      placeholder="ex: Trip 51 Fase A" className="h-7 w-full sm:w-[200px]"
                    />
                    <Button size="sm" className="h-7" onClick={() => void salvarCodigo(c)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Nomear
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="border rounded-md bg-card overflow-x-auto">
            <Table className="table-minimal min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Hora (relé)</TableHead>
                  <TableHead>Relé</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead className="w-[70px]">Estado</TableHead>
                  <TableHead className="w-[90px]">T. relativo</TableHead>
                  <TableHead className="w-[70px]">Falta</TableHead>
                  <TableHead className="w-[90px]">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">
                    Nenhum evento ainda. A TON drena o buffer do relé e publica aqui assim que houver trip/pickup.
                  </TableCell></TableRow>
                )}
                {eventos.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1">
                        {!e.hora_confiavel && (
                          <span title="Relógio do relé não estava setado — hora não confiável">
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                          </span>
                        )}
                        {fmtHora(e.ts_fonte)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{e.device}</div>
                      {e.equipamento_nome && <div className="text-[11px] text-muted-foreground">{e.equipamento_nome}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.evento ?? <span className="text-muted-foreground font-mono">FUN={e.fun} INF={e.inf} <span className="text-amber-600">(sem tradução)</span></span>}
                    </TableCell>
                    <TableCell>
                      {e.estado && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${e.estado === 'on' ? 'bg-red-500/15 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                          {e.estado.toUpperCase()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {e.tempo_relativo_ms != null && e.tempo_relativo_ms !== 65535 ? (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" />{e.tempo_relativo_ms} ms</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{e.falta_num ? e.falta_num : '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{e.valor != null ? e.valor.toFixed(3) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </Layout.Main>
    </Layout>
  );
}

export default ReleEventosPage;
