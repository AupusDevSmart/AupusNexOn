// src/components/ui/time-picker.tsx
// Componente customizado de seleção de hora usando Select do shadcn/ui

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value: string; // Formato: "HH:mm"
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

// Gerar opções de hora (00:00 até 23:30 com intervalos de 30 minutos)
const gerarOpcoesHora = (): string[] => {
  const opcoes: string[] = [];
  for (let h = 0; h < 24; h++) {
    opcoes.push(`${h.toString().padStart(2, "0")}:00`);
    opcoes.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return opcoes;
};

export function TimePicker({ value, onChange, label, className }: TimePickerProps) {
  const opcoes = gerarOpcoesHora();

  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-medium text-foreground mb-1 block">
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <SelectValue placeholder="Selecione" />
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {opcoes.map((hora) => (
            <SelectItem key={hora} value={hora}>
              {hora}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================================
// VERSÃO COM HORAS E MINUTOS SEPARADOS (mais granular)
// ============================================================================

interface TimePickerSplitProps {
  value: string; // Formato: "HH:mm"
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const gerarHoras = (): string[] => {
  return Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
};

const gerarMinutos = (): string[] => {
  return Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
};

export function TimePickerSplit({ value, onChange, label, className }: TimePickerSplitProps) {
  const [hora, minuto] = value.split(":");

  const handleHoraChange = (novaHora: string) => {
    onChange(`${novaHora}:${minuto}`);
  };

  const handleMinutoChange = (novoMinuto: string) => {
    onChange(`${hora}:${novoMinuto}`);
  };

  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-medium text-foreground mb-1 block">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        {/* Hora */}
        <Select value={hora} onValueChange={handleHoraChange}>
          <SelectTrigger className="h-9 w-20">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {gerarHoras().map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="flex items-center text-muted-foreground font-semibold">:</span>

        {/* Minuto */}
        <Select value={minuto} onValueChange={handleMinutoChange}>
          <SelectTrigger className="h-9 w-20">
            <SelectValue placeholder="mm" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {gerarMinutos().map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Clock className="h-4 w-4 text-muted-foreground self-center" />
      </div>
    </div>
  );
}

// ============================================================================
// VERSÃO COM PRESETS (horas comuns)
// ============================================================================

interface TimePickerPresetsProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const PRESETS_COMUNS = [
  { label: "00:00 - Meia-noite", value: "00:00" },
  { label: "06:00 - Manhã", value: "06:00" },
  { label: "08:00 - Início expediente", value: "08:00" },
  { label: "09:00", value: "09:00" },
  { label: "12:00 - Meio-dia", value: "12:00" },
  { label: "13:00", value: "13:00" },
  { label: "14:00", value: "14:00" },
  { label: "17:00", value: "17:00" },
  { label: "18:00 - Fim expediente", value: "18:00" },
  { label: "19:00", value: "19:00" },
  { label: "20:00", value: "20:00" },
  { label: "23:59 - Fim do dia", value: "23:59" },
];

export function TimePickerPresets({ value, onChange, label, className }: TimePickerPresetsProps) {
  const opcoes = gerarOpcoesHora();

  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-medium text-foreground mb-1 block">
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <SelectValue placeholder="Selecione" />
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {/* Seção de Presets */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
            Horários Comuns
          </div>
          {PRESETS_COMUNS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}

          {/* Separador */}
          <div className="my-1 border-t" />

          {/* Seção de Todas as Horas */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
            Todos os Horários
          </div>
          {opcoes.map((hora) => (
            <SelectItem key={hora} value={hora}>
              {hora}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
