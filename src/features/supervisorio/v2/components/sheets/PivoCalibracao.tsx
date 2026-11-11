import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { MSG_SOMENTE_LEITURA } from '@/store/papeis';
import { NX, s, NxDialog, NxDialogButtons, NxSeg } from './nxMock';
import { corpo, erroMsg, col, secao, Linha } from './pivoPartes';
import {
  azimute, corpoCalibracao, distanciaM, fmtCoordenada, grausTxt, mensagemGeo, motivosPendentes, parsePar, pendenciasDoPivo, pontoDe,
  parseCoordenada, sentidoTxt, VALIDADE_LEITURA_MIN,
  type Calibracao, type CalibracaoTela, type CampoPonto, type CorpoCalibracao, type LeituraEncoder, type Sentido,
} from './pivoCalibracaoContas';

/**
 * Aba "Calibração" do modal do pivô (NEXON-103): associa UMA leitura do encoder ao azimute
 * real do braço (centro → ponta, medido em campo). A TON lê o encoder ("Ler encoder"), a
 * pessoa informa o sentido e as duas posições, a tela calcula o azimute e a API envia para a
 * placa, espera a confirmação e só então grava. Quem não edita (proprietário, operador) vê a
 * calibração vigente e a leitura, sem os botões.
 * Rotas: GET /pivos/:id/calibracao (relida a cada 10 s), POST …/ler-encoder, POST
 * …/calibracao, POST …/calibracao/restaurar.
 */

type AcaoCal = 'ler' | 'salvar' | 'restaurar';
interface Rascunho { centro: CampoPonto; ponta: CampoPonto; sentido: Sentido | null }
/** O que foi digitado e ainda não gravado, por pivô: trocar de aba (ex.: ir à Operação parar o
 *  pivô) não pode custar as coordenadas. Só nesta página, some ao salvar. */
const rascunhos = new Map<string, Rascunho>();
const VAZIO: CampoPonto = { lat: '', lon: '' };

