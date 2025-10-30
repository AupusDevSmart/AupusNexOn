// src/features/supervisorio/components/logs-eventos-table.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  onMarcarReconhecido: (evento: LogEvento) => void;
}

export function LogsEventosTable({
  eventos,
  onMarcarReconhecido,
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
        <CardTitle>Eventos Registrados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table className="table-fixed w-full min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px] px-4">DATA/HORA</TableHead>
                <TableHead className="w-[120px] px-4">ATIVO</TableHead>
                <TableHead className="w-[100px] px-4">TIPO</TableHead>
                <TableHead className="w-[300px] px-4">MENSAGEM</TableHead>
                <TableHead className="w-[120px] px-4">USUÁRIO</TableHead>
                <TableHead className="w-[180px] px-4 text-center">AÇÃO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhum evento encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                eventos.map((evento) => (
                  <TableRow key={evento.id}>
                    <TableCell className="w-[150px] px-4 text-sm whitespace-nowrap">
                      {formatarDataHoraBR(evento.dataHora)}
                    </TableCell>
                    <TableCell className="w-[120px] px-4 font-bold truncate">
                      {evento.ativo}
                    </TableCell>
                    <TableCell className="w-[100px] px-4">
                      <Badge className={getTipoEventoColor(evento.tipoEvento)}>
                        {evento.tipoEvento}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[300px] px-4 truncate">
                      {evento.mensagem}
                    </TableCell>
                    <TableCell className="w-[120px] px-4 truncate">{evento.usuario}</TableCell>
                    <TableCell className="w-[180px] px-4 text-center">
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
