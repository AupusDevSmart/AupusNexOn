import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateTimeInputProps {
  value: string; // ISO 8601 format
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * DateTimeInput Component
 *
 * Permite seleção de data e hora usando input nativo datetime-local do HTML5
 *
 * @example
 * ```tsx
 * <DateTimeInput
 *   label="Início"
 *   value={timestampInicio}
 *   onChange={setTimestampInicio}
 *   max={timestampFim}
 * />
 * ```
 */
export function DateTimeInput({
  value,
  onChange,
  label,
  placeholder = 'Selecione data e hora',
  min,
  max,
  className,
  disabled = false,
}: DateTimeInputProps) {
  // Converter ISO 8601 para formato datetime-local (YYYY-MM-DDTHH:mm) em horário de Brasília
  const toDatetimeLocal = (isoString: string): string => {
    if (!isoString) return '';

    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';

      // Extrair componentes no fuso de Brasília
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date);

      const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
      return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
    } catch (error) {
      console.error('Erro ao converter data:', error);
      return '';
    }
  };

  // Converter formato datetime-local para ISO 8601 (interpretar como horário de Brasília)
  const fromDatetimeLocal = (datetimeLocal: string): string => {
    if (!datetimeLocal) return '';

    try {
      // datetimeLocal é "YYYY-MM-DDTHH:mm" sem timezone — interpretar como Brasília (UTC-3)
      return new Date(datetimeLocal + ':00-03:00').toISOString();
    } catch (error) {
      console.error('Erro ao parsear data:', error);
      return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const isoValue = fromDatetimeLocal(newValue);
    onChange(isoValue);
  };

  const datetimeLocalValue = toDatetimeLocal(value);
  const datetimeLocalMin = min ? toDatetimeLocal(min) : undefined;
  const datetimeLocalMax = max ? toDatetimeLocal(max) : undefined;

  // Formatar data para exibição (pt-BR)
  const formatDisplayDate = (isoString: string): string => {
    if (!isoString) return '';

    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';

      return date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground dark:text-foreground">
          {label}
        </label>
      )}

      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        <Clock className="absolute left-8 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />

        <input
          type="datetime-local"
          value={datetimeLocalValue}
          onChange={handleChange}
          min={datetimeLocalMin}
          max={datetimeLocalMax}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background pl-16 pr-3 py-2 text-sm',
            'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:border-input dark:bg-background dark:text-foreground',
            '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
            '[&::-webkit-calendar-picker-indicator]:dark:invert',
            '[&::-webkit-calendar-picker-indicator]:opacity-70'
          )}
        />
      </div>

      {value && formatDisplayDate(value) && (
        <p className="text-xs text-muted-foreground pl-1">
          {formatDisplayDate(value)}
        </p>
      )}
    </div>
  );
}
