/**
 * Fixtures com os valores de exemplo dos mockups aprovados (NEXON-33, outubro/2026).
 * Servem de teste e de referência visual: renderizadas, devem bater com os HTML do canvas.
 */
import type {
  CabecalhoRelatorio, RelatorioConsumo, RelatorioGeracao, RelatorioIrrigacao, RelatorioRecargas, TipoRelatorioOperacao,
} from '../tipos';

const cab = (tipo: TipoRelatorioOperacao, plantaNome: string, unidadeNome: string): CabecalhoRelatorio => ({
  tipo,
  plantaNome,
  unidadeNome,
  mes: '2026-10',
  inicio: '2026-10-01T00:00:00-03:00',
  fim: '2026-10-31T23:59:59.999-03:00',
  geradoEm: '2026-11-01T08:00:00-03:00',
});

// ───────────────────────── Irrigação ─────────────────────────

const PIVOS: Array<[string, number, string, number, number, number, number, number, number, number]> = [
  ['Pivô 1', 112, 'Soja', 6, 42, 45, 168, 18350, 0, 99],
  ['Pivô 2', 96, 'Soja', 5, 36, 40, 140, 13480, 0, 100],
  ['Pivô 3', 120, 'Milho', 6, 44, 45, 176, 24290, 1, 98],
  ['Pivô 4', 88, 'Feijão', 7, 48, 50, 190, 15630, 0, 100],
  ['Pivô 5', 104, 'Soja', 5, 38, 40, 152, 15410, 1, 99],
  ['Pivô 6', 92, 'Milho', 4, 29, 40, 118, 10420, 3, 91],
  ['Pivô 7', 76, 'Feijão', 6, 45, 45, 160, 12650, 0, 100],
  ['Pivô 8', 72, 'Soja', 5, 40, 42, 150, 11230, 0, 100],
];

const SEGMENTOS: Record<string, Array<[number, number]>> = {
  'Pivô 1': [[0, 17], [21, 20], [69, 20], [117, 22], [140, 18]],
  'Pivô 2': [[2, 14], [45, 21], [93, 22], [146, 20]],
  'Pivô 3': [[21, 20], [70, 20], [118, 30]],
  'Pivô 4': [[0, 18], [21, 21], [45, 21], [93, 23], [141, 19]],
  'Pivô 5': [[21, 18], [62, 10], [69, 21], [120, 26]],
  'Pivô 6': [[22, 12], [72, 6], [96, 14], [145, 12]],
  'Pivô 7': [[1, 16], [46, 20], [94, 21], [142, 18]],
  'Pivô 8': [[21, 21], [69, 21], [118, 21]],
};
const PARADAS_TL: Record<string, number[]> = { 'Pivô 6': [34, 78, 110], 'Pivô 3': [41] };

