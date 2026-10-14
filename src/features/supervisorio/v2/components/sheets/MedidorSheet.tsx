import { useEffect, useState } from 'react';
import { iotApiService } from '@/services/iot.services';
import { SheetShell, EstadoHero, GrupoTitulo, Section, FasesTable, useDados, getPath, fmt, tsInfo, BadgeFrescor } from './sheetParts';
import { useGatewayDashboard } from '@/hooks/useGatewayDashboard';

const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
/** "10:45–11:00": o timestamp do pico é o FIM da janela de 15 min. */
const janela = (iso?: string | null) => {
  if (!iso) return undefined;
  const fim = new Date(iso);
  return `${hhmm(new Date(fim.getTime() - 15 * 60_000))}–${hhmm(fim)}`;
};

/**
 * Medidor da concessionária lido pela SSU (A-966 ou entrada SU+ da TON-V2): os dados são
 * PULSOS por intervalo do medidor, não grandezas instantâneas. Mostra o minuto atual (parcial
 * de 1 em 1 min da TON-V2), a demanda em janelas fixas de 15 min (como a concessionária
 * fatura) e a energia do dia — tudo de /equipamentos-dados/:id/gateway/dashboard.
 */
function SsuOperacao({ equipamentoId }: { equipamentoId: string }) {
  const { data, error } = useGatewayDashboard(equipamentoId);
  const agora = data?.minuto_a_minuto?.agora ?? null;
  const snap = data?.snapshot ?? null;
  const ref = agora ?? snap;
  const injetando = !!ref && ref.kW_injecao > ref.kW_consumo && ref.kW_injecao > 0.05;
  const consumindo = !!ref && ref.kW_consumo >= ref.kW_injecao && ref.kW_consumo > 0.05;
  const dia = data?.resumo_dia;
  const mes = data?.resumo_mes;
  const contrC = data?.unidade?.demanda_carga ?? null;
  const contrG = data?.unidade?.demanda_geracao ?? null;
  const temInjecao = (dia?.injecao_kwh ?? 0) > 0 || (mes?.pico_injecao?.kw ?? 0) > 0;
  const kvarAgora = agora ? agora.kvar_ind - agora.kvar_cap : null;
  return (
    <>
      <GrupoTitulo>Estado</GrupoTitulo>
      <EstadoHero
        label={!ref ? 'Sem dado' : injetando ? 'Injetando na rede' : consumindo ? 'Consumindo da rede' : 'Sem fluxo'}
        tone={!ref ? 'off' : injetando ? 'warn' : consumindo ? 'ok' : 'off'}
      />
      {error && <p className="text-[11px] text-amber-600 mt-1.5">{error}</p>}

      {agora && (
        <>
          <GrupoTitulo right={<span className="text-[11px] text-muted-foreground">{hhmm(new Date(agora.timestamp))}</span>}>Agora · último minuto</GrupoTitulo>
          <Section rows={[
            { k: 'Consumo', v: `${fmt(agora.kW_consumo, 2)} kW` },
            ...(temInjecao || agora.kW_injecao > 0 ? [{ k: 'Injeção', v: `${fmt(agora.kW_injecao, 2)} kW` }] : []),
            { k: 'Reativo', v: kvarAgora == null ? '—' : `${fmt(Math.abs(kvarAgora), 2)} kvar${kvarAgora > 0 ? ' ind.' : kvarAgora < 0 ? ' cap.' : ''}` },
          ]} />
        </>
      )}

      <GrupoTitulo>Demanda (média de 15 min)</GrupoTitulo>
      <Section rows={[
        { k: 'Máxima de hoje', sub: janela(dia?.pico_consumo?.timestamp), v: dia?.pico_consumo ? `${fmt(dia.pico_consumo.kw, 2)} kW` : '—' },
        { k: 'Máxima do mês', sub: mes?.pico_consumo ? new Date(mes.pico_consumo.timestamp).toLocaleDateString('pt-BR') + ' ' + janela(mes.pico_consumo.timestamp) : undefined, v: mes?.pico_consumo ? `${fmt(mes.pico_consumo.kw, 2)} kW` : '—' },
        ...(contrC != null ? [{ k: 'Contratada (carga)', v: `${fmt(contrC, 0)} kW`, mute: true }] : []),
        ...(temInjecao ? [
          { k: 'Máxima injeção hoje', sub: janela(dia?.pico_injecao?.timestamp), v: dia?.pico_injecao ? `${fmt(dia.pico_injecao.kw, 2)} kW` : '—' },
          ...(contrG != null ? [{ k: 'Contratada (geração)', v: `${fmt(contrG, 0)} kW`, mute: true }] : []),
        ] : []),
      ]} />

      <GrupoTitulo>Energia hoje</GrupoTitulo>
      <Section rows={[
        { k: 'Consumida', v: `${fmt(dia?.consumo_kwh ?? null, 3)} kWh` },
        ...(temInjecao ? [{ k: 'Injetada', v: `${fmt(dia?.injecao_kwh ?? null, 3)} kWh` }] : []),
        { k: 'Reativo indutivo', v: `${fmt(dia?.q_ind_kvarh ?? null, 3)} kvarh` },
        { k: 'Reativo capacitivo', v: `${fmt(dia?.q_cap_kvarh ?? null, 3)} kvarh` },
      ]} />

      {snap && (
        <>
          <GrupoTitulo right={<span className="text-[11px] text-muted-foreground">{hhmm(new Date(snap.timestamp_dados))}</span>}>Último bloco do medidor</GrupoTitulo>
          <Section rows={[
            { k: 'Consumo médio', v: `${fmt(snap.kW_consumo, 2)} kW` },
            ...(temInjecao ? [{ k: 'Injeção média', v: `${fmt(snap.kW_injecao, 2)} kW` }] : []),
            { k: 'Fator de potência', v: snap.FP ? `${fmt(snap.FP, 3)} ${snap.FP_natureza === 'cap' ? 'cap.' : 'ind.'}` : '—' },
          ]} />
        </>
      )}
      <p className="text-[11px] text-muted-foreground mt-2">Medidor lido pela SSU: energia e demanda vêm dos blocos do medidor; o "agora" é a parcial de 1 em 1 min da TON.</p>
    </>
  );
}

