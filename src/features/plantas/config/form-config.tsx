// src/features/plantas/config/form-config.tsx - ATUALIZADO COM MÁSCARA CNPJ
import React from 'react';
import { FormField, FormFieldProps } from '@/types/base';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CNPJInput, CNPJUtils } from '@/components/ui/cnpj-input'; // ✅ Import do novo componente
import { Factory, Settings, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProprietarioSelector } from '../components/ProprietarioSelector';
import { useEstadosIBGE, useCidadesIBGE, formatarCEP, validarCEP } from '@/hooks/useEstadosIBGE';
import { useViaCEP } from '@/hooks/useViaCEP';
import { cn } from '@/lib/utils';

// ✅ COMPONENTE: CNPJ com máscara personalizada
const CNPJFieldComponent = ({ value, onChange, disabled, hasError }: FormFieldProps) => {
  const [displayValue, setDisplayValue] = React.useState(() => {
    // Inicializar com valor formatado se existir
    return value ? CNPJUtils.mask(value.toString()) : '';
  });

  const handleCNPJChange = (rawValue: string) => {
    // Atualizar valor interno (sem máscara) para o formulário
    onChange(rawValue);
    
    // Atualizar valor de display (com máscara)
    setDisplayValue(CNPJUtils.mask(rawValue));
  };

  // Atualizar display value quando value prop mudar externamente
  React.useEffect(() => {
    if (value && value.toString() !== CNPJUtils.unmask(displayValue)) {
      setDisplayValue(CNPJUtils.mask(value.toString()));
    }
  }, [value, displayValue]);

  return (
    <div className="space-y-2">
      <CNPJInput
        value={CNPJUtils.unmask(displayValue)}
        onChange={handleCNPJChange}
        disabled={disabled}
        className={hasError ? 'border-red-500' : ''}
      />
      
      {/* ✅ Dica sobre validação */}
      {displayValue.length > 0 && !CNPJUtils.isValidCNPJ(displayValue) && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
          💡 <strong>Dica:</strong> Verifique se o CNPJ está correto. O sistema validará automaticamente os dígitos verificadores.
        </div>
      )}
    </div>
  );
};

