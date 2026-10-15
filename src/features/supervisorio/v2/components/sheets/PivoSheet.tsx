import { useCallback, useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { useDados, getPath, fmt, tsInfo } from './sheetParts';
import {
  EquipShell, Pill, Card, SectionLabel, StatusLine, KpiCells, BigButton, Switch, FieldRow, Segmented,
  SubDialog, DialogButtons, CollapsibleChart, Registros, useCustos, linhasPosto, brl, unwrap, ACAO, type Tone, type RegistroExtra,
} from './equipUi';
import {
  IrrigacaoAvancada, CONFIG_PADRAO, arco, textoFaixas, tituloEnvio, resumoConfig, previsao,
  type ConfigIrrigacao, type EnvioIrrigacao, type FaixaCanhao,
} from './PivoIrrigacao';

/**
 * Modal do Pivô — mockup "Web — Modal do Pivô" (NEXON-5), sobre a operação em
 * SEQUÊNCIA com o bombeamento (docs/IOT-PIVO-BOMBEAMENTO.md): "Girar ←/→" faz o
 * backend ligar a bomba, confirmar, esperar a pressurização e só então girar;
 * "Desligar" para o pivô e desliga a bomba se nenhum outro pivô dela estiver girando.
 *
 * Operação: mapa, status, comando (com confirmação), última sequência, indicadores,
 * bombeamento, custo por posto, gráfico recolhível e registros.
 * Configuração: bombeamento, partida, bloqueio de ponta (/pivos/:id/config) e
 * programação de horários (/pivos/:id/programacoes), com revisão antes de gravar.
 * Ângulo, pressão e horímetro vêm da telemetria por melhor esforço ("—" sem leitura).
 */

type Bin = 0 | 1 | null;
type Acao = 'girar_direita' | 'girar_esquerda' | 'desligar';
interface Passo { t: string; etapa: string; msg: string; ok: boolean | null }
interface Bombeamento {
  ton_id: string; ton_nome: string | null; ton_removida: boolean; modo: 'pulso' | 'mantido';
  bo_liga: number; bo_desliga?: number | null; bi_confirma?: number | null; confirma_s?: number; pulso_ms?: number;
  ligada: Bin; compartilhada_com: string[];
}
interface Estado {
  pivo: { comandos: { direita: boolean; esquerda: boolean; desligar: boolean }; status: { direita: Bin; esquerda: Bin; desligado: Bin; erro: Bin } };
  bombeamento: null | Bombeamento;
  sequencia_cfg: { pressurizacao_s: number; confirma_giro_s: number };
  sequencia: null | { id: string; acao: string; status: string; passos: Passo[]; erro: string | null; created_at: string; finished_at: string | null };
}
interface Janela { ativo: boolean; inicio: string; fim: string; dias: number[] }
interface PivoConfig { bloqueio_ponta: Janela; reservado: Janela; origem_ponta: { numero_uc?: string; concessionaria?: string } | null }
interface Programacao {
  id: string; nome: string; ativo: boolean; hora_inicio: string; dias: number[]; modo: 'percurso' | 'tempo';
  duracao_min?: number | null; sentido: 'horario' | 'anti_horario'; velocidade?: number | null; com_agua?: boolean;
}
interface Opcoes {
  tons: Array<{ id: string; nome: string; topico: string | null; unidade: string }>;
  bombeamentos: Array<{ pivo_id: string; nome: string; bombeamento: Partial<Bombeamento> | null }>;
}

/** Resposta da API vem com envelope simples ou duplo ({data:{data}}). */
const corpo = <T,>(r: unknown): T => {
  const d = unwrap<Record<string, unknown>>(r);
  return (d && typeof d === 'object' && 'data' in d && Object.keys(d).length <= 3 ? d.data : d) as T;
};
const erroMsg = (e: unknown): string => {
  const x = e as { response?: { data?: { message?: string; data?: { message?: string } } }; message?: string };
  return x?.response?.data?.message ?? x?.response?.data?.data?.message ?? x?.message ?? 'Falha';
};
const ACAO_LABEL: Record<string, string> = { girar_direita: 'Girar à direita', girar_esquerda: 'Girar à esquerda', desligar: 'Desligar' };
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const diasTxt = (d: number[]) => {
  const s = [...d].sort((a, b) => a - b).join(',');
  if (s === '1,2,3,4,5') return 'Seg a sex';
  if (s === '1,2,3,4,5,6,7') return 'Todos os dias';
  if (s === '6,7') return 'Sáb e dom';
  return d.map((x) => DIAS[x - 1]).join(', ');
};

function usePivoEstado(id: string) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() =>
    api.get(`/pivos/${id}/estado`).then((r) => { setEstado(corpo<Estado>(r)); setErro(null); }).catch((e) => setErro(erroMsg(e))), [id]);
  const executando = estado?.sequencia?.status === 'executando';
  useEffect(() => {
    void carregar();
    const t = setInterval(carregar, executando ? 1500 : 10000);
    return () => clearInterval(t);
  }, [carregar, executando]);
  return { estado, erro, carregar, executando };
}

