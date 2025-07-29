// src/features/financeiro/components/centros-custo-filters.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import { CentroCusto } from '@/types/dtos/financeiro';

interface CentrosCustoFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | CentroCusto['status'];
  onStatusFilterChange: (value: 'all' | CentroCusto['status']) => void;
  tipoFilter: 'all' | CentroCusto['tipo'];
  onTipoFilterChange: (value: 'all' | CentroCusto['tipo']) => void;
}

export function CentrosCustoFilters({ 
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  tipoFilter,
  onTipoFilterChange
}: CentrosCustoFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-between">
      {/* Campo de pesquisa */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Input 
            placeholder="Pesquisar por código, nome ou responsável" 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      {/* Filtros */}
      <div className="flex items-center gap-2">
        {/* Filtro de Status */}
        <div className="w-36">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro de Tipo */}
        <div className="w-44">
          <Select value={tipoFilter} onValueChange={onTipoFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="administrativo">Administrativo</SelectItem>
              <SelectItem value="operacional">Operacional</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="projeto">Projeto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Botão de filtros avançados */}
        <Button variant="outline">
          <Filter className="mr-1 h-4 w-4" />
          Filtros Avançados
        </Button>
      </div>
    </div>
  );
}
