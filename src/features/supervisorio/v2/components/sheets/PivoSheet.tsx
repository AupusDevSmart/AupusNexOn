import { useState } from 'react';
import { SheetShell, EstadoHero, GrupoTitulo, Section, FasesTable, useDados, getPath, fmt, tsInfo, BadgeFrescor } from './sheetParts';

/** Toggle visual (UI). Estado local — ainda não persiste (comportamento a definir). */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-600' : 'bg-muted'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/** Linha com rótulo + controle à direita (mesmo espaçamento do Section). */
function LinhaControle({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * Sheet do Pivô de irrigação — mockup arquivos/nexon-web-pivo.html.
 * O domínio (posição angular, lâmina d'água, sentido, bombeamento) ainda NÃO tem
 * fonte de telemetria dedicada — chaves best-effort, degradam pra "—". Dados
 * elétricos aparecem se o pivô for medido por um PM (/equipamentos/:id/dados/atual).
 * Estrutura pronta pro usuário lapidar (integrar LoRa/controlador do pivô depois).
 */
export function PivoSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const { dados, ts } = useDados(equipamentoId);
  const [aba, setAba] = useState('op');
  const [ff, setFf] = useState(false);
  // UI-only (só a interface por enquanto — não persiste, comportamento a definir).
  const [semAguaUi, setSemAguaUi] = useState(false);
  const [bloqPonta, setBloqPonta] = useState(true);

  const g = (p: string) => getPath(dados, p);
  const num = (...ps: string[]) => { for (const p of ps) { const v = g(p); if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v); } return null; };
  const str = (...ps: string[]) => { for (const p of ps) { const v = g(p); if (v != null && v !== '') return String(v); } return null; };
  const info = tsInfo(ts);
  const online = info.online;   // frescor, não só "existe última leitura"
  const pt = num('Pt', 'power.active_total');
  const irrigando = num('bomba_ligada', 'irrigando') === 1 || (pt != null && pt > 0.5);
  const semAgua = num('girar_sem_agua', 'sem_agua') === 1;
  const posicao = num('posicao', 'angulo');

  const fasesFN: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['A', `${fmt(num('Va'), 0)} V`, `${fmt(num('Ia'), 1)} A`],
    ['B', `${fmt(num('Vb'), 0)} V`, `${fmt(num('Ib'), 1)} A`],
    ['C', `${fmt(num('Vc'), 0)} V`, `${fmt(num('Ic'), 1)} A`],
  ];
  const flag = (v: number | null) => (v == null ? '—' : v ? 'OK' : 'Alerta');

  return (
    <SheetShell
      title={nome || 'Pivô'}
      subtitle={info.hasTs ? info.label : undefined}
      badge={<BadgeFrescor info={info} />}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      activeTab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'cfg' ? (
        <>
          <GrupoTitulo>Movimento</GrupoTitulo>
          <Section rows={[
            { k: 'Sentido do giro', v: str('sentido') ?? '—', mute: true },
            { k: "Lâmina d'água", sub: 'Define a velocidade do percurso', v: `${fmt(num('lamina'), 0)} mm` },
          ]} />

          {/* HORÁRIOS (UI — em construção) */}
          <GrupoTitulo>Horários</GrupoTitulo>
          <LinhaControle label="Bloquear no horário de ponta">
            <Toggle on={bloqPonta} onChange={() => setBloqPonta((v) => !v)} />
          </LinhaControle>
          <div className="mt-2">
            <Section rows={[
              { k: 'Horário de ponta', v: str('horario_ponta') ?? '18:00 – 21:00', mute: true },
              { k: 'Horário reservado', v: str('horario_reservado') ?? '21:30 – 06:00', mute: true },
            ]} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">Sentido, lâmina e horários serão editáveis e persistidos aqui — dependem do controlador do pivô. Interface pronta; comportamento em construção.</p>
        </>
      ) : (
        <>
          {/* ESTADO */}
          <GrupoTitulo>Estado</GrupoTitulo>
          <EstadoHero
            label={!online ? 'Sem comunicação' : semAgua ? 'Girando sem água' : irrigando ? 'Irrigando' : 'Desligado'}
            tone={!online ? 'off' : semAgua ? 'warn' : irrigando ? 'ok' : 'off'}
          />
          <div className="mt-2">
            <Section rows={[
              { k: 'Posição', v: posicao != null ? `${fmt(posicao, 0)}° de 270°` : '—' },
              { k: 'Sentido do giro', v: str('sentido') ?? '—', mute: true },
              { k: "Lâmina ajustada", v: `${fmt(num('lamina'), 0)} mm` },
              { k: 'Bombeamento', v: str('bombeamento') ?? '—', mute: true },
            ]} />
          </div>

          {/* CONTROLES */}
          <GrupoTitulo>Controles</GrupoTitulo>
          <div className="flex gap-2">
            <button className="flex-1 py-2.5 rounded-lg border font-semibold text-sm" disabled>Desligar</button>
            <button className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-60" style={{ background: '#177A3C' }} disabled>Ligar</button>
          </div>
          <p className="text-[11px] text-amber-600 mt-1.5">Comando do pivô ainda não vinculado — em construção.</p>

          {/* GIRAR SEM ÁGUA (UI — em construção) */}
          <div className="mt-3">
            <LinhaControle label="Girar sem água" sub="Move o pivô sem irrigar">
              <Toggle on={semAguaUi} onChange={() => setSemAguaUi((v) => !v)} />
            </LinhaControle>
          </div>

          {/* ENERGIA */}
          <GrupoTitulo right={
            <button type="button" onClick={() => setFf((v) => !v)} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">{ff ? 'FF' : 'FN'}</button>
          }>Energia</GrupoTitulo>
          <FasesTable head={['Fase', 'Tensão', 'Corrente']} rows={fasesFN} />
          <div className="mt-2">
            <Section rows={[{ k: 'Potência', v: `${fmt(pt != null ? pt / (pt > 1000 ? 1000 : 1) : null)} kW` }]} />
          </div>

          {/* STATUS */}
          <GrupoTitulo>Status do pivô</GrupoTitulo>
          <Section rows={[
            { k: 'Pressurizado', v: flag(num('pressurizado')) },
            { k: 'Tensão', v: flag(num('tensao_ok')) },
            { k: 'Segurança', v: flag(num('seguranca_ok')) },
          ]} />
          <p className="text-[11px] text-muted-foreground mt-2">Posição, lâmina, bombeamento e status dependem da integração com o controlador do pivô — em construção.</p>
        </>
      )}
    </SheetShell>
  );
}

export default PivoSheet;
