import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ModuloOption } from '@/types/dtos/financeiro';

interface FluxoCaixaFiltersProps {
  selectedYear: string;
  onYearChange: (year: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedModule: string;
  onModuleChange: (module: string) => void;
  modulos: ModuloOption[];
}

export function FluxoCaixaFilters({ 
  selectedYear, 
  onYearChange,
  selectedMonth,
  onMonthChange,
  selectedModule,
  onModuleChange,
  modulos
}: FluxoCaixaFiltersProps): JSX.Element {
  const anos: { value: string; label: string }[] = [
    { value: '2024', label: '2024' },
    { value: '2023', label: '2023' },
    { value: '2022', label: '2022' }
  ];

  const meses: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos os Meses' },
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  const currentYearIndex = anos.findIndex(ano => ano.value === selectedYear);
  
  const handlePreviousYear = (): void => {
    if (currentYearIndex < anos.length - 1) {
      onYearChange(anos[currentYearIndex + 1].value);
    }
  };
  
  const handleNextYear = (): void => {
    if (currentYearIndex > 0) {
      onYearChange(anos[currentYearIndex - 1].value);
    }
  };

  const handleClearFilters = (): void => {
    onYearChange('2024');
    onMonthChange('all');
    onModuleChange('all');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Navegação de ano */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handlePreviousYear}
              disabled={currentYearIndex === anos.length - 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="w-24">
              <Select value={selectedYear} onValueChange={onYearChange}>
                <SelectTrigger>
                  <SelectValue>{selectedYear}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {anos.map(ano => (
                    <SelectItem key={ano.value} value={ano.value}>
                      {ano.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleNextYear}
              disabled={currentYearIndex === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Seleção de mês */}
          <div className="w-44">
            <Select value={selectedMonth} onValueChange={onMonthChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map(mes => (
                  <SelectItem key={mes.value} value={mes.value}>
                    {mes.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Seleção de módulo */}
          <div className="w-64">
            <Select value={selectedModule} onValueChange={onModuleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar módulo" />
              </SelectTrigger>
              <SelectContent>
                {modulos.map(modulo => (
                  <SelectItem key={modulo.value} value={modulo.value}>
                    {modulo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Botões de ação */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClearFilters}>
              Limpar
            </Button>
            <Button>
              Aplicar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}