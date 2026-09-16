import { useEquipamentoMqttData } from "@/hooks/useEquipamentoMqttData";
import { getEquipmentSizeInPixels } from "@/features/supervisorio/v2/utils/diagramConstants";
import type { Equipment } from "@/features/supervisorio/v2/types/diagram.types";
import { useSinopticoConfig } from "../hooks/useSinopticoConfig";

type SlotKey = "kW" | "V" | "A" | "Ia" | "Ib" | "Ic" | "Hz";
const SLOT_ORDER: SlotKey[] = ["kW", "V", "A", "Ia", "Ib", "Ic", "Hz"];
// Unidade exibida ao lado do valor (Ia/Ib/Ic sao 3 correntes -> unidade "A").
const SLOT_UNIT: Record<SlotKey, string> = {
  kW: "kW",
  V: "V",
  A: "A",
  Ia: "A",
  Ib: "A",
  Ic: "A",
  Hz: "Hz",
};

// A partir de quanto tempo sem leitura o dado é considerado VELHO (não ao vivo).
// 30 min alinha com o "fresco" do COA. Acima disso a caixa esmaece e mostra a idade
// — pra não exibir leitura de dias atrás (ex.: TON desconectada) como se fosse agora.
const STALE_MS = 30 * 60 * 1000;

function fmtIdade(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 90) return "há poucos segundos";
  const min = Math.floor(s / 60);
  if (min < 90) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 36) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

interface Ponto {
  equipamentoFonteId?: string;
  campoJson?: string;
}

/** Navega um caminho dot-notation no payload (ex.: "Pt", "power.active_total"). */
function getByPath(obj: any, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Valor ao vivo de um slot: le o MQTT do equipamento-fonte e extrai o campo. */
function PontoValor({ slot, ponto }: { slot: SlotKey; ponto: Ponto }) {
  const { data } = useEquipamentoMqttData(ponto.equipamentoFonteId ?? "");
  const dados = (data as any)?.dado?.dados;
  const raw = ponto.campoJson ? getByPath(dados, ponto.campoJson) : undefined;
  const val =
    typeof raw === "number" ? raw.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "--";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-semibold">{val}</span>
      <span className="text-[11px] opacity-60">{SLOT_UNIT[slot] ?? slot}</span>
    </div>
  );
}

/**
 * Caixa de dados ao lado de um no do diagrama (R8). Le os pontos configurados
 * (configuracoes.diagramaPontos) e mostra os valores MQTT ao vivo de cada slot.
 * Renderiza nada se o no nao tem pontos configurados. Quando a última leitura da
 * fonte passa de STALE_MS, a caixa esmaece e ganha uma linha "há N" — o dado é
 * exibido, mas marcado como NÃO ao vivo.
 */
export function DiagramaPontosBox({ equipment }: { equipment: Equipment }) {
  const { diagramaPontos } = useSinopticoConfig(equipment.unidadeId);
  const pontos = (diagramaPontos[equipment.id?.trim()] ?? {}) as Record<string, Ponto>;
  const slots = SLOT_ORDER.filter((s) => pontos[s]?.equipamentoFonteId && pontos[s]?.campoJson);

  // Frescor pela fonte principal (1º slot) — assina o mesmo equipamento e lê o
  // timestamp da última leitura (fetch inicial + eventos WebSocket).
  const fonteId = slots.map((s) => pontos[s]?.equipamentoFonteId).find(Boolean) ?? "";
  const { lastUpdate } = useEquipamentoMqttData(fonteId);
  const idadeMs = lastUpdate ? Date.now() - lastUpdate.getTime() : null;
  const stale = idadeMs != null && idadeMs > STALE_MS;

  if (!slots.length) return null;

  const size = getEquipmentSizeInPixels(equipment.tipo);

  return (
    <foreignObject
      x={size.width + 8}
      y={0}
      width={170}
      height={size.height}
      style={{ overflow: "visible" }}
      pointerEvents="none"
    >
      {/* h-full + items-center centra a caixa na altura do icone */}
      <div className="flex h-full items-center">
        <div
          className={`inline-block rounded-sm border bg-card/90 px-2 py-1.5 text-[13px] leading-snug tabular-nums shadow-sm ${
            stale
              ? "border-amber-400/60 text-muted-foreground"
              : "border-border text-foreground"
          }`}
          title={stale && lastUpdate ? `Última leitura ${lastUpdate.toLocaleString("pt-BR")}` : undefined}
        >
          <div className={stale ? "opacity-60" : undefined}>
            {slots.map((s) => (
              <PontoValor key={s} slot={s} ponto={pontos[s]} />
            ))}
          </div>
          {stale && idadeMs != null && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-500">
              <span>⚠</span>
              <span>{fmtIdade(idadeMs)}</span>
            </div>
          )}
        </div>
      </div>
    </foreignObject>
  );
}
