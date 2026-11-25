// src/features/usuarios/config/filter-config.ts - ATUALIZADO
import { FilterConfig } from '@/core/types/base';
import { UsuarioStatus } from '../types';
import { ROTULO_PAPEL } from '@/store/papeis';

export const usuariosFilterConfig: FilterConfig[] = [
  {
    key: 'search',
    label: 'Buscar',
    type: 'text',
    placeholder: 'Pesquisar por nome, email, telefone ou CPF/CNPJ...',
    className: 'lg:col-span-2'
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
      // Papéis reais (NEXON-143). "Admin" junta super admin e admin na API.
      { value: 'admin', label: 'Admin (inclui super admin)' },
      { value: 'super_admin', label: 'Só super admin' },
      { value: 'analista_automacao', label: ROTULO_PAPEL.analista_automacao },
      { value: 'analista_operacao', label: ROTULO_PAPEL.analista_operacao },
      { value: 'proprietario', label: ROTULO_PAPEL.proprietario },
      { value: 'operador', label: ROTULO_PAPEL.operador },
    ]
  }
];