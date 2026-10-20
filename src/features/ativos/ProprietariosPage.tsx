import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Factory, MapPin, RefreshCw } from 'lucide-react';
import { Layout } from '@/core/components/common/Layout';
import { TitleCard } from '@/core/components/common/title-card';
import { BaseTable } from '@/core/components/common/base-table/BaseTable';
import { BaseFilters } from '@/core/components/common/base-filters/BaseFilters';
import type { TableColumn } from '@/core/types/base';
import { api } from '@/config/api';
import { toast } from '@/core/hooks/use-toast';
import { useFiltrosNaUrl } from '@/hooks/useEstadoLembrado';

/**
 * Ativos › Proprietários (NEXON-21): os donos das plantas, com contato e
 * quantas plantas cada um tem. Daqui se vai para as plantas ou para as
 * instalações dele. O cadastro da pessoa continua em Usuários e Permissões.
 */

interface Proprietario {
  id: string;
  nome: string;
  cpf_cnpj?: string;
  tipo?: 'pessoa_fisica' | 'pessoa_juridica';
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  role?: string;
  totalPlantas?: number;
}

const inicial = { search: '', page: 1, limit: 15 };

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const colunas: TableColumn<Proprietario>[] = [
  {
    key: 'nome',
    label: 'Proprietário',
    render: (p) => (
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate max-w-64" title={p.nome}>{p.nome}</span>
      </div>
    ),
  },
  {
    key: 'cpf_cnpj',
    label: 'CPF/CNPJ',
    render: (p) => <span className="text-sm tabular-nums">{p.cpf_cnpj || '-'}</span>,
  },
  {
    key: 'contato',
    label: 'Contato',
    hideOnTablet: true,
    render: (p) => (
      <div className="min-w-0 text-sm">
        <span className="block truncate max-w-56" title={p.email}>{p.email || '-'}</span>
        {p.telefone && <span className="block text-xs text-muted-foreground">{p.telefone}</span>}
      </div>
    ),
  },
  {
    key: 'cidade',
    label: 'Cidade',
    hideOnTablet: true,
    render: (p) => <span className="text-sm">{p.cidade ? `${p.cidade}${p.estado ? `/${p.estado}` : ''}` : '-'}</span>,
  },
  {
    key: 'plantas',
    label: 'Plantas',
    align: 'right',
    render: (p) => <span className="text-sm tabular-nums">{p.totalPlantas ?? '-'}</span>,
  },
];

export default function ProprietariosPage() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useFiltrosNaUrl('ativos:proprietarios', inicial);
  const [lista, setLista] = useState<Proprietario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const requisicao = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++requisicao.current;
    setCarregando(true);
    try {
      const res = await api.get('/plantas/proprietarios');
      if (minha !== requisicao.current) return;
      const corpo = res.data as unknown;
      const itens = (Array.isArray(corpo) ? corpo : (corpo as { data?: Proprietario[] })?.data ?? []) as Proprietario[];
      // A lista da API traz também admin e gerente (podem ser donos de planta);
      // aqui ficam só os proprietários de fato e quem tem planta no nome.
      setLista(itens.filter((p) => p.role === 'proprietario' || (p.totalPlantas ?? 0) > 0));
    } catch {
      if (minha === requisicao.current) {
        toast({ title: 'Não foi possível carregar os proprietários', variant: 'destructive' });
      }
    } finally {
      if (minha === requisicao.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = semAcento(filtros.search.trim());
    if (!termo) return lista;
    const digitos = termo.replace(/\D/g, '');
    return lista.filter(
      (p) =>
        semAcento(p.nome).includes(termo) ||
        semAcento(p.email ?? '').includes(termo) ||
        semAcento(p.cidade ?? '').includes(termo) ||
        (digitos.length > 0 && (p.cpf_cnpj ?? '').replace(/\D/g, '').includes(digitos)),
    );
  }, [lista, filtros.search]);

  const pagina = filtrados.slice((filtros.page - 1) * filtros.limit, filtros.page * filtros.limit);
  const pagination = {
    page: filtros.page,
    limit: filtros.limit,
    total: filtrados.length,
    totalPages: Math.max(1, Math.ceil(filtrados.length / filtros.limit)),
  };

  const filterConfig = useMemo(
    () => [
      {
        key: 'search',
        type: 'search' as const,
        placeholder: 'Buscar por nome, CPF/CNPJ, e-mail ou cidade...',
        className: 'lg:col-span-2',
      },
    ],
    [],
  );

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard title="Proprietários" description="Donos das plantas e quantas plantas cada um tem" />

          <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-start">
            <div className="flex-1">
              <BaseFilters
                filters={filtros}
                config={filterConfig}
                onFilterChange={(novos: Partial<typeof inicial>) => setFiltros((f) => ({ ...f, ...novos, page: 1 }))}
              />
            </div>
            <div className="flex flex-row gap-2 w-full lg:w-auto">
              <button
                onClick={() => void carregar()}
                disabled={carregando}
                className="btn-minimal-outline flex-1 lg:flex-none whitespace-nowrap"
              >
                <RefreshCw className={`h-4 w-4 lg:mr-2 ${carregando ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Atualizar</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <BaseTable
              data={pagina}
              columns={colunas}
              pagination={pagination}
              loading={carregando}
              onPageChange={(page) => setFiltros((f) => ({ ...f, page }))}
              onView={(p) => navigate(`/cadastros/plantas?proprietarioId=${p.id.trim()}`)}
              customActions={[
                {
                  key: 'ver_plantas',
                  label: 'Ver plantas',
                  icon: <Factory className="h-4 w-4" />,
                  handler: (p) => navigate(`/cadastros/plantas?proprietarioId=${p.id.trim()}`),
                },
                {
                  key: 'ver_instalacoes',
                  label: 'Ver instalações',
                  icon: <MapPin className="h-4 w-4" />,
                  handler: (p) => navigate(`/ativos/instalacoes?proprietarioId=${p.id.trim()}`),
                },
              ]}
              emptyMessage={
                filtros.search
                  ? `Nenhum proprietário encontrado para "${filtros.search}".`
                  : 'Nenhum proprietário encontrado.'
              }
              emptyIcon={<Briefcase className="h-8 w-8 text-muted-foreground/50" />}
            />
          </div>
        </div>
      </Layout.Main>
    </Layout>
  );
}
