// src/components/common/base-table/BaseTable.tsx
import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/core/components/ui/table';
import { Button } from '@/core/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import {
  Eye,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal
} from 'lucide-react';
import { Skeleton } from '@/core/components/ui/skeleton';
import { BaseEntity, TableColumn, Pagination, TableAction } from '@/core/types/base';

export type CustomAction<T> = TableAction<T>;

/**
 * O ícone de uma ação pode chegar como elemento pronto (`<Copy />`) ou como o
 * componente (`Copy`) — o tipo aceita os dois.
 *
 * Checar `typeof === 'function'` não bastava: ícone do Lucide é criado com
 * `forwardRef`, então é um OBJETO, não uma função. Ele caía no ramo do "já é
 * elemento" e o React recebia `{$$typeof, render}` como filho, derrubando a
 * página inteira com "Objects are not valid as a React child".
 */
const renderarIcone = (icone: TableAction['icon']): React.ReactNode => {
  if (!icone) return null;
  if (React.isValidElement(icone)) return icone;
  if (typeof icone === 'function' || typeof icone === 'object') {
    return React.createElement(icone as React.ComponentType<any>, {
      className: 'h-4 w-4',
    });
  }
  return icone as React.ReactNode;
};

interface BaseTableProps<T extends BaseEntity> {
  data: T[];
  columns: TableColumn<T>[];
  pagination: Pagination;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onView?: (entity: T) => void;
  onEdit?: (entity: T) => void;
  onDelete?: (entity: T) => void;
  customActions?: CustomAction<T>[]; // NOVA: Ações customizadas
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  // NOVA: Expansão de linha (controlada pelo consumidor, que costuma precisar do
  // id aberto para buscar/recarregar o conteúdo aninhado).
  // Só liga quando renderExpandedRow é fornecido.
  renderExpandedRow?: (entity: T) => React.ReactNode;
  expandedRowId?: string | number | null;
  onRowToggle?: (entity: T) => void;
  isRowExpandable?: (entity: T) => boolean;
}

