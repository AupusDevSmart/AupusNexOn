/**
 * Primitivas do documento A4 dos relatórios de operação (NEXON-33).
 * Reproduzem o "Padrão de formatação — Relatórios NexON" com estilos inline: o relatório é
 * uma folha branca nos temas claro e escuro do app, por isso não usa tokens do tema.
 */
import type { CSSProperties, ReactNode } from 'react';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './documento.css';
import logoNexon from '@/assets/relatorios/nexon-logo.png';
import { COR, A4 } from './tema';
import { NUM, VAZIO, cabecalhoGrade, cel } from './estilos';
import { TRACO, dataLonga } from './formatos';
import { linhasChamados, resumoChamados } from './derivar-chamados';
import type { ChamadoRelatorio } from './tipos';

/** Valor de célula: "—" sai em cinza (#9AA0B4). */
export function V({ t, style }: { t: string; style?: CSSProperties }) {
  return <>{t === TRACO ? <span style={VAZIO}>{TRACO}</span> : <span style={style}>{t}</span>}</>;
}

// ───────────────────────── Página ─────────────────────────

export function PaginaA4({ gap = 18, children, rotulo }: { gap?: number; children: ReactNode; rotulo?: string }) {
  return (
    <section
      className="rel-op-pagina"
      aria-label={rotulo}
      style={{
        width: A4.largura,
        minHeight: A4.altura,
        boxSizing: 'border-box',
        background: COR.branco,
        color: COR.texto,
        fontFamily: 'Nunito, system-ui, sans-serif',
        padding: '44px 48px 36px',
        display: 'flex',
        flexDirection: 'column',
        gap,
        textAlign: 'left',
        lineHeight: 'normal',
      }}
    >
      {children}
    </section>
  );
}

export function CabecalhoRelatorio({
  rotulo,
  titulo,
  subtitulo,
  compacto = false,
  margemRegra = -6,
}: {
  rotulo: string;
  titulo: string;
  subtitulo?: string;
  /** Página 2 em diante: título 22 px e sem subtítulo. */
  compacto?: boolean;
  margemRegra?: number;
}) {
  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: COR.marca }}>{rotulo}</span>
          <h1
            style={{
              margin: 0,
              fontSize: compacto ? 22 : 28,
              fontWeight: 800,
              letterSpacing: compacto ? undefined : -0.3,
              color: COR.texto,
              lineHeight: 1.25,
            }}
          >
            {titulo}
          </h1>
          {subtitulo && <span style={{ fontSize: 13, color: COR.secundario }}>{subtitulo}</span>}
        </div>
        <img src={logoNexon} alt="NexON" style={{ height: 30, display: 'block', flex: 'none' }} />
      </header>
      <div style={{ height: 2, background: COR.texto, marginTop: margemRegra }} />
    </>
  );
}

// ───────────────────────── Indicadores ─────────────────────────

export interface Indicador {
  rotulo: string;
  valor: string;
  unidade?: string;
  contexto: string;
  alerta?: boolean;
}

