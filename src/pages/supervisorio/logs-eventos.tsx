// src/pages/supervisorio/logs-eventos.tsx
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimeRangePicker } from "@/components/ui/datetime-range-picker";
import { useSidebar } from "@/components/ui/sidebar";
import { toast } from "@/components/ui/use-toast";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckSquare,
  Clock,
  Download,
  Eye,
  Filter,
  Info,
  Link,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { parse, format } from "date-fns";

// Tipos
interface Evento {
  id: string;
  dataHora: string;
  ativo: string;
  tipoEvento: "trip" | "alarme" | "urgencia" | "manutencao" | "sistema";
  mensagem: string;
  severidade: "baixa" | "media" | "alta" | "critica";
  usuario: string;
  status: "aberto" | "reconhecido" | "resolvido";
  osAssociada?: string;
  detalhes?: string;
  localizacao?: string;
  equipamento?: string;
  categoriaAuditoria?: "LOGIN" | "LOGOUT" | "COMANDO" | "CONFIGURACAO" | "DIAGRAMA" | "USUARIO" | "SISTEMA" | "RELATORIO";
  ip?: string;
  sessaoId?: string;
}

// Dados mockados
const eventosMock: Evento[] = [
  {
    id: "1",
    dataHora: "2025-01-15 10:30:45",
    ativo: "UFV São Paulo",
    tipoEvento: "manutencao",
    mensagem: "Manutenção preventiva iniciada no inversor principal",
    severidade: "baixa",
    usuario: "João Silva",
    status: "reconhecido",
  },
  {
    id: "2",
    dataHora: "2025-01-15 09:45:12",
    ativo: "Fábrica ABC",
    tipoEvento: "alarme",
    mensagem: "Pico de consumo detectado - 15% acima do limite",
    severidade: "media",
    usuario: "Sistema",
    status: "aberto",
  },
  {
    id: "3",
    dataHora: "2025-01-15 08:22:33",
    ativo: "UFV Rio de Janeiro",
    tipoEvento: "alarme",
    mensagem: "Alerta de temperatura elevada no transformador TR-02",
    severidade: "alta",
    usuario: "Sistema",
    status: "aberto",
  },
  {
    id: "4",
    dataHora: "2025-01-15 07:15:00",
    ativo: "Hospital Central",
    tipoEvento: "sistema",
    mensagem: "Transferência automática para gerador concluída com sucesso",
    severidade: "baixa",
    usuario: "Sistema",
    status: "resolvido",
  },
  {
    id: "5",
    dataHora: "2025-01-15 06:48:19",
    ativo: "UFV Bahia",
    tipoEvento: "trip",
    mensagem: "Falha crítica no inversor INV-03 - Desligamento automático",
    severidade: "critica",
    usuario: "Sistema",
    status: "aberto",
    osAssociada: "OS-2025-0145",
  },
  {
    id: "6",
    dataHora: "2025-01-15 05:30:00",
    ativo: "Data Center Alpha",
    tipoEvento: "urgencia",
    mensagem: "Sobrecarga detectada - Acionamento de banco de capacitores",
    severidade: "alta",
    usuario: "Sistema",
    status: "reconhecido",
  },
  {
    id: "7",
    dataHora: "2025-01-14 23:45:00",
    ativo: "Shopping XYZ",
    tipoEvento: "sistema",
    mensagem: "Backup de dados do sistema supervisório concluído",
    severidade: "baixa",
    usuario: "Sistema",
    status: "resolvido",
  },
  {
    id: "8",
    dataHora: "2025-01-14 22:10:30",
    ativo: "UFV Minas Gerais",
    tipoEvento: "alarme",
    mensagem: "Desvio de fase detectado - Fase B com variação de 5%",
    severidade: "media",
    usuario: "Sistema",
    status: "reconhecido",
  },
  // Eventos de Auditoria
  {
    id: "9",
    dataHora: "2025-01-15 14:25:00",
    ativo: "Sistema NexON",
    tipoEvento: "sistema",
    mensagem: "Usuário realizou login no sistema",
    severidade: "baixa",
    usuario: "ops.supervisor",
    status: "reconhecido",
    localizacao: "Centro de Controle - Goiânia",
    detalhes: "Login realizado com sucesso. IP: 192.168.1.45. Navegador: Chrome 120.0. Horário: 14:25:00.",
    categoriaAuditoria: "LOGIN",
    ip: "192.168.1.45",
  },
  {
    id: "10",
    dataHora: "2025-01-15 13:50:00",
    ativo: "Carga Industrial Anápolis",
    tipoEvento: "sistema",
    mensagem: "Disjuntor DJ-001 desligado manualmente",
    severidade: "media",
    usuario: "ops.supervisor",
    status: "reconhecido",
    localizacao: "Anápolis - GO",
    equipamento: "Disjuntor DJ-001",
    detalhes: "Comando de abertura executado pelo usuário ops.supervisor às 13:50:00. Motivo: Manutenção preventiva programada. Estado anterior: Ligado. Estado atual: Desligado.",
    categoriaAuditoria: "COMANDO",
  },
  {
    id: "11",
    dataHora: "2025-01-15 13:15:00",
    ativo: "UFV Solar Goiânia",
    tipoEvento: "sistema",
    mensagem: "Diagrama unifilar alterado",
    severidade: "media",
    usuario: "engenharia.joao",
    status: "reconhecido",
    localizacao: "Goiânia - GO",
    detalhes: "Modificações realizadas no diagrama unifilar da UFV Solar Goiânia. Alterações: Adicionado novo transformador TR-003, atualizado posicionamento de inversores INV-004 a INV-006. Versão anterior: v2.3. Nova versão: v2.4. Aprovação: Pendente.",
    categoriaAuditoria: "DIAGRAMA",
  },
  {
    id: "12",
    dataHora: "2025-01-15 12:40:00",
    ativo: "Sistema NexON",
    tipoEvento: "sistema",
    mensagem: "Configuração de alarmes modificada",
    severidade: "media",
    usuario: "admin.sistema",
    status: "reconhecido",
    localizacao: "Centro de Controle - Goiânia",
    detalhes: "Parâmetros de alarme atualizados. Ativo: Carga Industrial Anápolis. Alterações: Limite de tensão máxima alterado de 240V para 245V, timeout de reconhecimento alterado de 30min para 45min. Justificativa: Ajuste conforme características da carga.",
    categoriaAuditoria: "CONFIGURACAO",
  },
  {
    id: "13",
    dataHora: "2025-01-15 11:50:00",
    ativo: "Transformador Brasília",
    tipoEvento: "sistema",
    mensagem: "Setpoint de temperatura ajustado",
    severidade: "baixa",
    usuario: "ops.supervisor",
    status: "reconhecido",
    localizacao: "Brasília - DF",
    equipamento: "Transformador TR-001",
    detalhes: "Setpoint de temperatura do transformador TR-001 ajustado remotamente. Valor anterior: 75°C. Novo valor: 70°C. Temperatura atual: 65°C. Comando executado via interface web.",
    categoriaAuditoria: "COMANDO",
  },
  {
    id: "14",
    dataHora: "2025-01-15 11:20:00",
    ativo: "Sistema NexON",
    tipoEvento: "sistema",
    mensagem: "Relatório mensal gerado",
    severidade: "baixa",
    usuario: "Sistema",
    status: "reconhecido",
    localizacao: "Sistema",
    detalhes: "Relatório automático mensal de desempenho gerado com sucesso. Período: 01/12/2024 a 31/12/2024. Ativos incluídos: Todos. Formato: PDF. Tamanho: 2.4MB. Destinatários: 5 usuários notificados.",
    categoriaAuditoria: "RELATORIO",
  },
  {
    id: "15",
    dataHora: "2025-01-15 10:45:00",
    ativo: "Motor Bomba Caldas Novas",
    tipoEvento: "sistema",
    mensagem: "Banco de capacitores acionado manualmente",
    severidade: "baixa",
    usuario: "ops.eletricista",
    status: "reconhecido",
    localizacao: "Caldas Novas - GO",
    equipamento: "Banco de Capacitores BC-001",
    detalhes: "Banco de capacitores BC-001 acionado para correção de fator de potência. FP antes: 0.87. FP esperado: 0.95. Comando executado por ops.eletricista via painel local.",
    categoriaAuditoria: "COMANDO",
  },
  {
    id: "16",
    dataHora: "2025-01-15 10:10:00",
    ativo: "Sistema NexON",
    tipoEvento: "sistema",
    mensagem: "Novo usuário cadastrado no sistema",
    severidade: "baixa",
    usuario: "admin.sistema",
    status: "reconhecido",
    localizacao: "Sistema",
    detalhes: "Novo usuário criado: manutencao.carlos. Perfil: Técnico de Manutenção. Permissões: Leitura de todos os ativos, escrita em ordens de serviço. Status: Ativo. Criado por: admin.sistema.",
    categoriaAuditoria: "USUARIO",
  },
  {
    id: "17",
    dataHora: "2025-01-15 09:35:00",
    ativo: "UFV Solar Goiânia",
    tipoEvento: "sistema",
    mensagem: "Inversor reiniciado remotamente",
    severidade: "baixa",
    usuario: "ops.supervisor",
    status: "reconhecido",
    localizacao: "Goiânia - GO",
    equipamento: "Inversor INV-002",
    detalhes: "Comando de reset executado no inversor INV-002. Motivo: Limpeza de erro intermitente. Downtime: 45 segundos. Produção retomada normalmente às 09:36.",
    categoriaAuditoria: "COMANDO",
  },
  {
    id: "18",
    dataHora: "2025-01-15 09:00:00",
    ativo: "Sistema NexON",
    tipoEvento: "sistema",
    mensagem: "Backup automático do sistema concluído",
    severidade: "baixa",
    usuario: "Sistema",
    status: "reconhecido",
    localizacao: "Sistema",
    detalhes: "Backup automático diário concluído com sucesso. Dados incluídos: Configurações, logs, históricos de medições. Tamanho total: 1.2GB. Armazenamento: Cloud Storage. Tempo de execução: 8 minutos.",
    categoriaAuditoria: "SISTEMA",
  },
  {
    id: "19",
    dataHora: "2025-01-15 08:30:00",
    ativo: "Carga Industrial Anápolis",
    tipoEvento: "sistema",
    mensagem: "Modo de operação alterado",
    severidade: "media",
    usuario: "ops.supervisor",
    status: "reconhecido",
    localizacao: "Anápolis - GO",
    detalhes: "Modo de operação alterado de 'Automático' para 'Manual'. Justificativa: Testes de performance programados. Duração prevista: 2 horas. Alterado por: ops.supervisor às 08:30.",
    categoriaAuditoria: "CONFIGURACAO",
  },
  {
    id: "20",
    dataHora: "2025-01-15 08:00:00",
    ativo: "Sistema NexON",
    tipoEvento: "sistema",
    mensagem: "Usuário realizou logout do sistema",
    severidade: "baixa",
    usuario: "ops.turno.noite",
    status: "reconhecido",
    localizacao: "Centro de Controle - Goiânia",
    detalhes: "Logout realizado. Duração da sessão: 8h 15min. Ações realizadas: 23 comandos executados, 15 eventos reconhecidos. IP: 192.168.1.42.",
    categoriaAuditoria: "LOGOUT",
    ip: "192.168.1.42",
  },
];

