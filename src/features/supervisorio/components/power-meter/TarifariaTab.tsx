import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfiguracaoCusto } from "@/hooks/useConfiguracaoCusto";
import type { ConfiguracaoCustoDto } from "@/types/dtos/custos-energia-dto";
import { Clock, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Formata hora decimal em HH:MM (ex: 21.5 -> "21:30", 18 -> "18:00"). */
function formatHoraDecimal(h: number): string {
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  if (minutos === 60) {
    return `${String((horas + 1) % 24).padStart(2, "0")}:00`;
  }
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

interface TarifariaTabProps {
  equipamentoId: string | null;
}

// Estado local do form. Strings pra deixar input controlado sem warning,
// converte pra number so no submit. null no DTO = campo nao usado.
interface FormState {
  // Tributos (decimal: 0.18 = 18%) — UI exibe em % (multiplica por 100).
  pis: string;
  cofins: string;
  icms: string;
  perdas: string; // %
  usa_tarifa_personalizada: boolean;
  // Grupo A — Ponta / Fora Ponta / Demanda (R$ por kWh).
  tusd_p: string; te_p: string;
  tusd_fp: string; te_fp: string;
  tusd_d: string; te_d: string;
  // Grupo B (R$ por kWh).
  tusd_b: string; te_b: string;
}

const EMPTY: FormState = {
  pis: "",
  cofins: "",
  icms: "",
  perdas: "",
  usa_tarifa_personalizada: false,
  tusd_p: "", te_p: "",
  tusd_fp: "", te_fp: "",
  tusd_d: "", te_d: "",
  tusd_b: "", te_b: "",
};

const ptBrNum = (v: string): number | null => {
  if (!v.trim()) return null;
  const normalized = v.replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const fromDto = (c: ConfiguracaoCustoDto | null): FormState => {
  if (!c) return EMPTY;
  // tributos vem decimal (0.18), exibe como 18.
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : (v * 100).toString();
  const raw = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : v.toString();
  return {
    pis: pct(c.pis),
    cofins: pct(c.cofins),
    icms: pct(c.icms),
    perdas: raw(c.perdas), // perdas ja vem em %
    usa_tarifa_personalizada: !!c.usa_tarifa_personalizada,
    tusd_p: raw(c.tusd_p), te_p: raw(c.te_p),
    tusd_fp: raw(c.tusd_fp), te_fp: raw(c.te_fp),
    tusd_d: raw(c.tusd_d), te_d: raw(c.te_d),
    tusd_b: raw(c.tusd_b), te_b: raw(c.te_b),
  };
};

const toDto = (f: FormState): Partial<ConfiguracaoCustoDto> => {
  const pctToDec = (v: string): number | undefined => {
    const n = ptBrNum(v);
    return n === null ? undefined : n / 100;
  };
  const num = (v: string): number | null | undefined => {
    if (!v.trim()) return null;
    const n = ptBrNum(v);
    return n === null ? undefined : n;
  };
  return {
    pis: pctToDec(f.pis),
    cofins: pctToDec(f.cofins),
    icms: pctToDec(f.icms),
    perdas: ptBrNum(f.perdas) ?? undefined,
    usa_tarifa_personalizada: f.usa_tarifa_personalizada,
    tusd_p: num(f.tusd_p),
    te_p: num(f.te_p),
    tusd_fp: num(f.tusd_fp),
    te_fp: num(f.te_fp),
    tusd_d: num(f.tusd_d),
    te_d: num(f.te_d),
    tusd_b: num(f.tusd_b),
    te_b: num(f.te_b),
  };
};

function CampoTarifa({
  label,
  tusdKey,
  teKey,
  form,
  setForm,
  disabled,
}: {
  label: string;
  tusdKey: keyof FormState;
  teKey: keyof FormState;
  form: FormState;
  setForm: (f: FormState) => void;
  disabled?: boolean;
}) {
  const tusd = ptBrNum(form[tusdKey] as string);
  const te = ptBrNum(form[teKey] as string);
  const total = tusd !== null && te !== null ? tusd + te : null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">TUSD</div>
          <Input
            value={form[tusdKey] as string}
            onChange={(e) => setForm({ ...form, [tusdKey]: e.target.value })}
            placeholder="0,00"
            disabled={disabled}
            inputMode="decimal"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">TE</div>
          <Input
            value={form[teKey] as string}
            onChange={(e) => setForm({ ...form, [teKey]: e.target.value })}
            placeholder="0,00"
            disabled={disabled}
            inputMode="decimal"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        Total:{" "}
        <span className="font-medium text-foreground">
          {total !== null
            ? `R$ ${total.toLocaleString("pt-BR", {
                minimumFractionDigits: 4,
                maximumFractionDigits: 5,
              })}/kWh`
            : "—"}
        </span>
      </div>
    </div>
  );
}

function CampoTributo({
  label,
  fieldKey,
  form,
  setForm,
}: {
  label: string;
  fieldKey: keyof FormState;
  form: FormState;
  setForm: (f: FormState) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={form[fieldKey] as string}
          onChange={(e) => setForm({ ...form, [fieldKey]: e.target.value })}
          placeholder="0,00"
          inputMode="decimal"
          className="h-8 text-sm"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

export function TarifariaTab({ equipamentoId }: TarifariaTabProps) {
  const { config, loading, saving, error, salvar } = useConfiguracaoCusto(equipamentoId);
  const [form, setForm] = useState<FormState>(EMPTY);

  // Sincroniza form com config carregado.
  useEffect(() => {
    setForm(fromDto(config));
  }, [config]);

  const handleSalvar = async () => {
    const ok = await salvar(toDto(form));
    if (ok) toast.success("Configuração tarifária salva.");
    else toast.error("Falha ao salvar configuração.");
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Carregando configuração...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground -mt-1">
        Configure tarifas, tributos e benefícios aplicáveis ao cálculo de custo.
        Valores TUSD e TE são gravados separadamente conforme estrutura
        regulatória ANEEL.
      </div>

      {error && (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Tarifas R$/kWh — Grupo A */}
        <Card className="rounded-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tarifas de Energia — Grupo A (R$/kWh)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CampoTarifa
              label="Fora Ponta"
              tusdKey="tusd_fp"
              teKey="te_fp"
              form={form}
              setForm={setForm}
            />
            <CampoTarifa
              label="Ponta"
              tusdKey="tusd_p"
              teKey="te_p"
              form={form}
              setForm={setForm}
            />
            <CampoTarifa
              label="Reservado / Demanda"
              tusdKey="tusd_d"
              teKey="te_d"
              form={form}
              setForm={setForm}
            />
          </CardContent>
        </Card>

        {/* Tarifas R$/kWh — Grupo B + Tributos */}
        <div className="space-y-3">
          <Card className="rounded-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tarifa — Grupo B (R$/kWh)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CampoTarifa
                label="Grupo B"
                tusdKey="tusd_b"
                teKey="te_b"
                form={form}
                setForm={setForm}
              />
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tributos (%)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <CampoTributo label="PIS" fieldKey="pis" form={form} setForm={setForm} />
              <CampoTributo label="COFINS" fieldKey="cofins" form={form} setForm={setForm} />
              <CampoTributo label="ICMS" fieldKey="icms" form={form} setForm={setForm} />
              <CampoTributo label="Perdas" fieldKey="perdas" form={form} setForm={setForm} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Horarios dos postos — somente leitura. Vem da concessionaria da
          unidade do equipamento. Edicao acontece no cadastro de concessionarias. */}
      <Card className="rounded-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Horários dos Postos Tarifários (configurados na concessionária)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Ponta</div>
            <div className="font-medium tabular-nums">
              {formatHoraDecimal(config?.horarios?.hora_inicio_ponta ?? 18)} –{" "}
              {formatHoraDecimal(config?.horarios?.hora_fim_ponta ?? 21)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Reservado</div>
            <div className="font-medium tabular-nums">
              {formatHoraDecimal(config?.horarios?.hora_inicio_reservado ?? 21.5)} –{" "}
              {formatHoraDecimal(config?.horarios?.hora_fim_reservado ?? 6)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Horário final considera o dia seguinte.
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Fora Ponta</div>
            <div className="font-medium text-muted-foreground italic">
              Calculado automaticamente
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-start gap-1">
              <Info className="h-3 w-3 mt-px shrink-0" />
              <span>
                Intervalo não abrangido pelos horários de ponta e reservado.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setForm(fromDto(config))}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={handleSalvar} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
