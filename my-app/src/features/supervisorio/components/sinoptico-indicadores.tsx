// src/features/supervisorio/components/sinoptico-indicadores.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { IndicadoresRodape } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Clock,
  FileText,
  Gauge,
  XCircle,
  Zap,
} from "lucide-react";

interface SinopticoIndicadoresProps {
  indicadores: IndicadoresRodape;
}

export function SinopticoIndicadores({
  indicadores,
}: SinopticoIndicadoresProps) {
  const getQualidadeColor = (
    valor: number,
    limites: { bom: number; ruim: number },
    invertido = false
  ) => {
    if (invertido) {
      if (valor <= limites.bom) return "text-green-600";
      if (valor <= limites.ruim) return "text-yellow-600";
      return "text-red-600";
    } else {
      if (valor >= limites.bom) return "text-green-600";
      if (valor >= limites.ruim) return "text-yellow-600";
      return "text-red-600";
    }
  };

  const getContadorColor = (valor: number) => {
    if (valor === 0) return "bg-green-100 text-green-800";
    if (valor <= 3) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const indicadoresConfig = [
    {
      label: "THD",
      valor: `${indicadores.thd.toFixed(1)}%`,
      icon: Activity,
      cor: getQualidadeColor(indicadores.thd, { bom: 5, ruim: 8 }, true),
      descricao: "Distorção Harmônica Total",
    },
    {
      label: "FP",
      valor: indicadores.fp.toFixed(3),
      icon: Zap,
      cor: getQualidadeColor(indicadores.fp, { bom: 0.92, ruim: 0.85 }),
      descricao: "Fator de Potência",
    },
    {
      label: "DT",
      valor: `${indicadores.dt.toFixed(2)}%`,
      icon: Gauge,
      cor: getQualidadeColor(indicadores.dt, { bom: 3, ruim: 5 }, true),
      descricao: "Distorção Total",
    },
    {
      label: "Freq",
      valor: `${indicadores.frequencia.toFixed(2)} Hz`,
      icon: Activity,
      cor: getQualidadeColor(
        Math.abs(60 - indicadores.frequencia),
        { bom: 0.1, ruim: 0.3 },
        true
      ),
      descricao: "Frequência da Rede",
    },
  ];

  const contadoresConfig = [
    {
      label: "Alarmes",
      valor: indicadores.alarmes,
      icon: AlertTriangle,
      cor: "text-yellow-600",
      descricao: "Alarmes Ativos",
    },
    {
      label: "Falhas",
      valor: indicadores.falhas,
      icon: XCircle,
      cor: "text-red-600",
      descricao: "Falhas Detectadas",
    },
    {
      label: "Urgências",
      valor: indicadores.urgencias,
      icon: AlertCircle,
      cor: "text-orange-600",
      descricao: "Situações Urgentes",
    },
    {
      label: "OS Abertas",
      valor: indicadores.osAbertas,
      icon: FileText,
      cor: "text-blue-600",
      descricao: "Ordens de Serviço",
    },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {/* Indicadores de Qualidade */}
          {indicadoresConfig.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              title={item.descricao}
            >
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`h-4 w-4 ${item.cor}`} />
                <span className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <div className={`text-lg font-bold ${item.cor}`}>
                {item.valor}
              </div>
            </div>
          ))}

          {/* Contadores de Status */}
          {contadoresConfig.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              title={item.descricao}
            >
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`h-4 w-4 ${item.cor}`} />
                <span className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <Badge variant="outline" className={getContadorColor(item.valor)}>
                {item.valor}
              </Badge>
            </div>
          ))}
        </div>

        {/* Linha de Status Geral */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                Última atualização: {new Date().toLocaleTimeString("pt-BR")}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Sistema Online</span>
              </div>

              <div className="flex items-center gap-1">
                <span>Qualidade:</span>
                {indicadores.thd <= 5 &&
                indicadores.fp >= 0.92 &&
                indicadores.dt <= 3 ? (
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    Boa
                  </Badge>
                ) : indicadores.thd <= 8 &&
                  indicadores.fp >= 0.85 &&
                  indicadores.dt <= 5 ? (
                  <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                    Regular
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 text-xs">
                    Ruim
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