/**
 * Sheet do Medidor (Concessionária / Power Meter) — mockup arquivos/nexon-web-medidor.html.
 * Telemetria FLAT do M160/PD666 via /equipamentos/:id/dados/atual (Va/Ia/Pt/St/phf…).
 * Consumo×Injeção pelo sinal de Pt. Detalhamento por posto tarifário (Ponta/Fora/HR) e
 * demanda contratada dependem de agregação por tarifa — em construção (o usuário lapida).
 */
const raiz3 = Math.sqrt(3);

export function MedidorSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  // Fonte da medição: o device IoT associado a este medidor em "Vínculos → Medições"
  // (TON-V2 com SSU, A-966, PM…) — mesmo lookup do DJ→PM. Sem vínculo, o próprio medidor.
  const [fonte, setFonte] = useState<{ id: string; nome: string | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    setFonte(null);
    iotApiService.powerMeterByDisjuntor(equipamentoId)
      .then((r) => { if (vivo && r?.equipamento_id) setFonte({ id: r.equipamento_id.trim(), nome: r.nome }); })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, [equipamentoId]);
  const idDados = fonte?.id ?? equipamentoId;
  const { dados, ts } = useDados(idDados);
  const [aba, setAba] = useState('op');
  const [ff, setFf] = useState(false);

  const g = (p: string) => getPath(dados, p);
  const num = (p: string) => { const v = g(p); return v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v); };
  const info = tsInfo(ts);
  const online = info.online;   // frescor, não só "existe última leitura"

  const pt = num('Pt'); // W (>0 consumo, <0 injeção)
  const st = num('St'); const qt = num('Qt');
  const injetando = pt != null && pt < -0.5;
  const consumindo = pt != null && pt > 0.5;
  const fp = pt != null && st ? Math.abs(pt) / st : num('FPt');

  const va = num('Va'); const vb = num('Vb'); const vc = num('Vc');
  const vLine = (v: number | null) => (v == null ? null : v * raiz3);
  const fasesFN: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['A', `${fmt(va, 0)} V`, `${fmt(num('Ia'), 1)} A`],
    ['B', `${fmt(vb, 0)} V`, `${fmt(num('Ib'), 1)} A`],
    ['C', `${fmt(vc, 0)} V`, `${fmt(num('Ic'), 1)} A`],
  ];
  const fasesFF: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['AB', `${fmt(vLine(va), 0)} V`, `${fmt(num('Ia'), 1)} A`],
    ['BC', `${fmt(vLine(vb), 0)} V`, `${fmt(num('Ib'), 1)} A`],
    ['CA', `${fmt(vLine(vc), 0)} V`, `${fmt(num('Ic'), 1)} A`],
  ];

  const kW = (w: number | null) => (w == null ? null : w / 1000);
  // Bloco da SSU (A-966 / TON-V2): tem NSU e pulsos em data.phf — não é telemetria instantânea.
  const ehSsu = !!dados && (g('NSU') != null || g('data.phf') != null);

  return (
    <SheetShell
      title={nome || 'Medidor'}
      subtitle={info.hasTs ? info.label : undefined}
      badge={<BadgeFrescor info={info} />}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      activeTab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'cfg' ? (
        <>
          <GrupoTitulo>Demanda contratada</GrupoTitulo>
          <Section rows={[{ k: 'Consumo', v: '—' }, { k: 'Geração', v: '—' }]} />
          <GrupoTitulo>Postos tarifários</GrupoTitulo>
          <Section rows={[
            { k: 'Ponta', v: '—' }, { k: 'Horário reservado', v: '—' }, { k: 'Fora de ponta', sub: 'Todo o restante do dia', v: '—', mute: true },
          ]} />
          <p className="text-xs text-muted-foreground mt-3">Demanda contratada e janelas de posto tarifário serão editáveis aqui. Em construção.</p>
        </>
      ) : ehSsu ? (
        <>
          <SsuOperacao equipamentoId={idDados} />
          {fonte && <p className="text-[11px] text-muted-foreground mt-1">Fonte da medição: {fonte.nome ?? fonte.id} (Vínculos → Medições).</p>}
        </>
      ) : (
        <>
          {/* ESTADO */}
          <GrupoTitulo>Estado</GrupoTitulo>
          <EstadoHero
            label={!online ? 'Sem comunicação' : injetando ? 'Injetando na rede' : consumindo ? 'Consumindo da rede' : 'Sem fluxo'}
            tone={!online ? 'off' : injetando ? 'warn' : consumindo ? 'ok' : 'off'}
          />

          {/* TENSÃO E CORRENTE */}
          <GrupoTitulo right={
            <button type="button" onClick={() => setFf((v) => !v)} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">{ff ? 'FF' : 'FN'}</button>
          }>Tensão e corrente</GrupoTitulo>
          <FasesTable head={['Fase', 'Tensão', 'Corrente']} rows={ff ? fasesFF : fasesFN} />

          {/* POTÊNCIA */}
          <GrupoTitulo>Potência</GrupoTitulo>
          <Section rows={[
            { k: 'Consumo', v: `${fmt(consumindo ? kW(pt) : 0)} kW` },
            { k: 'Geração', v: `${fmt(injetando ? kW(-(pt as number)) : 0)} kW` },
            { k: 'Potência reativa', v: `${fmt(kW(qt))} kvar` },
            { k: 'Potência aparente', v: `${fmt(kW(st))} kVA` },
            { k: 'Fator de potência', v: fmt(fp, 2) },
          ]} />

          {/* ENERGIA */}
          <GrupoTitulo>Energia</GrupoTitulo>
          <Section rows={[
            { k: 'Energia ativa acumulada', v: `${fmt(num('phf'))} kWh` },
            { k: 'Consumo (forward)', v: `${fmt(num('consumo_phf'))} kWh` },
            { k: 'Injeção (reverse)', v: `${fmt(num('consumo_phr'))} kWh` },
          ]} />
          <p className="text-[11px] text-muted-foreground mt-2">Detalhamento por posto tarifário (Ponta / Fora de ponta / Horário reservado) e máxima demanda — em construção.</p>
        </>
      )}
    </SheetShell>
  );
}

export default MedidorSheet;
