// src/features/supervisorio/components/logs-auditoria-filter.tsx

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoriaAuditoria } from "@/types/dtos/logs-eventos";

interface LogsAuditoriaFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const categoriasAuditoria: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  { value: "all", label: "Todas as categorias", description: "Todos os tipos" },
  {
    value: "LOGIN",
    label: "Login",
    description: "Eventos de login no sistema",
  },
  {
    value: "LOGOUT",
    label: "Logout",
    description: "Eventos de logout do sistema",
  },
  {
    value: "COMANDO",
    label: "Comando",
    description: "Comandos executados (ligar/desligar equipamentos)",
  },
  {
    value: "CONFIGURACAO",
    label: "Configuração",
    description: "Alterações em configurações do sistema",
  },
  {
    value: "DIAGRAMA",
    label: "Diagrama",
    description: "Modificações em diagramas unifilares",
  },
  {
    value: "USUARIO",
    label: "Usuário",
    description: "Criação/edição de usuários",
  },
  {
    value: "SISTEMA",
    label: "Sistema",
    description: "Eventos automáticos do sistema",
  },
  {
    value: "RELATORIO",
    label: "Relatório",
    description: "Geração de relatórios",
  },
];

export function LogsAuditoriaFilter({
  value,
  onChange,
}: LogsAuditoriaFilterProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">Categoria de Auditoria</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Todas as categorias" />
        </SelectTrigger>
        <SelectContent>
          {categoriasAuditoria.map((categoria) => (
            <SelectItem key={categoria.value} value={categoria.value}>
              <div className="flex flex-col">
                <span className="font-medium">{categoria.label}</span>
                <span className="text-xs text-muted-foreground">
                  {categoria.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
