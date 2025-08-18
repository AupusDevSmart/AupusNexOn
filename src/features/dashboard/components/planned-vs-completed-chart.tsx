// src/features/dashboard/components/planned-vs-completed-chart.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ChartData {
  month: string;
  planejadas: number;
  concluidas: number;
}

interface PlannedVsCompletedChartProps {
  data: ChartData[];
}

export function PlannedVsCompletedChart({ data }: PlannedVsCompletedChartProps) {
  const CustomLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex justify-center space-x-6 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center">
            <div 
              className="w-3 h-3 rounded mr-2" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground">
              {entry.value === 'planejadas' ? 'Planejadas' : 'Concluídas'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'planejadas' ? 'Planejadas' : 'Concluídas'}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6 h-full">
      <h3 className="text-lg font-semibold mb-6 text-foreground">
        Ordens Planejadas vs. Concluídas
      </h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            barCategoryGap="20%"
          >
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              className="text-muted-foreground"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              className="text-muted-foreground"
            />
            <Tooltip content={CustomTooltip} />
            <Bar 
              dataKey="planejadas" 
              fill="#60A5FA" 
              radius={[2, 2, 0, 0]}
              maxBarSize={30}
            />
            <Bar 
              dataKey="concluidas" 
              fill="#3B82F6" 
              radius={[2, 2, 0, 0]}
              maxBarSize={30}
            />
            <Legend content={CustomLegend} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}