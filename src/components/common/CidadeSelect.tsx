import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
  displayValue?: string;
  onValueChange?: (value: string) => void;
  onCidadeChange?: (cidade: { id: string; nome: string }) => void;
  estadoId: number | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CidadeSelect({
  value,
  displayValue,
  onValueChange,
  onCidadeChange,
  estadoId,
  placeholder = "Selecione uma cidade",
  className = "",
  disabled = false
}: CidadeSelectProps) {
  const { cidades, loading, error } = useCidades(estadoId);

  // Se tem displayValue mas não tem value (ID IBGE), tentar resolver pelo nome
  const resolvedValue = useMemo(() => {
    if (value) return value;
    if (!displayValue || cidades.length === 0) return undefined;
    const match = cidades.find(
      c => c.nome.toLowerCase() === displayValue.toLowerCase()
    );
    return match ? match.id.toString() : undefined;
  }, [value, displayValue, cidades]);

  const handleCidadeChange = useCallback((cidadeId: string) => {
    if (onValueChange) {
      onValueChange(cidadeId);
    }
    if (onCidadeChange) {
      const cidadeSelecionada = cidades.find(c => c.id.toString() === cidadeId);
      if (cidadeSelecionada) {
        onCidadeChange({
          id: cidadeId,
          nome: cidadeSelecionada.nome
        });
      }
    }
  }, [cidades, onValueChange, onCidadeChange]);

  // Auto-propagar o ID resolvido para o form quando displayValue é usado
  const didAutoResolve = useRef(false);
  useEffect(() => {
    if (resolvedValue && !value && !didAutoResolve.current) {
      didAutoResolve.current = true;
      handleCidadeChange(resolvedValue);
    }
  }, [resolvedValue, value, handleCidadeChange]);

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
      value={resolvedValue || undefined}
      onValueChange={handleCidadeChange}
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
