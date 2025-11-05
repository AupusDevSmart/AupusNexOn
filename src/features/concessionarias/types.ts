// src/features/concessionarias/types.ts
import { AnexoConcessionaria } from '@/services/concessionarias.services';

export interface ConcessionariasFilters {
  search: string;
  estado: string;
  page: number;
  limit: number;
}

export type SubgrupoTipo = 'A4_VERDE' | 'A3a_VERDE' | 'B';

// Tipo para anexos temporários (arquivos ainda não enviados ao servidor)
export interface AnexoTemporario {
  id: string;
  file: File;
  nome_original: string;
  tamanho: number;
  mime_type: string;
  isTemporary: true;
}

// Union type para anexos (salvos ou temporários)
export type AnexoItem = AnexoConcessionaria | AnexoTemporario;

export interface SubgrupoInfo {
  id: SubgrupoTipo;
  label: string;
  grupo: 'A' | 'B';
  campos: Array<{
    key: string;
    label: string;
    placeholder: string;
  }>;
}

export const SUBGRUPOS: SubgrupoInfo[] = [
  {
    id: 'A4_VERDE',
    label: 'A4 VERDE',
    grupo: 'A',
    campos: [
      { key: 'tusd_d', label: 'TUSD Demanda', placeholder: '0.123456' },
      { key: 'tusd_p', label: 'TUSD Ponta', placeholder: '0.654321' },
      { key: 'tusd_fp', label: 'TUSD Fora Ponta', placeholder: '0.234567' },
      { key: 'te_d', label: 'TE Demanda', placeholder: '0.345678' },
      { key: 'te_p', label: 'TE Ponta', placeholder: '0.456789' },
      { key: 'te_fp', label: 'TE Fora Ponta', placeholder: '0.567890' },
    ],
  },
  {
    id: 'A3a_VERDE',
    label: 'A3a VERDE',
    grupo: 'A',
    campos: [
      { key: 'tusd_d', label: 'TUSD Demanda', placeholder: '0.123456' },
      { key: 'tusd_p', label: 'TUSD Ponta', placeholder: '0.654321' },
      { key: 'tusd_fp', label: 'TUSD Fora Ponta', placeholder: '0.234567' },
      { key: 'te_d', label: 'TE Demanda', placeholder: '0.345678' },
      { key: 'te_p', label: 'TE Ponta', placeholder: '0.456789' },
      { key: 'te_fp', label: 'TE Fora Ponta', placeholder: '0.567890' },
    ],
  },
  {
    id: 'B',
    label: 'Grupo B',
    grupo: 'B',
    campos: [
      { key: 'tusd_valor', label: 'TUSD Valor', placeholder: '0.543210' },
      { key: 'te_valor', label: 'TE Valor', placeholder: '0.432109' },
    ],
  },
];
