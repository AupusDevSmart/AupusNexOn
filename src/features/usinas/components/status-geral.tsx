// src/features/usinas/components/status-geral.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface StatusGeralData {
  ativosOperacao: number;
  ativosAlerta: number;
  ativosFalha: number;
  ultimaSincronizacao: string;
}

interface StatusGeralProps {
  data: StatusGeralData;
}

interface StatusItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatusItem({ icon, label, value, color }: StatusItemProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <div className={color}>
          {icon}
        </div>
        <span className="text-sm font-medium text-foreground">
          {label}
        </span>
      </div>
      <span className="text-lg font-bold text-foreground">
        {value}
      </span>
    </div>
  );
}

export function StatusGeral({ data }: StatusGeralProps) {
  return (
    <Card className="p-6 h-full">
      <h3 className="text-lg font-semibold mb-6 text-foreground">
        Status Geral
      </h3>
      
      <div className="space-y-3">
        <StatusItem
          icon={<CheckCircle className="h-5 w-5" />}
          label="Ativos em operação"
          value={data.ativosOperacao}
          color="text-green-500"
        />
        
        <StatusItem
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Ativos em alerta"
          value={data.ativosAlerta}
          color="text-yellow-500"
        />
        
        <StatusItem
          icon={<XCircle className="h-5 w-5" />}
          label="Ativos com falha"
          value={data.ativosFalha}
          color="text-red-500"
        />
      </div>
      
      {/* Última Sincronização */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Última sincronização</span>
        </div>
        <div className="mt-1 text-lg font-semibold text-foreground">
          {data.ultimaSincronizacao}
        </div>
      </div>
    </Card>
  );
}