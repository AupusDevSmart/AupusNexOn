/**
 * Relatório de irrigação (2 páginas) — fiel ao mockup aprovado do NEXON-33.
 * Os gráficos são SVG inline de documento impresso: a ADR 0001 (bklit) vale para gráficos
 * do app; figuras de relatório A4 seguem o padrão de formatação dos relatórios.
 */
import type { RelatorioIrrigacao } from './tipos';
import {
  Amostra, BarraEmpilhada, Bloco, BlocoChamados, CabecalhoRelatorio, Duas, GradeIndicadores, Leitura, LegendaTopo, LinhaLegenda, PaginaA4, Rodape, SemDados, TituloBloco, V,
} from './documento';
import { ALERTA, NUM, cel, celD, cabecalhoGrade, linhaGrade, totalGrade } from './estilos';
import { COR, COR_POSTO } from './tema';
import { TRACO, dataHora, duracaoMin, juntarE, mesExtenso, nf, nfOu } from './formatos';
import {
  TL_LARGURA, calcularPivos, celulaChamados, destaquesIrrigacao, indicadoresIrrigacao, linhaDoTempo, ocorrencias,
  postoPct, setores, subtituloIrrigacao,
} from './derivar-irrigacao';

const ROTULO = 'RELATÓRIO DE IRRIGAÇÃO';

export function RelatorioIrrigacaoDoc({ dados }: { dados: RelatorioIrrigacao }) {
  return (
    <>
      <PaginaIrrigacao1 dados={dados} />
      <PaginaIrrigacao2 dados={dados} />
    </>
  );
}

