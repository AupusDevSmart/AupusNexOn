import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Fuel, Trash2, Plus, Send, RefreshCw, Nfc, KeyRound, ShieldCheck, Power, Droplets,
  OctagonAlert, Hand, CheckCircle2, AlertTriangle, XCircle, RotateCcw, Pencil, X, WifiOff, Info, Keyboard,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const unwrap = (r: any) => r?.data?.data ?? r?.data;
const erroMsg = (e: any, padrao: string) => e?.response?.data?.message || e?.response?.data?.error?.message || padrao;

interface Bomba { id: string; nome: string; unidade_nome?: string }

// ---------------------------------------------------------------------------
// Vocabulário: estados da TON (lib bomba_posto) e motivos → texto para o operador
// ---------------------------------------------------------------------------
type Tom = 'neutro' | 'info' | 'ok' | 'alerta' | 'critico';
const TOM: Record<Tom, { painel: string; icone: string; texto: string; ponto: string }> = {
  neutro: { painel: 'bg-muted/50 border-border', icone: 'bg-muted text-muted-foreground', texto: 'text-foreground', ponto: 'bg-slate-400' },
  info: { painel: 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900', icone: 'bg-sky-600 text-white', texto: 'text-sky-900 dark:text-sky-100', ponto: 'bg-sky-500' },
  ok: { painel: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900', icone: 'bg-emerald-600 text-white', texto: 'text-emerald-900 dark:text-emerald-100', ponto: 'bg-emerald-500' },
  alerta: { painel: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900', icone: 'bg-amber-500 text-white', texto: 'text-amber-900 dark:text-amber-100', ponto: 'bg-amber-500' },
  critico: { painel: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900', icone: 'bg-red-600 text-white', texto: 'text-red-900 dark:text-red-100', ponto: 'bg-red-500' },
};

const ESTADOS: Record<string, { titulo: string; tom: Tom; Icone: any }> = {
  ociosa: { titulo: 'Pronta para abastecer', tom: 'neutro', Icone: Nfc },
  aguardando_matricula: { titulo: 'Digite a matrícula', tom: 'info', Icone: Keyboard },
  validando: { titulo: 'Validando autorização', tom: 'info', Icone: ShieldCheck },
  partindo: { titulo: 'Ligando a bomba', tom: 'alerta', Icone: Power },
  abastecendo: { titulo: 'Abastecendo', tom: 'ok', Icone: Droplets },
  encerrando: { titulo: 'Encerrando', tom: 'alerta', Icone: Power },
  bloqueada: { titulo: 'Bomba bloqueada', tom: 'critico', Icone: OctagonAlert },
  manual: { titulo: 'Chave em manual', tom: 'alerta', Icone: Hand },
  // firmware antigo
  bombeando: { titulo: 'Abastecendo', tom: 'ok', Icone: Droplets },
  idle: { titulo: 'Pronta para abastecer', tom: 'neutro', Icone: Nfc },
};

const MOTIVOS: Record<string, string> = {
  concluido: 'Concluído (bico devolvido)', fluxo_parado: 'Fluxo parado', emergencia: 'Emergência acionada', timeout: 'Tempo máximo atingido',
  limite: 'Limite de litros atingido', nivel_baixo: 'Nível do tanque baixo', manual: 'Chave em manual', contator_colado: 'Contatora colada',
  contator_caiu: 'Contatora desligou durante o abastecimento', queda_energia: 'Queda de energia', rejeitado: 'Rejeitado',
  tag: 'Tag não cadastrada', matricula: 'Matrícula não cadastrada', par: 'Operador não autorizado para esta máquina',
  timeout_matricula: 'Matrícula não digitada a tempo', bloqueada: 'Bomba estava bloqueada', ocupado: 'Bomba ocupada',
  inicializando: 'TON iniciando', limite_diario: 'Limite diário da máquina atingido', sem_confirmacao_bi1: 'Contatora não confirmou a partida',
  contator_fechou_sem_comando: 'Contatora fechou sem comando', chave: 'Chave em manual', negado: 'Negado', falha_partida: 'Falha na partida',
};
const motivo = (m?: string) => (m ? (MOTIVOS[m] ?? m.replace(/_/g, ' ')) : '—');

/** O que o operador deve fazer ao ver a bomba bloqueada, por motivo. */
const ORIENTACAO_BLOQUEIO: Record<string, string> = {
  falha_partida: 'A bomba foi ligada, mas a contatora não confirmou em 1 s. Confira a contatora e o fio de retorno antes de rearmar.',
  contator_colado: 'A contatora continuou fechada depois do desligamento. Desligue a alimentação e verifique a contatora antes de rearmar. A TON só aceita o rearme com ela aberta.',
};

const EVENTOS: Record<string, { titulo: string; tom: Tom }> = {
  negado: { titulo: 'Negado', tom: 'alerta' },
  falha_partida: { titulo: 'Falha na partida', tom: 'critico' },
  contator_colado: { titulo: 'Contatora colada', tom: 'critico' },
  nao_autorizado: { titulo: 'Bomba ligou sem autorização', tom: 'critico' },
  manual: { titulo: 'Chave em manual', tom: 'info' },
  rearme: { titulo: 'Rearmada', tom: 'ok' },
  rearme_negado: { titulo: 'Rearme recusado', tom: 'alerta' },
};

/** Passos de uma sessão normal, para o indicador de progresso. */
const PASSOS = [
  { chave: 'tag', rotulo: 'Tag' },
  { chave: 'aguardando_matricula', rotulo: 'Matrícula' },
  { chave: 'validando', rotulo: 'Validação' },
  { chave: 'partindo', rotulo: 'Partida' },
  { chave: 'abastecendo', rotulo: 'Abastecendo' },
];
const indicePasso = (estado: string) =>
  estado === 'aguardando_matricula' ? 1 : estado === 'validando' ? 2 : estado === 'partindo' ? 3 : estado === 'abastecendo' || estado === 'bombeando' ? 4 : -1;

const haQuanto = (seg: number) => (seg < 60 ? `há ${Math.round(seg)} s` : seg < 3600 ? `há ${Math.round(seg / 60)} min` : seg < 86400 ? `há ${Math.round(seg / 3600)} h` : `há ${Math.round(seg / 86400)} d`);
const LIMITE_SEM_SINAL_S = 120;   // a TON publica a cada 30 s e a cada mudança de estado
const CAPTURA_MAX_MS = 60000;

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------
function Sinal({ rotulo, valor, tomSim = 'ok', tomNao = 'neutro', textoSim = 'sim', textoNao = 'não' }:
  { rotulo: string; valor: any; tomSim?: Tom; tomNao?: Tom; textoSim?: string; textoNao?: string }) {
  const sim = valor === 1 || valor === true;
  const nao = valor === 0 || valor === false;
  const tom: Tom = sim ? tomSim : nao ? tomNao : 'neutro';
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <span className={cn('h-2 w-2 rounded-full', TOM[tom].ponto)} />
        {sim ? textoSim : nao ? textoNao : '—'}
      </span>
    </div>
  );
}

function Chip({ children, tom = 'neutro', className }: { children: any; tom?: Tom; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', TOM[tom].painel, TOM[tom].texto, className)}>
      {children}
    </span>
  );
}

function Vazio({ children }: { children: any }) {
  return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
type FormTag = { id?: string; uid: string; maquina_nome: string; mats: string[]; limite: string };
const FORM_VAZIO: FormTag = { uid: '', maquina_nome: '', mats: [], limite: '' };

export function BombaModal({ bomba, open, onOpenChange }: { bomba: Bomba | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [estado, setEstado] = useState<any>(null);
  const [rfids, setRfids] = useState<any[]>([]);
  const [ops, setOps] = useState<any[]>([]);
  const [atualizando, setAtualizando] = useState(false);
  const [aba, setAba] = useState('operacao');
  const [agora, setAgora] = useState(Date.now());

  // cadastro de tag: 'fechado' → 'lendo' (aguarda a tag no leitor) → 'form'
  const [etapa, setEtapa] = useState<'fechado' | 'lendo' | 'form'>('fechado');
  const [form, setForm] = useState<FormTag>(FORM_VAZIO);
  const [outraMat, setOutraMat] = useState('');
  const [salvando, setSalvando] = useState(false);
  const capturaRef = useRef<{ desde: number; refLida: number | null; refUid: string } | null>(null);
  const [confirmaDel, setConfirmaDel] = useState<string | null>(null);

  const [novoOp, setNovoOp] = useState({ matricula: '', nome: '' });
  const [rearmando, setRearmando] = useState(false);

  const id = bomba?.id;

  const carregar = useCallback(async (manual = false) => {
    if (!id) return;
    if (manual) setAtualizando(true);
    try {
      const [e, r, o] = await Promise.all([
        api.get(`/bomba-combustivel/${id}/estado`),
        api.get(`/bomba-combustivel/rfid?bombaId=${encodeURIComponent(id)}`),
        api.get(`/bomba-combustivel/operadores?bombaId=${encodeURIComponent(id)}`).catch(() => ({ data: { data: [] } })),
      ]);
      setEstado(unwrap(e)); setRfids(unwrap(r) ?? []); setOps(unwrap(o) ?? []);
    } catch { /* mantém o último estado */ } finally { if (manual) setAtualizando(false); }
  }, [id]);

  useEffect(() => { if (open) carregar(true); }, [open, carregar]);
  useEffect(() => {
    if (!open) { setEtapa('fechado'); setForm(FORM_VAZIO); capturaRef.current = null; setConfirmaDel(null); }
  }, [open]);
  // acompanha a telemetria; enquanto espera a tag no leitor, mais rápido
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => carregar(), etapa === 'lendo' ? 2000 : 10000);
    return () => clearInterval(t);
  }, [open, carregar, etapa]);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // ---- telemetria derivada ----
  const tel = estado?.telemetria ?? null;
  const est = String(estado?.estado || '').toLowerCase();
  const idadeS = estado?.ultima_leitura ? Math.max(0, (agora - new Date(estado.ultima_leitura).getTime()) / 1000) : null;
  const conectada = !!tel && tel.online !== 0 && idadeS != null && idadeS < LIMITE_SEM_SINAL_S;
  const temLeitor = tel?.leitor === 'wiegand';
  const ultimaTag: string = temLeitor && typeof tel?.ultima_tag === 'string' ? tel.ultima_tag.toUpperCase() : '';
  // instante da última leitura no relógio do servidor (recebido − idade informada pela TON)
  const tagLidaEm = useMemo(() => {
    const s = Number(tel?.ultima_tag_s);
    if (!ultimaTag || !Number.isFinite(s) || s < 0 || !estado?.ultima_leitura) return null;
    return new Date(estado.ultima_leitura).getTime() - s * 1000;
  }, [ultimaTag, tel?.ultima_tag_s, estado?.ultima_leitura]);
  const tagLidaHa = tagLidaEm != null ? haQuanto(Math.max(0, (agora - tagLidaEm) / 1000)) : null;

  const porUid = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of rfids) m.set(String(r.uid ?? '').toUpperCase(), r);
    return m;
  }, [rfids]);
  const nomeOp = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of ops) m.set(String(o.matricula), o.nome || '');
    return m;
  }, [ops]);
  const desatualizada = estado?.lista_versao_ton != null && estado?.lista_versao_nexon != null && Number(estado.lista_versao_ton) !== Number(estado.lista_versao_nexon);
  const nivel = estado?.nivel_pct != null && Number(estado.nivel_pct) >= 0 ? Number(estado.nivel_pct) : null;

  // ---- captura da tag: nova leitura depois de "Cadastrar tag" ----
  useEffect(() => {
    const c = capturaRef.current;
    if (etapa !== 'lendo' || !c) return;
    if (Date.now() - c.desde > CAPTURA_MAX_MS) {
      capturaRef.current = null; setEtapa('fechado');
      toast.message('Nenhuma tag lida em 60 s. Tente de novo.');
      return;
    }
    if (!ultimaTag || tagLidaEm == null) return;
    // nova leitura = outra tag, ou a mesma lida de novo (>= 2 s depois da referência; a idade vem em segundos)
    const nova = c.refLida == null || ultimaTag !== c.refUid || tagLidaEm > c.refLida + 2000;
    if (!nova) return;
    capturaRef.current = null;
    const existente = porUid.get(ultimaTag);
    if (existente) {
      abrirEdicao(existente);
      toast.message(`Esta tag já é da máquina "${existente.maquina_nome || existente.uid}". Você pode editar abaixo.`);
    } else {
      setForm({ ...FORM_VAZIO, uid: ultimaTag });
      setEtapa('form');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, ultimaTag, tagLidaEm, agora]);

  const iniciarLeitura = () => {
    capturaRef.current = { desde: Date.now(), refLida: tagLidaEm, refUid: ultimaTag };
    setForm(FORM_VAZIO); setEtapa('lendo'); setAba('maquinas');
  };
  const digitarUid = () => { capturaRef.current = null; setForm(FORM_VAZIO); setEtapa('form'); setAba('maquinas'); };
  const usarUltima = () => {
    const existente = porUid.get(ultimaTag);
    if (existente) { abrirEdicao(existente); return; }
    capturaRef.current = null; setForm({ ...FORM_VAZIO, uid: ultimaTag }); setEtapa('form'); setAba('maquinas');
  };
  function abrirEdicao(r: any) {
    capturaRef.current = null;
    setForm({
      id: r.id, uid: String(r.uid ?? '').toUpperCase(), maquina_nome: r.maquina_nome ?? '',
      mats: Array.isArray(r.matriculas) ? r.matriculas.map(String) : [],
      limite: r.limite_litros_dia ? String(Number(r.limite_litros_dia)) : '',
    });
    setEtapa('form'); setAba('maquinas');
  }
  const fecharCadastro = () => { capturaRef.current = null; setEtapa('fechado'); setForm(FORM_VAZIO); setOutraMat(''); };

  const alternarMat = (m: string) => setForm((p) => ({ ...p, mats: p.mats.includes(m) ? p.mats.filter((x) => x !== m) : [...p.mats, m] }));
  const adicionarOutraMat = () => {
    const m = outraMat.trim();
    if (!m) return;
    setForm((p) => (p.mats.includes(m) ? p : { ...p, mats: [...p.mats, m] }));
    setOutraMat('');
  };

  const uidDuplicado = !form.id && !!form.uid.trim() && porUid.has(form.uid.trim().toUpperCase());
  const podeSalvar = !!form.uid.trim() && !!form.maquina_nome.trim() && !uidDuplicado && !salvando;

  const salvarTag = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      await api.post('/bomba-combustivel/rfid', {
        id: form.id, uid: form.uid.trim().toUpperCase(), maquina_nome: form.maquina_nome.trim(),
        matriculas: form.mats, limite_litros_dia: form.limite.trim() === '' ? null : Number(form.limite.replace(',', '.')),
        bomba_id: id,
      });
      toast.success(form.id ? 'Máquina atualizada e enviada para a TON.' : `Tag ${form.uid.toUpperCase()} cadastrada e enviada para a TON.`);
      fecharCadastro();
      await carregar();
    } catch (e: any) { toast.error(erroMsg(e, 'Não foi possível salvar a máquina.')); } finally { setSalvando(false); }
  };
  const removerTag = async (rid: string) => {
    try { await api.delete(`/bomba-combustivel/rfid/${rid}`); setConfirmaDel(null); toast.success('Máquina removida e lista enviada para a TON.'); await carregar(); }
    catch (e: any) { toast.error(erroMsg(e, 'Não foi possível remover.')); }
  };

  const addOp = async () => {
    if (!novoOp.matricula.trim()) return;
    try {
      await api.post('/bomba-combustivel/operadores', { ...novoOp, matricula: novoOp.matricula.trim(), nome: novoOp.nome.trim(), bomba_id: id });
      setNovoOp({ matricula: '', nome: '' });
      toast.success('Operador cadastrado e enviado para a TON.');
      await carregar();
    } catch (e: any) { toast.error(erroMsg(e, 'Não foi possível cadastrar o operador.')); }
  };
  const delOp = async (oid: string) => {
    try { await api.delete(`/bomba-combustivel/operadores/${oid}`); setConfirmaDel(null); toast.success('Operador removido.'); await carregar(); }
    catch (e: any) { toast.error(erroMsg(e, 'Não foi possível remover.')); }
  };

  const publicar = async () => {
    try {
      const d = unwrap(await api.post(`/bomba-combustivel/${id}/whitelist/publicar`));
      if (d?.enviado) toast.success(`Lista enviada para a TON (${d.total} máquinas).`);
      else toast.error('Nenhuma TON ligada a esta bomba. Mapeie os relés da bomba na TON.');
      await carregar();
    } catch (e: any) { toast.error(erroMsg(e, 'Não foi possível enviar a lista.')); }
  };

  const rearmar = async () => {
    setRearmando(true);
    try {
      const d = unwrap(await api.post(`/bomba-combustivel/${id}/rearme`));
      const resp: any[] = d?.respostas ?? [];
      if (!d?.enviado) toast.error('Nenhuma TON ligada a esta bomba.');
      else if (resp.some((r) => r.status === 'timeout')) toast.error('A TON não respondeu. Confira se ela está conectada.');
      else if (resp.some((r) => /bloqueada/.test(String(r.msg)))) toast.error('A TON recusou o rearme: a contatora ainda está fechada.');
      else toast.success('Bomba rearmada.');
      setTimeout(() => carregar(), 1500);
    } catch (e: any) { toast.error(erroMsg(e, 'Não foi possível rearmar.')); } finally { setRearmando(false); }
  };

  // ---- painel de operação ----
  const info = ESTADOS[est] ?? { titulo: estado ? 'Estado desconhecido' : 'Carregando…', tom: 'neutro' as Tom, Icone: Fuel };
  const tomPainel: Tom = !conectada && estado ? 'neutro' : info.tom;
  const IconeEstado = !conectada && estado ? WifiOff : info.Icone;
  const sessaoTag = String(tel?.uid || '').toUpperCase();
  const sessaoMaq = sessaoTag ? porUid.get(sessaoTag)?.maquina_nome : null;
  const sessaoOp = tel?.matricula ? nomeOp.get(String(tel.matricula)) : null;
  const limiteSessao = sessaoTag ? Number(porUid.get(sessaoTag)?.limite_litros_dia) || 0 : 0;
  const passo = indicePasso(est);

  const instrucao = (() => {
    if (!estado) return '';
    if (!conectada) return idadeS != null ? `Sem comunicação com a TON ${haQuanto(idadeS)}. O estado abaixo é o último recebido.` : 'A TON ainda não enviou dados.';
    switch (est) {
      case 'ociosa': case 'idle': return temLeitor ? 'Aproxime a tag da máquina no leitor.' : 'Aguardando a identificação da máquina.';
      case 'aguardando_matricula': return 'Digite a matrícula no teclado do leitor e confirme com #.';
      case 'validando': return 'Conferindo tag e matrícula.';
      case 'partindo': return 'Aguardando a contatora confirmar a partida.';
      case 'encerrando': return 'Desligando a bomba e registrando o abastecimento.';
      case 'manual': return 'A bomba está na chave local. O NexON só registra.';
      case 'bloqueada': return ORIENTACAO_BLOQUEIO[tel?.motivo_bloqueio] ?? `Motivo: ${motivo(tel?.motivo_bloqueio)}. Confira a bomba antes de rearmar.`;
      default: return '';
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 pr-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Fuel className="h-5 w-5" /></span>
            <span className="flex flex-col">
              <span className="text-lg leading-tight">{bomba?.nome ?? 'Bomba'}</span>
              {bomba?.unidade_nome && <span className="text-xs font-normal text-muted-foreground">{bomba.unidade_nome}</span>}
            </span>
            {estado && (
              <span className="ml-2 flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', conectada ? 'bg-emerald-500' : 'bg-slate-400')} />
                {conectada ? `Conectada · ${haQuanto(idadeS ?? 0)}` : 'Sem comunicação'}
              </span>
            )}
            <Button size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={() => carregar(true)} title="Atualizar agora">
              {atualizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="operacao">Operação</TabsTrigger>
            <TabsTrigger value="maquinas">Máquinas ({rfids.length})</TabsTrigger>
            <TabsTrigger value="operadores">Operadores ({ops.length})</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* ============================== OPERAÇÃO ============================== */}
          <TabsContent value="operacao" className="space-y-4">
            <div className={cn('rounded-xl border p-4', TOM[tomPainel].painel)}>
              <div className="flex flex-wrap items-start gap-4">
                <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', TOM[tomPainel].icone)}>
                  <IconeEstado className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn('text-xl font-semibold', TOM[tomPainel].texto)}>{info.titulo}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{instrucao}</div>
                  {(sessaoTag || tel?.matricula) && est !== 'ociosa' && est !== 'bloqueada' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sessaoTag && <Chip><Nfc className="h-3 w-3" />{sessaoMaq ? `${sessaoMaq} · ` : ''}<span className="font-mono">{sessaoTag}</span></Chip>}
                      {tel?.matricula && <Chip><KeyRound className="h-3 w-3" />{sessaoOp ? `${sessaoOp} · ` : ''}mat. {tel.matricula}</Chip>}
                      {tel?.validacao && tel.validacao !== 'nenhuma' && <Chip>validação {tel.validacao}</Chip>}
                    </div>
                  )}
                </div>
                {(est === 'abastecendo' || est === 'bombeando') && (
                  <div className="text-right">
                    <div className="font-mono text-4xl font-semibold tabular-nums">{Number(tel?.litros ?? 0).toFixed(1)}<span className="ml-1 text-base text-muted-foreground">L</span></div>
                    <div className="text-xs text-muted-foreground tabular-nums">{Number(tel?.fluxo_lpm ?? 0).toFixed(1)} L/min</div>
                  </div>
                )}
                {est === 'bloqueada' && (
                  <Button onClick={rearmar} disabled={rearmando || !conectada} className="bg-red-600 text-white hover:bg-red-700">
                    {rearmando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}Rearmar
                  </Button>
                )}
              </div>

              {passo >= 0 && conectada && (
                <ol className="mt-4 flex items-center gap-1">
                  {PASSOS.map((p, i) => (
                    <li key={p.chave} className="flex flex-1 flex-col gap-1">
                      <span className={cn('h-1.5 rounded-full', i < passo ? 'bg-emerald-500' : i === passo ? TOM[info.tom].ponto : 'bg-muted-foreground/20')} />
                      <span className={cn('text-[11px]', i === passo ? 'font-medium text-foreground' : 'text-muted-foreground')}>{p.rotulo}</span>
                    </li>
                  ))}
                </ol>
              )}
              {(est === 'abastecendo' || est === 'bombeando') && limiteSessao > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Limite do dia desta máquina</span><span className="tabular-nums">{limiteSessao} L</span></div>
                  <Progress value={Math.min(100, (Number(tel?.litros ?? 0) / limiteSessao) * 100)} />
                </div>
              )}
            </div>

            {temLeitor && ultimaTag && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Nfc className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Última tag lida</span>
                <span className="font-mono font-semibold">{ultimaTag}</span>
                {tagLidaHa && <span className="text-xs text-muted-foreground">{tagLidaHa}</span>}
                {porUid.get(ultimaTag)
                  ? <Chip tom="ok" className="ml-1"><CheckCircle2 className="h-3 w-3" />{porUid.get(ultimaTag)?.maquina_nome || 'cadastrada'}</Chip>
                  : <>
                      <Chip tom="alerta" className="ml-1">não cadastrada</Chip>
                      <Button size="sm" variant="outline" className="ml-auto" onClick={usarUltima}><Plus className="mr-1 h-4 w-4" />Cadastrar esta tag</Button>
                    </>}
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sinais da bomba</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Sinal rotulo="Contatora" valor={tel?.contator} textoSim="fechada" textoNao="aberta" />
                <Sinal rotulo="Chave" valor={tel?.automatico} textoSim="automático" textoNao="manual" tomNao="alerta" />
                <Sinal rotulo="Emergência" valor={tel?.emergencia} textoSim="acionada" textoNao="normal" tomSim="critico" tomNao="ok" />
                <Sinal rotulo="Bico" valor={tel?.bico_no_suporte} textoSim="no suporte" textoNao="fora" tomSim="neutro" tomNao="info" />
                <Sinal rotulo="Boia de mínimo" valor={tel?.boia_min} textoSim="baixo" textoNao="normal" tomSim="alerta" tomNao="ok" />
                <Sinal rotulo="Boia alta" valor={tel?.boia_alta} textoSim="acionada" textoNao="normal" tomSim="info" tomNao="neutro" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Nível do tanque</span><span className="tabular-nums">{nivel != null ? `${nivel.toFixed(0)}%` : 'sem medição'}</span></div>
                <Progress value={nivel ?? 0} />
              </div>
              <div className={cn('flex items-center gap-2 rounded-md border p-3 text-sm', desatualizada && TOM.alerta.painel)}>
                {desatualizada ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                <span className="flex-1">
                  {desatualizada ? 'A TON está com uma lista antiga' : 'Lista de autorizados em dia'}
                  <span className="block text-xs text-muted-foreground">{estado?.rfid_autorizados ?? 0} máquinas · {estado?.operadores ?? 0} operadores</span>
                </span>
                {desatualizada && <Button size="sm" variant="outline" onClick={publicar}><Send className="mr-1 h-4 w-4" />Enviar</Button>}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Últimos abastecimentos</div>
              {(estado?.ultimos_abastecimentos ?? []).length === 0 ? <Vazio>Nenhum abastecimento registrado.</Vazio> : (
                <ul className="divide-y rounded-md border">
                  {(estado.ultimos_abastecimentos as any[]).slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">{a.inicio ?? a.created_at}</span>
                      <span className="min-w-0 flex-1 truncate">{a.maquina_nome ?? a.uid ?? '—'}<span className="text-muted-foreground"> · {a.operador_nome ?? (a.matricula ? `mat. ${a.matricula}` : 'sem operador')}</span></span>
                      <span className="font-mono tabular-nums">{a.litros != null ? `${Number(a.litros).toFixed(1)} L` : '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {tel?.ver && <div className="text-right text-[11px] text-muted-foreground">firmware {tel.ver}</div>}
          </TabsContent>

          {/* ============================== MÁQUINAS ============================== */}
          <TabsContent value="maquinas" className="space-y-4">
            {etapa === 'fechado' && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto max-w-md text-sm text-muted-foreground">Cada máquina tem uma tag. Para cadastrar, aproxime a tag do leitor e o NexON preenche o número.</p>
                {temLeitor && <Button onClick={iniciarLeitura} disabled={!conectada}><Nfc className="mr-2 h-4 w-4" />Cadastrar tag</Button>}
                <Button variant={temLeitor ? 'outline' : 'default'} onClick={digitarUid}><Keyboard className="mr-2 h-4 w-4" />Digitar número</Button>
              </div>
            )}

            {etapa === 'lendo' && (
              <div className={cn('flex flex-col items-center gap-3 rounded-xl border p-8 text-center', TOM.info.painel)}>
                <span className="relative flex h-16 w-16 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/40 motion-reduce:animate-none" />
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white"><Nfc className="h-7 w-7" /></span>
                </span>
                <div className="text-lg font-semibold text-sky-900 dark:text-sky-100">Aproxime a tag do leitor</div>
                <div className="max-w-sm text-sm text-muted-foreground">O número aparece aqui assim que a bomba ler. A bomba vai pedir matrícula, mas pode ignorar: ela volta sozinha em 1 minuto.</div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={fecharCadastro}>Cancelar</Button>
                  <Button variant="outline" onClick={digitarUid}>Digitar número</Button>
                </div>
              </div>
            )}

            {etapa === 'form' && (
              <div className="space-y-4 rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Nfc className="h-5 w-5" /></span>
                  <div className="flex-1">
                    <div className="font-semibold">{form.id ? 'Editar máquina' : 'Nova máquina'}</div>
                    <div className="text-xs text-muted-foreground">{form.uid && !form.id ? 'Tag lida pelo leitor. Agora dê um nome à máquina.' : 'A tag identifica a máquina na bomba.'}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={fecharCadastro} title="Fechar"><X className="h-4 w-4" /></Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor="bm-uid">Tag</Label>
                    <Input id="bm-uid" value={form.uid} onChange={(e) => setForm((p) => ({ ...p, uid: e.target.value.toUpperCase() }))}
                      placeholder="ex.: B9FFD8" className="font-mono text-base" readOnly={!!form.id} />
                    {uidDuplicado && <div className="text-xs text-red-600">Essa tag já está cadastrada.</div>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bm-maq">Máquina</Label>
                    <Input id="bm-maq" autoFocus value={form.maquina_nome} onChange={(e) => setForm((p) => ({ ...p, maquina_nome: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') salvarTag(); }} placeholder="ex.: Trator PC-07" className="text-base" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Quem pode abastecer esta máquina</Label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setForm((p) => ({ ...p, mats: [] }))}
                      className={cn('rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        form.mats.length === 0 ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                      Qualquer operador cadastrado
                    </button>
                    {ops.map((o) => {
                      const m = String(o.matricula); const on = form.mats.includes(m);
                      return (
                        <button key={o.id} type="button" onClick={() => alternarMat(m)}
                          className={cn('rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                          {o.nome || 'Operador'} <span className="font-mono opacity-70">{m}</span>
                        </button>
                      );
                    })}
                    {form.mats.filter((m) => !nomeOp.has(m)).map((m) => (
                      <button key={m} type="button" onClick={() => alternarMat(m)} title="Matrícula só desta máquina. Clique para remover."
                        className="rounded-full border border-primary bg-primary px-3 py-1 text-sm text-primary-foreground">
                        <span className="font-mono">{m}</span> <X className="inline h-3 w-3" />
                      </button>
                    ))}
                    <span className="flex items-center gap-1">
                      <Input value={outraMat} onChange={(e) => setOutraMat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarOutraMat(); } }}
                        placeholder="outra matrícula" className="h-8 w-36 text-sm" />
                      <Button size="sm" variant="ghost" onClick={adicionarOutraMat} disabled={!outraMat.trim()}><Plus className="h-4 w-4" /></Button>
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {form.mats.length === 0 ? 'Qualquer matrícula da aba Operadores abastece esta máquina.' : 'Só as matrículas marcadas abastecem esta máquina.'}
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bm-lim">Limite por dia (opcional)</Label>
                    <div className="flex items-center gap-2">
                      <Input id="bm-lim" inputMode="decimal" value={form.limite} onChange={(e) => setForm((p) => ({ ...p, limite: e.target.value }))} placeholder="sem limite" className="w-32" />
                      <span className="text-sm text-muted-foreground">litros</span>
                    </div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button variant="ghost" onClick={fecharCadastro}>Cancelar</Button>
                    <Button onClick={salvarTag} disabled={!podeSalvar}>
                      {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Salvar e enviar para a bomba
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {rfids.length === 0 ? <Vazio>Nenhuma máquina cadastrada. Sem máquina cadastrada, a bomba não libera para ninguém.</Vazio> : (
              <ul className="divide-y rounded-md border">
                {rfids.map((r) => {
                  const uid = String(r.uid ?? '').toUpperCase();
                  const mats: string[] = Array.isArray(r.matriculas) ? r.matriculas.map(String) : [];
                  const recente = uid === ultimaTag;
                  return (
                    <li key={r.id} className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5', recente && 'bg-sky-50/60 dark:bg-sky-950/30')}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.maquina_nome || 'Sem nome'}</span>
                          {recente && <Chip tom="info">lida {tagLidaHa}</Chip>}
                          {r.ativo === false && <Chip>inativa</Chip>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-mono">{uid}</span>
                          <span>{mats.length ? mats.map((m) => nomeOp.get(m) ? `${nomeOp.get(m)} (${m})` : m).join(', ') : 'qualquer operador'}</span>
                          <span>{r.limite_litros_dia ? `até ${Number(r.limite_litros_dia)} L/dia` : 'sem limite'}</span>
                        </div>
                      </div>
                      {confirmaDel === r.id ? (
                        <span className="flex items-center gap-1 text-sm">
                          Remover?
                          <Button size="sm" variant="destructive" onClick={() => removerTag(r.id)}>Remover</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmaDel(null)}>Não</Button>
                        </span>
                      ) : (
                        <span className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => abrirEdicao(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Remover" onClick={() => setConfirmaDel(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {desatualizada && (
              <div className={cn('flex items-center gap-2 rounded-md border p-2 text-sm', TOM.alerta.painel)}>
                <AlertTriangle className="h-4 w-4 text-amber-600" /><span className="flex-1">A bomba ainda está com a lista antiga.</span>
                <Button size="sm" variant="outline" onClick={publicar}><Send className="mr-1 h-4 w-4" />Enviar agora</Button>
              </div>
            )}
          </TabsContent>

          {/* ============================== OPERADORES ============================== */}
          <TabsContent value="operadores" className="space-y-4">
            <p className="text-sm text-muted-foreground">O operador digita a matrícula no teclado do leitor depois da tag. Só matrícula cadastrada aqui abastece. Sem nenhum operador, a bomba nega todo mundo.</p>
            <div className="flex flex-wrap items-end gap-2 rounded-xl border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="op-mat">Matrícula</Label>
                <Input id="op-mat" inputMode="numeric" value={novoOp.matricula} onChange={(e) => setNovoOp((p) => ({ ...p, matricula: e.target.value }))} placeholder="ex.: 1234" className="w-32 font-mono" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="op-nome">Nome</Label>
                <Input id="op-nome" value={novoOp.nome} onChange={(e) => setNovoOp((p) => ({ ...p, nome: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') addOp(); }} placeholder="Nome do operador" className="min-w-[180px]" />
              </div>
              <Button onClick={addOp} disabled={!novoOp.matricula.trim()}><Plus className="mr-1 h-4 w-4" />Cadastrar</Button>
            </div>
            {ops.length === 0 ? <Vazio>Nenhum operador cadastrado.</Vazio> : (
              <ul className="divide-y rounded-md border">
                {ops.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><KeyRound className="h-4 w-4" /></span>
                    <span className="flex-1"><span className="font-medium">{o.nome || 'Sem nome'}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{o.matricula}</span></span>
                    {confirmaDel === o.id ? (
                      <span className="flex items-center gap-1 text-sm">
                        Remover?
                        <Button size="sm" variant="destructive" onClick={() => delOp(o.id)}>Remover</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmaDel(null)}>Não</Button>
                      </span>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Remover" onClick={() => setConfirmaDel(o.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ============================== HISTÓRICO ============================== */}
          <TabsContent value="historico" className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Abastecimentos</div>
              {(estado?.ultimos_abastecimentos ?? []).length === 0 ? <Vazio>Nenhum abastecimento registrado.</Vazio> : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr><th className="px-3 py-2 font-medium">Quando</th><th className="px-3 py-2 font-medium">Máquina</th><th className="px-3 py-2 font-medium">Operador</th><th className="px-3 py-2 text-right font-medium">Litros</th><th className="px-3 py-2 font-medium">Como terminou</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {(estado.ultimos_abastecimentos as any[]).map((a) => (
                        <tr key={a.id}>
                          <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{a.inicio ?? a.created_at}</td>
                          <td className="px-3 py-2">{a.maquina_nome ?? a.uid ?? '—'}</td>
                          <td className="px-3 py-2">{a.operador_nome ?? a.matricula ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">{a.litros != null ? Number(a.litros).toFixed(1) : '—'}</td>
                          <td className="px-3 py-2 text-xs">{motivo(a.fim_motivo ?? a.status)}{a.validacao && a.validacao !== 'nenhuma' ? <span className="text-muted-foreground"> · {a.validacao}</span> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ocorrências</div>
              {(estado?.eventos ?? []).length === 0 ? <Vazio>Nenhuma ocorrência.</Vazio> : (
                <ul className="divide-y rounded-md border">
                  {(estado.eventos as any[]).map((ev) => {
                    const e = EVENTOS[ev.tipo] ?? { titulo: String(ev.tipo || 'evento').replace(/_/g, ' '), tom: 'neutro' as Tom };
                    const Ic = e.tom === 'critico' ? XCircle : e.tom === 'alerta' ? AlertTriangle : e.tom === 'ok' ? CheckCircle2 : Info;
                    const maq = ev.uid ? porUid.get(String(ev.uid).toUpperCase())?.maquina_nome : null;
                    return (
                      <li key={ev.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                        <Ic className={cn('mt-0.5 h-4 w-4 shrink-0', e.tom === 'critico' ? 'text-red-600' : e.tom === 'alerta' ? 'text-amber-600' : e.tom === 'ok' ? 'text-emerald-600' : 'text-sky-600')} />
                        <div className="min-w-0 flex-1">
                          <div><span className="font-medium">{e.titulo}</span>{ev.motivo && ev.motivo !== ev.tipo && <span className="text-muted-foreground">: {motivo(ev.motivo)}</span>}</div>
                          {(ev.uid || ev.matricula) && (
                            <div className="text-xs text-muted-foreground">
                              {ev.uid && <>{maq ? `${maq} · ` : ''}<span className="font-mono">{ev.uid}</span></>}
                              {ev.matricula && <> · mat. <span className="font-mono">{ev.matricula}</span>{nomeOp.get(String(ev.matricula)) ? ` (${nomeOp.get(String(ev.matricula))})` : ''}</>}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ev.quando}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default BombaModal;
