/**
 * Relatório de consumo (1 página) — fiel ao mockup aprovado do NEXON-33.
 * Gráficos em SVG inline de documento impresso (a ADR 0001/bklit cobre os gráficos do app).
 */
import type { RelatorioConsumo } from './tipos';
import {
  BarraEmpilhada, Bloco, BlocoChamados, CabecalhoRelatorio, Duas, GradeIndicadores, Leitura, LegendaTopo, LinhaLegenda, PaginaA4, Rodape, SemDados, Trilho,
} from './documento';
import { NUM } from './estilos';
import { COR, COR_POSTO } from './tema';
import { dataHora, mesAbrev, mesExtenso, nf } from './formatos';
import {
  CURVA, DEMANDA, balanco, faixaCargaBase, graficoCurva, graficoDemanda, indicadoresConsumo, leituraPosto, postoConsumo,
  subtituloConsumo,
} from './derivar-consumo';

export function RelatorioConsumoDoc({ dados: d }: { dados: RelatorioConsumo }) {
  const c = d.cabecalho;
  const posto = postoConsumo(d);
  const dem = graficoDemanda(d);
  const curva = graficoCurva(d);
  const bal = balanco(d);
  const totalCons = d.consumoTotalKwh ?? d.maioresConsumidores.reduce((s, x) => s + x.kwh, 0);
  const maiorCons = Math.max(1, ...d.maioresConsumidores.map((x) => x.kwh));
  const faixa = faixaCargaBase(d);
  const leitura = leituraPosto(d);
  return (
    <PaginaA4 gap={16} rotulo="Relatório de consumo">
      <CabecalhoRelatorio rotulo="RELATÓRIO DE CONSUMO" titulo={`${c.plantaNome} · ${c.unidadeNome}`} subtitulo={subtituloConsumo(d, mesExtenso(c.mes))} margemRegra={-4} />
      <GradeIndicadores itens={indicadoresConsumo(d)} />

      <Duas>
        <Bloco titulo="Energia da rede por horário">
          {posto && d.energiaPorPosto ? (
            <>
              <BarraEmpilhada
                rotulo={`Energia da rede por horário: ponta ${nf(posto.ponta, 1)}%, fora de ponta ${nf(posto.foraPonta, 1)}%, reservado ${nf(posto.reservado, 1)}%`}
                segmentos={[
                  { valor: d.energiaPorPosto.pontaKwh, cor: COR_POSTO.ponta },
                  { valor: d.energiaPorPosto.foraPontaKwh, cor: COR_POSTO.foraPonta },
                  { valor: d.energiaPorPosto.reservadoKwh, cor: COR_POSTO.reservado },
                ]}
              />
              <LinhaLegenda cor={COR_POSTO.ponta} texto="Ponta" valor={`${nf(posto.ponta, 1)}% · ${nf(d.energiaPorPosto.pontaKwh)} kWh`} />
              <LinhaLegenda cor={COR_POSTO.foraPonta} texto="Fora de ponta" valor={`${nf(posto.foraPonta, 1)}% · ${nf(d.energiaPorPosto.foraPontaKwh)} kWh`} />
              <LinhaLegenda cor={COR_POSTO.reservado} texto="Reservado (noturno)" valor={`${nf(posto.reservado, 1)}% · ${nf(d.energiaPorPosto.reservadoKwh)} kWh`} />
              {leitura && <Leitura>{leitura}</Leitura>}
            </>
          ) : (
            <SemDados />
          )}
        </Bloco>

        <Bloco titulo="Demanda máxima × contratada" resumo="12 meses" gap={6}>
          {dem ? (
            <>
              <svg viewBox={`0 0 ${DEMANDA.largura} ${DEMANDA.altura}`} width="100%" height="120" role="img" aria-label={dem.aria}>
                {dem.cY != null && <line x1="0" x2={DEMANDA.largura} y1={dem.cY.toFixed(1)} y2={dem.cY.toFixed(1)} stroke={COR.texto} strokeDasharray="4 4" strokeOpacity="0.7" />}
                {dem.tY != null && <line x1="0" x2={DEMANDA.largura} y1={dem.tY.toFixed(1)} y2={dem.tY.toFixed(1)} stroke={COR.alerta} strokeDasharray="2 4" />}
                <line x1="0" x2={DEMANDA.largura} y1="118" y2="118" stroke={COR.eixo} />
                {dem.barras.map((b, i) =>
                  b.y != null ? <rect key={i} x={b.x.toFixed(1)} y={b.y.toFixed(1)} width="18" height={b.h.toFixed(1)} rx="2" fill={b.cor} /> : null,
                )}
              </svg>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(12, dem.barras.length)}, minmax(0, 1fr))`, fontSize: 9, color: COR.secundario, textAlign: 'center' }}>
                {dem.barras.map((b, i) => <span key={i}>{b.mes}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: COR.secundario, flexWrap: 'wrap' }}>
                {d.demandaContratadaKw != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 12, borderTop: `1.5px dashed ${COR.texto}` }} />
                    Contratada {nf(d.demandaContratadaKw)}
                  </span>
                )}
                {dem.tol != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 12, borderTop: `1.5px dashed ${COR.alerta}` }} />
                    Tolerância {nf(dem.tol)}
                  </span>
                )}
                {d.demandaMaxKw != null && (
                  <span>
                    {cap(mesAbrev(c.mes))}: <b style={{ color: COR.texto }}>{nf(d.demandaMaxKw)} kW</b>
                    {d.demandaMaxEm ? ` em ${dataHora(d.demandaMaxEm)}` : ''}
                  </span>
                )}
              </div>
            </>
          ) : (
            <SemDados />
          )}
        </Bloco>
      </Duas>

      <Duas>
        <Bloco titulo="Maiores consumidores">
          {d.maioresConsumidores.length ? (
            d.maioresConsumidores.map((x) => (
              <div key={x.nome} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                  <span>{x.nome}</span>
                  <b style={NUM}>
                    {nf(x.kwh)} kWh{totalCons > 0 ? ` · ${nf((x.kwh / totalCons) * 100)}%` : ''}
                  </b>
                </div>
                <Trilho pct={(x.kwh / maiorCons) * 100} cor={COR.serie} />
              </div>
            ))
          ) : (
            <SemDados />
          )}
        </Bloco>
        <Bloco
          titulo="Curva de carga típica"
          gap={6}
          direita={
            curva ? (
              <LegendaTopo
                gap={10}
                itens={[
                  { amostra: <i style={{ width: 12, height: 2.5, background: COR.serie, display: 'inline-block' }} />, texto: 'Dia útil' },
                  { amostra: <i style={{ width: 12, height: 2.5, background: COR.alerta, display: 'inline-block' }} />, texto: 'Fim de semana' },
                ]}
              />
            ) : undefined
          }
        >
          {curva ? (
            <>
              <svg viewBox={`0 0 ${CURVA.largura} ${CURVA.altura}`} width="100%" height="120" role="img" aria-label={curva.aria}>
                <rect x={curva.pX.toFixed(1)} y="0" width={curva.pW.toFixed(1)} height="118" fill={COR.faixaPonta} />
                <line x1="0" x2={CURVA.largura} y1="118" y2="118" stroke={COR.eixo} />
                {curva.diaUtil && <path d={curva.diaUtil} fill="none" stroke={COR.serie} strokeWidth="2.5" strokeLinejoin="round" />}
                {curva.fimDeSemana && <path d={curva.fimDeSemana} fill="none" stroke={COR.alerta} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="5 3" />}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: COR.secundario }}>
                <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span>
              </div>
              <Leitura>
                {d.cargaBaseKw != null ? (
                  <>
                    Carga de base de madrugada: <b style={{ color: COR.texto }}>{nf(d.cargaBaseKw)} kW</b>
                    {faixa ? ` (${faixa})` : ''}.{' '}
                  </>
                ) : null}
                Faixa clara = horário de ponta.
              </Leitura>
            </>
          ) : (
            <SemDados />
          )}
        </Bloco>
      </Duas>

      <Bloco titulo="Balanço de energia" resumo="geração dos inversores + medidor da concessionária" gap={10}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
          {bal.celulas.map((b) => (
            <div key={b.rotulo} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: COR.secundario }}>{b.rotulo}</span>
              <span style={{ fontSize: 20, fontWeight: 800, ...NUM, color: b.valor === '—' ? COR.neutro : b.destaque ? COR.marca : COR.texto }}>
                {b.valor}{' '}
                {b.valor !== '—' && <small style={{ fontSize: 11, fontWeight: 700, color: COR.secundario }}>{b.unidade}</small>}
              </span>
            </div>
          ))}
        </div>
        {bal.autossuficiencia != null ? (
          <>
            <BarraEmpilhada
              rotulo={`Consumo atendido pela usina ${nf(bal.autossuficiencia)}%, pela rede ${nf(100 - bal.autossuficiencia)}%`}
              segmentos={[{ valor: bal.autossuficiencia, cor: COR.ok }, { valor: 100 - bal.autossuficiencia, cor: COR.neutro }]}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: COR.secundario }}>
              <span>
                <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: COR.ok, marginRight: 5 }} />
                Consumo atendido pela usina · {nf(bal.autossuficiencia)}%
              </span>
              <span>
                <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: COR.neutro, marginRight: 5 }} />
                Consumo atendido pela rede · {nf(100 - bal.autossuficiencia)}%
              </span>
            </div>
          </>
        ) : (
          <SemDados texto="Sem geração própria medida no período" />
        )}
      </Bloco>

      <BlocoChamados chamados={d.chamados} fim={c.fim} larguraEquip={120} />

      <Rodape
        premissas="Energia da rede e demanda pelo medidor da concessionária. Consumo por equipamento pelos medidores de cada circuito. Faixa da ponta na curva: 18h–21h."
        geradoEm={c.geradoEm}
        pagina={1}
        total={1}
      />
    </PaginaA4>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
