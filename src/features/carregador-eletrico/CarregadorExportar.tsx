import { useEffect, useMemo, useState } from 'react';
import { api } from '@/config/api';
import { fmt } from '@/features/supervisorio/v2/components/sheets/sheetParts';
import { brl, unwrap } from '@/features/supervisorio/v2/components/sheets/equipUi';
import { NX, NxDialog, NxDialogHead, NxSeg } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { MES, MES_LONGO, erroMsg, ymd, type DetalheExport, type LinhaExport } from './carregador.util';

/**
 * Diálogo "Exportar recargas": planilha (Excel ou CSV) para a contabilidade cobrar no boleto do
 * condomínio. GET /carregador-eletrico/export do mês escolhido. Saiu do CarregadorModal como
 * estava (NEXON-130 só separou os arquivos); o mês e o formato ficam enquanto o modal está aberto.
 */

const EXP_COLS = '1.6fr 0.8fr 1fr 1fr';

export function CarregadorExportar({ open, onClose, plantaId, nome, vagaNum, tarifa }: {
  open: boolean; onClose: () => void; plantaId?: string;
  /** Nome do carregador e número da vaga (se o nome tiver): entram no nome do arquivo. */
  nome?: string; vagaNum: string | null;
  /** Valor do kWh cadastrado: só para o texto de apoio. */
  tarifa: number | null;
}) {
  const mesesOpc = useMemo(() => {
    const h = new Date();
    return [2, 1, 0].map((k) => new Date(h.getFullYear(), h.getMonth() - k, 1));
  }, []);
  const [mesExp, setMesExp] = useState(() => ymd(mesesOpc[1]));
  const [formato, setFormato] = useState<'xlsx' | 'csv'>('xlsx');
  const [exp, setExp] = useState<{ csv?: string; linhas: LinhaExport[]; detalhe: DetalheExport[] } | null>(null);
  const [baixado, setBaixado] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setExp(null); setBaixado(''); setErro('');
    api.get('/carregador-eletrico/export', { params: { mes: mesExp, plantaId } })
      .then((r) => {
        if (!vivo) return;
        const d = unwrap<{ csv?: string; linhas?: LinhaExport[]; detalhe?: DetalheExport[] }>(r);
        setExp({ csv: d?.csv, linhas: d?.linhas ?? [], detalhe: d?.detalhe ?? [] });
      })
      .catch((e) => { if (vivo) { setExp({ linhas: [], detalhe: [] }); setErro(erroMsg(e, 'Falha ao montar a planilha')); } });
    return () => { vivo = false; };
  }, [open, mesExp, plantaId]);

  const mesSel = mesesOpc.find((d) => ymd(d) === mesExp) ?? mesesOpc[1];
  const mesIdx = mesesOpc.indexOf(mesSel);
  const monthLabel = `${MES_LONGO[mesSel.getMonth()]}/${mesSel.getFullYear()}${mesIdx === 2 ? ' (parcial)' : ''}`;
  const sumRows = (exp?.linhas ?? []).map((r) => ({
    apto: `${r.apartamento ? `${r.apartamento} · ` : ''}${r.morador ?? '—'}`, n: r.recargas ?? null, kwh: Number(r.kwh || 0), rs: Number(r.valor_reais || 0),
  }));
  const sessCount = exp ? sumRows.reduce((a, r) => a + (r.n ?? 0), 0) : null;
  const totKwh = sumRows.reduce((a, r) => a + r.kwh, 0);
  const totRs = sumRows.reduce((a, r) => a + r.rs, 0);
  const slug = vagaNum ? `vaga${vagaNum}`.toLowerCase()
    : (nome || 'carregador').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nomeArq = `recargas-${slug}-${MES[mesSel.getMonth()].toLowerCase()}-${mesSel.getFullYear()}`;

  const baixar = async () => {
    if (!exp) return;
    try {
      if (formato === 'csv') {
        const blob = new Blob([exp.csv ?? ''], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `${nomeArq}.csv`; a.click(); URL.revokeObjectURL(url);
        setBaixado(`${nomeArq}.csv`);
      } else {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const resumo = exp.linhas.map((r) => ({
          Apartamento: r.apartamento ?? '', Morador: r.morador ?? '—', Recargas: r.recargas ?? '',
          'Energia (kWh)': Number(r.kwh), 'Ocioso (min)': Number(r.ocioso_min), 'Valor estimado (R$)': Number(r.valor_reais),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo por apartamento');
        const detalhe = exp.detalhe.map((x) => {
          const min = Number(x.duracao_min ?? 0);
          return {
            Apto: x.apartamento ?? '', Morador: x.morador ?? '—', Vaga: x.vaga ?? '',
            'Início': x.inicio ?? '', Fim: x.fim ?? '', 'Duração': `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`,
            kWh: Number(x.kwh), 'R$/kWh': x.tarifa_kwh != null ? Number(x.tarifa_kwh) : '', 'Valor (R$)': Number(x.valor_reais),
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhe), 'Detalhe por recarga');
        XLSX.writeFile(wb, `${nomeArq}.xlsx`);
        setBaixado(`${nomeArq}.xlsx`);
      }
    } catch (e) { setErro(erroMsg(e, 'Falha ao gerar a planilha')); }
  };

  return (
    <NxDialog open={open} onClose={onClose} label="Exportar recargas" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <NxDialogHead title="Exportar recargas" sub="Para a contabilidade cobrar no boleto do condomínio" onClose={onClose} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Mês de referência</span>
          <NxSeg value={mesExp} onChange={(v) => { setMesExp(v); setBaixado(''); }}
            options={mesesOpc.map((d, i) => ({ v: ymd(d), label: `${MES[d.getMonth()]}${i === 2 ? ' (parcial)' : ''}` }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Formato</span>
          <NxSeg value={formato} onChange={(v) => { setFormato(v); setBaixado(''); }} options={[{ v: 'xlsx', label: 'Excel (.xlsx)' }, { v: 'csv', label: 'CSV' }]} />
        </div>
        <div style={{ border: `1px solid ${NX.borda}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: NX.caixa, gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Resumo por apartamento · {monthLabel}</span>
            <span style={{ fontSize: 12, color: NX.mudo, whiteSpace: 'nowrap' }}>{exp ? `${sessCount ?? '—'} recargas` : '…'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: EXP_COLS, gap: 10, padding: '8px 14px', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, borderTop: `1px solid ${NX.linha2}` }}>
            <span>APARTAMENTO</span><span style={{ textAlign: 'right' }}>RECARGAS</span><span style={{ textAlign: 'right' }}>ENERGIA</span><span style={{ textAlign: 'right' }}>VALOR</span>
          </div>
          {!exp && <div style={{ padding: '8px 14px', fontSize: 14, color: NX.mudo, borderTop: `1px solid ${NX.linha}` }}>Carregando…</div>}
          {exp && sumRows.length === 0 && <div style={{ padding: '8px 14px', fontSize: 14, color: NX.mudo, borderTop: `1px solid ${NX.linha}` }}>Sem recargas encerradas no mês.</div>}
          {sumRows.map((r, i) => (
            <div key={`${r.apto}-${i}`} style={{ display: 'grid', gridTemplateColumns: EXP_COLS, gap: 10, padding: '8px 14px', fontSize: 14, borderTop: `1px solid ${NX.linha}` }}>
              <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.apto}>{r.apto}</span>
              <span style={{ textAlign: 'right' }}>{r.n ?? '—'}</span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.kwh, 1)} kWh</span>
              <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(r.rs)}</span>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: EXP_COLS, gap: 10, padding: '10px 14px', fontSize: 14, fontWeight: 800, borderTop: `2px solid ${NX.texto}` }}>
            <span>Total</span><span style={{ textAlign: 'right' }}>{sessCount ?? '—'}</span><span style={{ textAlign: 'right' }}>{fmt(totKwh, 1)} kWh</span><span style={{ textAlign: 'right' }}>{brl(totRs)}</span>
          </div>
        </div>
        <div style={{ background: NX.caixa, borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: NX.caixaTx }}>
          <span><b>A planilha tem 2 abas:</b> Resumo por apartamento e Detalhe por recarga (apto, morador, vaga, início, fim, duração, kWh, R$/kWh, valor).</span>
          <span>Valores estimados: kWh medido × {tarifa != null ? `${brl(tarifa)}/kWh` : 'valor do kWh'} cadastrado no carregador.</span>
          <span>Recarga é atribuída ao mês em que <b>começou</b>. Recargas em andamento ficam para o mês seguinte.</span>
        </div>
        {erro && <span role="alert" style={{ fontSize: 13, color: NX.bad }}>{erro}</span>}
        <button type="button" onClick={baixar} disabled={!exp}
          style={{ height: 48, borderRadius: 12, fontSize: 16, fontWeight: 800, textAlign: 'center', color: '#FFFFFF', background: baixado ? '#2E8B47' : NX.acao, opacity: exp ? 1 : 0.6 }}>
          {baixado ? `✓ Download iniciado: ${baixado}` : 'Baixar planilha'}
        </button>
      </div>
    </NxDialog>
  );
}
