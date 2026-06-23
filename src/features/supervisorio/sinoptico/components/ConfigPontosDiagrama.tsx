import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RegrasLogsService } from "@/services/regras-logs.services";
import { useSinopticoConfig } from "../hooks/useSinopticoConfig";
import { useEquipamentosMqtt, type EquipamentoMqtt } from "../hooks/useEquipamentosMqtt";

type SlotKey = "kW" | "V" | "A" | "Hz";

interface PontoVal {
  equipamentoFonteId?: string;
  campoJson?: string;
}

const EMPTY_EQUIP: EquipamentoMqtt[] = [];

const SLOT_LABEL: Record<SlotKey, string> = {
  kW: "Potência (kW)",
  V: "Tensão (V)",
  A: "Corrente (A)",
  Hz: "Frequência (Hz)",
};

/** Slots por categoria do no (decisao R8). Decisao por CATEGORIA, nao por codigo. */
function slotsParaCategoria(categoria: string | null | undefined): SlotKey[] {
  const c = (categoria ?? "").toLowerCase();
  if (c.includes("inversor")) return ["kW", "V", "A"];
  if (c.includes("transformador")) return ["kW", "V", "A"];
  if (c.includes("disjuntor")) return ["A"];
  if (c.includes("power meter") || c.includes("medidor")) return ["kW", "V", "A"];
  return ["kW", "V", "A"];
}

/** Linha de um slot: escolhe o equipamento-fonte (MQTT) e o campo do JSON dele. */
function SeletorPonto({
  slot,
  equipamentos,
  value,
  onChange,
}: {
  slot: SlotKey;
  equipamentos: EquipamentoMqtt[];
  value: PontoVal;
  onChange: (v: PontoVal) => void;
}) {
  const fonteId = value.equipamentoFonteId;

  // Campos do JSON do equipamento-fonte (mesma logica das regras de log).
  const { data: campos = [] } = useQuery({
    queryKey: ["sinoptico-campos", fonteId],
    queryFn: () => RegrasLogsService.getCampos(fonteId!),
    enabled: !!fonteId,
    staleTime: 60_000,
  });

  const equipOptions = equipamentos.map((e) => ({ value: e.id, label: e.nome }));
  const campoOptions = campos.map((c) => ({ value: c.path, label: `${c.path} (${c.ultimoValor})` }));

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      <span className="text-xs font-medium text-muted-foreground">{SLOT_LABEL[slot]}</span>
      <Combobox
        className="min-w-0"
        options={equipOptions}
        value={fonteId ?? ""}
        onValueChange={(id) => onChange({ equipamentoFonteId: id, campoJson: "" })}
        placeholder="Equipamento"
        searchPlaceholder="Buscar equipamento..."
        emptyText="Nenhum equipamento MQTT"
      />
      <Combobox
        className="min-w-0"
        options={campoOptions}
        value={value.campoJson ?? ""}
        onValueChange={(campo) => onChange({ equipamentoFonteId: fonteId, campoJson: campo })}
        placeholder={fonteId ? "Campo do JSON" : "Selecione o equipamento"}
        searchPlaceholder="Buscar campo..."
        emptyText="Nenhum campo"
        disabled={!fonteId}
      />
    </div>
  );
}

/**
 * Seção "Configurar pontos" das caixas de dados do diagrama (R8).
 * Slots por categoria; cada slot aponta para um equipamento MQTT + campo do JSON.
 * Persiste em configuracoes.diagramaPontos[equipamentoId]. Renderizar so para quem edita.
 */
export function ConfigPontosDiagrama({
  unidadeId,
  equipamentoId,
  categoria,
}: {
  unidadeId: string;
  equipamentoId: string;
  categoria?: string;
}) {
  const { diagramaPontos, salvarPontos } = useSinopticoConfig(unidadeId);
  const equipamentos = useEquipamentosMqtt(unidadeId).data ?? EMPTY_EQUIP;
  const slots = slotsParaCategoria(categoria);

  const [pontos, setPontos] = useState<Record<string, PontoVal>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setPontos((diagramaPontos[equipamentoId.trim()] as Record<string, PontoVal>) ?? {});
  }, [diagramaPontos, equipamentoId]);

  const setSlot = (slot: SlotKey, v: PontoVal) =>
    setPontos((prev) => ({ ...prev, [slot]: v }));

  const onSalvar = async () => {
    try {
      setSalvando(true);
      // Mantem apenas slots completos (equipamento + campo).
      const limpo: Record<string, { equipamentoFonteId: string; campoJson: string }> = {};
      for (const s of slots) {
        const v = pontos[s];
        if (v?.equipamentoFonteId && v?.campoJson) {
          limpo[s] = { equipamentoFonteId: v.equipamentoFonteId, campoJson: v.campoJson };
        }
      }
      await salvarPontos(equipamentoId, limpo);
      toast.success("Pontos do diagrama salvos");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar pontos");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Escolha o equipamento e o campo do JSON que alimentam cada caixa de dados deste item no diagrama.
      </p>
      <div className="flex flex-col gap-2">
        {slots.map((slot) => (
          <SeletorPonto
            key={slot}
            slot={slot}
            equipamentos={equipamentos}
            value={pontos[slot] ?? {}}
            onChange={(v) => setSlot(slot, v)}
          />
        ))}
      </div>
      <Button size="sm" className="self-end rounded-sm" onClick={onSalvar} disabled={salvando}>
        Salvar pontos
      </Button>
    </div>
  );
}
