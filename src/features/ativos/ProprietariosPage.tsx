import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Factory, Mail, MapPin, Pencil, Phone, RefreshCw } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useUserStore } from '@/store/useUserStore';
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
  endereco?: string;
  cep?: string;
  instagram?: string;
  status?: string;
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

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-foreground break-words">{children || <span className="text-muted-foreground">Não informado</span>}</dd>
    </div>
  );
}

/** Ficha do proprietário: o cadastro completo (só leitura) e os atalhos para plantas e instalações. */
function FichaProprietario({ p, onFechar }: { p: Proprietario | null; onFechar: () => void }) {
  const navigate = useNavigate();
  const podeEditar = useUserStore((s) => (s.capacidades?.cadastra?.length ?? 0) > 0);
  const ir = (rota: string) => {
    onFechar();
    navigate(rota);
  };
  const cidadeUf = p?.cidade ? `${p.cidade}${p.estado ? `/${p.estado}` : ''}` : p?.estado;
  const doc = p?.cpf_cnpj ? `${p.tipo === 'pessoa_juridica' ? 'CNPJ' : 'CPF'} ${p.cpf_cnpj}` : 'CPF/CNPJ não informado';

  return (
    <Sheet open={!!p} onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {p && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="truncate" title={p.nome}>{p.nome}</span>
              </SheetTitle>
              <SheetDescription className="tabular-nums">
                {doc}
                {p.status && p.status !== 'Ativo' ? ` · ${p.status}` : ''}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 flex flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Contato</h3>
                <dl className="grid gap-3">
                  <Campo rotulo="E-mail">
                    {p.email && (
                      <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 hover:underline">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {p.email}
                      </a>
                    )}
                  </Campo>
                  <Campo rotulo="Telefone">
                    {p.telefone && (
                      <a href={`tel:${p.telefone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 hover:underline tabular-nums">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {p.telefone}
                      </a>
                    )}
                  </Campo>
                  {p.instagram && <Campo rotulo="Instagram">{p.instagram}</Campo>}
                </dl>
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Endereço</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Campo rotulo="Logradouro">{p.endereco}</Campo>
                  </div>
                  <Campo rotulo="Cidade/UF">{cidadeUf}</Campo>
                  <Campo rotulo="CEP">{p.cep && <span className="tabular-nums">{p.cep}</span>}</Campo>
                </dl>
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">
                  Plantas <span className="font-normal text-muted-foreground tabular-nums">({p.totalPlantas ?? 0})</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-minimal-outline" onClick={() => ir(`/cadastros/plantas?proprietarioId=${p.id.trim()}`)}>
                    <Factory className="h-4 w-4 mr-2" />
                    Ver plantas
                  </button>
                  <button className="btn-minimal-outline" onClick={() => ir(`/ativos/instalacoes?proprietarioId=${p.id.trim()}`)}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Ver instalações
                  </button>
                </div>
              </section>

              {podeEditar && (
                <p className="text-xs text-muted-foreground border-t pt-4">
                  Para alterar estes dados, edite a pessoa em{' '}
                  <button className="inline-flex items-center gap-1 text-foreground hover:underline" onClick={() => ir('/cadastros/usuarios')}>
                    <Pencil className="h-3 w-3" />
                    Usuários e Permissões
                  </button>
                  .
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ProprietariosPage() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useFiltrosNaUrl('ativos:proprietarios', inicial);
  const [lista, setLista] = useState<Proprietario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<Proprietario | null>(null);
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
                <RefreshCw className={`h-4 w-4 md:mr-2 ${carregando ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Atualizar</span>
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
              onView={(p) => setAberto(p)}
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
      <FichaProprietario p={aberto} onFechar={() => setAberto(null)} />
    </Layout>
  );
}
