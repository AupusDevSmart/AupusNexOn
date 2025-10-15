import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useViaCEP } from '@/hooks/useViaCEP';

interface CEPInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onEnderecoChange?: (endereco: {
    endereco: string;
    bairro: string;
    cidade: string;
    estado: string;
    estadoId?: string;
    cidadeId?: string;
  }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoSearch?: boolean; // Buscar automaticamente quando CEP estiver completo
}

export function CEPInput({
  value = '',
  onChange,
  onEnderecoChange,
  placeholder = "Digite o CEP",
  className = "",
  disabled = false,
  autoSearch = true
}: CEPInputProps) {
  const [cepValue, setCepValue] = useState(value);
  const { endereco, loading, error, buscarCEP, limparEndereco } = useViaCEP();

  // Sincronizar com valor externo
  useEffect(() => {
    setCepValue(value);
  }, [value]);

  // Formatar CEP enquanto digita
  const formatarCEP = (cep: string): string => {
    // Remove tudo que não for número
    const numeros = cep.replace(/\D/g, '');
    
    // Limita a 8 dígitos
    const limitado = numeros.substring(0, 8);
    
    // Adiciona a máscara
    if (limitado.length > 5) {
      return `${limitado.substring(0, 5)}-${limitado.substring(5)}`;
    }
    
    return limitado;
  };

  const handleCEPChange = (novoCEP: string) => {
    const cepFormatado = formatarCEP(novoCEP);
    setCepValue(cepFormatado);
    
    if (onChange) {
      onChange(cepFormatado);
    }

    // Limpar endereço anterior se CEP for alterado
    if (endereco && cepFormatado !== endereco.cep) {
      limparEndereco();
    }

    // Busca automática quando CEP estiver completo
    if (autoSearch && cepFormatado.length === 9) {
      handleBuscarCEP(cepFormatado);
    }
  };

  const handleBuscarCEP = async (cep?: string) => {
    const cepParaBuscar = cep || cepValue;
    
    if (!cepParaBuscar || cepParaBuscar.length < 9) {
      return;
    }

    const resultado = await buscarCEP(cepParaBuscar);
    
    if (resultado && onEnderecoChange) {
      // Converter dados do ViaCEP para o formato esperado
      onEnderecoChange({
        endereco: resultado.logradouro || '',
        bairro: resultado.bairro || '',
        cidade: resultado.localidade || '',
        estado: resultado.uf || '',
        // TODO: Mapear UF para estadoId e localidade para cidadeId se necessário
      });
    }
  };

  const getStatusIcon = () => {
    if (loading) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (error) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (endereco) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return null;
  };

  const showSearchButton = !autoSearch && cepValue.length === 9 && !loading;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            value={cepValue}
            onChange={(e) => handleCEPChange(e.target.value)}
            placeholder={placeholder}
            className={`pr-10 ${className} ${error ? 'border-red-500' : ''} ${endereco ? 'border-green-500' : ''}`}
            disabled={disabled || loading}
            maxLength={9}
          />
          
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {getStatusIcon()}
          </div>
        </div>
        
        {showSearchButton && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleBuscarCEP()}
            disabled={disabled}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Feedback visual */}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      
      {endereco && (
        <div className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          <span>
            {endereco.logradouro && `${endereco.logradouro}, `}
            {endereco.bairro && `${endereco.bairro}, `}
            {endereco.localidade}/{endereco.uf}
          </span>
        </div>
      )}
      
      {loading && (
        <p className="text-xs text-blue-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Buscando endereço...
        </p>
      )}
    </div>
  );
}