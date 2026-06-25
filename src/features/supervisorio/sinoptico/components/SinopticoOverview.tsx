import type { ReactNode } from "react";
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
      {/* Grid 5 colunas x 2 linhas (2fr/1fr):
          - Cima (2/3): diagrama (3 col) | KPIs 2x2 + Grandezas + Demanda (2 col)
          - Baixo (1/3): grafico (3 col) | Alarmes (2 col)  -> grafico e alarmes
            ficam na MESMA linha, logo com a MESMA altura. */}
      <div className="grid grid-cols-1 gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-5 xl:[grid-template-rows:2fr_1fr]">
        {/* Diagrama: 3/5 largura, 2/3 altura */}
        <div className="order-1 flex min-h-[60vh] overflow-hidden rounded-sm border border-border xl:col-span-3 xl:col-start-1 xl:row-start-1 xl:min-h-0">
          {children}
        </div>

        {/* Grafico: 3/5 largura, 1/3 altura (mesma altura dos Alarmes) */}
        <div className="order-2 flex flex-col min-h-0 xl:col-span-3 xl:col-start-1 xl:row-start-2">
          <GraficoConfiguravelPanel unidadeId={unidadeId} />
        </div>

        {/* Direita topo (2/5, 2/3 altura): KPIs 2x2 + Grandezas + Demanda */}
        <div className="order-3 flex flex-col gap-2 xl:col-span-2 xl:col-start-4 xl:row-start-1 xl:min-h-0">
          <KpiRow unidadeId={unidadeId} />
          <GrandezasEletricasPanel unidadeId={unidadeId} />
          <DemandaFluxoPanel unidadeId={unidadeId} />
        </div>

        {/* Direita baixo (2/5, 1/3 altura): Alarmes (mesma altura do grafico) */}
        <div className="order-4 flex flex-col min-h-0 xl:col-span-2 xl:col-start-4 xl:row-start-2">
          <AlarmesAtivosPanel unidadeId={unidadeId} unidadeNome={unidadeNome} />
        </div>
      </div>
    </div>
  );
}
