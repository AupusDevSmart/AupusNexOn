/**
 * Relatório de geração (1 página) — fiel ao mockup aprovado do NEXON-33.
 * Gráfico em SVG inline de documento impresso (a ADR 0001/bklit cobre os gráficos do app).
 */
import type { RelatorioGeracao } from './tipos';
import {
  Amostra, BarraEmpilhada, Bloco, BlocoChamados, BlocoTabela, CabecalhoRelatorio, Duas, GradeIndicadores, Leitura, LegendaTopo, LinhaLegenda, PaginaA4, Rodape, SemDados, Trilho, V,
} from './documento';
import { cabecalhoGrade, cel, celD, linhaGrade } from './estilos';
import { COR } from './tema';
import { TRACO, desvio, mesExtenso, nf } from './formatos';
import {
  DIARIO, destinoTexto, graficoDiario, indicadoresGeracao, perdas, rankingInversores, subtituloGeracao,
} from './derivar-geracao';

export function RelatorioGeracaoDoc({ dados: d }: { dados: RelatorioGeracao }) {
  const c = d.cabecalho;
  const g = graficoDiario(d);
  const pd = perdas(d);
  const rk = rankingInversores(d);
  const auto = d.autoconsumoKwh, inj = d.injetadaKwh;
  const destinoTotal = (auto ?? 0) + (inj ?? 0);
  const colRk = '130px 70px minmax(0, 1fr) 70px 210px';
  return (
    <PaginaA4 gap={18} rotulo="Relatório de geração">
      <CabecalhoRelatorio rotulo="RELATÓRIO DE GERAÇÃO" titulo={`${c.plantaNome} · ${c.unidadeNome}`} subtitulo={subtituloGeracao(d, mesExtenso(c.mes))} />
      <GradeIndicadores itens={indicadoresGeracao(d)} />

      <Bloco
        titulo="Geração diária × esperado"
        padding="12px 14px 10px"
        gap={6}
        direita={
          <LegendaTopo
            itens={[
              { amostra: <Amostra cor={COR.ok} w={10} h={10} />, texto: 'Gerado' },
              ...(d.fonteEsperado
                ? [
                    { amostra: <Amostra cor={COR.texto} w={12} h={2} raio={0} />, texto: 'Esperado' },
                    { amostra: <Amostra cor={COR.alerta} w={10} h={10} />, texto: 'Abaixo de 90%' },
                  ]
                : []),
            ]}
          />
        }
      >
        {g ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 9, color: COR.secundario, textAlign: 'right', height: 150 }}>
                {g.rotuloY.map((r, i) => <span key={i}>{r}</span>)}
              </div>
              <svg viewBox={`0 0 ${DIARIO.largura} ${DIARIO.altura}`} width="100%" height="150" preserveAspectRatio="none" role="img" aria-label={g.aria}>
                <line x1="0" x2={DIARIO.largura} y1="75" y2="75" stroke={COR.linha} />
                <line x1="0" x2={DIARIO.largura} y1="149" y2="149" stroke={COR.eixo} />
                {g.barras.map((b) => (
                  <g key={b.dia}>
                    {b.y != null && <rect x={b.x.toFixed(1)} y={b.y.toFixed(1)} width={b.w.toFixed(1)} height={b.h.toFixed(1)} rx="2" fill={b.cor} />}
                    {b.ey != null && <rect x={b.ex.toFixed(1)} y={b.ey.toFixed(1)} width={b.ew.toFixed(1)} height="2" fill={COR.texto} />}
                  </g>
                ))}
              </svg>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 4, fontSize: 9, color: COR.secundario }}>
              <span />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {g.marcas.map((m) => <span key={m}>{m}</span>)}
              </div>
            </div>
            <Leitura>{g.leitura}</Leitura>
          </>
        ) : (
          <SemDados />
        )}
      </Bloco>

      <Duas>
        <Bloco titulo="Onde a energia ficou" resumo={pd ? `${nf(pd.total)} kWh abaixo do esperado` : undefined}>
          {pd && pd.total > 0 ? (
            <>
              <BarraEmpilhada
                rotulo={`Perdas do mês: ${pd.itens.map((x) => `${x.rotulo.toLowerCase()} ${nf(x.kwh)} kWh`).join(', ')}`}
                segmentos={pd.itens.map((x) => ({ valor: x.kwh, cor: x.cor }))}
              />
              {pd.itens.map((x) => (
                <LinhaLegenda key={x.rotulo} cor={x.cor} texto={x.rotulo} nota={x.nota} valor={`${nf(x.kwh)} kWh`} />
              ))}
            </>
          ) : (
            <SemDados texto={pd ? 'Sem perdas no período' : 'Sem dados no período'} />
          )}
        </Bloco>
        <Bloco titulo="Destino da energia gerada">
          {auto != null && inj != null && destinoTotal > 0 ? (
            <>
              <BarraEmpilhada
                rotulo={`Destino da energia: ${nf((auto / destinoTotal) * 100)}% consumida no local, ${nf((inj / destinoTotal) * 100)}% injetada na rede`}
                segmentos={[{ valor: auto, cor: COR.ok }, { valor: inj, cor: COR.serie }]}
              />
              <LinhaLegenda cor={COR.ok} texto="Consumida no local (autoconsumo)" valor={`${nf((auto / destinoTotal) * 100)}% · ${nf(auto)} kWh`} />
              <LinhaLegenda cor={COR.serie} texto="Injetada na rede" valor={`${nf((inj / destinoTotal) * 100)}% · ${nf(inj)} kWh`} />
              {destinoTexto(d) && <Leitura>{destinoTexto(d)}</Leitura>}
            </>
          ) : (
            <SemDados />
          )}
        </Bloco>
      </Duas>

      <BlocoTabela titulo="Inversores com menor rendimento" resumo={rk ? `média dos ${rk.total} inversores: ${nf(rk.media)} kWh/kWp` : undefined}>
        {rk ? (
          <>
            <div style={cabecalhoGrade(colRk)}>
              <span style={cel('7px 6px 7px 14px')}>INVERSOR</span>
              <span style={celD('7px 4px')}>kWh/kWp</span>
              <span style={cel('7px 10px')} />
              <span style={celD('7px 4px')}>vs MÉDIA</span>
              <span style={cel('7px 14px 7px 8px')}>PROVÁVEL CAUSA</span>
            </div>
            {rk.linhas.map((r, i) => (
              <div key={r.nome} className="rel-op-linha" style={linhaGrade(colRk, i, 11.5, false)}>
                <span style={cel('7px 6px 7px 14px', { fontWeight: 800 })}>{r.nome}</span>
                <span style={celD('7px 4px')}>{nf(r.valor)}</span>
                <span style={cel('7px 10px')}><Trilho pct={r.pct} cor={r.alerta ? COR.alerta : COR.ok} /></span>
                <span style={celD('7px 4px', { fontWeight: 800, color: r.alerta ? COR.alerta : COR.secundario })}>{desvio(r.desvio)}</span>
                <span style={cel('7px 14px 7px 8px', { color: COR.secundario })}><V t={r.causa ?? TRACO} /></span>
              </div>
            ))}
          </>
        ) : (
          <div style={{ borderTop: `1px solid ${COR.linha}`, padding: '10px 14px 12px' }}>
            <SemDados />
          </div>
        )}
      </BlocoTabela>

      <BlocoChamados chamados={d.chamados} fim={c.fim} larguraEquip={130} />

      <Rodape
        premissas={[
          d.fonteEsperado === 'satelite'
            ? 'Esperado calculado com irradiância de satélite (erro típico de 5–10% no dia).'
            : 'Sem estimativa de esperado para esta usina.',
          d.tarifaReferencia != null ? 'R$ exibido porque "Exibir valores em R$" está ligado nesta instalação.' : null,
        ].filter(Boolean).join(' ')}
        geradoEm={c.geradoEm}
        pagina={1}
        total={1}
      />
    </PaginaA4>
  );
}
