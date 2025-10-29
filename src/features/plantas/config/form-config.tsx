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
      
      {/* ✅ Confirmação de CNPJ válido */}
      {CNPJUtils.isValidCNPJ(displayValue) && (
        <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
          ✅ CNPJ válido
        </div>
      )}
    </div>
  );
};

// ✅ COMPONENTE COMPLETO: UF, Cidade e CEP com busca automática (SEM MUDANÇAS)
const EnderecoCompleto = ({ onChange, disabled, entity }: FormFieldProps & { entity?: any }) => {
  const [selectedUF, setSelectedUF] = React.useState<string>('');
  const [selectedCidade, setSelectedCidade] = React.useState<string>('');
  const [cep, setCep] = React.useState<string>('');
  const [logradouro, setLogradouro] = React.useState<string>('');
  const [bairro, setBairro] = React.useState<string>('');
  const [initialized, setInitialized] = React.useState(false);
  const [lastCEP, setLastCEP] = React.useState('');
  
  const { estados, loading: loadingEstados } = useEstadosIBGE();
  // useCidadesIBGE espera um ID numérico, mas selectedUF é string (sigla UF)
  // Precisamos encontrar o ID do estado pela sigla
  const estadoSelecionado = estados.find(e => e.sigla === selectedUF);
  const { cidades, loading: loadingCidades } = useCidadesIBGE(estadoSelecionado?.id || null);
  const { buscarCEP, loading: loadingCEP, error: errorCEP } = useViaCEP();

  // Inicializar apenas uma vez com dados existentes
  React.useEffect(() => {
    if (entity?.endereco && !initialized) {
      const endereco = entity.endereco;
      setSelectedUF(endereco.uf || '');
      setSelectedCidade(endereco.cidade || '');
      setCep(endereco.cep || '');
      setLogradouro(endereco.logradouro || '');
      setBairro(endereco.bairro || '');
      setInitialized(true);
    } else if (!entity?.endereco && !initialized) {
      setInitialized(true);
    }
  }, [entity?.endereco, initialized]);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    if (initialized) {
      const enderecoAtualizado = {
        uf: selectedUF,
        cidade: selectedCidade,
        cep,
        logradouro,
        bairro
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
    if (validarCEP(cep) && cep.length === 9 && cep !== lastCEP) {
      setLastCEP(cep);
      handleBuscarCEP();
    }
  }, [cep, lastCEP]);

  if (!initialized) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-muted rounded"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campo CEP com busca automática */}
      <div className="space-y-2">
        <label className="text-sm font-medium">CEP</label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => handleCEPChange(e.target.value)}
            disabled={disabled}
            maxLength={9}
            className={errorCEP ? 'border-red-500' : ''}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBuscarCEP}
            disabled={disabled || !validarCEP(cep) || loadingCEP}
            className="shrink-0"
          >
            {loadingCEP ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            {loadingCEP ? 'Buscando...' : 'Buscar'}
          </Button>
        </div>
        
        {errorCEP && (
          <p className="text-xs text-red-600">
            ⚠️ {errorCEP}
          </p>
        )}
      </div>

      {/* Grid com Logradouro e Bairro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Logradouro <span className="text-red-500">*</span></label>
          <Input
            type="text"
            placeholder="Ex: Av. Industrial, 1000"
            value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)}
            disabled={disabled}
            required
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Bairro</label>
          <Input
            type="text"
            placeholder="Ex: Distrito Industrial"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Grid com UF e Cidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">UF <span className="text-red-500">*</span></label>
          <select
            value={selectedUF}
            onChange={(e) => handleUFChange(e.target.value)}
            disabled={disabled || loadingEstados}
            className="w-full px-3 py-2 border border-input bg-background rounded-md"
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

        <div className="space-y-2">
          <label className="text-sm font-medium">Cidade <span className="text-red-500">*</span></label>
          <select
            value={selectedCidade}
            onChange={(e) => setSelectedCidade(e.target.value)}
            disabled={disabled || loadingCidades || !selectedUF}
            className="w-full px-3 py-2 border border-input bg-background rounded-md"
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
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-800 shrink-0 ml-4"
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
        </Button>
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
    render: ({ value, onChange, disabled }) => (
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