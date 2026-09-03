// src/features/unidades/components/ConcessionariaSelectField.tsx
import { useEffect, useRef, useState } from 'react';
import { useConcessionariasService } from '@/core/context/hooks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/core/components/ui/select';

interface ConcessionariaSelectFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  estado?: string; // Filtrar concessionárias por estado
}

export function ConcessionariaSelectField({
  value,
  onChange,
  disabled = false,
  estado
}: ConcessionariaSelectFieldProps) {
  const { getAllConcessionarias } = useConcessionariasService();
  const [concessionarias, setConcessionarias] = useState<Array<{ id: string; nome: string; estado?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialValueRef = useRef<string | undefined>(value);
  const hasRestoredRef = useRef(false);

  // Salvar o valor inicial quando o componente monta
  useEffect(() => {
    if (value && !initialValueRef.current) {
      initialValueRef.current = value;
    }
  }, [value]);

  // Carregar concessionárias
  useEffect(() => {
    const fetchConcessionarias = async () => {
      setLoading(true);
      setError(null);

      try {

        // ✅ CORREÇÃO CRÍTICA: Se há um valor selecionado, carregar TODAS as concessionárias
        // para garantir que a selecionada esteja na lista (pode ser de outro estado)
        const shouldLoadAll = !!value && value.trim() !== '';

        const response = await getAllConcessionarias({
          limit: 1000, // Carregar todas
          estado: shouldLoadAll ? undefined : (estado || undefined),
          orderBy: 'nome',
          orderDirection: 'asc'
        });

        setConcessionarias(response.data || []);

        // Verificar se a concessionária selecionada está na lista
        if (value && response.data) {
          const valueTrimmed = value.trim();
          const concessionariaExiste = response.data.some(c => c.id?.trim() === valueTrimmed);

          if (!concessionariaExiste && response.data.length > 0) {
            response.data.forEach((c, idx) => {
            });
          }
        }
      } catch (err: any) {
        console.error('❌ [ConcessionariaSelect] Erro ao carregar concessionárias:', err);
        setError(err.message || 'Erro ao carregar concessionárias');
        setConcessionarias([]);
      } finally {
        setLoading(false);
      }
    };

    fetchConcessionarias();
  }, [estado, value]); // ✅ Adicionar 'value' como dependência

  // Restaurar o valor quando as concessionárias carregarem
  useEffect(() => {
    if (!loading && concessionarias.length > 0 && initialValueRef.current && !hasRestoredRef.current && !value) {
      onChange?.(initialValueRef.current);
      hasRestoredRef.current = true;
    }
  }, [loading, concessionarias.length, value, onChange]);

  if (error) {
    return (
      <div className="text-red-500 text-sm p-3 bg-red-50 rounded-md border border-red-200">
        {error}
      </div>
    );
  }

  const handleChange = (newValue: string) => {

    // Permitir limpar o campo (concessionária é opcional)
    if (newValue === '__clear__') {
      onChange?.(undefined as any); // Enviar undefined para limpar
      return;
    }

    onChange?.(newValue);
  };

  // Sempre manter o Select controlado - sempre undefined ou string, nunca mudar entre os dois
  const selectValue = value && typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;


  return (
    <Select
      value={selectValue}
      onValueChange={handleChange}
      disabled={disabled || loading}
    >
      <SelectTrigger id="concessionariaId" className="select-minimal">
        <SelectValue
          placeholder={loading ? "Carregando concessionárias..." : concessionarias.length === 0 ? "Nenhuma concessionária disponível" : "Selecione a concessionária"}
        />
      </SelectTrigger>
      <SelectContent>
        {value && (
          <SelectItem value="__clear__">
            <span className="text-muted-foreground italic">-- Limpar seleção --</span>
          </SelectItem>
        )}
        {concessionarias.map((concessionaria) => (
          <SelectItem key={concessionaria.id} value={concessionaria.id?.trim() || concessionaria.id}>
            {concessionaria.nome} ({concessionaria.estado})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
