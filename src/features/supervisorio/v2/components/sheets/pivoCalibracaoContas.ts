/**
 * Calibração do ângulo do pivô (NEXON-103) — contas PURAS da aba Calibração, testadas em
 * pivoCalibracaoContas.test.ts. Mesmas fórmulas do servidor (pivo-calibracao.util da API):
 *
 *   azimute  = (graus(atan2(y, x)) + 360) mod 360        0° = norte verdadeiro, horário
 *   ângulo   = (az_cal + s · (bruto − bruto_cal) · 360/resolução) mod 360
 *
 * com s = +1 quando a contagem AUMENTA com o pivô no sentido horário e −1 quando diminui.
 * A tela só calcula para MOSTRAR (azimute, distância, motivos do Salvar): quem grava é a API.
 */

export type Sentido = 1 | -1;
export interface PontoGeo { lat: number; lon: number }
/** Texto dos dois campos de um ponto (o que a pessoa digitou). */
export interface CampoPonto { lat: string; lon: string }

export interface Calibracao {
  id: string; bruto_cal: number; sentido: Sentido; az_cal: number;
  centro_lat: number | null; centro_lon: number | null; ponta_lat: number | null; ponta_lon: number | null;
  resolucao: number | null; zero: number | null; origem: 'calibracao' | 'restauracao' | string; ativa: boolean;
  usuario_id: string | null; usuario_nome: string | null; criado_em: string; desativada_em: string | null;
  angulo_na_leitura?: number | null;
}
export interface Precondicoes {
  /** null = sem leitura */
  parado: boolean | null;
  /** true também quando o pivô não tem a chave seletora */
  modo_ton: boolean | null;
  tem_modo_ton: boolean;
  pendencias: string[];
}
/** A leitura do "Ler encoder" que o servidor ainda aceita (vale 10 min). */
export interface LeituraValida { valor: number; leituras: number[]; em: string }
/** GET /pivos/:id/calibracao (e a resposta de salvar/restaurar). */
export interface CalibracaoTela {
  pode_editar: boolean;
  encoder: { equipamento_id: string; nome: string | null; resolucao: number | null } | null;
  vigente: Calibracao | null;
  anterior: Calibracao | null;
  precondicoes: Precondicoes;
  leitura: { bruto: number | null; lido_em: string | null; angulo: number | null; motivo: string | null };
  ultima_leitura_valida: LeituraValida | null;
  distancia_min_m: number;
  distancia_max_m?: number;
  leituras_exigidas: number;
}
/** POST /pivos/:id/calibracao/ler-encoder */
export interface LeituraEncoder { valida: boolean; valor: number | null; leituras: number[]; motivo: string | null; lido_em: string }
/** POST /pivos/:id/calibracao — a API recusa campo a mais (forbidNonWhitelisted). */
export interface CorpoCalibracao { bruto_cal: number; sentido: Sentido; centro_lat: number; centro_lon: number; ponta_lat: number; ponta_lon: number }

export const DISTANCIA_MIN_M = 50;
/**
 * Nenhum lance de pivô chega perto disto. Centro e ponta mais longe = coordenada errada (sinal
 * esquecido, latitude e longitude trocadas) — e o azimute sairia errado sem ninguém notar.
 */
export const DISTANCIA_MAX_M = 2000;
export const VALIDADE_LEITURA_MIN = 10;

const rad = (g: number) => (g * Math.PI) / 180;
const graus = (r: number) => (r * 180) / Math.PI;
const arred = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;
const norm360 = (g: number) => ((g % 360) + 360) % 360;

/**
 * Coordenada digitada em graus decimais: aceita vírgula ou ponto e sinal negativo ("-" ou
 * o "−" tipográfico). null = vazia, não é número ou fora da faixa (lat ±90, lon ±180).
 */
export function parseCoordenada(txt: string | null | undefined, eixo: 'lat' | 'lon'): number | null {
  const t = String(txt ?? '').trim().replace(/−/g, '-').replace(/\s*°$/, '').replace(',', '.');
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= (eixo === 'lat' ? 90 : 180) ? n : null;
}

/**
 * Par "latitude, longitude" colado de uma vez (Google Maps: "-16.123456, -48.123456";
 * também "-16,123456; -48,123456", com barra ou só espaço). null = não é um par.
 */
export function parsePar(txt: string | null | undefined): PontoGeo | null {
  const t = String(txt ?? '').trim().replace(/−/g, '-');
  let partes = t.split(/\s*[;/]\s*|,\s+|\s+/).filter(Boolean);
  // "-16.123456,-48.123456": sem espaço, a vírgula só pode ser o separador (os decimais usam ponto).
  if (partes.length === 1 && /^[^,]*\.[^,]*,[^,]*\.[^,]*$/.test(t)) partes = t.split(',');
  if (partes.length !== 2) return null;
  const lat = parseCoordenada(partes[0], 'lat');
  const lon = parseCoordenada(partes[1], 'lon');
  return lat != null && lon != null ? { lat, lon } : null;
}

/** O ponto dos dois campos, ou null enquanto faltar ou estiver inválido. */
export function pontoDe(c: CampoPonto): PontoGeo | null {
  const lat = parseCoordenada(c.lat, 'lat');
  const lon = parseCoordenada(c.lon, 'lon');
  return lat != null && lon != null ? { lat, lon } : null;
}

/** Coordenada para o campo: 7 casas (≈ 1 cm), vírgula decimal. */
export const fmtCoordenada = (v: number): string => v.toFixed(7).replace('.', ',');