export const irrigacaoFixture: RelatorioIrrigacao = {
  cabecalho: cab('irrigacao', 'Fazenda Pontal', 'Sede'),
  safra: '2026/27',
  areaHa: 760,
  tarifaKwh: 0.62,
  linhas: PIVOS.map(([nome, areaHa, cultura, voltas, laminaMm, programadoMm, horas, kwh, paradas, disp], i) => ({
    equipamentoId: `pivo-${i + 1}`,
    nome,
    areaHa,
    cultura,
    voltas,
    laminaMm,
    programadoMm,
    horas,
    kwh,
    paradas,
    disponibilidadePct: disp,
    chamados: { abertos: nome === 'Pivô 3' ? 1 : 0, atendidos: nome === 'Pivô 6' ? 1 : 0 },
  })),
  energiaPorPosto: { pontaKwh: 5020, foraPontaKwh: 72000, reservadoKwh: 44440 },
  linhaDoTempo: {
    inicio: '2026-10-20',
    dias: ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'].map((data, i) => ({
      data,
      temPonta: i !== 4 && i !== 5,
    })),
    pontaInicioH: 18,
    pontaFimH: 21,
    pivos: Object.keys(SEGMENTOS).map((nome) => ({
      nome,
      segmentos: SEGMENTOS[nome].map(([inicioH, du]) => ({ inicioH, fimH: inicioH + du })),
      paradasH: PARADAS_TL[nome] ?? [],
    })),
  },
  setores: { pivo: 'Pivô 6', programadoMm: 40, mm: [40, 40, 39, 40, 12, 8, 38, 40, 40, 39, 40, 40] },
  ocorrencias: [
    { inicio: '2026-10-03T14:12:00-03:00', pivo: 'Pivô 6', motivo: 'Pressão baixa', duracaoMin: 160, mmPerdidos: 4.1, problema: true },
    { inicio: '2026-10-11T06:30:00-03:00', pivo: 'Pivô 6', motivo: 'Pressão baixa', duracaoMin: 310, mmPerdidos: 7.8, problema: true },
    { inicio: '2026-10-11T22:05:00-03:00', pivo: 'Pivô 3', motivo: 'Desalinhamento', duracaoMin: 75, mmPerdidos: 1.2, problema: true },
    { inicio: '2026-10-19T09:40:00-03:00', pivo: 'Pivô 6', motivo: 'Pressão baixa', duracaoMin: 185, mmPerdidos: 4.6, problema: true },
    { inicio: '2026-10-24T13:20:00-03:00', pivo: 'Pivô 1', motivo: 'Falta de energia (rede)', duracaoMin: 45, mmPerdidos: 0.7, problema: true },
    { inicio: '2026-10-23T18:00:00-03:00', pivo: 'Pivô 4', motivo: 'Bloqueio de ponta (programado)', duracaoMin: 180, mmPerdidos: null, problema: false },
  ],
  chamados: [
    {
      numero: 2318,
      equipamento: 'Pivô 6',
      titulo: 'Pressão baixa recorrente na adutora',
      abertoEm: '2026-10-11T07:02:00-03:00',
      abertoPor: 'João Lima',
      abertoPorPapel: 'operador',
      notificado: ['Smart Service (OS 2318)', 'WhatsApp do gerente'],
      status: 'FECHADO',
      atendidoEm: '2026-10-13T10:40:00-03:00',
    },
    {
      numero: 2327,
      equipamento: 'Pivô 3',
      titulo: 'Desalinhamento na torre 4',
      abertoEm: '2026-10-12T08:15:00-03:00',
      abertoPor: 'Ana Souza',
      abertoPorPapel: 'analista de operação',
      notificado: ['E-mail manutencao@fazendapontal'],
      status: 'ABERTO',
      atendidoEm: null,
    },
  ],
};

// ───────────────────────── Geração ─────────────────────────

const ESPERADO = [7600, 7400, 7900, 7700, 6100, 5200, 7800, 7900, 8000, 7800, 7300, 7900, 6600, 4800, 7700, 7900, 7600, 7400, 7800, 7200, 6900, 7700, 7800, 5600, 7400, 7600, 7700, 7500, 7300, 7600, 6935];
const RAZAO = [0.95, 0.96, 0.95, 0.96, 0.94, 0.95, 0.96, 0.95, 0.84, 0.82, 0.95, 0.96, 0.95, 0.94, 0.96, 0.95, 0.96, 0.95, 0.96, 0.95, 0.96, 0.95, 0.96, 0.95, 0.96, 0.95, 0.96, 0.95, 0.96, 0.95, 0.96];
const RANKING: Array<[string, number, string | null]> = [
  ['Inversor 2 · UFV 1', 118, 'Falha em 09–10/10 (2 dias parado)'],
  ['Inversor 7 · UFV 2', 128, 'String com corrente baixa'],
  ['Inversor 5 · UFV 1', 134, 'Sujeira (fileira perto da estrada)'],
  ['Inversor 9 · UFV 2', 136, 'Sombreamento no fim da tarde'],
  ['Inversor 1 · UFV 2', 137, 'Dentro da variação normal'],
  ['Inversor 8 · UFV 1', 138, 'Dentro da variação normal'],
];
const OUTROS_INV = Array.from({ length: 13 }, (_, i): [string, number, string | null] => [`Inversor ${i + 10} · UFV ${(i % 2) + 1}`, 144, null]);
const KWP_INV = 1530 / 19;

