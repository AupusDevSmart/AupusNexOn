import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useEstados } from '@/hooks/useIBGE';

interface EstadoSelectProps {
  value?: string;
  displayValue?: string;
  onValueChange?: (value: string) => void;
  onEstadoChange?: (estado: { id: string; nome: string; sigla: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EstadoSelect({
  value,
  displayValue,
  onValueChange,
  onEstadoChange,
  placeholder = "Selecione um estado",
  className = "",
  disabled = false
}: EstadoSelectProps) {
  const { estados, loading, error } = useEstados();

  // Se tem displayValue mas não tem value (ID IBGE), tentar resolver pelo nome/sigla
  const resolvedValue = useMemo(() => {
    if (value) return value;
    if (!displayValue || estados.length === 0) return undefined;
    const match = estados.find(
      e => e.sigla.toLowerCase() === displayValue.toLowerCase() ||
           e.nome.toLowerCase() === displayValue.toLowerCase()
    );
    return match ? match.id.toString() : undefined;
  }, [value, displayValue, estados]);

  const handleEstadoChange = useCallback((estadoId: string) => {
    if (onValueChange) {
      onValueChange(estadoId);
    }
    if (onEstadoChange) {
      const estadoSelecionado = estados.find(e => e.id.toString() === estadoId);
      if (estadoSelecionado) {
        onEstadoChange({
          id: estadoId,
          nome: estadoSelecionado.nome,
          sigla: estadoSelecionado.sigla
        });
      }
    }
  }, [estados, onValueChange, onEstadoChange]);

  // Auto-propagar o ID resolvido para o form quando displayValue é usado
  const didAutoResolve = useRef(false);
  useEffect(() => {
    if (resolvedValue && !value && !didAutoResolve.current) {
      didAutoResolve.current = true;
      handleEstadoChange(resolvedValue);
    }
  }, [resolvedValue, value, handleEstadoChange]);

  const estadosOptions = useMemo(() => {
    return estados.map(estado => ({
      value: estado.id.toString(),
      label: `${estado.nome} (${estado.sigla})`
    }));
  }, [estados]);

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        Erro ao carregar estados: {error}
      </div>
    );
  }

  return (
    <Select
      value={resolvedValue || undefined}
      onValueChange={handleEstadoChange}
      disabled={disabled || loading}
    >
      <SelectTrigger className={className}>
        <SelectValue
          placeholder={loading ? "Carregando estados..." : placeholder}
        />
      </SelectTrigger>
      <SelectContent>
        {estadosOptions.map((estado) => (
          <SelectItem key={estado.value} value={estado.value}>
            {estado.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
