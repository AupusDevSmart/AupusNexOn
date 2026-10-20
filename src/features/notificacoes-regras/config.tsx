import { BellRing, BellOff } from 'lucide-react';
import { FilterConfig, TableColumn } from '@/types/base';
import type { RegraNotificacao, RegraNotificacaoLinha } from '@/services/regras-notificacao.services';
import { CANAIS, EVENTOS, rotuloCanal, rotuloEvento, rotuloPapel } from './constants';

function parametro(r: RegraNotificacao) {
  if (r.evento === 'sem_comunicacao') return `há mais de ${r.limite_minutos ?? 30} min`;
  if (r.evento === 'vencimento_acesso_morador') return `${r.antecedencia_dias ?? 7} dia(s) antes`;
  return null;
}

function quemRecebe(r: RegraNotificacao) {
  const partes = [
    ...r.papeis.map(rotuloPapel),
    ...r.usuarios.map((u) => u.nome || u.email || 'Usuário removido'),
  ];
  return partes.join(', ') || '—';
}

export const regrasNotificacaoColumns: TableColumn<RegraNotificacaoLinha>[] = [
  {
    key: 'nome',
    label: 'Regra',
    render: (r) => <span className="text-sm font-medium">{r.nome}</span>,
  },
  {
    key: 'evento',
    label: 'Evento',
    render: (r) => (
      <div className="flex flex-col">
        <span className="text-sm">{rotuloEvento(r.evento)}</span>
        {parametro(r) && <span className="text-xs text-muted-foreground">{parametro(r)}</span>}
      </div>
    ),
  },
  {
    key: 'canais',
    label: 'Canais',
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.canais.map((c) => (
          <span key={c} className="text-xs px-2 py-0.5 rounded-full border border-border">
            {rotuloCanal(c)}
          </span>
        ))}
      </div>
    ),
  },
  {
    key: 'destinatarios',
    label: 'Quem recebe',
    render: (r) => <span className="text-sm text-muted-foreground line-clamp-2 max-w-64">{quemRecebe(r)}</span>,
  },
  {
    key: 'plantas',
    label: 'Plantas',
    hideOnTablet: true,
    render: (r) => (
      <span className="text-sm text-muted-foreground line-clamp-2 max-w-56">
        {r.plantas.length ? r.plantas.map((p) => p.nome || p.id).join(', ') : 'Todas'}
      </span>
    ),
  },
  {
    key: 'ativo',
    label: 'Status',
    render: (r) =>
      r.ativo ? (
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <BellRing className="h-4 w-4" />
          <span className="text-xs">Ativa</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-muted-foreground">
          <BellOff className="h-4 w-4" />
          <span className="text-xs">Pausada</span>
        </div>
      ),
  },
];

export const regrasNotificacaoFilters: FilterConfig[] = [
  { key: 'search', type: 'search', placeholder: 'Buscar regra pelo nome...', className: 'lg:col-span-2' },
  {
    key: 'evento',
    type: 'combobox',
    label: 'Evento',
    placeholder: 'Todos os eventos',
    searchPlaceholder: 'Buscar evento...',
    emptyText: 'Nenhum evento',
    options: [{ value: 'all', label: 'Todos os eventos' }, ...EVENTOS.map(({ value, label }) => ({ value, label }))],
  },
  {
    key: 'canal',
    type: 'combobox',
    label: 'Canal',
    placeholder: 'Todos os canais',
    searchPlaceholder: 'Buscar canal...',
    emptyText: 'Nenhum canal',
    options: [{ value: 'all', label: 'Todos os canais' }, ...CANAIS],
  },
  {
    key: 'ativo',
    type: 'combobox',
    label: 'Status',
    placeholder: 'Todos os status',
    searchPlaceholder: 'Buscar status...',
    emptyText: 'Nenhum status',
    options: [
      { value: 'all', label: 'Todos os status' },
      { value: 'true', label: 'Ativa' },
      { value: 'false', label: 'Pausada' },
    ],
  },
];
