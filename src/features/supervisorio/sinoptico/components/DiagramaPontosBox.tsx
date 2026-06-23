import { useEquipamentoMqttData } from "@/hooks/useEquipamentoMqttData";
import { getEquipmentSizeInPixels } from "@/features/supervisorio/v2/utils/diagramConstants";
import type { Equipment } from "@/features/supervisorio/v2/types/diagram.types";
import { useSinopticoConfig } from "../hooks/useSinopticoConfig";

type SlotKey = "kW" | "V" | "A" | "Hz";
const SLOT_ORDER: SlotKey[] = ["kW", "V", "A", "Hz"];

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
      <span className="text-[11px] opacity-60">{slot}</span>
    </div>
  );
}

/**
 * Caixa de dados ao lado de um no do diagrama (R8). Le os pontos configurados
 * (configuracoes.diagramaPontos) e mostra os valores MQTT ao vivo de cada slot.
 * Renderiza nada se o no nao tem pontos configurados.
 */
export function DiagramaPontosBox({ equipment }: { equipment: Equipment }) {
  const { diagramaPontos } = useSinopticoConfig(equipment.unidadeId);
  const pontos = (diagramaPontos[equipment.id?.trim()] ?? {}) as Record<string, Ponto>;
  const slots = SLOT_ORDER.filter((s) => pontos[s]?.equipamentoFonteId && pontos[s]?.campoJson);

  if (!slots.length) return null;

  const size = getEquipmentSizeInPixels(equipment.tipo);

  return (
    <foreignObject
      x={size.width + 8}
      y={0}
      width={160}
      height={size.height}
      style={{ overflow: "visible" }}
      pointerEvents="none"
    >
      {/* h-full + items-center centra a caixa na altura do icone */}
      <div className="flex h-full items-center">
        <div className="inline-block rounded-sm border border-border bg-card/90 px-2 py-1.5 text-[13px] leading-snug text-foreground tabular-nums shadow-sm">
          {slots.map((s) => (
            <PontoValor key={s} slot={s} ponto={pontos[s]} />
          ))}
        </div>
      </div>
    </foreignObject>
  );
}
