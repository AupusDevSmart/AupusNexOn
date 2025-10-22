// src/pages/logs-eventos/index.tsx

import { Layout } from "@/components/common/Layout";
import { Button } from "@/components/ui/button";
import { EventoDetalhesModal } from "@/features/supervisorio/components/evento-detalhes-modal";
import { LogsEventosFilters } from "@/features/supervisorio/components/logs-eventos-filters";
import { LogsEventosSummary } from "@/features/supervisorio/components/logs-eventos-summary";
import { LogsEventosTable } from "@/features/supervisorio/components/logs-eventos-table";
import type {
  AtivoOption,
  FiltrosLogsEventos,
  LogEvento,
  ResumoEventos,
} from "@/types/dtos/logs-eventos";
import { Download, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";

// Dados mockados para demonstração
const mockEventos: LogEvento[] = [
  {
    id: "EVT001",
    dataHora: "2025-01-15T14:30:00",
    ativo: "UFV Solar Goiânia",
    tipoEvento: "ALARME",
    mensagem: "Tensão da string 1 abaixo do limite mínimo",
    severidade: "MEDIA",
    usuario: "Sistema",
    reconhecido: false,
    localizacao: "Goiânia - GO",
    equipamento: "Inversor INV-001",
    detalhes:
      "Tensão medida: 280V. Limite mínimo: 300V. Possível sombreamento ou falha no painel.",
  },
  {
    id: "EVT002",
    dataHora: "2025-01-15T13:45:00",
    ativo: "Carga Industrial Anápolis",
    tipoEvento: "TRIP",
    mensagem: "Disjuntor principal desarmado por sobrecorrente",
    severidade: "CRITICA",
    usuario: "ops.supervisor",
    reconhecido: true,
    osAssociada: "OS2025001",
    localizacao: "Anápolis - GO",
    equipamento: "Disjuntor DJ-001",
    detalhes:
      "Corrente medida: 850A. Limite máximo: 800A. Acionamento de proteção por sobrecarga.",
  },
  {
    id: "EVT003",
    dataHora: "2025-01-15T12:20:00",
    ativo: "Motor Bomba Caldas Novas",
    tipoEvento: "URGENCIA",
    mensagem: "Temperatura do motor acima do limite crítico",
    severidade: "ALTA",
    usuario: "manutencao.tecnico",
    reconhecido: false,
    localizacao: "Caldas Novas - GO",
    equipamento: "Motor MOT-003",
    detalhes:
      "Temperatura medida: 95°C. Limite crítico: 85°C. Recomendada parada imediata para inspeção.",
  },
  {
    id: "EVT004",
    dataHora: "2025-01-15T11:15:00",
    ativo: "Transformador Brasília",
    tipoEvento: "INFORMATIVO",
    mensagem: "Manutenção preventiva programada concluída",
    severidade: "BAIXA",
    usuario: "manutencao.equipe",
    reconhecido: true,
    osAssociada: "OS2025002",
    localizacao: "Brasília - DF",
    equipamento: "Transformador TR-001",
    detalhes:
      "Manutenção preventiva realizada conforme cronograma. Todos os testes aprovados.",
  },
  {
    id: "EVT005",
    dataHora: "2025-01-15T10:30:00",
    ativo: "UFV Solar Goiânia",
    tipoEvento: "MANUTENCAO",
    mensagem: "Limpeza de painéis solares iniciada",
    severidade: "BAIXA",
    usuario: "manutencao.limpeza",
    reconhecido: true,
    localizacao: "Goiânia - GO",
    equipamento: "Painéis PV-001 a PV-050",
    detalhes:
      "Limpeza programada dos painéis solares do setor A. Estimativa de conclusão: 4 horas.",
  },
  // Eventos de Auditoria
  {
    id: "EVT009",
    dataHora: "2025-01-15T14:25:00",
    ativo: "Sistema NexON",
    tipoEvento: "INFORMATIVO",
    mensagem: "Usuário realizou login no sistema",
    severidade: "BAIXA",
    usuario: "ops.supervisor",
    reconhecido: true,
    localizacao: "Centro de Controle - Goiânia",
    detalhes:
      "Login realizado com sucesso. IP: 192.168.1.45. Navegador: Chrome 120.0. Horário: 14:25:00.",
    categoriaAuditoria: "LOGIN",
    ip: "192.168.1.45",
  },
  {
    id: "EVT010",
    dataHora: "2025-01-15T13:50:00",
    ativo: "Carga Industrial Anápolis",
    tipoEvento: "INFORMATIVO",
    mensagem: "Disjuntor DJ-001 desligado manualmente",
    severidade: "MEDIA",
    usuario: "ops.supervisor",
    reconhecido: true,
    localizacao: "Anápolis - GO",
    equipamento: "Disjuntor DJ-001",
    detalhes:
      "Comando de abertura executado pelo usuário ops.supervisor às 13:50:00. Motivo: Manutenção preventiva programada. Estado anterior: Ligado. Estado atual: Desligado.",
    categoriaAuditoria: "COMANDO",
  },
  {
    id: "EVT011",
    dataHora: "2025-01-15T13:15:00",
    ativo: "UFV Solar Goiânia",
    tipoEvento: "INFORMATIVO",
    mensagem: "Diagrama unifilar alterado",
    severidade: "MEDIA",
    usuario: "engenharia.joao",
    reconhecido: true,
    localizacao: "Goiânia - GO",
    detalhes:
      "Modificações realizadas no diagrama unifilar da UFV Solar Goiânia. Alterações: Adicionado novo transformador TR-003, atualizado posicionamento de inversores INV-004 a INV-006. Versão anterior: v2.3. Nova versão: v2.4. Aprovação: Pendente.",
    categoriaAuditoria: "DIAGRAMA",
  },
  {
    id: "EVT012",
    dataHora: "2025-01-15T12:40:00",
    ativo: "Sistema NexON",
    tipoEvento: "INFORMATIVO",
    mensagem: "Configuração de alarmes modificada",
    severidade: "MEDIA",
    usuario: "admin.sistema",
    reconhecido: true,
    localizacao: "Centro de Controle - Goiânia",
    detalhes:
      "Parâmetros de alarme atualizados. Ativo: Carga Industrial Anápolis. Alterações: Limite de tensão máxima alterado de 240V para 245V, timeout de reconhecimento alterado de 30min para 45min. Justificativa: Ajuste conforme características da carga.",
    categoriaAuditoria: "CONFIGURACAO",
  },
  {
    id: "EVT013",
    dataHora: "2025-01-15T11:50:00",
    ativo: "Transformador Brasília",
    tipoEvento: "INFORMATIVO",
    mensagem: "Setpoint de temperatura ajustado",
    severidade: "BAIXA",
    usuario: "ops.supervisor",
    reconhecido: true,
    localizacao: "Brasília - DF",
    equipamento: "Transformador TR-001",
    detalhes:
      "Setpoint de temperatura do transformador TR-001 ajustado remotamente. Valor anterior: 75°C. Novo valor: 70°C. Temperatura atual: 65°C. Comando executado via interface web.",
    categoriaAuditoria: "COMANDO",
  },
  {
    id: "EVT014",
    dataHora: "2025-01-15T11:20:00",
    ativo: "Sistema NexON",
    tipoEvento: "INFORMATIVO",
    mensagem: "Relatório mensal gerado",
    severidade: "BAIXA",
    usuario: "Sistema",
    reconhecido: true,
    localizacao: "Sistema",
    detalhes:
      "Relatório automático mensal de desempenho gerado com sucesso. Período: 01/12/2024 a 31/12/2024. Ativos incluídos: Todos. Formato: PDF. Tamanho: 2.4MB. Destinatários: 5 usuários notificados.",
    categoriaAuditoria: "RELATORIO",
  },
  {
    id: "EVT015",
    dataHora: "2025-01-15T10:45:00",
    ativo: "Motor Bomba Caldas Novas",
    tipoEvento: "INFORMATIVO",
    mensagem: "Banco de capacitores acionado manualmente",
    severidade: "BAIXA",
    usuario: "ops.eletricista",
    reconhecido: true,
    localizacao: "Caldas Novas - GO",
    equipamento: "Banco de Capacitores BC-001",
    detalhes:
      "Banco de capacitores BC-001 acionado para correção de fator de potência. FP antes: 0.87. FP esperado: 0.95. Comando executado por ops.eletricista via painel local.",
    categoriaAuditoria: "COMANDO",
  },
  {
    id: "EVT016",
    dataHora: "2025-01-15T10:10:00",
    ativo: "Sistema NexON",
    tipoEvento: "INFORMATIVO",
    mensagem: "Novo usuário cadastrado no sistema",
    severidade: "BAIXA",
    usuario: "admin.sistema",
    reconhecido: true,
    localizacao: "Sistema",
    detalhes:
      "Novo usuário criado: manutencao.carlos. Perfil: Técnico de Manutenção. Permissões: Leitura de todos os ativos, escrita em ordens de serviço. Status: Ativo. Criado por: admin.sistema.",
    categoriaAuditoria: "USUARIO",
  },
  {
    id: "EVT017",
    dataHora: "2025-01-15T09:35:00",
    ativo: "UFV Solar Goiânia",
    tipoEvento: "INFORMATIVO",
    mensagem: "Inversor reiniciado remotamente",
    severidade: "BAIXA",
    usuario: "ops.supervisor",
    reconhecido: true,
    localizacao: "Goiânia - GO",
    equipamento: "Inversor INV-002",
    detalhes:
      "Comando de reset executado no inversor INV-002. Motivo: Limpeza de erro intermitente. Downtime: 45 segundos. Produção retomada normalmente às 09:36.",
    categoriaAuditoria: "COMANDO",
  },
  {
    id: "EVT018",
    dataHora: "2025-01-15T09:00:00",
    ativo: "Sistema NexON",
    tipoEvento: "INFORMATIVO",
    mensagem: "Backup automático do sistema concluído",
    severidade: "BAIXA",
    usuario: "Sistema",
    reconhecido: true,
    localizacao: "Sistema",
    detalhes:
      "Backup automático diário concluído com sucesso. Dados incluídos: Configurações, logs, históricos de medições. Tamanho total: 1.2GB. Armazenamento: Cloud Storage. Tempo de execução: 8 minutos.",
    categoriaAuditoria: "SISTEMA",
  },
  {
    id: "EVT019",
    dataHora: "2025-01-15T08:30:00",
    ativo: "Carga Industrial Anápolis",
    tipoEvento: "INFORMATIVO",
    mensagem: "Modo de operação alterado",
    severidade: "MEDIA",
    usuario: "ops.supervisor",
    reconhecido: true,
    localizacao: "Anápolis - GO",
    detalhes:
      "Modo de operação alterado de 'Automático' para 'Manual'. Justificativa: Testes de performance programados. Duração prevista: 2 horas. Alterado por: ops.supervisor às 08:30.",
    categoriaAuditoria: "CONFIGURACAO",
  },
  {
    id: "EVT020",
    dataHora: "2025-01-15T08:00:00",
    ativo: "Sistema NexON",
    tipoEvento: "INFORMATIVO",
    mensagem: "Usuário realizou logout do sistema",
    severidade: "BAIXA",
    usuario: "ops.turno.noite",
    reconhecido: true,
    localizacao: "Centro de Controle - Goiânia",
    detalhes:
      "Logout realizado. Duração da sessão: 8h 15min. Ações realizadas: 23 comandos executados, 15 eventos reconhecidos. IP: 192.168.1.42.",
    categoriaAuditoria: "LOGOUT",
    ip: "192.168.1.42",
  },
];

const mockAtivos: AtivoOption[] = [
  { value: "ufv-goiania", label: "UFV Solar Goiânia" },
  { value: "carga-anapolis", label: "Carga Industrial Anápolis" },
  { value: "motor-caldas", label: "Motor Bomba Caldas Novas" },
  { value: "trafo-brasilia", label: "Transformador Brasília" },
];

export function LogsEventosPage() {
  const [filtros, setFiltros] = useState<FiltrosLogsEventos>({
    dataInicial: new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16),
    dataFinal: new Date().toISOString().slice(0, 16),
    tipoEvento: "all",
    ativo: "all",
    severidade: "all",
    reconhecido: null,
    categoriaAuditoria: "all",
  });

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [eventoDetalhes, setEventoDetalhes] = useState<LogEvento | null>(null);
  const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false);

  // Filtrar eventos baseado nos filtros
  const eventosFiltrados = useMemo(() => {
    return mockEventos.filter((evento) => {
      // Filtro por tipo de evento
      if (
        filtros.tipoEvento !== "all" &&
        evento.tipoEvento !== filtros.tipoEvento
      ) {
        return false;
      }

      // Filtro por ativo
      if (
        filtros.ativo !== "all" &&
        !evento.ativo.toLowerCase().includes(filtros.ativo.toLowerCase())
      ) {
        return false;
      }

      // Filtro por severidade
      if (
        filtros.severidade !== "all" &&
        evento.severidade !== filtros.severidade
      ) {
        return false;
      }

      // Filtro por reconhecimento
      if (
        filtros.reconhecido !== null &&
        evento.reconhecido !== filtros.reconhecido
      ) {
        return false;
      }

      // Filtro por categoria de auditoria
      if (
        filtros.categoriaAuditoria &&
        filtros.categoriaAuditoria !== "all" &&
        evento.categoriaAuditoria !== filtros.categoriaAuditoria
      ) {
        return false;
      }

      return true;
    });
  }, [filtros]);

  // Calcular resumo
  const resumo: ResumoEventos = useMemo(() => {
    return {
      totalEventos: eventosFiltrados.length,
      eventosCriticos: eventosFiltrados.filter(
        (e) => e.severidade === "CRITICA"
      ).length,
      eventosEmAberto: eventosFiltrados.filter((e) => !e.reconhecido).length,
      eventosReconhecidos: eventosFiltrados.filter((e) => e.reconhecido).length,
    };
  }, [eventosFiltrados]);

  const handleLimparFiltros = () => {
    setFiltros({
      dataInicial: new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16),
      dataFinal: new Date().toISOString().slice(0, 16),
      tipoEvento: "all",
      ativo: "all",
      severidade: "all",
      reconhecido: null,
      categoriaAuditoria: "all",
    });
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedItems(checked ? eventosFiltrados.map((e) => e.id) : []);
  };

  const handleVerDetalhes = (evento: LogEvento) => {
    setEventoDetalhes(evento);
    setModalDetalhesOpen(true);
  };

  const handleAssociarOS = (evento: LogEvento) => {
    console.log("Associar OS para evento:", evento.id);
    // Implementar lógica para associar OS
    alert(
      `Funcionalidade "Associar OS" para o evento ${evento.id} precisa ser implementada!`
    );
  };

  const handleMarcarReconhecido = (evento: LogEvento) => {
    console.log("Marcar como reconhecido:", evento.id);
    // Implementar lógica para marcar como reconhecido
    alert(`Evento ${evento.id} marcado como reconhecido!`);
  };

  const handleReconhecimentoMassa = (ids: string[]) => {
    console.log("Reconhecimento em massa:", ids);
    // Implementar lógica para reconhecimento em massa
    alert(
      `${ids.length} eventos selecionados serão marcados como reconhecidos!`
    );
    setSelectedItems([]);
  };

  const handleExportarPDF = () => {
    console.log("Exportar para PDF");
    // Implementar exportação PDF
    alert("Funcionalidade de exportação para PDF precisa ser implementada!");
  };

  const handleExportarExcel = () => {
    console.log("Exportar para Excel");
    // Implementar exportação Excel
    alert(
      "Funcionalidade de exportação para Excel precisa ser implementada!"
    );
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="min-h-screen w-full">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex flex-col gap-3 p-2">
              {/* Título */}
              <div className="w-full">
                <h1 className="text-2xl font-bold text-foreground">
                  Logs de Eventos
                </h1>
              </div>

              {/* Resumo - Cards de Indicadores */}
              <LogsEventosSummary resumo={resumo} />

              {/* Filtros compactos */}
              <LogsEventosFilters
                filtros={filtros}
                onFiltrosChange={setFiltros}
                ativos={mockAtivos}
                onLimparFiltros={handleLimparFiltros}
                onAplicarFiltros={() =>
                  console.log("Filtros aplicados:", filtros)
                }
              />

              {/* Ações */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {eventosFiltrados.length} eventos encontrados
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleExportarPDF}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </Button>
                  <Button
                    onClick={handleExportarExcel}
                    variant="outline"
                    size="sm"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar Excel
                  </Button>
                </div>
              </div>

              {/* Tabela de eventos */}
              <LogsEventosTable
                eventos={eventosFiltrados}
                selectedItems={selectedItems}
                onSelectItem={handleSelectItem}
                onSelectAll={handleSelectAll}
                onVerDetalhes={handleVerDetalhes}
                onAssociarOS={handleAssociarOS}
                onMarcarReconhecido={handleMarcarReconhecido}
                onReconhecimentoMassa={handleReconhecimentoMassa}
              />
            </div>
          </div>
        </div>

        {/* Modal de detalhes */}
        <EventoDetalhesModal
          evento={eventoDetalhes}
          open={modalDetalhesOpen}
          onClose={() => setModalDetalhesOpen(false)}
          onAssociarOS={handleAssociarOS}
          onMarcarReconhecido={handleMarcarReconhecido}
        />
      </Layout.Main>
    </Layout>
  );
}
