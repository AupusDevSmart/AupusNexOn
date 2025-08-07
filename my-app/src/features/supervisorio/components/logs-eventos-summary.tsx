// src/features/supervisorio/components/logs-eventos-summary.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResumoEventos } from "@/types/dtos/logs-eventos";
import { Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface LogsEventosSummaryProps {
  resumo: ResumoEventos;
}

export function LogsEventosSummary({ resumo }: LogsEventosSummaryProps) {
  const indicadores = [
    {
      titulo: "Total de Eventos",
      valor: resumo.totalEventos,
      icone: Activity,
      cor: "text-blue-600",
    },
    {
      titulo: "Eventos Críticos",
      valor: resumo.eventosCriticos,
      icone: AlertTriangle,
      cor: "text-red-600",
    },
    {
      titulo: "Eventos em Aberto",
      valor: resumo.eventosEmAberto,
      icone: Clock,
      cor: "text-yellow-600",
    },
    {
      titulo: "Eventos Reconhecidos",
      valor: resumo.eventosReconhecidos,
      icone: CheckCircle,
      cor: "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {indicadores.map((indicador, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {indicador.titulo}
            </CardTitle>
            <indicador.icone className={`h-4 w-4 ${indicador.cor}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${indicador.cor}`}>
              {indicador.valor.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
