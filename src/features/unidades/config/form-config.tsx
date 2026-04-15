// src/features/unidades/config/form-config.tsx

import React, { useState } from 'react';
import { FormField, FormFieldProps } from '@/types/base';
import { usePlantas } from '../hooks/usePlantas';
import { TipoUnidade, StatusUnidade, GrupoUnidade, SubgrupoUnidade } from '../types';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConcessionariaSelectField } from '../components/ConcessionariaSelectField';
import { Combobox } from '@/components/ui/combobox-minimal';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Componente para selecionar/exibir Proprietário
 */
const ProprietarioSelector = ({ value, onChange, disabled, mode, entity }: FormFieldProps) => {
  const { plantas, loading: loadingPlantas } = usePlantas();
  const [proprietarios, setProprietarios] = React.useState<Array<{id: string, nome: string, email: string}>>([]);
  const [currentProprietario, setCurrentProprietario] = React.useState<{id: string, nome: string, email: string} | null>(null);

  // 🔍 DEBUG: Ver o que está chegando
  React.useEffect(() => {
    console.log('🔍 [ProprietarioSelector] DEBUG:', {
      value,
      mode,
      hasEntity: !!entity,
      hasPlanta: !!entity?.planta,
      hasProprietario: !!entity?.planta?.proprietario,
      proprietario: entity?.planta?.proprietario
    });
  }, [value, mode, entity]);

  // Extrair proprietários únicos das plantas E adicionar o atual se necessário
  React.useEffect(() => {
    if (plantas.length > 0) {
      const proprietariosUnicos = plantas
        .filter(p => p.proprietario)
        .reduce((acc, planta) => {
          const prop = planta.proprietario!;
          if (!acc.find(p => p.id === prop.id)) {
            acc.push({
              id: prop.id,
              nome: prop.nome,
              email: prop.email
            });
          }
          return acc;
        }, [] as Array<{id: string, nome: string, email: string}>);

      setProprietarios(proprietariosUnicos);

      // Se há um proprietário na entidade (modo edit), garantir que ele está na lista
      if (mode === 'edit' && entity?.planta?.proprietario) {
        const propAtual = entity.planta.proprietario;
        setCurrentProprietario(propAtual);

        console.log('✅ [ProprietarioSelector] Proprietário atual encontrado:', propAtual);

        // Se o proprietário atual não está na lista, adicioná-lo
        if (!proprietariosUnicos.find(p => p.id === propAtual.id)) {
          console.log('➕ [ProprietarioSelector] Adicionando proprietário atual à lista');
          setProprietarios(prev => [propAtual, ...prev]);
        }

        // ✅ CRÍTICO: Setar o valor inicial se ainda não foi setado
        if (!value && onChange) {
          console.log('🎯 [ProprietarioSelector] Setando valor inicial:', propAtual.id);
          onChange(propAtual.id);
        }
      }
    }
  }, [plantas, entity, mode, value, onChange]);

  // Modo view: apenas exibir
  if (mode === 'view') {
    const proprietario = entity?.planta?.proprietario;
    if (!proprietario) return null;

    return (
      <div className="w-full px-3 py-2 border border-border bg-muted rounded-md">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{proprietario.nome}</span>
          <span className="text-sm text-muted-foreground">{proprietario.email}</span>
        </div>
      </div>
    );
  }

  // Modo create e edit: permitir seleção via combobox
  const proprietariosOptions = proprietarios.map(p => ({
    value: p.id,
    label: p.nome
  }));

  if (loadingPlantas) {
    return (
      <div className="w-full h-9 px-3 py-2 border border-input bg-muted rounded text-sm text-muted-foreground flex items-center">
        Carregando proprietários...
      </div>
    );
  }

  return (
    <Combobox
      options={proprietariosOptions}
      value={value as string || ''}
      onValueChange={onChange}
      placeholder="Selecione um proprietário"
      searchPlaceholder="Buscar proprietário..."
      emptyText="Nenhum proprietário encontrado"
      disabled={disabled}
      className="w-full"
    />
  );
};

/**
 * Componente para seleção de Planta
 */