const quando = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
};
const hora = (iso: string | null | undefined, maisMin = 0) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? new Date(d.getTime() + maisMin * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
};
/** Botão secundário do formulário: 44 px de toque. */
const botao = (off: boolean): CSSProperties => ({
  height: 44, padding: '0 16px', borderRadius: 10, border: `1.5px solid ${NX.off}`, background: NX.card,
  fontSize: 14, fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap', color: off ? NX.desab : NX.texto,
});
const valorTxt: CSSProperties = { fontSize: 15, fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

function Valor({ titulo, sub, children, first, cor }: { titulo: string; sub?: string; children: ReactNode; first?: boolean; cor?: string }) {
  return <Linha titulo={titulo} sub={sub} first={first} minHeight={44}><span style={{ ...valorTxt, color: cor ?? NX.texto }}>{children}</span></Linha>;
}

/** Linhas de uma calibração gravada: azimute, leitura, sentido, quando e quem. */
function LinhasCalibracao({ cal, first }: { cal: Calibracao; first?: boolean }) {
  return (
    <>
      <Valor first={first} titulo="Azimute">{grausTxt(cal.az_cal)}</Valor>
      <Valor titulo="Leitura do encoder">{cal.bruto_cal}</Valor>
      <Valor titulo="Sentido do encoder">{sentidoTxt(cal.sentido)}</Valor>
      <Valor titulo={cal.origem === 'restauracao' ? 'Restaurada em' : 'Gravada em'} sub={cal.usuario_nome ? `por ${cal.usuario_nome}` : undefined}>{quando(cal.criado_em)}</Valor>
    </>
  );
}

interface Geo { buscando: boolean; precisao: number | null; erro: string | null }
const GEO0: Geo = { buscando: false, precisao: null, erro: null };
/** Precisão do GPS pior que isto (m): avisa — a 50 m do centro o azimute fica na mão do erro. */
const PRECISAO_BAIXA_M = 20;

/** Um ponto (centro ou ponta): latitude e longitude digitadas ou a localização do aparelho. */
function CampoPosicao({ titulo, ajuda, valor, onChange, geo, geoDisponivel, onLocalizar, desabilitado }: {
  titulo: string; ajuda?: string | null; valor: CampoPonto; onChange: (v: CampoPonto) => void;
  geo: Geo; geoDisponivel: boolean; onLocalizar: () => void; desabilitado?: boolean;
}) {
  const ruim = (eixo: 'lat' | 'lon') => valor[eixo].trim() !== '' && parseCoordenada(valor[eixo], eixo) == null;
  // "lat, lon" colado de uma vez (Google Maps) preenche os dois campos.
  const colar = (e: ClipboardEvent<HTMLInputElement>) => {
    const p = parsePar(e.clipboardData.getData('text'));
    if (!p) return;
    e.preventDefault();
    onChange({ lat: fmtCoordenada(p.lat), lon: fmtCoordenada(p.lon) });
  };
  const semGeo = !geoDisponivel;
  const off = semGeo || geo.buscando || !!desabilitado;
  return (
    <div style={{ ...s.card, padding: '12px 16px', ...col(8) }}>
      <span style={col(2)}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</span>
        {ajuda && <span style={{ fontSize: 12, color: NX.mudo }}>{ajuda}</span>}
      </span>
      {/* Lado a lado só se couberem (≥ 132 px cada); em tela muito estreita, um embaixo do outro. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 12 }}>
        {(['lat', 'lon'] as const).map((eixo) => (
          <label key={eixo} style={{ ...col(4), minWidth: 0 }}>
            <span style={{ fontSize: 12, color: ruim(eixo) ? NX.bad : NX.mudo }}>{eixo === 'lat' ? 'Latitude' : 'Longitude'}{ruim(eixo) ? ' · inválida' : ''}</span>
            {/* inputMode text: o teclado decimal do iPhone não tem o sinal de menos. */}
            <input aria-label={`${titulo} · ${eixo === 'lat' ? 'latitude' : 'longitude'}`} inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off"
              placeholder={eixo === 'lat' ? '−16,0000000' : '−48,0000000'} value={valor[eixo]} disabled={desabilitado} onPaste={colar}
              onChange={(e) => onChange({ ...valor, [eixo]: e.target.value })}
              style={{ ...s.campo(!!desabilitado, ruim(eixo)), width: '100%', minWidth: 0, height: 44, textAlign: 'left', fontVariantNumeric: 'tabular-nums' }} />
          </label>
        ))}
      </div>
      <button type="button" disabled={off} onClick={onLocalizar} style={{ ...botao(off), width: '100%' }}>
        {geo.buscando ? 'Obtendo a localização…' : 'Usar localização atual'}
      </button>
      {semGeo && <span style={{ fontSize: 12, color: NX.mudo }}>Este navegador não informa a localização (a página precisa estar em HTTPS e o aparelho ter localização): digite a coordenada.</span>}
      {geo.erro && <span role="alert" style={{ fontSize: 12, color: NX.bad }}>{geo.erro}</span>}
      {geo.precisao != null && (
        <span style={{ fontSize: 12, color: geo.precisao > PRECISAO_BAIXA_M ? NX.warn : NX.mudo }}>
          Localização do aparelho · precisão ± {Math.round(geo.precisao)} m{geo.precisao > PRECISAO_BAIXA_M ? ' · precisão baixa: espere o GPS firmar e toque de novo' : ''}
        </span>
      )}
    </div>
  );
}

const geoDoNavegador = () => typeof navigator !== 'undefined' && !!navigator.geolocation && typeof window !== 'undefined' && window.isSecureContext !== false;

/**
 * A tela em si (sem rede): recebe o que o GET devolveu e avisa o que a pessoa pediu.
 * `onSalvar`/`onRestaurar` devolvem true se gravou.
 */
