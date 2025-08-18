// src/features/financeiro/components/contas-a-pagar-filters.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface ContasAPagarFiltersProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export function ContasAPagarFilters({ 
  selectedPeriod, 
  onPeriodChange,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange
}: ContasAPagarFiltersProps) {
  // Lista de períodos simulados
  const periods: string[] = [
    'Janeiro de 2025',
    'Fevereiro de 2025',
    'Março de 2025',
    'Abril de 2025',
    'Maio de 2025',
    'Junho de 2025'
  ];

  const currentPeriodIndex = periods.indexOf(selectedPeriod);
  
  const handlePreviousPeriod = () => {
    if (currentPeriodIndex > 0) {
      onPeriodChange(periods[currentPeriodIndex - 1]);
    }
  };
  
  const handleNextPeriod = () => {
    if (currentPeriodIndex < periods.length - 1) {
      onPeriodChange(periods[currentPeriodIndex + 1]);
    }
  };

  return (
    <div className="flex flex-wrap gap-4 items-center justify-between">
      {/* Navegação de período */}
      <div className="flex items-center space-x-2">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handlePreviousPeriod}
          disabled={currentPeriodIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="w-40">
          <Select value={selectedPeriod} onValueChange={onPeriodChange}>
            <SelectTrigger>
              <SelectValue>{selectedPeriod}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {periods.map(period => (
                <SelectItem key={period} value={period}>
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleNextPeriod}
          disabled={currentPeriodIndex === periods.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Campo de pesquisa */}
      <div className="flex-1 max-w-xs">
        <div className="relative">
          <Input 
            placeholder="Pesquisar no período selecionado" 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      {/* Seleção de contas */}
      <div className="w-44">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Selecionar todas</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="atrasado">Atrasadas</SelectItem>
            <SelectItem value="pago">Pagas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Botão de mais filtros */}
      <Button variant="outline">
        Mais filtros <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}