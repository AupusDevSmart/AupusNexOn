import React, { useState, useEffect } from 'react';
import { 
  ArrowUpDown, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Wallet,
  BarChart3,
  Calculator,
  Target,
  DollarSign,
  Calendar,
  Loader2
} from 'lucide-react';

// Mock API data - replace with real API call later
const mockApiData = [
  {
    modulo: 'Saldo Inicial',
    tipo: 'saldo-inicial',
    jan: 50000, fev: 45000, mar: 52000, abr: 48000, mai: 51000, jun: 49000,
    jul: 53000, ago: 47000, set: 50000, out: 52000, nov: 48000, dez: 51000
  },
  {
    modulo: 'Receitas',
    tipo: 'entrada',
    jan: 25000, fev: 28000, mar: 22000, abr: 30000, mai: 27000, jun: 32000,
    jul: 29000, ago: 31000, set: 26000, out: 28000, nov: 30000, dez: 35000
  },
  {
    modulo: 'Despesas Operacionais',
    tipo: 'saida',
    jan: -18000, fev: -20000, mar: -16000, abr: -22000, mai: -19000, jun: -23000,
    jul: -21000, ago: -24000, set: -18000, out: -20000, nov: -22000, dez: -25000
  },
  {
    modulo: 'Impostos',
    tipo: 'saida',
    jan: -5000, fev: -5500, mar: -4800, abr: -6000, mai: -5200, jun: -6500,
    jul: -5800, ago: -6200, set: -5000, out: -5500, nov: -6000, dez: -7000
  },
  {
    modulo: 'Resultado do Período',
    tipo: 'resultado',
    jan: 2000, fev: 2500, mar: 1200, abr: 2000, mai: 2800, jun: 2500,
    jul: 2200, ago: 800, set: 3000, out: 2500, nov: 2000, dez: 3000
  },
  {
    modulo: 'Saldo Final',
    tipo: 'saldo-final',
    jan: 52000, fev: 47500, mar: 53200, abr: 50000, mai: 53800, jun: 51500,
    jul: 55200, ago: 47800, set: 53000, out: 54500, nov: 50000, dez: 54000
  }
];

// Type definitions
interface FluxoCaixaDetailed {
  modulo: string;
  tipo: 'saldo-inicial' | 'entrada' | 'saida' | 'resultado' | 'saldo-final';
  jan: number; fev: number; mar: number; abr: number; mai: number; jun: number;
  jul: number; ago: number; set: number; out: number; nov: number; dez: number;
}

interface FluxoCaixaTableProps {
  apiEndpoint?: string;
  defaultYear?: string;
  onExport?: (data: FluxoCaixaDetailed[], filters: DateFilters) => void;
}

interface DateFilters {
  startMonth: string;
  endMonth: string;
  year: string;
}

interface SortConfig {
  key: keyof FluxoCaixaDetailed;
  direction: 'asc' | 'desc';
}

// Mock API function - replace with real API call
const fetchFluxoCaixaData = async (year: string): Promise<FluxoCaixaDetailed[]> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return mockApiData;
};

