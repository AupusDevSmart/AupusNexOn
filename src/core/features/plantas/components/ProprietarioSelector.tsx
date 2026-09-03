// src/features/plantas/components/ProprietarioSelector.tsx - ATUALIZADO COM COMBOBOX
import React, { useEffect, useState } from 'react';
import { Building2, User, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Combobox, ComboboxOption } from '@/core/components/ui/combobox';
import { useProprietariosForPlantas, useHttpClient } from '@/core/context/hooks';
import { ProprietarioBasico } from '@/core/types/contracts';

interface ProprietarioSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function ProprietarioSelector({ value, onChange, disabled }: ProprietarioSelectorProps) {
  const { proprietarios: hookProprietarios, loading: hookLoading, error: hookError } = useProprietariosForPlantas();
  const httpClient = useHttpClient();
  const [proprietarios, setProprietarios] = useState<ProprietarioBasico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentProprietario, setCurrentProprietario] = useState<ProprietarioBasico | null>(null);

  // Sync from hook
  useEffect(() => {
    if (!hookLoading) {
      const data = hookProprietarios || [];
      setProprietarios(data);
      setLoading(false);
      setError(hookError);

      // Se há um value, buscar o proprietário atual (pode não estar na lista inicial)
      if (value) {
        const proprietarioNaLista = data.find((p: any) => p.id === value);
        if (proprietarioNaLista) {
          setCurrentProprietario(proprietarioNaLista as ProprietarioBasico);
        } else {
          // Se o proprietário atual não está na lista, buscar seus dados
          httpClient.get('/plantas', {
            params: { proprietarioId: value, page: 1, limit: 1 }
          }).then((response) => {
            const plantaData = response.data;
            if (plantaData.data?.[0]?.proprietario) {
              const prop = plantaData.data[0].proprietario;
              setCurrentProprietario({
                id: prop.id,
                nome: prop.nome,
                cpf_cnpj: prop.cpfCnpj || ''
              } as ProprietarioBasico);

              // Adicionar à lista se não estiver presente
              const proprietarioJaExiste = data.some((p: any) => p.id === prop.id);
              if (!proprietarioJaExiste) {
                setProprietarios(prev => [
                  {
                    id: prop.id,
                    nome: prop.nome,
                    cpf_cnpj: prop.cpfCnpj || ''
                  } as ProprietarioBasico,
                  ...prev
                ]);
              }
            }
          }).catch((err) => {
          });
        }
      }
    } else {
      setLoading(true);
    }
  }, [hookProprietarios, hookLoading, hookError, value]);

  // ✅ Converter proprietários para opções do combobox
  const comboboxOptions: ComboboxOption[] = React.useMemo(() => {
    return proprietarios.map(p => ({
      value: p.id,
      label: `${p.nome} - ${p.cpf_cnpj}`
    }));
  }, [proprietarios]);

  // ✅ Handler para mudança de seleção
  const handleChange = (selectedValue: string) => {
    onChange(selectedValue === '' ? null : selectedValue);
  };

  // ✅ Handler para recarregar proprietários
  const handleReload = () => {
    setProprietarios([]);
    setCurrentProprietario(null);
    setLoading(true);
    setError(null);

    // Re-executar o useEffect forçando uma re-renderização
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 border border-input rounded-md bg-background">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Carregando proprietários...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="p-3 border border-red-200 rounded-md bg-red-50">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Erro ao carregar</span>
          </div>
          <p className="text-xs text-red-600 mb-3">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReload}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Combobox
        options={comboboxOptions}
        value={value || ''}
        onValueChange={handleChange}
        placeholder="Selecione um proprietário"
        searchPlaceholder="Buscar por nome ou CPF/CNPJ..."
        emptyText="Nenhum proprietário encontrado"
        disabled={disabled || proprietarios.length === 0}
      />

      {/* ✅ Aviso se não houver proprietários */}
      {proprietarios.length === 0 && !loading && !error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Nenhum proprietário encontrado
            </span>
          </div>
          <p className="text-xs text-amber-600 mt-1">
            Certifique-se de que existem usuários cadastrados com perfil de proprietário, admin ou gerente.
          </p>
        </div>
      )}
    </div>
  );
}