function MapaPivo({ angulo, girando, falha, sentido, faixas }: { angulo: number | null; girando: boolean; falha: boolean; sentido: string | null; faixas: FaixaCanhao[] }) {
  const cx = 179, cy = 150, r = 118;
  const pt = (a: number) => { const t = (a * Math.PI) / 180; return [cx + r * Math.sin(t), cy - r * Math.cos(t)]; };
  const a = angulo ?? 0;
  const [ax, ay] = pt(a);
  const a1 = sentido === 'esquerda' ? a - 47 : a + 47;
  const [p0, p1] = [pt(Math.min(a, a1)), pt(Math.max(a, a1))];
  const setor = `M${cx} ${cy} L${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Z`;
  const sentidoTxt = sentido === 'direita' ? 'Avanço' : sentido === 'esquerda' ? 'Reverso' : null;
  return (
    <div className="rounded-2xl overflow-hidden relative h-[300px] bg-[#26301F]">
      <svg viewBox="0 0 358 300" width="100%" height="300" preserveAspectRatio="xMidYMid slice" className="block" role="img" aria-label={angulo != null ? `Pivô, ângulo atual ${fmt(angulo, 1)} graus` : 'Pivô, ângulo não informado'}>
        <rect x="0" y="0" width="358" height="300" fill="#2B3523" />
        <path d="M0 230 C60 210 90 270 150 300 L0 300 Z" fill="#1F2A1A" />
        <path d="M250 0 C270 40 320 50 358 40 L358 0 Z" fill="#5A4E35" opacity="0.6" />
        <circle cx="-10" cy="50" r="90" fill="#3A4730" />
        <circle cx="365" cy="230" r="100" fill="#3E4B33" />
        <circle cx={cx} cy={cy} r={r} fill="#5B5A3C" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        {(girando || falha) && angulo != null && <path d={setor} fill={falha ? 'rgba(229,88,79,0.45)' : 'rgba(114,191,74,0.5)'} />}
        {faixas.map((f) => <path key={f.id} d={arco(cx, cy, r + 7, f.liga, ((f.desliga - f.liga) % 360 + 360) % 360)} fill="none" stroke="#70C04B" strokeWidth="3" strokeLinecap="round" />)}
        {angulo != null && <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />}
        <circle cx={cx} cy={cy} r="4" fill="#FFFFFF" />
        <path d="M173 22 L185 22 L179 32 Z" fill="#FFFFFF" />
      </svg>
      <div className="absolute top-3 left-3 h-[30px] px-3 rounded-full bg-[rgba(14,14,34,0.75)] text-white flex items-center text-[13px] font-bold">
        {angulo != null ? `${fmt(angulo, 1)}°` : 'Ângulo —'}{sentidoTxt ? ` · ${sentidoTxt}` : ''}
      </div>
    </div>
  );
}

