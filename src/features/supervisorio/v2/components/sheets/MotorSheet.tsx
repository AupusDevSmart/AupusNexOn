import { useState } from 'react';
import { SheetShell, EstadoHero, KpiGrid, GrupoTitulo, Section, FasesTable, useDados, getPath, fmt, tsInfo, BadgeFrescor } from './sheetParts';

/**
 * Sheet do Motor Elétrico — mockup arquivos/nexon-web-motor.html.
 * Ainda NÃO há fonte de telemetria dedicada de motor (só elétrica, se o motor for
 * medido por um PM que publica em /equipamentos/:id/dados/atual). Temperatura de
 * enrolamento/mancais e vibração dependem de sensores próprios (chaves best-effort,
 * degradam pra "—"). Estrutura pronta pro usuário lapidar.
 */
export function MotorSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const { dados, ts } = useDados(equipamentoId);
  const [ff, setFf] = useState(false);

  const g = (p: string) => getPath(dados, p);
  const num = (...ps: string[]) => { for (const p of ps) { const v = g(p); if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v); } return null; };
  const info = tsInfo(ts);
  const online = info.online;   // frescor, não só "existe última leitura"
  const pt = num('Pt', 'power.active_total');
  const ligado = pt != null && pt > 0.5;

  const fasesFN: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['A', `${fmt(num('Va'), 0)} V`, `${fmt(num('Ia'), 1)} A`],
    ['B', `${fmt(num('Vb'), 0)} V`, `${fmt(num('Ib'), 1)} A`],
    ['C', `${fmt(num('Vc'), 0)} V`, `${fmt(num('Ic'), 1)} A`],
  ];
  const fasesFF: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['AB', `${fmt(num('Va') != null ? Number(num('Va')) * Math.sqrt(3) : null, 0)} V`, `${fmt(num('Ia'), 1)} A`],
    ['BC', `${fmt(num('Vb') != null ? Number(num('Vb')) * Math.sqrt(3) : null, 0)} V`, `${fmt(num('Ib'), 1)} A`],
    ['CA', `${fmt(num('Vc') != null ? Number(num('Vc')) * Math.sqrt(3) : null, 0)} V`, `${fmt(num('Ic'), 1)} A`],
  ];

  return (
    <SheetShell
      title={nome || 'Motor'}
      subtitle={info.hasTs ? info.label : undefined}
      badge={<BadgeFrescor info={info} />}
      onClose={onClose}
    >
      {/* ESTADO */}
      <GrupoTitulo>Estado</GrupoTitulo>
      <EstadoHero label={!online ? 'Sem comunicação' : ligado ? 'Ligado' : 'Parado'} tone={!online ? 'off' : ligado ? 'ok' : 'off'} />
      <div className="mt-2">
        <KpiGrid items={[
          { label: 'Potência', value: fmt(pt != null ? pt / (pt > 1000 ? 1000 : 1) : null), unit: 'kW' },
          { label: 'Corrente máx.', value: fmt(Math.max(num('Ia') ?? 0, num('Ib') ?? 0, num('Ic') ?? 0) || null, 1), unit: 'A' },
        ]} />
      </div>

      {/* CONTROLES */}
      <GrupoTitulo>Controles</GrupoTitulo>
      <div className="flex gap-2">
        <button className="flex-1 py-2.5 rounded-lg border font-semibold text-sm" disabled>Desligar</button>
        <button className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-60" style={{ background: '#177A3C' }} disabled>Ligar</button>
      </div>
      <p className="text-[11px] text-amber-600 mt-1.5">Comando liga/desliga do motor ainda não vinculado — em construção.</p>

      {/* TENSÃO E CORRENTE */}
      <GrupoTitulo right={
        <button type="button" onClick={() => setFf((v) => !v)} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">{ff ? 'FF' : 'FN'}</button>
      }>Tensão e corrente</GrupoTitulo>
      <FasesTable head={['Fase', 'Tensão', 'Corrente']} rows={ff ? fasesFF : fasesFN} />

      {/* TEMPERATURA */}
      <GrupoTitulo>Temperatura</GrupoTitulo>
      <Section rows={[
        { k: 'Enrolamento', v: `${fmt(num('temp_enrolamento', 'temperatura_enrolamento'), 0)} °C` },
        { k: 'Mancal dianteiro', v: `${fmt(num('temp_mancal_dianteiro'), 0)} °C` },
        { k: 'Mancal traseiro', v: `${fmt(num('temp_mancal_traseiro'), 0)} °C` },
      ]} />

      {/* VIBRAÇÃO */}
      <GrupoTitulo>Vibração</GrupoTitulo>
      <Section rows={[
        { k: 'Mancal dianteiro', v: `${fmt(num('vib_mancal_dianteiro'), 1)} mm/s` },
        { k: 'Mancal traseiro', v: `${fmt(num('vib_mancal_traseiro'), 1)} mm/s` },
      ]} />
      <p className="text-[11px] text-muted-foreground mt-2">Temperatura de enrolamento/mancais e vibração dependem de sensores dedicados — em construção.</p>
    </SheetShell>
  );
}

export default MotorSheet;
