// src/components/common/base-table/BaseTable.tsx
import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Eye, 
  Edit3, 
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BaseEntity, TableColumn, Pagination } from '@/types/base';

// NOVA: Interface para ações customizadas
interface CustomAction<T> {
  key: string;
  label: string;
  handler: (entity: T) => void;
  condition?: (entity: T) => boolean;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

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
  emptyIcon
}: BaseTableProps<T>) {
  const hasDefaultActions = onView || onEdit || onDelete;
  const hasCustomActions = customActions.length > 0;
  const hasActions = hasDefaultActions || hasCustomActions;

  // NOVA: Função para executar ação customizada
  const handleCustomAction = (actionKey: string, entity: T) => {
    const action = customActions.find(a => a.key === actionKey);
    if (action) {
      action.handler(entity);
    }
  };

  // NOVA: Filtrar ações customizadas que devem aparecer para uma entidade
  const getVisibleCustomActions = (entity: T) => {
    return customActions.filter(action => 
      !action.condition || action.condition(entity)
    );
  };

  if (loading) {
    return (
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
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
    );
  }

  return (
    <div className="border rounded-md bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead 
                key={index} 
                className={`${column.className || ''} ${
                  column.hideOnMobile ? 'hidden lg:table-cell' : ''
                } ${column.hideOnTablet ? 'hidden xl:table-cell' : ''}`}
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
              <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  {emptyIcon}
                  <p>{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((entity) => {
              const visibleCustomActions = getVisibleCustomActions(entity);
              
              return (
                <TableRow key={entity.id} className="hover:bg-muted/50">
                  {columns.map((column, index) => (
                    <TableCell 
                      key={index}
                      className={`${column.className || ''} ${
                        column.hideOnMobile ? 'hidden lg:table-cell' : ''
                      } ${column.hideOnTablet ? 'hidden xl:table-cell' : ''}`}
                    >
                      {column.render
                        ? column.render(entity)
                        : String((entity as any)[column.key] || '')
                      }
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Ações padrão (sempre como ícones) */}
                        {onView && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onView(entity)}
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(entity)}
                            title="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        )}

                        {/* NOVA: Ações customizadas */}
                        {visibleCustomActions.length > 0 && (
                          <>
                            {/* Mostrar primeiras 2 ações como botões diretos */}
                            {visibleCustomActions.slice(0, 2).map((action) => (
                              <Button
                                key={action.key}
                                variant={action.variant || "ghost"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => action.handler(entity)}
                                title={action.label}
                              >
                                {action.icon}
                              </Button>
                            ))}
                            
                            {/* Se tiver mais de 2 ações, mostrar dropdown */}
                            {visibleCustomActions.length > 2 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {visibleCustomActions.slice(2).map((action) => (
                                    <DropdownMenuItem
                                      key={action.key}
                                      onClick={() => action.handler(entity)}
                                      className={
                                        action.variant === 'destructive' 
                                          ? 'text-red-600 focus:text-red-600' 
                                          : ''
                                      }
                                    >
                                      {action.icon && (
                                        <span className="mr-2">{action.icon}</span>
                                      )}
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
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
                        <Button
                          variant={pagination.page === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => onPageChange(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      </React.Fragment>
                    );
                  }
                  
                  return (
                    <Button
                      key={page}
                      variant={pagination.page === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  );
                })}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// NOVA: Exportar o tipo para uso em outros arquivos
export type { CustomAction };