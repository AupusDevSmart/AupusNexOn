import React, { useMemo } from 'react';
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
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EstadoSelect({
  value,
  onValueChange,
  placeholder = "Selecione um estado",
  className = "",
  disabled = false
}: EstadoSelectProps) {
  const { estados, loading, error } = useEstados();

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
      value={value} 
      onValueChange={onValueChange}
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