export const geracaoFixture: RelatorioGeracao = {
  cabecalho: cab('geracao', 'Fazenda Pontal', 'UFV 1 e UFV 2'),
  potenciaKwp: 1530,
  fonteEsperado: 'satelite',
  energiaKwh: 214200,
  energiaMesAnteriorKwh: 201700,
  esperadoKwh: 226800,
  disponibilidadePct: 99.2,
  diasComInversorParado: 2,
  potenciaMaxKw: 1012,
  potenciaMaxEm: '2026-10-12T12:30:00-03:00',
  autoconsumoKwh: 130660,
  injetadaKwh: 83540,
  injecaoMaxKw: 512,
  injecaoMaxEm: '2026-10-12T12:15:00-03:00',
  tarifaReferencia: 0.62,
  diario: ESPERADO.map((e, i) => ({
    dia: `2026-10-${String(i + 1).padStart(2, '0')}`,
    geradoKwh: Math.round(e * RAZAO[i]),
    esperadoKwh: e,
  })),
  perdas: {
    indisponibilidadeKwh: 2100,
    limitacaoExternaKwh: 1400,
    limitacaoProjetoKwh: 3900,
    outrasKwh: 5200,
    notaIndisponibilidade: 'Inversor 2 · UFV 1 · 09–10/10',
  },
  inversores: [...RANKING, ...OUTROS_INV].map(([nome, kwhPorKwp, causa], i) => ({
    equipamentoId: `inv-${i + 1}`,
    nome,
    potenciaKwp: Math.round(KWP_INV * 10) / 10,
    energiaKwh: Math.round(kwhPorKwp * KWP_INV),
    kwhPorKwp,
    diasParado: i === 0 ? 2 : 0,
    causa,
  })),
  chamados: [
    {
      numero: 2291,
      equipamento: 'Inversor 2 · UFV 1',
      titulo: 'Inversor desligado por falha de isolamento',
      abertoEm: '2026-10-09T08:15:00-03:00',
      abertoPor: 'Ana Souza',
      abertoPorPapel: 'analista de operação',
      notificado: ['Smart Service (OS 2291)', 'e-mail do proprietário'],
      status: 'FECHADO',
      atendidoEm: '2026-10-10T16:30:00-03:00',
    },
    {
      numero: 2335,
      equipamento: 'Inversor 7 · UFV 2',
      titulo: 'Verificar string 3 com corrente baixa',
      abertoEm: '2026-10-21T10:05:00-03:00',
      abertoPor: 'Ana Souza',
      abertoPorPapel: 'analista de operação',
      notificado: ['Smart Service (OS 2335)'],
      status: 'ENCAMINHADO',
      atendidoEm: null,
    },
  ],
};

// ───────────────────────── Consumo ─────────────────────────

const DEMANDA: Array<[string, number]> = [
  ['2025-11', 1180], ['2025-12', 1050], ['2026-01', 1120], ['2026-02', 1240], ['2026-03', 1290], ['2026-04', 1330],
  ['2026-05', 1360], ['2026-06', 1385], ['2026-07', 1468], ['2026-08', 1395], ['2026-09', 1340], ['2026-10', 1312],
];

