import type { ReactNode } from "react";
import { SinopticoStatusBar } from "./SinopticoStatusBar";
import { KpiRow } from "./KpiRow";
import { GrandezasEletricasPanel } from "./GrandezasEletricasPanel";
import { DemandaFluxoPanel } from "./DemandaFluxoPanel";
import { AlarmesAtivosPanel } from "./AlarmesAtivosPanel";
import { GraficoConfiguravelPanel } from "./GraficoConfiguravelPanel";

interface SinopticoOverviewProps {
  unidadeId: string;
  unidadeNome?: string;
  plantaNome?: string;
  /** O diagrama unifilar (DiagramV2Wrapper) renderizado pela pagina. */
  children: ReactNode;
}

/**
 * Layout responsivo do sinoptico ao redor do diagrama unifilar.
 *
 * Mobile: coluna unica com scroll (status, KPIs, diagrama, grafico, paineis).
 * Desktop (xl+): tudo cabe em uma tela (100vh, sem scroll da pagina). Status e
 * KPIs no topo; faixa central ocupa o resto (flex-1) dividida em
 * [esquerda 2/3 = diagrama + grafico empilhados | direita 1/3 = os 3 paineis].
 * Como a coluna de paineis usa a altura inteira (diagrama + grafico), as cards
 * cabem sem scroll proprio.
 */
export function SinopticoOverview({ unidadeId, unidadeNome, children }: SinopticoOverviewProps) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto px-2 pb-2 pt-1 sm:gap-3 sm:px-3 xl:overflow-hidden">
      <SinopticoStatusBar unidadeId={unidadeId} />

      <KpiRow unidadeId={unidadeId} />

      <div className="grid grid-cols-1 gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-5 xl:[grid-template-rows:minmax(0,1fr)]">
        {/* Coluna esquerda (3/5): diagrama + grafico empilhados */}
        <div className="order-1 flex flex-col gap-2 xl:col-span-3 xl:min-h-0">
          <div className="flex min-h-[60vh] flex-1 overflow-hidden rounded-sm border border-border xl:min-h-0">
            {children}
          </div>
          <GraficoConfiguravelPanel unidadeId={unidadeId} />
        </div>

        {/* Coluna direita (2/5): os 3 paineis dividem a altura inteira (sem scroll da coluna) */}
        <div className="order-2 flex flex-col gap-2 xl:col-span-2 xl:min-h-0">
          <GrandezasEletricasPanel unidadeId={unidadeId} />
          <DemandaFluxoPanel unidadeId={unidadeId} />
          <AlarmesAtivosPanel unidadeId={unidadeId} unidadeNome={unidadeNome} />
        </div>
      </div>
    </div>
  );
}