// ✅ COMPONENTE COMPLETO: UF, Cidade e CEP com busca automática
const EnderecoCompleto = ({ onChange, disabled, entity, value }: FormFieldProps & { entity?: any }) => {
  const [selectedUF, setSelectedUF] = React.useState<string>('');
  const [selectedCidade, setSelectedCidade] = React.useState<string>('');
  const [cep, setCep] = React.useState<string>('');
  const [logradouro, setLogradouro] = React.useState<string>('');
  const [bairro, setBairro] = React.useState<string>('');
  const [lastCEP, setLastCEP] = React.useState('');
  const [initialized, setInitialized] = React.useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = React.useState(false);

  const { estados, loading: loadingEstados } = useEstadosIBGE();
  const estadoSelecionado = estados.find(e => e.sigla === selectedUF);
  const { cidades, loading: loadingCidades } = useCidadesIBGE(estadoSelecionado?.id || null);
  const { buscarCEP, loading: loadingCEP, error: errorCEP } = useViaCEP();

  // Carregar valores quando value ou entity mudar
  React.useEffect(() => {
    if (!initialized) {
      const endereco = value || entity?.endereco;
      setIsLoadingInitialData(true);

      // Se há endereço, carregar os valores
      if (endereco && typeof endereco === 'object') {
        setSelectedUF(endereco.uf || '');
        setSelectedCidade(endereco.cidade || '');
        setCep(endereco.cep || '');
        setLastCEP(endereco.cep || ''); // Marcar CEP inicial para evitar auto-busca
        setLogradouro(endereco.logradouro || '');
        setBairro(endereco.bairro || '');
      } else {
        // Se não há endereço, inicializar com valores vazios
        setSelectedUF('');
        setSelectedCidade('');
        setCep('');
        setLastCEP('');
        setLogradouro('');
        setBairro('');
      }

      setInitialized(true);
      // Dar tempo para os estados serem definidos antes de permitir auto-busca
      setTimeout(() => setIsLoadingInitialData(false), 100);
    }
  }, [value, entity?.endereco, initialized]);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Sempre que os campos mudarem, atualizar o objeto de endereço
  React.useEffect(() => {
    if (initialized) {
      const enderecoAtualizado = {
        uf: selectedUF || '',
        cidade: selectedCidade || '',
        cep: cep || '',
        logradouro: logradouro || '',
        bairro: bairro || ''
      };
      onChangeRef.current(enderecoAtualizado);
    }
  }, [selectedUF, selectedCidade, cep, logradouro, bairro, initialized]);

  const handleUFChange = (newUF: string) => {
    setSelectedUF(newUF);
    setSelectedCidade('');
  };

  const handleCEPChange = (novoCEP: string) => {
    const cepFormatado = formatarCEP(novoCEP);
    setCep(cepFormatado);
  };

  const handleBuscarCEP = async () => {
    if (!validarCEP(cep)) {
      return;
    }

    const endereco = await buscarCEP(cep);
    if (endereco) {
      setLogradouro(endereco.logradouro);
      setBairro(endereco.bairro);
      setSelectedCidade(endereco.localidade); // ViaCEP retorna "localidade" (nome da cidade)
      setSelectedUF(endereco.uf);
    }
  };

  React.useEffect(() => {
    // Só busca CEP automaticamente se:
    // 1. O componente já estiver inicializado
    // 2. NÃO estiver carregando dados iniciais
    // 3. CEP for válido e diferente do último
    if (initialized && !isLoadingInitialData && validarCEP(cep) && cep.length === 9 && cep !== lastCEP) {
      setLastCEP(cep);
      handleBuscarCEP();
    }
  }, [cep, lastCEP, initialized, isLoadingInitialData]);

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-4">
      {/* Campo CEP com busca automática - FULL WIDTH */}
      <div className="w-full space-y-2">
        <label className="text-sm font-medium">CEP</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => handleCEPChange(e.target.value)}
            disabled={disabled}
            maxLength={9}
            className={cn('input-minimal', errorCEP && 'border-red-500')}
          />
          <button
            type="button"
            onClick={handleBuscarCEP}
            disabled={disabled || !validarCEP(cep) || loadingCEP}
            className="btn-minimal-outline shrink-0"
          >
            {loadingCEP ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            {loadingCEP ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {errorCEP && (
          <p className="text-xs text-red-600">
            ⚠️ {errorCEP}
          </p>
        )}
      </div>

      {/* Logradouro - 50% */}
      <div className="basis-full sm:basis-[calc(50%-4px)] flex-shrink-0 flex-grow-0 space-y-2">
        <label className="text-sm font-medium">Logradouro <span className="text-red-500">*</span></label>
        <input
          type="text"
          placeholder="Ex: Av. Industrial, 1000"
          value={logradouro}
          onChange={(e) => setLogradouro(e.target.value)}
          disabled={disabled}
          required
          className="input-minimal"
        />
      </div>

      {/* Bairro - 50% */}
      <div className="basis-full sm:basis-[calc(50%-4px)] flex-shrink-0 flex-grow-0 space-y-2">
        <label className="text-sm font-medium">Bairro</label>
        <input
          type="text"
          placeholder="Ex: Distrito Industrial"
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
          disabled={disabled}
          className="input-minimal"
        />
      </div>

      {/* UF - 50% */}
      <div className="basis-full sm:basis-[calc(50%-4px)] flex-shrink-0 flex-grow-0 space-y-2">
        <label className="text-sm font-medium">UF <span className="text-red-500">*</span></label>
        <select
          value={selectedUF}
          onChange={(e) => handleUFChange(e.target.value)}
          disabled={disabled || loadingEstados}
          className="select-minimal"
          required
        >
          <option value="">
            {loadingEstados ? "Carregando estados..." : "Selecione um estado"}
          </option>
          {estados.map((estado) => (
            <option key={estado.id} value={estado.sigla}>
              {estado.sigla} - {estado.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Cidade - 50% */}
      <div className="basis-full sm:basis-[calc(50%-4px)] flex-shrink-0 flex-grow-0 space-y-2">
        <label className="text-sm font-medium">Cidade <span className="text-red-500">*</span></label>
        <select
          value={selectedCidade}
          onChange={(e) => setSelectedCidade(e.target.value)}
          disabled={disabled || loadingCidades || !selectedUF}
          className="select-minimal"
          required
        >
          <option value="">
            {!selectedUF
              ? "Selecione um estado primeiro"
              : loadingCidades
              ? "Carregando cidades..."
              : "Selecione uma cidade"
            }
          </option>
          {cidades.map((cidade) => (
            <option key={cidade.id} value={cidade.nome}>
              {cidade.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

// ✅ COMPONENTE ATUALIZADO: Gestão de Equipamentos com navegação inteligente (SEM MUDANÇAS)
const GestaoEquipamentosButton = ({ entity, mode }: { entity?: any; mode?: 'create' | 'edit' | 'view' }) => {
  const navigate = useNavigate();

  const handleOpenEquipamentos = () => {
    if (entity && entity.id && (mode === 'view' || mode === 'edit')) {
      const plantaId = entity.id;
      const plantaNome = encodeURIComponent(entity.nome || `Planta ${plantaId}`);
      
      console.log(`Navegando para equipamentos da planta ${plantaId}: ${entity.nome}`);
      navigate(`/equipamentos?plantaId=${plantaId}&plantaNome=${plantaNome}`);
    } else {
      console.log('Navegando para equipamentos sem filtro específico');
      navigate('/equipamentos');
    }
  };

  const isPlantaExistente = entity && entity.id && (mode === 'view' || mode === 'edit');
  
  return (
    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 dark:from-green-950 dark:to-emerald-950 dark:border-green-800">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Gestão de Equipamentos
          </h4>
          
          {isPlantaExistente ? (
            <div className="space-y-1 mt-2">
              <p className="text-sm text-green-700 dark:text-green-300">
                Gerencie os equipamentos específicos desta planta:
              </p>
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
                <Factory className="h-3 w-3" />
                <span className="truncate">{entity.nome}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              {mode === 'create' 
                ? 'Após salvar a planta, você poderá gerenciar seus equipamentos'
                : 'Acesse a gestão completa de equipamentos do sistema'
              }
            </p>
          )}
        </div>
        
        <button
          type="button"
          className="btn-minimal-outline border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-800 shrink-0 ml-4"
          onClick={handleOpenEquipamentos}
          disabled={mode === 'create' && !entity?.id}
        >
          {isPlantaExistente ? (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Equipamentos
            </>
          ) : (
            <>
              <Settings className="h-4 w-4 mr-2" />
              Ir para Equipamentos
            </>
          )}
        </button>
      </div>
      
      {mode === 'create' && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
          💡 <strong>Dica:</strong> Salve a planta primeiro para poder gerenciar seus equipamentos específicos
        </div>
      )}
    </div>
  );
};

export const plantasFormFields: FormField[] = [
  // Informações Básicas
  {
    key: 'nome',
    label: 'Nome da Planta',
    type: 'text',
    required: true,
    placeholder: 'Ex: Planta Industrial São Paulo',
  },
  {
    key: 'numeroUc',
    label: 'Número da Unidade Consumidora',
    type: 'text',
    required: false,
    placeholder: 'Ex: 123456789',
  },
  // ✅ ATUALIZADO: Campo CNPJ com máscara automática
  {
    key: 'cnpj',
    label: 'CNPJ',
    type: 'custom',
    required: true,
    render: CNPJFieldComponent,
    validation: (value) => {
      if (!value) return 'CNPJ é obrigatório';
      
      const cleanValue = CNPJUtils.unmask(value.toString());
      
      if (cleanValue.length !== 14) {
        return 'CNPJ deve ter 14 dígitos';
      }
      
      if (!CNPJUtils.isValidCNPJ(value.toString())) {
        return 'CNPJ inválido. Verifique os dígitos verificadores.';
      }
      
      return null;
    },
  },
  // Campo customizado para seleção de proprietário
  {
    key: 'proprietarioId',
    label: 'Proprietário',
    type: 'custom',
    required: true,
    render: ({ value, onChange, disabled, mode }) => (
      <ProprietarioSelector
        value={value as string | null}
        onChange={onChange}
        disabled={disabled}
      />
    ),
    validation: (value) => {
      if (!value || value === '') {
        return 'Proprietário é obrigatório';
      }
      return null;
    },
  },
  {
    key: 'horarioFuncionamento',
    label: 'Horário de Funcionamento',
    type: 'text',
    required: true,
    placeholder: 'Ex: 08:00 às 18:00',
  },

  // Localização
  {
    key: 'localizacao',
    label: 'Localização',
    type: 'text',
    required: true,
    placeholder: 'Ex: Zona Sul - Galpão 1',
  },

  // Endereço
  {
    key: 'endereco',
    label: 'Endereço Completo',
    type: 'custom',
    required: true,
    colSpan: 2,
    render: EnderecoCompleto,
    validation: (value) => {
      if (!value || typeof value !== 'object') {
        return 'Endereço é obrigatório';
      }

      const { logradouro, cidade, uf, cep } = value;

      if (!logradouro || logradouro.trim().length < 5) {
        return 'Logradouro deve ter pelo menos 5 caracteres';
      }

      if (!cidade || cidade.trim().length < 2) {
        return 'Cidade é obrigatória';
      }

      if (!uf || uf.trim().length !== 2) {
        return 'UF deve ter exatamente 2 caracteres';
      }

      if (!cep || !cep.match(/^\d{5}-\d{3}$/)) {
        return 'CEP deve estar no formato XXXXX-XXX';
      }

      return null;
    },
  },

  // Gestão de Equipamentos
  {
    key: 'gestaoEquipamentos',
    label: 'Gestão de Equipamentos',
    type: 'custom',
    required: false,
    render: ({ entity, mode }) => (
      <GestaoEquipamentosButton entity={entity} mode={mode as 'view' | 'create' | 'edit'} />
    ),
  }
];