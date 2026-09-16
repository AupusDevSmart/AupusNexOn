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
  if (t.includes('motor')) return 'motor';
  if (t.includes('pivo') || t.includes('pivô') || t.includes('irriga')) return 'pivo';
  return null;
}
