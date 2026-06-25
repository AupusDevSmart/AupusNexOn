import { Activity, Gauge, Waves, Zap } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { useGrandezasAgregadas } from "../hooks/useGrandezasAgregadas";

interface KpiRowProps {
  unidadeId: string;
}

function fmt(v: number | null | undefined, dec = 0): string | undefined {
  if (v == null) return undefined;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/**
 * Faixa de KPIs agregados dos Power Meters (R2).
 * Campos reais do M160: Pt (kW), Va/Vb/Vc (L-N), Ia/Ib/Ic, FP = Pt/St.
 * Frequência e L-L não existem no M160 (decisão: removidos).
 */
export function KpiRow({ unidadeId }: KpiRowProps) {
  const { grandezas, loading } = useGrandezasAgregadas(unidadeId);

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      <KpiCard
        icon={Zap}
        titulo="Potência líquida"
        abrev="Pot."
        valor={fmt(grandezas?.potenciaKw, 1)}
        unidade="kW"
        legenda="Soma dos medidores"
        loading={loading}
      />
      <KpiCard
        icon={Activity}
        titulo="Tensão média (L-N)"
        abrev="Tensão"
        valor={fmt(grandezas?.tensaoMediaLN, 0)}
        unidade="V"
        legenda="Média dos medidores"
        loading={loading}
      />
      <KpiCard
        icon={Gauge}
        titulo="Fator de potência"
        abrev="FP"
        valor={grandezas?.fatorPotencia != null ? grandezas.fatorPotencia.toFixed(2) : undefined}
        legenda="Pt / St dos medidores"
        loading={loading}
      />
      <KpiCard
        icon={Waves}
        titulo="Corrente média"
        abrev="Corr."
        valor={fmt(grandezas?.correnteMedia, 1)}
        unidade="A"
        legenda="Média das fases dos medidores"
        loading={loading}
      />
    </div>
  );
}
