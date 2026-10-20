/** Relatório de recargas do condomínio (1 página) — fiel ao mockup aprovado do NEXON-33. */
import type { RelatorioRecargas } from './tipos';
import {
  BlocoChamados, BlocoTabela, CabecalhoRelatorio, Duas, GradeIndicadores, PaginaA4, Rodape, SemDados,
} from './documento';
import { cabecalhoGrade, cel, celD, linhaGrade, totalGrade } from './estilos';
import { COR } from './tema';
import { duracaoMin, mesExtenso, nf, reais } from './formatos';
import { aptoCurto, aptoLongo, blocosCarregadores, indicadoresRecargas, porApartamento, subtituloRecargas, totaisRecargas } from './derivar-recargas';

export function RelatorioRecargasDoc({ dados: d }: { dados: RelatorioRecargas }) {
  const c = d.cabecalho;
  const comRs = d.valorKwh != null;
  const aptos = porApartamento(d);
  const t = totaisRecargas(d);
  const blocos = blocosCarregadores(d);
  const col = comRs ? '70px minmax(0, 1fr) 70px 80px 90px 100px' : '70px minmax(0, 1fr) 70px 80px 90px';
  const colC = comRs ? 'minmax(0, 1fr) 54px 62px 72px' : 'minmax(0, 1fr) 54px 62px';
  const fimLinha = (p: string) => (comRs ? cel(p) : cel(p.replace(/^(\S+) 4px/, '$1 14px')));
  return (
    <PaginaA4 gap={16} rotulo="Relatório de recargas">
      <CabecalhoRelatorio rotulo="RELATÓRIO DE RECARGAS" titulo={`${c.plantaNome} · ${c.unidadeNome}`} subtitulo={subtituloRecargas(d, mesExtenso(c.mes))} margemRegra={-4} />
      <GradeIndicadores itens={indicadoresRecargas(d)} />

      <BlocoTabela titulo="Cobrança por apartamento" tamanho={15} resumo={d.carregadores.length > 1 ? `soma dos ${d.carregadores.length} carregadores` : undefined}>
        {aptos.length === 0 ? (
          <div style={{ borderTop: `1px solid ${COR.linha}`, padding: '10px 14px 12px' }}>
            <SemDados texto="Nenhuma recarga no período" />
          </div>
        ) : (
          <>
            <div style={cabecalhoGrade(col)}>
              <span style={cel('7px 6px 7px 14px')}>APTO</span>
              <span style={cel('7px 6px')}>MORADOR</span>
              <span style={celD('7px 4px')}>RECARGAS</span>
              <span style={celD('7px 4px')}>kWh</span>
              <span style={{ ...fimLinha('7px 4px'), textAlign: 'right' }}>TEMPO</span>
              {comRs && <span style={celD('7px 14px 7px 4px')}>VALOR R$</span>}
            </div>
            {aptos.map((a, i) => (
              <div key={a.apartamento} className="rel-op-linha" style={linhaGrade(col, i, 12)}>
                <span style={cel('7px 6px 7px 14px', { fontWeight: 800 })}>{aptoCurto(a.apartamento)}</span>
                <span style={cel('7px 6px')}>{a.morador}</span>
                <span style={celD('7px 4px')}>{a.recargas}</span>
                <span style={celD('7px 4px')}>{nf(a.kwh, 1)}</span>
                <span style={{ ...fimLinha('7px 4px'), textAlign: 'right', color: COR.secundario }}>{duracaoMin(a.minutos)}</span>
                {comRs && <span style={celD('7px 14px 7px 4px', { fontWeight: 800 })}>{reais(a.valor ?? 0)}</span>}
              </div>
            ))}
            <div style={totalGrade(col, 12)}>
              <span style={cel('8px 6px 8px 14px')}>Total</span>
              <span style={cel('8px 6px')}>{t.apartamentos} {t.apartamentos === 1 ? 'apartamento' : 'apartamentos'}</span>
              <span style={celD('8px 4px')}>{t.recargas}</span>
              <span style={celD('8px 4px')}>{nf(t.kwh, 1)}</span>
              <span style={{ ...fimLinha('8px 4px'), textAlign: 'right' }}>{duracaoMin(t.minutos)}</span>
              {comRs && <span style={celD('8px 14px 8px 4px')}>{reais(t.valor ?? 0)}</span>}
            </div>
          </>
        )}
      </BlocoTabela>

      {blocos.length > 0 && (
        <Duas>
          {blocos.map((b) => (
            <div key={b.id} className="rel-op-bloco" style={{ border: `1px solid ${COR.borda}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{b.nome}</h2>
                  <span style={{ fontSize: 11, color: COR.secundario }}>{b.potencia}</span>
                </div>
                <span style={{ fontSize: 11, color: COR.secundario }}>{b.sub}</span>
              </div>
              <div style={cabecalhoGrade(colC)}>
                <span style={cel('6px 6px 6px 14px')}>MORADOR</span>
                <span style={celD('6px 4px')}>RECARG.</span>
                <span style={{ ...fimLinha('6px 4px'), textAlign: 'right' }}>kWh</span>
                {comRs && <span style={celD('6px 14px 6px 4px')}>R$</span>}
              </div>
              {b.linhas.length === 0 && (
                <div style={{ borderTop: `1px solid ${COR.linha}`, padding: '6px 14px' }}>
                  <SemDados texto="Nenhuma recarga no período" />
                </div>
              )}
              {b.linhas.map((r) => (
                <div key={r.apartamento} className="rel-op-linha" style={linhaGrade(colC, 0, 11, false)}>
                  <span style={cel('6px 6px 6px 14px', { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>
                    <b>{aptoLongo(r.apartamento)}</b> · {r.morador}
                  </span>
                  <span style={celD('6px 4px')}>{r.recargas}</span>
                  <span style={{ ...fimLinha('6px 4px'), textAlign: 'right' }}>{nf(r.kwh, 1)}</span>
                  {comRs && <span style={celD('6px 14px 6px 4px')}>{nf(r.valor ?? 0, 2)}</span>}
                </div>
              ))}
              <div style={{ ...totalGrade(colC, 11, '1.5px'), marginTop: 'auto' }}>
                <span style={cel('7px 6px 7px 14px')}>Subtotal</span>
                <span style={celD('7px 4px')}>{b.recargas}</span>
                <span style={{ ...fimLinha('7px 4px'), textAlign: 'right' }}>{nf(b.kwh, 1)}</span>
                {comRs && <span style={celD('7px 14px 7px 4px')}>{nf(b.valor ?? 0, 2)}</span>}
              </div>
            </div>
          ))}
        </Duas>
      )}

      <BlocoChamados chamados={d.chamados} fim={c.fim} larguraEquip={120} rotuloEquip="CARREGADOR" />

      <Rodape
        premissas={
          comRs
            ? 'Valores estimados: kWh medido no carregador × valor do kWh cadastrado. Recarga entra no mês em que começou. A cobrança é feita pelo condomínio no boleto. Planilha detalhada (XLSX) disponível na web.'
            : 'kWh medido no carregador. Recarga entra no mês em que começou. Planilha detalhada (XLSX) disponível na web.'
        }
        geradoEm={c.geradoEm}
        pagina={1}
        total={1}
      />
    </PaginaA4>
  );
}