const PlantaSelector = ({ value, onChange, disabled, mode, formData, onMultipleChange }: FormFieldProps) => {
  const { plantas, loading, error } = usePlantas();
  const previousProprietarioRef = React.useRef<string | undefined>();

  // 🔍 DEBUG: Ver o que está chegando
  React.useEffect(() => {
    console.log('🔍 [PlantaSelector] DEBUG:', {
      value,
      mode,
      proprietarioId: formData?.proprietarioId,
      totalPlantas: plantas.length,
      formData
    });
  }, [value, mode, formData, plantas.length]);

  // Encontrar a planta selecionada para exibir
  const plantaSelecionada = plantas.find(p => p.id === value);

  // Filtrar plantas pelo proprietário selecionado (se houver)
  const plantasFiltradas = React.useMemo(() => {
    // No modo CREATE: sempre filtrar se houver proprietário selecionado
    if (mode === 'create' && formData?.proprietarioId) {
      const filtered = plantas.filter(p => p.proprietario?.id === formData.proprietarioId);
      console.log('🔍 [PlantaSelector] Filtrando plantas (modo create):', {
        proprietarioId: formData.proprietarioId,
        total: filtered.length,
        plantas: filtered.map(p => ({ id: p.id, nome: p.nome, proprietarioId: p.proprietario?.id }))
      });
      return filtered;
    }

    // No modo EDIT: filtrar apenas se proprietário foi alterado manualmente
    const proprietarioFoiAlterado = previousProprietarioRef.current !== undefined;
    if (mode === 'edit' && formData?.proprietarioId && proprietarioFoiAlterado) {
      const filtered = plantas.filter(p => p.proprietario?.id === formData.proprietarioId);
      console.log('🔍 [PlantaSelector] Filtrando plantas (modo edit, proprietário alterado):', {
        proprietarioId: formData.proprietarioId,
        total: filtered.length,
        plantas: filtered.map(p => ({ id: p.id, nome: p.nome, proprietarioId: p.proprietario?.id }))
      });
      return filtered;
    }

    // No carregamento inicial do modo edit (sem proprietário ou sem alteração), mostrar todas
    console.log('🔍 [PlantaSelector] Mostrando TODAS as plantas (total:', plantas.length, ')');
    return plantas;
  }, [plantas, formData?.proprietarioId, mode]);

  // ✅ CRÍTICO: Limpar planta selecionada quando proprietário mudar e a planta não pertencer a ele
  React.useEffect(() => {
    const currentProprietarioId = formData?.proprietarioId;

    // Se o proprietário mudou (não é a primeira renderização)
    if (previousProprietarioRef.current !== undefined &&
        currentProprietarioId &&
        previousProprietarioRef.current !== currentProprietarioId) {

      console.log('🔄 [PlantaSelector] Proprietário MUDOU de', previousProprietarioRef.current, 'para', currentProprietarioId);

      // Verificar se a planta atual pertence ao novo proprietário
      const plantaAtualPertenceAoNovoProprietario = plantasFiltradas.some(p => p.id === value);

      if (!plantaAtualPertenceAoNovoProprietario && onChange && value) {
        console.log('🗑️ [PlantaSelector] Planta atual não pertence ao novo proprietário, limpando');
        onChange(''); // Limpar seleção
      } else {
        console.log('✅ [PlantaSelector] Planta atual pertence ao novo proprietário, mantendo');
      }
    } else if (previousProprietarioRef.current === undefined && currentProprietarioId) {
      console.log('🎯 [PlantaSelector] Primeira vez setando proprietário:', currentProprietarioId);
    }

    // Atualizar a referência para rastrear mudanças futuras
    previousProprietarioRef.current = currentProprietarioId;
  }, [formData?.proprietarioId, value, plantasFiltradas, onChange, mode]);

  // No modo view, mostrar a planta de forma read-only
  if (mode === 'view') {
    return (
      <div className="w-full px-3 py-2 border border-border bg-muted rounded-md text-foreground">
        {plantaSelecionada ? (
          <span>
            <strong>{plantaSelecionada.nome}</strong>
            {plantaSelecionada.localizacao && (
              <span className="text-muted-foreground"> - {plantaSelecionada.localizacao}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground italic">Planta não encontrada</span>
        )}
      </div>
    );
  }

  // Modo create/edit: usar Combobox pesquisável
  const plantasOptions = plantasFiltradas.map(planta => ({
    value: planta.id,
    label: `${planta.nome}${planta.localizacao ? ` - ${planta.localizacao}` : ''}`
  }));

  if (loading) {
    return (
      <div className="w-full h-9 px-3 py-2 border border-input bg-muted rounded text-sm text-muted-foreground flex items-center">
        Carregando plantas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-9 px-3 py-2 border border-red-300 bg-red-50 rounded text-sm text-red-600 flex items-center">
        Erro ao carregar plantas
      </div>
    );
  }

  // Verificar se o proprietário foi selecionado
  const temProprietarioSelecionado = !!formData?.proprietarioId;
  const proprietarioFoiAlterado = previousProprietarioRef.current !== undefined &&
                                   previousProprietarioRef.current !== formData?.proprietarioId;

  // No modo CREATE, desabilitar se não houver proprietário selecionado
  const isDisabled = disabled || (mode === 'create' && !formData?.proprietarioId);

  // Auto-fill estado/cidade when planta changes
  const handlePlantaChange = (plantaId: string) => {
    const planta = plantas.find(p => p.id === plantaId);
    if (planta && onMultipleChange) {
      onMultipleChange({
        plantaId: plantaId,
        estado: planta.uf || '',
        cidade: planta.cidade || '',
      });
    } else {
      onChange(plantaId);
    }
  };

  return (
    <div className="space-y-2">
      <Combobox
        options={plantasOptions}
        value={value as string}
        onValueChange={handlePlantaChange}
        placeholder={mode === 'create' && !formData?.proprietarioId ? "Selecione um proprietário primeiro" : "Selecione uma planta"}
        searchPlaceholder="Buscar planta..."
        emptyText="Nenhuma planta encontrada"
        disabled={isDisabled}
        className="w-full"
      />
      {/* Aviso: Nenhuma planta encontrada para o proprietário */}
      {temProprietarioSelecionado && plantasFiltradas.length === 0 && (
        <p className="text-xs text-amber-600">
          ⚠️ Nenhuma planta encontrada para o proprietário selecionado. Selecione outro proprietário.
        </p>
      )}
      {/* Aviso: Planta selecionada não pertence ao proprietário (só no edit quando mudar) */}
      {mode === 'edit' && proprietarioFoiAlterado && temProprietarioSelecionado && value && plantasFiltradas.length > 0 && !plantasFiltradas.some(p => p.id === value) && (
        <p className="text-xs text-amber-600">
          ⚠️ A planta selecionada não pertence ao proprietário escolhido. Por favor, selecione outra planta.
        </p>
      )}
    </div>
  );
};

/**
 * Componente para gerenciar Pontos de Medição com chips
 */
const PontosMedicaoManager = ({ value, onChange, disabled, mode }: FormFieldProps) => {
  const [inputValue, setInputValue] = useState('');

  // Garantir que value é sempre um array
  let pontos: string[] = [];
  try {
    if (Array.isArray(value)) {
      pontos = value;
    } else if (typeof value === 'string' && value) {
      const parsed = JSON.parse(value);
      pontos = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    pontos = [];
  }

  const handleAddPonto = () => {
    if (!inputValue.trim()) return;

    const novoPonto = inputValue.trim();
    if (pontos.includes(novoPonto)) {
      alert('Este ponto de medição já existe!');
      return;
    }

    const novosPontos = [...pontos, novoPonto];
    onChange(novosPontos);
    setInputValue('');
  };

  const handleRemovePonto = (index: number) => {
    const novosPontos = pontos.filter((_, i) => i !== index);
    onChange(novosPontos);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPonto();
    }
  };

  // Modo VIEW: Apenas exibir chips
  if (mode === 'view' || disabled) {
    if (pontos.length === 0) {
      return (
        <div className="p-4 bg-muted border border-border rounded-md">
          <p className="text-muted-foreground text-sm italic">Nenhum ponto de medição configurado</p>
        </div>
      );
    }

    return (
      <div className="p-3 bg-muted border border-border rounded-md">
        <div className="flex flex-wrap gap-2">
          {pontos.map((ponto, index) => (
            <span
              key={index}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-white border border-blue-200 dark:border-blue-700 shadow-sm"
            >
              {ponto}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Modo EDIT/CREATE: Permitir adicionar/remover
  return (
    <div className="space-y-3">
      {/* Input para adicionar novos pontos */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite o nome do ponto de medição"
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleAddPonto}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* Lista de pontos com chips */}
      {pontos.length > 0 ? (
        <div className="p-3 bg-muted border border-border rounded-md">
          <div className="flex flex-wrap gap-2">
            {pontos.map((ponto, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-white border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              >
                <span>{ponto}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePonto(index)}
                  className="ml-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
                  aria-label="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-muted border border-border rounded-md">
          <p className="text-muted-foreground text-sm italic text-center">
            Nenhum ponto de medição adicionado. Use o campo acima para adicionar.
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Configuração dos campos do formulário de Unidades
 */
export const unidadesFormFields: FormField[] = [
  {
    key: 'proprietarioId',
    label: 'Proprietário',
    type: 'custom',
    render: ProprietarioSelector,
    required: false,
    colSpan: 2, // Ocupa 2 colunas
  },
  {
    key: 'plantaId',
    label: 'Planta',
    type: 'custom',
    render: PlantaSelector,
    required: true,
    colSpan: 2, // Ocupa 2 colunas
  },
  {
    key: 'nome',
    label: 'Nome da Instalação',
    type: 'text',
    required: true,
    placeholder: 'Ex: Unidade 1, Subestação Principal, etc.',
    colSpan: 2, // Ocupa 2 colunas
  },
  {
    key: 'numeroUc',
    label: 'Número da Unidade Consumidora',
    type: 'text',
    required: false,
    placeholder: 'Ex: 123456789',
    colSpan: 2, // Ocupa 2 colunas
  },
  {
    key: 'tipo',
    label: 'Tipo de Geração',
    type: 'select',
    required: true,
    options: [
      { value: TipoUnidade.UFV, label: 'UFV (Usina Fotovoltaica)' },
      { value: TipoUnidade.PCH, label: 'PCH (Pequena Central Hidrelétrica)' },
      { value: TipoUnidade.OUTRO, label: 'Outro' },
    ],
  },
  {
    key: 'tensaoNominal',
    label: 'Tensão Nominal',
    type: 'select',
    required: false,
    options: [
      { value: '0,22 kV', label: '0,22 kV' },
      { value: '0,38 kV', label: '0,38 kV' },
      { value: '4,16 kV', label: '4,16 kV' },
      { value: '13,8 kV', label: '13,8 kV' },
      { value: '23,2 kV', label: '23,2 kV' },
      { value: '34,5 kV', label: '34,5 kV' },
      { value: '69 kV', label: '69 kV' },
      { value: '138 kV', label: '138 kV' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    defaultValue: StatusUnidade.ATIVO,
    options: [
      { value: StatusUnidade.ATIVO, label: 'Ativo' },
      { value: StatusUnidade.INATIVO, label: 'Inativo' },
    ],
  },
  {
    key: 'latitude',
    label: 'Latitude',
    type: 'number',
    required: true,
    placeholder: 'Ex: -23.5505',
    validation: (value) => {
      if (!value) return 'Latitude é obrigatória';
      const num = parseFloat(value as string);
      if (isNaN(num) || num < -90 || num > 90) return 'Latitude deve estar entre -90 e 90';
      return null;
    },
  },
  {
    key: 'longitude',
    label: 'Longitude',
    type: 'number',
    required: true,
    placeholder: 'Ex: -46.6333',
    validation: (value) => {
      if (!value) return 'Longitude é obrigatória';
      const num = parseFloat(value as string);
      if (isNaN(num) || num < -180 || num > 180) return 'Longitude deve estar entre -180 e 180';
      return null;
    },
  },
  {
    key: 'perfil',
    label: 'Perfil',
    type: 'custom',
    required: false,
    colSpan: 2,
    render: ({ value, onChange, disabled, mode, formData, onMultipleChange }: FormFieldProps) => {
      const irrigante = formData?.irrigante || false;
      const sazonal = formData?.sazonal || false;
      const industrial = formData?.industrial || false;
      const geracao = formData?.geracao || false;
      const isView = mode === 'view';

      const handleCheck = (field: string, checked: boolean) => {
        if (!onMultipleChange) return;

        const updates: Record<string, any> = { [field]: checked };

        // Se marcar industrial, desmarcar sazonal
        if (field === 'industrial' && checked) {
          updates.sazonal = false;
        }
        // Se marcar sazonal, desmarcar industrial
        if (field === 'sazonal' && checked) {
          updates.industrial = false;
        }

        onMultipleChange(updates);
      };

      if (isView) {
        const labels = [];
        if (irrigante) labels.push('Irrigante');
        if (sazonal) labels.push('Sazonal');
        if (industrial) labels.push('Industrial');
        if (geracao) labels.push('Geração');

        return (
          <div className="flex flex-wrap gap-2">
            {labels.length > 0 ? labels.map(l => (
              <span key={l} className="px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-muted text-foreground">
                {l}
              </span>
            )) : (
              <span className="text-sm text-muted-foreground">Nenhum perfil selecionado</span>
            )}
          </div>
        );
      }

      return (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 p-2.5 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors">
            <Checkbox
              checked={irrigante}
              onCheckedChange={(checked) => handleCheck('irrigante', !!checked)}
              disabled={disabled}
            />
            <span className="text-sm">Irrigante</span>
          </label>

          <label className={`flex items-center gap-2.5 p-2.5 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors ${industrial ? 'opacity-50' : ''}`}>
            <Checkbox
              checked={sazonal}
              onCheckedChange={(checked) => handleCheck('sazonal', !!checked)}
              disabled={disabled || industrial}
            />
            <span className="text-sm">Sazonal</span>
          </label>

          <label className={`flex items-center gap-2.5 p-2.5 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors ${sazonal ? 'opacity-50' : ''}`}>
            <Checkbox
              checked={industrial}
              onCheckedChange={(checked) => handleCheck('industrial', !!checked)}
              disabled={disabled || sazonal}
            />
            <span className="text-sm">Industrial</span>
          </label>

          <label className="flex items-center gap-2.5 p-2.5 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors">
            <Checkbox
              checked={geracao}
              onCheckedChange={(checked) => handleCheck('geracao', !!checked)}
              disabled={disabled}
            />
            <span className="text-sm">Geração</span>
          </label>
        </div>
      );
    },
  },
  {
    key: 'grupo',
    label: 'Grupo Tarifário',
    type: 'select',
    required: false,
    options: [
      { value: GrupoUnidade.A, label: 'Grupo A' },
      { value: GrupoUnidade.B, label: 'Grupo B' },
    ],
  },
  {
    key: 'subgrupo',
    label: 'Subgrupo Tarifário',
    type: 'select',
    required: false,
    options: [],
    conditionalRender: (formData: any) => {
      return !!formData.grupo;
    },
    getOptions: (formData: any) => {
      if (formData.grupo === GrupoUnidade.B) {
        return [
          { value: SubgrupoUnidade.B, label: 'Subgrupo B' },
        ];
      } else if (formData.grupo === GrupoUnidade.A) {
        return [
          { value: SubgrupoUnidade.A4_VERDE, label: 'A4 Verde' },
          { value: SubgrupoUnidade.A3a_VERDE, label: 'A3a Verde' },
        ];
      }
      return [];
    },
  },
  {
    key: 'demandaCarga',
    label: 'Demanda de Carga (kW)',
    type: 'number',
    required: false,
    placeholder: 'Ex: 150.5',
    validation: (value) => {
      if (value) {
        const num = parseFloat(value as string);
        if (isNaN(num) || num < 0) return 'Demanda de carga deve ser maior ou igual a zero';
      }
      return null;
    },
  },
  {
    key: 'demandaGeracao',
    label: 'Demanda de Geração (kW)',
    type: 'number',
    required: false,
    placeholder: 'Ex: 200.0',
    validation: (value) => {
      if (value) {
        const num = parseFloat(value as string);
        if (isNaN(num) || num < 0) return 'Demanda de geração deve ser maior ou igual a zero';
      }
      return null;
    },
  },
  {
    key: 'concessionariaId',
    label: 'Concessionária de Energia',
    type: 'custom',
    required: false,
    colSpan: 2, // Ocupa 2 colunas
    render: (props: FormFieldProps) => {
      const { value, onChange, disabled, mode, formData } = props;

      if (mode === 'view' && !value) {
        return (
          <div className="w-full px-3 py-2 border border-border bg-muted rounded-md text-muted-foreground italic">
            Nenhuma concessionária vinculada
          </div>
        );
      }

      return (
        <ConcessionariaSelectField
          value={value as string}
          onChange={onChange}
          disabled={disabled || mode === 'view'}
          estado={formData?.estado}
        />
      );
    },
  },
];
