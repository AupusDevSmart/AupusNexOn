import { useState } from 'react';
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

  const g = (p: string) => getPath(dados, p);
  // Valor de parâmetro de config: "—" enquanto a TON não trouxer o registrador.
  const pv = (p: string, suf = '') => { const x = g(p); return x == null || x === '' ? '—' : `${x}${suf}`; };
  const nomeEq = nome || 'Inversor';
  const pativa = g('power.active_total');
  const nominal = g('info.nominal_power');
  const gerando = pativa != null && Number(pativa) > 0.1;
  const pct = nominal ? Math.max(0, Math.min(100, (Number(pativa) / Number(nominal)) * 100)) : undefined;
  // Online = leitura FRESCA (não só "existe última leitura"). Uma leitura de dias
  // atrás não é online — o hero cai p/ "Sem comunicação" e o badge mostra a idade.
  const info = tsInfo(ts);
  const online = info.online;

  const fasesFF: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['AB', `${fmt(g('voltage.phase_a-b'), 0)} V`, `${fmt(g('current.phase_a'), 0)} A`],
    ['BC', `${fmt(g('voltage.phase_b-c'), 0)} V`, `${fmt(g('current.phase_b'), 0)} A`],
    ['CA', `${fmt(g('voltage.phase_c-a'), 0)} V`, `${fmt(g('current.phase_c'), 0)} A`],
  ];
  const fasesFN: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['A', '—', `${fmt(g('current.phase_a'), 0)} A`],
    ['B', '—', `${fmt(g('current.phase_b'), 0)} A`],
    ['C', '—', `${fmt(g('current.phase_c'), 0)} A`],
  ];

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
          {/* REGULAÇÃO E PROTEÇÃO (grid-code) — igual ao mockup. UI pronta; os valores só
              preenchem quando a TON ler esses registradores Modbus (part b). Chaves plausíveis
              já fiadas → auto-preenchem quando chegarem. */}
          <GrupoTitulo>Regulação e proteção</GrupoTitulo>
          <div className="rounded-lg border px-3">
            <ParamRow label="Modo de reativo" faixa="FP fixo · Q fixo · Q(V)" valor={pv('regulation.reactive_mode_text')} />
            <ParamRow label="Fator de potência" faixa="0,80 ind a 0,80 cap" valor={pv('regulation.power_factor_setpoint')} />
            <ParamRow label="Limite de potência ativa" faixa="0 a 100 %" valor={pv('regulation.active_power_limit', ' %')} />
            <ParamRow label="Sobretensão" faixa="1,05 a 1,20 pu" valor={pv('protection.over_voltage', ' pu')} />
            <ParamRow label="Subtensão" faixa="0,70 a 0,90 pu" valor={pv('protection.under_voltage', ' pu')} />
            <ParamRow label="Sobrefrequência" faixa="60,5 a 63,0 Hz" valor={pv('protection.over_frequency', ' Hz')} />
            <ParamRow label="Subfrequência" faixa="56,0 a 59,5 Hz" valor={pv('protection.under_frequency', ' Hz')} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Interface pronta. Os valores aparecem quando a TON passar a ler estes registradores do inversor (Modbus) — leitura/edição em construção.
          </p>
        </>
      ) : (
        <>
          {/* ESTADO */}
          <GrupoTitulo>Estado</GrupoTitulo>
          <EstadoHero
            label={!online ? 'Sem comunicação' : (g('status.work_state_text') || (gerando ? 'Gerando' : 'Parado'))}
            tone={!online ? 'off' : gerando ? 'ok' : 'off'}
            pct={gerando ? pct : undefined}
          />
          <div className="mt-2">
            <KpiGrid items={[
              { label: 'Potência instantânea', value: fmt(pativa), unit: 'kW' },
              { label: 'Energia hoje', value: fmt(g('energy.daily_yield')), unit: 'kWh' },
            ]} />
          </div>

          {/* CONTROLES */}
          <GrupoTitulo>Controles</GrupoTitulo>
          <div className="flex gap-2">
            <button className="flex-1 py-2.5 rounded-lg border font-semibold text-sm" disabled>Desligar</button>
            <button className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-60" style={{ background: '#177A3C' }} disabled>Ligar</button>
          </div>
          <p className="text-[11px] text-amber-600 mt-1.5">Comando de liga/desliga do inversor ainda não vinculado — em construção.</p>

          {/* CURVA */}
          <GrupoTitulo>Curva</GrupoTitulo>
          <MiniChart serie={curva} unit="kW" />

          {/* ENERGIA E PRODUÇÃO */}
          <GrupoTitulo>Energia e produção</GrupoTitulo>
          <Section rows={[
            { k: 'Geração total', v: `${fmt(g('energy.total_yield'))} kWh` },
            { k: 'Tempo de operação hoje', v: `${fmt(g('energy.daily_running_time'), 0)} h` },
            { k: 'Tempo de operação total', v: `${fmt(g('energy.total_running_time'), 0)} h` },
          ]} />

          {/* POTÊNCIA E FREQUÊNCIA */}
          <GrupoTitulo>Potência e frequência</GrupoTitulo>
          <Section rows={[
            { k: 'Potência aparente', v: `${fmt(g('power.apparent_total'))} kVA` },
            { k: 'Potência reativa', v: `${fmt(g('power.reactive_total'))} kvar` },
            { k: 'Frequência', v: `${fmt(g('power.frequency'), 2)} Hz` },
            { k: 'Fator de potência', v: fmt(g('power.power_factor'), 2) },
          ]} />

          {/* CORRENTE ALTERNADA */}
          <GrupoTitulo right={
            <button type="button" onClick={() => setFf((v) => !v)} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">{ff ? 'FF' : 'FN'}</button>
          }>Corrente alternada</GrupoTitulo>
          <FasesTable head={['Fase', 'Tensão', 'Corrente']} rows={ff ? fasesFF : fasesFN} />

          {/* CORRENTE CONTÍNUA */}
          <GrupoTitulo>Corrente contínua</GrupoTitulo>
          <Section rows={[
            { k: 'Potência DC total', v: `${fmt(g('dc.total_power'))} kW` },
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
          <GrupoTitulo>Informações</GrupoTitulo>
          <Section rows={[
            { k: 'Temperatura interna', v: `${fmt(g('temperature.internal'), 0)} °C` },
            { k: 'Resistência de isolamento', v: `${fmt(g('protection.insulation_resistance'), 0)} kΩ` },
          ]} />
        </>
      )}
    </SheetShell>
  );
}

export default InversorSheet;
