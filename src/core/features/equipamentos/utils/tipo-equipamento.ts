/**
 * O tipo de equipamento que veio junto do proprio equipamento, no formato que
 * os sheets esperam.
 *
 * O transform da API achata o tipo em `tipoEquipamentoObj` e, no caminho, troca
 * `categoria` de objeto para o nome dela em texto. Os sheets, por sua vez, leem
 * `categoria.nome` — herdado de quando o dado vinha da rota
 * `/tipos-equipamentos/codigo/:codigo`, onde categoria e objeto.
 *
 * Enquanto as duas formas circulam com o mesmo nome, quem consome escolhe uma e
 * erra silenciosamente na outra: `'Media Tensao'.nome` e `undefined`, e a tela
 * mostra "Não informado" sem nenhum erro. Normalizar num lugar so encerra a
 * duvida — os sheets passam a receber sempre a mesma forma.
 */
export interface TipoEquipamentoNormalizado {
  id: string;
  codigo: string;
  nome: string;
  fabricante: string;
  categoriaId: string;
  categoria?: { id: string; nome: string };
}

export function normalizarTipoEquipamento(
  bruto: any,
): TipoEquipamentoNormalizado | null {
  const id = bruto?.id?.trim?.() || bruto?.id;
  if (!id) return null;

  const categoriaId = (bruto.categoriaId ?? bruto.categoria_id)?.trim?.() ?? '';
  const categoria =
    typeof bruto.categoria === 'string'
      ? bruto.categoria
        ? { id: categoriaId, nome: bruto.categoria }
        : undefined
      : bruto.categoria;

  return {
    id,
    codigo: bruto.codigo?.trim?.() ?? bruto.codigo ?? '',
    nome: bruto.nome?.trim?.() ?? bruto.nome ?? '',
    fabricante: bruto.fabricante ?? '',
    categoriaId,
    categoria,
  };
}
