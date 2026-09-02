// src/features/unidades/config/form-config.tsx

import React, { useState } from 'react';
import { FormField, FormFieldProps } from '@/core/types/base';
import { usePlantasForUnidades } from '@/core/context/hooks';
import { TipoUnidade, StatusUnidade, GrupoUnidade, SubgrupoUnidade } from '../types';
import { X, Plus } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { ConcessionariaSelectField } from '../components/ConcessionariaSelectField';
import { Combobox } from '@/core/components/ui/combobox-minimal';
import { Checkbox } from '@/core/components/ui/checkbox';

/**
 * Componente para selecionar/exibir Proprietário
 */
const ProprietarioSelector = ({ value, onChange, mode, entity, formData }: FormFieldProps) => {
  const { plantas, loading: loadingPlantas } = usePlantasForUnidades();

  // O proprietário NÃO é escolhido aqui: a instalação pertence à PLANTA, e a planta a um
  // proprietário. Então o dono é SEMPRE derivado da planta selecionada e exibido read-only
  // (não faz sentido trocar o proprietário da instalação). Ver decisão do usuário 2026-07-08.
  const plantaIdSel = (formData?.plantaId as string) || (entity as any)?.planta_id || '';
  const plantaSel = plantas.find(p => p.id === plantaIdSel);
  const proprietario = plantaSel?.proprietario ?? entity?.planta?.proprietario ?? null;

  // Mantém o formData.proprietarioId em sincronia com o dono derivado (não quebra
  // validação/submit de quem espera esse campo). Read-only pro usuário.
  React.useEffect(() => {
    const id = proprietario?.id ?? '';
    if (onChange && (((value as string) || '') !== id)) onChange(id);
  }, [proprietario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingPlantas && !proprietario) {
    return (
      <div className="campo-estatico text-sm text-muted-foreground">
        <span className="truncate">Carregando...</span>
      </div>
    );
  }

  // Mesma caixa dos demais campos: altura, borda e raio iguais. Antes era um
  // bloco de duas linhas com nome e email, mais alto e mais escuro que tudo em
  // volta — parecia outra coisa, quando e so mais um campo que nao se edita.
  // O email vai no title, que e onde ele serve sem custar altura.
  return (
    <div
      className="campo-estatico text-sm"
      title={proprietario?.email || undefined}
    >
      <span className={`truncate ${proprietario ? '' : 'text-muted-foreground'}`}>
        {proprietario ? proprietario.nome : 'Definido pela planta selecionada'}
      </span>
    </div>
  );
};

/**
 * Componente para seleção de Planta
 */
const PlantaSelector = ({ value, onChange, disabled, mode, formData, onMultipleChange }: FormFieldProps) => {
  const { plantas, loading, error } = usePlantasForUnidades();

  // 🔍 DEBUG: Ver o que está chegando
  React.useEffect(() => {
  }, [value, mode, formData, plantas.length]);

  // Encontrar a planta selecionada para exibir
  const plantaSelecionada = plantas.find(p => p.id === value);

  // Lista TODAS as plantas acessíveis. O proprietário é DERIVADO da planta (read-only),
  // então não filtramos por dono aqui — a planta é escolhida direto (com o dono no rótulo).
  const plantasFiltradas = plantas;

  // No modo view, mostrar a planta de forma read-only
  if (mode === 'view') {
    return (
      <div className="w-full px-3 py-2 border border-border bg-muted rounded-md text-foreground">
        {plantaSelecionada ? (
          <strong>{plantaSelecionada.nome}</strong>
        ) : (
          <span className="text-muted-foreground italic">Planta não encontrada</span>
        )}
      </div>
    );
  }

  // Modo create/edit: usar Combobox pesquisável
  // Só o nome da planta. O dono vinha junto no rótulo para desambiguar plantas
  // homônimas de proprietários diferentes, mas ele agora tem campo próprio ao
  // lado, preenchido assim que a planta é escolhida — repetir no rótulo só
  // alongava a linha.
  const plantasOptions = plantasFiltradas.map(planta => ({
    value: planta.id,
    label: planta.nome
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

  const isDisabled = disabled;

  // Auto-fill estado/cidade when planta changes.
  //
  // Le as duas formas do objeto planta: a lista que alimenta este combobox vem
  // achatada pelo adaptador do consumidor (planta.uf), mas a mesma entidade
  // aparece noutros lugares com o endereco aninhado. Depender so da forma
  // achatada e o tipo de coisa que falha em silencio quando o adaptador muda —
  // e estado/cidade nao tem campo neste formulario para alguem corrigir.
  const handlePlantaChange = (plantaId: string) => {
    const planta = plantas.find(p => p.id === plantaId);
    if (planta && onMultipleChange) {
      const endereco = (planta as any)?.endereco || {};
      onMultipleChange({
        plantaId: plantaId,
        estado: String(endereco.uf ?? planta.uf ?? '').trim(),
        cidade: String(endereco.cidade ?? planta.cidade ?? '').trim(),
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
        placeholder="Selecione uma planta"
        searchPlaceholder="Buscar planta..."
        emptyText="Nenhuma planta encontrada"
        disabled={isDisabled}
        className="w-full"
      />
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
    key: 'plantaId',
    label: 'Planta',
    type: 'custom',
    render: PlantaSelector,
    required: true,
  },
  {
    key: 'proprietarioId',
    label: 'Proprietário',
    type: 'custom',
    render: ProprietarioSelector,
    required: false,
  },
  {
    // Sem colSpan: 2 nestes quatro. Era ele que impedia a linha de três — o
    // BaseForm traduz colSpan 2 para largura TOTAL (`grid-column: 1 / -1`),
    // independente de quantas colunas a grade tenha. Com ele, cada campo
    // continuava sozinho na sua linha por mais que a grade fosse de três.
    key: 'nome',
    label: 'Nome da Instalação',
    type: 'text',
    required: true,
    placeholder: 'Ex: Unidade 1, Subestação Principal, etc.',
  },
  {
    // Sem colSpan: divide a linha com o status, que fica ao lado dele.
    key: 'numeroUc',
    label: 'Número da Unidade Consumidora',
    type: 'text',
    required: false,
    placeholder: 'Ex: 123456789',
  },
  {
    key: 'tipo',
    // Rotulo pedido pelo usuario. A chave continua 'tipo' — e o campo do banco,
    // e renomear coluna por causa de rotulo de tela nao se paga.
    label: 'Perfil',
    type: 'select',
    required: true,
    options: [
      { value: TipoUnidade.CARGA, label: 'Carga' },
      { value: TipoUnidade.GERACAO, label: 'Geração' },
      { value: TipoUnidade.MISTO, label: 'Misto' },
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