export function BaseTable<T extends BaseEntity>({
  data,
  columns,
  pagination,
  loading = false,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  customActions = [], // NOVA: Array de ações customizadas
  emptyMessage = "Nenhum registro encontrado.",
  emptyIcon,
  renderExpandedRow,
  expandedRowId = null,
  onRowToggle,
  isRowExpandable
}: BaseTableProps<T>) {
  const hasDefaultActions = onView || onEdit || onDelete;
  const hasCustomActions = customActions.length > 0;
  const hasActions = hasDefaultActions || hasCustomActions;
  const isExpandableTable = Boolean(renderExpandedRow);

  // IDs costumam voltar do backend com espaços no fim; comparar sem trim falha
  // silenciosamente e a linha nunca abre.
  const normalizeId = (id: string | number | null | undefined) =>
    typeof id === 'string' ? id.trim() : id;

  const canExpandRow = (entity: T) =>
    isExpandableTable && (!isRowExpandable || isRowExpandable(entity));

  const isRowOpen = (entity: T) =>
    isExpandableTable &&
    expandedRowId !== null &&
    expandedRowId !== undefined &&
    normalizeId(entity.id) === normalizeId(expandedRowId);

  // Total de colunas renderizadas, usado no colSpan da linha expandida e do vazio.
  const totalColumns = columns.length + (isExpandableTable ? 1 : 0) + (hasActions ? 1 : 0);

  // NOVA: Função para executar ação customizada
  const handleCustomAction = (actionKey: string, entity: T) => {
    const action = customActions.find(a => a.key === actionKey);
    if (action) {
      (action.handler || action.onClick)?.(entity);
    }
  };

  // NOVA: Filtrar ações customizadas que devem aparecer para uma entidade
  const getVisibleCustomActions = (entity: T) => {
    return customActions.filter(action =>
      !action.condition || action.condition(entity)
    );
  };

  /**
   * Os botões de ação, iguais na tabela e no cartão.
   *
   * Extraído para os dois layouts não divergirem: uma ação nova adicionada só
   * na tabela ficaria inalcançável no celular, sem ninguém perceber.
   *
   * No máximo DUAS ficam à vista; o resto vai para o menu de três pontos. Com
   * sete ações — o caso da execução de OS — a coluna empurrava as outras e a
   * linha virava uma barra de ferramentas. Duas cobrem o gesto comum, e o menu
   * guarda o que é ocasional.
   *
   * O corte é sobre as ações VISÍVEIS daquela linha, não sobre a lista
   * configurada: na OS o conjunto muda com o status, e cortar a lista fixa
   * deixaria no menu ações que nem existem para aquele registro.
   */
  const ACOES_A_VISTA = 2;

  const renderarAcoes = (entity: T) => {
    const todas: Array<{
      chave: string;
      titulo: string;
      icone: React.ReactNode;
      executar: () => void;
    }> = [];

    if (onView) {
      todas.push({
        chave: '__view',
        titulo: 'Visualizar',
        icone: <Eye className="h-4 w-4" />,
        executar: () => onView(entity),
      });
    }

    if (onEdit) {
      todas.push({
        chave: '__edit',
        titulo: 'Editar',
        icone: <Edit3 className="h-4 w-4" />,
        executar: () => onEdit(entity),
      });
    }

    for (const action of getVisibleCustomActions(entity)) {
      todas.push({
        chave: action.key,
        titulo: action.label,
        icone: renderarIcone(action.icon),
        executar: () => (action.handler || action.onClick)?.(entity),
      });
    }

    // Só vale abrir menu para GUARDAR mais de uma: com três ações, o menu
    // esconderia uma atrás de dois cliques para economizar um botão.
    const cabemTodas = todas.length <= ACOES_A_VISTA + 1;
    const aVista = cabemTodas ? todas : todas.slice(0, ACOES_A_VISTA);
    const noMenu = cabemTodas ? [] : todas.slice(ACOES_A_VISTA);

    return (
      <div className="flex items-center gap-1">
        {aVista.map((acao) => (
          <Button
            key={acao.chave}
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-transparent hover:text-primary"
            onClick={acao.executar}
            title={acao.titulo}
          >
            {acao.icone}
          </Button>
        ))}

        {noMenu.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={`Mais ${noMenu.length} ações`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {noMenu.map((acao) => (
                <DropdownMenuItem
                  key={acao.chave}
                  onClick={acao.executar}
                  className="gap-2"
                >
                  {acao.icone}
                  {acao.titulo}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  // Colunas que o cartão mostra. `hideOnMobile` continua valendo: é a forma de
  // a página dizer que aquele dado não interessa em tela pequena.
  const colunasNoCartao = columns.filter((c) => !c.hideOnMobile);
  const colunaTitulo =
    colunasNoCartao.find((c) => c.primaryOnMobile) ?? colunasNoCartao[0];
  const colunasSecundarias = colunasNoCartao.filter((c) => c !== colunaTitulo);

  const valorDaColuna = (column: TableColumn<T>, entity: T) =>
    column.render ? column.render(entity) : String((entity as any)[column.key] ?? '');

  if (loading) {
    return (
      <div className="border rounded-md flex flex-col sm:h-full">
        {/* O esqueleto acompanha o layout: uma tabela de 4 colunas carregando
            dentro de 340px já nasce estourada. */}
        <div className="flex flex-col gap-2 p-2 sm:hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded border p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>

        <div className="hidden flex-1 overflow-auto sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                {isExpandableTable && <TableHead className="w-10" />}
                {columns.map((column, index) => (
                  <TableHead key={index} className={column.className}>
                    {column.label}
                  </TableHead>
                ))}
                {hasActions && <TableHead className="w-32">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {isExpandableTable && (
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {columns.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell>
                      <Skeleton className="h-8 w-20" />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // `tabela-adaptavel` marca a RAIZ como o contentor medido pelas container
  // queries — nao o div de rolagem, que acompanha a largura da tabela. O que
  // interessa medir e o espaco DISPONIVEL, que e o que muda quando a sidebar
  // abre ou a janela e dividida.
  return (
    <div className="tabela-adaptavel border rounded-md bg-card flex flex-col sm:h-full relative min-w-0">
      {/* Loading overlay discreto - aparece sobre a tabela */}
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-md">
          <div className="flex items-center gap-3 bg-card border rounded-lg px-4 py-3 shadow-lg">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="text-sm text-muted-foreground">Atualizando...</span>
          </div>
        </div>
      )}
      {/* ------------------------------------------------------------------
          CELULAR: cartões no lugar da tabela.

          Quatro colunas disputando 340px viram texto cortado em todas elas —
          e esconder colunas só troca o problema por informação ausente. Em
          cartão cada dado ganha a largura inteira e leva o rótulo junto, que
          é o que a linha de cabeçalho fazia e o scroll horizontal levava
          embora.

          A tabela continua idêntica no desktop: os dois layouts convivem por
          media query, sem JavaScript medindo tela.
          ------------------------------------------------------------------ */}
      {/* No celular a lista NAO e area de rolagem propria.
          Era: `flex-1 overflow-y-auto` — recebia a sobra vertical depois dos
          cartoes de resumo, da busca e dos tres filtros empilhados. Numa tela de
          celular essa sobra e quase nada: media 97px, cabia um cartao e meio, e
          o resto ficava escondido num scroll interno de poucos pixels que ninguem
          percebe existir. A pagina parecia vazia.

          Sem altura imposta, a lista cresce com o conteudo e quem rola e a
          pagina — que e o gesto que a pessoa ja faz no celular. No desktop nada
          muda: `sm:h-full` na raiz devolve o painel de altura fixa com rolagem
          interna, que la faz sentido porque sobra espaco. */}
      <div className="p-2 sm:hidden">
        {data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            {emptyIcon}
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.map((entity) => {
              const expandable = canExpandRow(entity);
              const expanded = isRowOpen(entity);

              return (
                <div
                  key={entity.id}
                  className={`rounded border bg-card ${expanded ? 'bg-muted/30' : ''}`}
                >
                  <div
                    className={`p-3 ${expandable ? 'cursor-pointer' : ''}`}
                    onClick={expandable ? () => onRowToggle?.(entity) : undefined}
                  >
                    <div className="flex items-start gap-2">
                      {expandable && (
                        <ChevronDown
                          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                            expanded ? '' : '-rotate-90'
                          }`}
                        />
                      )}
                      <div className="min-w-0 flex-1 text-sm font-medium">
                        {colunaTitulo && valorDaColuna(colunaTitulo, entity)}
                      </div>
                    </div>

                    {colunasSecundarias.length > 0 && (
                      <dl className="mt-2 flex flex-col gap-1">
                        {colunasSecundarias.map((column, index) => (
                          <div key={index} className="flex items-start justify-between gap-3">
                            <dt className="shrink-0 text-xs text-muted-foreground">
                              {column.label}
                            </dt>
                            <dd className="min-w-0 text-right text-sm">
                              {valorDaColuna(column, entity)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    {hasActions && (
                      // stopPropagation: sem isso, tocar numa ação também
                      // alterna a expansão do cartão.
                      <div
                        className="mt-2 flex justify-end border-t pt-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {renderarAcoes(entity)}
                      </div>
                    )}
                  </div>

                  {expanded && <div className="border-t bg-muted/20">{renderExpandedRow?.(entity)}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DESKTOP: a tabela de sempre. */}
      <div className="hidden flex-1 overflow-x-auto overflow-y-auto sm:block">
        <Table className="table-minimal min-w-full">
          <TableHeader>
            <TableRow>
              {isExpandableTable && <TableHead className="w-10" />}
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  className={`${column.className || ''} ${
                    column.hideOnMobile ? 'coluna-recolhe-1' : ''
                  } ${column.hideOnTablet ? 'coluna-recolhe-2' : ''}`}
                >
                  {column.label}
                </TableHead>
              ))}
              {hasActions && <TableHead className="w-32">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={totalColumns} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  {emptyIcon}
                  <p>{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((entity) => {
              const expandable = canExpandRow(entity);
              const expanded = isRowOpen(entity);

              return (
                <React.Fragment key={entity.id}>
                <TableRow
                  className={`hover:bg-muted/50 ${expandable ? 'cursor-pointer' : ''} ${
                    expanded ? 'bg-muted/30' : ''
                  }`}
                  onClick={expandable ? () => onRowToggle?.(entity) : undefined}
                >
                  {isExpandableTable && (
                    <TableCell className="w-10 align-middle">
                      {expandable && (
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            expanded ? '' : '-rotate-90'
                          }`}
                        />
                      )}
                    </TableCell>
                  )}
                  {columns.map((column, index) => (
                    <TableCell 
                      key={index}
                      className={`${column.className || ''} ${
                        column.hideOnMobile ? 'coluna-recolhe-1' : ''
                      } ${column.hideOnTablet ? 'coluna-recolhe-2' : ''}`}
                    >
                      {column.render
                        ? column.render(entity)
                        : String((entity as any)[column.key] || '')
                      }
                    </TableCell>
                  ))}
                  {hasActions && (
                    // stopPropagation: sem isso, clicar numa ação também alterna a expansão
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {renderarAcoes(entity)}
                    </TableCell>
                  )}
                </TableRow>
                {expanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={totalColumns} className="p-0 bg-muted/20">
                      {renderExpandedRow?.(entity)}
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> a{' '}
            <span className="font-medium">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            de <span className="font-medium">{pagination.total}</span> resultados
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              className="btn-minimal-outline h-8 w-8 p-0 flex items-center justify-center overflow-visible"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(page => {
                  return page === 1 || 
                         page === pagination.totalPages || 
                         Math.abs(page - pagination.page) <= 1;
                })
                .map((page, index, array) => {
                  if (index > 0 && page - array[index - 1] > 1) {
                    return (
                      <React.Fragment key={`ellipsis-${page}`}>
                        <span className="px-2 text-muted-foreground">...</span>
                        <button
                          className={pagination.page === page ? "btn-minimal-primary w-8 h-8 p-0 flex items-center justify-center" : "btn-minimal-outline w-8 h-8 p-0 flex items-center justify-center"}
                          onClick={() => onPageChange(page)}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  }
                  
                  return (
                    <button
                      key={page}
                      className={pagination.page === page ? "btn-minimal-primary w-8 h-8 p-0 flex items-center justify-center" : "btn-minimal-outline w-8 h-8 p-0 flex items-center justify-center"}
                      onClick={() => onPageChange(page)}
                    >
                      {page}
                    </button>
                  );
                })}
            </div>
            
            <button
              className="btn-minimal-outline h-8 w-8 p-0 flex items-center justify-center overflow-visible"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

