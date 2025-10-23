// src/features/supervisorio/components/logs-eventos-filters.tsx

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import type {
  AtivoOption,
  FiltrosLogsEventos,
} from "@/types/dtos/logs-eventos";
import { LogsAuditoriaFilter } from "@/features/supervisorio/components/logs-auditoria-filter";
import { FilterIcon } from "lucide-react";
import { parse, format } from "date-fns";

interface LogsEventosFiltersProps {
  filtros: FiltrosLogsEventos;
  onFiltrosChange: (filtros: FiltrosLogsEventos) => void;
  ativos: AtivoOption[];
  onLimparFiltros: () => void;
}

export function LogsEventosFilters({
  filtros,
  onFiltrosChange,
  ativos,
  onLimparFiltros,
}: LogsEventosFiltersProps) {
  // Verificar se há filtros ativos
  const temFiltrosAtivos =
    filtros.tipoEvento !== 'all' ||
    filtros.ativo !== 'all' ||
    filtros.severidade !== 'all' ||
    filtros.reconhecido !== null ||
    (filtros.categoriaAuditoria && filtros.categoriaAuditoria !== 'all') ||
    filtros.dataInicial ||
    filtros.dataFinal;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilterIcon className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 w-full sm:w-auto sm:min-w-[200px]">
              <Label className="text-xs font-medium">Data Inicial</Label>
              <DateTimePicker
                date={
                  filtros.dataInicial
                    ? parse(filtros.dataInicial, "yyyy-MM-dd'T'HH:mm", new Date())
                    : undefined
                }
                setDate={(date) =>
                  onFiltrosChange({
                    ...filtros,
                    dataInicial: date ? format(date, "yyyy-MM-dd'T'HH:mm") : "",
                  })
                }
                placeholder="Selecione"
                className="[&_button]:h-8 [&_button]:text-xs [&_input]:h-8 [&_input]:text-xs"
              />
            </div>

            <div className="space-y-1 w-full sm:w-auto sm:min-w-[200px]">
              <Label className="text-xs font-medium">Data Final</Label>
              <DateTimePicker
                date={
                  filtros.dataFinal
                    ? parse(filtros.dataFinal, "yyyy-MM-dd'T'HH:mm", new Date())
                    : undefined
                }
                setDate={(date) =>
                  onFiltrosChange({
                    ...filtros,
                    dataFinal: date ? format(date, "yyyy-MM-dd'T'HH:mm") : "",
                  })
                }
                placeholder="Selecione"
                className="[&_button]:h-8 [&_button]:text-xs [&_input]:h-8 [&_input]:text-xs"
              />
            </div>

            <div className="space-y-1 w-full sm:w-auto sm:min-w-[200px]">
              <Label className="text-xs font-medium">Ativo</Label>
              <Select
                value={filtros.ativo}
                onValueChange={(value) =>
                  onFiltrosChange({ ...filtros, ativo: value })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos os ativos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os ativos</SelectItem>
                  {ativos.map((ativo) => (
                    <SelectItem key={ativo.value} value={ativo.value}>
                      {ativo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 w-full sm:w-auto sm:min-w-[180px]">
              <Label className="text-xs font-medium">Tipo de Evento</Label>
              <Select
                value={filtros.tipoEvento}
                onValueChange={(value) =>
                  onFiltrosChange({ ...filtros, tipoEvento: value })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="ALARME">Alarme</SelectItem>
                  <SelectItem value="URGENCIA">Urgência</SelectItem>
                  <SelectItem value="TRIP">Trip</SelectItem>
                  <SelectItem value="INFORMATIVO">Informativo</SelectItem>
                  <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 w-full sm:w-auto sm:min-w-[160px]">
              <Label className="text-xs font-medium">Severidade</Label>
              <Select
                value={filtros.severidade}
                onValueChange={(value) =>
                  onFiltrosChange({ ...filtros, severidade: value })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="CRITICA">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <LogsAuditoriaFilter
                value={filtros.categoriaAuditoria || "all"}
                onChange={(value) =>
                  onFiltrosChange({ ...filtros, categoriaAuditoria: value })
                }
              />
            </div>

            {temFiltrosAtivos && (
              <div className="flex items-end">
                <Button
                  onClick={onLimparFiltros}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950 dark:border-red-800"
                >
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>
      </CardContent>
    </Card>
  );
}
