import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelCard } from "./PanelCard";
import { ConfigGrandezasModal } from "./ConfigGrandezasModal";
import { useGrandezasAgregadas } from "../hooks/useGrandezasAgregadas";
import { useUserStore } from "@/store/useUserStore";

interface GrandezasEletricasPanelProps {
  unidadeId: string;
}

function fmt(v: number | null | undefined, dec = 0): string | undefined {
  if (v == null) return undefined;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Linha rotulo + valor para a grade de grandezas. */
function Grandeza({ rotulo, valor, unidade, carregando }: { rotulo: string; valor?: string; unidade?: string; carregando?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      {carregando ? (
        <Skeleton className="h-3.5 w-12 rounded-sm" />
      ) : (
      <span className="text-sm font-medium text-foreground tabular-nums">
        {valor ?? "--"}
        {unidade && <span className="ml-1 text-xs font-normal text-muted-foreground">{unidade}</span>}
      </span>
      )}
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
  const { grandezas, loading } = useGrandezasAgregadas(unidadeId);
  // Só a primeira carga: nos polls seguintes o valor antigo fica até o novo chegar.
  const sk = loading && !grandezas;
  const [configOpen, setConfigOpen] = useState(false);
  // Escolher os medidores grava no diagrama (PATCH /diagramas/:id): cadastro técnico (NEXON-20).
  const podeConfigurar = useUserStore((s) => s.capacidades.cadastroTecnico);
  const t = grandezas?.tensoes;
  const c = grandezas?.correntes;

  return (
    <>
      <PanelCard
        titulo="Grandezas elétricas"
        className="xl:min-h-0"
        action={
          podeConfigurar ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Configurar medidores"
            onClick={() => setConfigOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          ) : undefined
        }
      >
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Bloco titulo="Tensões (L-N)">
          <Grandeza carregando={sk} rotulo="Van" valor={fmt(t?.AN, 0)} unidade="V" />
          <Grandeza carregando={sk} rotulo="Vbn" valor={fmt(t?.BN, 0)} unidade="V" />
          <Grandeza carregando={sk} rotulo="Vcn" valor={fmt(t?.CN, 0)} unidade="V" />
        </Bloco>
        <Bloco titulo="Correntes">
          <Grandeza carregando={sk} rotulo="IA" valor={fmt(c?.IA, 1)} unidade="A" />
          <Grandeza carregando={sk} rotulo="IB" valor={fmt(c?.IB, 1)} unidade="A" />
          <Grandeza carregando={sk} rotulo="IC" valor={fmt(c?.IC, 1)} unidade="A" />
        </Bloco>
        {/* Desequilibrio (sem titulo de bloco): Tensao a esquerda, Corrente a direita */}
        <div className="col-span-2 grid grid-cols-2 gap-x-4">
          <Grandeza carregando={sk} rotulo="Desequilíbrio Tensão" valor={fmt(grandezas?.desequilibrioTensao, 1)} unidade="%" />
          <Grandeza carregando={sk} rotulo="Desequilíbrio Corrente" valor={fmt(grandezas?.desequilibrioCorrente, 1)} unidade="%" />
        </div>
      </div>
      </PanelCard>
      {podeConfigurar && <ConfigGrandezasModal open={configOpen} onOpenChange={setConfigOpen} unidadeId={unidadeId} />}
    </>
  );
}
