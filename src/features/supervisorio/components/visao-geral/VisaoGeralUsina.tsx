import { useEffect, useState, type ReactNode } from 'react';
import { Info, Sun, Zap } from 'lucide-react';
import { coaApi, type UnidadeResumo } from '@/features/coa/api/coa-api';
import { formatEnergy } from '@/utils/formatEnergy';
import { GeracaoHistoricoChart } from './GeracaoHistoricoChart';
import { KpiRow } from '@/features/supervisorio/sinoptico/components/KpiRow';
import { GrandezasEletricasPanel } from '@/features/supervisorio/sinoptico/components/GrandezasEletricasPanel';
import { DemandaFluxoPanel } from '@/features/supervisorio/sinoptico/components/DemandaFluxoPanel';
import { GraficoConfiguravelPanel } from '@/features/supervisorio/sinoptico/components/GraficoConfiguravelPanel';
import { ElementosScsCards } from './ElementosScsCards';

/**
 * Visão geral da usina no sinóptico — mostrada ao cliente no lugar do unifilar (por
 * enquanto). Traz os números gerais com ou sem TON: sem telemetria ao vivo, cai para
 * a integração de nuvem do fabricante (fallback do COA). Não há visão por inversor —
 * integrações como a da Sungrow só entregam os totais da usina.
 * Os números vêm do mesmo cálculo do COA (/coa/dashboard), então batem com o mapa.
 */
type Unidade = UnidadeResumo & { plantaNome?: string };

const nf = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function situacao(u: Unidade): { rotulo: string; detalhe: string; cls: string } {
  if (u.fonteDados === 'nuvem') {
    const hh = u.nuvemAtualizadoEm ? u.nuvemAtualizadoEm.slice(11, 16) : null;
    return {
      rotulo: 'Via nuvem',
      detalhe: hh ? `atualizado às ${hh}` : 'integração do fabricante',
      cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    };
  }
  if (u.status === 'ONLINE') return { rotulo: 'Tempo real', detalhe: 'telemetria ao vivo', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' };
  if (u.status === 'ALERTA') return { rotulo: 'Atenção', detalhe: 'parte dos equipamentos sem comunicação', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' };
  return { rotulo: 'Sem comunicação', detalhe: 'nenhum dado recente', cls: 'bg-muted text-muted-foreground' };
}

function Kpi({ icone, rotulo, valor, detalhe }: { icone: ReactNode; rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icone}
        {rotulo}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{valor}</div>
      {detalhe && <div className="mt-0.5 text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

export function VisaoGeralUsina({ unidadeId, unidadeNome }: { unidadeId: string; unidadeNome?: string }) {
  const [u, setU] = useState<Unidade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    const alvo = (unidadeId ?? '').trim();
    const carregar = async () => {
      try {
        const d = await coaApi.getDashboard();
        let achada: Unidade | null = null;
        for (const pl of d?.plantas ?? []) {
          const x = pl.unidades.find((un) => String(un.id).trim() === alvo);
          if (x) { achada = { ...x, plantaNome: pl.nome }; break; }
        }
        if (vivo) setU(achada);
      } catch {
        if (vivo) setU(null);
      } finally {
        if (vivo) setLoading(false);
      }
    };
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, [unidadeId]);

  const s = u ? situacao(u) : null;
  // Tem TON ao vivo? (fonteDados='ton'). 'nuvem' = só fallback do fabricante (totais).
  const temTon = u?.fonteDados === 'ton';

  return (
    <div className="h-full space-y-4 overflow-auto p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{unidadeNome || u?.nome || 'Usina'}</h2>
          {u?.plantaNome && <p className="text-xs text-muted-foreground">{u.plantaNome}</p>}
        </div>
        {s && (
          <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
            {s.rotulo} · {s.detalhe}
          </span>
        )}
      </div>

      {loading && !u ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-lg border bg-muted/40" />)}
        </div>
      ) : !u ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sem dados desta unidade no momento.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Kpi
            icone={<Zap className="h-3.5 w-3.5" />}
            rotulo="Potência atual"
            valor={`${nf(u.metricas.potenciaAtual)} kW`}
            detalhe={u.fonteDados === 'nuvem' ? 'média da última hora' : undefined}
          />
          <Kpi icone={<Sun className="h-3.5 w-3.5" />} rotulo="Energia hoje" valor={formatEnergy(u.metricas.energiaHoje)} />
        </div>
      )}

      {/* Equipamentos do unifilar com SCS habilitado, em cards-ícone (auto-esconde se não houver). */}
      <ElementosScsCards unidadeId={unidadeId} />

      {/* DATA-DRIVEN: com TON ao vivo mostra o quadro elétrico completo (grandezas,
          demanda carga/geração e o gráfico Demanda/Tensão/FP). Só-nuvem cai no
          histórico de geração + nota (a nuvem só entrega os totais da usina). */}
      {temTon ? (
        <>
          {/* Grandezas agregadas dos medidores (mesma faixa que ficava em volta do unifilar). */}
          <KpiRow unidadeId={unidadeId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <GrandezasEletricasPanel unidadeId={unidadeId} />
            <DemandaFluxoPanel unidadeId={unidadeId} />
          </div>
          <div className="flex min-h-[280px] flex-col">
            <GraficoConfiguravelPanel unidadeId={unidadeId} />
          </div>
        </>
      ) : (
        <>
          <GeracaoHistoricoChart unidadeId={unidadeId} />
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Visão geral da usina. O detalhamento por inversor não aparece aqui: integrações de nuvem como a da Sungrow entregam apenas os totais da usina.
          </p>
        </>
      )}
    </div>
  );
}

export default VisaoGeralUsina;
