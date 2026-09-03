// src/features/concessionarias/config/form-config.tsx
import { FormField } from '@/core/types/base';
import { TarifasFormField } from '../components/TarifasFormField';
import { EstadoSelectField } from '../components/EstadoSelectField';
import { AnexosConcessionariaField } from '../components/AnexosConcessionariaField';
import { HoraField } from '../components/HoraField';

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
  // ============== Horarios dos postos tarifarios ==============
  // Grupo "horarios" separa visualmente (BaseForm renderiza <h3 + Separator>
  // pra todo group != 'main'). Pares "Inicio | Fim" ficam lado a lado no
  // grid 2-col do BaseForm (colSpan default = 1).
  // HoraField mostra <input type="time"> e converte HH:MM <-> decimal.
  // Backend grava decimal (18 = 18:00, 21.5 = 21:30).
  {
    key: 'hora_inicio_ponta',
    label: 'Ponta — Início',
    type: 'custom',
    component: HoraField,
    group: 'horarios',
    defaultValue: 18,
  } as any,
  {
    key: 'hora_fim_ponta',
    label: 'Ponta — Fim',
    type: 'custom',
    component: HoraField,
    group: 'horarios',
    defaultValue: 21,
  } as any,
  {
    key: 'hora_inicio_reservado',
    label: 'Reservado — Início',
    type: 'custom',
    component: HoraField,
    group: 'horarios',
    defaultValue: 21.5,
  } as any,
  {
    key: 'hora_fim_reservado',
    label: 'Reservado — Fim (dia seguinte)',
    type: 'custom',
    component: HoraField,
    group: 'horarios',
    defaultValue: 6,
  } as any,
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
