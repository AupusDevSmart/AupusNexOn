// src/features/supervisorio/components/logs-eventos-filters.tsx

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AtivoOption,
  FiltrosLogsEventos,
} from "@/types/dtos/logs-eventos";
import { CalendarIcon, FilterIcon, RefreshCwIcon } from "lucide-react";

interface LogsEventosFiltersProps {
  filtros: FiltrosLogsEventos;
  onFiltrosChange: (filtros: FiltrosLogsEventos) => void;
  ativos: AtivoOption[];
  onLimparFiltros: () => void;
  onAplicarFiltros: () => void;
}

export function LogsEventosFilters({
  filtros,
  onFiltrosChange,
  ativos,
  onLimparFiltros,
  onAplicarFiltros,
}: LogsEventosFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilterIcon className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="space-y-1">
          <Label htmlFor="dataInicial" className="text-xs font-medium">
            Data/Hora Inicial
          </Label>
          <div className="relative">
            <Input
              id="dataInicial"
              type="datetime-local"
              value={filtros.dataInicial}
              onChange={(e) =>
                onFiltrosChange({ ...filtros, dataInicial: e.target.value })
              }
              className="text-xs h-8"
            />
            <CalendarIcon className="absolute right-2 top-2 h-3 w-3 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="dataFinal" className="text-xs font-medium">
            Data/Hora Final
          </Label>
          <div className="relative">
            <Input
              id="dataFinal"
              type="datetime-local"
              value={filtros.dataFinal}
              onChange={(e) =>
                onFiltrosChange({ ...filtros, dataFinal: e.target.value })
              }
              className="text-xs h-8"
            />
            <CalendarIcon className="absolute right-2 top-2 h-3 w-3 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1">
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

        <div className="space-y-1">
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

        <div className="space-y-1">
          <Label className="text-xs font-medium">Severidade</Label>
          <Select
            value={filtros.severidade}
            onValueChange={(value) =>
              onFiltrosChange({ ...filtros, severidade: value })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Todas as severidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as severidades</SelectItem>
              <SelectItem value="BAIXA">Baixa</SelectItem>
              <SelectItem value="MEDIA">Média</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="CRITICA">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reconhecido"
                checked={filtros.reconhecido === true}
                onCheckedChange={(checked) =>
                  onFiltrosChange({
                    ...filtros,
                    reconhecido: checked ? true : null,
                  })
                }
              />
              <Label htmlFor="reconhecido" className="text-xs font-medium">
                Apenas reconhecidos
              </Label>
            </div>
            <div className="flex gap-1">
              <Button
                onClick={onAplicarFiltros}
                size="sm"
                className="h-7 px-2 text-xs"
              >
                <FilterIcon className="mr-1 h-3 w-3" />
                Aplicar
              </Button>
              <Button
                onClick={onLimparFiltros}
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
              >
                <RefreshCwIcon className="mr-1 h-3 w-3" />
                Limpar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