function PaginaIrrigacao1({ dados: d }: { dados: RelatorioIrrigacao }) {
  const c = d.cabecalho;
  const comRs = d.tarifaKwh != null;
  const { pivos, totais: t } = calcularPivos(d);
  // Sem R$: a coluna R$/mm/ha sai e o espaço vai para a cultura.
  const colunas = comRs
    ? '66px 46px 56px 44px 56px 50px 48px 62px 62px 58px 52px 46px minmax(0, 1fr)'
    : '66px 46px minmax(0, 1fr) 44px 56px 50px 48px 62px 62px 52px 46px 52px';
  const posto = postoPct(d);
  const destaques = destaquesIrrigacao(d);
  const td = '7px 4px';
  return (
    <PaginaA4 gap={22} rotulo="Relatório de irrigação, página 1">
      <CabecalhoRelatorio
        rotulo={ROTULO}
        titulo={`${c.plantaNome} · ${c.unidadeNome}`}
        subtitulo={subtituloIrrigacao(d, mesExtenso(c.mes))}
        margemRegra={-8}
      />
      <GradeIndicadores itens={indicadoresIrrigacao(d)} />

      <div className="rel-op-bloco" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <TituloBloco tamanho={16}>Por pivô</TituloBloco>
          <span style={{ fontSize: 11, color: COR.secundario }}>kWh/mm/ha: energia para aplicar 1 mm em 1 ha — quanto menor, melhor</span>
        </div>
        <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={cabecalhoGrade(colunas)}>
            <span style={cel('8px 6px 8px 10px')}>PIVÔ</span>
            <span style={celD('8px 4px')}>ÁREA ha</span>
            <span style={cel('8px 4px')}>CULTURA</span>
            <span style={celD('8px 4px')}>VOLTAS</span>
            <span style={celD('8px 4px')}>LÂMINA mm</span>
            <span style={celD('8px 4px')}>PROG. %</span>
            <span style={celD('8px 4px')}>HORAS</span>
            <span style={celD('8px 4px')}>kWh</span>
            <span style={celD('8px 4px')}>kWh/mm/ha</span>
            {comRs && <span style={celD('8px 4px')}>R$/mm/ha</span>}
            <span style={celD('8px 4px')}>PARADAS</span>
            <span style={celD('8px 4px')}>CHAM.</span>
            <span style={celD('8px 8px 8px 4px')}>DISP.</span>
          </div>
          {pivos.length === 0 && (
            <div style={{ borderTop: `1px solid ${COR.linha}`, padding: '8px 10px' }}>
              <SemDados />
            </div>
          )}
          {pivos.map((p, i) => {
            const ch = celulaChamados(p.pivo.chamados);
            return (
              <div key={p.pivo.equipamentoId} className="rel-op-linha" style={linhaGrade(colunas, i)}>
                <span style={cel('7px 6px 7px 10px', { fontWeight: 800 })}>{p.pivo.nome}</span>
                <span style={celD(td)}><V t={nfOu(p.pivo.areaHa)} /></span>
                <span style={cel(td, { color: COR.secundario, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                  <V t={p.pivo.cultura ?? TRACO} />
                </span>
                <span style={celD(td)}><V t={nfOu(p.pivo.voltas)} /></span>
                <span style={celD(td, { fontWeight: 700 })}><V t={nfOu(p.pivo.laminaMm)} /></span>
                <span style={celD(td, p.alertaProg ? ALERTA : undefined)}><V t={p.progPct != null ? `${nf(p.progPct)}%` : TRACO} /></span>
                <span style={celD(td)}>{nf(p.pivo.horas)}</span>
                <span style={celD(td)}><V t={nfOu(p.pivo.kwh)} /></span>
                <span style={celD(td, p.alertaEf ? ALERTA : undefined)}><V t={nfOu(p.eficiencia, 2)} /></span>
                {comRs && <span style={celD(td)}><V t={nfOu(p.rsMmHa, 2)} /></span>}
                <span style={celD(td, p.alertaParadas ? ALERTA : undefined)}>{p.pivo.paradas}</span>
                <span style={celD(td, { color: ch.cor, fontWeight: ch.texto === TRACO ? 400 : 800 })}>{ch.texto}</span>
                <span style={celD('7px 8px 7px 4px')}>
                  <V t={p.pivo.disponibilidadePct != null ? `${nf(p.pivo.disponibilidadePct)}%` : TRACO} />
                </span>
              </div>
            );
          })}
          <div style={totalGrade(colunas)}>
            <span style={cel('8px 6px 8px 10px')}>Total</span>
            <span style={celD('8px 4px')}>{nf(t.areaHa)}</span>
            <span style={cel('8px 4px')} />
            <span style={celD('8px 4px')}><V t={nfOu(t.voltas)} /></span>
            <span style={celD('8px 4px')}><V t={nfOu(t.laminaMedia, 1)} /></span>
            <span style={celD('8px 4px')}><V t={t.progPct != null ? `${nf(t.progPct)}%` : TRACO} /></span>
            <span style={celD('8px 4px')}>{nf(t.horas)}</span>
            <span style={celD('8px 4px')}><V t={nfOu(t.kwh)} /></span>
            <span style={celD('8px 4px')}><V t={nfOu(t.eficienciaMedia, 2)} /></span>
            {comRs && <span style={celD('8px 4px')}><V t={nfOu(t.rsMmHa, 2)} /></span>}
            <span style={celD('8px 4px')}>{t.paradas}</span>
            <span style={celD('8px 4px')}>{t.chamados}</span>
            <span style={celD('8px 8px 8px 4px')}>
              <V t={t.disponibilidadePct != null ? `${nf(t.disponibilidadePct)}%` : TRACO} />
            </span>
          </div>
        </div>
      </div>

      <Duas>
        <Bloco titulo="Energia por horário tarifário" padding="14px 16px" gap={10}>
          {posto && d.energiaPorPosto ? (
            <>
              <BarraEmpilhada
                altura={16}
                raio={5}
                rotulo={`Energia por horário: ponta ${nf(posto.ponta, 1)}%, fora de ponta ${nf(posto.foraPonta, 1)}%, reservado ${nf(posto.reservado, 1)}%`}
                segmentos={[
                  { valor: d.energiaPorPosto.pontaKwh, cor: COR_POSTO.ponta },
                  { valor: d.energiaPorPosto.foraPontaKwh, cor: COR_POSTO.foraPonta },
                  { valor: d.energiaPorPosto.reservadoKwh, cor: COR_POSTO.reservado },
                ]}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <LinhaLegenda cor={COR_POSTO.ponta} texto="Ponta" valor={`${nf(posto.ponta, 1)}% · ${nf(d.energiaPorPosto.pontaKwh)} kWh`} />
                <LinhaLegenda cor={COR_POSTO.foraPonta} texto="Fora de ponta" valor={`${nf(posto.foraPonta, 1)}% · ${nf(d.energiaPorPosto.foraPontaKwh)} kWh`} />
                <LinhaLegenda cor={COR_POSTO.reservado} texto="Reservado (noturno)" valor={`${nf(posto.reservado, 1)}% · ${nf(d.energiaPorPosto.reservadoKwh)} kWh`} />
              </div>
            </>
          ) : (
            <SemDados />
          )}
        </Bloco>
        <Bloco titulo="Destaques do mês" padding="14px 16px" gap={8}>
          {destaques.length === 0 ? (
            <SemDados />
          ) : (
            destaques.map((x, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
                <b style={{ color: x.cor, flex: 'none' }}>●</b>
                <span>
                  {x.negrito && <b>{x.negrito}</b>}
                  {x.texto}
                </span>
              </div>
            ))
          )}
        </Bloco>
      </Duas>

      <Rodape
        premissas={`CHAM.: chamados no mês (ab. = em aberto, ✓ = atendido; detalhe na página 2). Lâmina e volume estimados pela velocidade e vazão nominal de cada pivô.${comRs ? ' R$ estimados com a tarifa cadastrada (com impostos).' : ''}`}
        geradoEm={c.geradoEm}
        pagina={1}
        total={2}
      />
    </PaginaA4>
  );
}

function PaginaIrrigacao2({ dados: d }: { dados: RelatorioIrrigacao }) {
  const c = d.cabecalho;
  const tl = linhaDoTempo(d);
  const st = setores(d);
  const oc = ocorrencias(d);
  const colOc = '78px 52px minmax(0, 1fr) 64px 58px';
  return (
    <PaginaA4 gap={18} rotulo="Relatório de irrigação, página 2">
      <CabecalhoRelatorio rotulo={ROTULO} titulo={`${c.plantaNome} · ${c.unidadeNome} · ${mesExtenso(c.mes)}`} compacto />

      <div className="rel-op-bloco" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <TituloBloco tamanho={16}>{tl ? `Linha do tempo · semana de ${tl.periodo}` : 'Linha do tempo da semana'}</TituloBloco>
          {tl && (
            <LegendaTopo
              itens={[
                { amostra: <Amostra cor={COR.ok} w={12} h={8} />, texto: 'Irrigando' },
                { amostra: <Amostra cor={COR.alerta} w={12} h={8} />, texto: 'Irrigando na ponta' },
                { amostra: <Amostra cor={COR.faixaPonta} w={12} h={8} />, texto: 'Horário de ponta' },
                { amostra: <Amostra cor={COR.texto} w={3} h={10} raio={0} />, texto: 'Parada' },
              ]}
            />
          )}
        </div>
        <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 10, padding: '10px 12px 8px' }}>
          {!tl || tl.linhas.length === 0 ? (
            <SemDados />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr)', alignItems: 'end' }}>
                <span />
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tl.dias.length}, minmax(0, 1fr))`, fontSize: 10, fontWeight: 700, color: COR.secundario }}>
                  {tl.dias.map((x) => (
                    <span key={x} style={{ paddingLeft: 3, borderLeft: `1px solid ${COR.borda}` }}>{x}</span>
                  ))}
                </div>
              </div>
              {tl.linhas.map((r) => (
                <div key={r.nome} style={{ display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr)', alignItems: 'center', height: 22 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</span>
                  <svg viewBox={`0 0 ${TL_LARGURA} 14`} width="100%" height="14" preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
                    {tl.faixas.map((b, i) => (
                      <rect key={`f${i}`} x={b.x.toFixed(1)} y="0" width={b.w.toFixed(1)} height="14" fill={COR.faixaPonta} />
                    ))}
                    {r.segmentos.map((s, i) => (
                      <rect key={`s${i}`} x={s.x.toFixed(1)} y="2" width={s.w.toFixed(1)} height="10" rx="1.5" fill={s.cor} />
                    ))}
                    {r.paradas.map((x, i) => (
                      <rect key={`p${i}`} x={x.toFixed(1)} y="0" width="2.4" height="14" fill={COR.texto} />
                    ))}
                  </svg>
                </div>
              ))}
            </>
          )}
        </div>
        {tl && tl.linhas.length > 0 && <Leitura>{tl.leitura}</Leitura>}
      </div>

      <Duas colunas="300px minmax(0, 1fr)" gap={16}>
        <Bloco titulo={st ? `Lâmina por setor · ${st.pivo}` : 'Lâmina por setor'} padding="14px 16px" gap={8} style={{ alignItems: 'center' }}>
          {st ? (
            <>
              <svg
                viewBox="0 0 240 240"
                width="220"
                height="220"
                role="img"
                aria-label={
                  st.leitura
                    ? `Lâmina aplicada por setor do ${st.pivo}; setores de ${st.leitura.faixa} receberam ${st.leitura.valores}`
                    : `Lâmina aplicada por setor do ${st.pivo}; sem setor abaixo de 85% do programado`
                }
              >
                {st.fatias.map((w, i) => (
                  <path key={i} d={w.d} fill={w.cor} stroke="#FFFFFF" strokeWidth="2" />
                ))}
                <circle cx="120" cy="120" r="26" fill="#FFFFFF" stroke={COR.borda} />
                <path d="M120 4 L120 14" stroke={COR.texto} strokeWidth="2" />
              </svg>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: COR.secundario, alignSelf: 'stretch' }}>
                <span>0 mm</span>
                <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#EEF3FD,#1F4FB8)' }} />
                <span>{nf(st.max)} mm</span>
              </div>
              <span style={{ fontSize: 11, lineHeight: 1.4, color: COR.texto, alignSelf: 'stretch' }}>
                {st.leitura ? (
                  <>
                    Setores de <b>{st.leitura.faixa}</b> receberam {st.leitura.valores} contra {st.leitura.programado} programados
                    {st.motivo && st.datas.length ? `: paradas por ${st.motivo.toLowerCase()} em ${juntarE(st.datas)}.` : '.'}
                  </>
                ) : (
                  'Lâmina uniforme: nenhum setor abaixo de 85% do programado.'
                )}
              </span>
            </>
          ) : (
            <SemDados style={{ alignSelf: 'flex-start' }} />
          )}
        </Bloco>

        <div className="rel-op-bloco" style={{ border: `1px solid ${COR.borda}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <TituloBloco>Ocorrências</TituloBloco>
            <span style={{ fontSize: 11, color: COR.secundario }}>{oc.resumo}</span>
          </div>
          {oc.linhas.length === 0 ? (
            <div style={{ borderTop: `1px solid ${COR.linha}`, padding: '10px 16px' }}>
              <SemDados texto="Nenhuma parada no período" />
            </div>
          ) : (
            <>
              <div style={cabecalhoGrade(colOc)}>
                <span style={cel('7px 6px 7px 16px')}>DATA</span>
                <span style={cel('7px 4px')}>PIVÔ</span>
                <span style={cel('7px 4px')}>MOTIVO</span>
                <span style={celD('7px 4px')}>DURAÇÃO</span>
                <span style={celD('7px 16px 7px 4px')}>mm</span>
              </div>
              {oc.linhas.map((o, i) => (
                <div key={i} className="rel-op-linha" style={{ display: 'grid', gridTemplateColumns: colOc, fontSize: 11, borderTop: `1px solid ${COR.linha}`, ...NUM }}>
                  <span style={cel('7px 6px 7px 16px')}>{dataHora(o.inicio)}</span>
                  <span style={cel('7px 4px', { fontWeight: 800 })}>{o.pivo}</span>
                  <span style={cel('7px 4px', o.problema ? { color: COR.alerta, fontWeight: 700 } : { color: COR.secundario })}>{o.motivo}</span>
                  <span style={celD('7px 4px')}>{duracaoMin(o.duracaoMin)}</span>
                  <span style={celD('7px 16px 7px 4px')}><V t={nfOu(o.mmPerdidos, 1)} /></span>
                </div>
              ))}
              <div style={{ marginTop: 'auto', borderTop: `1px solid ${COR.borda}`, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {oc.motivos.map((m) => (
                  <div key={m.motivo} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.motivo}</span>
                    <span style={{ flex: 1, height: 8, borderRadius: 4, background: COR.trilho, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', borderRadius: 4, width: `${m.pct.toFixed(0)}%`, background: m.cor }} />
                    </span>
                    <b style={{ width: 72, textAlign: 'right', ...NUM }}>{m.texto}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Duas>

      <BlocoChamados chamados={d.chamados} fim={c.fim} larguraEquip={70} />

      <Rodape
        premissas={'Lâmina por setor estimada pela velocidade e posição do pivô. "mm" nas ocorrências = lâmina que deixou de ser aplicada.'}
        geradoEm={c.geradoEm}
        pagina={2}
        total={2}
      />
    </PaginaA4>
  );
}
