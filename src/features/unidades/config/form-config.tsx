// src/features/unidades/config/form-config.tsx

import React, { useState } from 'react';
import { FormField, FormFieldProps } from '@/types/base';
import { usePlantas } from '../hooks/usePlantas';
import { TipoUnidade, StatusUnidade, ESTADOS_BRASIL, GrupoUnidade, SubgrupoUnidade, TipoUnidadeEnergia } from '../types';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConcessionariaSelectField } from '../components/ConcessionariaSelectField';

/**
 * Componente para exibir Proprietário (read-only)
 */
const ProprietarioDisplay = ({ entity, mode }: FormFieldProps) => {
  // Não mostrar em modo create
  if (mode === 'create' || !entity?.planta?.proprietario) {
    return null;
  }

  const proprietario = entity.planta.proprietario;

  return (
    <div className="w-full px-3 py-2 border border-border bg-muted rounded-md">
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{proprietario.nome}</span>
        <span className="text-sm text-muted-foreground">{proprietario.email}</span>
      </div>
    </div>
  );
};

/**
 * Componente para seleção de Planta
 */
const PlantaSelector = ({ value, onChange, disabled, mode }: FormFieldProps) => {
  const { plantas, loading, error } = usePlantas();

  // Encontrar a planta selecionada para exibir no modo view/edit
  const plantaSelecionada = plantas.find(p => p.id === value);

  // No modo view ou edit, mostrar a planta de forma read-only
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

  if (mode === 'edit') {
    return (
      <div className="w-full px-3 py-2 border border-border bg-muted rounded-md text-muted-foreground cursor-not-allowed">
        {plantaSelecionada ? (
          <span>
            <strong className="text-foreground">{plantaSelecionada.nome}</strong>
            {plantaSelecionada.localizacao && (
              <span className="text-muted-foreground"> - {plantaSelecionada.localizacao}</span>
            )}
            <span className="ml-2 text-xs text-muted-foreground">(não é possível alterar a planta)</span>
          </span>
        ) : (
          <span className="text-muted-foreground italic">Planta não encontrada</span>
        )}
      </div>
    );
  }

  return (
    <select
      value={value as string || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-transparent"
    >
      <option value="">
        {loading ? 'Carregando plantas...' : error ? 'Erro ao carregar plantas' : 'Selecione uma planta'}
      </option>
      {plantas.map((planta) => (
        <option key={planta.id} value={planta.id}>
          {planta.nome} {planta.localizacao ? `- ${planta.localizacao}` : ''}
        </option>
      ))}
    </select>
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
    key: 'proprietario',
    label: 'Proprietário da Planta',
    type: 'custom',
    render: ProprietarioDisplay,
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
    key: 'potencia',
    label: 'Potência (kW)',
    type: 'number',
    required: true,
    placeholder: 'Ex: 100.5',
    validation: (value) => {
      if (!value) return 'Potência é obrigatória';
      const num = parseFloat(value as string);
      if (isNaN(num) || num <= 0) return 'Potência deve ser maior que zero';
      return null;
    },
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    defaultValue: StatusUnidade.ATIVO,
    options: [
      { value: StatusUnidade.ATIVO, label: '✅ Ativo' },
      { value: StatusUnidade.INATIVO, label: '❌ Inativo' },
    ],
  },
  {
    key: 'estado',
    label: 'Estado',
    type: 'select',
    required: true,
    options: ESTADOS_BRASIL,
  },
  {
    key: 'cidade',
    label: 'Cidade',
    type: 'text',
    required: true,
    placeholder: 'Ex: São Paulo',
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
    key: 'pontosMedicao',
    label: 'Pontos de Medição',
    type: 'custom',
    required: false,
    render: PontosMedicaoManager,
    colSpan: 2, // Ocupa 2 colunas
  },
  {
    key: 'irrigante',
    label: 'É Irrigante?',
    type: 'checkbox',
    required: false,
    defaultValue: false,
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
    options: [], // Será preenchido dinamicamente
    conditionalRender: (formData: any) => {
      return !!formData.grupo; // Só mostrar se grupo foi selecionado
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
    key: 'tipoUnidade',
    label: 'Classificação de Consumo',
    type: 'select',
    required: false,
    options: [
      { value: TipoUnidadeEnergia.CARGA, label: 'Carga (Apenas Consumo)' },
      { value: TipoUnidadeEnergia.GERACAO, label: 'Geração (Apenas Produção)' },
      { value: TipoUnidadeEnergia.CARGA_E_GERACAO, label: 'Carga e Geração (Consumo e Produção)' },
    ],
    colSpan: 2, // Ocupa 2 colunas
  },
  {
    key: 'demandaCarga',
    label: 'Demanda de Carga (kW)',
    type: 'number',
    required: false,
    placeholder: 'Ex: 150.5',
    validation: (value, formData: any) => {
      const tipoUnidade = formData?.tipoUnidade;
      if (value) {
        const num = parseFloat(value as string);
        if (isNaN(num) || num < 0) return 'Demanda de carga deve ser maior ou igual a zero';
      }
      return null;
    },
    helpText: (formData: any) => {
      const tipo = formData?.tipoUnidade;
      if (tipo === TipoUnidadeEnergia.CARGA) {
        return 'Este campo é importante para unidades de Carga';
      } else if (tipo === TipoUnidadeEnergia.CARGA_E_GERACAO) {
        return 'Preencha este campo para unidades com Carga e Geração';
      }
      return 'Preencha se aplicável';
    },
  },
  {
    key: 'demandaGeracao',
    label: 'Demanda de Geração (kW)',
    type: 'number',
    required: false,
    placeholder: 'Ex: 200.0',
    validation: (value, formData: any) => {
      const tipoUnidade = formData?.tipoUnidade;
      if (value) {
        const num = parseFloat(value as string);
        if (isNaN(num) || num < 0) return 'Demanda de geração deve ser maior ou igual a zero';
      }
      return null;
    },
    helpText: (formData: any) => {
      const tipo = formData?.tipoUnidade;
      if (tipo === TipoUnidadeEnergia.GERACAO) {
        return 'Este campo é importante para unidades de Geração';
      } else if (tipo === TipoUnidadeEnergia.CARGA_E_GERACAO) {
        return 'Preencha este campo para unidades com Carga e Geração';
      }
      return 'Preencha se aplicável';
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
