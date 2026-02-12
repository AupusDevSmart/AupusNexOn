import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiagramV2Wrapper } from "@/features/supervisorio/v2/DiagramV2Wrapper";
import { M160Modal } from "@/features/supervisorio/components/m160-modal";
import { A966Modal } from "@/features/supervisorio/components/a966-modal";
import { LandisGyrModal } from "@/features/supervisorio/components/landisgyr-modal";
import { useState } from "react";
import { ArrowLeft, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Componentes do diagrama MQTT
const componentesMQTT = [
  {
    id: "m160-1",
    tipo: "M160",
    nome: "M160 Multimedidor",
    posicao: { x: 25, y: 30 },
    status: "NORMAL",
    tag: "OLI/GO/CHI/CAB/M160-1",
    dados: {}
  },
  {
    id: "a966-1",
    tipo: "A966",
    nome: "A966 Gateway IoT",
    posicao: { x: 50, y: 30 },
    status: "NORMAL",
    tag: "IMS/a966/state",
    dados: {}
  },
  {
    id: "landis-1",
    tipo: "LANDIS_E750",
    nome: "Landis+Gyr E750",
    posicao: { x: 75, y: 30 },
    status: "NORMAL",
    tag: "IMS/a966/LANDIS/state",
    dados: {}
  },
];

export default function DiagramaMQTT() {
  const navigate = useNavigate();
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [componenteSelecionado, setComponenteSelecionado] = useState<any>(null);

  const handleComponenteClick = (componente: any) => {
    setComponenteSelecionado(componente);
    setModalAberto(componente.id);
  };

  const fecharModal = () => {
    setModalAberto(null);
    setComponenteSelecionado(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/supervisorio")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <TitleCard
              title="Diagrama MQTT - Equipamentos em Tempo Real"
              subtitle="Monitoramento dos equipamentos conectados via MQTT"
              icon={<Wifi className="h-6 w-6" />}
            />
          </div>
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/50">
            <Wifi className="h-3 w-3 mr-1" />
            MQTT Ativo
          </Badge>
        </div>

        {/* Legenda */}
        <Card className="p-4">
          <div className="flex items-center gap-6">
            <div className="text-sm font-medium">Equipamentos:</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs">M160 - Multimedidor 4Q</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs">A966 - Gateway IoT</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs">Landis+Gyr E750 - Medidor Industrial</span>
            </div>
          </div>
        </Card>

        {/* Diagrama V2 - Novo Sistema */}
        <Card className="p-6">
          <div className="bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20 min-h-[600px] relative">
            <DiagramV2Wrapper
              componentes={componentesMQTT}
              onComponenteClick={handleComponenteClick}
              mostrarGrid={true}
              modoEdicao={false}
            />
          </div>
        </Card>

        {/* Instruções */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="text-sm">
            <p className="font-semibold mb-2">💡 Como usar:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Clique em qualquer equipamento para abrir o modal com dados em tempo real</li>
              <li>Os dados são atualizados automaticamente via WebSocket MQTT</li>
              <li>Navegue entre as telas dos equipamentos usando as setas ◀ ▶</li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Modais */}
      {modalAberto === "m160-1" && (
        <M160Modal
          isOpen={true}
          onClose={fecharModal}
          componenteData={componenteSelecionado}
        />
      )}

      {modalAberto === "a966-1" && (
        <A966Modal
          open={true}
          onClose={fecharModal}
          componenteData={componenteSelecionado}
          nomeComponente={componenteSelecionado?.nome}
        />
      )}

      {modalAberto === "landis-1" && (
        <LandisGyrModal
          open={true}
          onClose={fecharModal}
          componenteData={componenteSelecionado}
          nomeComponente={componenteSelecionado?.nome}
        />
      )}
    </Layout>
  );
}
