// src/features/unidades/components/ConcessionariaSelectField.tsx
import { useEffect, useRef, useState } from 'react';
import { ConcessionariasService, type ConcessionariaResponse } from '@/services/concessionarias.services';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

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
  const [concessionarias, setConcessionarias] = useState<ConcessionariaResponse[]>([]);
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
        console.log('🔄 [ConcessionariaSelect] Buscando concessionárias...');
        console.log('🔍 [ConcessionariaSelect] Estado filtro:', estado);
        console.log('🔑 [ConcessionariaSelect] Value atual:', value);

        // ✅ CORREÇÃO CRÍTICA: Se há um valor selecionado, carregar TODAS as concessionárias
        // para garantir que a selecionada esteja na lista (pode ser de outro estado)
        const shouldLoadAll = !!value && value.trim() !== '';

        const response = await ConcessionariasService.getAllConcessionarias({
          limit: 1000, // Carregar todas
          estado: shouldLoadAll ? undefined : (estado || undefined), // ✅ Ignorar filtro de estado se há valor
          orderBy: 'nome',
          orderDirection: 'asc'
        });

        console.log('📋 [ConcessionariaSelect] Concessionárias carregadas:', response.data?.length || 0);
        setConcessionarias(response.data || []);

        // Verificar se a concessionária selecionada está na lista
        if (value && response.data) {
          const valueTrimmed = value.trim();
          const concessionariaExiste = response.data.some(c => c.id?.trim() === valueTrimmed);
          console.log(`${concessionariaExiste ? '✅' : '❌'} [ConcessionariaSelect] Concessionária selecionada está na lista:`, concessionariaExiste);

          if (!concessionariaExiste && response.data.length > 0) {
            console.log('🔍 [ConcessionariaSelect] IDs disponíveis na lista:');
            response.data.forEach((c, idx) => {
              console.log(`   [${idx}] ID: "${c.id}" (length: ${c.id?.length}) | Nome: ${c.nome}`);
            });
            console.log(`🔍 [ConcessionariaSelect] ID procurado: "${valueTrimmed}" (length: ${valueTrimmed.length})`);
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
    console.log('🔄 [ConcessionariaSelect] handleChange chamado');
    console.log('🔑 [ConcessionariaSelect] newValue recebido:', newValue);
    console.log('🔍 [ConcessionariaSelect] Tipo:', typeof newValue);

    // Permitir limpar o campo (concessionária é opcional)
    if (newValue === '__clear__') {
      console.log('ℹ️ [ConcessionariaSelect] Limpando concessionária (campo opcional)');
      onChange?.(undefined as any); // Enviar undefined para limpar
      return;
    }

    console.log('✅ [ConcessionariaSelect] Novo valor válido:', newValue);
    onChange?.(newValue);
  };

  // Sempre manter o Select controlado - sempre undefined ou string, nunca mudar entre os dois
  const selectValue = value && typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;

  console.log('🎨 [ConcessionariaSelect] Renderizando...');
  console.log('🔑 [ConcessionariaSelect] value prop:', value);
  console.log('🔑 [ConcessionariaSelect] selectValue computado:', selectValue);
  console.log('📋 [ConcessionariaSelect] Concessionárias disponíveis:', concessionarias.length);

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
