/**
 * Modal do Emulador Modbus RTU.
 *
 * O nó no diagrama é do TIPO REAL (power_meter, inversor, ...) com props.emulado = true —
 * o gerador de firmware não muda nada: a TON consulta esse endereço como se fosse o
 * equipamento de verdade. Aqui o usuário escolhe tipo/modelo/endereço/ativo do unifilar,
 * digita os valores dos pontos e liga o PC no RS485 da TON (Web Serial).
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { type PlanoGiro, VELOCIDADE_MAX_GRAUS_S, grausDoGiro, posicaoDoGiro, validarGiro, velocidadeDoGiro } from './emulador-giro';
import { AlertTriangle, Cable, CircleStop, Info, Loader2, Play, Plug, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TIPOS_EMULAVEIS,
  WORK_STATE_CODES,
  listarModelosRtu,
  listarPontosAi,
  listarPontosBi,
  resolverModeloRtu,
  type CatalogModel,
  type DevicePointDef,
} from './emulador-catalog';
import { VALORES_TIPICOS, configPadrao, montarTabela, type Aviso, type EmuladorConfig } from './emulador-encoder';
import { emuladorSessoes, ALERTA_SEM_CONSULTA_MS } from './emulador-sessao';
import { pedirPorta, webSerialDisponivel } from './web-serial-transport';

export interface EmulacaoProps {
  valores: Record<string, number | string>;
  bi: Record<string, boolean>;
  cfg: EmuladorConfig;
}

export interface AlvosUnifilar {
  campo: 'equipamento_id' | 'disjuntor_equipamento_id';
  rotulo: string;
  lista: { id: string; nome: string }[];
  /** Tipo sem vínculo com o unifilar (ex.: encoder). */
  naoAssocia?: boolean;
}

export interface EmuladorModalProps {
  open: boolean;
  onClose: () => void;
  /** null = criando um emulador novo. */
  comp: { id: string; type: string; props: Record<string, any> } | null;
  carregarAlvos: (type: string, compId: string | null) => Promise<AlvosUnifilar>;
  /** Texto do conflito (outro device no mesmo barramento com o endereço) ou null. */
  conflitoEndereco: (compId: string | null, type: string, endereco: number) => string | null;
  /** Cria/atualiza o nó e salva o diagrama. Devolve o id do nó. */
  onSalvar: (dados: { id: string | null; type: string; props: Record<string, any> }) => Promise<string | null>;
  /** Volta pro editor de propriedades padrão do nó (campos avançados). */
  onAbrirPropriedades?: (compId: string) => void;
}

const catalogo = (): { models: Record<string, CatalogModel>; points: Record<string, { ai?: DevicePointDef[]; bi?: DevicePointDef[] }> } => ({
  models: ((window as any).DEVICE_MODELS ?? {}) as Record<string, CatalogModel>,
  points: ((window as any).DEVICE_POINTS ?? {}) as Record<string, { ai?: DevicePointDef[]; bi?: DevicePointDef[] }>,
});

const NOTAS_TIPO: Record<string, string[]> = {
  medidor_energia: [
    'Consumos do intervalo (consumo_*) são calculados pela TON a partir da energia acumulada — por isso não aparecem aqui. Com energia fixa, o consumo publicado é 0.',
  ],
  inversor_solar: ['O estado de operação (work_state) define se o inversor aparece rodando, parado ou em falha.'],
  rele_protecao: ['Os estados das proteções (BI) aparecem na aba de entradas binárias abaixo.'],
  encoder_posicao: ['O valor é a contagem bruta; o NexON converte em ângulo pela configuração do pivô.'],
};

function fmt(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  return a !== 0 && (a < 0.001 || a >= 1e9) ? n.toExponential(4) : String(Number(n.toPrecision(7)));
}

