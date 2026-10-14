/**
 * Mapeia o tipo/categoria de um equipamento do unifilar para o sheet de detalhe
 * correspondente (Fase 6). O Disjuntor tem fluxo próprio (DisjuntorSheet, via SCS);
 * eletroposto/carregador seguem, por ora, o fluxo legado da bomba/carregador.
 */
export type SheetKind = 'inversor' | 'medidor' | 'motor' | 'pivo';

export function sheetKindFor(tipo?: string | null, categoria?: string | null): SheetKind | null {
  const t = (String(tipo || '') + ' ' + String(categoria || '')).toLowerCase();
  if (t.includes('inversor')) return 'inversor';
  if (t.includes('medidor')) return 'medidor';
  // Medidor Concessionária: tipo EQTL001, categoria "Padrão de Energia - Ramal de Entrada"
  // (nenhum dos dois tem "medidor" no texto) — lido pelo A-966 ou pela SSU da TON-V2.
  if (t.includes('eqtl') || t.includes('concession') || t.includes('padrão de energia') || t.includes('padrao de energia')) return 'medidor';
  if (t.includes('motor')) return 'motor';
  if (t.includes('pivo') || t.includes('pivô') || t.includes('irriga')) return 'pivo';
  return null;
}
