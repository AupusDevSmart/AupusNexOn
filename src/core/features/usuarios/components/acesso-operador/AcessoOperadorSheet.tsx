// Tela "Acesso do operador" (NEXON-20, spec 4.4 — PER-21a/b).
// Usuários → [operador] → Acesso. Um vínculo por proprietário; dentro dele, a
// lista de equipamentos que o operador vê, "Ver R$" (pivô/carregador), "Ver
// geração" por instalação com usina e uma validade opcional.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  Box,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Cog,
  Droplets,
  Factory,
  Gauge,
  KeyRound,
  Loader2,
  PlugZap,
  Search,
  Sun,
  ToggleRight,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { Button } from '@/core/components/ui/button';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Switch } from '@/core/components/ui/switch';
import { Input } from '@/core/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';
import { useHttpClient, useUserStore } from '@/core/context/hooks';
import {
  type EquipamentoArvore,
  type EstadoMarcacao,
  type GrupoAcesso,
  type PlantaArvore,
  type Selecao,
  type UnidadeArvore,
  alternarCategoria,
  alternarEquipamento,
  alternarInstalacao,
  alternarPlantas,
  categoriaDe,
  chipsDe,
  dataBr,
  definirVerGeracao,
  definirVerRs,
  estadoInstalacao,
  estadoPlantas,
  filtrarPlanta as unidadesDaBusca,
  gravacoesDe,
  limparPlantas,
  resumoDe,
  revisar,
  selecaoInicialGrupos,
} from './selecao';

export interface OperadorBasico {
  id: string;
  nome: string;
  email?: string;
}

interface AcessoOperadorSheetProps {
  isOpen: boolean;
  operador: OperadorBasico | null;
  onClose: () => void;
  /** Volta para a aba "Dados" do usuário (modal de cadastro). */
  onVerDados?: () => void;
  /** Recém-cadastrado: mostra que este é o passo 2. */
  novo?: boolean;
}

const VAZIA: Selecao = { equipamentos: {}, geracao: [], validade: null };

const dadosDe = (resp: any) => resp?.data?.data ?? resp?.data ?? null;

const mensagemDe = (err: any, padrao: string): string => {
  const d = err?.response?.data;
  const m = d?.error?.message ?? d?.message;
  if (Array.isArray(m)) return m.join(', ');
  return (typeof m === 'string' && m) || padrao;
};

const hojeSP = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const chaveUnidade = (p: PlantaArvore, u: UnidadeArvore) => u.id ?? `sem-instalacao:${p.id}`;

function iconeEquipamento(e: EquipamentoArvore): LucideIcon {
  switch (categoriaDe(e).chave) {
    case 'pivos':
      return Droplets;
    case 'usinas':
      return Zap;
    case 'carregadores':
      return PlugZap;
    case 'disjuntores':
      return ToggleRight;
    case 'medidores':
      return Gauge;
    case 'motores':
      return Cog;
    default:
      return Box;
  }
}

function iconeInstalacao(u: UnidadeArvore): LucideIcon {
  if (u.tem_usina) return Sun;
  if (u.equipamentos.some((e) => (e.tipo_codigo ?? '').toUpperCase() === 'PIVO')) return Droplets;
  return Factory;
}

const checkedDe = (estado: EstadoMarcacao): boolean | 'indeterminate' =>
  estado === 'todos' ? true : estado === 'alguns' ? 'indeterminate' : false;

