// src/features/concessionarias/config/form-config.tsx
import { FormField } from '@/types/base';
import { TarifasFormField } from '../components/TarifasFormField';
import { EstadoSelectField } from '../components/EstadoSelectField';
import { AnexosConcessionariaField } from '../components/AnexosConcessionariaField';

export const concessionariasFormFields: FormField[] = [
  {
    key: 'nome',
    label: 'Nome da Concessionária',
    type: 'text',
    placeholder: 'Ex: CPFL Paulista, CEMIG, COPEL...',
    required: true,
  },
  {
    key: 'estado',
    label: 'Estado (UF)',
    type: 'custom',
    component: EstadoSelectField,
    required: true,
  } as any,
  {
    key: 'numero_reh',
    label: 'REH (Resolucao Homologatoria)',
    type: 'text',
    placeholder: 'Ex: 3.166/2024',
  },
  {
    key: 'data_inicio',
    label: 'Data de Inicio da Vigencia',
    type: 'date',
    placeholder: 'dd/mm/aaaa',
    required: true,
  },
  {
    key: 'data_validade',
    label: 'Data de Validade',
    type: 'date',
    placeholder: 'dd/mm/aaaa',
    required: true,
  },
  {
    key: 'tarifas',
    label: 'Tarifas por Subgrupo',
    type: 'custom',
    component: TarifasFormField,
    colSpan: 2, // Ocupa 2 colunas
  } as any,
  {
    key: 'anexos',
    label: 'Anexos',
    type: 'custom',
    component: AnexosConcessionariaField,
    colSpan: 2, // Ocupa 2 colunas
  } as any
];
