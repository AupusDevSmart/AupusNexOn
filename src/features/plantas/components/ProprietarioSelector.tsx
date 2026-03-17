// src/features/plantas/components/ProprietarioSelector.tsx - ATUALIZADO COM COMBOBOX
import React, { useEffect, useState } from 'react';
import { Building2, User, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { PlantasService } from '@/services/plantas.services';
import { ProprietarioBasico } from '../types';

interface ProprietarioSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function ProprietarioSelector({ value, onChange, disabled }: ProprietarioSelectorProps) {
  const [proprietarios, setProprietarios] = useState<ProprietarioBasico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentProprietario, setCurrentProprietario] = useState<ProprietarioBasico | null>(null);

  // ✅ Carregar proprietários da API
  useEffect(() => {
    const fetchProprietarios = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await PlantasService.getProprietarios();
        setProprietarios(data);

        // ✅ Se há um value, buscar o proprietário atual (pode não estar na lista inicial)
        if (value) {
          const proprietarioNaLista = data.find(p => p.id === value);
          if (proprietarioNaLista) {
            setCurrentProprietario(proprietarioNaLista);
          } else {
            // ✅ Se o proprietário atual não está na lista, buscar seus dados
            try {
              const planta = await PlantasService.getAllPlantas({
                proprietarioId: value,
                page: 1,
                limit: 1
              });

              if (planta.data[0]?.proprietario) {
                const prop = planta.data[0].proprietario;
                setCurrentProprietario({
                  id: prop.id,
                  nome: prop.nome,
                  cpf_cnpj: prop.cpfCnpj || ''
                });

                // Adicionar à lista se não estiver presente
                const proprietarioJaExiste = data.some(p => p.id === prop.id);
                if (!proprietarioJaExiste) {
                  setProprietarios(prev => [
                    {
                      id: prop.id,
                      nome: prop.nome,
                      cpf_cnpj: prop.cpfCnpj || ''
                    },
                    ...prev
                  ]);
                }
              }
            } catch (err) {
              console.warn('⚠️ [PROPRIETARIO SELECTOR] Não foi possível carregar proprietário atual:', err);
            }
          }
        }

      } catch (err: any) {
        console.error('❌ [PROPRIETARIO SELECTOR] Erro ao carregar proprietários:', err);
        setError(err.message || 'Erro ao carregar proprietários');
      } finally {
        setLoading(false);
      }
    };

    fetchProprietarios();
  }, [value]);

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