export function AcessoOperadorSheet({ isOpen, operador, onClose, onVerDados, novo }: AcessoOperadorSheetProps) {
  const http = useHttpClient();
  const { capacidades } = useUserStore();
  const podeVerGeracao = !!capacidades?.liberarVerGeracao;

  const [grupos, setGrupos] = useState<GrupoAcesso[] | null>(null);
  const [nomeApi, setNomeApi] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [inicial, setInicial] = useState<Selecao>(VAZIA);
  const [sel, setSel] = useState<Selecao>(VAZIA);
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [revisando, setRevisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [descartar, setDescartar] = useState<(() => void) | null>(null);
  const pedido = useRef(0);

  const operadorId = operador?.id?.trim() ?? '';
  const nomeOperador = nomeApi || operador?.nome || 'O operador';

  // ---------------------------------------------------------------------------
  // Carga: todos os proprietários de uma vez (NEXON-143)
  // ---------------------------------------------------------------------------

  const carregar = useCallback(async () => {
    if (!operadorId) return;
    const meu = ++pedido.current;
    setCarregando(true);
    setErro(null);
    try {
      const d = dadosDe(await http.get(`/usuarios/${operadorId}/vinculos/arvore-completa`));
      if (meu !== pedido.current) return;
      const lista: GrupoAcesso[] = Array.isArray(d?.grupos) ? d.grupos : [];
      const s0 = selecaoInicialGrupos(lista);
      setGrupos(lista);
      setNomeApi(d?.operador?.nome ?? null);
      setInicial(s0);
      setSel(s0);
      setBusca('');
      // Pouca coisa: tudo aberto até a instalação. Muita: só o que já tem algo marcado.
      const plantas = lista.flatMap((g) => g.plantas);
      const unidades = plantas.flatMap((p) => p.unidades.map((u) => ({ p, u })));
      const abre = new Set<string>();
      for (const g of lista) {
        if (lista.length <= 3 || estadoPlantas(g.plantas, s0).estado !== 'nenhum') abre.add(`g:${g.proprietario.id}`);
      }
      for (const p of plantas) {
        if (plantas.length <= 4 || estadoPlantas([p], s0).estado !== 'nenhum') abre.add(`p:${p.id}`);
      }
      for (const { p, u } of unidades) {
        if (unidades.length <= 4 || estadoInstalacao(u, s0).estado !== 'nenhum') abre.add(`u:${chaveUnidade(p, u)}`);
      }
      setAbertos(abre);
    } catch (e) {
      if (meu !== pedido.current) return;
      setGrupos(null);
      setErro(mensagemDe(e, 'Não foi possível carregar as plantas.'));
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  }, [http, operadorId]);

  useEffect(() => {
    if (!isOpen || !operadorId) return;
    setGrupos(null);
    setSel(VAZIA);
    setInicial(VAZIA);
    carregar();
  }, [isOpen, operadorId, carregar]);

  // ---------------------------------------------------------------------------
  // Derivados
  // ---------------------------------------------------------------------------

  const lista = useMemo(() => grupos ?? [], [grupos]);
  const plantas = useMemo(() => lista.flatMap((g) => g.plantas), [lista]);
  const variosDonos = lista.length > 1;
  const chips = useMemo(() => chipsDe(plantas, sel), [plantas, sel]);
  const geral = useMemo(() => estadoPlantas(plantas, sel), [plantas, sel]);
  const resumo = useMemo(() => resumoDe(plantas, sel), [plantas, sel]);
  const revisao = useMemo(() => revisar(plantas, inicial, sel), [plantas, inicial, sel]);
  const gravacoes = useMemo(() => gravacoesDe(lista, inicial, sel), [lista, inicial, sel]);
  const sujo = revisao.mudou;
  const hoje = hojeSP();
  const validadeNoPassado = !!sel.validade && sel.validade < hoje;
  const buscando = !!busca.trim();

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  const protegido = (acao: () => void) => {
    if (sujo) setDescartar(() => acao);
    else acao();
  };
  const fechar = () => protegido(onClose);
  const irParaDados = () => onVerDados && protegido(onVerDados);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !revisando && !descartar) fechar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const alternarAberto = (chave: string) =>
    setAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });
  const aberto = (chave: string) => buscando || abertos.has(chave);

  const salvar = async () => {
    if (!operadorId || gravacoes.length === 0) return;
    setSalvando(true);
    const falhas: string[] = [];
    for (const g of gravacoes) {
      try {
        await http.put(`/usuarios/${operadorId}/vinculos`, g.payload);
      } catch (e) {
        falhas.push(`${g.grupo.proprietario.nome}: ${mensagemDe(e, 'erro')}`);
      }
    }
    setSalvando(false);
    setRevisando(false);
    if (falhas.length) {
      toast.error('Parte do acesso não foi salva', { description: falhas.join(' · ') });
    } else {
      toast.success(revisao.removeTudo ? 'Acesso removido' : 'Permissões salvas', {
        description: revisao.removeTudo ? `${nomeOperador} não vê mais nenhuma planta.` : `${nomeOperador} verá: ${resumo}`,
      });
    }
    await carregar();
  };

  if (!isOpen || !operador) return null;

  // ---------------------------------------------------------------------------
  // Render: Proprietário → Planta → Instalação → Equipamento
  // ---------------------------------------------------------------------------

  const linhaNo = (props: {
    chave: string;
    nivel: 0 | 1 | 2;
    estado: EstadoMarcacao;
    desabilitado?: boolean;
    onMarcar: () => void;
    Icone: LucideIcon;
    titulo: string;
    sub: string;
    rotulo: string;
    extra?: React.ReactNode;
  }) => {
    const aberta = aberto(props.chave);
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pr-3',
          props.nivel === 0 && 'pl-3 bg-muted/60',
          props.nivel === 1 && (variosDonos ? 'pl-7 bg-muted/30' : 'pl-3 bg-muted/40'),
          props.nivel === 2 && (variosDonos ? 'pl-11' : 'pl-7'),
        )}
      >
        <button
          type="button"
          onClick={() => alternarAberto(props.chave)}
          className="h-6 w-6 -ml-1 flex items-center justify-center rounded hover:bg-muted shrink-0"
          aria-label={aberta ? 'Recolher' : 'Expandir'}
          aria-expanded={aberta}
        >
          {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Checkbox
          checked={checkedDe(props.estado)}
          disabled={props.desabilitado}
          onCheckedChange={props.onMarcar}
          aria-label={props.rotulo}
        />
        <props.Icone className="h-4 w-4 text-muted-foreground shrink-0" />
        <button type="button" onClick={() => alternarAberto(props.chave)} className="flex-1 min-w-0 text-left">
          <div className={cn('text-sm truncate', props.nivel < 2 ? 'font-semibold' : 'font-medium')}>{props.titulo}</div>
          <div className="text-xs text-muted-foreground tabular-nums truncate">{props.sub}</div>
        </button>
        {props.extra}
      </div>
    );
  };

  const subDe = (st: { estado: EstadoMarcacao; marcados: number; total: number }, inteiro: string) =>
    st.estado === 'todos' ? `${inteiro} · ${st.total} equipamentos` : `${st.marcados} de ${st.total} equipamentos`;

  const renderUnidade = (p: PlantaArvore, u: UnidadeArvore) => {
    const chave = chaveUnidade(p, u);
    const original = p.unidades.find((x) => chaveUnidade(p, x) === chave) ?? u;
    const st = estadoInstalacao(original, sel);
    const geracaoOn = !!original.id && sel.geracao.includes(original.id);
    return (
      <li key={chave}>
        {linhaNo({
          chave: `u:${chave}`,
          nivel: 2,
          estado: st.estado,
          onMarcar: () => setSel((s) => alternarInstalacao(original, s)),
          Icone: iconeInstalacao(original),
          titulo: original.nome,
          sub: subDe(st, 'Instalação inteira'),
          rotulo: `Marcar tudo da instalação ${original.nome}`,
          extra:
            original.tem_usina && original.id && podeVerGeracao ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
                <span>Ver geração</span>
                <Switch
                  checked={geracaoOn}
                  onCheckedChange={(v) => setSel((s) => definirVerGeracao(original, v, s))}
                  aria-label={`Ver geração de ${original.nome}`}
                />
              </label>
            ) : undefined,
        })}
        {aberto(`u:${chave}`) && (
          <ul className="border-t">
            {u.equipamentos.map((e) => {
              const marcado = e.id in sel.equipamentos;
              const IconeEq = iconeEquipamento(e);
              return (
                <li
                  key={e.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-1.5 pr-3 py-2',
                    variosDonos ? 'pl-[4.75rem]' : 'pl-[3.75rem]',
                  )}
                >
                  <Checkbox
                    id={`acesso-${e.id}`}
                    checked={marcado}
                    onCheckedChange={() => setSel((s) => alternarEquipamento(original, e, s))}
                  />
                  <IconeEq className="h-4 w-4 text-muted-foreground shrink-0" />
                  <label htmlFor={`acesso-${e.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <span className="text-sm truncate block">{e.nome}</span>
                    {e.tipo_nome && <span className="text-xs text-muted-foreground truncate block">{e.tipo_nome}</span>}
                  </label>
                  {e.novo && (
                    <span className="text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Novo
                    </span>
                  )}
                  {e.aceita_ver_rs && marcado && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
                      <span>Ver R$</span>
                      <Switch
                        checked={!!sel.equipamentos[e.id]}
                        onCheckedChange={(v) => setSel((s) => definirVerRs(e, v, s))}
                        aria-label={`Ver valores em R$ de ${e.nome}`}
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  const renderPlanta = (p: PlantaArvore) => {
    const unidades = unidadesDaBusca(p, busca);
    if (unidades.length === 0) return null;
    const st = estadoPlantas([p], sel);
    return (
      <li key={p.id}>
        {linhaNo({
          chave: `p:${p.id}`,
          nivel: 1,
          estado: st.estado,
          desabilitado: st.total === 0,
          onMarcar: () => setSel((s) => alternarPlantas([p], s)),
          Icone: Factory,
          titulo: p.nome,
          sub: `${subDe(st, 'Planta inteira')} · ${p.unidades.length} ${p.unidades.length === 1 ? 'instalação' : 'instalações'}`,
          rotulo: `Marcar tudo da planta ${p.nome}`,
        })}
        {aberto(`p:${p.id}`) && <ul className="border-t divide-y">{unidades.map((u) => renderUnidade(p, u))}</ul>}
      </li>
    );
  };

  const nadaNaBusca = buscando && plantas.every((p) => unidadesDaBusca(p, busca).length === 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={fechar} />

      <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-end">
        <div
          role="dialog"
          aria-label={`Permissões de ${nomeOperador}`}
          className={cn(
            'bg-background shadow-2xl pointer-events-auto overflow-hidden flex flex-col',
            'w-full h-full md:w-[50vw] md:min-w-[600px] md:border-l md:border-border',
          )}
        >
          {/* Cabeçalho */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 md:px-6 py-3 md:py-4 shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <KeyRound className="hidden md:block h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-semibold truncate">Permissões de {nomeOperador}</h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {novo
                      ? 'Passo 2 de 2 · marque as plantas e equipamentos que ele vê e comanda'
                      : 'Marque a planta inteira ou abra e escolha instalações e equipamentos'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={fechar} className="h-8 w-8 shrink-0" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {onVerDados && <AbasUsuario ativa="acesso" onDados={irParaDados} />}
          </div>

          {/* Corpo */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 space-y-4">
              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md dark:bg-red-950 dark:border-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-300">{erro}</p>
                </div>
              )}

              {(carregando || (grupos === null && !erro)) && (
                <div className="text-sm text-muted-foreground flex items-center gap-2 py-6 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando plantas...
                </div>
              )}

              {grupos && !carregando && plantas.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma planta com equipamentos cadastrada.</p>
              )}

              {grupos && !carregando && plantas.length > 0 && (
                <>
                  {/* Tudo */}
                  <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2.5">
                    <Checkbox
                      id="acesso-tudo"
                      checked={checkedDe(geral.estado)}
                      onCheckedChange={() => setSel((s) => alternarPlantas(plantas, s))}
                    />
                    <label htmlFor="acesso-tudo" className="flex-1 min-w-0 cursor-pointer">
                      <span className="text-sm font-medium block">Dar acesso a tudo</span>
                      <span className="text-xs text-muted-foreground tabular-nums block">
                        {geral.marcados} de {geral.total} equipamentos · {plantas.length}{' '}
                        {plantas.length === 1 ? 'planta' : 'plantas'}
                        {variosDonos && ` · ${lista.length} proprietários`}
                      </span>
                    </label>
                    {geral.estado !== 'nenhum' && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSel((s) => limparPlantas(plantas, s))}>
                        Limpar
                      </Button>
                    )}
                  </section>

                  {/* Chips por tipo */}
                  {chips.length > 0 && (
                    <section className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">Marcar ou desmarcar por tipo, em todas as plantas</div>
                      <div className="flex flex-wrap gap-2">
                        {chips.map((c) => (
                          <button
                            key={c.chave}
                            type="button"
                            aria-pressed={c.estado === 'todos'}
                            onClick={() => setSel((s) => alternarCategoria(plantas, s, c.chave))}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 h-8 text-sm transition-colors',
                              c.estado === 'todos' && 'bg-foreground text-background border-foreground',
                              c.estado === 'alguns' && 'border-foreground',
                              c.estado === 'nenhum' && 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {c.estado === 'alguns' && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                            {c.rotulo}
                            <span className="tabular-nums opacity-70">{c.total}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Busca */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.preventDefault();
                      }}
                      placeholder="Buscar planta, instalação ou equipamento"
                      className="pl-9"
                    />
                  </div>

                  {/* Árvore */}
                  <ul className="border rounded-md divide-y overflow-hidden">
                    {variosDonos
                      ? lista.map((g) => {
                          const visiveis = g.plantas.filter((p) => unidadesDaBusca(p, busca).length > 0);
                          if (visiveis.length === 0) return null;
                          const st = estadoPlantas(g.plantas, sel);
                          const chave = `g:${g.proprietario.id}`;
                          return (
                            <li key={g.proprietario.id}>
                              {linhaNo({
                                chave,
                                nivel: 0,
                                estado: st.estado,
                                onMarcar: () => setSel((s) => alternarPlantas(g.plantas, s)),
                                Icone: UserRound,
                                titulo: g.proprietario.nome || 'Proprietário',
                                sub: `${subDe(st, 'Tudo deste proprietário')} · ${g.plantas.length} ${g.plantas.length === 1 ? 'planta' : 'plantas'}`,
                                rotulo: `Marcar tudo de ${g.proprietario.nome}`,
                              })}
                              {aberto(chave) && <ul className="border-t divide-y">{visiveis.map(renderPlanta)}</ul>}
                            </li>
                          );
                        })
                      : plantas.map(renderPlanta)}
                  </ul>
                  {nadaNaBusca && <p className="text-sm text-muted-foreground text-center py-4">Nada encontrado para "{busca}".</p>}

                  {/* Validade */}
                  <section className="space-y-1.5">
                    <label htmlFor="acesso-validade" className="text-sm font-medium flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Validade (opcional)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="acesso-validade"
                        type="date"
                        min={hoje}
                        value={sel.validade ?? ''}
                        onChange={(e) => setSel((s) => ({ ...s, validade: e.target.value || null }))}
                        className="max-w-[220px]"
                      />
                      {sel.validade && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSel((s) => ({ ...s, validade: null }))}>
                          Sem validade
                        </Button>
                      )}
                    </div>
                    <p className={cn('text-xs', validadeNoPassado ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                      {validadeNoPassado
                        ? 'A validade não pode estar no passado.'
                        : 'Depois dessa data o acesso deixa de valer sozinho. Em branco, vale até alguém tirar.'}
                    </p>
                  </section>
                </>
              )}
            </div>
          </div>

          {/* Rodapé fixo: resumo + Revisar */}
          {grupos && plantas.length > 0 && (
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 md:px-6 md:py-4 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <p className="text-sm flex-1 min-w-0">
                  <span className="font-medium">{nomeOperador}</span> verá:{' '}
                  <span className="text-muted-foreground">{resumo}</span>
                </p>
                <Button
                  type="button"
                  onClick={() => setRevisando(true)}
                  disabled={!sujo || gravacoes.length === 0 || validadeNoPassado || salvando}
                  className="w-full sm:w-auto"
                >
                  {sujo ? 'Revisar e salvar' : 'Sem alterações'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Revisão antes de gravar */}
      <Dialog open={revisando} onOpenChange={(v) => !salvando && setRevisando(v)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[85dvh] overflow-y-auto z-[60]">
          <DialogHeader>
            <DialogTitle>Revisar permissões</DialogTitle>
            <DialogDescription>
              {nomeOperador}
              {variosDonos && gravacoes.length > 0 && ` · ${gravacoes.map((g) => g.grupo.proprietario.nome).join(', ')}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {revisao.removeTudo && (
              <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                Nada marcado: {nomeOperador} perde o acesso a todas as plantas.
              </div>
            )}
            <ListaRevisao titulo="Entram" itens={revisao.entram} />
            <ListaRevisao titulo="Saem" itens={revisao.saem} />
            <ListaRevisao titulo="Ver R$ ligado" itens={revisao.verRsLigado} />
            <ListaRevisao titulo="Ver R$ desligado" itens={revisao.verRsDesligado} />
            <ListaRevisao titulo="Ver geração ligado" itens={revisao.geracaoLigada} />
            <ListaRevisao titulo="Ver geração desligado" itens={revisao.geracaoDesligada} />
            {revisao.validade && (
              <div>
                <div className="font-medium">Validade</div>
                <div className="text-muted-foreground">
                  {revisao.validade.de ? dataBr(revisao.validade.de) : 'sem validade'} →{' '}
                  {revisao.validade.para ? dataBr(revisao.validade.para) : 'sem validade'}
                </div>
              </div>
            )}
            {!revisao.removeTudo && (
              <div className="pt-2 border-t">
                <span className="font-medium">{nomeOperador}</span> verá: {resumo}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRevisando(false)} disabled={salvando}>
              Voltar
            </Button>
            <Button type="button" onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Descartar alterações */}
      <AlertDialog open={!!descartar} onOpenChange={(v) => !v && setDescartar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>As permissões que você marcou ainda não foram salvas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const acao = descartar;
                setDescartar(null);
                acao?.();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ListaRevisao({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  const mostra = itens.slice(0, 30);
  return (
    <div>
      <div className="font-medium">
        {titulo} <span className="text-muted-foreground tabular-nums">({itens.length})</span>
      </div>
      <ul className="mt-1 text-muted-foreground list-disc pl-5 space-y-0.5">
        {mostra.map((n, i) => (
          <li key={`${n}-${i}`}>{n}</li>
        ))}
      </ul>
      {itens.length > mostra.length && (
        <div className="text-xs text-muted-foreground mt-1">e mais {itens.length - mostra.length}</div>
      )}
    </div>
  );
}

/** Abas "Dados | Acesso" do usuário operador (o cadastro e o acesso são telas irmãs). */
export function AbasUsuario({
  ativa,
  onDados,
  onAcesso,
}: {
  ativa: 'dados' | 'acesso';
  onDados?: () => void;
  onAcesso?: () => void;
}) {
  const aba = (chave: 'dados' | 'acesso', rotulo: string, onClick?: () => void) => (
    <button
      type="button"
      onClick={ativa === chave ? undefined : onClick}
      aria-pressed={ativa === chave}
      className={cn(
        'px-3 py-1 text-sm font-medium rounded-[2px] transition-colors',
        ativa === chave ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {rotulo}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-[4px] border p-0.5">
      {aba('dados', 'Dados', onDados)}
      {aba('acesso', 'Plantas e equipamentos', onAcesso)}
    </div>
  );
}
