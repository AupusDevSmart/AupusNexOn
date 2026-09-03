import { Input } from '@/core/components/ui/input';
import { useMemo } from 'react';
import type { FormFieldProps } from '@/core/types/base';

/**
 * Input de hora (HH:MM) que armazena/recebe o valor como DECIMAL.
 * Ex: 18 <-> "18:00", 21.5 <-> "21:30", 6.25 <-> "06:15".
 *
 * Usado no form de concessionarias pros 4 campos de horarios tarifarios
 * (hora_inicio_ponta, hora_fim_ponta, hora_inicio_reservado, hora_fim_reservado).
 * Backend grava decimal porque o ClassificacaoHorariosService compara horaDecimal
 * diretamente nas formulas de classificacao.
 */
export function HoraField(props: FormFieldProps) {
  const { value, onChange, disabled } = props;

  const hhmm = useMemo(() => decimalToHHMM(value), [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value; // "HH:MM" ou ""
    if (!raw) {
      onChange(null);
      return;
    }
    onChange(hhmmToDecimal(raw));
  };

  return (
    <Input
      type="time"
      value={hhmm}
      onChange={handleChange}
      disabled={disabled}
      step={60} // granularidade 1 minuto (default ja eh 60s mas explicito)
      className="input-minimal"
    />
  );
}

function decimalToHHMM(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return '';
  // Normaliza overflow (24 vira 00) — input type=time so aceita 00:00 ate 23:59.
  const normalized = ((n % 24) + 24) % 24;
  const horas = Math.floor(normalized);
  const minutos = Math.round((normalized - horas) * 60);
  // Se arredondar pra 60min, sobe pra proxima hora.
  if (minutos === 60) {
    const h2 = (horas + 1) % 24;
    return `${String(h2).padStart(2, '0')}:00`;
  }
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function hhmmToDecimal(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h + m / 60;
}
