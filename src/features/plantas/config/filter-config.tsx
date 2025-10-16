// src/features/plantas/config/filter-config.tsx - VERSÃO SIMPLIFICADA
import React, { useState, useEffect } from 'react';
import { FilterConfig } from '@/types/base';
import { User, Building2 } from 'lucide-react';
import { PlantasService, ProprietarioBasico } from '@/services/plantas.services';

// ✅ HOOK: Para usar os proprietários em outros lugares
export const useProprietarios = () => {
  const [proprietarios, setProprietarios] = useState<ProprietarioBasico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProprietarios = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 [USE PROPRIETARIOS] Carregando proprietários...');
      const data = await PlantasService.getProprietarios();
      
      console.log('✅ [USE PROPRIETARIOS] Proprietários carregados:', data.length);
      setProprietarios(data);
      
    } catch (err: any) {
      console.error('❌ [USE PROPRIETARIOS] Erro:', err);
      setError(err.message || 'Erro ao carregar proprietários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProprietarios();
  }, []);

  return {
    proprietarios,
    loading,
    error,
    refetch: fetchProprietarios
  };
};

// ✅ FUNÇÃO: Para gerar opções do filtro de proprietário
export const generateProprietarioOptions = (proprietarios: ProprietarioBasico[]) => {
  const options = [
    { value: 'all', label: 'Todos os proprietários' }
  ];

  proprietarios.forEach((proprietario) => {
    const temCpfCnpj = proprietario.cpf_cnpj && !proprietario.cpf_cnpj.includes('não informado');
    const isPF = proprietario.tipo === 'pessoa_fisica';
    const icon = isPF ? '👤' : '🏢';
    const tipoLabel = isPF ? 'PF' : 'PJ';
    
    let label = `${icon} ${proprietario.nome}`;
    
    if (temCpfCnpj) {
      label += ` (${proprietario.cpf_cnpj.substring(0, 8)}...)`;
    } else {
      label += ' ⚠️';
    }
    
    // Adicionar indicador de tipo
    label += ` - ${tipoLabel}`;

    options.push({
      value: proprietario.id,
      label: label
    });
  });

  return options;
};

// ✅ CONFIGURAÇÃO BASE: Será populada dinamicamente
export const createPlantasFilterConfig = (proprietarios: ProprietarioBasico[]): FilterConfig[] => [
  {
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por nome, CNPJ ou localização...',
    className: 'lg:min-w-80'
  },
  {
    key: 'proprietarioId',
    type: 'select',
    label: 'Proprietário',
    className: 'min-w-64',
    options: generateProprietarioOptions(proprietarios)
  }
];

// ✅ CONFIGURAÇÃO PADRÃO: Para quando os proprietários ainda não foram carregados
export const plantasFilterConfig: FilterConfig[] = [
  {
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por nome, CNPJ ou localização...',
    className: 'lg:min-w-80'
  },
  {
    key: 'proprietarioId',
    type: 'select',
    label: 'Proprietário',
    className: 'min-w-64',
    options: [
      { value: 'all', label: 'Carregando proprietários...' }
    ]
  }
];