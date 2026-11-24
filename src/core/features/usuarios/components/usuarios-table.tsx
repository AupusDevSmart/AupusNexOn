// src/features/usuarios/components/usuarios-table.tsx
// Removed unused React import
import { BaseTable } from '@/core/components/common/base-table/BaseTable';
import { KeyRound, Users } from 'lucide-react';
import { useUserStore } from '@/core/context/hooks';
import { isOperador } from './acesso-operador/ehOperador';
import { Usuario, Pagination } from '../types';
import { usuariosTableColumns } from '../config/table-config';

interface UsuariosTableProps {
  usuarios: Usuario[];
  loading: boolean;
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onView: (usuario: Usuario) => void;
  onEdit: (usuario: Usuario) => void;
  onPlantasClick: (usuario: Usuario) => void; // ✅ Mantido para compatibilidade mas não usado na tabela
  /** Abre direto a tela de permissões do operador (NEXON-143). */
  onAbrirAcesso?: (usuario: Usuario) => void;
}

export function UsuariosTable({ 
  usuarios, 
  loading, 
  pagination, 
  onPageChange, 
  onView, 
  onEdit,
  onPlantasClick: _onPlantasClick, // ✅ Recebido mas não usado - só pelo modal
  onAbrirAcesso,
}: UsuariosTableProps) {
  const { capacidades } = useUserStore();
  const podeGerirAcesso = !!capacidades?.gerirAcessoOperador && !!onAbrirAcesso;

  return (
    <BaseTable
      data={usuarios}
      columns={usuariosTableColumns}
      pagination={pagination}
      loading={loading}
      onPageChange={onPageChange}
      onView={onView}
      onEdit={onEdit}
      customActions={
        podeGerirAcesso
          ? [
              {
                key: 'permissoes',
                label: 'Permissões',
                icon: KeyRound,
                condition: (u: Usuario) => isOperador(u),
                handler: (u: Usuario) => onAbrirAcesso?.(u),
              },
            ]
          : []
      }
      emptyMessage="Nenhum usuário encontrado."
      emptyIcon={<Users className="h-8 w-8 text-muted-foreground/50" />}
    />
  );
}