export function EmuladorModal({ open, onClose, comp, carregarAlvos, conflitoEndereco, onSalvar, onAbrirPropriedades }: EmuladorModalProps) {
  const [nodeId, setNodeId] = useState<string | null>(comp?.id ?? null);
  const [tipo, setTipo] = useState<string>(comp?.type ?? 'power_meter');
  const [catalogId, setCatalogId] = useState<string>(comp?.props?.catalog_id ?? '');
  const [nome, setNome] = useState<string>(comp?.props?.name ?? 'Emulador');
  const [endereco, setEndereco] = useState<string>(String(comp?.props?.modbus_address ?? '1'));
  const [alvos, setAlvos] = useState<AlvosUnifilar | null>(null);
  const [alvoId, setAlvoId] = useState<string>('');
  // valores = o que o PC RESPONDE para a TON; rascunho = o que está digitado. Só vira valor ao
  // Aplicar / Enter / Salvar — senão, digitando 300, a TON lia 3, 30 e 300 (saltos no encoder).
  const [valores, setValoresAplicados] = useState<Record<string, number | string>>(comp?.props?.emulacao?.valores ?? {});
  const [rascunho, setRascunho] = useState<Record<string, number | string>>(comp?.props?.emulacao?.valores ?? {});
  const setValores = (v: Record<string, number | string> | ((x: Record<string, number | string>) => Record<string, number | string>)) => {
    setValoresAplicados(v); setRascunho(v);
  };
  const pendente = Object.keys({ ...valores, ...rascunho }).some((k) => String(valores[k] ?? '') !== String(rascunho[k] ?? ''));
  const aplicar = () => setValoresAplicados(rascunho);

  // Simular giro (encoder): a posição anda sozinha de "de" até "até" no tempo escolhido.
  const [giro, setGiro] = useState<{ de: string; ate: string; tempo: string; unidade: 's' | 'min'; sentido: PlanoGiro['sentido'] }>(
    { de: '0', ate: '90', tempo: '60', unidade: 's', sentido: 'crescente' });
  const [giroInicio, setGiroInicio] = useState<number | null>(null);
  const planoGiro: PlanoGiro = {
    de: Number(giro.de), ate: Number(giro.ate), sentido: giro.sentido,
    segundos: Number(giro.tempo) * (giro.unidade === 'min' ? 60 : 1),
  };
  const erroGiro = validarGiro(planoGiro);
  const velGiro = erroGiro ? null : velocidadeDoGiro(planoGiro);
  useEffect(() => {
    if (giroInicio == null) return;
    const passo = () => {
      const { posicao, fim } = posicaoDoGiro(planoGiro, Date.now() - giroInicio);
      setValores((v) => ({ ...v, posicao }));
      if (fim) setGiroInicio(null);
    };
    passo();
    const t = setInterval(passo, 1000);
    return () => clearInterval(t);
  }, [giroInicio]); // eslint-disable-line react-hooks/exhaustive-deps
  const [bi, setBi] = useState<Record<string, boolean>>(comp?.props?.emulacao?.bi ?? {});
  const [cfg, setCfg] = useState<EmuladorConfig | null>(comp?.props?.emulacao?.cfg ?? null);
  const [salvando, setSalvando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [erroSerial, setErroSerial] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());

  // Reinicia o estado quando abre para outro nó.
  useEffect(() => {
    if (!open) return;
    const mesmoNo = (comp?.id ?? null) === nodeId;
    if (!mesmoNo) setGiroInicio(null);   // giro simulado é do nó anterior
    setNodeId(comp?.id ?? null);
    setTipo(comp?.type ?? 'power_meter');
    setCatalogId(comp?.props?.catalog_id ?? '');
    setNome(comp?.props?.name ?? 'Emulador');
    setEndereco(String(comp?.props?.modbus_address ?? '1'));
    // Reabrindo o mesmo nó com o giro rodando: mantém a posição atual (voltar ao valor salvo
    // seria um salto que a TON descartaria).
    if (!(mesmoNo && giroInicio != null)) setValores(comp?.props?.emulacao?.valores ?? {});
    setBi(comp?.props?.emulacao?.bi ?? {});
    setCfg(comp?.props?.emulacao?.cfg ?? null);
    setErroSerial(null);
  }, [open, comp]);

  const { models, points } = useMemo(catalogo, [open]);
  const catalogTipo = TIPOS_EMULAVEIS[tipo]?.catalogTipo ?? '';
  const modelos = useMemo(() => listarModelosRtu(models, catalogTipo), [models, catalogTipo]);
  const modeloBase = catalogId ? models[catalogId] : null;
  const modelo = useMemo(() => (modeloBase ? resolverModeloRtu(modeloBase) : null), [modeloBase]);
  const modeloInvalido = !!catalogId && (!modeloBase || !modelos.some((m) => m.id === catalogId));

  // Config padrão (TP/TC, casas decimais) quando troca de modelo.
  useEffect(() => {
    if (!modelo) return;
    setCfg((c) => {
      const pad = configPadrao(modelo);
      if (!c) return pad;
      return { tp: c.tp ?? pad.tp, tc: c.tc ?? pad.tc, decimais: { ...pad.decimais, ...(c.decimais || {}) } };
    });
  }, [modelo]);

  // Ativos do unifilar para associar.
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setAlvos(null);
    carregarAlvos(tipo, nodeId)
      .then((a) => {
        if (!vivo) return;
        setAlvos(a);
        setAlvoId(String(comp?.type === tipo ? comp?.props?.[a.campo] ?? '' : '').trim());
      })
      .catch(() => vivo && setAlvos({ campo: 'equipamento_id', rotulo: 'Equipamento do unifilar', lista: [] }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipo]);

  const props = useMemo<Record<string, any>>(() => (comp?.type === tipo ? comp?.props ?? {} : {}), [comp, tipo]);
  const defsAi = useMemo(() => points[catalogTipo]?.ai ?? [], [points, catalogTipo]);
  const defsBi = useMemo(() => points[catalogTipo]?.bi ?? [], [points, catalogTipo]);
  const pontosAi = useMemo(() => (modelo ? listarPontosAi(modelo, props, defsAi) : null), [modelo, props, defsAi]);
  const pontosBi = useMemo(() => (modelo ? listarPontosBi(modelo, defsBi) : []), [modelo, defsBi]);

  const end = Number(endereco);
  const enderecoValido = Number.isInteger(end) && end >= 1 && end <= 247;
  const conflito = enderecoValido ? conflitoEndereco(nodeId, tipo, end) : null;

  const montagem = useMemo(() => {
    if (!modelo || !cfg) return null;
    return montarTabela({ model: modelo, props, valores, bi, cfg, pointDefsAi: defsAi, pointDefsBi: defsBi });
  }, [modelo, props, valores, bi, cfg, defsAi, defsBi]);

  // Sessão ao vivo
  useSyncExternalStore(emuladorSessoes.subscribe, emuladorSessoes.versao);
  const sessao = nodeId ? emuladorSessoes.get(nodeId) : null;
  const ativa = !!sessao?.ativo;

  // Troca a tabela/endereço ao vivo enquanto emula.
  useEffect(() => {
    if (nodeId && ativa && montagem && enderecoValido) emuladorSessoes.atualizar(nodeId, montagem.table, end);
  }, [nodeId, ativa, montagem, end, enderecoValido]);

  useEffect(() => {
    if (!open || !ativa) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, ativa]);

  const avisos: Aviso[] = [];
  if (!enderecoValido) avisos.push({ nivel: 'erro', texto: 'Endereço Modbus deve ser um inteiro de 1 a 247.' });
  if (conflito) avisos.push({ nivel: 'erro', texto: conflito });
  if (modeloInvalido) avisos.push({ nivel: 'erro', texto: `Modelo "${catalogId}" não é Modbus RTU (ou não existe no catálogo) — escolha um modelo RTU.` });
  if (alvos && !alvos.naoAssocia && !alvoId) avisos.push({ nivel: 'aviso', texto: `Nada escolhido em "${alvos.rotulo}" — os valores chegam na TON mas não aparecem em nenhum equipamento do unifilar.` });
  if (montagem) avisos.push(...montagem.avisos);

  const podeSalvar = !!modelo && !modeloInvalido && enderecoValido && !conflito && !salvando;

  const montarProps = () => {
    const p: Record<string, any> = {
      name: nome.trim() || 'Emulador',
      catalog_id: catalogId,
      modbus_address: end,
      _addr_manual: true,
      emulado: true,
      emulacao: { valores: rascunho, bi, cfg } satisfies EmulacaoProps,
    };
    if (alvos && !alvos.naoAssocia) p[alvos.campo] = alvoId;
    return p;
  };

  const salvar = async (): Promise<string | null> => {
    setSalvando(true);
    aplicar();   // salvar também efetiva o que está digitado
    try {
      const id = await onSalvar({ id: nodeId, type: tipo, props: montarProps() });
      if (id) setNodeId(id);
      return id;
    } finally {
      setSalvando(false);
    }
  };

  const iniciar = async () => {
    setErroSerial(null);
    if (!montagem) return;
    let id = nodeId;
    // Pede a porta ANTES de qualquer await longo (exige gesto do usuário).
    let porta;
    try {
      porta = await pedirPorta();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/No port selected|cancel/i.test(msg)) setErroSerial(msg);
      return;
    }
    setIniciando(true);
    try {
      id = await salvar();
      if (!id) throw new Error('Não foi possível salvar o emulador no diagrama.');
      await emuladorSessoes.iniciar(id, nome, end, porta, montagem.table);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErroSerial(/already open|InvalidStateError/i.test(msg)
        ? 'A porta já está aberta (outro programa ou outra aba usando o adaptador). Feche e tente de novo.'
        : msg);
    } finally {
      setIniciando(false);
    }
  };

  const parar = async () => { if (nodeId) await emuladorSessoes.parar(nodeId); };

  const trocarTipo = (t: string) => {
    setTipo(t);
    setCatalogId('');
    setValores({});
    setBi({});
    setCfg(null);
  };

  const preencherTipicos = () => {
    if (!pontosAi) return;
    setValores((v) => {
      const n = { ...v };
      for (const p of pontosAi.pontos) {
        const tip = [p.pid, ...p.aliases].map((k) => VALORES_TIPICOS[k]).find((x) => x !== undefined);
        if (tip !== undefined && (n[p.pid] === undefined || n[p.pid] === '')) n[p.pid] = tip;
      }
      return n;
    });
  };

  const semConsulta = ativa && sessao && (sessao.ultimaLeitura ?? sessao.inicio) < agora - ALERTA_SEM_CONSULTA_MS;
  const outros = sessao ? Object.keys(sessao.outrosEnderecos).map(Number).sort((a, b) => a - b) : [];
  const serialOk = webSerialDisponivel();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="emulador-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cable className="h-5 w-5 text-orange-500" /> Emulador Modbus RTU
            {ativa && <span className="ml-2 rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">EMULANDO</span>}
          </DialogTitle>
          <DialogDescription>
            O PC responde no RS485 da TON como se fosse o equipamento real (9600 8N1, adaptador USB-RS485 no A/B).
          </DialogDescription>
        </DialogHeader>

        {/* 1. Equipamento */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Tipo de equipamento</Label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={tipo} disabled={!!nodeId}
              onChange={(e) => trocarTipo(e.target.value)} data-testid="emu-tipo">
              {Object.entries(TIPOS_EMULAVEIS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Modelo (só Modbus RTU)</Label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)} data-testid="emu-modelo">
              <option value="">Selecione…</option>
              {modelos.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            {modelos.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Nenhum modelo RTU para este tipo.</p>}
          </div>
          <div>
            <Label>Nome no diagrama</Label>
            <Input className="mt-1" value={nome} onChange={(e) => setNome(e.target.value)} data-testid="emu-nome" />
          </div>
          <div>
            <Label>Endereço Modbus (1–247)</Label>
            <Input className="mt-1" type="number" min={1} max={247} value={endereco} onChange={(e) => setEndereco(e.target.value)} data-testid="emu-endereco" />
          </div>
          {!alvos?.naoAssocia && <div className="sm:col-span-2">
            <Label>{alvos?.rotulo ?? 'Equipamento do unifilar'}</Label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={alvoId}
              onChange={(e) => setAlvoId(e.target.value)} disabled={!alvos} data-testid="emu-alvo">
              <option value="">{alvos ? '— sem associação —' : 'Carregando…'}</option>
              {alvos?.lista.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              {alvoId && alvos && !alvos.lista.some((a) => a.id === alvoId) && <option value={alvoId}>{alvoId} (atual)</option>}
            </select>
          </div>}
          {!nodeId && (
            <p className="sm:col-span-2 flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Depois de criar, ligue o emulador à TON com uma conexão RS485 no diagrama — o conflito de endereço com os outros equipamentos do barramento é verificado a partir daí.</p>
          )}
        </section>

        {modelo && cfg && (
          <>
            {/* 2. Configuração obrigatória */}
            {(modelo.tp_tc || modelo.decimal_regs) && (
              <section className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3" data-testid="emu-config">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> Configuração que a TON lê do equipamento (não pode ficar em branco)
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {modelo.tp_tc && (
                    <>
                      <div>
                        <Label className="text-xs">Relação TP {montagem?.fatores.tpOverride && <span className="text-amber-600">(override do nó: {String(props.tp_ratio)})</span>}</Label>
                        <Input type="number" value={cfg.tp} onChange={(e) => setCfg({ ...cfg, tp: Number(e.target.value) })} data-testid="emu-tp" />
                      </div>
                      <div>
                        <Label className="text-xs">Relação TC {montagem?.fatores.tcOverride && <span className="text-amber-600">(override do nó: {String(props.tc_ratio)})</span>}</Label>
                        <Input type="number" value={cfg.tc} onChange={(e) => setCfg({ ...cfg, tc: Number(e.target.value) })} data-testid="emu-tc" />
                      </div>
                    </>
                  )}
                  {Object.entries(modelo.decimal_regs?.layout ?? {}).map(([k, l]) => (
                    <div key={k}>
                      <Label className="text-xs">Casas decimais {k.toUpperCase()} (padrão {l.baseline ?? 4})</Label>
                      <Input type="number" min={0} max={9} value={cfg.decimais[k] ?? l.baseline ?? 4}
                        onChange={(e) => setCfg({ ...cfg, decimais: { ...cfg.decimais, [k]: Number(e.target.value) } })} />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Padrão: TP = TC = 1 e casas decimais no valor de fábrica — assim o que você digita é exatamente o que aparece.</p>
              </section>
            )}

            {(NOTAS_TIPO[catalogTipo] ?? []).map((n) => (
              <p key={n} className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{n}</p>
            ))}

            {/* 3. Pontos AI */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pontos analógicos (AI) — {pontosAi?.pontos.length ?? 0}</h3>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={preencherTipicos} data-testid="emu-tipicos">Preencher típicos</Button>
                  <Button type="button" size="sm" disabled={!pendente} onClick={aplicar} data-testid="emu-aplicar">{pendente ? 'Aplicar valores' : 'Valores aplicados'}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setValores({})}>Limpar</Button>
                </div>
              </div>
              <div className="max-h-[38vh] overflow-y-auto rounded-md border">
                <table className="w-full text-sm" data-testid="emu-tabela-ai">
                  <thead className="sticky top-0 bg-muted text-xs">
                    <tr><th className="p-2 text-left">Ponto</th><th className="p-2 text-left">Valor</th><th className="p-2 text-left">TON vai ler</th><th className="p-2 text-left">Registrador</th></tr>
                  </thead>
                  <tbody>
                    {pontosAi?.pontos.map((p) => {
                      const lido = montagem?.leituras[p.pid];
                      const dig = Number(valores[p.pid]);
                      const difere = valores[p.pid] !== undefined && valores[p.pid] !== '' && lido !== undefined && Math.abs(lido - dig) > Math.max(1e-6, Math.abs(dig) * 1e-5);
                      const naoAplicado = String(valores[p.pid] ?? '') !== String(rascunho[p.pid] ?? '');
                      const ehEstado = p.pid === 'work_state';
                      return (
                        <tr key={p.pid} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{p.label}</div>
                            <div className="text-[11px] text-muted-foreground">{p.pid}{p.aliases.length ? ` (= ${p.aliases.join(', ')})` : ''}</div>
                          </td>
                          <td className="p-2">
                            {ehEstado ? (
                              <select className="h-8 w-full rounded-md border border-input bg-background px-1 text-sm" value={String(valores[p.pid] ?? 0)}
                                onChange={(e) => { const n = Number(e.target.value); setValores((v) => ({ ...v, [p.pid]: n })); }}>
                                {WORK_STATE_CODES.map((w) => <option key={w.value} value={w.value}>{w.label} (0x{w.value.toString(16).padStart(4, '0')})</option>)}
                              </select>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Input className="h-8 w-32" type="number" step="any" value={rascunho[p.pid] ?? ''} placeholder="0"
                                  onChange={(e) => setRascunho({ ...rascunho, [p.pid]: e.target.value })}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicar(); } }} data-testid={`emu-ai-${p.pid}`} />
                                <span className="text-xs text-muted-foreground">{p.unit}</span>
                              </div>
                            )}
                          </td>
                          <td className={`p-2 tabular-nums ${difere ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`} data-testid={`emu-lido-${p.pid}`}>
                            {fmt(lido)} {difere && <span className="text-[11px]">(resolução do registrador)</span>}
                            {naoAplicado && <span className="ml-1 text-[11px] text-amber-600">· não aplicado (Enter ou Aplicar)</span>}
                          </td>
                          <td className="p-2 text-[11px] text-muted-foreground">func 0{p.func} · {p.register} · {p.dataType}{p.scale !== 1 ? ` ÷${p.scale}` : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!!pontosAi?.derivados.length && (
                <p className="mt-1 text-xs text-muted-foreground">Ocultos (calculados pela TON): {pontosAi.derivados.join(', ')}</p>
              )}
            </section>

            {/* 3b. Simular giro (só encoder) */}
            {pontosAi?.pontos.some((p) => p.pid === 'posicao') && (
              <section className="rounded-md border p-3" data-testid="emu-giro">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Simular giro do encoder</h3>
                  {giroInicio != null && <span className="text-xs tabular-nums text-muted-foreground">posição agora: {String(valores.posicao ?? '—')}</span>}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div><Label className="text-xs">De</Label>
                    <Input className="h-8 w-20" type="number" min={0} max={359} value={giro.de} disabled={giroInicio != null} onChange={(e) => setGiro({ ...giro, de: e.target.value })} /></div>
                  <div><Label className="text-xs">Até</Label>
                    <Input className="h-8 w-20" type="number" min={0} max={giro.sentido === 'crescente' ? 3600 : 359} title="Crescente: acima de 359 conta voltas (360 = uma volta inteira)" value={giro.ate} disabled={giroInicio != null} onChange={(e) => setGiro({ ...giro, ate: e.target.value })} /></div>
                  <div><Label className="text-xs">Em</Label>
                    <div className="flex gap-1">
                      <Input className="h-8 w-20" type="number" min={1} value={giro.tempo} disabled={giroInicio != null} onChange={(e) => setGiro({ ...giro, tempo: e.target.value })} />
                      <select className="h-8 rounded-md border border-input bg-background px-1 text-sm" value={giro.unidade} disabled={giroInicio != null}
                        onChange={(e) => setGiro({ ...giro, unidade: e.target.value as 's' | 'min' })}>
                        <option value="s">s</option><option value="min">min</option>
                      </select>
                    </div></div>
                  <div><Label className="text-xs">Sentido</Label>
                    <select className="h-8 rounded-md border border-input bg-background px-1 text-sm" value={giro.sentido} disabled={giroInicio != null}
                      onChange={(e) => setGiro({ ...giro, sentido: e.target.value as PlanoGiro['sentido'] })}>
                      <option value="crescente">Crescente (contagem sobe)</option>
                      <option value="decrescente">Decrescente (contagem desce)</option>
                    </select></div>
                  {giroInicio == null
                    ? <Button type="button" size="sm" disabled={!!erroGiro} onClick={() => setGiroInicio(Date.now())} data-testid="emu-giro-iniciar"><Play className="mr-1 h-3.5 w-3.5" />Iniciar</Button>
                    : <Button type="button" size="sm" variant="destructive" onClick={() => setGiroInicio(null)} data-testid="emu-giro-parar"><CircleStop className="mr-1 h-3.5 w-3.5" />Parar</Button>}
                </div>
                <p className={`mt-2 text-xs ${velGiro != null && velGiro > VELOCIDADE_MAX_GRAUS_S ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {erroGiro ?? `${grausDoGiro(planoGiro)}° em ${planoGiro.segundos} s = ${velGiro!.toFixed(1).replace('.', ',')}°/s · a posição muda a cada 1 s.`}
                  {velGiro != null && velGiro > VELOCIDADE_MAX_GRAUS_S && ` Acima de ${VELOCIDADE_MAX_GRAUS_S}°/s a TON (lê a cada 5 s) vê saltos de mais de 30° e não conta o giro — aumente o tempo.`}
                  {' '}Crescente: "Até" acima de 359 conta voltas (0 → 360 = uma volta, 0 → 720 = duas).
                  {' '}Continua com o modal fechado (a emulação precisa estar ligada).
                </p>
              </section>
            )}

            {/* 4. BI */}
            {pontosBi.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Entradas binárias (BI) — {pontosBi.length}</h3>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-3" data-testid="emu-bi">
                  {pontosBi.map((p) => (
                    <label key={p.pid} className="flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-sm">
                      <input type="checkbox" checked={!!bi[p.pid]} onChange={(e) => setBi({ ...bi, [p.pid]: e.target.checked })} />
                      <span className="truncate" title={`${p.pid} · func 0${p.func} · bit ${p.address}`}>{p.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* 5. Avisos */}
        {avisos.length > 0 && (
          <section className="space-y-1" data-testid="emu-avisos">
            {avisos.map((a, i) => (
              <p key={i} className={`flex items-start gap-1.5 text-xs ${a.nivel === 'erro' ? 'text-red-600' : a.nivel === 'aviso' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {a.nivel === 'erro' ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : a.nivel === 'aviso' ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {a.texto}
              </p>
            ))}
          </section>
        )}

        {/* 6. Emulação */}
        <section className="rounded-md border p-3" data-testid="emu-sessao">
          <div className="flex flex-wrap items-center gap-2">
            {!ativa ? (
              <Button type="button" onClick={iniciar} disabled={!serialOk || !podeSalvar || iniciando} data-testid="emu-iniciar">
                {iniciando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                Salvar, escolher porta e iniciar
              </Button>
            ) : (
              <Button type="button" variant="destructive" onClick={parar} data-testid="emu-parar"><CircleStop className="mr-1 h-4 w-4" />Parar emulação</Button>
            )}
            {sessao && (
              <span className="text-xs text-muted-foreground">
                <Plug className="mr-1 inline h-3.5 w-3.5" />{sessao.porta} · escravo {sessao.endereco} · leituras {sessao.leituras} · rx {sessao.rx} B · tx {sessao.tx} B
              </span>
            )}
          </div>
          {!serialOk && (
            <p className="mt-2 text-xs text-red-600">Este navegador não tem Web Serial. Use Chrome ou Edge no computador (não funciona em celular, Firefox ou Safari) e acesse por HTTPS.</p>
          )}
          {erroSerial && <p className="mt-2 text-xs text-red-600" data-testid="emu-erro-serial">{erroSerial}</p>}
          {sessao?.erro && <p className="mt-2 text-xs text-red-600">{sessao.erro}</p>}
          {ativa && !sessao?.ultimaLeitura && !semConsulta && <p className="mt-2 text-xs text-muted-foreground">Aguardando a primeira consulta da TON…</p>}
          {semConsulta && (
            <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400" data-testid="emu-sem-consulta">
              <p className="font-semibold">A TON não consultou o endereço {sessao?.endereco} nos últimos {Math.round(ALERTA_SEM_CONSULTA_MS / 1000)} s.</p>
              {outros.length > 0
                ? <p>Ela está consultando {outros.length === 1 ? 'o endereço' : 'os endereços'} {outros.join(', ')} — o firmware atual não tem este emulador ou o endereço está diferente. Gere o firmware e faça OTA, ou ajuste o endereço.</p>
                : <p>Nenhum tráfego da TON no fio: confira A/B (tente inverter), o GND, o adaptador e se a TON está ligada. Se o emulador é um equipamento novo no diagrama, a TON precisa de firmware novo (OTA).</p>}
            </div>
          )}
          {sessao && sessao.log.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded bg-black/90 p-2 font-mono text-[11px] leading-snug" data-testid="emu-log">
              {sessao.log.slice(-60).reverse().map((l, i) => (
                <div key={i} className={l.nivel === 'erro' ? 'text-red-400' : l.nivel === 'aviso' ? 'text-amber-300' : l.nivel === 'ok' ? 'text-green-400' : 'text-slate-300'}>
                  {new Date(l.ts).toLocaleTimeString()} {l.texto}
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">A emulação continua rodando com este modal fechado. Se o emulador é um equipamento novo no diagrama, a TON só passa a consultá-lo depois de gerar o firmware e fazer OTA.</p>
        </section>

        <DialogFooter className="gap-2">
          {nodeId && onAbrirPropriedades && (
            <Button type="button" variant="ghost" onClick={() => onAbrirPropriedades(nodeId)}>Propriedades avançadas</Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          <Button type="button" onClick={async () => { if (await salvar()) onClose(); }} disabled={!podeSalvar} data-testid="emu-salvar">
            {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar no diagrama
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
