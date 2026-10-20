import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, FileBarChart2, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useEstadoLembrado } from '@/hooks/useEstadoLembrado';
import type { EscopoRelatorio, RelatorioOperacao, TipoRelatorioOperacao } from './tipos';
import { buscarEscopos, buscarRelatorio, mensagemErro } from './api';
import { RelatorioOperacaoDoc } from './RelatorioOperacaoDoc';
import { TIPOS_RELATORIO, ehTipo, opcoesMes } from './catalogo';
import { EscalaA4 } from './EscalaA4';
import { mesExtenso } from './formatos';
import { baixarPlanilha } from './planilha';

/** Aba "Operação" da área de Relatórios: irrigação, geração, consumo e recargas por unidade e mês. */
export function RelatorioOperacaoTab() {
  const meses = useMemo(() => opcoesMes(), []);
  const [tipoSalvo, setTipo] = useEstadoLembrado<string>('relatorios:operacao:tipo', 'irrigacao');
  const tipo: TipoRelatorioOperacao = ehTipo(tipoSalvo) ? tipoSalvo : 'irrigacao';
  const [unidadePorTipo, setUnidadePorTipo] = useEstadoLembrado<Record<string, string>>('relatorios:operacao:unidade', {});
  const unidadeId = unidadePorTipo[tipo] ?? '';
  const [mes, setMes] = useState<string>(() => meses[1]);

  const [escopos, setEscopos] = useState<EscopoRelatorio[] | null>(null);
  const [erroEscopos, setErroEscopos] = useState('');
  const [dados, setDados] = useState<RelatorioOperacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [baixandoPlanilha, setBaixandoPlanilha] = useState(false);

  useEffect(() => {
    let vivo = true;
    setEscopos(null);
    setErroEscopos('');
    buscarEscopos(tipo)
      .then((e) => vivo && setEscopos(Array.isArray(e) ? e : []))
      .catch((e) => {
        if (!vivo) return;
        setEscopos([]);
        setErroEscopos(mensagemErro(e, 'Não foi possível carregar as unidades.'));
      });
    return () => {
      vivo = false;
    };
  }, [tipo]);

  // Unidade lembrada que não existe mais para este tipo: limpa.
  const unidadeValida = !!unidadeId && !!escopos?.some((e) => e.unidadeId === unidadeId);

  useEffect(() => {
    if (!unidadeValida) {
      setDados(null);
      setErro('');
      return;
    }
    let vivo = true;
    setCarregando(true);
    setErro('');
    setDados(null);
    buscarRelatorio(tipo, unidadeId, mes, 'tela')
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(mensagemErro(e, 'Não foi possível gerar o relatório desta unidade.')))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [tipo, unidadeId, mes, unidadeValida]);

  const escolherUnidade = (id: string) => setUnidadePorTipo((m) => ({ ...m, [tipo]: id }));

  const abrirPdf = () => {
    if (!unidadeValida) return;
    const q = new URLSearchParams({ tipo, unidadeId, mes });
    window.open(`/relatorios/operacao/imprimir?${q.toString()}`, '_blank', 'noopener');
  };

  const baixar = async () => {
    if (!unidadeValida) return;
    setBaixandoPlanilha(true);
    setErro('');
    try {
      // Busca de novo com formato=xlsx para ficar na trilha de exportações.
      const d = await buscarRelatorio(tipo, unidadeId, mes, 'xlsx');
      await baixarPlanilha(tipo, d);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível gerar a planilha.'));
    } finally {
      setBaixandoPlanilha(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Relatório
          <Select value={tipo} onValueChange={(v) => setTipo(v)}>
            <SelectTrigger className="w-full lg:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_RELATORIO.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Planta · Unidade
          <Select value={unidadeValida ? unidadeId : ''} onValueChange={escolherUnidade} disabled={!escopos || escopos.length === 0}>
            <SelectTrigger className="w-full lg:w-[340px]">
              <SelectValue
                placeholder={
                  escopos == null ? 'Carregando unidades…' : escopos.length ? 'Selecione a unidade…' : 'Nenhuma unidade com este tipo de equipamento'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(escopos ?? []).map((e) => (
                <SelectItem key={e.unidadeId} value={e.unidadeId}>
                  {e.plantaNome} · {e.unidadeNome}
                  <span className="ml-1 text-xs text-muted-foreground">({e.equipamentos})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mês
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m, i) => (
                <SelectItem key={m} value={m}>
                  {mesExtenso(m)}
                  {i === 0 ? ' (parcial)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Button variant="outline" className="flex-1 lg:flex-none" onClick={abrirPdf} disabled={!dados || carregando}>
            <FileText className="mr-1 h-4 w-4" />
            Baixar PDF
          </Button>
          <Button variant="outline" className="flex-1 lg:flex-none" onClick={baixar} disabled={!dados || carregando || baixandoPlanilha}>
            {baixandoPlanilha ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            Baixar planilha
          </Button>
        </div>
      </div>

      {(erro || erroEscopos) && (
        <div role="alert" className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro || erroEscopos}
        </div>
      )}

      {!unidadeValida && escopos != null && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center text-muted-foreground">
          <FileBarChart2 className="h-8 w-8 opacity-50" />
          <p className="px-4 text-sm">
            {escopos.length
              ? 'Selecione a planta e a unidade para ver o relatório do mês.'
              : 'Nenhuma unidade com equipamento deste tipo no seu acesso.'}
          </p>
        </div>
      )}

      {carregando && (
        <div className="mx-auto w-full max-w-[794px] space-y-3 rounded-md border bg-card p-4" aria-busy="true" aria-label="Gerando relatório">
          <Skeleton className="h-8 w-2/3" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {/* Troca de tipo: os dados antigos ainda estão no estado até o efeito limpar. */}
      {dados && !carregando && dados.cabecalho.tipo === tipo && (
        <EscalaA4>
          <RelatorioOperacaoDoc tipo={tipo} dados={dados} />
        </EscalaA4>
      )}
    </div>
  );
}

export default RelatorioOperacaoTab;
