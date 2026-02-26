// src/features/plantas/components/ProprietarioSelector.tsx - ATUALIZADO
import React, { useEffect, useState } from 'react';
import { Building2, User, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlantasService } from '@/services/plantas.services';
import { ProprietarioBasico } from '../types';

interface ProprietarioSelectorProps {
  value: string | null; // ✅ Mudado de number para string
  onChange: (value: string | null) => void; // ✅ Mudado de number para string
  disabled?: boolean;
}

export function ProprietarioSelector({ value, onChange, disabled }: ProprietarioSelectorProps) {
  const [proprietarios, setProprietarios] = useState<ProprietarioBasico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Carregar proprietários da API
  useEffect(() => {
    const fetchProprietarios = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await PlantasService.getProprietarios();
        setProprietarios(data);
        
      } catch (err: any) {
        console.error('❌ [PROPRIETARIO SELECTOR] Erro ao carregar proprietários:', err);
        setError(err.message || 'Erro ao carregar proprietários');
      } finally {
        setLoading(false);
      }
    };

    fetchProprietarios();
  }, []);

  // ✅ Handler para mudança de seleção
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    onChange(selectedValue === '' ? null : selectedValue); // ✅ String ou null
  };

  // ✅ Handler para recarregar proprietários
  const handleReload = () => {
    setProprietarios([]);
    setLoading(true);
    setError(null);
    
    // Re-executar o useEffect
    window.location.reload = window.location.reload;
  };

  // ✅ Encontrar proprietário selecionado
  const selectedProprietario = proprietarios.find(p => p.id === value);

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
      <select
        value={value || ''} // ✅ Usar string vazia como fallback
        onChange={handleChange}
        disabled={disabled || proprietarios.length === 0}
        className="select-minimal"
        required
        size={1}
      >
        <option value="">
          {proprietarios.length === 0
            ? "Nenhum proprietário encontrado"
            : "Selecione um proprietário"
          }
        </option>

        {proprietarios.map((proprietario) => (
          <option key={proprietario.id} value={proprietario.id}>
            {proprietario.nome} - {proprietario.cpf_cnpj}
          </option>
        ))}
      </select>

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