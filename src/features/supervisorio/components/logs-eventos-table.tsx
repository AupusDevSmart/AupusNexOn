// src/features/supervisorio/components/logs-eventos-table.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LogEvento } from "@/types/dtos/logs-eventos";
import { CheckSquare, Eye, FileText, MoreHorizontal } from "lucide-react";

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
  const getSeveridadeColor = (severidade: string) => {
    switch (severidade) {
      case "CRITICA":
        return "bg-red-100 text-red-800";
      case "ALTA":
        return "bg-orange-100 text-orange-800";
      case "MEDIA":
        return "bg-yellow-100 text-yellow-800";
      case "BAIXA":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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

  const formatarDataHora = (dataHora: string) => {
    return new Date(dataHora).toLocaleString("pt-BR");
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
                <TableHead>Data/Hora</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
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
                      {formatarDataHora(evento.dataHora)}
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
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getSeveridadeColor(evento.severidade)}
                      >
                        {evento.severidade}
                      </Badge>
                    </TableCell>
                    <TableCell>{evento.usuario}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {evento.reconhecido ? (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800"
                          >
                            Reconhecido
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-yellow-100 text-yellow-800"
                          >
                            Pendente
                          </Badge>
                        )}
                        {evento.osAssociada && (
                          <Badge
                            variant="outline"
                            className="bg-blue-100 text-blue-800"
                          >
                            OS: {evento.osAssociada}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onVerDetalhes(evento)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onAssociarOS(evento)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Associar OS
                          </DropdownMenuItem>
                          {!evento.reconhecido && (
                            <DropdownMenuItem
                              onClick={() => onMarcarReconhecido(evento)}
                            >
                              <CheckSquare className="mr-2 h-4 w-4" />
                              Marcar como Reconhecido
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