export function FluxoCaixaTable({ 
  apiEndpoint,
  defaultYear = '2024',
  onExport 
}: FluxoCaixaTableProps): JSX.Element {
  const [data, setData] = useState<FluxoCaixaDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'modulo',
    direction: 'asc'
  });
  
  const [dateFilters, setDateFilters] = useState<DateFilters>({
    startMonth: 'jan',
    endMonth: 'dez',
    year: defaultYear
  });

  const meses: (keyof FluxoCaixaDetailed)[] = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesesLabel = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const years = ['2022', '2023', '2024', '2025'];

  // Load data when component mounts or year changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetchFluxoCaixaData(dateFilters.year);
        setData(result);
      } catch (err) {
        setError('Erro ao carregar dados do fluxo de caixa');
        console.error('Error loading flux data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dateFilters.year]);

  const handleSort = (key: keyof FluxoCaixaDetailed): void => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleYearChange = (year: string) => {
    setDateFilters(prev => ({ ...prev, year }));
  };

  const getFilteredMonths = () => {
    const startIndex = meses.indexOf(dateFilters.startMonth as keyof FluxoCaixaDetailed);
    const endIndex = meses.indexOf(dateFilters.endMonth as keyof FluxoCaixaDetailed);
    return {
      months: meses.slice(startIndex, endIndex + 1),
      labels: mesesLabel.slice(startIndex, endIndex + 1)
    };
  };

  const { months: filteredMonths, labels: filteredLabels } = getFilteredMonths();

  const sortedData = [...data].sort((a, b) => {
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

  // Ordenar os dados para garantir a sequência correta
  const orderedData = sortedData.sort((a, b) => {
    const order = ['saldo-inicial', 'entrada', 'saida', 'resultado', 'saldo-final'];
    return order.indexOf(a.tipo) - order.indexOf(b.tipo);
  });

  // Funções auxiliares definidas após orderedData
  const formatCurrency = (value: number): string => {
    if (value === 0) return 'R$ -';
    const formatted = Math.abs(value).toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    return value < 0 ? `-R$ ${formatted}` : `R$ ${formatted}`;
  };

  const calculateTotal = (key: keyof FluxoCaixaDetailed) => {
    return orderedData.reduce((sum, row) => {
      const value = row[key] as number;
      return sum + (value || 0);
    }, 0);
  };

  const getResponsiveWidths = () => {
    const numMonths = filteredMonths.length;
    const baseModuleWidth = 200;
    const minMonthWidth = 90;
    
    if (numMonths <= 6) {
      return {
        moduleWidth: 240,
        monthWidth: 130,
        totalWidth: 240 + (numMonths * 130)
      };
    }
    else if (numMonths <= 9) {
      return {
        moduleWidth: 220,
        monthWidth: 110,
        totalWidth: 220 + (numMonths * 110)
      };
    }
    else {
      return {
        moduleWidth: baseModuleWidth,
        monthWidth: minMonthWidth,
        totalWidth: baseModuleWidth + (numMonths * minMonthWidth)
      };
    }
  };

  const { moduleWidth, monthWidth, totalWidth } = getResponsiveWidths();

  const handleExport = (): void => {
    if (onExport) {
      onExport(orderedData, dateFilters);
    } else {
      console.log('Exportando dados:', { data: orderedData, filters: dateFilters });
    }
  };

  const getValueIcon = (value: number, tipo: string) => {
    if (tipo === 'saldo-inicial' || tipo === 'saldo-final' || value === 0) {
      return <Minus className="h-3 w-3 text-gray-400" />;
    }
    return value > 0 ? 
      <TrendingUp className="h-3 w-3 text-emerald-600" /> : 
      <TrendingDown className="h-3 w-3 text-red-500" />;
  };

  const getRowClass = (tipo: FluxoCaixaDetailed['tipo'], index: number): string => {
    const baseClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-slate-50/50 dark:bg-gray-700/30';
    const hoverClass = 'hover:bg-slate-100/70 dark:hover:bg-gray-600/50 transition-colors duration-200';
    
    switch (tipo) {
      case 'saldo-inicial':
        return `${baseClass} ${hoverClass} border-l-4 border-l-indigo-400 dark:border-l-indigo-500`;
      case 'entrada':
        return `${baseClass} ${hoverClass} border-l-4 border-l-emerald-400 dark:border-l-emerald-500`;
      case 'saida':
        return `${baseClass} ${hoverClass} border-l-4 border-l-red-400 dark:border-l-red-500`;
      case 'resultado':
        return `${baseClass} ${hoverClass} border-l-4 border-l-amber-400 dark:border-l-amber-500`;
      case 'saldo-final':
        return `${baseClass} ${hoverClass} border-l-4 border-l-blue-500 dark:border-l-blue-400 font-semibold bg-blue-50/30 dark:bg-blue-900/20`;
      default:
        return `${baseClass} ${hoverClass}`;
    }
  };

  const getCellTextClass = (tipo: FluxoCaixaDetailed['tipo'], value?: number): string => {
    const baseClass = 'transition-colors duration-200';
    
    switch (tipo) {
      case 'saldo-inicial':
        return `${baseClass} text-indigo-800 dark:text-indigo-300 font-medium`;
      case 'entrada':
        return `${baseClass} text-emerald-700 dark:text-emerald-400 font-medium`;
      case 'saida':
        return `${baseClass} text-red-700 dark:text-red-400 font-medium`;
      case 'resultado':
        return `${baseClass} ${value && value > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'} font-medium`;
      case 'saldo-final':
        return `${baseClass} text-blue-800 dark:text-blue-300 font-semibold`;
      default:
        return baseClass;
    }
  };

  const getModuleIcon = (tipo: string) => {
    switch (tipo) {
      case 'saldo-inicial':
        return <Wallet className="h-5 w-5" />;
      case 'entrada':
        return <TrendingUp className="h-5 w-5" />;
      case 'saida':
        return <TrendingDown className="h-5 w-5" />;
      case 'resultado':
        return <Calculator className="h-5 w-5" />;
      case 'saldo-final':
        return <Target className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-slate-200 dark:border-gray-700 p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600 dark:text-gray-400" />
            <p className="text-slate-600 dark:text-gray-400">Carregando dados do fluxo de caixa...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-red-200 dark:border-red-700 p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Filtros de Data */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-slate-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-4 mb-4">
          <Calendar className="h-5 w-5 text-slate-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200">Filtros de Período</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Ano</label>
            <select 
              value={dateFilters.year}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {years.map(year => (
                <option key={year} value={year} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{year}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Mês Inicial</label>
            <select 
              value={dateFilters.startMonth}
              onChange={(e) => setDateFilters(prev => ({ ...prev, startMonth: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {meses.map((mes, index) => (
                <option key={mes} value={mes} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{mesesLabel[index]}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Mês Final</label>
            <select 
              value={dateFilters.endMonth}
              onChange={(e) => setDateFilters(prev => ({ ...prev, endMonth: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {meses.map((mes, index) => (
                <option key={mes} value={mes} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{mesesLabel[index]}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button 
              onClick={handleExport}
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabela Principal - Container com overflow controlado */}
      <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-gray-900 dark:to-gray-800 px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                Fluxo de Caixa {dateFilters.year}
              </h2>
              <p className="text-slate-300 dark:text-gray-300 text-sm mt-1 truncate">
                {filteredLabels[0]} - {filteredLabels[filteredLabels.length - 1]}
              </p>
            </div>
          </div>
        </div>

        {/* Container da Tabela com overflow rigorosamente controlado */}
        <div className="w-full overflow-x-auto" style={{ maxWidth: '100%' }}>
          <div style={{ width: `${totalWidth}px`, maxWidth: 'none' }}>
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-gray-700/50 border-b-2 border-slate-200 dark:border-gray-600">
                  <th className="text-left py-3 sm:py-5 px-4 sm:px-6 font-semibold text-slate-700 dark:text-gray-300" style={{ width: `${moduleWidth}px` }}>
                    <button 
                      className="flex items-center space-x-2 hover:text-slate-900 dark:hover:text-gray-100 transition-colors group"
                      onClick={() => handleSort('modulo')}
                    >
                      <BarChart3 className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm sm:text-base truncate">Módulo</span>
                      <ArrowUpDown className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  </th>
                  {filteredLabels.map((mes, index) => (
                    <th key={mes} className="text-center py-3 sm:py-5 px-2 font-semibold text-slate-700 dark:text-gray-300" style={{ width: `${monthWidth}px` }}>
                      <div className="flex flex-col items-center space-y-1 sm:space-y-2">
                        <span className="text-sm sm:text-base">{mes}</span>
                        <div className="text-xs text-slate-500 dark:text-gray-400 font-normal bg-slate-200/50 dark:bg-gray-600/50 px-1 py-1 rounded-md truncate max-w-full" title={formatCurrency(calculateTotal(filteredMonths[index]))}>
                          {filteredMonths.length > 9 ? 
                            formatCurrency(calculateTotal(filteredMonths[index])).replace('R$ ', '').replace(',00', '') 
                            : formatCurrency(calculateTotal(filteredMonths[index]))
                          }
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedData.map((row, index) => (
                  <tr key={index} className={getRowClass(row.tipo, index)}>
                    <td className="py-3 sm:py-4 px-4 sm:px-6 font-medium" style={{ width: `${moduleWidth}px` }}>
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                        <div className={`${getCellTextClass(row.tipo)} flex-shrink-0`}>
                          {getModuleIcon(row.tipo)}
                        </div>
                        <span className={`${getCellTextClass(row.tipo)} text-sm sm:text-base truncate flex-1 min-w-0`} title={row.modulo}>
                          {row.modulo}
                        </span>
                      </div>
                    </td>
                    {filteredMonths.map((mes) => {
                      const value = row[mes] as number || 0;
                      return (
                        <td key={mes} className="text-center py-3 sm:py-4 px-2" style={{ width: `${monthWidth}px` }}>
                          <div className="flex flex-col items-center justify-center space-y-1 min-w-0">
                            <div className="sm:inline hidden flex-shrink-0">
                              {getValueIcon(value, row.tipo)}
                            </div>
                            <span 
                              className={`${getCellTextClass(row.tipo, value)} text-xs sm:text-sm truncate max-w-full`} 
                              title={formatCurrency(value)}
                            >
                              {filteredMonths.length > 9 ? 
                                formatCurrency(value).replace('R$ ', '').replace(',00', '') 
                                : formatCurrency(value)
                              }
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}