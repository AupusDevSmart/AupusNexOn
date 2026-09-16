import { useState } from 'react';
import { SheetShell, EstadoHero, GrupoTitulo, Section, FasesTable, useDados, getPath, fmt, tsInfo, BadgeFrescor } from './sheetParts';

/**
 * Sheet do Medidor (Concessionária / Power Meter) — mockup arquivos/nexon-web-medidor.html.
 * Telemetria FLAT do M160/PD666 via /equipamentos/:id/dados/atual (Va/Ia/Pt/St/phf…).
 * Consumo×Injeção pelo sinal de Pt. Detalhamento por posto tarifário (Ponta/Fora/HR) e
 * demanda contratada dependem de agregação por tarifa — em construção (o usuário lapida).
 */
const raiz3 = Math.sqrt(3);

export function MedidorSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const { dados, ts } = useDados(equipamentoId);
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
