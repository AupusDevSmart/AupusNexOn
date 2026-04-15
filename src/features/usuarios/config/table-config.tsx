// src/features/usuarios/config/table-config.tsx
import { ExternalLink } from 'lucide-react';
import { TableColumn } from '@/types/base';
import { Usuario, UsuarioStatus, getUserRoleDisplay } from '../types';

export const usuariosTableColumns: TableColumn<Usuario>[] = [
  {
    key: 'nome',
    label: 'Nome',
    sortable: true,
    render: (usuario) => {
      const isProprietario = usuario.tipo === 'Proprietário' || usuario.perfil === 'Proprietário' || usuario.roles?.some(r => r.toLowerCase() === 'proprietario');
      if (isProprietario) {
        return (
          <a
            href={`/cadastros/plantas?proprietarioId=${usuario.id}&proprietarioNome=${encodeURIComponent(usuario.nome)}`}
            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline flex items-center gap-1 group"
            title={`Ver plantas de ${usuario.nome}`}
          >
            <span>{usuario.nome}</span>
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        );
      }
      return <span className="font-medium">{usuario.nome}</span>;
    }
  },
  {
    key: 'status',
    label: 'Status',
    render: (usuario) => (
      <span className={`text-sm ${usuario.status === UsuarioStatus.ATIVO
        ? 'text-foreground'
        : 'text-muted-foreground'
      }`}>
        {usuario.status}
      </span>
    )
  },
  {
    key: 'roles',
    label: 'Tipo',
    render: (usuario) => {
      const roleDisplay = getUserRoleDisplay(usuario);
      return (
        <span className="text-sm text-foreground">
          {roleDisplay}
        </span>
      );
    }
  },
  {
    key: 'email',
    label: 'Email',
    hideOnTablet: true,
    render: (usuario) => (
      <span className="text-sm text-muted-foreground truncate max-w-48" title={usuario.email}>
        {usuario.email}
      </span>
    )
  },
  {
    key: 'telefone',
    label: 'Telefone',
    hideOnMobile: true,
    render: (usuario) => (
      <span className="text-sm text-muted-foreground">
        {usuario.telefone || '-'}
      </span>
    )
  },
  {
    key: 'all_permissions',
    label: 'Permissões',
    hideOnMobile: true,
    render: (usuario) => (
      <span className="text-sm text-muted-foreground">
        {usuario.all_permissions.length}
      </span>
    )
  }
];