export function PainelCalibracao({ pivoId, tela, podeEditar, acao, recusa, leituraVenceu, invertido, erro, onLer, onSalvar, onRestaurar, geoDisponivel = geoDoNavegador() }: {
  pivoId: string; tela: CalibracaoTela; podeEditar: boolean; acao: AcaoCal | null;
  /** Último "Ler encoder" que a TON respondeu e o servidor recusou (instável, falhou). */
  recusa?: LeituraEncoder | null;
  /** Havia leitura válida e ela passou dos 10 min. */
  leituraVenceu?: boolean;
  /** Sentido da Configuração antiga (encoder invertido): o padrão do segmentado sem calibração vigente. */
  invertido?: boolean | null;
  erro?: string | null;
  onLer: () => void; onSalvar: (c: CorpoCalibracao) => Promise<boolean>; onRestaurar: () => Promise<boolean>;
  geoDisponivel?: boolean;
}) {
  const { vigente, anterior, precondicoes: pre, leitura } = tela;
  const lida = tela.ultima_leitura_valida ?? null;
  const inicial = rascunhos.get(pivoId);
  // O centro do pivô não muda: vem da calibração vigente, para a pessoa só conferir.
  const centroVigente: CampoPonto | null = vigente && vigente.centro_lat != null && vigente.centro_lon != null
    ? { lat: fmtCoordenada(vigente.centro_lat), lon: fmtCoordenada(vigente.centro_lon) } : null;
  const [centro, setCentro] = useState<CampoPonto>(inicial?.centro ?? centroVigente ?? VAZIO);
  const [ponta, setPonta] = useState<CampoPonto>(inicial?.ponta ?? VAZIO);
  const [sentidoEscolhido, setSentidoEscolhido] = useState<Sentido | null>(inicial?.sentido ?? null);
  const sentido: Sentido = sentidoEscolhido ?? vigente?.sentido ?? (invertido ? -1 : 1);
  const [geo, setGeo] = useState<{ centro: Geo; ponta: Geo }>({ centro: GEO0, ponta: GEO0 });
  const [confirmar, setConfirmar] = useState<null | 'salvar' | 'restaurar'>(null);
  // Rascunho só do que a pessoa DIGITOU: abrir a aba não pode congelar um centro vazio (outra
  // pessoa calibra depois e o centro vigente tem de aparecer na volta).
  useEffect(() => {
    const base = centroVigente ?? VAZIO;
    const mexeu = centro.lat !== base.lat || centro.lon !== base.lon || ponta.lat !== '' || ponta.lon !== '' || sentidoEscolhido != null;
    if (mexeu) rascunhos.set(pivoId, { centro, ponta, sentido: sentidoEscolhido }); else rascunhos.delete(pivoId);
  }, [pivoId, centro, ponta, sentidoEscolhido]); // eslint-disable-line react-hooks/exhaustive-deps

  const localizar = (qual: 'centro' | 'ponta') => {
    if (!navigator.geolocation) return;
    setGeo((g) => ({ ...g, [qual]: { buscando: true, precisao: null, erro: null } }));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        (qual === 'centro' ? setCentro : setPonta)({ lat: fmtCoordenada(p.coords.latitude), lon: fmtCoordenada(p.coords.longitude) });
        setGeo((g) => ({ ...g, [qual]: { buscando: false, precisao: p.coords.accuracy, erro: null } }));
      },
      (e) => setGeo((g) => ({ ...g, [qual]: { buscando: false, precisao: null, erro: mensagemGeo(e?.code) } })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  // Digitou por cima: a precisão do GPS não descreve mais o que está no campo.
  const digitar = (qual: 'centro' | 'ponta') => (v: CampoPonto) => {
    (qual === 'centro' ? setCentro : setPonta)(v);
    setGeo((g) => (g[qual].precisao != null || g[qual].erro ? { ...g, [qual]: GEO0 } : g));
  };

  const pc = pontoDe(centro), pp = pontoDe(ponta);
  const az = pc && pp ? azimute(pc, pp) : null;
  const dist = pc && pp ? distanciaM(pc, pp) : null;
  const pendPivo = pendenciasDoPivo(pre);
  const semLeituraPorque = recusa ? `Leitura do encoder recusada: ${recusa.motivo ?? 'leia de novo com o pivô parado'}`
    : leituraVenceu ? `A leitura do encoder venceu (vale ${VALIDADE_LEITURA_MIN} minutos): leia de novo` : null;
  const motivos = motivosPendentes({ precondicoes: pre, leitura: lida, semLeituraPorque, centro, ponta, distanciaMinM: tela.distancia_min_m, distanciaMaxM: tela.distancia_max_m });
  const corpoReq = corpoCalibracao(lida, sentido, centro, ponta);
  const ocupado = acao != null;
  const salvarOff = motivos.length > 0 || !corpoReq || ocupado;
  const restaurarOff = pendPivo.length > 0 || ocupado;

  const confirmarSalvar = async () => { if (corpoReq) await onSalvar(corpoReq); setConfirmar(null); };
  const confirmarRestaurar = async () => { await onRestaurar(); setConfirmar(null); };
  const fechar = () => { if (!ocupado) setConfirmar(null); };
  const centroHerdado = !!centroVigente && centro.lat === centroVigente.lat && centro.lon === centroVigente.lon;
  const tom = (v: boolean | null) => (v === true ? NX.ok : v === false ? NX.bad : NX.warn);

  if (!tela.encoder) {
    return (
      <div style={{ padding: '20px 24px 28px 24px', ...col(10) }}>
        <div role="status" style={{ ...s.card, padding: '14px 16px', ...col(4) }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Pivô sem encoder</span>
          <span style={{ fontSize: 14, color: NX.mudo }}>Escolha o encoder e a resolução na aba Configuração (Posição do pivô). Depois volte aqui para calibrar o ângulo.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px 28px 24px', ...col(10) }}>
      {erro && <span role="alert" style={{ fontSize: 13, color: NX.warn }}>Sem atualização agora: {erro}</span>}

      {secao('CALIBRAÇÃO VIGENTE', 4)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        {vigente ? <LinhasCalibracao cal={vigente} first /> : (
          <Linha first titulo="Sem calibração" sub="Enquanto não calibrar, o ângulo do pivô não aparece: a tela mostra só a leitura bruta do encoder.">
            <span style={{ ...valorTxt, color: NX.warn }}>Atenção</span>
          </Linha>
        )}
        <Valor titulo="Encoder" sub={tela.encoder.resolucao != null ? `${tela.encoder.resolucao.toLocaleString('pt-BR')} posições por volta` : 'Resolução não configurada'}>{tela.encoder.nome ?? '—'}</Valor>
        <Valor titulo="Leitura agora" sub={[`Contagem ${leitura.bruto ?? '—'}`, leitura.lido_em ? quando(leitura.lido_em) : null, leitura.angulo == null ? leitura.motivo : null].filter(Boolean).join(' · ')}
          cor={leitura.angulo != null ? NX.texto : NX.mudo}>
          {leitura.angulo != null ? grausTxt(leitura.angulo) : '—°'}
        </Valor>
      </div>

      {secao('PIVÔ AGORA', 10)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        <Valor first titulo="Pivô parado" sub="A calibração só é feita com o pivô parado" cor={tom(pre.parado)}>{pre.parado === true ? 'Sim' : pre.parado === false ? 'Não' : 'Sem leitura'}</Valor>
        {pre.tem_modo_ton && (
          <Valor titulo="Chave seletora" sub="Tem de estar em modo TON" cor={tom(pre.modo_ton)}>{pre.modo_ton === true ? 'Modo TON' : pre.modo_ton === false ? 'Modo CLP' : 'Sem leitura'}</Valor>
        )}
      </div>

      {podeEditar && (
        <>
          {secao('NOVA CALIBRAÇÃO', 10)}
          <div style={{ ...s.card, padding: '12px 16px', ...col(8) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={col(2)}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Leitura do encoder</span>
                <span style={{ fontSize: 12, color: NX.mudo }}>A TON faz {tela.leituras_exigidas} leituras seguidas · vale {VALIDADE_LEITURA_MIN} minutos</span>
              </span>
              <span aria-label="Leitura do encoder para a calibração" style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: lida ? NX.texto : NX.mudo }}>{lida ? lida.valor : '—'}</span>
            </div>
            {lida && <span style={{ fontSize: 13, color: NX.mudo }}>Leituras: {lida.leituras.join(' · ')} · lida às {hora(lida.em)}, vale até {hora(lida.em, VALIDADE_LEITURA_MIN)}</span>}
            {!lida && recusa && (
              <span role="alert" style={{ fontSize: 13, color: NX.bad }}>{recusa.motivo ?? 'Leitura recusada'}{recusa.leituras?.length ? ` · leituras: ${recusa.leituras.join(' · ')}` : ''}</span>
            )}
            <button type="button" disabled={ocupado} onClick={onLer} style={{ ...botao(ocupado), width: '100%' }}>
              {acao === 'ler' ? 'Lendo o encoder…' : 'Ler encoder'}
            </button>
          </div>

          <div style={{ ...s.card, padding: '12px 16px', ...col(8) }}>
            <span style={col(2)}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Sentido do encoder</span>
              <span style={{ fontSize: 12, color: NX.mudo }}>Quando o pivô anda no sentido horário (visto de cima), o número do encoder aumenta ou diminui?</span>
              <span style={{ fontSize: 12, color: NX.mudo }}>Aumenta = Horário · Diminui = Anti-horário</span>
            </span>
            <div role="group" aria-label="Sentido do encoder">
              <NxSeg<'h' | 'a'> toque value={sentido === 1 ? 'h' : 'a'} disabled={ocupado}
                options={[{ v: 'h', label: 'Horário' }, { v: 'a', label: 'Anti-horário' }]} onChange={(v) => setSentidoEscolhido(v === 'h' ? 1 : -1)} />
            </div>
          </div>

          <CampoPosicao titulo="Posição do centro" ajuda={centroHerdado ? 'Centro da calibração vigente: confira ou troque' : 'Latitude e longitude em graus decimais'}
            valor={centro} onChange={digitar('centro')} geo={geo.centro} geoDisponivel={geoDisponivel} onLocalizar={() => localizar('centro')} desabilitado={ocupado} />
          <CampoPosicao titulo="Posição da ponta" ajuda="Use o ponto da última torre, não do meio do lance."
            valor={ponta} onChange={digitar('ponta')} geo={geo.ponta} geoDisponivel={geoDisponivel} onLocalizar={() => localizar('ponta')} desabilitado={ocupado} />

          <div style={{ ...s.card, padding: '0 16px' }}>
            <Linha first titulo="Azimute calculado" sub={`Do centro até a ponta · 0° = norte, sentido horário${dist != null ? ` · distância ${Math.round(dist).toLocaleString('pt-BR')} m` : ''}`}>
              <span aria-label="Azimute calculado" style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: az != null ? NX.texto : NX.mudo }}>{grausTxt(az)}</span>
            </Linha>
          </div>

          <button type="button" disabled={salvarOff} onClick={() => setConfirmar('salvar')} style={s.save(salvarOff)}>
            {acao === 'salvar' ? 'Gravando na TON…' : 'Salvar calibração'}
          </button>
          {motivos.length > 0 && (
            <div role="status" aria-label="O que falta para salvar" style={{ ...col(4), fontSize: 13, color: NX.warn }}>
              <span style={{ fontWeight: 800 }}>Falta para salvar:</span>
              {motivos.map((m) => <span key={m}>• {m}</span>)}
            </div>
          )}
        </>
      )}

      {anterior && (
        <>
          {secao('CALIBRAÇÃO ANTERIOR', 10)}
          <div style={{ ...s.card, padding: '0 16px' }}>
            <LinhasCalibracao cal={anterior} first />
            {podeEditar && (
              <div style={{ borderTop: `1px solid ${NX.linha}`, padding: '12px 0', ...col(6) }}>
                <button type="button" disabled={restaurarOff} onClick={() => setConfirmar('restaurar')} style={{ ...botao(restaurarOff), width: '100%' }}>
                  {acao === 'restaurar' ? 'Restaurando na TON…' : 'Restaurar calibração anterior'}
                </button>
                {pendPivo.map((m) => <span key={m} style={{ fontSize: 12, color: NX.warn }}>• {m}</span>)}
              </div>
            )}
          </div>
        </>
      )}

      {!podeEditar && <span style={{ textAlign: 'center', fontSize: 13, color: NX.mudo, marginTop: 6 }}>{MSG_SOMENTE_LEITURA}</span>}

      <NxDialog open={confirmar === 'salvar'} onClose={fechar} label="Confirmar calibração" width={440}>
        <div style={col(6)}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Confirmar calibração</span>
          <div>
            <Valor first titulo="Azimute calculado">{grausTxt(az)}</Valor>
            <Valor titulo="Distância do centro à ponta">{dist != null ? `${Math.round(dist).toLocaleString('pt-BR')} m` : '—'}</Valor>
            <Valor titulo="Leitura do encoder">{lida?.valor ?? '—'}</Valor>
            <Valor titulo="Sentido do encoder">{sentidoTxt(sentido)}</Valor>
          </div>
          {vigente && (
            <>
              <span style={{ ...s.label, marginTop: 8 }}>CALIBRAÇÃO ATUAL · SERÁ SUBSTITUÍDA</span>
              <div><LinhasCalibracao cal={vigente} first /></div>
            </>
          )}
          <span style={{ fontSize: 13, color: NX.mudo }}>A calibração vai para a TON e só é gravada depois que a placa confirmar.</span>
          {acao === 'salvar'
            ? <span style={{ fontSize: 14, color: NX.mudo, textAlign: 'center', padding: '6px 0' }}>Gravando e aguardando a confirmação da TON…</span>
            : <NxDialogButtons onCancel={fechar} onConfirm={confirmarSalvar} confirmLabel="Confirmar" cancelLabel="Voltar" disabled={!corpoReq} marginTop={8} />}
        </div>
      </NxDialog>

      <NxDialog open={confirmar === 'restaurar'} onClose={fechar} label="Restaurar calibração anterior" width={440}>
        <div style={col(6)}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Restaurar calibração anterior?</span>
          {anterior && <div><LinhasCalibracao cal={anterior} first /></div>}
          <span style={{ fontSize: 13, color: NX.mudo }}>
            {vigente ? `A calibração vigente (azimute ${grausTxt(vigente.az_cal)}, leitura ${vigente.bruto_cal}) é desativada e esta volta a valer na TON e no NexON.` : 'Esta calibração volta a valer na TON e no NexON.'}
          </span>
          {acao === 'restaurar'
            ? <span style={{ fontSize: 14, color: NX.mudo, textAlign: 'center', padding: '6px 0' }}>Restaurando e aguardando a confirmação da TON…</span>
            : <NxDialogButtons onCancel={fechar} onConfirm={confirmarRestaurar} confirmLabel="Restaurar" cancelLabel="Voltar" marginTop={8} />}
        </div>
      </NxDialog>
    </div>
  );
}

/** A aba ligada na API: carrega, relê a cada 10 s e depois de cada ação. */
export function CalibracaoPivo({ pivoId, tecnico, invertido, onSalvo }: {
  pivoId: string;
  /** Config técnica no perfil (admin e analistas). A API confere de novo em `pode_editar`. */
  tecnico: boolean;
  invertido?: boolean | null;
  /** Gravou ou restaurou: a ficha relê estado e configuração (o desenho passa a ter ângulo). */
  onSalvo: () => void;
}) {
  const [tela, setTela] = useState<CalibracaoTela | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<AcaoCal | null>(null);
  const [recusa, setRecusa] = useState<LeituraEncoder | null>(null);
  const [tinhaLeitura, setTinhaLeitura] = useState(false);
  const [versao, setVersao] = useState(0);   // muda ao gravar: o formulário recomeça limpo
  const ocupado = useRef(false);
  // Resposta que chega fora de ordem (GET antigo depois de um POST) não pode voltar a tela no tempo.
  const vez = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++vez.current;
    try {
      const t = corpo<CalibracaoTela>(await api.get(`/pivos/${pivoId}/calibracao`));
      if (minha === vez.current) { setTela(t ?? null); setErro(null); }
    } catch (e) {
      // API anterior ao NEXON-103 não tem a rota: "Cannot GET …" não diz nada para quem está na tela.
      const m = erroMsg(e);
      if (minha === vez.current) setErro(/^Cannot (GET|POST) /i.test(m) ? 'este servidor ainda não tem a calibração do ângulo' : m);
    }
  }, [pivoId]);
  useEffect(() => {
    void carregar();
    const t = setInterval(() => { if (!ocupado.current) void carregar(); }, 10000);
    return () => clearInterval(t);
  }, [carregar]);
  const lida = tela?.ultima_leitura_valida ?? null;
  useEffect(() => { if (lida) setTinhaLeitura(true); }, [lida]);

  const ler = async () => {
    if (ocupado.current) return;
    ocupado.current = true; setAcao('ler');
    try {
      const r = corpo<LeituraEncoder>(await api.post(`/pivos/${pivoId}/calibracao/ler-encoder`));
      vez.current++;
      if (r?.valida && r.valor != null) {
        setRecusa(null);
        setTela((t) => (t ? { ...t, ultima_leitura_valida: { valor: r.valor!, leituras: r.leituras ?? [], em: r.lido_em } } : t));
        toast.success(`Encoder lido: ${r.valor}`, { description: `A leitura vale por ${VALIDADE_LEITURA_MIN} minutos.` });
      } else {
        setRecusa(r ?? null); setTinhaLeitura(false);
        setTela((t) => (t ? { ...t, ultima_leitura_valida: null } : t));
        toast.error('Leitura do encoder recusada', { description: r?.motivo ?? 'Leia de novo com o pivô parado.' });
      }
    } catch (e) {
      toast.error('Encoder não lido', { description: erroMsg(e) });
    } finally {
      ocupado.current = false; setAcao(null);
      await carregar();
    }
  };

  const gravar = async (qual: 'salvar' | 'restaurar', chamada: () => Promise<unknown>, ok: string, falha: string): Promise<boolean> => {
    if (ocupado.current) return false;
    ocupado.current = true; setAcao(qual);
    try {
      const t = corpo<CalibracaoTela>(await chamada());
      vez.current++;
      if (t && typeof t === 'object' && 'precondicoes' in t) setTela(t);
      setRecusa(null); setTinhaLeitura(false);
      rascunhos.delete(pivoId);
      setVersao((v) => v + 1);
      toast.success(ok, { description: 'A TON confirmou a gravação e já calcula o ângulo por ela.' });
      onSalvo();
      return true;
    } catch (e) {
      toast.error(falha, { description: erroMsg(e) });
      return false;
    } finally {
      ocupado.current = false; setAcao(null);
      await carregar();
    }
  };
  const salvar = (c: CorpoCalibracao) => gravar('salvar', () => api.post(`/pivos/${pivoId}/calibracao`, c), 'Calibração salva', 'Calibração não salva');
  const restaurar = () => gravar('restaurar', () => api.post(`/pivos/${pivoId}/calibracao/restaurar`), 'Calibração anterior restaurada', 'Calibração não restaurada');

  if (!tela) {
    return (
      <div style={{ padding: '20px 24px 28px 24px', ...col(10) }}>
        <div role="status" style={{ ...s.card, padding: '14px 16px', fontSize: 14, color: NX.mudo }}>
          {erro ? `Não foi possível carregar a calibração: ${erro}` : 'Carregando…'}
        </div>
      </div>
    );
  }
  return (
    <PainelCalibracao key={versao} pivoId={pivoId} tela={tela} podeEditar={tecnico && tela.pode_editar === true} acao={acao}
      recusa={recusa} leituraVenceu={tinhaLeitura && !lida && !recusa} invertido={invertido} erro={erro}
      onLer={ler} onSalvar={salvar} onRestaurar={restaurar} />
  );
}
