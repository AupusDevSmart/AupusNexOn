// src/features/usuarios/config/table-config.tsx - ATUALIZADO
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  User,
  Shield,
  Users,
  Phone,
  Mail,
  UserCheck,
  Home,
  Briefcase,
  UserCircle,
  Crown
} from 'lucide-react';
import { TableColumn } from '@/types/base';
import { Usuario, UsuarioStatus, getUserRoleDisplay } from '../types';

// ✅ FUNÇÃO PARA OBTER ÍCONE DO ROLE
const getRoleIcon = (role: string) => {
  const icons = {
    'super_admin': Crown,
    'admin': Shield,
    'gerente': Building2,
    'vendedor': Users,
    'consultor': UserCheck,
    'proprietario': Home,
    'corretor': Briefcase,
    'cativo': UserCircle,
    'associado': User,
  };
  const Icon = icons[role as keyof typeof icons] || User;
  return <Icon className="h-3 w-3 mr-1" />;
};

// ✅ FUNÇÃO PARA OBTER COR DO ROLE
const getRoleColor = (role: string) => {
  const colors = {
    'super_admin': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
    'admin': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
    'gerente': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    'vendedor': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
    'consultor': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
    'proprietario': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300',
    'corretor': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300',
    'cativo': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300',
    'associado': 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-300',
  };
  return colors[role as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200';
};

export const usuariosTableColumns: TableColumn<Usuario>[] = [
  {
    key: 'nome',
    label: 'Nome',
    sortable: true,
    render: (usuario) => (
      <div className="font-medium">
        {usuario.nome}
      </div>
    )
  },
  {
    key: 'status',
    label: 'Status',
    render: (usuario) => (
      <div className="flex justify-left">
        <Badge 
          variant="outline" 
          className={`w-16 justify-center ${usuario.status === UsuarioStatus.ATIVO 
            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300'
            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          {usuario.status}
        </Badge>
      </div>
    )
  },
  {
    key: 'roles',
    label: 'Tipo',
    render: (usuario) => {
      const roleDisplay = getUserRoleDisplay(usuario);
      const primaryRole = usuario.roles?.[0];

      return (
        <div className="flex justify-left">
          <Badge
            variant="outline"
            className={`w-36 justify-center whitespace-nowrap ${getRoleColor(primaryRole || 'consultor')}`}
          >
            {getRoleIcon(primaryRole || 'consultor')}
            {roleDisplay}
          </Badge>
        </div>
      );
    }
  },
  {
    key: 'email',
    label: 'Email',
    hideOnTablet: true,
    render: (usuario) => (
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm truncate max-w-48" title={usuario.email}>
          {usuario.email}
        </span>
      </div>
    )
  },
  {
    key: 'telefone',
    label: 'Telefone',
    hideOnMobile: true,
    render: (usuario) => (
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">
          {usuario.telefone || '-'}
        </span>
      </div>
    )
  },
  {
    key: 'all_permissions',
    label: 'Permissões',
    hideOnMobile: true,
    render: (usuario) => (
      <div className="flex items-center gap-1">
        <Badge variant="secondary" className="text-xs">
          {usuario.all_permissions.length}
        </Badge>
        <span className="text-xs text-muted-foreground">permissões</span>
      </div>
    )
  }
];