export function GradeIndicadores({ itens }: { itens: Indicador[] }) {
  return (
    <div className="rel-op-bloco" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
      {itens.map((k) => (
        <div
          key={k.rotulo}
          style={{
            border: `1px solid ${COR.borda}`,
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            background: COR.branco,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: COR.secundario }}>{k.rotulo}</span>
          <span style={{ fontSize: 22, fontWeight: 800, ...NUM, lineHeight: 1.15, color: k.valor === TRACO ? COR.neutro : COR.texto }}>
            {k.valor}{' '}
            {k.unidade && k.valor !== TRACO && (
              <small style={{ fontSize: 12, fontWeight: 700, color: COR.secundario }}>{k.unidade}</small>
            )}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: k.alerta ? COR.alerta : COR.secundario }}>{k.contexto}</span>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Blocos ─────────────────────────

export function TituloBloco({ children, tamanho = 14, style }: { children: ReactNode; tamanho?: number; style?: CSSProperties }) {
  return <h2 style={{ margin: 0, fontSize: tamanho, fontWeight: 800, color: COR.texto, ...style }}>{children}</h2>;
}

export function Resumo({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 11, color: COR.secundario }}>{children}</span>;
}

/** Bloco com borda e padding (painéis, gráficos). */
export function Bloco({
  titulo,
  resumo,
  direita,
  tamanho = 14,
  padding = '12px 14px',
  gap = 8,
  children,
  style,
}: {
  titulo: ReactNode;
  resumo?: ReactNode;
  /** Conteúdo livre à direita do título (legenda). */
  direita?: ReactNode;
  tamanho?: number;
  padding?: string;
  gap?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="rel-op-bloco"
      style={{
        border: `1px solid ${COR.borda}`,
        borderRadius: 10,
        padding,
        display: 'flex',
        flexDirection: 'column',
        gap,
        minWidth: 0,
        ...style,
      }}
    >
      {resumo || direita ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <TituloBloco tamanho={tamanho}>{titulo}</TituloBloco>
          {resumo ? <Resumo>{resumo}</Resumo> : direita}
        </div>
      ) : (
        <TituloBloco tamanho={tamanho}>{titulo}</TituloBloco>
      )}
      {children}
    </div>
  );
}

/** Bloco cujo corpo é uma tabela encostada na borda. */
export function BlocoTabela({
  titulo,
  resumo,
  tamanho = 14,
  children,
  style,
}: {
  titulo: ReactNode;
  resumo?: ReactNode;
  tamanho?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="rel-op-bloco"
      style={{ border: `1px solid ${COR.borda}`, borderRadius: 10, overflow: 'hidden', minWidth: 0, ...style }}
    >
      <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <TituloBloco tamanho={tamanho}>{titulo}</TituloBloco>
        {resumo && <Resumo>{resumo}</Resumo>}
      </div>
      {children}
    </div>
  );
}

export function Duas({ children, colunas = 'repeat(2, minmax(0, 1fr))', gap = 12 }: { children: ReactNode; colunas?: string; gap?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: colunas, gap, alignItems: 'stretch' }}>{children}</div>;
}

export function SemDados({ texto = 'Sem dados no período', style }: { texto?: string; style?: CSSProperties }) {
  return <span style={{ fontSize: 11, color: COR.secundario, padding: '2px 0', ...style }}>{texto}</span>;
}

export function Leitura({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontSize: 11, color: COR.secundario, lineHeight: 1.4, ...style }}>{children}</span>;
}

// ───────────────────────── Tabelas ─────────────────────────

// ───────────────────────── Barras e legendas ─────────────────────────

export interface Segmento {
  valor: number;
  cor: string;
}

/** Barra 100% empilhada. Segmentos com valor ≤ 0 somem. */
export function BarraEmpilhada({ segmentos, altura = 14, raio = 4, rotulo }: { segmentos: Segmento[]; altura?: number; raio?: number; rotulo: string }) {
  const total = segmentos.reduce((s, x) => s + Math.max(0, x.valor), 0);
  return (
    <div role="img" aria-label={rotulo} style={{ display: 'flex', height: altura, borderRadius: raio, overflow: 'hidden', background: COR.trilho }}>
      {total > 0 &&
        segmentos
          .filter((s) => s.valor > 0)
          .map((s, i) => <span key={i} style={{ width: `${((s.valor / total) * 100).toFixed(1)}%`, background: s.cor }} />)}
    </div>
  );
}

export function Amostra({ cor, w = 9, h = 9, raio = 2 }: { cor: string; w?: number; h?: number; raio?: number }) {
  return <i style={{ width: w, height: h, borderRadius: raio, background: cor, flex: 'none', display: 'inline-block' }} />;
}

/** Linha de legenda: amostra · texto · valor em negrito à direita. */
export function LinhaLegenda({ cor, texto, nota, valor }: { cor: string; texto: ReactNode; nota?: ReactNode; valor: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <Amostra cor={cor} />
      <span style={{ flex: 1 }}>
        {texto}
        {nota ? (
          <>
            {' '}
            <small style={{ color: COR.secundario }}>{nota}</small>
          </>
        ) : null}
      </span>
      <b style={NUM}>{valor}</b>
    </div>
  );
}

