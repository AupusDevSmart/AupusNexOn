// src/features/plantas/components/InstalacoesExpandedRow.tsx
import { Button } from '@/core/components/ui/button';
import { Eye, Pencil } from 'lucide-react';
import type { Unidade } from '@/core/features/unidades/types';

/**
 * Instalacoes de uma planta, dentro da linha expandida da tabela de plantas.
 *
 * Substitui a pagina /cadastros/unidades: a instalacao sempre pertence a uma
 * planta, entao listar por planta e o caminho natural.
 *
 * APRESENTACIONAL de proposito. Antes este componente buscava os dados e
 * montava o sheet aqui dentro, o que colocava o BaseModal dentro de um
 * <TableCell> — e o formulario abria vazio, com so o proprietario preenchido.
 * A PlantasPage voltou a ser a dona dos dados e do sheet, que e como a pagina
 * de unidades fazia quando funcionava.
 */

interface InstalacoesExpandedRowProps {
  unidades: Unidade[];
  carregando?: boolean;
  somenteLeitura?: boolean;
  onVisualizar: (unidade: Unidade) => void;
  onEditar: (unidade: Unidade) => void;
  /**
   * Da planta expandida, e não de cada unidade: é o que permite o link para
   * "ver equipamentos" já levar proprietário e planta junto, sem depender de
   * `unidade.planta` estar populado na resposta desta lista em particular.
   */
  plantaId?: string;
  proprietarioId?: string;
}

/**
 * Recuo da lista para dentro da linha da planta.
 *
 * Na linha da tabela o nome da planta começa depois da célula do chevron
 * (w-10 = 40px) mais o px-3 da própria célula: 52px da borda esquerda. A linha
 * expandida vem com p-0, então sem recuo a lista nascia à ESQUERDA do nome da
 * planta, como se fosse irmã dela e não filha.
 *
 * pl-16 (64px) põe o nome da instalação 12px adentro do nome da planta. As
 * linhas internas não têm padding horizontal próprio — o recuo mora todo aqui,
 * senão a conta se espalha por dois lugares.
 */
const RECUO = 'pl-16 pr-4';

/**
 * As colunas mostram o que o sheet edita: perfil, tensão e grupo.
 *
 * Antes eram "tipo" e "perfil", ambas derivadas dos checkboxes
 * (irrigante/sazonal/industrial/geração) — que sobrepunham uma à outra e que
 * deixaram de aparecer no sheet do Service. O resultado era uma linha com dois
 * traços e nenhuma pista do que significavam.
 */
const rotuloGrupo = (unidade: Unidade) =>
  unidade.grupo ? `Grupo ${unidade.grupo}` : '-';

export function InstalacoesExpandedRow({
  unidades,
  carregando = false,
  somenteLeitura = false,
  onVisualizar,
  onEditar,
  plantaId,
  proprietarioId,
}: InstalacoesExpandedRowProps) {
  if (carregando) {
    return (
      <div className={`${RECUO} py-3 border-t`}>
        <p className="py-2 text-sm text-muted-foreground">Carregando instalações...</p>
      </div>
    );
  }

  if (unidades.length === 0) {
    return (
      <div className={`${RECUO} py-3 border-t`}>
        <p className="py-2 text-sm text-muted-foreground">
          Nenhuma instalação nesta planta ainda.
        </p>
      </div>
    );
  }

  return (
    <div className={`${RECUO} py-3 border-t`}>
      {/* Sem moldura: a caixa em volta competia com a borda da própria linha
          da tabela. O divide-y separa uma instalação da outra, que é a única
          divisão que precisa ser vista. */}
      {/* Larguras e classes de visibilidade iguais às das células: a legenda
          precisa cair exatamente sobre o dado que nomeia, inclusive quando uma
          coluna some no celular. A coluna de ações não tem título — os ícones
          já dizem o que fazem. */}
      <div className="flex items-center gap-3 pb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
        <div className="min-w-0 flex-1">Instalação</div>
        <div className="hidden md:block w-28 flex-shrink-0">Perfil</div>
        <div className="hidden md:block w-24 flex-shrink-0">Tensão</div>
        <div className="hidden lg:block w-44 flex-shrink-0">Grupo tarifário</div>
        <div className="w-[3.75rem] flex-shrink-0" />
      </div>

      <div className="divide-y">
        {unidades.map((unidade) => (
          <div key={unidade.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              {/* Link para os equipamentos DESTA instalacao: a EquipamentosPage
                  ja le `unidadeId` da URL e monta o filtro sozinha.
                  proprietarioId, plantaId e unidadeNome vao junto para que
                  "Novo Equipamento", clicado de dentro deste filtro, nasca com
                  a localizacao inteira preenchida — sem eles so o id da
                  instalacao chegava, e faltava por onde derivar o resto. */}
              <a
                href={`/cadastros/equipamentos?unidadeId=${unidade.id?.trim()}&unidadeNome=${encodeURIComponent(unidade.nome)}${plantaId ? `&plantaId=${plantaId}` : ''}${proprietarioId ? `&proprietarioId=${proprietarioId}` : ''}`}
                className="text-sm text-foreground truncate block hover:underline"
                title={`Ver equipamentos de ${unidade.nome}`}
              >
                {unidade.nome}
              </a>
            </div>

            <div className="hidden md:block w-28 flex-shrink-0 text-xs text-muted-foreground truncate">
              {unidade.tipo || '-'}
            </div>

            <div className="hidden md:block w-24 flex-shrink-0 text-xs text-muted-foreground truncate">
              {unidade.tensaoNominal || '-'}
            </div>

            <div className="hidden lg:block w-44 flex-shrink-0 text-xs text-muted-foreground truncate">
              {rotuloGrupo(unidade)}
            </div>

            {/* Largura fixa e alinhado à direita: em somente leitura sobra só
                um botão, e sem isso a coluna encolhia e desalinhava do
                cabeçalho. */}
            <div className="flex w-[3.75rem] items-center justify-end gap-0.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onVisualizar(unidade)}
                title="Visualizar"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {!somenteLeitura && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onEditar(unidade)}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
