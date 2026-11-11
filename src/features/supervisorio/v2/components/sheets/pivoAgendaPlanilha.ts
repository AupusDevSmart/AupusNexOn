/**
 * Agenda do pivô por planilha (NEXON-98): o modelo para baixar e a leitura do arquivo enviado.
 * Uma linha por irrigação — dá para subir o ano todo. Quem confere de verdade (datas passadas,
 * sobreposição, horário de ponta) é a API, que recusa o envio inteiro se uma linha estiver errada;
 * aqui só se lê o arquivo e se barra o que nem dá para mandar.
 */

/** Linha da planilha como vai para a API (POST /pivos/:id/agenda/importar). */
export interface ItemPlanilha {
  linha: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  duracao_min: string;
  sentido: string;
  percentual: string;
  com_agua: string;
}

/** Irrigação já agendada por data (GET /pivos/:id/agenda). */
export interface AgendaItem {
  id: string; data: string; hora_inicio: string; duracao_min: number | null;
  sentido: 'horario' | 'anti_horario'; velocidade: number | null; com_agua: boolean; executada?: boolean;
}

export const COLUNAS = ['Data', 'Início', 'Fim', 'Duração (min)', 'Sentido', 'Percentímetro (%)', 'Água'] as const;

const chave = (v: unknown) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
/** Cabeçalho da planilha → campo. Aceita variações ("Hora início", "Percentimetro", "Agua"…). */
const CAMPO: Array<[RegExp, keyof Omit<ItemPlanilha, 'linha'>]> = [
  [/^data/, 'data'],
  [/^(hora)?inicio/, 'hora_inicio'],
  [/^(hora)?fim/, 'hora_fim'],
  [/^duracao/, 'duracao_min'],
  [/^(sentido|direcao)/, 'sentido'],
  [/^(percent|velocidade)/, 'percentual'],
  [/^(agua|comagua)/, 'com_agua'],
];

const txt = (v: unknown) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v ?? '').trim());

/**
 * Linhas da planilha (matriz, a primeira é o cabeçalho) → itens para a API. Linhas em branco são
 * ignoradas; `linha` é o número da linha no arquivo, para a mensagem de erro bater com o Excel.
 */
export function linhasParaItens(matriz: unknown[][]): { itens: ItemPlanilha[]; erro: string | null } {
  const iCab = matriz.findIndex((l) => (l ?? []).some((c) => /^data/.test(chave(c))));
  if (iCab < 0) return { itens: [], erro: 'Não achei a coluna "Data". Use o modelo para montar a planilha.' };
  const mapa = (matriz[iCab] ?? []).map((c) => CAMPO.find(([re]) => re.test(chave(c)))?.[1] ?? null);
  for (const [nome, campo] of [['Início', 'hora_inicio'], ['Sentido', 'sentido']] as const) {
    if (!mapa.includes(campo)) return { itens: [], erro: `Falta a coluna "${nome}". Use o modelo para montar a planilha.` };
  }
  if (!mapa.includes('hora_fim') && !mapa.includes('duracao_min')) return { itens: [], erro: 'Falta a coluna "Fim" (ou "Duração (min)"). Use o modelo para montar a planilha.' };
  const itens: ItemPlanilha[] = [];
  matriz.slice(iCab + 1).forEach((l, i) => {
    if (!(l ?? []).some((c) => txt(c) !== '')) return;
    const it: ItemPlanilha = { linha: iCab + i + 2, data: '', hora_inicio: '', hora_fim: '', duracao_min: '', sentido: '', percentual: '', com_agua: '' };
    mapa.forEach((campo, j) => { if (campo) it[campo] = txt(l[j]); });
    itens.push(it);
  });
  if (!itens.length) return { itens: [], erro: 'A planilha não tem nenhuma linha de irrigação abaixo do cabeçalho.' };
  if (itens.length > 2000) return { itens: [], erro: `Limite de 2000 linhas por envio (a planilha tem ${itens.length}). Divida em dois arquivos.` };
  return { itens, erro: null };
}

/** Lê .xlsx, .xls ou .csv. A biblioteca só carrega quando alguém usa a planilha. */
export async function lerPlanilha(arquivo: File): Promise<{ itens: ItemPlanilha[]; erro: string | null }> {
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { itens: [], erro: 'Arquivo vazio.' };
    // raw: false → datas e horas vêm como texto, no formato da célula (data vira AAAA-MM-DD)
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', dateNF: 'yyyy-mm-dd' });
    return linhasParaItens(matriz);
  } catch {
    return { itens: [], erro: 'Não consegui ler o arquivo. Use o modelo (.xlsx) ou um .csv.' };
  }
}

/** Baixa o modelo, com três linhas de exemplo e a folha de instruções. */
export async function baixarModelo(nomePivo: string) {
  const XLSX = await import('xlsx');
  const d = (dias: number) => { const x = new Date(Date.now() + dias * 86400000); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; };
  const linhas = [
    [...COLUNAS],
    [d(1), '21:00', '05:00', '', 'Direita', '60', 'Sim'],
    [d(2), '21:00', '', '480', 'Esquerda', '80', 'Sim'],
    [d(3), '08:00', '10:00', '', 'Direita', '', 'Não'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  // tudo como texto: o Excel não troca "21:00" por fração de dia nem a data por número
  Object.keys(ws).filter((k) => !k.startsWith('!')).forEach((k) => { ws[k].t = 's'; ws[k].z = '@'; });
  ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 8 }];
  const ajuda = XLSX.utils.aoa_to_sheet([
    ['Agenda do pivô por planilha — uma linha por irrigação'],
    [''],
    ['Data', 'Dia em que liga, DD/MM/AAAA. Só de hoje em diante, até dois anos à frente.'],
    ['Início', 'Hora em que liga, HH:MM (horário de Brasília).'],
    ['Fim', 'Hora em que desliga, HH:MM. Se for menor que o início, é no dia seguinte.'],
    ['Duração (min)', 'Em vez do Fim: quantos minutos fica ligado. Preencha um dos dois.'],
    ['Sentido', 'Direita ou Esquerda.'],
    ['Percentímetro (%)', 'De 1 a 100. Deixe em branco quando a Água for Não.'],
    ['Água', 'Sim (irriga) ou Não (gira seco, a bomba não liga). Em branco = Sim.'],
    [''],
    ['Uma irrigação não pode começar antes de a anterior terminar.'],
    ['Se uma linha estiver errada, nada é gravado e o NexON diz quais linhas corrigir.'],
    ['Apague as três linhas de exemplo antes de enviar.'],
  ]);
  ajuda['!cols'] = [{ wch: 20 }, { wch: 80 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
  XLSX.utils.book_append_sheet(wb, ajuda, 'Como preencher');
  XLSX.writeFile(wb, `agenda-${nomePivo.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pivo'}.xlsx`);
}

const br = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** "12/11/2026 · 21:00 → 05:00" e "60% · Molhado · Direita". */
export function textoAgenda(a: AgendaItem) {
  const [h, m] = a.hora_inicio.split(':').map(Number);
  const fim = a.duracao_min ? hhmm(h * 60 + m + a.duracao_min) : null;
  const dir = a.sentido === 'horario' ? 'Direita' : 'Esquerda';
  return {
    quando: `${br(a.data)} · ${a.hora_inicio}${fim ? ` → ${fim}` : ''}`,
    det: a.com_agua === false ? `Seco · ${dir}` : `${a.velocidade != null ? `${String(a.velocidade).replace('.', ',')}%` : '—'} · Molhado · ${dir}`,
  };
}
