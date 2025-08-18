// src/features/supervisorio/components/sinoptico-indicadores.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { IndicadoresRodape } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  AlertTriangle,
  Clock,
  FileText,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

interface SinopticoIndicadoresProps {
  indicadores: IndicadoresRodape;
  onAbrirAlarmes?: () => void;
  onAbrirFalhas?: () => void;
  onAbrirUrgencias?: () => void;
  onAbrirOS?: () => void;
}

export function SinopticoIndicadores({
  indicadores,
  onAbrirAlarmes,
  onAbrirFalhas,
  onAbrirUrgencias,
  onAbrirOS,
}: SinopticoIndicadoresProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
      {/* Indicadores Elétricos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            <div>
              <div className="font-medium">{indicadores.thd.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">THD</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-green-500" />
            <div>
              <div className="font-medium">{indicadores.fp.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">
                Fator de Potência
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <div>
              <div className="font-medium">{indicadores.dt.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">DT</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-orange-500" />
            <div>
              <div className="font-medium">
                {indicadores.frequencia.toFixed(1)}Hz
              </div>
              <div className="text-sm text-muted-foreground">Frequência</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores Clicáveis */}
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          indicadores.alarmes > 0
            ? "border-red-200 hover:border-red-300"
            : "hover:border-gray-300"
        }`}
        onClick={onAbrirAlarmes}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle
              className={`h-5 w-5 ${
                indicadores.alarmes > 0 ? "text-red-500" : "text-gray-400"
              }`}
            />
            <div>
              <div
                className={`font-medium ${
                  indicadores.alarmes > 0 ? "text-red-600" : "text-gray-600"
                }`}
              >
                {indicadores.alarmes}
              </div>
              <div className="text-sm text-muted-foreground">Alarmes</div>
              {indicadores.alarmes > 0 && (
                <Badge variant="destructive" className="text-xs mt-1">
                  Clique para ver
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          indicadores.falhas > 0
            ? "border-red-200 hover:border-red-300"
            : "hover:border-gray-300"
        }`}
        onClick={onAbrirFalhas}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <XCircle
              className={`h-5 w-5 ${
                indicadores.falhas > 0 ? "text-red-500" : "text-gray-400"
              }`}
            />
            <div>
              <div
                className={`font-medium ${
                  indicadores.falhas > 0 ? "text-red-600" : "text-gray-600"
                }`}
              >
                {indicadores.falhas}
              </div>
              <div className="text-sm text-muted-foreground">Falhas</div>
              {indicadores.falhas > 0 && (
                <Badge variant="destructive" className="text-xs mt-1">
                  Clique para ver
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          indicadores.urgencias > 0
            ? "border-red-200 hover:border-red-300 animate-pulse"
            : "hover:border-gray-300"
        }`}
        onClick={onAbrirUrgencias}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Zap
              className={`h-5 w-5 ${
                indicadores.urgencias > 0 ? "text-red-500" : "text-gray-400"
              }`}
            />
            <div>
              <div
                className={`font-medium ${
                  indicadores.urgencias > 0 ? "text-red-600" : "text-gray-600"
                }`}
              >
                {indicadores.urgencias}
              </div>
              <div className="text-sm text-muted-foreground">Urgências</div>
              {indicadores.urgencias > 0 && (
                <Badge variant="destructive" className="text-xs mt-1">
                  URGENTE!
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          indicadores.osAbertas > 0
            ? "border-blue-200 hover:border-blue-300"
            : "hover:border-gray-300"
        }`}
        onClick={onAbrirOS}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <FileText
              className={`h-5 w-5 ${
                indicadores.osAbertas > 0 ? "text-blue-500" : "text-gray-400"
              }`}
            />
            <div>
              <div
                className={`font-medium ${
                  indicadores.osAbertas > 0 ? "text-blue-600" : "text-gray-600"
                }`}
              >
                {indicadores.osAbertas}
              </div>
              <div className="text-sm text-muted-foreground">OS Abertas</div>
              {indicadores.osAbertas > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs mt-1 border-blue-200 text-blue-600"
                >
                  Clique para ver
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