export const consumoFixture: RelatorioConsumo = {
  cabecalho: cab('consumo', 'Fazenda Pontal', 'Sede'),
  modalidade: 'tarifa verde A4',
  demandaContratadaKw: 1400,
  toleranciaPct: 5,
  consumoTotalKwh: 421060,
  daRedeKwh: 290400,
  daRedeMesAnteriorKwh: 305050,
  energiaPorPosto: { pontaKwh: 18900, foraPontaKwh: 171600, reservadoKwh: 99900 },
  demandaMaxKw: 1312,
  demandaMaxEm: '2026-10-14T14:15:00-03:00',
  ultrapassagens: 0,
  fpMedio: 0.93,
  intervalosFpBaixo: 58,
  reativoExcedenteKvarh: 4820,
  reativoIndutivoPct: 82,
  cargaBaseKw: 86,
  demanda12m: DEMANDA.map(([mes, maxKw]) => ({ mes, maxKw })),
  maioresConsumidores: [
    { nome: 'Confinamento', kwh: 182300 },
    { nome: 'Pivôs 1–8 (irrigação)', kwh: 121460 },
    { nome: 'Secador', kwh: 78400 },
    { nome: 'Oficina e sede', kwh: 22900 },
    { nome: 'Outros', kwh: 16000 },
  ],
  curvaTipica: {
    diaUtil: [96, 90, 86, 86, 88, 120, 260, 520, 780, 960, 1040, 1080, 1060, 1100, 1120, 1060, 900, 640, 380, 360, 420, 640, 520, 180],
    fimDeSemana: [94, 88, 86, 86, 86, 100, 180, 340, 520, 640, 700, 720, 700, 690, 680, 640, 540, 400, 300, 280, 300, 360, 300, 140],
  },
  balanco: { geracaoKwh: 214200, autoconsumoKwh: 130660, daRedeKwh: 290400, injetadaKwh: 83540 },
  chamados: [
    {
      numero: 2330,
      equipamento: 'Banco de capacitores',
      titulo: 'FP abaixo de 0,92 de manhã: verificar estágios do banco',
      abertoEm: '2026-10-15T09:20:00-03:00',
      abertoPor: 'Diego Santana',
      abertoPorPapel: 'proprietário',
      notificado: ['WhatsApp do eletricista (Marcos)'],
      status: 'FECHADO',
      atendidoEm: '2026-10-22T09:10:00-03:00',
    },
  ],
};

// ───────────────────────── Recargas ─────────────────────────

const SESSOES: Record<string, Array<[string, string, number, number, number]>> = {
  'Vaga 12': [['101', 'Luiz M.', 9, 214.6, 612], ['204', 'Carla S.', 7, 168.2, 470], ['302', 'Rafael T.', 5, 121.4, 335], ['501', 'Mônica R.', 4, 88.9, 248]],
  'Vaga 31': [['304', 'Paulo A.', 11, 248.3, 690], ['204', 'Carla S.', 3, 71.5, 196], ['403', 'Júlia F.', 8, 176.8, 505], ['602', 'Bruno C.', 6, 134.7, 380]],
};

export const recargasFixture: RelatorioRecargas = {
  cabecalho: cab('recargas', 'Condomínio Jardins', 'Garagem'),
  valorKwh: 1.1,
  energiaMesAnteriorKwh: 1093.2,
  carregadores: Object.keys(SESSOES).map((vaga) => ({
    equipamentoId: vaga === 'Vaga 12' ? 'car-12' : 'car-31',
    nome: `Carregador ${vaga}`,
    potenciaKw: vaga === 'Vaga 12' ? 22 : 7.4,
    disponibilidadePct: vaga === 'Vaga 12' ? 100 : 98.9,
    chamadosNoMes: vaga === 'Vaga 12' ? 0 : 1,
    moradores: SESSOES[vaga].map(([apartamento, morador, recargas, kwh, minutos]) => ({ apartamento, morador, recargas, kwh, minutos })),
  })),
  chamados: [
    {
      numero: 2321,
      equipamento: 'Vaga 31',
      titulo: 'Recarga interrompida sem motivo aparente',
      abertoEm: '2026-10-09T20:10:00-03:00',
      abertoPor: 'Apto 304',
      abertoPorPapel: 'morador',
      notificado: ['Síndico (WhatsApp)', 'Smart Service (OS 2321)'],
      status: 'FECHADO',
      atendidoEm: '2026-10-10T15:30:00-03:00',
    },
  ],
};
