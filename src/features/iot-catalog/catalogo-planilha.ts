// Import/export de MODELO do catálogo IoT via planilha Excel (.xlsx), por tipo.
// O template já vem pré-preenchido com os pontos do tipo; o usuário preenche endereço/
// func/dataType/scale por ponto e importa. Na importação os BLOCOS Modbus são derivados
// automaticamente (agrupa endereços contíguos por função) → o usuário não faz conta de bloco.
// SheetJS é carregado por import dinâmico (só nesta tela).

export interface ModeloImportado {
  tipoCodigo: string;
  fabricante: string;
  modelo: string;
  protocolo: string;
  mapeamento: Record<string, unknown>;
}

const DTYPE_SIZE: Record<string, number> = { U16: 1, S16: 1, COSFI: 1, U32: 2, S32: 2, FLOAT: 2, U32_SUM3: 3 };
const MAX_BLOCK = 120; // máx registradores por leitura Modbus
const GAP = 8; // buraco máximo pra manter no mesmo bloco (lê uns extras vale a pena)

function pontosAi(tipo: any): Array<{ id: string; label: string }> {
  const ai = tipo?.pontos?.ai;
  if (!Array.isArray(ai)) return [];
  return ai.map((p: any) => ({ id: String(p?.id ?? p?.pointId ?? '').trim(), label: String(p?.label ?? p?.id ?? '').trim() }))
    .filter((p) => p.id);
}

