import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { acionarPontoApi } from '@/services/acionar-ponto.services';
import { SheetShell, EstadoHero, KpiGrid, GrupoTitulo, Section, FasesTable, MiniChart, useDados, useCurvaDia, getPath, fmt, tsInfo, BadgeFrescor } from './sheetParts';

/**
 * Linha de parâmetro de regulação/proteção (grid-code) no estilo do mockup: rótulo +
 * faixa à esquerda, valor num box à direita e "Anterior" abaixo. UI-only por enquanto —
 * os valores só vão preencher quando a TON ler os registradores Modbus (senão "—").
 */
function ParamRow({ label, faixa, valor, anterior }: { label: string; faixa: string; valor: string; anterior?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">Faixa {faixa}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="inline-block rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums min-w-[86px]">{valor}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Anterior {anterior ?? '—'}</div>
      </div>
    </div>
  );
}

/**
 * Grupo de linhas que ESCONDE o que o inversor não informa (valor "—"), em vez de exibir
 * campo vazio — cada fabricante entrega um conjunto diferente. Sem nenhuma linha, some o grupo.
 */
function GrupoInfo({ titulo, rows }: { titulo: string; rows: Array<{ k: string; v: string; mute?: boolean }> }) {
  const com = rows.filter((r) => !String(r.v).trim().startsWith('—'));
  if (com.length === 0) return null;
  return (<><GrupoTitulo>{titulo}</GrupoTitulo><Section rows={com} /></>);
}


interface SetpointDef { id: string; label: string; unidade?: string; escala?: number; min?: number; max?: number; faixas?: Array<[number, number]>; padrao?: number; obs?: string; avancado?: boolean }

/** Linha da tela de Regulação e proteção: leitura (valor) e, se o modelo suporta, ajuste. */
export interface LinhaRegulacao { label: string; faixa: string; valor: string; sp?: string; soSeSuportado?: boolean }

/**
 * REGULAÇÃO E PROTEÇÃO (mockup nexon-web-inversor): TODAS as linhas aparecem. As que o modelo
 * do inversor suporta como ajuste (catálogo → setpoints) ganham campo + "Aplicar", enviados
 * pela TON (GET/POST /equipamentos/:id/setpoints; backend valida/converte, TON confere a
 * faixa de novo). As demais são leitura ("—" enquanto a TON não lê aquele registrador).
 * Ajustes "avançados" (endereço Modbus) ficam separados, com aviso.
 */
