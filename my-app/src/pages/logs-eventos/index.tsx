// src/pages/logs-eventos/index.tsx

import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
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
      `Funcionalidade "Associar OS" para o evento ${evento.id} será implementada em breve!`
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
    alert("Funcionalidade de exportação para PDF será implementada em breve!");
  };

  const handleExportarExcel = () => {
    console.log("Exportar para Excel");
    // Implementar exportação Excel
    alert(
      "Funcionalidade de exportação para Excel será implementada em breve!"
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Título e botões de ação */}
        <div className="flex items-center justify-between">
          <TitleCard title="Logs de Eventos" />
          <div className="flex gap-2">
            <Button onClick={handleExportarPDF} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button onClick={handleExportarExcel} variant="outline" size="sm">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* Resumo - agora no topo */}
        <LogsEventosSummary resumo={resumo} />

        {/* Filtros compactos */}
        <LogsEventosFilters
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ativos={mockAtivos}
          onLimparFiltros={handleLimparFiltros}
          onAplicarFiltros={() => console.log("Filtros aplicados:", filtros)}
        />

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

        {/* Modal de detalhes */}
        <EventoDetalhesModal
          evento={eventoDetalhes}
          open={modalDetalhesOpen}
          onClose={() => setModalDetalhesOpen(false)}
          onAssociarOS={handleAssociarOS}
          onMarcarReconhecido={handleMarcarReconhecido}
        />
      </div>
    </Layout>
  );
}
