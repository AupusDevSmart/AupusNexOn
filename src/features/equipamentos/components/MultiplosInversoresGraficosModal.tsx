import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, BarChart3, LineChart, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MultiplosInversoresGraficoDia } from './MultiplosInversoresGraficoDia';
import { MultiplosInversoresGraficoMes } from './MultiplosInversoresGraficoMes';
import { MultiplosInversoresGraficoAno } from './MultiplosInversoresGraficoAno';

interface MultiplosInversoresGraficosModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipamentosIds: string[];
  equipamentosNomes?: string[];
}

export function MultiplosInversoresGraficosModal({
  isOpen,
  onClose,
  equipamentosIds,
  equipamentosNomes = [],
}: MultiplosInversoresGraficosModalProps) {
  const [activeTab, setActiveTab] = useState('dia');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Formatar datas para os parâmetros da API
  const dataFormatada = format(selectedDate, 'yyyy-MM-dd');
  const mesFormatado = format(selectedDate, 'yyyy-MM');
  const anoFormatado = format(selectedDate, 'yyyy');

  // Funções de navegação
  const handlePreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const handlePreviousMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const handlePreviousYear = () => setSelectedDate(subYears(selectedDate, 1));
  const handleNextYear = () => setSelectedDate(addYears(selectedDate, 1));

  // Voltar para hoje
  const handleToday = () => setSelectedDate(new Date());

  // Verificar se é hoje/este mês/este ano
  const isToday = format(new Date(), 'yyyy-MM-dd') === dataFormatada;
  const isThisMonth = format(new Date(), 'yyyy-MM') === mesFormatado;
  const isThisYear = format(new Date(), 'yyyy') === anoFormatado;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <span>Gráficos Agregados - {equipamentosIds.length} Inversores</span>
              {equipamentosNomes.length > 0 && (
                <div className="text-sm text-muted-foreground mt-1 font-normal">
                  {equipamentosNomes.join(', ')}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'dia' && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePreviousDay}
                    title="Dia anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isToday ? 'secondary' : 'outline'}
                    onClick={handleToday}
                    className="min-w-[140px]"
                  >
                    {format(selectedDate, 'dd/MM/yyyy')}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextDay}
                    title="Próximo dia"
                    disabled={isToday}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {activeTab === 'mes' && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePreviousMonth}
                    title="Mês anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isThisMonth ? 'secondary' : 'outline'}
                    onClick={handleToday}
                    className="min-w-[140px] capitalize"
                  >
                    {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextMonth}
                    title="Próximo mês"
                    disabled={isThisMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {activeTab === 'ano' && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePreviousYear}
                    title="Ano anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isThisYear ? 'secondary' : 'outline'}
                    onClick={handleToday}
                    className="min-w-[100px]"
                  >
                    {format(selectedDate, 'yyyy')}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextYear}
                    title="Próximo ano"
                    disabled={isThisYear}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dia" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Dia
            </TabsTrigger>
            <TabsTrigger value="mes" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Mês
            </TabsTrigger>
            <TabsTrigger value="ano" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Ano
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dia" className="mt-4">
            <MultiplosInversoresGraficoDia
              equipamentosIds={equipamentosIds}
              data={dataFormatada}
              height={400}
            />
          </TabsContent>

          <TabsContent value="mes" className="mt-4">
            <MultiplosInversoresGraficoMes
              equipamentosIds={equipamentosIds}
              mes={mesFormatado}
              height={400}
            />
          </TabsContent>

          <TabsContent value="ano" className="mt-4">
            <MultiplosInversoresGraficoAno
              equipamentosIds={equipamentosIds}
              ano={anoFormatado}
              height={400}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}