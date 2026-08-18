// @ts-nocheck — RelatorioConsumo é um componente .jsx sem tipos (portado do designer).
import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, FileBarChart2, FileText } from 'lucide-react';
import { api } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RelatorioConsumo from './RelatorioConsumo.jsx';
import './relatorio-consumo.css';

const unwrap = (r: any) => r?.data?.data ?? r?.data;

interface UnidadeElegivel {
  id: string;
  nome: string;
  ultima: string | null;
}

function online(ultima: string | null): boolean {
  if (!ultima) return false;
  return Date.now() - new Date(ultima).getTime() < 30 * 60 * 1000;
}
function fmtUltima(ultima: string | null): string {
  if (!ultima) return 'sem leitura';
  const d = new Date(ultima);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Relatório de Gestão de Energia (CONSUMO) POR UNIDADE. Seleciona uma unidade medida
 * (M160/Power Meter) → backend monta o payload real da semana anterior. Unidades OFF no
 * momento também aparecem (têm o medidor). Sem seleção: nada é mostrado (nada de dados fake).
 */
export function ConsumoReportPreview() {
  const [unidades, setUnidades] = useState<UnidadeElegivel[]>([]);
  const [unidadeId, setUnidadeId] = useState<string>('');
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [erro, setErro] = useState<string>('');

  const abrirPdf = async () => {
    if (!unidadeId) return;
    setErro('');
    setCarregandoPdf(true);
    try {
      const r = await api.get(`/relatorios/consumo/preview?unidadeId=${encodeURIComponent(unidadeId)}&formato=pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      let msg = 'Falha ao gerar o PDF';
      try {
        const txt = e?.response?.data && (await e.response.data.text?.());
        if (txt) msg = JSON.parse(txt)?.message || msg;
      } catch {
        /* */
      }
      setErro(msg);
    } finally {
      setCarregandoPdf(false);
    }
  };

  useEffect(() => {
    api
      .get('/relatorios/consumo/unidades')
      .then((r) => setUnidades(unwrap(r) ?? []))
      .catch(() => setUnidades([]));
  }, []);

  useEffect(() => {
    if (!unidadeId) {
      setDados(null);
      setErro('');
      return;
    }
    setLoading(true);
    setErro('');
    setDados(null);
    api
      .get(`/relatorios/consumo/dados?unidadeId=${encodeURIComponent(unidadeId)}`)
      .then((r) => setDados(unwrap(r)))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao gerar o relatório desta unidade.'))
      .finally(() => setLoading(false));
  }, [unidadeId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">Unidade:</span>
        <Select value={unidadeId} onValueChange={setUnidadeId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue
              placeholder={unidades.length ? 'Selecione uma unidade medida…' : 'Nenhuma unidade medida disponível'}
            />
          </SelectTrigger>
          <SelectContent>
            {unidades.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${online(u.ultima) ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                    title={online(u.ultima) ? 'online' : 'off'}
                  />
                  {u.nome}
                  <span className="text-xs text-muted-foreground">· {fmtUltima(u.ultima)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={abrirPdf} disabled={!unidadeId || carregandoPdf || loading}>
          {carregandoPdf ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}Abrir PDF
        </Button>
        {loading && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> gerando…
          </span>
        )}
      </div>

      {dados && (
        <p className="text-sm text-muted-foreground">
          <b>Dados reais</b> da semana anterior • medidor: <b>{dados?.unidade?.ponto ?? '—'}</b>. Disponibilidade/FIC/DIC
          são de <b>medição</b> (gaps de leitura, não SAIDI/SAIFI); tempo por posto e acionamentos ainda aproximados.
        </p>
      )}

      {erro && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {!unidadeId && !loading && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center text-muted-foreground">
          <FileBarChart2 className="h-8 w-8 opacity-50" />
          <p className="text-sm">Selecione uma unidade medida para ver o relatório de gestão de energia.</p>
        </div>
      )}

      {dados && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ background: '#fff', width: 'fit-content', margin: '0 auto', boxShadow: '0 1px 8px rgba(0,0,0,.12)' }}>
            <RelatorioConsumo dados={dados} logo={undefined} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsumoReportPreview;