/** Legenda no topo direito de um bloco (§8). */
export function LegendaTopo({ itens, gap = 12 }: { itens: Array<{ amostra: ReactNode; texto: ReactNode }>; gap?: number }) {
  return (
    <div style={{ display: 'flex', gap, fontSize: 11, color: COR.secundario, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {itens.map((it, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {it.amostra}
          {it.texto}
        </span>
      ))}
    </div>
  );
}

/** Trilho com barra proporcional (rankings). */
export function Trilho({ pct, cor, altura = 8 }: { pct: number; cor: string; altura?: number }) {
  return (
    <span style={{ display: 'block', height: altura, borderRadius: 4, background: COR.trilho, overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', borderRadius: 4, width: `${Math.max(0, Math.min(100, pct)).toFixed(0)}%`, background: cor }} />
    </span>
  );
}

// ───────────────────────── Chamados (§9) ─────────────────────────

export function BlocoChamados({
  chamados,
  fim,
  larguraEquip = 120,
  rotuloEquip = 'EQUIP.',
}: {
  chamados: ChamadoRelatorio[];
  fim: string;
  larguraEquip?: number;
  rotuloEquip?: string;
}) {
  const colunas = `${larguraEquip}px minmax(0, 1.3fr) 110px minmax(0, 1.2fr) 130px`;
  const linhas = linhasChamados(chamados, fim);
  return (
    <BlocoTabela titulo="Chamados" resumo={resumoChamados(chamados)}>
      {linhas.length === 0 ? (
        <div style={{ borderTop: `1px solid ${COR.linha}`, padding: '10px 14px 12px', fontSize: 11, color: COR.secundario }}>
          Nenhum chamado no período
        </div>
      ) : (
        <>
          <div style={cabecalhoGrade(colunas)}>
            <span style={cel('7px 6px 7px 14px')}>{rotuloEquip}</span>
            <span style={cel('7px 6px')}>CHAMADO</span>
            <span style={cel('7px 6px')}>ABERTO</span>
            <span style={cel('7px 6px')}>NOTIFICADO</span>
            <span style={cel('7px 14px 7px 6px')}>ATENDIMENTO</span>
          </div>
          {linhas.map((c) => (
            <div
              key={c.numero}
              className="rel-op-linha"
              style={{ display: 'grid', gridTemplateColumns: colunas, fontSize: 11, borderTop: `1px solid ${COR.linha}`, lineHeight: 1.35 }}
            >
              <span style={cel('7px 6px 7px 14px', { fontWeight: 800 })}>{c.equipamento}</span>
              <span style={cel('7px 6px')}>
                {c.titulo} <small style={{ color: COR.secundario }}>#{c.numero}</small>
              </span>
              <span style={cel('7px 6px', NUM)}>
                {c.aberto}
                <br />
                <small style={{ color: COR.secundario }}>{c.por}</small>
              </span>
              <span style={cel('7px 6px', { color: c.notificado === TRACO ? COR.neutro : COR.notificado })}>{c.notificado}</span>
              <span style={cel('7px 14px 7px 6px', NUM)}>
                <b style={{ fontSize: 11, color: c.atendido ? COR.ok : COR.alerta }}>{c.situacao}</b>
                {c.detalhe && (
                  <>
                    <br />
                    <small style={{ color: COR.secundario }}>{c.detalhe}</small>
                  </>
                )}
              </span>
            </div>
          ))}
        </>
      )}
    </BlocoTabela>
  );
}

// ───────────────────────── Rodapé (§10) ─────────────────────────

export function Rodape({ premissas, geradoEm, pagina, total }: { premissas: string; geradoEm: string; pagina: number; total: number }) {
  return (
    <footer
      style={{
        marginTop: 'auto',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        borderTop: `1px solid ${COR.borda}`,
        paddingTop: 10,
        fontSize: 10,
        color: COR.secundario,
        breakInside: 'avoid',
      }}
    >
      <span>{premissas}</span>
      <span style={{ flex: 'none' }}>
        Gerado em {dataLonga(geradoEm)} · {pagina}/{total}
      </span>
    </footer>
  );
}
