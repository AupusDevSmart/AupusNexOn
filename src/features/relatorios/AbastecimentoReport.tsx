import { useEffect, useMemo, useState } from 'react';
import { Fuel } from 'lucide-react';
import { api } from '@/config/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const unwrap = (r: any) => r?.data?.data ?? r?.data;

interface Bomba { id: string; nome: string; unidade_id: string; unidade_nome?: string }

/**
 * Relatório de abastecimento POR UNIDADE — mostra TODAS as bombas da unidade.
 * Agrega litros por máquina (somando as bombas da unidade) e lista as transações.
 */
export function AbastecimentoReport() {
  const [bombas, setBombas] = useState<Bomba[]>([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [linhas, setLinhas] = useState<any[]>([]);

  useEffect(() => { api.get('/bomba-combustivel/bombas').then((r) => setBombas(unwrap(r) ?? [])).catch(() => setBombas([])); }, []);
  useEffect(() => {
    api.get('/bomba-combustivel/abastecimentos?limite=500').then((r) => setLinhas(unwrap(r) ?? [])).catch(() => setLinhas([]));
  }, []);

  const unidades = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bombas) if (b.unidade_id) m.set(b.unidade_id, b.unidade_nome || b.unidade_id);
    return [...m.entries()].map(([id, nome]) => ({ id, nome }));
  }, [bombas]);

  const bombasDaUnidade = useMemo(
    () => bombas.filter((b) => !unidadeId || b.unidade_id === unidadeId),
    [bombas, unidadeId],
  );
  const idsBomba = useMemo(() => new Set(bombasDaUnidade.map((b) => b.id)), [bombasDaUnidade]);
  const nomeBomba = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bombas) m.set(b.id, b.nome);
    return m;
  }, [bombas]);

  const linhasUnidade = useMemo(
    () => linhas.filter((a) => idsBomba.has(String(a.equipamento_id))),
    [linhas, idsBomba],
  );

  const porMaquina = useMemo(() => {
    const m = new Map<string, { litros: number; abastecimentos: number }>();
    for (const a of linhasUnidade) {
      if (a.status === 'rejeitado') continue;
      const k = a.maquina_nome || a.uid || '—';
      const cur = m.get(k) ?? { litros: 0, abastecimentos: 0 };
      cur.litros += Number(a.litros) || 0;
      cur.abastecimentos += 1;
      m.set(k, cur);
    }
    return [...m.entries()].map(([maquina, v]) => ({ maquina, ...v })).sort((a, b) => b.litros - a.litros);
  }, [linhasUnidade]);

  const totalLitros = porMaquina.reduce((s, x) => s + x.litros, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">Unidade:</span>
        <Select value={unidadeId} onValueChange={setUnidadeId}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
          <SelectContent>
            {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {bombasDaUnidade.length} bomba(s){unidadeId ? ' na unidade' : ''}
        </span>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2 text-sm font-medium"><Fuel className="h-4 w-4" />Consumo por máquina{unidadeId ? ' (todas as bombas da unidade)' : ''}</div>
        <Table>
          <TableHeader><TableRow><TableHead>Máquina</TableHead><TableHead>Abastecimentos</TableHead><TableHead>Litros</TableHead></TableRow></TableHeader>
          <TableBody>
            {porMaquina.map((x) => (
              <TableRow key={x.maquina}><TableCell>{x.maquina}</TableCell><TableCell>{x.abastecimentos}</TableCell><TableCell>{x.litros.toFixed(1)}</TableCell></TableRow>
            ))}
            {porMaquina.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Sem abastecimentos.</TableCell></TableRow>}
            {porMaquina.length > 0 && <TableRow className="font-medium"><TableCell>Total</TableCell><TableCell /><TableCell>{totalLitros.toFixed(1)}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">Transações</div>
        <Table>
          <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Bomba</TableHead><TableHead>Máquina</TableHead><TableHead>Litros</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {linhasUnidade.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.created_at}</TableCell>
                <TableCell>{nomeBomba.get(String(a.equipamento_id)) ?? '—'}</TableCell>
                <TableCell>{a.maquina_nome ?? a.uid ?? '—'}</TableCell>
                <TableCell>{a.litros != null ? Number(a.litros).toFixed(1) : '—'}</TableCell>
                <TableCell className="text-xs">{a.status ?? '—'}</TableCell>
              </TableRow>
            ))}
            {linhasUnidade.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Sem transações.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default AbastecimentoReport;
