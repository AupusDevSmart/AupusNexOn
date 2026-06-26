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
    <div className="flex h-full flex-col gap-2 overflow-y-auto px-2 pb-2 pt-1 sm:px-3 xl:overflow-hidden">
      {/* Esquerda: diagrama unifilar sozinho (altura inteira).
          Direita: KPIs -> [Grandezas | Demanda] -> grafico -> Alarmes (empilhados). */}
      <div className="grid grid-cols-1 gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.1fr_1fr]">
        {/* Diagrama unifilar — sozinho na esquerda */}
        <div className="order-1 flex min-h-[60vh] overflow-hidden rounded-sm border border-border xl:min-h-0">
          {children}
        </div>

        {/* Coluna direita — rola quando nao couber (telas baixas / notebook);
            em telas altas o grafico (flex-1) preenche e nao aparece scroll. */}
        <div className="order-2 flex flex-col gap-1.5 xl:min-h-0 xl:overflow-y-auto">
          <KpiRow unidadeId={unidadeId} />

          {/* Grandezas e Demanda lado a lado */}
          <div className="grid gap-1.5 sm:grid-cols-2">
            <GrandezasEletricasPanel unidadeId={unidadeId} />
            <DemandaFluxoPanel unidadeId={unidadeId} />
          </div>

          {/* Grafico — entre Demanda e Alarmes; preenche o que sobra mas nunca
              abaixo de uma altura util (evita espremer no notebook). */}
          <div className="flex min-h-[230px] flex-1 flex-col">
            <GraficoConfiguravelPanel unidadeId={unidadeId} />
          </div>

          {/* Alarmes — compacto, no rodape da coluna */}
          <AlarmesAtivosPanel unidadeId={unidadeId} unidadeNome={unidadeNome} />
        </div>
      </div>
    </div>
  );
}
