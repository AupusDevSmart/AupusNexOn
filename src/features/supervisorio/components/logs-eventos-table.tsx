// src/features/supervisorio/components/logs-eventos-table.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LogEvento } from "@/types/dtos/logs-eventos";
import { CheckSquare } from "lucide-react";
import { formatarDataHoraBR } from "@/lib/utils/date-formatters";

interface LogsEventosTableProps {
  eventos: LogEvento[];
  selectedItems: string[];
  onSelectItem: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onVerDetalhes: (evento: LogEvento) => void;
  onAssociarOS: (evento: LogEvento) => void;
  onMarcarReconhecido: (evento: LogEvento) => void;
  onReconhecimentoMassa: (ids: string[]) => void;
}

export function LogsEventosTable({
  eventos,
  selectedItems,
  onSelectItem,
  onSelectAll,
  onVerDetalhes,
  onAssociarOS,
  onMarcarReconhecido,
  onReconhecimentoMassa,
}: LogsEventosTableProps) {
  const getTipoEventoColor = (tipo: string) => {
    switch (tipo) {
      case "TRIP":
        return "bg-red-500 text-white";
      case "URGENCIA":
        return "bg-orange-500 text-white";
      case "ALARME":
        return "bg-yellow-500 text-white";
      case "MANUTENCAO":
        return "bg-blue-500 text-white";
      case "INFORMATIVO":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Eventos Registrados</CardTitle>
          {selectedItems.length > 0 && (
            <Button
              onClick={() => onReconhecimentoMassa(selectedItems)}
              variant="outline"
              size="sm"
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Reconhecer Selecionados ({selectedItems.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedItems.length === eventos.length &&
                      eventos.length > 0
                    }
                    onCheckedChange={onSelectAll}
                  />
                </TableHead>
                <TableHead>DATA/HORA</TableHead>
                <TableHead>ATIVO</TableHead>
                <TableHead>TIPO</TableHead>
                <TableHead>MENSAGEM</TableHead>
                <TableHead>USUÁRIO</TableHead>
                <TableHead className="w-32 text-center">AÇÃO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhum evento encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                eventos.map((evento) => (
                  <TableRow key={evento.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(evento.id)}
                        onCheckedChange={() => onSelectItem(evento.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatarDataHoraBR(evento.dataHora)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {evento.ativo}
                    </TableCell>
                    <TableCell>
                      <Badge className={getTipoEventoColor(evento.tipoEvento)}>
                        {evento.tipoEvento}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {evento.mensagem}
                    </TableCell>
                    <TableCell>{evento.usuario}</TableCell>
                    <TableCell className="text-center">
                      {!evento.reconhecido ? (
                        <Button
                          onClick={() => onMarcarReconhecido(evento)}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                          Reconhecer
                        </Button>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800 border-green-300"
                        >
                          Reconhecido
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