export function PivoSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const id = equipamentoId.trim();
  const { dados, ts } = useDados(id);
  const { estado, erro, carregar, executando } = usePivoEstado(id);
  const [aba, setAba] = useState('op');
  const [modal, setModal] = useState<null | 'cost' | 'ligar' | 'desligar' | 'irr' | 'envio'>(null);
  const [envio, setEnvio] = useState<EnvioIrrigacao | null>(null);
  // Última irrigação enviada por este navegador (a TON só recebe direção e liga/desliga).
  const chaveUltima = `nexon:pivo:ultima:${id}`;
  const [ultima, setUltima] = useState<ConfigIrrigacao>(() => {
    try { const v = localStorage.getItem(chaveUltima); return v ? { ...CONFIG_PADRAO, ...JSON.parse(v) } : CONFIG_PADRAO; } catch { return CONFIG_PADRAO; }
  });
  const [ponta, setPonta] = useState<Janela | null>(null);
  useEffect(() => {
    api.get(`/pivos/${id}/config`).then((r) => setPonta(corpo<PivoConfig>(r)?.bloqueio_ponta ?? null)).catch(() => setPonta(null));
  }, [id]);
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [custoPer, setCustoPer] = useState<'dia' | 'mes'>('dia');

  const g = (p: string) => getPath(dados, p);
  const num = (...ps: string[]) => { for (const p of ps) { const v = g(p); if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v); } return null; };
  const info = tsInfo(ts);
  const ptW = num('Pt', 'power.active_total');
  const ptKw = ptW == null ? null : Math.abs(ptW) > 1000 ? ptW / 1000 : ptW;

  const st = estado?.pivo.status;
  const b = estado?.bombeamento ?? null;
  const seq = estado?.sequencia ?? null;
  const girando = st?.direita === 1 || st?.esquerda === 1;
  const sentido = st?.direita === 1 ? 'direita' : st?.esquerda === 1 ? 'esquerda' : null;
  const angulo = num('angulo', 'posicao');

  const { tone, label, texto } = ((): { tone: Tone; label: string; texto: string } => {
    if (executando) return { tone: 'warn', label: 'Alerta', texto: seq?.acao === 'desligar' ? 'Desligando…' : 'Partindo · bomba e pressurização' };
    if (st?.erro === 1) return { tone: 'bad', label: 'Falha', texto: 'Erro no painel do pivô · Parado' };
    if (girando) return { tone: 'ok', label: 'Normal', texto: `Girando à ${sentido}${b ? ` · bomba ${b.ligada === 1 ? 'ligada' : b.ligada === 0 ? 'desligada' : '—'}` : ''}` };
    if (st?.desligado === 1 || st?.direita === 0 || st?.esquerda === 0) return { tone: 'ok', label: 'Normal', texto: 'Parado' };
    if (!estado && !info.online) return { tone: 'off', label: 'Sem comunicação', texto: info.hasTs ? `Última leitura ${info.idade}` : 'Sem leitura' };
    return { tone: 'off', label: 'Sem status', texto: 'Status do pivô não lido da TON' };
  })();

  const acionar = async (acao: Acao, irrigacao?: EnvioIrrigacao) => {
    setEnviando(acao);
    try {
      await api.post(`/pivos/${id}/acionar`, irrigacao ? { acao, irrigacao } : { acao });
      if (irrigacao) {
        setUltima(irrigacao.config);
        try { localStorage.setItem(chaveUltima, JSON.stringify(irrigacao.config)); } catch { /* sem storage */ }
      }
      toast.success(`${ACAO_LABEL[acao]}: sequência iniciada`, { description: b ? 'Bomba, pressurização e giro — acompanhe em Registros.' : undefined });
      setModal(null); setEnvio(null);
      await carregar();
    } catch (e) {
      toast.error(`${ACAO_LABEL[acao]}: não iniciou`, { description: erroMsg(e) });
    } finally {
      setEnviando(null);
    }
  };
  const acaoDe = (c: ConfigIrrigacao): Acao => (c.direcao === 'Avanço' ? 'girar_direita' : 'girar_esquerda');

  const media = (...ks: string[]) => { const v = ks.map((k) => num(k)).filter((x): x is number => x != null); return v.length ? v.reduce((a, c) => a + c, 0) / v.length : null; };
  const tensao = media('Vab', 'Vbc', 'Vca') ?? media('Va', 'Vb', 'Vc');
  const corrente = media('Ia', 'Ib', 'Ic');
  const kpis = [
    { k: 'Ângulo', v: angulo != null ? `${fmt(angulo, 1)}°` : '—' },
    { k: 'Pressão', v: num('pressao') != null ? `${fmt(num('pressao'), 1)} bar` : '—' },
    { k: 'Tensão', v: tensao != null ? `${fmt(tensao, 0)} V` : '—' },
    { k: 'Potência total', v: ptKw != null ? `${fmt(ptKw, 1)} kW` : '—' },
    { k: 'Corrente pivô', v: corrente != null ? `${fmt(corrente, 1)} A` : '—' },
    { k: 'Horímetro', v: num('horimetro') != null ? `${fmt(num('horimetro'), 0)} h` : '—' },
  ];
  const fases: Array<[string, string, string]> = (['a', 'b', 'c'] as const).map((f) => {
    const ff = { a: 'Vab', b: 'Vbc', c: 'Vca' }[f], fn = `V${f}`;
    const v = num(ff) ?? num(fn), i = num(`I${f}`);
    return [num(ff) != null ? ff.slice(1).toUpperCase() : f.toUpperCase(), v != null ? `${fmt(v, 0)} V` : '—', i != null ? `${fmt(i, 1)} A` : '—'];
  });

  const bNum = (...ks: string[]) => num(...ks.map((k) => `bomba.${k}`), ...ks.map((k) => `bomba_${k}`));
  const bKpis = [
    { k: 'Pressão recalque', v: bNum('pressao') != null ? `${fmt(bNum('pressao'), 1)} bar` : '—' },
    { k: 'Potência', v: bNum('Pt', 'potencia') != null ? `${fmt(bNum('Pt', 'potencia'), 1)} kW` : '—' },
    { k: 'FP', v: bNum('FPt', 'fp') != null ? fmt(bNum('FPt', 'fp'), 2) : '—' },
    { k: 'Temp. motor', v: bNum('temperatura') != null ? `${fmt(bNum('temperatura'), 0)} °C` : '—' },
    { k: 'Horímetro', v: bNum('horimetro') != null ? `${fmt(bNum('horimetro'), 0)} h` : '—' },
    { k: 'Partidas', v: bNum('partidas') != null ? fmt(bNum('partidas'), 0) : '—' },
  ];
  // Passos da última sequência entram em Registros (✓✓ = confirmado pelo equipamento).
  const regSeq: RegistroExtra[] = (seq?.passos ?? []).map((p) => ({
    t: new Date(p.t).getTime(), txt: p.msg, quem: p.etapa === 'comando' ? 'Comando' : 'Sistema', ok: p.ok === true, ruim: p.ok === false,
  }));

  const { res: custoDia } = useCustos(id, 'dia');
  const { res: custoSel } = useCustos(id, custoPer, undefined, modal === 'cost');
  const pressS = estado?.sequencia_cfg.pressurizacao_s ?? 120;

  return (
    <EquipShell
      title={nome || 'Pivô'}
      subtitle={info.hasTs ? info.label : 'Sem leitura de energia'}
      right={<Pill tone={tone}>{label}</Pill>}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'op' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-3">
              <MapaPivo angulo={angulo} girando={girando} falha={st?.erro === 1} sentido={sentido} faixas={ultima.canhao ? ultima.faixasCanhao : []} />
              <StatusLine tone={tone} label={label} text={texto} extra={erro ? <span className="text-amber-600 dark:text-amber-400">{erro}</span> : girando ? `${resumoConfig(ultima)}${ultima.canhao ? ' · canhão ligado' : ''}` : undefined} />
              {girando || executando ? (
                <BigButton variant="outline" disabled={!!enviando || (!estado?.pivo.comandos.desligar && !b)} onClick={() => setModal('desligar')}>
                  {enviando === 'desligar' ? 'Executando…' : 'Desligar'}
                </BigButton>
              ) : (
                <BigButton disabled={!!enviando || !estado?.pivo.comandos[ultima.direcao === 'Avanço' ? 'direita' : 'esquerda']} onClick={() => setModal('ligar')}>
                  {enviando ? 'Executando…' : 'Ligar'}
                </BigButton>
              )}
              <button type="button" onClick={() => setModal('irr')} disabled={girando || executando}
                className="self-center h-11 px-2.5 flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-50">
                <SlidersHorizontal className="w-4 h-4" /> Irrigação avançada
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <Card className="py-3.5"><KpiCells items={kpis} cols={3} /></Card>
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[15px] font-extrabold">Bombeamento</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {!b ? 'Não configurado' : `${b.ton_nome ?? 'TON'}${b.ton_removida ? ' (removida!)' : ''} · ${b.compartilhada_com.length ? 'sistema conjugado' : 'ligada junto com o pivô'}`}
                    </span>
                  </span>
                  <span className={`text-[13px] font-extrabold ${b?.ligada === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {!b ? '—' : b.ligada === 1 ? 'Ligada' : b.ligada === 0 ? 'Desligada' : 'Sem retorno'}
                  </span>
                </div>
                <div className="py-3"><KpiCells items={bKpis} cols={3} size="sm" /></div>
                <div className="border-t px-4">
                  <div className="grid grid-cols-3 text-[11px] font-bold text-muted-foreground py-2 tracking-[0.4px]">
                    <span>FASE</span><span className="text-right">TENSÃO</span><span className="text-right">CORRENTE</span>
                  </div>
                  {fases.map((f) => (
                    <div key={f[0]} className="grid grid-cols-3 text-sm py-[7px] border-t border-border">
                      <span>{f[0]}</span><span className="text-right font-bold tabular-nums">{f[1]}</span><span className="text-right font-bold tabular-nums">{f[2]}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <button type="button" onClick={() => setModal('cost')} className="w-full bg-white dark:bg-[#161633] border rounded-[14px] grid grid-cols-3 items-center min-h-[76px] text-left hover:bg-black/[0.03] dark:hover:bg-white/5">
            <span className="flex flex-col gap-0.5 px-5 min-w-0">
              <span className="text-[13px] text-muted-foreground whitespace-nowrap">Custo hoje</span>
              <span className="text-[22px] font-extrabold tabular-nums whitespace-nowrap">{brl(custoDia?.custos.custo_total)}</span>
            </span>
            <span className="flex flex-col gap-0.5 px-5 border-l border-border min-w-0">
              <span className="text-[13px] text-muted-foreground whitespace-nowrap">Energia do pivô</span>
              <span className="text-[22px] font-extrabold tabular-nums whitespace-nowrap">{custoDia ? `${fmt(custoDia.consumo.energia_total_kwh, 0)} kWh` : '—'}</span>
            </span>
            <span className="flex items-center justify-between gap-2 px-5 border-l border-border h-11 text-sm font-extrabold text-[#177A3C] dark:text-emerald-400 whitespace-nowrap">
              <span>Custos por horário</span><span>›</span>
            </span>
          </button>

          <CollapsibleChart
            equipamentoId={id}
            title="Gráfico de potência"
            summary={ptKw != null ? `${fmt(ptKw, 1)} kW agora` : undefined}
            series={[{ label: 'Total', color: '#177A3C', pick: (d) => { const v = Number(d?.Pt ?? d?.['power.active_total']); return Number.isFinite(v) ? (Math.abs(v) > 1000 ? v / 1000 : v) : null; } }]}
          />

          <Registros equipamentoId={id} extra={regSeq} />
        </div>
      ) : (
        <ConfigPivo pivoId={id} estado={estado} onSalvo={carregar} />
      )}

      <SubDialog open={modal === 'ligar' || modal === 'desligar'} onClose={() => setModal(null)} width={400}
        title={modal === 'desligar' ? `Desligar ${nome || 'pivô'}?` : `Ligar ${nome || 'pivô'}?`}>
        <p className="text-sm text-muted-foreground">
          {modal === 'desligar'
            ? `O pivô para na posição atual (${angulo != null ? `${fmt(angulo, 1)}°` : '—'}).${b ? ' A bomba desliga se nenhum outro pivô dela estiver girando.' : ''}`
            : `Com a última configuração: ${resumoConfig(ultima)} · sem parada.${b ? ` A bomba liga e o pivô gira após ${pressS}s de pressurização.` : ''}`}
        </p>
        <DialogButtons onCancel={() => setModal(null)} busy={!!enviando}
          onConfirm={() => (modal === 'desligar' ? acionar('desligar') : acionar(acaoDe(ultima), { modo: 'simples', config: ultima, parada: { tipo: 'semParar' }, inicio: null }))} />
      </SubDialog>

      <SubDialog open={modal === 'irr'} onClose={() => setModal(null)} title="Irrigação avançada" width={560}
        subtitle={`${nome || 'Pivô'} · ângulo atual ${angulo != null ? `${fmt(angulo, 1)}°` : '—'}`}>
        <IrrigacaoAvancada
          nome={nome || 'Pivô'} angulo={angulo} ultima={ultima} lamina100={7.15} tempoVolta100={21} ponta={ponta}
          agenda={<AgendaPivo pivoId={id} />} enviando={!!enviando}
          onEnviar={(e) => { setEnvio(e); setModal('envio'); }}
        />
      </SubDialog>

      <SubDialog open={modal === 'envio' && !!envio} onClose={() => setModal('irr')} width={420} title={envio ? tituloEnvio(envio.modo) : ''}>
        {envio && (
          <>
            <p className="text-sm text-muted-foreground">
              {resumoConfig({ ...envio.config })} · {previsao(envio.config, envio.parada, envio.config.direcao, angulo ?? 0, 21, envio.inicio ?? new Date()).texto}
              {envio.inicio ? ` · início ${envio.inicio.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
            {envio.config.canhao && <p className="text-sm text-muted-foreground">{textoFaixas(envio.config.faixasCanhao)}</p>}
            <DialogButtons onCancel={() => setModal('irr')} busy={!!enviando} onConfirm={() => acionar(acaoDe(envio.config), envio)} />
          </>
        )}
      </SubDialog>

      <SubDialog open={modal === 'cost'} onClose={() => setModal(null)} title="Custos por horário" width={520} subtitle={`${nome || 'Pivô'} · tarifa com impostos`}>
        <Segmented value={custoPer} onChange={setCustoPer} options={[{ v: 'dia', label: 'Hoje' }, { v: 'mes', label: 'Mês' }]} />
        {!custoSel ? (
          <p className="text-sm text-muted-foreground py-4">Sem custo calculado para o período (confira a unidade e a tarifa do equipamento).</p>
        ) : (
          <>
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-[11px] font-bold text-muted-foreground tracking-[0.4px] py-1">
              <span>POSTO</span><span className="text-right">kWh</span><span className="text-right">R$/kWh</span><span className="text-right">R$</span>
            </div>
            {linhasPosto(custoSel).map((r) => (
              <div key={r.k} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-sm py-2 border-t border-border">
                <span className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-[3px] ${r.cor}`} />{r.k}</span>
                <span className="text-right tabular-nums">{fmt(r.kwh, 0)}</span>
                <span className="text-right tabular-nums">{r.tarifa != null ? fmt(r.tarifa, 2) : '—'}</span>
                <span className="text-right font-extrabold tabular-nums">{brl(r.rs)}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-sm py-2 border-t border-border text-muted-foreground">
              <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#8A8FA3]" />Demanda</span>
              <span className="text-right">—</span><span className="text-right">—</span>
              <span className="text-right">{custoPer === 'dia' ? 'a apurar' : brl(custoSel.custos.custo_demanda)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold border-t-2 border-foreground pt-2.5">
              <span>Total</span><span>{brl(custoSel.custos.custo_total)}</span>
            </div>
            <div className="text-[13px] text-muted-foreground">{fmt(custoSel.consumo.energia_total_kwh, 0)} kWh · {custoSel.tarifa_fonte === 'PERSONALIZADA' ? 'tarifa personalizada' : 'tarifa da concessionária'}</div>
          </>
        )}
        <button type="button" onClick={() => setModal(null)} className={`h-11 rounded-xl font-extrabold ${ACAO}`}>Fechar</button>
      </SubDialog>
    </EquipShell>
  );
}

// ---------------------------------------------------------------------------
// Configuração: bombeamento + partida + ponta + programação
// ---------------------------------------------------------------------------
interface FormBomba { ton_id: string; modo: 'pulso' | 'mantido'; bo_liga: string; bo_desliga: string; bi_confirma: string; confirma_s: string; pulso_ms: string }
const formDe = (o?: Partial<Bombeamento> | null): FormBomba => ({
  ton_id: o?.ton_id ?? '', modo: o?.modo ?? 'pulso', bo_liga: String(o?.bo_liga ?? 1), bo_desliga: String(o?.bo_desliga ?? ''),
  bi_confirma: String(o?.bi_confirma ?? ''), confirma_s: String(o?.confirma_s ?? 30), pulso_ms: String(o?.pulso_ms ?? 1000),
});
const inputCls = 'w-[84px] h-[38px] rounded-[10px] border bg-background text-[15px] font-extrabold text-right px-2.5 tabular-nums';
const selectCls = 'h-[38px] max-w-[15rem] rounded-[10px] border bg-background px-2.5 text-sm font-bold';

function ConfigPivo({ pivoId, estado, onSalvo }: { pivoId: string; estado: Estado | null; onSalvo: () => void }) {
  const [op, setOp] = useState<Opcoes | null>(null);
  const [cfg, setCfg] = useState<PivoConfig | null>(null);
  // Base (gravado) × rascunho
  const [base, setBase] = useState<{ ativo: boolean; f: FormBomba; seq: { pressurizacao_s: number; confirma_giro_s: number } } | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [f, setF] = useState<FormBomba>(formDe());
  const [seq, setSeq] = useState({ pressurizacao_s: '120', confirma_giro_s: '30' });
  const [ponta, setPonta] = useState<Janela | null>(null);
  const [revisar, setRevisar] = useState(false);
  const [gravando, setGravando] = useState(false);

  const carregarCfg = useCallback(() => {
    api.get(`/pivos/${pivoId}/config`).then((r) => { const c = corpo<PivoConfig>(r); setCfg(c); setPonta(c?.bloqueio_ponta ?? null); }).catch(() => setCfg(null));
  }, [pivoId]);
  useEffect(() => {
    api.get(`/pivos/${pivoId}/bombeamento/opcoes`).then((r) => setOp(corpo<Opcoes>(r))).catch(() => setOp({ tons: [], bombeamentos: [] }));
    carregarCfg();
  }, [pivoId, carregarCfg]);
  useEffect(() => {
    if (!estado || base) return;
    const b = estado.bombeamento;
    const fb = formDe(b);
    setBase({ ativo: !!b, f: fb, seq: estado.sequencia_cfg });
    setAtivo(!!b); setF(fb);
    setSeq({ pressurizacao_s: String(estado.sequencia_cfg.pressurizacao_s), confirma_giro_s: String(estado.sequencia_cfg.confirma_giro_s) });
  }, [estado, base]);

  const set = (k: keyof FormBomba, v: string) => setF((x) => ({ ...x, [k]: v }));
  const copiarDe = (pid: string) => {
    const o = op?.bombeamentos.find((x) => x.pivo_id === pid)?.bombeamento;
    if (!o) return;
    setAtivo(true); setF(formDe(o));
    toast.info('Bomba do outro pivô copiada — os dois vão dividir a bomba (um por vez). Revise e salve.');
  };

  const tonNome = (tid: string) => op?.tons.find((t) => t.id === tid)?.nome ?? (tid || '—');
  const mudancas = useMemo(() => {
    if (!base) return [];
    const out: Array<{ label: string; de: string; para: string }> = [];
    const add = (label: string, de: string, para: string) => { if (de !== para) out.push({ label, de, para }); };
    add('Bombeamento', base.ativo ? 'Sim' : 'Não', ativo ? 'Sim' : 'Não');
    if (ativo) {
      add('TON da bomba', base.ativo ? tonNome(base.f.ton_id) : '—', tonNome(f.ton_id));
      add('Acionamento', base.ativo ? base.f.modo : '—', f.modo);
      add('BO de ligar', base.ativo ? base.f.bo_liga : '—', f.bo_liga);
      if (f.modo === 'pulso') { add('BO de desligar', base.f.bo_desliga || '—', f.bo_desliga || '—'); add('Pulso (ms)', base.f.pulso_ms, f.pulso_ms); }
      add('BI de confirmação', base.f.bi_confirma || '—', f.bi_confirma || '—');
      add('Tempo para confirmar a bomba (s)', base.f.confirma_s, f.confirma_s);
    }
    add('Tempo para pressurizar (s)', String(base.seq.pressurizacao_s), seq.pressurizacao_s);
    add('Confirmação do giro (s)', String(base.seq.confirma_giro_s), seq.confirma_giro_s);
    if (cfg && ponta) {
      const a = cfg.bloqueio_ponta;
      add('Bloquear no horário de ponta', a.ativo ? 'Sim' : 'Não', ponta.ativo ? 'Sim' : 'Não');
      add('Ponta · início', a.inicio, ponta.inicio);
      add('Ponta · fim', a.fim, ponta.fim);
    }
    return out;
  }, [base, ativo, f, seq, cfg, ponta]); // eslint-disable-line react-hooks/exhaustive-deps

  const numOk = (v: string, min: number, max: number) => { const n = Number(v); return v !== '' && Number.isFinite(n) && n >= min && n <= max; };
  const invalido = !numOk(seq.pressurizacao_s, 0, 900) || !numOk(seq.confirma_giro_s, 5, 300)
    || (ativo && (!f.ton_id || !numOk(f.bo_liga, 1, 16) || !numOk(f.confirma_s, 5, 300)
      || (f.modo === 'pulso' && (!numOk(f.bo_desliga, 1, 16) || !numOk(f.pulso_ms, 100, 10000)))
      || (f.bi_confirma !== '' && !numOk(f.bi_confirma, 1, 16))))
    || (!!ponta && !(/^\d{2}:\d{2}$/.test(ponta.inicio) && /^\d{2}:\d{2}$/.test(ponta.fim)));

  const gravar = async () => {
    setGravando(true);
    try {
      const bombaMudou = mudancas.some((m) => !m.label.startsWith('Ponta') && m.label !== 'Bloquear no horário de ponta');
      if (bombaMudou) {
        await api.put(`/pivos/${pivoId}/bombeamento`, {
          bombeamento: ativo ? {
            ton_id: f.ton_id, modo: f.modo, bo_liga: Number(f.bo_liga),
            bo_desliga: f.bo_desliga === '' ? null : Number(f.bo_desliga),
            bi_confirma: f.bi_confirma === '' ? null : Number(f.bi_confirma),
            confirma_s: Number(f.confirma_s), pulso_ms: Number(f.pulso_ms), ativo: true,
          } : null,
          sequencia: { pressurizacao_s: Number(seq.pressurizacao_s), confirma_giro_s: Number(seq.confirma_giro_s) },
        });
      }
      const pontaMudou = cfg && ponta && (cfg.bloqueio_ponta.ativo !== ponta.ativo || cfg.bloqueio_ponta.inicio !== ponta.inicio || cfg.bloqueio_ponta.fim !== ponta.fim);
      if (pontaMudou) await api.put(`/pivos/${pivoId}/config`, { bloqueio_ponta: ponta });
      toast.success('Configuração do pivô salva');
      // O gravado passa a ser o rascunho (não espera o refresh do estado).
      setBase({ ativo, f, seq: { pressurizacao_s: Number(seq.pressurizacao_s), confirma_giro_s: Number(seq.confirma_giro_s) } });
      setRevisar(false); onSalvo(); carregarCfg();
    } catch (e) {
      toast.error('Não salvou', { description: erroMsg(e) });
    } finally {
      setGravando(false);
    }
  };


  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel className="mt-1">Bombeamento</SectionLabel>
      <Card className="px-4">
        <FieldRow first label="Este pivô tem bombeamento" sub="Ligar o pivô com água liga a bomba; desligar o pivô desliga a bomba">
          <Switch on={ativo} onChange={() => setAtivo((v) => !v)} label="Este pivô tem bombeamento" />
        </FieldRow>
        {ativo && (
          <>
            <FieldRow label="Bomba" sub="TON que comanda a bomba">
              <select className={selectCls} value={f.ton_id} onChange={(e) => set('ton_id', e.target.value)}>
                <option value="">Escolha a TON…</option>
                {(op?.tons ?? []).map((t) => <option key={t.id} value={t.id}>{t.nome} · {t.unidade}</option>)}
              </select>
            </FieldRow>
            {op && op.bombeamentos.length > 0 && (
              <FieldRow label="Sistema conjugado" sub="Usar a bomba de outro pivô · um pivô por vez">
                <select className={selectCls} value="" onChange={(e) => copiarDe(e.target.value)}>
                  <option value="">—</option>
                  {op.bombeamentos.map((x) => <option key={x.pivo_id} value={x.pivo_id}>{x.nome}</option>)}
                </select>
              </FieldRow>
            )}
            <FieldRow label="Acionamento" sub={f.modo === 'pulso' ? 'Pulso liga, outro pulso desliga (selo/soft-starter)' : 'A TON segura o relé; soltar desliga'}>
              <Segmented value={f.modo} onChange={(v) => set('modo', v)} options={[{ v: 'pulso', label: 'Pulso' }, { v: 'mantido', label: 'Contato mantido' }]} />
            </FieldRow>
            <FieldRow label="BO de ligar"><input className={inputCls} inputMode="numeric" value={f.bo_liga} onChange={(e) => set('bo_liga', e.target.value)} /></FieldRow>
            {f.modo === 'pulso' && (
              <>
                <FieldRow label="BO de desligar"><input className={inputCls} inputMode="numeric" value={f.bo_desliga} onChange={(e) => set('bo_desliga', e.target.value)} /></FieldRow>
                <FieldRow label="Duração do pulso" sub="100 a 10.000 ms"><input className={inputCls} inputMode="numeric" value={f.pulso_ms} onChange={(e) => set('pulso_ms', e.target.value)} /></FieldRow>
              </>
            )}
            <FieldRow label="BI de confirmação" sub="Retorno 'bomba ligada' (vazio = sem confirmação)"><input className={inputCls} inputMode="numeric" value={f.bi_confirma} onChange={(e) => set('bi_confirma', e.target.value)} /></FieldRow>
            <FieldRow label="Tempo para confirmar a bomba" sub="5 a 300 s"><input className={inputCls} inputMode="numeric" value={f.confirma_s} onChange={(e) => set('confirma_s', e.target.value)} /></FieldRow>
          </>
        )}
      </Card>

      <SectionLabel className="mt-2.5">Partida e irrigação</SectionLabel>
      {([
        ['pressurizacao_s', 'Tempo para pressurizar', 'Espera entre a bomba ligar e o pivô girar · faixa 0 a 900 s', 0, 900],
        ['confirma_giro_s', 'Confirmação do giro', 'Tempo para o status "girando" aparecer · faixa 5 a 300 s', 5, 300],
      ] as const).map(([k, lbl, hint, mn, mx]) => {
        const ok = numOk(seq[k], mn, mx);
        return (
          <Card key={k} className="px-4 py-2.5 flex items-center gap-3">
            <label htmlFor={`pv-${k}`} className="flex-1 flex flex-col gap-0.5">
              <span className="text-[15px] font-bold">{lbl}</span>
              <span className={`text-xs ${ok ? 'text-muted-foreground' : 'text-red-600'}`}>{hint}</span>
            </label>
            <input id={`pv-${k}`} inputMode="numeric" value={seq[k]} onChange={(e) => setSeq((s) => ({ ...s, [k]: e.target.value }))} className={`${inputCls} ${ok ? '' : 'border-red-600'}`} />
            <span className="text-sm text-muted-foreground w-7">s</span>
          </Card>
        );
      })}

      <SectionLabel className="mt-2.5">Horário de ponta</SectionLabel>
      <Card className="px-4">
        <FieldRow first label="Bloquear no horário de ponta" sub="Pausa a irrigação e retoma ao fim da ponta">
          <Switch on={!!ponta?.ativo} disabled={!ponta} onChange={() => setPonta((p) => (p ? { ...p, ativo: !p.ativo } : p))} label="Bloquear no horário de ponta" />
        </FieldRow>
        <div className="border-t border-border py-3 flex gap-3">
          {(['inicio', 'fim'] as const).map((k) => (
            <label key={k} className="flex-1 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{k === 'inicio' ? 'Início' : 'Fim'}</span>
              <input type="time" disabled={!ponta} value={ponta?.[k] ?? ''} onChange={(e) => setPonta((p) => (p ? { ...p, [k]: e.target.value } : p))} className="h-[38px] rounded-[10px] border px-2.5 text-[15px] font-bold bg-background" />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pb-3">
          {ponta ? `${diasTxt(ponta.dias)}${cfg?.origem_ponta?.concessionaria ? ` · ${cfg.origem_ponta.concessionaria}` : ''}` : 'Configuração do pivô indisponível.'}
        </p>
      </Card>

      <AgendaPivo pivoId={pivoId} titulo />

      <button
        type="button"
        disabled={invalido || mudancas.length === 0}
        onClick={() => setRevisar(true)}
        className={`h-[50px] rounded-xl mt-2.5 text-base font-extrabold text-white ${invalido || mudancas.length === 0 ? 'bg-[#8DBA9A] dark:bg-white/10 dark:text-muted-foreground' : ACAO}`}
      >
        {invalido ? 'Valor fora da faixa' : mudancas.length === 0 ? 'Salvar' : `Revisar ${mudancas.length} ${mudancas.length > 1 ? 'alterações' : 'alteração'}`}
      </button>
      <p className="text-xs text-muted-foreground mt-1.5">
        Os comandos do pivô (girar à direita/esquerda, desligar) e os status (girando, desligado, erro) vêm dos pontos do pivô ligados às BO/BI da TON do pivô (editor IoT → TON → Configurar BOs/BIs).
      </p>

      <SubDialog open={revisar} onClose={() => setRevisar(false)} title="Confirmar alterações" width={440}>
        {mudancas.map((c) => (
          <div key={c.label} className="flex justify-between gap-3 text-[15px] py-1.5 border-b border-border">
            <span>{c.label}</span><span className="text-right"><span className="text-muted-foreground">{c.de}</span> → <b>{c.para}</b></span>
          </div>
        ))}
        <DialogButtons onCancel={() => setRevisar(false)} onConfirm={gravar} cancelLabel="Voltar" busy={gravando} />
      </SubDialog>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Agenda / Programação de horários (mesma lista no painel e na Configuração)
// ---------------------------------------------------------------------------
const GRUPOS_DIAS: Array<{ v: string; label: string; dias: number[] }> = [
  { v: 'uteis', label: 'Seg a sex', dias: [1, 2, 3, 4, 5] },
  { v: 'todos', label: 'Todos os dias', dias: [1, 2, 3, 4, 5, 6, 7] },
  { v: 'fds', label: 'Sáb e dom', dias: [6, 7] },
];
const fimDe = (ini: string, min?: number | null) => {
  if (!min) return null;
  const [h, m] = ini.split(':').map(Number);
  const t = (h * 60 + m + min) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function AgendaPivo({ pivoId, titulo }: { pivoId: string; titulo?: boolean }) {
  const [progs, setProgs] = useState<Programacao[] | null>(null);
  const [nova, setNova] = useState<null | { grupo: string; ini: string; fim: string; direcao: 'Avanço' | 'Reverso'; seco: boolean; pct: number }>(null);
  const [salvando, setSalvando] = useState(false);
  const carregar = useCallback(() => {
    api.get(`/pivos/${pivoId}/programacoes`).then((r) => setProgs(corpo<Programacao[]>(r) ?? [])).catch(() => setProgs([]));
  }, [pivoId]);
  useEffect(() => { carregar(); }, [carregar]);
  const n = progs?.length ?? 0;
  const remover = async (pid: string) => {
    try { await api.delete(`/pivos/${pivoId}/programacoes/${pid}`); carregar(); }
    catch (e) { toast.error('Não removeu', { description: erroMsg(e) }); }
  };
  const adicionar = async () => {
    if (!nova) return;
    const g = GRUPOS_DIAS.find((x) => x.v === nova.grupo)!;
    const [h0, m0] = nova.ini.split(':').map(Number), [h1, m1] = nova.fim.split(':').map(Number);
    const dur = ((h1 * 60 + m1) - (h0 * 60 + m0) + 1440) % 1440 || 1440;
    setSalvando(true);
    try {
      await api.post(`/pivos/${pivoId}/programacoes`, {
        nome: `${g.label} · ${nova.ini} → ${nova.fim}`, ativo: true, hora_inicio: nova.ini, dias: g.dias, modo: 'tempo',
        duracao_min: dur, sentido: nova.direcao === 'Avanço' ? 'horario' : 'anti_horario',
        velocidade: nova.seco ? null : nova.pct, com_agua: !nova.seco,
      });
      setNova(null); carregar(); toast.success('Agendamento salvo');
    } catch (e) { toast.error('Não salvou', { description: erroMsg(e) }); } finally { setSalvando(false); }
  };
  return (
    <div className="flex flex-col gap-2.5">
      {titulo && <SectionLabel className="mt-2.5">Programação de horários · {n}/5</SectionLabel>}
      {progs == null && <div className="text-sm text-muted-foreground">Carregando…</div>}
      {progs?.length === 0 && !titulo && <div className="text-sm text-muted-foreground">Nenhum horário programado.</div>}
      {(progs ?? []).map((p) => {
        const fim = fimDe(p.hora_inicio, p.duracao_min);
        const dir = p.sentido === 'horario' ? 'Avanço' : 'Reverso';
        return (
          <Card key={p.id} className="px-4 min-h-[60px] flex items-center gap-3">
            <span className="flex-1 flex flex-col gap-0.5 py-2">
              <span className="text-sm font-bold">{diasTxt(p.dias)} · {p.hora_inicio}{fim ? ` → ${fim}` : ''}</span>
              <span className="text-xs text-muted-foreground">{p.com_agua === false ? `— · Seco · ${dir}` : `${p.velocidade != null ? `${fmt(p.velocidade, 0)}%` : '—'} · Molhado · ${dir}`}{p.ativo ? '' : ' · pausado'}</span>
            </span>
            <button type="button" onClick={() => remover(p.id)} aria-label="Remover horário" className="w-9 h-9 rounded-[10px] grid place-items-center text-red-600 hover:bg-red-500/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
          </Card>
        );
      })}
      {nova ? (
        <Card className="p-4 flex flex-col gap-3">
          <span className="text-[15px] font-extrabold">Novo horário</span>
          <Segmented value={nova.grupo} onChange={(v) => setNova({ ...nova, grupo: v })} options={GRUPOS_DIAS.map((g) => ({ v: g.v, label: g.label }))} />
          <div className="grid grid-cols-2 gap-2.5">
            {(['ini', 'fim'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{k === 'ini' ? 'Início' : 'Fim'}</span>
                <input type="time" value={nova[k]} onChange={(e) => setNova({ ...nova, [k]: e.target.value })} className="h-[38px] rounded-[10px] border px-2.5 text-[15px] font-bold bg-background" />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Direção</span>
            <Segmented value={nova.direcao} onChange={(v) => setNova({ ...nova, direcao: v })} options={[{ v: 'Avanço', label: 'Avanço' }, { v: 'Reverso', label: 'Reverso' }]} />
          </div>
          <FieldRow first label="Girar sem água" sub={nova.seco ? 'Sem água (seco)' : 'Com água (molhado)'}>
            <Switch on={nova.seco} onChange={() => setNova({ ...nova, seco: !nova.seco })} label="Girar sem água" />
          </FieldRow>
          <FieldRow first label="Percentímetro" sub="10 a 100%">
            <span className={`flex items-center gap-2 ${nova.seco ? 'opacity-50' : ''}`}>
              <button type="button" disabled={nova.seco} onClick={() => setNova({ ...nova, pct: Math.max(10, nova.pct - 5) })} className="w-9 h-9 rounded-[10px] border font-extrabold">−</button>
              <span className="w-12 text-center font-extrabold">{nova.pct}%</span>
              <button type="button" disabled={nova.seco} onClick={() => setNova({ ...nova, pct: Math.min(100, nova.pct + 5) })} className="w-9 h-9 rounded-[10px] border font-extrabold">+</button>
            </span>
          </FieldRow>
          <DialogButtons onCancel={() => setNova(null)} onConfirm={adicionar} confirmLabel="Adicionar" busy={salvando} />
        </Card>
      ) : (
        <button type="button" disabled={n >= 5 || progs == null}
          onClick={() => setNova({ grupo: 'uteis', ini: '21:00', fim: '05:00', direcao: 'Avanço', seco: false, pct: 100 })}
          className={`h-[52px] rounded-[14px] border-[1.5px] border-dashed border-border text-sm font-extrabold ${n >= 5 ? 'text-muted-foreground' : 'text-[#177A3C] dark:text-emerald-400'}`}>
          {n >= 5 ? 'Limite de 5 horários' : '+ Adicionar horário'}
        </button>
      )}
      <p className="text-xs text-muted-foreground">A programação fica salva no NexON; a partida automática pelo servidor ainda não roda.</p>
    </div>
  );
}

export default PivoSheet;
