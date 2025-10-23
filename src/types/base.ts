// src/types/base.ts - Base types for common components

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Props for custom form field renderers
 */
export interface FormFieldProps {
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  mode?: 'create' | 'edit' | 'view';
  onMultipleChange?: (values: Record<string, any>) => void;
  [key: string]: any; // Allow additional props like estadoId, etc.
}

/**
 * Form field configuration
 */
export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'textarea' | 'custom' | 'password' | 'date' | 'time' | 'datetime-local';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: Array<{ value: string | number; label: string }>;
  validation?: (value: any) => string | null;
  render?: (props: FormFieldProps) => ReactNode;
  group?: string;
  dependencies?: string[];
  help?: string;
  disabled?: boolean;
  min?: string | number;
  max?: string | number;
  component?: any;
  componentProps?: any;
}

/**
 * Table column configuration
 */
export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  key: string;
  label?: string;
  type: 'text' | 'select' | 'checkbox' | 'date' | 'search';
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
  disabled?: boolean;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Pagination configuration
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * API Response with pagination
 */
export interface ApiResponse<T> {
  data: T[];
  pagination: Pagination;
}

/**
 * Filter state for list views
 */
export interface BaseFilters {
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Modal mode
 */
export type ModalMode = 'create' | 'edit' | 'view';

/**
 * Modal state
 */
export interface ModalState<T = any> {
  isOpen: boolean;
  mode: ModalMode;
  entity?: T;
}

/**
 * Modal entity type
 */
export type ModalEntity<T> = T;
