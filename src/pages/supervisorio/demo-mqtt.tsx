import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { useState } from "react";
import { M160Modal } from "@/features/supervisorio/components/m160-modal";
import { A966Modal } from "@/features/supervisorio/components/a966-modal";
import { LandisGyrModal } from "@/features/supervisorio/components/landisgyr-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Wifi, Gauge } from "lucide-react";

export function DemoMqttPage() {
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [equipamentoSelecionado, setEquipamentoSelecionado] = useState<any>(null);

  const equipamentos = [
    {
      id: "1",
      nome: "Medidor M160-1",
      tag: "OLI/GO/CHI/CAB/M160-1",
      tipo: "M160",
      icon: Activity,
      color: "text-green-500",
      descricao: "Medidor de energia 4 quadrantes",
    },
    {
      id: "2",
      nome: "Gateway IMS A966",
      tag: "IMS/a966/state",
      tipo: "A966",
      icon: Wifi,
      color: "text-blue-500",
      descricao: "Gateway IoT de comunicação",
    },
    {
      id: "3",
      nome: "Medidor Landis Gyr",
      tag: "IMS/a966/LANDIS/state",
      tipo: "LANDIS_E750",
      icon: Gauge,
      color: "text-purple-500",
      descricao: "Medidor inteligente Landis+Gyr E750",
    },
  ];

  const abrirModal = (equipamento: any) => {
    setEquipamentoSelecionado(equipamento);
    setModalAberto(equipamento.tipo);
  };

  const fecharModal = () => {
    setModalAberto(null);
    setEquipamentoSelecionado(null);
  };

  return (
    <Layout
      title="Demo MQTT - Dados em Tempo Real"
      breadcrumbs={[{ label: "Supervisório" }, { label: "Demo MQTT" }]}
    >
      <div className="space-y-6">
        <TitleCard
          title="🔌 Demonstração MQTT WebSocket"
          subtitle="Clique em cada equipamento para ver os dados MQTT em tempo real"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {equipamentos.map((equipamento) => {
            const Icon = equipamento.icon;
            return (
              <Card
                key={equipamento.id}
                className="hover:shadow-lg transition-all cursor-pointer group hover:border-primary"
                onClick={() => abrirModal(equipamento)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-primary/10 ${equipamento.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {equipamento.nome}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          {equipamento.descricao}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Tópico MQTT */}
                  <div className="bg-muted/50 rounded-md p-2">
                    <p className="text-xs text-muted-foreground mb-1">Tópico MQTT:</p>
                    <code className="text-xs font-mono break-all">{equipamento.tag}</code>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/50">
                      🟢 Tempo Real
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirModal(equipamento);
                      }}
                    >
                      Ver Dados →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Card */}
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-2xl">ℹ️</span>
              Como funciona
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>✅ Conexão WebSocket em tempo real com o broker MQTT</p>
            <p>✅ Dados atualizados instantaneamente quando chegam novas mensagens</p>
            <p>✅ Reconexão automática em caso de queda</p>
            <p>✅ Indicadores visuais de status de conexão</p>
            <p className="pt-2 text-xs text-muted-foreground">
              <strong>Endpoint WebSocket:</strong> ws://localhost:3000/mqtt
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modais */}
      {modalAberto === "M160" && (
        <M160Modal
          isOpen={true}
          onClose={fecharModal}
          componenteData={equipamentoSelecionado}
        />
      )}

      <A966Modal
        open={modalAberto === "A966"}
        onClose={fecharModal}
        componenteData={equipamentoSelecionado}
      />

      <LandisGyrModal
        open={modalAberto === "LANDIS_E750"}
        onClose={fecharModal}
        componenteData={equipamentoSelecionado}
      />
    </Layout>
  );
}

export default DemoMqttPage;
