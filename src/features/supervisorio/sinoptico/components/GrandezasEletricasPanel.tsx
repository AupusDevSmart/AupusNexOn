import { useState } from "react";
import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelCard } from "./PanelCard";
import { ConfigGrandezasModal } from "./ConfigGrandezasModal";
import { useGrandezasAgregadas } from "../hooks/useGrandezasAgregadas";

interface GrandezasEletricasPanelProps {
  unidadeId: string;
}

function fmt(v: number | null | undefined, dec = 0): string | undefined {
  if (v == null) return undefined;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Linha rotulo + valor para a grade de grandezas. */
function Grandeza({ rotulo, valor, unidade }: { rotulo: string; valor?: string; unidade?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">
        {valor ?? "--"}
        {unidade && <span className="ml-1 text-xs font-normal text-muted-foreground">{unidade}</span>}
      </span>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {titulo}
      </span>
      {children}
    </div>
  );
}

/**
 * Painel de grandezas elétricas detalhadas (R3), agregado dos mesmos PMs da R2.
 * Campos reais do M160: tensão L-N (Va/Vb/Vc) e correntes (Ia/Ib/Ic);
 * desequilíbrio é calculado. Sem L-L e sem frequência (M160 não reporta).
 */
export function GrandezasEletricasPanel({ unidadeId }: GrandezasEletricasPanelProps) {
  const { grandezas } = useGrandezasAgregadas(unidadeId);
  const [configOpen, setConfigOpen] = useState(false);
  const t = grandezas?.tensoes;
  const c = grandezas?.correntes;

  return (
    <>
      <PanelCard
        titulo="Grandezas elétricas"
        className="xl:flex-[1] xl:min-h-0"
        action={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Configurar medidores"
            onClick={() => setConfigOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        }
      >
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Bloco titulo="Tensões (L-N)">
          <Grandeza rotulo="AN" valor={fmt(t?.AN, 0)} unidade="V" />
          <Grandeza rotulo="BN" valor={fmt(t?.BN, 0)} unidade="V" />
          <Grandeza rotulo="CN" valor={fmt(t?.CN, 0)} unidade="V" />
        </Bloco>
        <Bloco titulo="Correntes">
          <Grandeza rotulo="IA" valor={fmt(c?.IA, 1)} unidade="A" />
          <Grandeza rotulo="IB" valor={fmt(c?.IB, 1)} unidade="A" />
          <Grandeza rotulo="IC" valor={fmt(c?.IC, 1)} unidade="A" />
        </Bloco>
        <Bloco titulo="Desequilíbrio">
          <Grandeza rotulo="Tensão" valor={fmt(grandezas?.desequilibrioTensao, 1)} unidade="%" />
          <Grandeza rotulo="Corrente" valor={fmt(grandezas?.desequilibrioCorrente, 1)} unidade="%" />
        </Bloco>
      </div>
      </PanelCard>
      <ConfigGrandezasModal open={configOpen} onOpenChange={setConfigOpen} unidadeId={unidadeId} />
    </>
  );
}
