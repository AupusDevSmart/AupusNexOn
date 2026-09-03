// src/features/usuarios/config/table-config.tsx
import { TableColumn } from '@/core/types/base';
import { Usuario, UsuarioStatus, getUserRoleDisplay } from '../types';

export const usuariosTableColumns: TableColumn<Usuario>[] = [
  {
    key: 'nome',
    label: 'Nome',
    sortable: true,
    render: (usuario) => {
      const isProprietario = usuario.tipo === 'Proprietário' || usuario.perfil === 'Proprietário' || usuario.roles?.some(r => r.toLowerCase() === 'proprietario');
      if (isProprietario) {
        // Continua sendo um <a> de verdade — abre em nova aba, aceita clique
        // do meio —, mas sem pinta de link: azul, sublinhado e o ícone de
        // link externo faziam o nome de um proprietário gritar mais alto que o
        // dos outros usuários numa coluna onde todos são só nomes. O que
        // sinaliza que dá para clicar é o cursor e o title.
        return (
          <a
            href={`/cadastros/plantas?proprietarioId=${usuario.id}&proprietarioNome=${encodeURIComponent(usuario.nome)}`}
            className="font-medium text-foreground no-underline cursor-pointer"
            title={`Ver plantas de ${usuario.nome}`}
          >
            {usuario.nome}
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
  }
];