// src/features/usuarios/config/table-config.tsx
import { TableColumn } from '@/core/types/base';
import { Usuario, UsuarioStatus, getUserRoleDisplay, getUserPrimaryRole } from '../types';
import { papelCanonico } from '@/store/papeis';

// Cor por papel (NEXON-143): bater o olho e saber quem é quem.
const COR_PAPEL: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  analista_automacao: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  analista_operacao: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  proprietario: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  operador: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  outro: 'bg-muted text-muted-foreground',
};

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
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${usuario.status === UsuarioStatus.ATIVO ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
        />
        <span className={usuario.status === UsuarioStatus.ATIVO ? 'text-foreground' : 'text-muted-foreground'}>
          {usuario.status}
        </span>
      </span>
    )
  },
  {
    key: 'roles',
    label: 'Tipo',
    render: (usuario) => {
      const roleDisplay = getUserRoleDisplay(usuario);
      const nome = getUserPrimaryRole(usuario)?.name ?? '';
      const cor = COR_PAPEL[papelCanonico(nome)] ?? COR_PAPEL.outro;
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cor}`}>
          {nome.toLowerCase() === 'super_admin' ? 'Super admin' : roleDisplay}
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