export function LogsEventosPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [eventos, setEventos] = useState<Evento[]>(eventosMock);
  const [filtros, setFiltros] = useState({
    dataInicial: "",
    dataFinal: "",
    tipoEvento: "todos",
    ativo: "todos",
    severidade: "todas",
  });
  const [eventosSelecionados, setEventosSelecionados] = useState<string[]>([]);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(
    null
  );

  // Estatísticas
  const totalEventos = eventos.length;
  const eventosCriticos = eventos.filter(
    (e) => e.severidade === "critica"
  ).length;
  const eventosAbertos = eventos.filter((e) => e.status === "aberto").length;
  const taxaResolucao = Math.round(
    (eventos.filter((e) => e.status === "resolvido").length / totalEventos) *
      100
  );

  // Funções auxiliares
  const getTipoEventoIcon = (tipo: string) => {
    switch (tipo) {
      case "trip":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "alarme":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "urgencia":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "manutencao":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "sistema":
        return <Info className="h-4 w-4 text-gray-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeveridadeBadge = (severidade: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      baixa: {
        className: "bg-green-100 text-green-700 border-green-200",
        label: "Baixa",
      },
      media: {
        className: "bg-yellow-100 text-yellow-700 border-yellow-200",
        label: "Média",
      },
      alta: {
        className: "bg-orange-100 text-orange-700 border-orange-200",
        label: "Alta",
      },
      critica: {
        className: "bg-red-100 text-red-700 border-red-200",
        label: "Crítica",
      },
    };
    const variant = variants[severidade] || variants.baixa;
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { className: string; icon: JSX.Element; label: string }
    > = {
      aberto: {
        className: "bg-red-100 text-red-700 border-red-200",
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: "Aberto",
      },
      reconhecido: {
        className: "bg-yellow-100 text-yellow-700 border-yellow-200",
        icon: <Eye className="h-3 w-3 mr-1" />,
        label: "Reconhecido",
      },
      resolvido: {
        className: "bg-green-100 text-green-700 border-green-200",
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
        label: "Resolvido",
      },
    };
    const variant = variants[status] || variants.aberto;
    return (
      <Badge variant="outline" className={variant.className}>
        <div className="flex items-center">
          {variant.icon}
          {variant.label}
        </div>
      </Badge>
    );
  };

  const handleVerDetalhes = (evento: Evento) => {
    setEventoSelecionado(evento);
    setShowDetalhes(true);
  };

  const handleReconhecer = (ids: string[]) => {
    setEventos(
      eventos.map((evento) =>
        ids.includes(evento.id) && evento.status === "aberto"
          ? { ...evento, status: "reconhecido" as const }
          : evento
      )
    );
    toast({
      title: "Eventos reconhecidos",
      description: `${ids.length} evento(s) foram marcados como reconhecidos.`,
    });
    setEventosSelecionados([]);
  };

  const handleExportar = (formato: "pdf" | "excel") => {
    toast({
      title: "Exportação iniciada",
      description: `Exportando relatório em formato ${formato.toUpperCase()}...`,
    });
  };

  const toggleSelecionarEvento = (id: string) => {
    setEventosSelecionados((prev) =>
      prev.includes(id)
        ? prev.filter((eventoId) => eventoId !== id)
        : [...prev, id]
    );
  };

  const toggleSelecionarTodos = () => {
    if (eventosSelecionados.length === eventos.length) {
      setEventosSelecionados([]);
    } else {
      setEventosSelecionados(eventos.map((e) => e.id));
    }
  };

  // Filtrar eventos
  const eventosFiltrados = eventos.filter((evento) => {
    if (
      filtros.tipoEvento !== "todos" &&
      evento.tipoEvento !== filtros.tipoEvento
    )
      return false;
    if (
      filtros.severidade !== "todas" &&
      evento.severidade !== filtros.severidade
    )
      return false;
    // Adicionar lógica de filtro por data e ativo quando necessário
    return true;
  });

  return (
    <Layout>
      <div
        className={`min-h-screen transition-all duration-300 ${
          isCollapsed ? "w-full" : ""
        }`}
      >
        <div className="h-[calc(100vh-4rem)] overflow-y-auto">
          <div
            className={`flex flex-col gap-6 transition-all duration-300 ${
              isCollapsed ? "px-4 md:px-6 lg:px-8" : "px-6"
            }`}
          >
            <TitleCard title="Logs de Eventos" />

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex flex-col">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total de Eventos
                  </p>
                  <p className="text-2xl font-bold">{totalEventos}</p>
                  <p className="text-xs text-gray-500">Últimas 24 horas</p>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex flex-col">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Eventos Críticos
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {eventosCriticos}
                  </p>
                  <p className="text-xs text-gray-500">Requerem atenção</p>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex flex-col">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Eventos em Aberto
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {eventosAbertos}
                  </p>
                  <p className="text-xs text-gray-500">Aguardando ação</p>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex flex-col">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Taxa de Resolução
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {taxaResolucao}%
                  </p>
                  <p className="text-xs text-gray-500">Eventos resolvidos</p>
                </div>
              </Card>
            </div>

            {/* Filtros */}
            <Card className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros
                  </h3>
                  <Button variant="outline" size="sm">
                    Limpar Filtros
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="lg:col-span-full">
                    <DateTimeRangePicker
                      startDate={
                        filtros.dataInicial
                          ? parse(filtros.dataInicial, "yyyy-MM-dd'T'HH:mm", new Date())
                          : undefined
                      }
                      endDate={
                        filtros.dataFinal
                          ? parse(filtros.dataFinal, "yyyy-MM-dd'T'HH:mm", new Date())
                          : undefined
                      }
                      onStartDateChange={(date) =>
                        setFiltros({
                          ...filtros,
                          dataInicial: date ? format(date, "yyyy-MM-dd'T'HH:mm") : "",
                        })
                      }
                      onEndDateChange={(date) =>
                        setFiltros({
                          ...filtros,
                          dataFinal: date ? format(date, "yyyy-MM-dd'T'HH:mm") : "",
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                  <div className="space-y-2">
                    <Label htmlFor="tipoEvento">Tipo de Evento</Label>
                    <Select
                      value={filtros.tipoEvento}
                      onValueChange={(value) =>
                        setFiltros({ ...filtros, tipoEvento: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="trip">Trip</SelectItem>
                        <SelectItem value="alarme">Alarme</SelectItem>
                        <SelectItem value="urgencia">Urgência</SelectItem>
                        <SelectItem value="manutencao">Manutenção</SelectItem>
                        <SelectItem value="sistema">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ativo">Ativo</Label>
                    <Select
                      value={filtros.ativo}
                      onValueChange={(value) =>
                        setFiltros({ ...filtros, ativo: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ufv-sp">UFV São Paulo</SelectItem>
                        <SelectItem value="ufv-rj">
                          UFV Rio de Janeiro
                        </SelectItem>
                        <SelectItem value="ufv-mg">UFV Minas Gerais</SelectItem>
                        <SelectItem value="fabrica-abc">Fábrica ABC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="severidade">Severidade</Label>
                    <Select
                      value={filtros.severidade}
                      onValueChange={(value) =>
                        setFiltros({ ...filtros, severidade: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>

            {/* Ações e Tabela */}
            <Card className="p-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  {eventosSelecionados.length > 0 && (
                    <>
                      <span className="text-sm text-gray-500">
                        {eventosSelecionados.length} selecionado(s)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReconhecer(eventosSelecionados)}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Reconhecer em Massa
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportar("pdf")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportar("excel")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>

              {/* Tabela de Eventos */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">
                        <Checkbox
                          checked={
                            eventosSelecionados.length === eventos.length
                          }
                          onCheckedChange={toggleSelecionarTodos}
                        />
                      </th>
                      <th className="text-left py-3 px-2">Data/Hora</th>
                      <th className="text-left py-3 px-2">Ativo</th>
                      <th className="text-left py-3 px-2">Tipo</th>
                      <th className="text-left py-3 px-2">Mensagem</th>
                      <th className="text-center py-3 px-2">Severidade</th>
                      <th className="text-left py-3 px-2">Usuário</th>
                      <th className="text-center py-3 px-2">Status</th>
                      <th className="text-right py-3 px-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventosFiltrados.map((evento) => (
                      <tr
                        key={evento.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="py-3 px-2">
                          <Checkbox
                            checked={eventosSelecionados.includes(evento.id)}
                            onCheckedChange={() =>
                              toggleSelecionarEvento(evento.id)
                            }
                          />
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          {evento.dataHora}
                        </td>
                        <td className="py-3 px-2">{evento.ativo}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {getTipoEventoIcon(evento.tipoEvento)}
                            <span className="capitalize">
                              {evento.tipoEvento}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 max-w-xs truncate">
                          {evento.mensagem}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {getSeveridadeBadge(evento.severidade)}
                        </td>
                        <td className="py-3 px-2">{evento.usuario}</td>
                        <td className="py-3 px-2 text-center">
                          {getStatusBadge(evento.status)}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerDetalhes(evento)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {evento.status === "aberto" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReconhecer([evento.id])}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {!evento.osAssociada && (
                              <Button variant="ghost" size="sm">
                                <Link className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Modal de Detalhes */}
            <Dialog open={showDetalhes} onOpenChange={setShowDetalhes}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Detalhes do Evento</DialogTitle>
                </DialogHeader>
                {eventoSelecionado && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          ID do Evento
                        </p>
                        <p className="text-sm">#{eventoSelecionado.id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Data/Hora
                        </p>
                        <p className="text-sm">{eventoSelecionado.dataHora}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Ativo
                        </p>
                        <p className="text-sm">{eventoSelecionado.ativo}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Tipo de Evento
                        </p>
                        <div className="flex items-center gap-2">
                          {getTipoEventoIcon(eventoSelecionado.tipoEvento)}
                          <span className="text-sm capitalize">
                            {eventoSelecionado.tipoEvento}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Severidade
                        </p>
                        {getSeveridadeBadge(eventoSelecionado.severidade)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Status
                        </p>
                        {getStatusBadge(eventoSelecionado.status)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Mensagem
                      </p>
                      <p className="text-sm mt-1">
                        {eventoSelecionado.mensagem}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Usuário/Sistema
                      </p>
                      <p className="text-sm mt-1">
                        {eventoSelecionado.usuario}
                      </p>
                    </div>
                    {eventoSelecionado.localizacao && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Localização
                        </p>
                        <p className="text-sm mt-1">
                          {eventoSelecionado.localizacao}
                        </p>
                      </div>
                    )}
                    {eventoSelecionado.equipamento && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Equipamento
                        </p>
                        <p className="text-sm mt-1">
                          {eventoSelecionado.equipamento}
                        </p>
                      </div>
                    )}
                    {eventoSelecionado.detalhes && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Detalhes
                        </p>
                        <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                          {eventoSelecionado.detalhes}
                        </p>
                      </div>
                    )}
                    {eventoSelecionado.categoriaAuditoria && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Categoria de Auditoria
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {eventoSelecionado.categoriaAuditoria}
                        </Badge>
                      </div>
                    )}
                    {eventoSelecionado.ip && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Endereço IP
                        </p>
                        <p className="text-sm mt-1 font-mono text-gray-700 dark:text-gray-300">
                          {eventoSelecionado.ip}
                        </p>
                      </div>
                    )}
                    {eventoSelecionado.osAssociada && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          OS Associada
                        </p>
                        <p className="text-sm mt-1 text-blue-600">
                          {eventoSelecionado.osAssociada}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowDetalhes(false)}
                  >
                    Fechar
                  </Button>
                  {eventoSelecionado?.status === "aberto" && (
                    <Button
                      onClick={() => {
                        handleReconhecer([eventoSelecionado.id]);
                        setShowDetalhes(false);
                      }}
                    >
                      Marcar como Reconhecido
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Layout>
  );
}