function RegulacaoProtecao({ equipamentoId, nome, linhas }: { equipamentoId: string; nome: string; linhas: LinhaRegulacao[] }) {
  const [lista, setLista] = useState<SetpointDef[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<Record<string, { ok: boolean; txt: string }>>({});
  const [verAvancado, setVerAvancado] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.get(`/equipamentos/${equipamentoId.trim()}/setpoints`)
      .then((r: any) => {
        const d = r?.data?.data ?? r?.data;
        const sps: SetpointDef[] = Array.isArray(d?.setpoints) ? d.setpoints : [];
        if (!vivo) return;
        setLista(sps);
        setValores(Object.fromEntries(sps.map((sp) => [sp.id, sp.padrao != null && !sp.avancado ? String(sp.padrao) : ''])));
      })
      .catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [equipamentoId]);

  const faixaTxt = (sp: SetpointDef) =>
    (sp.faixas ?? [[sp.min ?? 0, sp.max ?? 0]]).map(([a, b]) => `${a} a ${b}`).join(' ou ') + (sp.unidade ? ` ${sp.unidade}` : '');

  const aplicar = async (sp: SetpointDef) => {
    const raw = String(valores[sp.id] ?? '').replace(',', '.').trim();
    const v = Number(raw);
    if (raw === '' || !Number.isFinite(v)) { toast.error(`${sp.label}: informe um número`); return; }
    const aviso = sp.avancado ? `\n\nATENÇÃO: ${sp.obs ?? ''}` : '';
    if (!window.confirm(`Enviar ao inversor ${nome}:\n\n${sp.label} = ${raw}${sp.unidade ? ` ${sp.unidade}` : ''}\n\nO valor vai para o equipamento REAL pela TON.${aviso}`)) return;
    setEnviando(sp.id);
    try {
      const r: any = await api.post(`/equipamentos/${equipamentoId.trim()}/setpoints/${sp.id}`, { valor: v });
      const d = r?.data?.data ?? r?.data;
      setUltimo((u) => ({ ...u, [sp.id]: { ok: true, txt: `Aplicado · ack ${d?.latency_ms ?? '?'} ms` } }));
      toast.success(`${sp.label}: aplicado`, { description: d?.comando_tecnico });
    } catch (e: any) {
      const st = e?.response?.status;
      const msg = e?.response?.data?.message || e?.response?.data?.error?.message || e?.message || 'falha';
      const titulo = st === 504 ? 'A TON não respondeu' : st === 502 ? 'O inversor/TON recusou' : st === 403 ? 'Sem permissão' : 'Não aplicado';
      setUltimo((u) => ({ ...u, [sp.id]: { ok: false, txt: `${titulo}: ${String(msg)}` } }));
      toast.error(titulo, { description: String(msg) });
    } finally { setEnviando(null); }
  };

  const linhaAjuste = (sp: SetpointDef, label?: string, atual?: string) => (
    <div key={sp.id} className="py-2.5 border-b last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label ?? sp.label}</div>
          <div className="text-xs text-muted-foreground">Faixa {faixaTxt(sp)}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1.5 justify-end">
            <input
              inputMode="decimal"
              value={valores[sp.id] ?? ''}
              onChange={(e) => setValores((x) => ({ ...x, [sp.id]: e.target.value }))}
              className="w-20 h-8 rounded-lg border px-2 text-sm text-right tabular-nums bg-background"
              placeholder={sp.padrao != null ? String(sp.padrao) : ''}
            />
            {sp.unidade && <span className="text-xs text-muted-foreground">{sp.unidade}</span>}
            <button
              type="button"
              disabled={!!enviando}
              onClick={() => aplicar(sp)}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: '#177A3C' }}
            >{enviando === sp.id ? 'Enviando…' : 'Aplicar'}</button>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Atual {atual ?? '—'}</div>
        </div>
      </div>
      {sp.obs && <p className="text-[11px] text-muted-foreground mt-1">{sp.obs}</p>}
      {ultimo[sp.id] && <p className={`text-[11px] mt-1 ${ultimo[sp.id].ok ? 'text-emerald-600' : 'text-red-600'}`}>{ultimo[sp.id].txt}</p>}
    </div>
  );

  const porId = new Map(lista.map((sp) => [sp.id, sp]));
  const usados = new Set<string>();
  const avancados = lista.filter((sp) => sp.avancado);
  // Nada a comandar nem a ler: a seção some (sem linhas vazias).
  const temLinha = lista.some((sp) => !sp.avancado) || linhas.some((l) => !l.soSeSuportado && l.valor !== '—');
  if (!temLinha && avancados.length === 0) return null;
  return (
    <>
      <GrupoTitulo>Regulação e proteção</GrupoTitulo>
      <div className="rounded-lg border px-3">
        {linhas.map((l) => {
          const sp = l.sp ? porId.get(l.sp) : undefined;
          if (sp) { usados.add(sp.id); return linhaAjuste(sp, l.label, l.valor); }
          // Sem comando neste modelo: só aparece se a TON publicar a leitura (senão, some).
          if (l.soSeSuportado || l.valor === '—') return null;
          return <ParamRow key={l.label} label={l.label} faixa={l.faixa} valor={l.valor} />;
        })}
        {/* ajustes do modelo que não têm linha fixa no mockup (ex.: Q % da Sungrow) */}
        {lista.filter((sp) => !sp.avancado && !usados.has(sp.id) && !linhas.some((l) => l.sp === sp.id)).map((sp) => linhaAjuste(sp))}
      </div>
      {avancados.length > 0 && (
        <div className="mt-2">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setVerAvancado((v) => !v)}>
            {verAvancado ? '▾' : '▸'} Avançado ({avancados.length})
          </button>
          {verAvancado && <div className="rounded-lg border border-amber-300 px-3 mt-1">{avancados.map((sp) => linhaAjuste(sp))}</div>}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">
        Ajustes enviados ao inversor pela TON (firmware gerado a partir de 09/10/2026). Só aparece o que este modelo aceita.
      </p>
    </>
  );
}

