import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '@/config/api';
import { fmt } from '@/features/supervisorio/v2/components/sheets/sheetParts';
import { useHistorico, bucketize, brl, unwrap } from '@/features/supervisorio/v2/components/sheets/equipUi';
import { NX, s, NxShell, NxDialog, NxDialogButtons, NxReview } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { curveMonotoneX } from '@visx/curve';
import { ComposedChart } from '@/components/charts/composed-chart';
import { Area } from '@/components/charts/area-chart';
import { Line } from '@/components/charts/line';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { LINHA_SO_DOMINIO, linhasDeBuckets } from '@/components/graficos/linhas-de-buckets';
import { CAIXA_ROW, CARD, CSS, TINTA, botaoLinha } from './carregador.estilos';
import {
  MES_LONGO, RASCUNHO_VAZIO, amanhaYmd, bloqueioIniciar, corpoLiberar, dataBR, dm, duracaoTxt, durTxt, erroMsg, hm, hojeYmd, isoDate, kwDe,
  limiteTxt, notaDaRevisao, num, numTxt, orientacaoOcioso, parseDm, revisarConfig, rotuloOrigem, situacaoDe, subRecarga, textoSituacao,
  type Carregador, type CarregadorInfo, type Credenciais, type Estado, type Morador, type Papel, type Pode,
  type RascunhoConfig, type RevisaoConfig, type Sessao,
} from './carregador.util';
import { AvisoFalha, LimitesAoIniciar, MedicoesRecarga } from './CarregadorOperacao';
import { CarregadorLimites } from './CarregadorLimites';
import { CarregadorComandos } from './CarregadorComandos';
import { CarregadorConexaoOcpp } from './CarregadorConexaoOcpp';
import { CarregadorParametros } from './CarregadorParametros';
import { CarregadorExportar } from './CarregadorExportar';

/**
 * Modal do Carregador (condomínio) — porte 1:1 do mockup "Web — Modal do Carregador" (NEXON-5).
 * Operação: carro + bateria, status, energia e valor estimado, curva de potência da recarga,
 * Iniciar recarga (POST :id/liberar no nome de um morador) / Parar recarga (POST :id/parar),
 * pedido de vaga (POST :id/pedir-vaga), recargas de todos os moradores e exportação.
 * Configuração: valor do kWh (analista edita: PUT :id/config, vale para recargas novas),
 * dados do carregador e moradores autorizados com validade (vence sozinho; aviso 1 dia antes).
 * Perfis vêm da API (estado.papel): analista, proprietário, operador (sem moradores nem exportação) e morador (só as próprias recargas).
 *
 * Carregador ligado por OCPP (NEXON-130, `estado.ocpp` presente): estado real na pílula e na
 * linha de status, aviso de falha, medições da recarga, pedido aguardando o carro, limite ao
 * iniciar e, na Configuração, limites de uso, corrente máxima, comandos, conexão e parâmetros.
 * Carregador que não é OCPP fica como sempre foi; só ganha a seção Conexão OCPP (analista),
 * que é onde se vincula. O que cada um vê sai de `estado.pode` (a API é quem protege).
 * Este arquivo só orquestra: contas e tipos em carregador.util.ts, seções novas em arquivos próprios.
 */

type Modal = null | 'iniciar' | 'parar' | 'vaga' | 'export' | 'review';

