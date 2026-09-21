import { useEffect, useMemo, useState } from 'react';
import { Fuel } from 'lucide-react';
import { api } from '@/config/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const unwrap = (r: any) => r?.data?.data ?? r?.data;

interface Bomba { id: string; nome: string; unidade_id: string; unidade_nome?: string }

const MOTIVOS: Record<string, string> = {
  concluido: 'Concluído', fluxo_parado: 'Fluxo parado', emergencia: 'Emergência', timeout: 'Tempo máximo',
  limite: 'Limite de litros', nivel_baixo: 'Nível baixo', manual: 'Manual', contator_colado: 'Contator colado',
  contator_caiu: 'Contator caiu', queda_energia: 'Queda de energia', rejeitado: 'Rejeitado',
};
const motivo = (m?: string) => (m ? (MOTIVOS[m] ?? m) : '—');

/**
 * Relatório de abastecimento POR UNIDADE — todas as bombas da unidade.
 * Agrega litros por MÁQUINA (tag) e por OPERADOR (matrícula), separa o consumo em modo
 * manual (chave do painel) e lista as transações com motivo de fim e validação.
 */
export function AbastecimentoReport() {
  const [bombas, setBombas] = useState<Bomba[]>([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [linhas, setLinhas] = useState<any[]>([]);

  useEffect(() => { api.get('/bomba-combustivel/bombas').then((r) => setBombas(unwrap(r) ?? [])).catch(() => setBombas([])); }, []);
  useEffect(() => {
    api.get('/bomba-combustivel/abastecimentos?limite=1000').then((r) => setLinhas(unwrap(r) ?? [])).catch(() => setLinhas([]));
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
  const validas = useMemo(() => linhasUnidade.filter((a) => a.status !== 'rejeitado' && Number(a.litros) > 0), [linhasUnidade]);

  const agrupar = (chave: (a: any) => string) => {
    const m = new Map<string, { litros: number; abastecimentos: number }>();
    for (const a of validas) {
      const k = chave(a);
      const cur = m.get(k) ?? { litros: 0, abastecimentos: 0 };
      cur.litros += Number(a.litros) || 0;
      cur.abastecimentos += 1;
      m.set(k, cur);
    }
    return [...m.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.litros - a.litros);
  };
  const porMaquina = useMemo(() => agrupar((a) => (a.validacao === 'manual' ? 'Modo manual (painel)' : a.maquina_nome || a.uid || '—')), [validas]);
  const porOperador = useMemo(() => agrupar((a) => (a.validacao === 'manual' ? 'Modo manual (painel)' : a.operador_nome || a.matricula || '—')), [validas]);
  const totalLitros = porMaquina.reduce((s, x) => s + x.litros, 0);
  const litrosManual = porMaquina.find((x) => x.nome === 'Modo manual (painel)')?.litros ?? 0;

  const Agregado = ({ titulo, dados, col }: { titulo: string; dados: typeof porMaquina; col: string }) => (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm font-medium"><Fuel className="h-4 w-4" />{titulo}</div>
      <Table>
        <TableHeader><TableRow><TableHead>{col}</TableHead><TableHead>Abastecimentos</TableHead><TableHead>Litros</TableHead></TableRow></TableHeader>
        <TableBody>
          {dados.map((x) => (
            <TableRow key={x.nome}><TableCell>{x.nome}</TableCell><TableCell>{x.abastecimentos}</TableCell><TableCell>{x.litros.toFixed(1)}</TableCell></TableRow>
          ))}
          {dados.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Sem abastecimentos.</TableCell></TableRow>}
          {dados.length > 0 && <TableRow className="font-medium"><TableCell>Total</TableCell><TableCell /><TableCell>{dados.reduce((s, x) => s + x.litros, 0).toFixed(1)}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );

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
          {bombasDaUnidade.length} bomba(s){unidadeId ? ' na unidade' : ''} · {totalLitros.toFixed(1)} L
          {litrosManual > 0 ? ` (${litrosManual.toFixed(1)} L em modo manual)` : ''}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Agregado titulo={`Consumo por máquina${unidadeId ? ' (todas as bombas da unidade)' : ''}`} dados={porMaquina} col="Máquina" />
        <Agregado titulo="Consumo por operador" dados={porOperador} col="Operador" />
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">Transações</div>
        <Table>
          <TableHeader><TableRow><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Bomba</TableHead><TableHead>Máquina</TableHead><TableHead>Operador</TableHead><TableHead>Litros</TableHead><TableHead>Nível</TableHead><TableHead>Encerrado por</TableHead><TableHead>Validação</TableHead></TableRow></TableHeader>
          <TableBody>
            {linhasUnidade.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs">{a.inicio ?? a.created_at}</TableCell>
                <TableCell className="text-xs">{a.fim ?? '—'}</TableCell>
                <TableCell>{nomeBomba.get(String(a.equipamento_id)) ?? '—'}</TableCell>
                <TableCell>{a.validacao === 'manual' ? <span className="text-orange-600">manual</span> : (a.maquina_nome ?? a.uid ?? '—')}</TableCell>
                <TableCell>{a.operador_nome ?? a.matricula ?? '—'}</TableCell>
                <TableCell>{a.litros != null ? Number(a.litros).toFixed(1) : '—'}</TableCell>
                <TableCell className="text-xs">{a.nivel_antes != null && Number(a.nivel_antes) >= 0 ? `${Number(a.nivel_antes).toFixed(0)}→${Number(a.nivel_depois ?? 0).toFixed(0)}%` : '—'}</TableCell>
                <TableCell className="text-xs">{motivo(a.fim_motivo ?? a.status)}</TableCell>
                <TableCell className="text-xs">{a.validacao ?? '—'}</TableCell>
              </TableRow>
            ))}
            {linhasUnidade.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground text-sm">Sem transações.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default AbastecimentoReport;
