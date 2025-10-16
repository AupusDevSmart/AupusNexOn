// src/features/usuarios/config/filter-config.ts - ATUALIZADO
import { FilterConfig } from '@/types/base';
import { UsuarioStatus, UsuarioRole } from '../types';

export const usuariosFilterConfig: FilterConfig[] = [
  {
    key: 'search',
    label: 'Buscar',
    type: 'text',
    placeholder: 'Pesquisar por nome, email, telefone ou CPF/CNPJ...'
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'all', label: 'Todos os status' },
      { value: UsuarioStatus.ATIVO, label: 'Ativo' },
      { value: UsuarioStatus.INATIVO, label: 'Inativo' }
    ]
  },
  {
    key: 'role',
    label: 'Tipo de Usuário',
    type: 'select',
    options: [
      { value: 'all', label: 'Todos os tipos' },
      { value: UsuarioRole.ADMIN, label: 'Administrador' },
      { value: UsuarioRole.GERENTE, label: 'Gerente' },
      { value: UsuarioRole.VENDEDOR, label: 'Vendedor' },
      { value: UsuarioRole.CONSULTOR, label: 'Consultor' }
    ]
  },
  {
    key: 'cidade',
    label: 'Cidade',
    type: 'text',
    placeholder: 'Filtrar por cidade'
  },
  {
    key: 'estado',
    label: 'Estado',
    type: 'text',
    placeholder: 'Filtrar por estado'
  },
  {
    key: 'includeInactive',
    label: 'Incluir Inativos',
    type: 'checkbox'
  }
];