// Estilos repetidos do mockup
// Tabelas: a coluna flexível tem largura mínima, e a tabela, a largura mínima que comporta todas
// as colunas (colunas + espaços de 12 px + 32 px de margem interna). Em tela estreita ela rola
// dentro do cartão com as colunas alinhadas. Com `1fr` solto a coluna flexível encolhia (48 px
// no período, 82 px no nome do morador) e, na tabela do morador, as colunas nem cabiam na largura
// mínima: cada linha saía com uma largura. Na tela larga nada muda (a coluna passa do mínimo).
const HIST_COLS = '160px 60px minmax(100px, 1fr) 90px 90px 120px';
const HIST_MIN = 712;
const HIST_COLS_MORADOR = '70px minmax(100px, 1fr) 100px 100px 140px';
const HIST_MIN_MORADOR = 590;
const MOR_COLS = '90px minmax(180px, 1fr) 150px 170px';
const MOR_MIN = 658;
const SELECT_ROW: CSSProperties = { fontSize: 15, fontWeight: 700, color: NX.texto, background: 'transparent', border: 0, textAlign: 'right', maxWidth: '62%', cursor: 'pointer' };
const ENTRADA: CSSProperties = { width: '100%', height: 34, boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${NX.borda}`, background: NX.card, color: NX.texto, fontSize: 14, padding: '0 10px' };

export function CarregadorModal({ carregador, open, onOpenChange }: { carregador: Carregador | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [aba, setAba] = useState('op');
  const [estado, setEstado] = useState<Estado | null>(null);
  // A leitura falhou e ainda não há estado nenhum na tela: mostra o erro (a mensagem da API,
  // se veio) com "Tentar de novo". Vazio = não falhou.
  const [erroLer, setErroLer] = useState('');
  const [carregadores, setCarregadores] = useState<CarregadorInfo[]>([]);
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [todas, setTodas] = useState<Sessao[]>([]);
  const [verTodas, setVerTodas] = useState(false);
  const [plantaId, setPlantaId] = useState<string | undefined>(carregador?.planta_id);
  const [lidoEm, setLidoEm] = useState(() => Date.now());
  const [modal, setModal] = useState<Modal>(null);
  const [moradorSel, setMoradorSel] = useState('');
  // Limites opcionais do diálogo de iniciar (texto do campo; vazio = usa o padrão do carregador).
  const [limTempo, setLimTempo] = useState('');
  const [limEnergia, setLimEnergia] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  // Parada pedida e o carregador ainda não confirmou (no OCPP a recarga só fecha com a resposta dele).
  const [parando, setParando] = useState(false);
  const [erroCfg, setErroCfg] = useState('');
  const [erroSalvar, setErroSalvar] = useState('');
  const [novo, setNovo] = useState<null | { nome: string; apartamento: string; tag_uid: string; email: string; validade: string }>(null);
  // Configuração: rascunho do que ainda não foi gravado (valor do kWh, limites, corrente) e a
  // revisão que está aberta no diálogo (o que se confirma é o que se envia).
  const [rascunho, setRascunho] = useState<RascunhoConfig>(RASCUNHO_VAZIO);
  const [emRevisao, setEmRevisao] = useState<RevisaoConfig | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Depois de um comando a tela atualiza a cada 5 s até este instante (1 minuto).
  const [rapidoAte, setRapidoAte] = useState(0);
  // Chave e URLs do vínculo: a API devolve uma vez; ficam aqui para não sumirem ao trocar de aba.
  // Só em memória e só com a tela aberta: saem em "Já guardei", ao desvincular, ao trocar de carregador e ao fechar.
  const [credenciais, setCredenciais] = useState<Credenciais | null>(null);

  const id = carregador?.id;
  /** Carregador na tela: resposta atrasada de outro carregador não entra. */
  const idAtual = useRef<string | undefined>(undefined);

  /** Só o estado (leve): é o que a atualização rápida relê. */
  const lerEstado = useCallback(async () => {
    if (!id) return;
    try {
      const e = await api.get(`/carregador-eletrico/${id}/estado`);
      if (idAtual.current === id) setEstado(unwrap<Estado>(e));
    } catch { /* mantém o que tinha */ } finally { setLidoEm(Date.now()); }
  }, [id]);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const [e, cs, ss] = await Promise.all([
        api.get(`/carregador-eletrico/${id}/estado`),
        api.get('/carregador-eletrico/carregadores'),
        api.get('/carregador-eletrico/sessoes', { params: { carregadorId: id, limite: 500 } }).catch(() => null),
      ]);
      if (idAtual.current !== id) return;
      setEstado(unwrap<Estado>(e)); setErroLer('');
      const lista = unwrap<CarregadorInfo[]>(cs) ?? [];
      setCarregadores(Array.isArray(lista) ? lista : []);
      if (ss) { const l = unwrap<Sessao[]>(ss); setTodas(Array.isArray(l) ? l : []); }
      const meu = (Array.isArray(lista) ? lista : []).find((c) => String(c.id).trim() === String(id).trim());
      const pid = meu?.planta_id ? String(meu.planta_id).trim() : carregador?.planta_id;
      if (pid) setPlantaId(pid);
      const m = await api.get('/carregador-eletrico/moradores', { params: pid ? { plantaId: pid } : undefined });
      const ml = unwrap<Morador[]>(m);
      setMoradores(Array.isArray(ml) ? ml : []);
    } catch (e) { if (idAtual.current === id) setErroLer(erroMsg(e, 'Não foi possível ler o carregador.')); /* mantém o que tinha */ } finally { setLidoEm(Date.now()); }
  }, [id, carregador?.planta_id]);

  useEffect(() => {
    if (!open) return;
    // Outro carregador: nada do anterior fica na tela enquanto o novo carrega.
    if (idAtual.current !== id) { idAtual.current = id; setEstado(null); setErroLer(''); setTodas([]); }
    setAba('op'); setErro(''); setErroCfg(''); setErroSalvar(''); setVerTodas(false);
    setRascunho(RASCUNHO_VAZIO); setCredenciais(null); setRapidoAte(0); setParando(false);
    carregar();
  }, [open, id, carregar]);
  // A chave de conexão só existe com a tela aberta. O modal fica montado na página depois de
  // fechado (só deixa de desenhar), então ao fechar a chave sai da memória aqui.
  useEffect(() => { if (!open) setCredenciais(null); }, [open]);

  const sa = estado?.sessao_ativa ?? null;
  // Liberada no NexON e o carregador ainda não confirmou: espera o carro, não é recarga ainda.
  const aguardando = sa?.aguardando_inicio === true;
  const carregando = !!sa && !aguardando;

  // Atualização: 30 s; enquanto espera o carro ou por 1 minuto depois de um comando, 5 s (só o estado).
  const rapido = aguardando || rapidoAte > lidoEm;
  useEffect(() => {
    if (!open || !id) return;
    const t = setInterval(rapido ? lerEstado : carregar, rapido ? 5000 : 30000);
    return () => clearInterval(t);
  }, [open, id, carregar, lerEstado, rapido]);

  // Curva de potência: leituras do equipamento desde o início da recarga em andamento.
  // O fim anda de 30 em 30 s: a atualização rápida não refaz a busca do histórico a cada 5 s.
  const inicioMs = (isoDate(sa?.inicio_iso) ?? parseDm(sa?.inicio))?.getTime() ?? null;
  const lidoCurva = Math.floor(lidoEm / 30000) * 30000;
  const [curvaIni, curvaFim] = useMemo<[Date | null, Date | null]>(
    () => (inicioMs == null ? [null, null] : [new Date(inicioMs), new Date(Math.max(lidoCurva, inicioMs + 60000))]),
    [inicioMs, lidoCurva],
  );
  const { pts } = useHistorico(id, curvaIni, curvaFim, open && carregando);

  if (!open || !carregador) return null;

  const info = carregadores.find((c) => String(c.id).trim() === String(carregador.id).trim()) ?? null;
  const papel: Papel = estado?.papel ?? 'analista';
  const ehMorador = papel === 'morador';
  // NEXON-20 (PER-38): moradores (aba Configuração) e exportação só analista e
  // proprietário; operador e morador ficam na operação.
  const podeGerir = papel === 'analista' || papel === 'proprietario';
  // NEXON-130: o que o usuário pode neste carregador vem da API (ausente em API antiga = nada novo aparece).
  const pode: Pode = estado?.pode ?? {};
  const ocpp = estado?.ocpp ?? null;
  const ehOcpp = ocpp != null;
  const limites = estado?.limites ?? null;
  const leitura = estado?.leitura ?? null;
  const situacao = situacaoDe(estado);
  // Antes da primeira resposta a tela não afirma nada do carregador: "Lendo…" (ou "Sem leitura", se falhou).
  const lendo = estado == null;
  const falhouLer = erroLer !== '';
  const selo = lendo ? { rotulo: falhouLer ? 'Sem leitura' : 'Lendo…', tom: 'off' as const } : { rotulo: situacao.rotulo, tom: situacao.tom };
  // Configuração: quem gere (analista e proprietário) e, no carregador OCPP, quem pode
  // bloquear (operador com o carregador liberado), que entra para usar os Comandos.
  const temCfg = !lendo && (podeGerir || (ehOcpp && !!pode.bloquear));
  const podeComandar = pode.comandar !== false;
  const tarifaCfg = estado?.tarifa_kwh != null ? Number(estado.tarifa_kwh) : info?.tarifa_kwh != null ? Number(info.tarifa_kwh) : null;
  // A recarga em andamento usa o valor do kWh gravado quando começou.
  const tarifa = sa?.tarifa_kwh != null ? Number(sa.tarifa_kwh) : tarifaCfg;
  // Energia da recarga: só `sessao_ativa.kwh_total`, que a API atualiza a cada medição. Não cai para
  // `leitura.energia_sessao_kwh`: a leitura é a última recebida e, até a primeira medição de uma recarga
  // iniciada pelo cartão (ou sozinha), ainda é a da recarga ANTERIOR; e quando a API esconde o `kwh_total`
  // (morador vendo a recarga de outro) a leitura mostraria o que ela escondeu.
  const kwhAtual = sa?.kwh_total != null ? Number(sa.kwh_total) : null;
  const inicioSa = inicioMs != null ? new Date(inicioMs) : null;
  const potencia = info?.potencia_kw != null ? Number(info.potencia_kw) : estado?.potencia_kw != null ? Number(estado.potencia_kw) : null;
  const soc = carregando && estado?.soc != null && Number.isFinite(Number(estado.soc)) ? Math.max(0, Math.min(100, Number(estado.soc))) : null;
  const capacidade = estado?.capacidade_bateria_kwh != null ? Number(estado.capacidade_bateria_kwh) : null;
  // Previsão até 100%: só com bateria lida + capacidade + potência.
  const falta = soc != null && capacidade && potencia ? { kwh: ((100 - soc) / 100) * capacidade, h: ((100 - soc) / 100) * capacidade / potencia + 0.25 } : null;
  const fimPrev = falta ? new Date(Date.now() + falta.h * 3600000) : null;
  const unidade = info?.unidade_nome ?? carregador.unidade_nome ?? null;
  const vagaNum = /vaga\s*([\w-]+)/i.exec(carregador.nome ?? '')?.[1] ?? null;

  const aptoDe = (nome?: string | null) => (nome ? moradores.find((m) => m.nome === nome)?.apartamento ?? null : null);
  const morLabel = (nome?: string | null) => (nome ? `${aptoDe(nome) ? `${aptoDe(nome)} · ` : ''}${nome}` : '—');

  // ------------------------------------------------------------------ ações
  const abrir = (m: Modal) => {
    setErro('');
    setMoradorSel(ehMorador && estado?.meu_morador ? estado.meu_morador.id : moradores.filter((x) => x.ativo !== false).length === 1 ? moradores.filter((x) => x.ativo !== false)[0].id : '');
    // O limite da recarga já vem com o padrão do carregador (que também é o teto).
    if (m === 'iniciar') { setLimTempo(numTxt(limites?.tempo_min)); setLimEnergia(numTxt(limites?.energia_kwh)); }
    setModal(m);
  };
  const fechar = () => { setModal(null); };
  /** Depois de um comando: 1 minuto atualizando a cada 5 s, para o carregador ter tempo de responder. */
  const marcarComando = () => setRapidoAte(Date.now() + 60000);
  const aposComando = () => { marcarComando(); void lerEstado(); };
  const comando = async (fn: () => Promise<unknown>, falha: string) => {
    setModal(null); setBusy(true); setErro(''); setParando(false);
    try { await fn(); marcarComando(); await carregar(); }
    catch (e) { setErro(erroMsg(e, falha)); }
    finally { setBusy(false); }
  };
  // null = falta o morador ou há limite fora da faixa: o botão Iniciar fica desligado.
  const corpoIniciar = corpoLiberar(moradorSel, limTempo, limEnergia, limites);
  const iniciar = () => { if (corpoIniciar) comando(() => api.post(`/carregador-eletrico/${id}/liberar`, corpoIniciar), 'Falha ao iniciar a recarga'); };
  const parar = () => comando(async () => {
    const r = unwrap<{ aguardando_carregador?: boolean }>(await api.post(`/carregador-eletrico/${id}/parar`));
    setParando(r?.aguardando_carregador === true);
  }, 'Falha ao parar a recarga');
  // Pedido que ainda espera o carro: o mesmo POST :id/parar cancela na hora.
  const cancelarPedido = () => comando(() => api.post(`/carregador-eletrico/${id}/parar`), 'Falha ao cancelar o pedido');
  const pedirVaga = () => { const mid = moradorSel; if (mid) comando(() => api.post(`/carregador-eletrico/${id}/pedir-vaga`, { morador_id: mid }), 'Falha ao pedir a vaga'); };

  const addMorador = async () => {
    if (!novo?.nome.trim()) return;
    setSalvando(true); setErroCfg('');
    try {
      await api.post('/carregador-eletrico/moradores', {
        nome: novo.nome.trim(), apartamento: novo.apartamento.trim() || null, tag_uid: novo.tag_uid.trim().toUpperCase() || null, planta_id: plantaId,
        email: novo.email.trim() || null, validade: novo.validade || null,
      });
      setNovo(null); await carregar();
    } catch (e) { setErroCfg(erroMsg(e, 'Falha ao cadastrar o morador')); }
    finally { setSalvando(false); }
  };
  const delMorador = async (mid: string) => {
    setErroCfg('');
    try { await api.delete(`/carregador-eletrico/moradores/${mid}`); await carregar(); }
    catch (e) { setErroCfg(erroMsg(e, 'Falha ao remover o morador')); }
  };

  // Um Salvar só na aba: valor do kWh (analista), limites de uso (analista e proprietário) e
  // corrente máxima (analista) vão no mesmo PUT :id/config, só com o que mudou.
  const tarifaTxtEdit = rascunho.tarifa ?? (tarifaCfg != null ? fmt(tarifaCfg, 2) : '');
  const revisao = revisarConfig({ tarifa: tarifaCfg, limites }, rascunho, { tarifa: papel === 'analista', limites: !!pode.limites, corrente: !!pode.tecnico });
  const tarifaRuim = revisao.ruins.tarifa;
  const nMud = revisao.mudancas.length;
  const podeSalvar = papel === 'analista' || (limites != null && !!pode.limites);
  const salvarConfig = async () => {
    const corpo = emRevisao?.corpo;
    if (!corpo) return;
    setSalvando(true); setErroSalvar('');
    try {
      await api.put(`/carregador-eletrico/${id}/config`, corpo);
      setRascunho(RASCUNHO_VAZIO);
    } catch (e) {
      // 409 = o carregador recusou a corrente: a mensagem da API vai para a tela.
      const soTarifa = Object.keys(corpo).length === 1 && 'tarifa_kwh' in corpo;
      setErroSalvar(erroMsg(e, soTarifa ? 'Falha ao salvar o valor do kWh' : 'Falha ao salvar a configuração'));
    }
    setModal(null);
    // A corrente vai ao carregador na hora: acompanha de perto a resposta dele.
    if ('limite_corrente_a' in corpo) marcarComando();
    try { await carregar(); } finally { setSalvando(false); }
  };

  // ------------------------------------------------------------------ operação
  const w = soc != null ? Math.max(4, soc) : carregando ? 100 : 4;
  const fillStyle: CSSProperties = {
    height: '100%', borderRadius: 8, width: `${w}%`,
    ...(carregando
      ? { backgroundColor: '#2E8B47', backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.25) 0 7px, transparent 7px 14px)', backgroundSize: '28px 100%' }
      : { background: NX.off }),
  };

  // Curva de potência da recarga (bklit): buckets do início da sessão até agora;
  // `teto` (série invisível) leva o eixo até a potência nominal do carregador.
  const N = 80;
  const t0 = curvaIni?.getTime() ?? 0, t1 = curvaFim?.getTime() ?? 1;
  const vals = carregando && pts && curvaIni ? bucketize(pts, t0, t1, N, kwDe) : [];
  const curva = linhasDeBuckets(t0, t1, { potencia: vals });
  const maxLido = Math.max(0, ...curva.map((p) => Number(p.potencia)));
  const MAXP = Math.ceil((Math.max(potencia ?? 0, maxLido, 1) + 1) / 2) * 2;
  curva.forEach((p) => { p.teto = MAXP; });
  // Potência agora: a última medição do carregador OCPP; sem ela, o último ponto da curva (como sempre).
  const kwAgora = num(leitura?.potencia_kw) ?? (curva.length ? Number(curva[curva.length - 1].potencia) : null);

  // Linha de status: no carregador antigo continua "Normal" + Carregando/Disponível; no OCPP é o estado real.
  const rotuloLinha = lendo ? selo.rotulo : situacao.chave === 'legado' ? 'Normal' : situacao.rotulo;
  const textoLinha = lendo ? '' : textoSituacao(situacao, estado, kwAgora);
  // A bateria só "corre" com energia passando de verdade (pausado, em falha ou finalizando fica parada).
  const energizando = carregando && (situacao.chave === 'legado' || situacao.chave === 'carregando');
  // Sem recarga e o carregador não aceitaria (sem comunicação, falha, bloqueado): Iniciar desligado, com a razão.
  const bloqueio = podeComandar && !sa ? bloqueioIniciar(situacao) : null;
  const limiteRecarga = limiteTxt(sa, kwhAtual);
  const desde = inicioSa ? hm(inicioSa) : sa?.inicio ?? '—';
  // Recarga que começou sozinha no carregador OCPP (início automático) não tem morador.
  const quem = !sa?.morador_nome && ehOcpp ? 'Sem morador' : morLabel(sa?.morador_nome);
  const etaTxt = lendo
    ? (falhouLer ? 'Sem leitura do carregador' : 'Lendo o carregador…')
    : aguardando
    ? 'Aguardando o carro ser conectado'
    : carregando
      ? falta && fimPrev
        ? `Faltam ${Math.floor(falta.h)} h ${String(Math.round((falta.h % 1) * 60)).padStart(2, '0')} min para 100% · término ~${hm(fimPrev)}`
        : soc != null
          ? `${quem} · carregando desde ${desde}`
          : ehOcpp
            ? `${quem} · desde ${desde}`
            : `Bateria do carro não informada · ${quem} · desde ${desde}`
      : orientacaoOcioso(situacao);
  const previsto = carregando && kwhAtual != null && tarifa != null ? brl((kwhAtual + (falta?.kwh ?? 0)) * tarifa) : 'R$ 0,00';

  // Histórico
  const agora = new Date();
  const linhaHist = (x: Sessao) => {
    const a = isoDate(x.inicio_iso) ?? parseDm(x.inicio), b = isoDate(x.fim_iso) ?? parseDm(x.fim);
    const kwh = x.kwh_total != null ? Number(x.kwh_total) : null;
    const t = x.tarifa_kwh != null ? Number(x.tarifa_kwh) : tarifa;
    const ativa = x.status === 'ativa';
    const dur = num(x.duracao_min);
    // `aguardando_inicio` só vem em `sessao_ativa` (as linhas de `sessoes` não trazem): a linha
    // que ainda espera o carro é a da recarga ativa, reconhecida pelo id.
    const esperaCarro = ativa && aguardando && String(x.id).trim() === String(sa?.id).trim();
    return {
      id: x.id,
      // Recarga que começou sozinha (início automático) não tem morador.
      mor: !x.morador_nome && rotuloOrigem(x.origem) === 'Automático' ? 'Sem morador' : morLabel(x.morador_nome),
      data: a ? (a.toDateString() === agora.toDateString() ? 'Hoje' : dm(a)) : '—',
      per: `${a ? hm(a) : '—'} → ${ativa ? (esperaCarro ? 'aguardando o carro' : 'em andamento') : b ? hm(b) : '—'}`,
      // A duração calculada no servidor vale mais que a conta com o relógio deste aparelho.
      dur: dur != null ? duracaoTxt(dur) : durTxt(a, ativa ? agora : b),
      kwh: kwh != null ? `${fmt(kwh, 1)} kWh` : '—',
      rs: kwh != null && t != null ? brl(kwh * t) : '—',
      // Segunda linha: de onde veio (cartão ou automático) e como terminou. Não ocupa coluna.
      sub: subRecarga(x),
    };
  };
  const recentes = estado?.sessoes ?? [];
  const hist = (verTodas && todas.length > recentes.length ? todas : recentes).map(linhaHist);
  const doMes = (todas.length ? todas : recentes).filter((x) => {
    const a = isoDate(x.inicio_iso) ?? parseDm(x.inicio);
    return a && a.getMonth() === agora.getMonth() && a.getFullYear() === agora.getFullYear();
  });
  const kwhMes = doMes.reduce((acc, x) => acc + Number(x.kwh_total || 0), 0);
  const rsMes = doMes.reduce((acc, x) => acc + Number(x.kwh_total || 0) * Number(x.tarifa_kwh ?? tarifa ?? 0), 0);
  const histTotal = `${MES_LONGO[agora.getMonth()]} · ${fmt(kwhMes, 1)} kWh${!ehMorador && tarifa != null ? ` · ${brl(rsMes)} (estimado)` : ''}`;
  const histCols = ehMorador ? HIST_COLS_MORADOR : HIST_COLS;

  // ------------------------------------------------------------------ configuração

  const salvarOff = revisao.invalido || nMud === 0;
  const botaoSalvar = podeSalvar ? (
    <>
      {erroSalvar && <span role="alert" style={{ fontSize: 13, color: NX.bad }}>{erroSalvar}</span>}
      <button type="button" disabled={salvarOff} onClick={() => { setErroSalvar(''); setEmRevisao(revisao); setModal('review'); }} style={s.save(salvarOff)}>
        {revisao.invalido ? 'Valor fora da faixa' : nMud > 0 ? `Revisar ${nMud} ${nMud > 1 ? 'alterações' : 'alteração'}` : 'Salvar'}
      </button>
    </>
  ) : null;

  const selectMorador = (
    <div style={CAIXA_ROW}>
      <span>Morador</span>
      <select className="nxc-campo" aria-label="Morador" value={moradorSel} onChange={(e) => setMoradorSel(e.target.value)} style={SELECT_ROW}>
        <option value="">{moradores.length ? 'Escolha…' : 'Nenhum morador cadastrado'}</option>
        {moradores.filter((m) => m.ativo !== false).map((m) => <option key={m.id} value={m.id}>{morLabel(m.nome)}</option>)}
      </select>
    </div>
  );
  const erroDlg = erro ? <span style={{ fontSize: 13, color: NX.bad }}>{erro}</span> : null;

  // Linha de status e curva: as mesmas peças nas duas grades (a do mockup e a do OCPP).
  const linhaStatus = (
    <div className="nxc-a-status" style={{ ...CARD, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, ...(ehOcpp ? { flexWrap: 'wrap', rowGap: 2 } : {}) }}>
      <span style={s.stDot(selo.tom)} />
      <span style={s.stLabel(selo.tom)}>{rotuloLinha}</span>
      <span style={{ fontSize: 14, color: NX.mudo }}>{textoLinha}</span>
    </div>
  );
  const cartaoCurva = (
    <div className="nxc-a-curva" style={{ ...CARD, borderRadius: 14, padding: '14px 16px 10px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 15, fontWeight: 800 }}>Curva de potência</span>
      <div style={{ height: 150, marginTop: 8 }} role="img" aria-label="Curva de potência da recarga">
        <ComposedChart data={curva} aspectRatio="auto" className="h-full"
          margin={{ top: 8, right: 8, bottom: 24, left: 48 }} animationDuration={0}>
          <Grid horizontal numTicksRows={3} />
          <Area dataKey="potencia" fill={COR.potencia} fillOpacity={0.25} gradientToOpacity={0.04} strokeWidth={2.2} curve={curveMonotoneX} animate={false} />
          <Line dataKey="teto" {...LINHA_SO_DOMINIO} />
          <XAxis numTicks={2} />
          <YAxis numTicks={3} formatValue={(x) => `${fmt(x, Number.isInteger(x) ? 0 : 1)} kW`} />
          <ChartTooltip showDots content={({ point }) => {
            const p = point as { date: Date; potencia: number };
            return <TooltipDestaque titulo={hm(p.date)} valor={fmt(p.potencia, 1)} unidade="kW" rotulo="Potência" />;
          }} />
        </ComposedChart>
      </div>
    </div>
  );

  // Pílula de estado: ao lado do título na tela larga; no celular, embaixo do subtítulo (classes
  // `.nxc-selo-*`). Só uma das duas aparece: quem decide é a largura da tela, no CSS.
  const pilula = <span style={s.pill(selo.tom)}><span style={s.pillDot(selo.tom)} />{selo.rotulo}</span>;
  const subtitulo = [unidade, potencia != null ? `${fmt(potencia, 0)} kW` : null].filter(Boolean).join(' · ');

  return (
    <NxShell
      title={carregador.nome || 'Carregador'}
      subtitle={<>{subtitulo}<span className="nxc-selo-sub">{pilula}</span></>}
      right={<span className="nxc-selo-topo">{pilula}</span>}
      tabs={!temCfg ? undefined : [{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={!temCfg ? 'op' : aba}
      onTab={setAba}
      onClose={() => onOpenChange(false)}
    >
      <style>{CSS}</style>

      {aba === 'op' || !temCfg ? (
        <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {lendo && falhouLer && (
            <div role="alert" style={{ ...TINTA.bad, borderRadius: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 800, minWidth: 0, overflowWrap: 'anywhere' }}>{erroLer}</span>
              <button type="button" onClick={() => { setErroLer(''); void carregar(); }} style={botaoLinha()}>Tentar de novo</button>
            </div>
          )}
          {estado?.falha && <AvisoFalha falha={estado.falha} tecnico={!!pode.tecnico} />}
          {/* OCPP: carro ao lado do status e da curva, medições na largura toda (grade .nxc-op). */}
          <div className={ehOcpp ? 'nxc-op' : 'nxc-grid'}>
            <div className="nxc-a-carro" style={{ ...CARD, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, ...(ehOcpp ? { justifyContent: 'center' } : {}) }}>
              <svg viewBox="0 0 300 110" width="300" height="110" role="img" aria-label="Carro conectado ao carregador" style={{ maxWidth: '100%' }}>
                <rect x="250" y="24" width="34" height="70" rx="8" fill={NX.trilho} stroke="#B9BDCB" />
                <rect x="258" y="34" width="18" height="12" rx="3" fill={carregando ? '#2E8B47' : '#B9BDCB'} />
                <path d="M267 94 C267 104 236 104 222 86" fill="none" stroke="#B9BDCB" strokeWidth="4" strokeLinecap="round" />
                <path d="M22 78 L30 56 C34 46 42 40 54 38 L96 32 C110 30 124 30 136 36 L170 54 L206 60 C216 62 224 70 224 80 L224 84 L22 84 Z" fill={NX.trilho} stroke="#9A9EB0" strokeWidth="1.5" />
                <path d="M58 44 L98 38 C108 37 118 38 126 42 L150 54 L58 54 Z" fill={NX.card} opacity="0.9" />
                <circle cx="62" cy="86" r="16" fill={NX.card} stroke={NX.mudo} strokeWidth="3" />
                <circle cx="186" cy="86" r="16" fill={NX.card} stroke={NX.mudo} strokeWidth="3" />
                <circle cx="62" cy="86" r="5" fill={NX.mudo} />
                <circle cx="186" cy="86" r="5" fill={NX.mudo} />
                {carregando && <path className={energizando ? 'nxw-pulse' : undefined} d="M126 58 L116 72 L124 72 L118 84 L132 68 L124 68 Z" fill="#2E8B47" />}
              </svg>
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 36, borderRadius: 12, border: '2px solid #B9BDCB', padding: 3, boxSizing: 'border-box', overflow: 'hidden' }}>
                  <div className={energizando ? 'nxw-flow' : ''} style={fillStyle} />
                </div>
                <div style={{ width: 6, height: 14, borderRadius: '0 3px 3px 0', background: '#B9BDCB' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {/* O carregador OCPP de corrente alternada não lê a bateria do carro: sem leitura, nada de "—" gigante. */}
                {(!ehOcpp || soc != null) && (
                  <span style={{ fontSize: 46, lineHeight: '50px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>{soc != null ? `${Math.round(soc)}%` : '—'}</span>
                )}
                <span style={{ fontSize: 14, color: NX.mudo, textAlign: 'center' }}>{etaTxt}</span>
              </div>
            </div>

            {ehOcpp ? (
              <>
                {linhaStatus}
                {cartaoCurva}
                {/* Sem o valor do kWh (a API não manda para quem não vê R$) não há o que estimar: "—", não "R$ 0,00". */}
                <MedicoesRecarga ativa={carregando} potenciaKw={kwAgora} energiaKwh={kwhAtual} duracaoMin={num(sa?.duracao_min)}
                  valor={carregando && tarifa == null ? '—' : previsto} leitura={leitura} limite={limiteRecarga} />
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {linhaStatus}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <div style={{ ...CARD, borderRadius: 14, height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Energia</span>
                    <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(carregando ? kwhAtual ?? 0 : 0, 1)} kWh</span>
                  </div>
                  <div style={{ ...CARD, borderRadius: 14, height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Previsto</span>
                    <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{previsto}</span>
                  </div>
                </div>
                {cartaoCurva}
              </div>
            )}
          </div>

          {podeComandar && (
            <button type="button" onClick={aguardando ? cancelarPedido : () => abrir(carregando ? 'parar' : 'iniciar')} disabled={busy || lendo || !!bloqueio}
              style={s.cmd(busy || lendo || bloqueio ? 'busy' : sa ? 'outline' : 'primary')}>
              {busy ? 'Executando…' : aguardando ? 'Cancelar' : carregando ? 'Parar recarga' : 'Iniciar recarga'}
            </button>
          )}
          {(carregando || aguardando || bloqueio || erro) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: -8 }}>
              {aguardando && <span style={{ fontSize: 13, color: NX.mudo, textAlign: 'center' }}>Se o carro não for conectado em 3 minutos, o pedido é cancelado.</span>}
              {parando && carregando && rapido && <span role="status" style={{ fontSize: 13, color: NX.mudo, textAlign: 'center' }}>Parada enviada. A recarga fecha quando o carregador confirmar.</span>}
              {bloqueio && <span style={{ fontSize: 13, color: NX.mudo, textAlign: 'center' }}>{bloqueio}</span>}
              {carregando && !ehMorador && podeComandar && (
                <button type="button" onClick={() => abrir('vaga')} disabled={busy} style={{ height: 30, padding: '0 8px', fontSize: 13, fontWeight: 700, color: NX.mudo, textAlign: 'center' }}>
                  Outro morador quer a vaga?
                </button>
              )}
              {erro && modal == null && <span role="alert" style={{ fontSize: 13, color: NX.bad, textAlign: 'center' }}>{erro}</span>}
            </div>
          )}

          <div style={{ ...CARD, borderRadius: 14, overflow: 'hidden' }}>
            {/* Em 390 px o título e o botão não cabem lado a lado: o botão desce em vez de espremer o título em três linhas. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{ehMorador ? 'Minhas recargas' : 'Recargas de todos os moradores'}</span>
                <span style={{ fontSize: 13, color: NX.mudo }}>{histTotal}</span>
              </span>
              {podeGerir && <button type="button" onClick={() => { setErro(''); setModal('export'); }} style={{ height: 38, padding: '0 14px', borderRadius: 10, background: NX.acao, color: '#FFFFFF', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></svg>
                Exportar planilha
              </button>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: ehMorador ? HIST_MIN_MORADOR : HIST_MIN }}>
                <div style={{ display: 'grid', gridTemplateColumns: histCols, gap: 12, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, borderTop: `1px solid ${NX.linha2}` }}>
                  {!ehMorador && <span>MORADOR</span>}<span>DATA</span><span>INÍCIO → FIM</span><span>DURAÇÃO</span><span style={{ textAlign: 'right' }}>ENERGIA</span><span style={{ textAlign: 'right' }}>VALOR (ESTIMADO)</span>
                </div>
                {hist.length === 0 && (
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>Sem recargas ainda.</div>
                )}
                {hist.map((h) => (
                  <div key={h.id} style={{ display: 'grid', gridTemplateColumns: histCols, gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14 }}>
                    {!ehMorador && <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.mor}>{h.mor}</span>}
                    <span>{h.data}</span>
                    <span style={{ color: NX.mudo, fontVariantNumeric: 'tabular-nums' }}>{h.per}</span>
                    <span style={{ color: NX.mudo }}>{h.dur}</span>
                    <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{h.kwh}</span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{h.rs}</span>
                    {h.sub && <span style={{ gridColumn: '1 / -1', marginTop: -8, fontSize: 12, color: NX.mudo }}>{h.sub}</span>}
                  </div>
                ))}
              </div>
            </div>
            {todas.length > recentes.length && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderTop: `1px solid ${NX.linha}` }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setVerTodas((v) => !v); }} style={{ fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
                  {verTodas ? 'Ver menos ‹' : 'Ver todas ›'}
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={s.label}>TARIFA</span>
          <div style={{ ...CARD, borderRadius: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <label htmlFor="w-kwh" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Valor do kWh</span>
              <span style={{ fontSize: 12, color: papel === 'analista' && tarifaRuim ? NX.bad : NX.mudo }}>
                {papel === 'analista' ? (tarifaRuim ? 'Faixa R$ 0,30 a R$ 5,00' : 'Faixa R$ 0,30 a R$ 5,00 · valores em R$ são estimados') : 'Pré-cadastrado pelo analista · valores em R$ são estimados'}
              </span>
            </label>
            <span style={{ fontSize: 14, color: NX.mudo }}>R$</span>
            <input id="w-kwh" className="nxc-campo" inputMode="decimal" value={papel === 'analista' ? tarifaTxtEdit : tarifaCfg != null ? fmt(tarifaCfg, 2) : '—'}
              onChange={(e) => setRascunho((r) => ({ ...r, tarifa: e.target.value }))} readOnly={papel !== 'analista'} disabled={papel !== 'analista'}
              style={s.campo(papel !== 'analista', papel === 'analista' && tarifaRuim, 90)} />
          </div>

          {/* Carregador OCPP: tudo que se edita fica junto, com o Salvar logo embaixo. */}
          {limites && (
            <>
              <CarregadorLimites limites={limites} rascunho={rascunho} ruins={revisao.ruins} onRascunho={(p) => setRascunho((r) => ({ ...r, ...p }))}
                podeLimites={!!pode.limites} podeCorrente={!!pode.tecnico} />
              {botaoSalvar}
            </>
          )}

          <span style={{ ...s.label, marginTop: 10 }}>CARREGADOR</span>
          <div style={{ ...CARD, borderRadius: 14, padding: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Potência nominal</span>
              <span style={{ fontSize: 15, color: NX.mudo }}>{potencia != null ? `${fmt(potencia, 0)} kW` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, gap: 12, borderTop: `1px solid ${NX.linha}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Vaga</span>
              <span style={{ fontSize: 15, color: NX.mudo, textAlign: 'right' }}>{[vagaNum ?? carregador.nome, unidade].filter(Boolean).join(' · ') || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, gap: 12, borderTop: `1px solid ${NX.linha}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Leitura da bateria do carro</span>
              <span style={{ fontSize: 15, color: NX.mudo, textAlign: 'right' }}>{estado?.soc != null ? 'Pelo carregador, ao conectar' : 'Não informada pelo carregador'}</span>
            </div>
            {(ocpp?.fabricante || ocpp?.modelo) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, gap: 12, borderTop: `1px solid ${NX.linha}` }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Modelo</span>
                {/* Vem do carregador: modelo comprido e sem espaço quebra em qualquer ponto em vez de estourar a largura. */}
                <span style={{ fontSize: 15, color: NX.mudo, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{[ocpp.fabricante, ocpp.modelo].filter(Boolean).join(' ')}</span>
              </div>
            )}
          </div>

          {/* Moradores: só quem gere (PER-38). O operador entra nesta aba só pelos Comandos. */}
          {podeGerir && (<>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 12 }}>
            <span style={s.label}>MORADORES AUTORIZADOS · {moradores.length}</span>
            <button type="button" onClick={() => { setErroCfg(''); setNovo(novo ? null : { nome: '', apartamento: '', tag_uid: '', email: '', validade: '' }); }}
              style={{ height: 32, padding: '0 12px', borderRadius: 10, fontSize: 13, fontWeight: 800, color: NX.acao, background: 'rgba(31,122,67,0.1)', flex: 'none' }}>
              + Adicionar morador
            </button>
          </div>
          <div style={{ ...CARD, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: MOR_MIN }}>
                <div style={{ display: 'grid', gridTemplateColumns: MOR_COLS, gap: 12, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4 }}>
                  <span>APTO</span><span>MORADOR</span><span>VALIDADE</span><span />
                </div>
                {novo && (
                  <div style={{ display: 'grid', gridTemplateColumns: MOR_COLS, gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14 }}>
                    <input className="nxc-campo" aria-label="Apartamento" placeholder="Apto 302" value={novo.apartamento} onChange={(e) => setNovo({ ...novo, apartamento: e.target.value })} style={ENTRADA} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input className="nxc-campo" aria-label="Nome do morador" placeholder="Nome do morador" autoFocus value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={ENTRADA} />
                      <input className="nxc-campo" aria-label="E-mail (aviso de vencimento)" placeholder="E-mail (aviso de vencimento)" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} style={ENTRADA} />
                      <input className="nxc-campo" aria-label="Tag (opcional)" placeholder="Tag (opcional)" value={novo.tag_uid} onChange={(e) => setNovo({ ...novo, tag_uid: e.target.value })} style={ENTRADA} />
                    </span>
                    <input className="nxc-campo" aria-label="Validade (vazio = sem validade)" title="Vazio = sem validade" type="date" min={hojeYmd()} value={novo.validade} onChange={(e) => setNovo({ ...novo, validade: e.target.value })} style={ENTRADA} />
                    <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button type="button" onClick={() => setNovo(null)} style={{ height: 34, padding: '0 10px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: NX.seg }}>Cancelar</button>
                      <button type="button" onClick={addMorador} disabled={!novo.nome.trim() || salvando}
                        style={{ height: 34, padding: '0 10px', borderRadius: 10, fontSize: 13, fontWeight: 800, ...(novo.nome.trim() && !salvando ? { color: '#FFFFFF', background: NX.acao } : { color: NX.desab, background: NX.ro }) }}>
                        {salvando ? 'Salvando…' : 'Salvar'}
                      </button>
                    </span>
                  </div>
                )}
                {moradores.length === 0 && !novo && (
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>Nenhum morador cadastrado.</div>
                )}
                {moradores.map((m) => {
                  const lock = !!m.em_recarga || (!!sa?.morador_id && String(sa.morador_id).trim() === String(m.id).trim());
                  const vence = !!m.validade && m.validade.slice(0, 10) <= amanhaYmd() && m.validade.slice(0, 10) >= hojeYmd();
                  const vencido = m.ativo === false || (!!m.validade && m.validade.slice(0, 10) < hojeYmd());
                  const tag = lock ? 'Recarga em andamento' : vencido ? 'Acesso vencido' : vence ? (m.aviso_validade_em ? 'Vence amanhã · aviso enviado' : 'Vence amanhã') : '';
                  return (
                    <div key={m.id} style={{ display: 'grid', gridTemplateColumns: MOR_COLS, gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14 }}>
                      <span style={{ fontWeight: 700 }}>{m.apartamento || '—'}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }} title={m.tag_uid ? `Tag ${m.tag_uid}` : undefined}>
                        <span>{m.nome}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: lock ? '#2E8B47' : vencido ? NX.bad : '#B7791F' }}>{tag}</span>
                      </span>
                      <span style={{ color: vence || vencido ? '#B7791F' : NX.mudo, fontVariantNumeric: 'tabular-nums' }}>{dataBR(m.validade)}</span>
                      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => { if (!lock) delMorador(m.id); }} disabled={lock} title={lock ? 'Não é possível remover com recarga em andamento' : ''}
                          style={{ height: 34, padding: '0 12px', borderRadius: 10, fontSize: 13, fontWeight: 800, ...(lock ? { color: NX.desab, background: NX.ro } : { color: NX.bad, background: 'rgba(197,48,48,0.08)' }) }}>
                          {lock ? 'Remoção bloqueada' : 'Remover'}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {erroCfg && <span role="alert" style={{ fontSize: 13, color: NX.bad }}>{erroCfg}</span>}
          <span style={{ fontSize: 12, color: NX.mudo }}>Não é possível remover, desativar ou deixar vencer o acesso de um morador com recarga em andamento: o acesso expira logo após o fim da recarga. Aviso de vencimento: 1 dia antes, para o morador e para o proprietário.</span>
          </>)}
          {/* Carregador que não é OCPP: o Salvar (valor do kWh) continua no fim, como sempre. */}
          {!limites && botaoSalvar}

          {ocpp && pode.bloquear && id && <CarregadorComandos id={id} ocpp={ocpp} tecnico={!!pode.tecnico} onExecutado={aposComando} />}
          {pode.tecnico && id && (
            <CarregadorConexaoOcpp id={id} relerEm={lidoEm} credenciais={credenciais} onCredenciais={setCredenciais} onMudou={aposComando} />
          )}
          {pode.tecnico && ocpp && id && <CarregadorParametros id={id} conectado={ocpp.conectado !== false} />}
        </div>
      )}

      {/* Iniciar recarga? */}
      <NxDialog open={modal === 'iniciar'} onClose={fechar} label="Confirmar comando" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Iniciar recarga?</span>
          {/* As linhas da caixa se separam pela classe: a primeira muda conforme o perfil e o carregador. */}
          <div className="nxc-caixa">
            {!ehMorador && selectMorador}
            {/* O carregador OCPP não lê a bateria do carro: a linha só aparece quando há leitura. */}
            {(!ehOcpp || estado?.soc != null) && (
              <div style={CAIXA_ROW}><span>Bateria do carro</span><b>{estado?.soc != null ? `${Math.round(Number(estado.soc))}%` : '—'}</b></div>
            )}
            <div style={CAIXA_ROW}><span>Valor do kWh</span><b>{tarifa != null ? `${brl(tarifa)} (estimado)` : '—'}</b></div>
            {limites && <LimitesAoIniciar limites={limites} tempo={limTempo} energia={limEnergia} onTempo={setLimTempo} onEnergia={setLimEnergia} />}
          </div>
          {erroDlg}
          <NxDialogButtons onCancel={fechar} onConfirm={iniciar} confirmLabel="Iniciar" disabled={!corpoIniciar} marginTop={8} />
          {ehMorador && !estado?.meu_morador && <span style={{ fontSize: 13, color: NX.bad }}>Seu usuário não está ligado a um morador autorizado.</span>}
        </div>
      </NxDialog>

      {/* Parar recarga? */}
      <NxDialog open={modal === 'parar'} onClose={fechar} label="Confirmar comando" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Parar recarga?</span>
          <span style={{ fontSize: 14, color: NX.mudo }}>
            Recarregado até agora: {fmt(kwhAtual ?? 0, 1)} kWh{tarifa != null ? ` · ${brl((kwhAtual ?? 0) * tarifa)} (estimado)` : ''}
          </span>
          {erroDlg}
          <NxDialogButtons onCancel={fechar} onConfirm={parar} confirmLabel="Parar" marginTop={8} />
        </div>
      </NxDialog>

      {/* Pedir a vaga (fora do mockup: mantido como ação discreta) */}
      <NxDialog open={modal === 'vaga'} onClose={fechar} label="Confirmar comando" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Pedir a vaga?</span>
          <div className="nxc-caixa">
            {selectMorador}
            <div style={CAIXA_ROW}><span>Em recarga</span><b style={{ textAlign: 'right' }}>{morLabel(sa?.morador_nome)}</b></div>
          </div>
          <span style={{ fontSize: 14, color: NX.mudo }}>Avisa quem está carregando e começa a contar o tempo ocioso da vaga.</span>
          {erroDlg}
          <NxDialogButtons onCancel={fechar} onConfirm={pedirVaga} confirmLabel="Pedir a vaga" disabled={!moradorSel} marginTop={8} />
        </div>
      </NxDialog>

      {/* Confirmar alterações (valor do kWh, limites de uso e corrente máxima): de → para */}
      <NxReview open={modal === 'review'} onClose={() => { if (!salvando) fechar(); }} changes={emRevisao?.mudancas ?? []} writing={salvando}
        onWrite={salvarConfig} nota={emRevisao ? notaDaRevisao(emRevisao.corpo) : undefined} width={420} />

      <CarregadorExportar open={modal === 'export'} onClose={fechar} plantaId={plantaId} nome={carregador.nome} vagaNum={vagaNum} tarifa={tarifa} />
    </NxShell>
  );
}

export default CarregadorModal;
