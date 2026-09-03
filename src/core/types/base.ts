import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormFieldProps {
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  mode?: 'create' | 'edit' | 'view';
  onMultipleChange?: (values: Record<string, any>) => void;
  formData?: any;
  [key: string]: any;
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'textarea' | 'custom' | 'password' | 'date' | 'time' | 'datetime-local' | 'combobox';
  required?: boolean;
  colSpan?: number;
  condition?: (formData: any) => boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: Array<{ value: string | number; label: string }>;
  validation?: (value: any, formData?: any) => string | null;
  render?: (props: FormFieldProps) => ReactNode;
  group?: string;
  dependencies?: string[];
  help?: string;
  disabled?: boolean;
  min?: string | number;
  max?: string | number;
  component?: any;
  componentProps?: any;
  conditionalRender?: (formData: any) => boolean;
  getOptions?: (formData: any) => Array<{ value: string | number; label: string }>;
}

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  /**
   * No celular a BaseTable troca a tabela por cartoes, e esta e a coluna que
   * vira o titulo do cartao — as demais viram pares rotulo/valor abaixo dela.
   *
   * Sem marcar nenhuma, o titulo e a primeira coluna. Isso serve para a maioria
   * das telas, mas nao quando a primeira coluna e um avatar ou um icone: ai
   * vale apontar a coluna que identifica a linha para quem le.
   */
  primaryOnMobile?: boolean;
}

export type CustomAction<T = any> = TableAction<T>;

export interface TableAction<T = any> {
  key: string;
  label: string;
  handler?: (entity: T) => void;
  onClick?: (entity: T) => void;
  condition?: (entity: T) => boolean;
  icon?: ReactNode | React.ComponentType<any>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export interface FilterConfig {
  key: string;
  label?: string;
  type: 'text' | 'select' | 'checkbox' | 'date' | 'search' | 'combobox' | 'custom';
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
  disabled?: boolean;
  icon?: LucideIcon;
  className?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  render?: (props: any) => ReactNode;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface BaseFilters {
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export type ModalMode = 'create' | 'edit' | 'view' | 'programar' | (string & {});

export interface ModalState<T = any> {
  isOpen: boolean;
  mode: ModalMode;
  entity?: T;
}

export type ModalEntity<T> = T;
