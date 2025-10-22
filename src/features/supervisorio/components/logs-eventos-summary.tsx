// src/features/supervisorio/components/logs-eventos-summary.tsx

import { Card } from "@/components/ui/card";
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
      iconeClass: "text-blue-500",
      subtitulo: "Últimas 24 horas",
    },
    {
      titulo: "Eventos Críticos",
      valor: resumo.eventosCriticos,
      icone: AlertTriangle,
      cor: "text-red-600",
      iconeClass: "text-red-500",
      subtitulo: "Requerem atenção",
    },
    {
      titulo: "Eventos em Aberto",
      valor: resumo.eventosEmAberto,
      icone: Clock,
      cor: "text-yellow-600",
      iconeClass: "text-yellow-500",
      subtitulo: "Aguardando reconhecimento",
    },
    {
      titulo: "Eventos Reconhecidos",
      valor: resumo.eventosReconhecidos,
      icone: CheckCircle,
      cor: "text-green-600",
      iconeClass: "text-green-500",
      subtitulo: "Já tratados",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {indicadores.map((indicador, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {indicador.titulo}
              </p>
              <p className={`text-xl font-bold ${indicador.cor}`}>
                {indicador.valor.toLocaleString()}
              </p>
              <p className={`text-xs ${indicador.cor}`}>
                {indicador.subtitulo}
              </p>
            </div>
            <indicador.icone className={`h-6 w-6 ${indicador.iconeClass}`} />
          </div>
        </Card>
      ))}
    </div>
  );
}
