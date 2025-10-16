import React, { useMemo } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useCidades } from '@/hooks/useIBGE';

interface CidadeSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  estadoId: number | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CidadeSelect({
  value,
  onValueChange,
  estadoId,
  placeholder = "Selecione uma cidade",
  className = "",
  disabled = false
}: CidadeSelectProps) {
  const { cidades, loading, error } = useCidades(estadoId);

  const cidadesOptions = useMemo(() => {
    return cidades.map(cidade => ({
      value: cidade.id.toString(),
      label: cidade.nome
    }));
  }, [cidades]);

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        Erro ao carregar cidades: {error}
      </div>
    );
  }

  if (!estadoId) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Selecione um estado primeiro" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" disabled>
            Selecione um estado primeiro
          </SelectItem>
        </SelectContent>
      </Select>
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
          placeholder={loading ? "Carregando cidades..." : placeholder} 
        />
      </SelectTrigger>
      <SelectContent>
        {cidadesOptions.map((cidade) => (
          <SelectItem key={cidade.value} value={cidade.value}>
            {cidade.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}