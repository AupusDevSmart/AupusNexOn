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
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { Button } from '@/core/components/ui/button';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Switch } from '@/core/components/ui/switch';
import { Input } from '@/core/components/ui/input';
import { Combobox } from '@/core/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
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
import { useHttpClient, useProprietariosForPlantas, useUserStore } from '@/core/context/hooks';
import {
  type ArvoreAcesso,
  type EquipamentoArvore,
  type EstadoMarcacao,
  type PlantaArvore,
  type Selecao,
  type UnidadeArvore,
  alternarCategoria,
  alternarEquipamento,
  alternarInstalacao,
  categoriaDe,
  chipsDe,
  dataBr,
  definirVerGeracao,
  definirVerRs,
  estadoInstalacao,
  filtrarUnidades,
  payloadDe,
  resumoDe,
  revisar,
  selecaoInicial,
} from './selecao';

export interface OperadorBasico {
  id: string;
  nome: string;
  email?: string;
}

interface VinculoResumo {
  id: string;
  proprietario: { id: string; nome: string };
  validade: string | null;
  vencido: boolean;
  resumo: string;
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
  const { user, capacidades } = useUserStore();
  const ehGlobal = !!capacidades?.global;
  const podeVerGeracao = !!capacidades?.liberarVerGeracao;
  const { proprietarios, loading: carregandoProps } = useProprietariosForPlantas();

  const [vinculos, setVinculos] = useState<VinculoResumo[] | null>(null);
  const [proprietarioId, setProprietarioId] = useState<string | null>(null);
  const [arvore, setArvore] = useState<ArvoreAcesso | null>(null);
  const [carregandoArvore, setCarregandoArvore] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [inicial, setInicial] = useState<Selecao>(VAZIA);
  const [sel, setSel] = useState<Selecao>(VAZIA);
  const [plantaId, setPlantaId] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [revisando, setRevisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [descartar, setDescartar] = useState<(() => void) | null>(null);
  const pedidoArvore = useRef(0);

  const operadorId = operador?.id?.trim() ?? '';
  const nomeOperador = arvore?.operador?.nome ?? operador?.nome ?? 'O operador';

  // ---------------------------------------------------------------------------
  // Carga
  // ---------------------------------------------------------------------------

  const carregarVinculos = useCallback(async () => {
    if (!operadorId) return [] as VinculoResumo[];
    try {
      const d = dadosDe(await http.get(`/usuarios/${operadorId}/vinculos`));
      const lista: VinculoResumo[] = Array.isArray(d?.vinculos) ? d.vinculos : [];
      setVinculos(lista);
      return lista;
    } catch (e) {
      setVinculos([]);
      setErro(mensagemDe(e, 'Não foi possível carregar os vínculos do operador.'));
      return [] as VinculoResumo[];
    }
  }, [http, operadorId]);

  const carregarArvore = useCallback(
    async (propId: string) => {
      if (!operadorId || !propId) return;
      const meu = ++pedidoArvore.current;
      setCarregandoArvore(true);
      setErro(null);
      try {
        const d = dadosDe(
          await http.get(`/usuarios/${operadorId}/vinculos/arvore`, {
            params: ehGlobal ? { proprietarioId: propId } : undefined,
          }),
        ) as ArvoreAcesso | null;
        if (meu !== pedidoArvore.current) return;
        const plantas = Array.isArray(d?.plantas) ? d!.plantas : [];
        const arv: ArvoreAcesso = {
          operador: d?.operador ?? { id: operadorId, nome: operador?.nome ?? '' },
          proprietario: d?.proprietario ?? { id: propId, nome: '' },
          vinculo: d?.vinculo ?? null,
          plantas,
        };
        const s0 = selecaoInicial(arv);
        setArvore(arv);
        setInicial(s0);
        setSel(s0);
        setPlantaId(plantas.length > 1 ? plantas[0].id : 'todas');
        setBusca('');
        // Poucas instalações: tudo aberto. Muitas: só as que já têm algo marcado.
        const todas = plantas.flatMap((p) => p.unidades.map((u) => ({ p, u })));
        setAbertas(
          new Set(
            todas
              .filter(({ u }) => todas.length <= 4 || estadoInstalacao(u, s0).estado !== 'nenhum')
              .map(({ p, u }) => chaveUnidade(p, u)),
          ),
        );
      } catch (e) {
        if (meu !== pedidoArvore.current) return;
        setArvore(null);
        setErro(mensagemDe(e, 'Não foi possível carregar as plantas deste proprietário.'));
      } finally {
        if (meu === pedidoArvore.current) setCarregandoArvore(false);
      }
    },
    [http, operadorId, ehGlobal, operador?.nome],
  );

  // Ao abrir: vínculos do operador; o proprietário inicial é o próprio (papel
  // proprietário) ou o do primeiro vínculo.
  useEffect(() => {
    if (!isOpen || !operadorId) return;
    setArvore(null);
    setVinculos(null);
    setErro(null);
    setSel(VAZIA);
    setInicial(VAZIA);
    let vivo = true;
    carregarVinculos().then((lista) => {
      if (!vivo) return;
      const proprio = (user?.id ?? '').trim();
      const inicialId = ehGlobal ? lista[0]?.proprietario?.id?.trim() ?? null : proprio || null;
      setProprietarioId(inicialId);
    });
    return () => {
      vivo = false;
    };
  }, [isOpen, operadorId, ehGlobal, user?.id, carregarVinculos]);

  useEffect(() => {
    if (isOpen && proprietarioId) carregarArvore(proprietarioId);
  }, [isOpen, proprietarioId, carregarArvore]);

  // ---------------------------------------------------------------------------
  // Derivados
  // ---------------------------------------------------------------------------

  const plantas = useMemo(() => arvore?.plantas ?? [], [arvore]);
  const plantasVisiveis = useMemo(
    () => (plantaId === 'todas' ? plantas : plantas.filter((p) => p.id === plantaId)),
    [plantas, plantaId],
  );
  const chips = useMemo(() => chipsDe(plantasVisiveis, sel), [plantasVisiveis, sel]);
  const resumo = useMemo(() => resumoDe(plantas, sel), [plantas, sel]);
  const revisao = useMemo(() => revisar(plantas, inicial, sel), [plantas, inicial, sel]);
  const sujo = revisao.mudou;
  const hoje = hojeSP();
  const validadeNoPassado = !!sel.validade && sel.validade < hoje;

  const opcoesProprietarios = useMemo(() => {
    const vistos = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const v of vinculos ?? []) {
      const id = v.proprietario.id.trim();
      if (!vistos.has(id)) {
        vistos.add(id);
        out.push({ value: id, label: v.proprietario.nome });
      }
    }
    for (const p of (proprietarios ?? []) as Array<{ id: string; nome: string }>) {
      const id = String(p.id).trim();
      if (!vistos.has(id)) {
        vistos.add(id);
        out.push({ value: id, label: p.nome });
      }
    }
    return out;
  }, [vinculos, proprietarios]);

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  /** Troca de proprietário / fechar com alteração não salva pede confirmação. */
  const protegido = (acao: () => void) => {
    if (sujo) setDescartar(() => acao);
    else acao();
  };