/**
 * Sheet do Inversor Fotovoltaico (mockup arquivos/nexon-web-inversor.html).
 * Data-driven pela telemetria do próprio equipamento IoT (/equipamentos/:id/dados/atual),
 * cujas chaves seguem o catálogo `inversor_solar` (paths aninhados: energy.*, power.*,
 * voltage.*, current.*, dc.*, protection.*, temperature.*). Primeira versão — o usuário
 * vai lapidando (comandos reais Ligar/Desligar, curva histórica, MPPT/strings por array,
 * parâmetros editáveis na aba Configuração).
 */
export function InversorSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const { dados, ts } = useDados(equipamentoId);
  // Curva do dia (kW, buckets de 15 min) — antes era uma série vazia fixa.
  const curva = useCurvaDia(equipamentoId, 15);
  const [aba, setAba] = useState('op');
  const [ff, setFf] = useState(true);

  // Comandos acionáveis (pontos Ligar/Desligar JÁ vinculados a um comando Modbus/TON).
  // Sem vínculo → a seção Controles nem aparece.
  const [comandos, setComandos] = useState<Array<{ ponto_id: string; ponto: string }>>([]);
  const [enviando, setEnviando] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    api.get(`/iot/equipamento/${equipamentoId.trim()}/comandos`)
      .then((r: any) => { const d = r?.data?.data ?? r?.data; if (vivo) setComandos(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])); })
      .catch(() => { if (vivo) setComandos([]); });
    return () => { vivo = false; };
  }, [equipamentoId]);
  const cmdDesligar = comandos.find((c) => /deslig|parar|stop|off/i.test(c.ponto)) ?? null;
  const cmdLigar = comandos.find((c) => c !== cmdDesligar && /liga|partir|start|on\b/i.test(c.ponto)) ?? null;
  const acionar = async (c: { ponto_id: string; ponto: string }, acao: string) => {
    if (!window.confirm(`${acao} o inversor ${nome || ''}?\n\nIsso envia o comando ao equipamento REAL pela TON.`)) return;
    setEnviando(c.ponto_id);
    try {
      const r = await acionarPontoApi.acionar(equipamentoId, c.ponto_id);
      toast.success(`${acao}: confirmado pela TON`, { description: `${r.comando_tecnico} · ack ${r.latency_ms} ms` });
    } catch (e: any) {
      const st = e?.response?.status;
      const msg = e?.response?.data?.message || e?.response?.data?.error?.message || e?.message || 'falha';
      toast.error(st === 504 ? 'A TON não respondeu a tempo' : st === 502 ? 'O inversor/TON recusou o comando' : 'Comando não enviado', { description: String(msg) });
    } finally { setEnviando(null); }
  };

  const g = (p: string) => getPath(dados, p);
  // Valor de parâmetro de config: "—" enquanto a TON não trouxer o registrador.
  const pv = (p: string, suf = '') => { const x = g(p); return x == null || x === '' ? '—' : `${x}${suf}`; };
  const nomeEq = nome || 'Inversor';
  // Contrato do NexON: power.* e dc.total_power chegam em W/VA/var (COA e gráfico dividem
  // por 1000). Aqui exibimos em kW/kVA/kvar.
  const kilo = (p: string) => { const x = g(p); return x == null || x === '' ? undefined : Number(x) / 1000; };
  const pativa = kilo('power.active_total');
  const nominal = g('info.nominal_power');
  const gerando = pativa != null && pativa > 0.01;
  const pct = nominal ? Math.max(0, Math.min(100, (Number(pativa) / Number(nominal)) * 100)) : undefined;
  // Online = leitura FRESCA (não só "existe última leitura"). Uma leitura de dias
  // atrás não é online — o hero cai p/ "Sem comunicação" e o badge mostra a idade.
  const info = tsInfo(ts);
  const online = info.online;

  // O texto do estado vem do firmware, que só conhece a tabela da Sungrow: p/ outros
  // fabricantes chega "Unknown" → cai no Gerando/Parado pela potência.
  const wsTxt = String(g('status.work_state_text') ?? '').trim();
  const estadoTexto = wsTxt && !/^unknown$/i.test(wsTxt) ? wsTxt : '';
  const minHoje = g('energy.daily_running_time');

  // Tensões: FF (entre fases) e FN (fase-neutro). Mostra o que o inversor MEDE; o que ele
  // não mede sai CALCULADO (×√3 / ÷√3, aproximação de rede equilibrada) e marcado "calc.".
  const num = (p: string) => { const x = g(p); return x == null || x === '' || !Number.isFinite(Number(x)) ? undefined : Number(x); };
  const R3 = Math.sqrt(3);
  const ffMed = [num('voltage.phase_a-b'), num('voltage.phase_b-c'), num('voltage.phase_c-a')];
  const fnMed = [num('voltage.phase_a'), num('voltage.phase_b'), num('voltage.phase_c')];
  const temFF = ffMed.some((v) => v != null);
  const temFN = fnMed.some((v) => v != null);
  const media = (a?: number, b?: number) => (a != null && b != null ? (a + b) / 2 : undefined);
  // FF a partir de FN: Vab ≈ média(Va,Vb)·√3. FN a partir de FF: Va ≈ média(Vab,Vca)/√3.
  const ffCalc = [media(fnMed[0], fnMed[1]), media(fnMed[1], fnMed[2]), media(fnMed[2], fnMed[0])].map((v) => (v != null ? v * R3 : undefined));
  const fnCalc = [media(ffMed[0], ffMed[2]), media(ffMed[0], ffMed[1]), media(ffMed[1], ffMed[2])].map((v) => (v != null ? v / R3 : undefined));
  const ffVals = temFF ? ffMed : ffCalc;
  const fnVals = temFN ? fnMed : fnCalc;
  const ffCalculado = !temFF && temFN;
  const fnCalculado = !temFN && temFF;
  // Padrão: abre no que é MEDIDO (só FN → abre em FN).
  const mostraFF = (temFF || !temFN) ? ff : !ff;
  const tensaoCel = (v: number | undefined, calc: boolean) => `${fmt(v, 0)} V${calc && v != null ? ' (calc.)' : ''}`;
  const fasesFF: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['AB', tensaoCel(ffVals[0], ffCalculado), `${fmt(g('current.phase_a'), 0)} A`],
    ['BC', tensaoCel(ffVals[1], ffCalculado), `${fmt(g('current.phase_b'), 0)} A`],
    ['CA', tensaoCel(ffVals[2], ffCalculado), `${fmt(g('current.phase_c'), 0)} A`],
  ];
  const fasesFN: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['A', tensaoCel(fnVals[0], fnCalculado), `${fmt(g('current.phase_a'), 0)} A`],
    ['B', tensaoCel(fnVals[1], fnCalculado), `${fmt(g('current.phase_b'), 0)} A`],
    ['C', tensaoCel(fnVals[2], fnCalculado), `${fmt(g('current.phase_c'), 0)} A`],
  ];
  const notaTensao = mostraFF
    ? (ffCalculado ? 'Este inversor mede só fase-neutro: entre fases calculado (×√3).' : '')
    : (fnCalculado ? 'Este inversor mede só entre fases: fase-neutro calculado (÷√3).' : '');

  // Falhas (bitfields status.fault_N, ex.: SOFAR 0x0001-0x0005). 0 = sem falha.
  const falhas = [1, 2, 3, 4, 5].map((n) => ({ n, v: num(`status.fault_${n}`) }));
  const temFalhas = falhas.some((f) => f.v != null);
  const ativas = falhas.filter((f) => f.v != null && f.v !== 0);
  const falhasTxt = ativas.length === 0 ? 'Nenhuma'
    : ativas.map((f) => `F${f.n}=0x${(f.v as number).toString(16).toUpperCase()}`).join(' · ');

  // Aparente e FP: quando o inversor não informa, calcula de P e Q (marcado "calc.").
  const qkvar = kilo('power.reactive_total');
  const sMed = kilo('power.apparent_total');
  const sCalc = sMed == null && pativa != null && qkvar != null ? Math.hypot(pativa, qkvar) : undefined;
  const fpMed = num('power.power_factor');
  const fpCalc = fpMed == null && pativa != null && qkvar != null && Math.hypot(pativa, qkvar) > 0
    ? pativa / Math.hypot(pativa, qkvar) : undefined;

  // Tensão por MPPT (dc.mpptN_voltage) e corrente por entrada (dc.stringN_current).
  // Mostra 1..maior-canal-ativo: inclui um canal zerado no meio (string morta, útil ver)
  // mas esconde a cauda de canais não usados (o payload traz dezenas fixas).
  const canaisAte = (prefixo: string, sufixo: string, max: number) => {
    const vals: number[] = [];
    for (let n = 1; n <= max; n++) { const v = Number(g(`dc.${prefixo}${n}${sufixo}`)); vals.push(Number.isFinite(v) ? v : 0); }
    let ultimo = 0; vals.forEach((v, i) => { if (v > 0) ultimo = i + 1; });
    return vals.slice(0, ultimo).map((v, i) => ({ n: i + 1, v }));
  };
  const mppts = canaisAte('mppt', '_voltage', 24);
  const strings = canaisAte('string', '_current', 48);

  // DC total: medido, ou calculado Σ V_mppt·I quando há 1 corrente por MPPT (ex.: SOFAR).
  const dcMed = kilo('dc.total_power');
  const dcCalc = dcMed == null && mppts.length > 0 && mppts.length === strings.length
    ? mppts.reduce((acc, m, i) => acc + m.v * strings[i].v, 0) / 1000 : undefined;

  return (
    <SheetShell
      title={nomeEq}
      subtitle={info.hasTs ? info.label : undefined}
      badge={<BadgeFrescor info={info} />}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      activeTab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'cfg' ? (
        <>
          <GrupoTitulo>Parâmetros</GrupoTitulo>
          <Section rows={[
            { k: 'Potência nominal', v: `${fmt(nominal, 0)} kW` },
            { k: 'Tipo de dispositivo', v: g('info.device_type') ?? '—', mute: true },
            { k: 'Tipo de saída', v: g('info.output_type') ?? '—', mute: true },
            { k: 'Potência reativa nominal', v: `${fmt(g('regulation.nominal_reactive_power'), 0)} kvar` },
          ]} />
          <RegulacaoProtecao
            equipamentoId={equipamentoId}
            nome={nomeEq}
            linhas={[
              { label: 'Modo de reativo', faixa: 'FP fixo · Q fixo · Q(V)', valor: pv('regulation.reactive_mode_text') },
              { label: 'Fator de potência', faixa: '0,80 ind a 0,80 cap', valor: pv('regulation.power_factor_setpoint'), sp: 'sp_fp' },
              { label: 'Reativo (% da nominal)', faixa: '−100 a 100 %', valor: pv('regulation.reactive_pct', ' %'), sp: 'sp_q_pct', soSeSuportado: true },
              { label: 'Limite de potência ativa', faixa: '0 a 100 %', valor: pv('regulation.active_power_limit', ' %'), sp: 'sp_limite_pct' },
              { label: 'Sobretensão', faixa: '1,05 a 1,20 pu', valor: pv('protection.over_voltage', ' pu') },
              { label: 'Subtensão', faixa: '0,70 a 0,90 pu', valor: pv('protection.under_voltage', ' pu') },
              { label: 'Sobrefrequência', faixa: '60,5 a 63,0 Hz', valor: pv('protection.over_frequency', ' Hz') },
              { label: 'Subfrequência', faixa: '56,0 a 59,5 Hz', valor: pv('protection.under_frequency', ' Hz') },
            ]}
          />
        </>
      ) : (
        <>
          {/* ESTADO */}
          <GrupoTitulo>Estado</GrupoTitulo>
          <EstadoHero
            label={!online ? 'Sem comunicação' : (estadoTexto || (gerando ? 'Gerando' : 'Parado'))}
            tone={!online ? 'off' : gerando ? 'ok' : 'off'}
            pct={gerando ? pct : undefined}
          />
          <div className="mt-2">
            <KpiGrid items={[
              { label: 'Potência instantânea', value: fmt(pativa), unit: 'kW' },
              { label: 'Energia hoje', value: fmt(g('energy.daily_yield')), unit: 'kWh' },
            ]} />
          </div>

          {/* CONTROLES: só aparecem quando Ligar/Desligar estão vinculados (Configurar I/O no IoT). */}
          {(cmdLigar || cmdDesligar) && (
            <>
              <GrupoTitulo>Controles</GrupoTitulo>
              <div className="flex gap-2">
                {cmdDesligar && (
                  <button
                    type="button"
                    className="flex-1 py-2.5 rounded-lg border font-semibold text-sm disabled:opacity-60"
                    disabled={!!enviando}
                    onClick={() => acionar(cmdDesligar, 'Desligar')}
                  >{enviando === cmdDesligar.ponto_id ? 'Enviando…' : 'Desligar'}</button>
                )}
                {cmdLigar && (
                  <button
                    type="button"
                    className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-60"
                    style={{ background: '#177A3C' }}
                    disabled={!!enviando}
                    onClick={() => acionar(cmdLigar, 'Ligar')}
                  >{enviando === cmdLigar.ponto_id ? 'Enviando…' : 'Ligar'}</button>
                )}
              </div>
            </>
          )}

          {/* CURVA */}
          <GrupoTitulo>Curva</GrupoTitulo>
          <MiniChart serie={curva} unit="kW" />

          {/* ENERGIA E PRODUÇÃO */}
          <GrupoInfo titulo="Energia e produção" rows={[
            { k: 'Geração total', v: `${fmt(g('energy.total_yield'))} kWh` },
            { k: 'Tempo de operação hoje', v: `${fmt(minHoje == null || minHoje === '' ? undefined : Number(minHoje) / 60, 1)} h` },
            { k: 'Tempo de operação total', v: `${fmt(g('energy.total_running_time'), 0)} h` },
          ]} />

          {/* POTÊNCIA E FREQUÊNCIA */}
          <GrupoInfo titulo="Potência e frequência" rows={[
            { k: 'Potência aparente', v: sMed != null ? `${fmt(sMed)} kVA` : sCalc != null ? `${fmt(sCalc)} kVA (calc.)` : '— kVA' },
            { k: 'Potência reativa', v: `${fmt(qkvar)} kvar` },
            { k: 'Frequência', v: `${fmt(g('power.frequency'), 2)} Hz` },
            { k: 'Fator de potência', v: fpMed != null ? fmt(fpMed, 2) : fpCalc != null ? `${fmt(fpCalc, 2)} (calc.)` : '—' },
          ]} />

          {/* CORRENTE ALTERNADA */}
          <GrupoTitulo right={
            <button type="button" onClick={() => setFf((v) => !v)} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">{mostraFF ? 'Entre fases (FF) ⇄' : 'Fase-neutro (FN) ⇄'}</button>
          }>Corrente alternada</GrupoTitulo>
          <FasesTable head={['Fase', 'Tensão', 'Corrente']} rows={mostraFF ? fasesFF : fasesFN} />
          {notaTensao && <p className="text-[11px] text-muted-foreground mt-1">{notaTensao}</p>}

          {/* CORRENTE CONTÍNUA */}
          <GrupoInfo titulo="Corrente contínua" rows={[
            { k: 'Potência DC total', v: dcMed != null ? `${fmt(dcMed)} kW` : dcCalc != null ? `${fmt(dcCalc)} kW (calc.)` : '— kW' },
            { k: 'Tensão barramento', v: `${fmt(g('protection.bus_voltage'), 0)} V` },
          ]} />
          {mppts.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mt-3 mb-1">Tensão por MPPT</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {mppts.map((m) => (
                  <div key={m.n} className="rounded-md border px-2 py-1.5 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">MPPT {m.n}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(m.v, 0)} V</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {strings.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mt-3 mb-1">Corrente por entrada (string)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {strings.map((s) => (
                  <div key={s.n} className="rounded-md border px-2 py-1.5 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Entrada {s.n}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(s.v, 1)} A</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* INFORMAÇÕES */}
          <GrupoInfo titulo="Informações" rows={[
            ...(temFalhas ? [{ k: 'Falhas', v: falhasTxt }] : []),
            { k: 'Temperatura interna', v: `${fmt(g('temperature.internal'), 0)} °C` },
            { k: 'Resistência de isolamento', v: (() => { const r = num('protection.insulation_resistance'); return r != null && r >= 1000 ? `${fmt(r / 1000, 2)} MΩ` : `${fmt(r, 0)} kΩ`; })() },
          ]} />
        </>
      )}
    </SheetShell>
  );
}

export default InversorSheet;
