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
  onEstadoChange?: (estado: { id: string; nome: string; sigla: string }) => void; // ✅ Callback com dados completos
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EstadoSelect({
  value,
  onValueChange,
  onEstadoChange,
  placeholder = "Selecione um estado",
  className = "",
  disabled = false
}: EstadoSelectProps) {
  const { estados, loading, error } = useEstados();

  // ✅ Handler que chama ambos os callbacks
  const handleEstadoChange = (estadoId: string) => {
    // Chamar callback tradicional (para compatibilidade)
    if (onValueChange) {
      onValueChange(estadoId);
    }

    // Chamar callback com dados completos
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
  };

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
      value={value || undefined} // ✅ Garantir que seja undefined (não string vazia) para placeholder funcionar
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