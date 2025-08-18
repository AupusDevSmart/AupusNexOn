import { useState, useMemo } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { FluxoCaixaFilters } from '@/features/financeiro/components/fluxo-caixa-filters';
import { FluxoCaixaSummary } from '@/features/financeiro/components/fluxo-caixa-summary';
import { FluxoCaixaChart } from '@/features/financeiro/components/fluxo-caixa-chart';
import { FluxoCaixaTable } from '@/features/financeiro/components/fluxo-caixa-table';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import type { FluxoCaixaData, FluxoCaixaDetailed, ModuloOption } from '@/types/dtos/financeiro';

// Dados mockados para demonstração
const mockData: {
  monthly: FluxoCaixaData[];
  detailed: FluxoCaixaDetailed[];
} = {
  monthly: [
    { month: 'Jan', entradas: 32000, saidas: 18000, resultado: 14000, modulo: 'nexus-cativo' },
    { month: 'Fev', entradas: 28000, saidas: 16000, resultado: 12000, modulo: 'nexus-cativo' },
    { month: 'Mar', entradas: 38100, saidas: 19600, resultado: 18500, modulo: 'nexus-cativo' },
    { month: 'Abr', entradas: 35000, saidas: 20000, resultado: 15000, modulo: 'service' },
    { month: 'Mai', entradas: 42000, saidas: 22000, resultado: 20000, modulo: 'projetos' },
    { month: 'Jun', entradas: 38000, saidas: 21000, resultado: 17000, modulo: 'nexus-clube' },
    { month: 'Jul', entradas: 45000, saidas: 23000, resultado: 22000, modulo: 'nexus-cativo' },
    { month: 'Ago', entradas: 41000, saidas: 24000, resultado: 17000, modulo: 'service' },
    { month: 'Set', entradas: 39000, saidas: 22500, resultado: 16500, modulo: 'projetos' },
    { month: 'Out', entradas: 44000, saidas: 25000, resultado: 19000, modulo: 'nexus-cativo' },
    { month: 'Nov', entradas: 47000, saidas: 26000, resultado: 21000, modulo: 'service' },
    { month: 'Dez', entradas: 50000, saidas: 28000, resultado: 22000, modulo: 'projetos' }
  ],
  detailed: [
    { 
      modulo: 'Saldo Inicial', 
      saldoInicial: 18500,
      jan: 18500, fev: 32500, mar: 44500, abr: 63000, mai: 78000, jun: 98000, 
      jul: 115000, ago: 137000, set: 154000, out: 170500, nov: 189500, dez: 210500,
      tipo: 'saldo-inicial'
    },
    { 
      modulo: 'Entradas', 
      saldoInicial: 0,
      jan: 32000, fev: 28000, mar: 38100, abr: 35000, mai: 42000, jun: 38000,
      jul: 45000, ago: 41000, set: 39000, out: 44000, nov: 47000, dez: 50000,
      tipo: 'entrada'
    },
    { 
      modulo: 'Saídas', 
      saldoInicial: 0,
      jan: 18000, fev: 16000, mar: 19600, abr: 20000, mai: 22000, jun: 21000,
      jul: 23000, ago: 24000, set: 22500, out: 25000, nov: 26000, dez: 28000,
      tipo: 'saida'
    },
    { 
      modulo: 'Resultado Mensal', 
      saldoInicial: 0,
      jan: 14000, fev: 12000, mar: 18500, abr: 15000, mai: 20000, jun: 17000,
      jul: 22000, ago: 17000, set: 16500, out: 19000, nov: 21000, dez: 22000,
      tipo: 'resultado'
    },
    { 
      modulo: 'Saldo Final', 
      saldoInicial: 18500,
      jan: 32500, fev: 44500, mar: 63000, abr: 78000, mai: 98000, jun: 115000,
      jul: 137000, ago: 154000, set: 170500, out: 189500, nov: 210500, dez: 232500,
      tipo: 'saldo-final'
    }
  ]
};

const modulos: ModuloOption[] = [
  { value: 'all', label: 'Todos os Módulos' },
  { value: 'nexus-cativo', label: 'Nexus Cativo' },
  { value: 'nexus-clube', label: 'Nexus Clube' },
  { value: 'service', label: 'Service (O&M, comissionamento etc.)' },
  { value: 'projetos', label: 'Projetos (elaboração e execução)' }
];

export function FluxoDeCaixaPage(): JSX.Element {
  const [selectedYear, setSelectedYear] = useState<string>('2024');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');

  // Filtrar dados com base nos filtros selecionados
  const dadosFiltrados = useMemo(() => {
    let chartData = [...mockData.monthly];
    let tableData = [...mockData.detailed];

    // Filtrar por módulo se específico
    if (selectedModule !== 'all') {
      chartData = chartData.filter(item => item.modulo === selectedModule);
    }

    // Filtrar por mês se específico
    if (selectedMonth !== 'all') {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthName = monthNames[parseInt(selectedMonth) - 1];
      chartData = chartData.filter(item => item.month === monthName);
    }

    return {
      chart: chartData,
      table: tableData
    };
  }, [selectedYear, selectedMonth, selectedModule]);

  const handleRefresh = (): void => {
    // Implementar lógica de refresh
    console.log('Atualizando dados...');
  };

  const handleExport = (): void => {
    // Implementar lógica de export
    console.log('Exportando dados...');
  };

  return (
    <Layout>
      <Layout.Main>
        <TitleCard
          title="Fluxo de Caixa"
          description="Controle financeiro e análise de resultados por módulo"
        />
        
        {/* Filtros */}
        <div className="mb-6 w-full">
          <FluxoCaixaFilters 
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            selectedModule={selectedModule}
            onModuleChange={setSelectedModule}
            modulos={modulos}
          />
        </div>
        
        {/* Resumo KPIs */}
        <div className="mb-6 w-full">
          <FluxoCaixaSummary data={dadosFiltrados.chart} />
        </div>
        
        {/* Gráfico Principal */}
        <div className="mb-6 w-full">
          <FluxoCaixaChart data={dadosFiltrados.chart} />
        </div>
        
        {/* Ações */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground mr-3">
            Resultado no ano de {selectedYear}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>
        
        {/* Tabela Detalhada */}
        <div className="w-full">
          <FluxoCaixaTable data={dadosFiltrados.table} />
        </div>
      </Layout.Main>
    </Layout>
  );
}