  const trocarProprietario = (id: string | null) => {
    const alvo = id?.trim() || null;
    if (alvo === proprietarioId) return;
    protegido(() => {
      setArvore(null);
      setSel(VAZIA);
      setInicial(VAZIA);
      setProprietarioId(alvo);
    });
  };

  const fechar = () => protegido(onClose);
  const irParaDados = () => onVerDados && protegido(onVerDados);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !revisando && !confirmarRemocao && !descartar) fechar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const alternarAberta = (chave: string) =>
    setAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });

  const salvar = async () => {
    const propId = proprietarioId ?? arvore?.proprietario?.id;
    if (!operadorId || !propId) return;
    setSalvando(true);
    try {
      const d = dadosDe(await http.put(`/usuarios/${operadorId}/vinculos`, payloadDe(propId, sel)));
      if (Array.isArray(d?.vinculos)) setVinculos(d.vinculos);
      toast.success(revisao.removeTudo ? 'Acesso removido' : 'Acesso salvo', {
        description: revisao.removeTudo
          ? `${nomeOperador} não vê mais as plantas de ${arvore?.proprietario?.nome ?? 'este proprietário'}.`
          : `${nomeOperador} verá: ${resumo}`,
      });
      setRevisando(false);
      await carregarArvore(propId);
    } catch (e) {
      toast.error('Não foi possível salvar o acesso', { description: mensagemDe(e, 'Tente de novo.') });
    } finally {
      setSalvando(false);
    }
  };

  const removerVinculo = async () => {
    const propId = proprietarioId ?? arvore?.proprietario?.id;
    if (!operadorId || !propId) return;
    setSalvando(true);
    try {
      await http.delete(`/usuarios/${operadorId}/vinculos/${propId}`);
      toast.success('Acesso removido', {
        description: `${nomeOperador} não vê mais as plantas de ${arvore?.proprietario?.nome ?? 'este proprietário'}.`,
      });
      setConfirmarRemocao(false);
      await carregarVinculos();
      await carregarArvore(propId);
    } catch (e) {
      toast.error('Não foi possível remover o acesso', { description: mensagemDe(e, 'Tente de novo.') });
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen || !operador) return null;

  const temVinculoSalvo = !!arvore?.vinculo;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={fechar} />

      <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-end">
        <div
          role="dialog"
          aria-label={`Acesso de ${nomeOperador}`}
          className={cn(
            'bg-background shadow-2xl pointer-events-auto overflow-hidden flex flex-col',
            'w-full h-full md:w-[50vw] md:min-w-[560px] md:border-l md:border-border',
          )}
        >
          {/* Cabeçalho */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 md:px-6 py-3 md:py-4 shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <KeyRound className="hidden md:block h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-semibold truncate">Acesso de {nomeOperador}</h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {novo ? 'Passo 2 de 2 · escolha o que o operador vê e comanda' : operador.email || 'Operador'}
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
            <div className="p-4 md:p-6 space-y-5">
              {/* Vínculos existentes */}
              {vinculos && vinculos.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Vínculos de {nomeOperador}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {vinculos.map((v) => {
                      const ativo = v.proprietario.id.trim() === proprietarioId;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={!ehGlobal}
                          onClick={() => trocarProprietario(v.proprietario.id)}
                          className={cn(
                            'text-left rounded-md border px-3 py-2 text-xs transition-colors max-w-full',
                            ativo ? 'border-foreground bg-muted' : 'hover:bg-muted/60',
                            !ehGlobal && 'cursor-default',
                          )}
                        >
                          <div className="font-medium text-sm truncate">{v.proprietario.nome}</div>
                          <div className="text-muted-foreground truncate">{v.resumo}</div>
                          {(v.validade || v.vencido) && (
                            <div className={cn('mt-0.5', v.vencido ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                              {v.vencido ? `Vencido em ${dataBr(v.validade)}` : `Até ${dataBr(v.validade)}`}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Proprietário (só papéis globais; o proprietário é ele mesmo) */}
              {ehGlobal && (
                <section className="space-y-1.5">
                  <label className="text-sm font-medium">Proprietário</label>
                  <Combobox
                    options={opcoesProprietarios}
                    value={proprietarioId ?? undefined}
                    onValueChange={(v) => trocarProprietario(v || null)}
                    placeholder={carregandoProps ? 'Carregando proprietários...' : 'Escolha o proprietário'}
                    searchPlaceholder="Buscar proprietário..."
                    emptyText="Nenhum proprietário encontrado."
                    disabled={carregandoProps && opcoesProprietarios.length === 0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Um vínculo por proprietário. O operador pode atender mais de um.
                  </p>
                </section>
              )}

              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md dark:bg-red-950 dark:border-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-300">{erro}</p>
                </div>
              )}

              {!proprietarioId && vinculos !== null && !erro && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Escolha o proprietário para ver as plantas dele.
                </p>
              )}

              {(carregandoArvore || (vinculos === null && !erro)) && (
                <div className="text-sm text-muted-foreground flex items-center gap-2 py-6 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              )}

              {arvore && !carregandoArvore && plantas.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {arvore.proprietario.nome || 'Este proprietário'} ainda não tem plantas com equipamentos.
                </p>
              )}

              {arvore && !carregandoArvore && plantas.length > 0 && (
                <>
                  {/* Planta */}
                  {plantas.length > 1 && (
                    <section className="space-y-1.5">
                      <label className="text-sm font-medium">Planta</label>
                      <Select value={plantaId} onValueChange={setPlantaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha a planta" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas as plantas ({plantas.length})</SelectItem>
                          {plantas.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </section>
                  )}

                  {/* Chips por tipo */}
                  {chips.length > 0 && (
                    <section className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">Toque para marcar ou desmarcar todos do tipo</div>
                      <div className="flex flex-wrap gap-2">
                        {chips.map((c) => (
                          <button
                            key={c.chave}
                            type="button"
                            aria-pressed={c.estado === 'todos'}
                            onClick={() => setSel((s) => alternarCategoria(plantasVisiveis, s, c.chave))}
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
                      placeholder="Buscar instalação ou equipamento"
                      className="pl-9"
                    />
                  </div>

                  {/* Árvore instalação → equipamentos */}
                  <section className="space-y-4">
                    {plantasVisiveis.map((p) => {
                      const unidades = filtrarUnidades(p.unidades, busca);
                      if (unidades.length === 0) return null;
                      return (
                        <div key={p.id} className="space-y-2">
                          {plantaId === 'todas' && plantas.length > 1 && (
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.nome}</h4>
                          )}
                          <ul className="border rounded-md divide-y">
                            {unidades.map((u) => {
                              const chave = chaveUnidade(p, u);
                              // Contagem e tri-state sempre pela instalação inteira, não pelo filtro.
                              const original = p.unidades.find((x) => chaveUnidade(p, x) === chave) ?? u;
                              const st = estadoInstalacao(original, sel);
                              const aberta = !!busca.trim() || abertas.has(chave);
                              const Icone = iconeInstalacao(original);
                              const geracaoOn = !!original.id && sel.geracao.includes(original.id);
                              return (
                                <li key={chave}>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                                    <button
                                      type="button"
                                      onClick={() => alternarAberta(chave)}
                                      className="h-6 w-6 -ml-1 flex items-center justify-center rounded hover:bg-muted shrink-0"
                                      aria-label={aberta ? 'Recolher' : 'Expandir'}
                                      aria-expanded={aberta}
                                    >
                                      {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </button>
                                    <Checkbox
                                      checked={checkedDe(st.estado)}
                                      onCheckedChange={() => setSel((s) => alternarInstalacao(original, s))}
                                      aria-label={`Marcar ${original.nome}`}
                                    />
                                    <Icone className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <button
                                      type="button"
                                      onClick={() => alternarAberta(chave)}
                                      className="flex-1 min-w-0 text-left"
                                    >
                                      <div className="text-sm font-medium truncate">{original.nome}</div>
                                      <div className="text-xs text-muted-foreground tabular-nums">
                                        {st.marcados} de {st.total}
                                      </div>
                                    </button>
                                    {original.tem_usina && original.id && podeVerGeracao && (
                                      <label className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
                                        <span>Ver geração</span>
                                        <Switch
                                          checked={geracaoOn}
                                          onCheckedChange={(v) => setSel((s) => definirVerGeracao(original, v, s))}
                                          aria-label={`Ver geração de ${original.nome}`}
                                        />
                                      </label>
                                    )}
                                  </div>
                                  {aberta && (
                                    <ul className="border-t bg-muted/20">
                                      {u.equipamentos.map((e) => {
                                        const marcado = e.id in sel.equipamentos;
                                        const IconeEq = iconeEquipamento(e);
                                        return (
                                          <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-12 pr-3 py-2">
                                            <Checkbox
                                              id={`acesso-${e.id}`}
                                              checked={marcado}
                                              onCheckedChange={() => setSel((s) => alternarEquipamento(original, e, s))}
                                            />
                                            <IconeEq className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <label htmlFor={`acesso-${e.id}`} className="flex-1 min-w-0 cursor-pointer">
                                              <span className="text-sm truncate block">{e.nome}</span>
                                              {e.tipo_nome && (
                                                <span className="text-xs text-muted-foreground truncate block">{e.tipo_nome}</span>
                                              )}
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
                            })}
                          </ul>
                        </div>
                      );
                    })}
                    {busca.trim() && plantasVisiveis.every((p) => filtrarUnidades(p.unidades, busca).length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nada encontrado para "{busca}".</p>
                    )}
                  </section>

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

                  {temVinculoSalvo && (
                    <div className="pt-2 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmarRemocao(true)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover acesso deste proprietário
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Rodapé fixo: resumo + Revisar */}
          {arvore && plantas.length > 0 && (
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 md:px-6 md:py-4 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <p className="text-sm flex-1 min-w-0">
                  <span className="font-medium">{nomeOperador}</span> verá:{' '}
                  <span className="text-muted-foreground">{resumo}</span>
                </p>
                <Button
                  type="button"
                  onClick={() => setRevisando(true)}
                  disabled={!sujo || validadeNoPassado || salvando}
                  className="w-full sm:w-auto"
                >
                  {sujo ? 'Revisar' : 'Sem alterações'}
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
            <DialogTitle>Revisar acesso</DialogTitle>
            <DialogDescription>
              {nomeOperador} · {arvore?.proprietario?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {revisao.removeTudo && (
              <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                Nada marcado: {nomeOperador} perde o acesso às plantas de {arvore?.proprietario?.nome ?? 'este proprietário'}.
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

      {/* Remover vínculo */}
      <AlertDialog open={confirmarRemocao} onOpenChange={(v) => !salvando && setConfirmarRemocao(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso</AlertDialogTitle>
            <AlertDialogDescription>
              {nomeOperador} deixa de ver e comandar os equipamentos de{' '}
              <span className="font-semibold">{arvore?.proprietario?.nome}</span>. Os vínculos com outros proprietários continuam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                removerVinculo();
              }}
              disabled={salvando}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {salvando ? 'Removendo...' : 'Remover acesso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Descartar alterações */}
      <AlertDialog open={!!descartar} onOpenChange={(v) => !v && setDescartar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>O acesso que você marcou ainda não foi salvo.</AlertDialogDescription>
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
      {aba('acesso', 'Acesso', onAcesso)}
    </div>
  );
}
