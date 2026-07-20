import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Download, Upload, Save, Trash2, Plus, RefreshCw, AlertCircle, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Unidade { unidade_id: string; nome: string; provedor: string | null }
interface Linha { unidade_id: string; nome: string; data: string; kwh_realizado: number; kwh_previsto: number; origem: string }

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—');

// número tolerante: aceita "1.234,56" (BR) e "1234.56"
function parseNum(v: any): number | null {
  if (v == null || v === '') return null;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // BR: ponto=milhar, vírgula=decimal
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const badgeOrigem: Record<string, string> = {
  manual: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  bdo: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  ton: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  nuvem: 'bg-muted text-muted-foreground',
};

export function GeracaoFvPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [filtroUnidade, setFiltroUnidade] = useState<string>('todas');
  const [de, setDe] = useState(diasAtras(30));
  const [ate, setAte] = useState(hoje());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, { real: string; prev: string }>>({});
  const [diasAbertos, setDiasAbertos] = useState<Set<string>>(new Set());
  const toggleDia = (d: string) => setDiasAbertos((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const fileRef = useRef<HTMLInputElement>(null);

  // novo lançamento
  const [novo, setNovo] = useState({ unidadeId: '', data: hoje(), real: '', prev: '' });

  const carregarUnidades = useCallback(async () => {
    try {
      const r = await api.get('/monitoramento-fv/geracao/unidades');
      setUnidades((r?.data?.data ?? r?.data ?? []) as Unidade[]);
    } catch { /* 403/erro tratado no gate */ }
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ de, ate });
      if (filtroUnidade !== 'todas') params.set('unidadeId', filtroUnidade);
      const r = await api.get(`/monitoramento-fv/geracao?${params.toString()}`);
      setLinhas((r?.data?.data ?? r?.data ?? []) as Linha[]);
      setEdits({});
    } catch (e: any) {
      setStatus({ tipo: 'erro', msg: e?.response?.data?.message || 'Falha ao carregar' });
    } finally {
      setLoading(false);
    }
  }, [de, ate, filtroUnidade]);

  useEffect(() => { carregarUnidades(); }, [carregarUnidades]);
  useEffect(() => { carregar(); }, [carregar]);

  const chave = (l: Linha) => `${l.unidade_id}|${l.data}`;

  const salvarLinha = async (l: Linha) => {
    const e = edits[chave(l)];
    const real = e ? parseNum(e.real) : l.kwh_realizado;
    const prev = e ? parseNum(e.prev) : l.kwh_previsto;
    if (real == null || real < 0) { setStatus({ tipo: 'erro', msg: `Realizado inválido em ${l.nome}` }); return; }
    try {
      await api.put('/monitoramento-fv/geracao', {
        unidadeId: l.unidade_id, data: l.data, kwhRealizado: real, kwhPrevisto: prev,
      });
      setStatus({ tipo: 'ok', msg: `${l.nome} (${l.data}) salvo como manual.` });
      await carregar();
    } catch (err: any) {
      setStatus({ tipo: 'erro', msg: err?.response?.data?.message || 'Falha ao salvar' });
    }
  };

  const removerManual = async (l: Linha) => {
    if (!confirm(`Remover a correção manual de ${l.nome} em ${l.data}? Volta a ser preenchida pela nuvem.`)) return;
    try {
      await api.delete(`/monitoramento-fv/geracao?unidadeId=${encodeURIComponent(l.unidade_id)}&data=${l.data}`);
      setStatus({ tipo: 'ok', msg: `Correção de ${l.nome} removida.` });
      await carregar();
    } catch (err: any) {
      setStatus({ tipo: 'erro', msg: err?.response?.data?.message || 'Falha ao remover' });
    }
  };

  const salvarNovo = async () => {
    const real = parseNum(novo.real);
    if (!novo.unidadeId) { setStatus({ tipo: 'erro', msg: 'Selecione a usina' }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novo.data)) { setStatus({ tipo: 'erro', msg: 'Data inválida' }); return; }
    if (real == null || real < 0) { setStatus({ tipo: 'erro', msg: 'Realizado inválido' }); return; }
    try {
      await api.put('/monitoramento-fv/geracao', {
        unidadeId: novo.unidadeId, data: novo.data, kwhRealizado: real, kwhPrevisto: parseNum(novo.prev),
      });
      setStatus({ tipo: 'ok', msg: 'Lançamento manual salvo.' });
      setNovo({ unidadeId: '', data: hoje(), real: '', prev: '' });
      await carregar();
    } catch (err: any) {
      setStatus({ tipo: 'erro', msg: err?.response?.data?.message || 'Falha ao salvar' });
    }
  };

  // ---- CSV (Excel abre/salva nativo) ----
  const baixarTemplate = () => {
    const head = 'nome;data;kwh_realizado;kwh_previsto';
    const linhasT = unidades.map((u) => `${u.nome};${hoje()};;`);
    const csv = [head, ...linhasT].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `geracao-fv-modelo-${hoje()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importarArquivo = async (file: File) => {
    setStatus(null);
    const txt = await file.text();
    const linhasTxt = txt.replace(/\r/g, '').split('\n').filter((l) => l.trim());
    if (linhasTxt.length < 2) { setStatus({ tipo: 'erro', msg: 'Arquivo vazio ou só cabeçalho' }); return; }
    const delim = (linhasTxt[0].match(/;/g)?.length ?? 0) >= (linhasTxt[0].match(/,/g)?.length ?? 0) ? ';' : ',';
    const cols = linhasTxt[0].split(delim).map((c) => c.trim().toLowerCase());
    const iNome = cols.findIndex((c) => c.includes('nome') || c.includes('usina'));
    const iData = cols.findIndex((c) => c === 'data' || c.includes('data'));
    const iReal = cols.findIndex((c) => c.includes('realizado') || c.includes('geracao') || c.includes('kwh_real'));
    const iPrev = cols.findIndex((c) => c.includes('previsto') || c.includes('meta'));
    if (iNome < 0 || iData < 0 || iReal < 0) {
      setStatus({ tipo: 'erro', msg: 'Cabeçalho precisa ter: nome, data, kwh_realizado (e opcional kwh_previsto)' });
      return;
    }
    const payload = linhasTxt.slice(1).map((ln) => {
      const c = ln.split(delim);
      const real = parseNum(c[iReal]);
      return {
        nome: (c[iNome] || '').trim(),
        data: (c[iData] || '').trim(),
        kwhRealizado: real ?? 0,
        kwhPrevisto: iPrev >= 0 ? parseNum(c[iPrev]) : null,
        _real: real,
      };
    }).filter((r) => r.nome && r.data && r._real != null).map(({ _real, ...r }) => r);

    if (payload.length === 0) { setStatus({ tipo: 'erro', msg: 'Nenhuma linha válida (verifique nome/data/realizado)' }); return; }
    try {
      const r = await api.post('/monitoramento-fv/geracao/importar', { linhas: payload });
      const res = r?.data?.data ?? r?.data;
      const nErr = res?.erros?.length ?? 0;
      setStatus({
        tipo: nErr > 0 ? 'erro' : 'ok',
        msg: `Importadas ${res?.aplicadas ?? 0} linha(s).${nErr ? ` ${nErr} com erro: ${res.erros.slice(0, 3).map((e: any) => `L${e.linha}: ${e.erro}`).join(' | ')}${nErr > 3 ? '…' : ''}` : ''}`,
      });
      await carregar();
    } catch (err: any) {
      setStatus({ tipo: 'erro', msg: err?.response?.data?.message || 'Falha na importação' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Lançamento e correção manual. Valores <b>manuais têm precedência</b> — o sync de nuvem não os sobrescreve.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={baixarTemplate}><Download className="h-4 w-4 mr-1" />Modelo (CSV)</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" />Importar</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importarArquivo(f); e.currentTarget.value = ''; }} />
        </div>
      </div>

      {status && (
        <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${status.tipo === 'ok' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-red-500/40 text-red-600 dark:text-red-400'}`}>
          {status.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
          <span>{status.msg}</span>
        </div>
      )}

      {/* Novo lançamento */}
      <Card><CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Usina</label>
            <Select value={novo.unidadeId} onValueChange={(v) => setNovo((s) => ({ ...s, unidadeId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar usina…" /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => <SelectItem key={u.unidade_id} value={u.unidade_id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><label className="text-xs text-muted-foreground">Data</label><Input type="date" value={novo.data} onChange={(e) => setNovo((s) => ({ ...s, data: e.target.value }))} /></div>
          <div><label className="text-xs text-muted-foreground">Realizado (kWh)</label><Input inputMode="decimal" value={novo.real} onChange={(e) => setNovo((s) => ({ ...s, real: e.target.value }))} placeholder="0" /></div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><label className="text-xs text-muted-foreground">Meta (kWh)</label><Input inputMode="decimal" value={novo.prev} onChange={(e) => setNovo((s) => ({ ...s, prev: e.target.value }))} placeholder="opcional" /></div>
            <Button size="sm" onClick={salvarNovo}><Plus className="h-4 w-4 mr-1" />Lançar</Button>
          </div>
        </div>
      </CardContent></Card>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="min-w-56">
          <label className="text-xs text-muted-foreground">Usina</label>
          <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {unidades.map((u) => <SelectItem key={u.unidade_id} value={u.unidade_id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usina</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Realizado (kWh)</TableHead>
              <TableHead className="text-right">Meta (kWh)</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{loading ? 'Carregando…' : 'Nenhum registro no período.'}</TableCell></TableRow>
            )}
            {(() => {
              // Agrupa por dia (backend já vem em ordem decrescente de data) → lista suspensa.
              const dias: Array<{ data: string; rows: Linha[]; totalReal: number }> = [];
              const idx = new Map<string, number>();
              for (const l of linhas) {
                if (!idx.has(l.data)) { idx.set(l.data, dias.length); dias.push({ data: l.data, rows: [], totalReal: 0 }); }
                const g = dias[idx.get(l.data)!];
                g.rows.push(l); g.totalReal += Number(l.kwh_realizado) || 0;
              }
              return dias.map((g) => {
                const aberto = diasAbertos.has(g.data);
                return (
                  <Fragment key={g.data}>
                    <TableRow className="bg-muted/40 cursor-pointer hover:bg-muted/60" onClick={() => toggleDia(g.data)}>
                      <TableCell colSpan={6}>
                        <div className="flex items-center gap-2 font-medium">
                          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span>{g.data}</span>
                          <span className="text-xs text-muted-foreground font-normal">· {g.rows.length} usina(s) · {g.totalReal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kWh realizado</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {aberto && g.rows.map((l) => {
                      const k = chave(l);
                      const e = edits[k];
                      return (
                        <TableRow key={k} className={l.origem === 'manual' ? 'bg-emerald-500/5' : undefined}>
                          <TableCell className="font-medium pl-8">{l.nome}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.data}</TableCell>
                          <TableCell className="text-right">
                            <Input className="h-8 w-28 ml-auto text-right" inputMode="decimal"
                              value={e ? e.real : String(l.kwh_realizado)}
                              onChange={(ev) => setEdits((s) => ({ ...s, [k]: { real: ev.target.value, prev: (s[k]?.prev ?? String(l.kwh_previsto)) } }))} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input className="h-8 w-28 ml-auto text-right" inputMode="decimal"
                              value={e ? e.prev : String(l.kwh_previsto)}
                              onChange={(ev) => setEdits((s) => ({ ...s, [k]: { prev: ev.target.value, real: (s[k]?.real ?? String(l.kwh_realizado)) } }))} />
                          </TableCell>
                          <TableCell><span className={`text-xs px-2 py-0.5 rounded ${badgeOrigem[l.origem] ?? badgeOrigem.nuvem}`}>{l.origem}</span></TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => salvarLinha(l)} title="Salvar como manual"><Save className="h-4 w-4" /></Button>
                            {l.origem === 'manual' && (
                              <Button size="sm" variant="ghost" onClick={() => removerManual(l)} title="Remover correção manual"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                );
              });
            })()}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

export default GeracaoFvPage;