/** Baixa o template .xlsx (abas Metadados + Registros, pontos do tipo pré-preenchidos). */
export async function baixarTemplateModelo(tipo: any): Promise<void> {
  const XLSX = await import('xlsx');
  const meta: any[][] = [
    ['Campo', 'Valor'],
    ['fabricante', ''],
    ['modelo', ''],
    ['protocolo', 'rtu'], // rtu | tcp | tcp_usr | serial
    ['tipo', tipo?.codigo ?? ''],
    ['word_order', ''], // opcional: low_first | high_first
  ];
  const pontos = pontosAi(tipo);
  const registros: any[][] = [
    ['ponto_id', 'ponto', 'endereco', 'func', 'dataType', 'scale', 'mode', 'apply_factor'],
    ...pontos.map((p) => [p.id, p.label, '', '', '', '', '', '']),
  ];
  const instrucoes: any[][] = [
    ['Coluna', 'O que é', 'Valores aceitos'],
    ['endereco', 'Endereço absoluto do registrador Modbus do ponto (os blocos são derivados daqui na importação).', 'número (ex: 705)'],
    ['func', 'Função Modbus de leitura. 3 = holding registers, 4 = input registers.', '3 ou 4 (vazio = 3)'],
    ['dataType', 'Como decodificar. U16/S16/COSFI=1 reg; U32/S32/FLOAT=2 regs; U32_SUM3=3x2. S=com sinal, FLOAT=IEEE-754.', 'U16 | S16 | U32 | S32 | FLOAT | COSFI | U32_SUM3'],
    ['scale', 'Divisor: valor_real = cru / scale. Aceita número ou nome de escala (seção Escalas).', 'número (ex: 10) ou nome (ex: voltage)'],
    ['mode', 'Agregação no intervalo. avg=média (instantâneos); last=último (acumulados/kWh); delta=diferença (energia do período).', 'avg | last | delta (vazio = avg)'],
    ['apply_factor', 'Multiplica pelo fator do medidor (TP/TC). Só p/ medidor com relação de transformação. Deixe vazio no resto.', 'tp | tc | tp_tc | kd (ou vazio)'],
    [],
    ['Metadados (outra aba):', '', ''],
    ['tipo', 'Código do tipo do dispositivo (já preenchido).', ''],
    ['protocolo', 'Transporte (documentação; não muda os registradores).', 'rtu | tcp | tcp_usr | serial'],
    ['word_order', 'Ordem das palavras em valores de 2 regs. Deixe vazio se não souber.', 'high_first | low_first'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Metadados');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(registros), 'Registros');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instrucoes), 'Instruções');
  XLSX.writeFile(wb, `modelo-${(tipo?.codigo ?? 'tipo')}-template.xlsx`);
}

/** Lê a planilha preenchida e monta o modelo (deriva blocos + ai_map). */
export async function parseModeloPlanilha(file: File): Promise<ModeloImportado> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const metaSheet = wb.Sheets['Metadados'];
  const regSheet = wb.Sheets['Registros'];
  if (!metaSheet || !regSheet) throw new Error('A planilha precisa ter as abas "Metadados" e "Registros".');

  const metaRows = XLSX.utils.sheet_to_json(metaSheet, { header: 1 }) as any[][];
  const meta: Record<string, string> = {};
  for (const r of metaRows.slice(1)) if (r?.[0]) meta[String(r[0]).trim().toLowerCase()] = String(r[1] ?? '').trim();

  const regRows = XLSX.utils.sheet_to_json(regSheet, { header: 1 }) as any[][];
  const header = (regRows[0] ?? []).map((h: any) => String(h).trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iId = Math.max(0, col('ponto_id', 'pontoid', 'id'));
  const iAddr = col('endereco', 'endereço', 'address');
  const iFunc = col('func');
  const iDt = col('datatype', 'tipo_dado', 'dtype');
  const iScale = col('scale', 'escala');
  const iMode = col('mode');
  const iFactor = col('apply', 'factor', 'fator');

  const regs: Array<{ pid: string; addr: number; func: number; dt: string; scale: string; mode: string; factor: string }> = [];
  for (const r of regRows.slice(1)) {
    const pid = String(r?.[iId] ?? '').trim();
    const addrRaw = String(r?.[iAddr] ?? '').trim();
    if (!pid || addrRaw === '') continue; // só pontos com endereço preenchido
    const addr = Number(addrRaw);
    if (!Number.isFinite(addr)) throw new Error(`Endereço inválido no ponto "${pid}": ${addrRaw}`);
    regs.push({
      pid,
      addr,
      func: Number(String(r?.[iFunc] ?? '3').trim()) || 3,
      dt: (String(r?.[iDt] ?? 'U16').trim().toUpperCase() || 'U16'),
      scale: String(r?.[iScale] ?? '').trim(),
      mode: String(r?.[iMode] ?? '').trim(),
      factor: String(r?.[iFactor] ?? '').trim(),
    });
  }
  if (regs.length === 0) throw new Error('Nenhum registrador preenchido (a coluna "endereco" está vazia em todas as linhas).');

  // Deriva blocos: por função, ordena por endereço e agrupa contíguos.
  type Bloco = { func: number; start: number; count: number; label: string; lastEnd: number; index: number };
  const blocks: Bloco[] = [];
  const aiMap: Record<string, unknown> = {};
  const byFunc = new Map<number, typeof regs>();
  for (const g of regs) { if (!byFunc.has(g.func)) byFunc.set(g.func, []); byFunc.get(g.func)!.push(g); }
  for (const list of byFunc.values()) {
    list.sort((a, b) => a.addr - b.addr);
    let cur: Bloco | null = null;
    for (const g of list) {
      const size = DTYPE_SIZE[g.dt] ?? 1;
      if (!cur || g.addr - cur.lastEnd > GAP || g.addr + size - cur.start > MAX_BLOCK) {
        cur = { func: g.func, start: g.addr, count: 0, label: '', lastEnd: g.addr, index: blocks.length };
        blocks.push(cur);
      }
      cur.lastEnd = Math.max(cur.lastEnd, g.addr + size);
      cur.count = cur.lastEnd - cur.start;
      const entry: Record<string, unknown> = { block: cur.index, offset: g.addr - cur.start, dataType: g.dt };
      if (g.scale !== '') entry.scale = /^-?\d*\.?\d+$/.test(g.scale) ? Number(g.scale) : g.scale;
      if (g.mode) entry.mode = g.mode;
      if (g.factor) entry.apply_factor = g.factor;
      aiMap[g.pid] = entry;
    }
  }

  const mapeamento: Record<string, unknown> = {
    ai_blocks: blocks.map((b) => ({ func: b.func, start: b.start, count: b.count, ...(b.label ? { label: b.label } : {}) })),
    ai_map: aiMap,
  };
  if (meta.word_order) mapeamento.word_order = meta.word_order;

  return {
    tipoCodigo: meta.tipo ?? '',
    fabricante: meta.fabricante ?? '',
    modelo: meta.modelo ?? '',
    protocolo: meta.protocolo || 'rtu',
    mapeamento,
  };
}
