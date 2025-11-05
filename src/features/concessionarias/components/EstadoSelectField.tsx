// src/features/concessionarias/components/EstadoSelectField.tsx
import { useEffect, useRef } from 'react';
import { useEstados } from '@/hooks/useIBGE';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface EstadoSelectFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export function EstadoSelectField({
  value,
  onChange,
  disabled = false
}: EstadoSelectFieldProps) {
  const { estados, loading, error } = useEstados();
  const initialValueRef = useRef<string | undefined>(value);
  const hasRestoredRef = useRef(false);

  // ✅ Salvar o valor inicial quando o componente monta
  useEffect(() => {
    if (value && !initialValueRef.current) {
      initialValueRef.current = value;
    }
  }, [value]);

  // ✅ Restaurar o valor quando os estados carregarem
  useEffect(() => {
    if (!loading && estados.length > 0 && initialValueRef.current && !hasRestoredRef.current && !value) {
      onChange?.(initialValueRef.current);
      hasRestoredRef.current = true;
    }
  }, [loading, estados.length, value, onChange]);

  if (error) {
    return (
      <div className="text-red-500 text-sm p-3 bg-red-50 rounded-md border border-red-200">
        Erro ao carregar estados: {error}
      </div>
    );
  }

  const handleChange = (newValue: string) => {
    onChange?.(newValue);
  };

  // ✅ CORREÇÃO: Só passar o valor para o Select se os estados já estiverem carregados
  // Isso evita que o Select limpe o valor quando as options ainda não existem
  const selectValue = loading || estados.length === 0
    ? undefined
    : (value && typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

  return (
    <Select
      value={selectValue}
      onValueChange={handleChange}
      disabled={disabled || loading}
    >
      <SelectTrigger id="estado">
        <SelectValue
          placeholder={loading ? "Carregando estados..." : "Selecione o estado"}
        />
      </SelectTrigger>
      <SelectContent>
        {estados.map((estado) => (
          <SelectItem key={estado.sigla} value={estado.sigla}>
            {estado.sigla} - {estado.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
