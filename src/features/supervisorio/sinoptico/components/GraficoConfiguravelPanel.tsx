import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";
import { SinopticoGraficosV2 } from "@/features/supervisorio/components/sinoptico-graficos-v2";

interface GraficoConfiguravelPanelProps {
  unidadeId: string;
}

type Variavel = "demanda" | "tensao" | "fp";

const VARIAVEIS: Array<{ id: Variavel; label: string }> = [
  { id: "demanda", label: "Demanda" },
  { id: "tensao", label: "Tensão" },
  { id: "fp", label: "FP" },
];

/** Botão-pílula de seleção da variável do gráfico (fica ao lado do título). */
function Pilula({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-2 py-0.5 text-[11px] font-medium transition-colors ${
        ativo ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Área de gráfico do sinóptico (R6): reusa o SinopticoGraficosV2 existente,
 * mostrando UM gráfico por vez. Os toggles Demanda/Tensão/FP são injetados
 * ao lado do título do gráfico (via controleVariavel) e o canvas fica compacto,
 * então cabe sem scroll.
 */
export function GraficoConfiguravelPanel({ unidadeId }: GraficoConfiguravelPanelProps) {
  const [variavel, setVariavel] = useState<Variavel>("demanda");

  // Demanda contratada (fallback) — o próprio gráfico sobrepõe com a config salva.
  const { data: unidade } = useQuery({
    queryKey: ["unidade-demanda", unidadeId?.trim()],
    queryFn: async () => {
      const r = await api.get(`/unidades/${unidadeId.trim()}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!unidadeId,
    staleTime: 60_000,
  });
  const valorContratado = unidade?.demandaGeracao
    ? parseFloat(String(unidade.demandaGeracao))
    : 2500;

  const toggles = (
    <div className="flex flex-wrap items-center gap-1">
      {VARIAVEIS.map((v) => (
        <Pilula key={v.id} ativo={variavel === v.id} onClick={() => setVariavel(v.id)}>
          {v.label}
        </Pilula>
      ))}
    </div>
  );

  return (
    <SinopticoGraficosV2
      unidadeId={unidadeId}
      valorContratado={valorContratado}
      percentualAdicional={5}
      apenasGrafico={variavel}
      controleVariavel={toggles}
    />
  );
}
