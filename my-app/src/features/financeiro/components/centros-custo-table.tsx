// src/features/financeiro/components/centros-custo-table.tsx
import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ArrowUpDown, 
  Edit, 
  Eye,
  Building2,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CentroCusto } from '@/types/dtos/financeiro';

interface CentrosCustoTableProps {
  centros: CentroCusto[];
  selectedItems: number[];
  onSelectedItemsChange: (items: number[]) => void;
  onEditItem: (centro: CentroCusto) => void;
  onViewItem: (centro: CentroCusto) => void;
  allCentros: CentroCusto[];
}

interface SortConfig {
  key: keyof CentroCusto;
  direction: 'asc' | 'desc';
}

export function CentrosCustoTable({ 
  centros, 
  selectedItems, 
  onSelectedItemsChange, 
  onEditItem,
  onViewItem,
  allCentros 
}: CentrosCustoTableProps): JSX.Element {
  // Estado para ordenação
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'codigo',
    direction: 'asc'
  });

  // Estado para paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Função para ordenar
  const requestSort = (key: keyof CentroCusto): void => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Ordenar centros
  const sortedCentros = [...centros].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Calcular o total de páginas
  const totalPages = Math.ceil(sortedCentros.length / itemsPerPage);

  // Obter os centros da página atual
  const centrosPaginados = sortedCentros.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Navegação de página
  const goToPage = (page: number): void => {
    setCurrentPage(page);
  };

  // Resetar página quando os dados mudarem
  React.useEffect(() => {
    setCurrentPage(1);
  }, [centros]);

  // Função para lidar com a seleção de itens
  const handleSelectItem = (id: number): void => {
    if (selectedItems.includes(id)) {
      onSelectedItemsChange(selectedItems.filter(itemId => itemId !== id));
    } else {
      onSelectedItemsChange([...selectedItems, id]);
    }
  };

  // Função para seleção de todos da página
  const handleSelectAllInPage = (): void => {
    const currentPageIds = centrosPaginados.map(centro => centro.id);
    
    if (currentPageIds.every(id => selectedItems.includes(id))) {
      onSelectedItemsChange(
        selectedItems.filter(id => !currentPageIds.includes(id))
      );
    } else {
      const newSelectedItems = [
        ...selectedItems.filter(id => !currentPageIds.includes(id)),
        ...currentPageIds
      ];
      onSelectedItemsChange(newSelectedItems);
    }
  };

  // Verificar se todos os itens da página atual estão selecionados
  const areAllInPageSelected = centrosPaginados.length > 0 && 
    centrosPaginados.every(centro => selectedItems.includes(centro.id));

  // Renderização do status
  const renderStatus = (status: CentroCusto['status']): JSX.Element => {
    switch (status) {
      case 'ativo':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Ativo
          </Badge>
        );
      case 'inativo':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Inativo
          </Badge>
        );
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  // Renderização do tipo
  const renderTipo = (tipo: CentroCusto['tipo']): JSX.Element => {
    const config = {
      administrativo: { label: 'Administrativo', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      operacional: { label: 'Operacional', color: 'bg-purple-50 text-purple-700 border-purple-200' },
      comercial: { label: 'Comercial', color: 'bg-green-50 text-green-700 border-green-200' },
      projeto: { label: 'Projeto', color: 'bg-orange-50 text-orange-700 border-orange-200' }
    };

    const tipoConfig = config[tipo];
    
    return (
      <Badge variant="outline" className={tipoConfig.color}>
        {tipoConfig.label}
      </Badge>
    );
  };

  // Calcular utilização do orçamento
  const calcularUtilizacao = (gasto: number, orcamento: number): number => {
    if (!orcamento || orcamento === 0) return 0;
    return Math.min((gasto / orcamento) * 100, 100);
  };

  // Encontrar nome do centro pai
  const getNomeCentroPai = (centroPaiId: number | null): string | null => {
    if (!centroPaiId) return null;
    const centroPai = allCentros.find(c => c.id === centroPaiId);
    return centroPai?.nome || null;
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox 
                checked={areAllInPageSelected}
                onCheckedChange={handleSelectAllInPage}
              />
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="p-0 font-medium text-left flex items-center"
                onClick={() => requestSort('codigo')}
              >
                Código
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="p-0 font-medium text-left flex items-center"
                onClick={() => requestSort('nome')}
              >
                Nome do Centro
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="p-0 font-medium text-left flex items-center"
                onClick={() => requestSort('tipo')}
              >
                Tipo
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="p-0 font-medium text-left flex items-center"
                onClick={() => requestSort('responsavel')}
              >
                Responsável
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Utilização Orçamento</TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="p-0 font-medium text-left flex items-center"
                onClick={() => requestSort('status')}
              >
                Status
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {centrosPaginados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Nenhum centro de custo encontrado.
              </TableCell>
            </TableRow>
          ) : (
            centrosPaginados.map((centro) => {
              const utilizacao = calcularUtilizacao(centro.gastoAcumulado, centro.orcamentoMensal);
              const nomeCentroPai = getNomeCentroPai(centro.centroPai);
              
              return (
                <TableRow key={centro.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedItems.includes(centro.id)}
                      onCheckedChange={() => handleSelectItem(centro.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {centro.codigo}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{centro.nome}</div>
                        {nomeCentroPai && (
                          <div className="text-xs text-muted-foreground">
                            Sub-centro de: {nomeCentroPai}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {renderTipo(centro.tipo)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{centro.responsavel}</div>
                        <div className="text-xs text-muted-foreground">{centro.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>R$ {centro.gastoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span className="text-muted-foreground">
                          {utilizacao.toFixed(0)}%
                        </span>
                      </div>
                      <Progress 
                        value={utilizacao} 
                        className="h-2"
                      />
                      <div className="text-xs text-muted-foreground">
                        Orçamento: R$ {centro.orcamentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {renderStatus(centro.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onViewItem(centro)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onEditItem(centro)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      
      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedCentros.length)}</span> de <span className="font-medium">{sortedCentros.length}</span> resultados
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  return page === 1 || 
                         page === totalPages || 
                         Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, array) => {
                  if (index > 0 && page - array[index - 1] > 1) {
                    return (
                      <React.Fragment key={`ellipsis-${page}`}>
                        <span className="px-2 text-muted-foreground">...</span>
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(page)}
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
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page)}
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
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
