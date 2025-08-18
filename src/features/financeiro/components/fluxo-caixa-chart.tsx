import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { FluxoCaixaData, ChartType } from '@/types/dtos/financeiro';

interface FluxoCaixaChartProps {
  data: FluxoCaixaData[];
}

export function FluxoCaixaChart({ data }: FluxoCaixaChartProps): JSX.Element {
  const [chartType, setChartType] = useState<ChartType>('line');
  
  // Calcular totais para os cards laterais
  const totals = data.reduce((acc, item) => {
    acc.entradas += item.entradas || 0;
    acc.saidas += item.saidas || 0;
    return acc;
  }, { entradas: 0, saidas: 0 });

  const formatTooltip = (value: unknown): [string, string] => {
    if (typeof value === 'number') {
      return [`R$ ${value.toLocaleString('pt-BR')}`, 'Resultado'];
    }
    return ['R$ 0', 'Resultado'];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gráfico Principal */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Resultado nos últimos 12 meses</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={chartType === 'line' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('line')}
              >
                Linha
              </Button>
              <Button
                variant={chartType === 'bar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('bar')}
              >
                Barras
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={formatTooltip} />
                  <Line 
                    type="monotone" 
                    dataKey="resultado" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              ) : (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={formatTooltip} />
                  <Bar dataKey="resultado" fill="#3b82f6" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Cards de Resumo */}
      <div className="space-y-4">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Entradas no período</p>
                <p className="text-3xl font-bold">R$ {totals.entradas.toLocaleString('pt-BR')}</p>
                <p className="text-green-100 text-xs">Total acumulado</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-100" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Saídas no período</p>
                <p className="text-3xl font-bold">R$ {totals.saidas.toLocaleString('pt-BR')}</p>
                <p className="text-red-100 text-xs">Total acumulado</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-100" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}