/** Azimute do braço (centro → ponta): 0° = norte verdadeiro, horário, 0 a 359,99. */
export function azimute(centro: PontoGeo, ponta: PontoGeo): number {
  const lat1 = rad(centro.lat), lat2 = rad(ponta.lat);
  const dLon = rad(ponta.lon - centro.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const az = arred(norm360(graus(Math.atan2(y, x))), 2);
  return az >= 360 ? 0 : az;
}

/** Distância entre os dois pontos, em metros (haversine, R = 6 371 000 m). */
export function distanciaM(a: PontoGeo, b: PontoGeo): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const naVolta = (bruto: number, resolucao: number) => ((Math.round(bruto) % resolucao) + resolucao) % resolucao;

/** Ângulo em operação a partir da leitura do encoder e da calibração, 0 a 359,99. */
export function anguloCalibrado(bruto: number, cal: { az_cal: number; bruto_cal: number; sentido: Sentido }, resolucao: number): number {
  const a = arred(norm360(cal.az_cal + cal.sentido * (naVolta(bruto, resolucao) - naVolta(cal.bruto_cal, resolucao)) * (360 / resolucao)), 2);
  return a >= 360 ? 0 : a;
}

/** "43,9°" — uma casa, 0 a 359,9 (359,96 vira 0,0, nunca 360,0). "—" sem valor. */
export function grausTxt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = arred(norm360(v), 1);
  return `${(r >= 360 ? 0 : r).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°`;
}

export const sentidoTxt = (sn: Sentido | number): string => (Number(sn) === -1 ? 'Anti-horário' : 'Horário');

/**
 * Pré-condições do pivô (parado, chave em modo TON). Os textos vêm prontos do servidor em
 * `pendencias`; só monta aqui se ele disser que falta algo sem dizer o quê.
 */
export function pendenciasDoPivo(pre: Precondicoes | null | undefined): string[] {
  if (!pre) return ['Sem leitura do estado do pivô: não dá para saber se ele está parado'];
  const prontas = (pre.pendencias ?? []).filter(Boolean);
  if (prontas.length) return prontas;
  const out: string[] = [];
  if (pre.parado !== true) out.push(pre.parado === false ? 'Pivô em movimento: a calibração só é feita com o pivô parado' : 'Sem leitura do estado do pivô: não dá para saber se ele está parado');
  if (pre.modo_ton !== true) out.push(pre.modo_ton === false ? 'Chave seletora em modo CLP: passe para o modo TON' : 'Sem leitura da chave seletora (modo TON)');
  return out;
}

export interface EntradaSalvar {
  precondicoes: Precondicoes | null | undefined;
  /** Leitura válida do "Ler encoder" (a que o servidor ainda aceita), ou null. */
  leitura: { valor: number } | null | undefined;
  /** Por que não há leitura válida (recusada, vencida). Sem isto: "leia o encoder". */
  semLeituraPorque?: string | null;
  centro: CampoPonto;
  ponta: CampoPonto;
  distanciaMinM?: number;
  distanciaMaxM?: number;
}

const vazio = (c: CampoPonto) => c.lat.trim() === '' || c.lon.trim() === '';

/**
 * Tudo o que ainda impede o "Salvar calibração", na ordem da tela. Lista vazia = pode salvar.
 * 1 pivô parado · 2 chave em modo TON · 3 leitura válida do encoder · 4 centro e ponta
 * válidos e a mais de 50 m um do outro.
 */
export function motivosPendentes(e: EntradaSalvar): string[] {
  const out = pendenciasDoPivo(e.precondicoes);
  if (!e.leitura) out.push(e.semLeituraPorque || 'Leia o encoder: toque em "Ler encoder" com o pivô parado');
  const pontos: Array<[string, CampoPonto]> = [['do centro', e.centro], ['da ponta', e.ponta]];
  for (const [de, campo] of pontos) {
    if (vazio(campo)) out.push(`Informe a posição ${de} (latitude e longitude)`);
    else if (!pontoDe(campo)) out.push(`Posição ${de} inválida: use graus decimais, como −16,1234567`);
  }
  const centro = pontoDe(e.centro), ponta = pontoDe(e.ponta);
  if (centro && ponta) {
    const min = e.distanciaMinM ?? DISTANCIA_MIN_M;
    const d = distanciaM(centro, ponta);
    const max = e.distanciaMaxM ?? DISTANCIA_MAX_M;
    // 49,6 m não pode aparecer como "50 m (mínimo 50 m)": arredonda para baixo.
    if (!(d > min)) out.push(`Pontos muito próximos: ${Math.floor(d)} m (mínimo ${min} m)`);
    else if (d > max) out.push(`Pontos muito distantes: ${Math.round(d).toLocaleString('pt-BR')} m (máximo ${max.toLocaleString('pt-BR')} m) — confira o sinal de menos e se latitude e longitude não estão trocadas`);
  }
  return out;
}

/** Corpo do POST, ou null enquanto faltar leitura ou coordenada. */
export function corpoCalibracao(leitura: { valor: number } | null | undefined, sentido: Sentido, centro: CampoPonto, ponta: CampoPonto): CorpoCalibracao | null {
  const c = pontoDe(centro), p = pontoDe(ponta);
  if (!leitura || !c || !p) return null;
  return { bruto_cal: leitura.valor, sentido, centro_lat: c.lat, centro_lon: c.lon, ponta_lat: p.lat, ponta_lon: p.lon };
}

/** Falha do `navigator.geolocation` em português (1 negado · 2 indisponível · 3 demorou). */
export function mensagemGeo(code: number | null | undefined): string {
  if (code === 1) return 'Localização negada: libere a localização deste site no navegador ou digite a coordenada';
  if (code === 2) return 'Localização indisponível neste aparelho agora (sem sinal de GPS): tente a céu aberto ou digite a coordenada';
  if (code === 3) return 'O aparelho não informou a localização em 15 s: tente de novo a céu aberto ou digite a coordenada';
  return 'Não foi possível obter a localização: digite a coordenada';
}
