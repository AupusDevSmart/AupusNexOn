/**
 * Potência "agora" (último minuto) + curva da última hora — vem da parcial de 1 em 1 min
 * que a TON-V2 publica entre os blocos do medidor (ssu_minutos). Só exibição: energia e
 * demanda continuam vindo dos blocos de fim de intervalo (sincronizados com o medidor da
 * concessionária). Gateway A-966 não tem parcial → o card não aparece.
 */
import type { GatewayMinuto } from "@/hooks/useGatewayDashboard";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function Curva({ serie, corConsumo, corGeracao }: { serie: GatewayMinuto[]; corConsumo: string; corGeracao: string }) {
  if (serie.length < 2) return null;
  const W = 600, H = 70, P = 4;
  const max = Math.max(0.01, ...serie.map((s) => Math.max(s.kW_consumo, s.kW_injecao)));
  const x = (i: number) => P + (i * (W - 2 * P)) / (serie.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const linha = (k: "kW_consumo" | "kW_injecao") => serie.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(s[k]).toFixed(1)}`).join(" ");
  const temInjecao = serie.some((s) => s.kW_injecao > 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none" role="img" aria-label="Potência minuto a minuto na última hora">
      <path d={linha("kW_consumo")} fill="none" stroke={corConsumo} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {temInjecao && <path d={linha("kW_injecao")} fill="none" stroke={corGeracao} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export function AgoraMinutoCard({
  agora, serie, corConsumo, corGeracao,
}: { agora: GatewayMinuto | null; serie: GatewayMinuto[]; corConsumo: string; corGeracao: string }) {
  if (!agora && serie.length === 0) return null;
  const kvar = agora ? agora.kvar_ind - agora.kvar_cap : null;
  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agora · último minuto</span>
        <span className="text-[11px] text-muted-foreground">
          {agora ? `atualizado ${hora(agora.timestamp)}` : "sem minuto recente"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3 tabular-nums">
        <div>
          <div className="text-[11px] text-muted-foreground">Consumo</div>
          <div className="text-lg font-semibold" style={{ color: corConsumo }}>{agora ? `${fmt(agora.kW_consumo)} kW` : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Injeção</div>
          <div className="text-lg font-semibold" style={{ color: corGeracao }}>{agora ? `${fmt(agora.kW_injecao)} kW` : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Reativo</div>
          <div className="text-lg font-semibold">
            {kvar == null ? "—" : `${fmt(Math.abs(kvar))} kvar`}
            {kvar != null && kvar !== 0 && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{kvar > 0 ? "ind." : "cap."}</span>}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <Curva serie={serie} corConsumo={corConsumo} corGeracao={corGeracao} />
        {serie.length >= 2 && (
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{hora(serie[0].timestamp)}</span>
            <span>Última hora, minuto a minuto · demanda e energia continuam pelos blocos do medidor</span>
            <span>{hora(serie[serie.length - 1].timestamp)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgoraMinutoCard;
