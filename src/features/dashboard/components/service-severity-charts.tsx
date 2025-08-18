// src/features/dashboard/components/service-severity-charts.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ServiceSeverityData {
  minor: number;
  major: number;
  critical: number;
}

interface RiskLevelsData {
  low: number;
  medium: number;
  high: number;
}

interface ServiceSeverityChartsProps {
  serviceSeverity: ServiceSeverityData;
  riskLevels: RiskLevelsData;
}

export function ServiceSeverityCharts({ serviceSeverity, riskLevels }: ServiceSeverityChartsProps) {
  const severityData = [
    { name: 'Menor', value: serviceSeverity.minor, color: '#10B981' },
    { name: 'Maior', value: serviceSeverity.major, color: '#3B82F6' },
    { name: 'Crítica', value: serviceSeverity.critical, color: '#EF4444' }
  ];

  const riskData = [
    { name: 'Baixo', value: riskLevels.low, color: '#3B82F6' },
    { name: 'Médio', value: riskLevels.medium, color: '#EF4444' },
    { name: 'Alto', value: riskLevels.high, color: '#10B981' }
  ];

  const renderCustomizedLabel = (data: any[]) => {
    return ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
      const RADIAN = Math.PI / 180;
      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);

      return (
        <text 
          textAnchor={x > cx ? 'start' : 'end'} 
          dominantBaseline="central"
          fontSize={12}
          fontWeight="bold"
        >
          {`${value}%`}
        </text>
      );
    };
  };

  const Legend = ({ data }: { data: typeof severityData }) => (
    <div className="flex flex-col space-y-2 mt-4">
      {data.map((entry, index) => (
        <div key={index} className="flex items-center text-sm">
          <div 
            className="w-3 h-3 rounded-full mr-2" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-foreground">{entry.name}</span>
          <span className="ml-auto text-muted-foreground">{entry.value}%</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="p-6 h-full">
      <h3 className="text-lg font-semibold mb-6 text-foreground">
        Severidade dos Serviços
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
        {/* Primeiro gráfico - Severidade dos Serviços */}
        <div className="flex flex-col">
          <div className="h-48 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel(severityData)}
                  outerRadius={70}
                  innerRadius={35}
                  fill="#8884d8"
                  dataKey="value"
                  strokeWidth={3}
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend data={severityData} />
        </div>

        {/* Segundo gráfico - Níveis de Risco */}
        <div className="flex flex-col">
          <div className="h-48 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel(riskData)}
                  outerRadius={70}
                  innerRadius={35}
                  fill="#8884d8"
                  dataKey="value"
                  strokeWidth={3}
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend data={riskData} />
        </div>
      </div>
    </Card>
  );
}