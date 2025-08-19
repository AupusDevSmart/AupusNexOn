import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Componente do Header com status da rede
const SinopticoHeader = () => (
  <Card className="w-full">
    <CardHeader className="w-full">
      <CardTitle className="flex items-center justify-between w-full">
        <span>Status da Rede</span>
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-4 w-4 mr-1" />
          NORMAL
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">220V</div>
          <div className="text-sm text-muted-foreground">Tensão L1</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">219V</div>
          <div className="text-sm text-muted-foreground">Tensão L2</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">221V</div>
          <div className="text-sm text-muted-foreground">Tensão L3</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">60Hz</div>
          <div className="text-sm text-muted-foreground">Frequência</div>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Componente dos Gráficos
const SinopticoGraficos = () => (
  <div className="space-y-4 w-full">
    <Card className="w-full">
      <CardHeader className="w-full">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Potência Ativa
        </CardTitle>
      </CardHeader>
      <CardContent className="w-full">
        <div className="space-y-4 w-full">
          <div className="w-full">
            <div className="flex justify-between text-sm mb-1 w-full">
              <span>L1</span>
              <span>750 kW</span>
            </div>
            <Progress value={75} className="h-2 w-full" />
          </div>
          <div className="w-full">
            <div className="flex justify-between text-sm mb-1 w-full">
              <span>L2</span>
              <span>820 kW</span>
            </div>
            <Progress value={82} className="h-2 w-full" />
          </div>
          <div className="w-full">
            <div className="flex justify-between text-sm mb-1 w-full">
              <span>L3</span>
              <span>780 kW</span>
            </div>
            <Progress value={78} className="h-2 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="w-full">
      <CardHeader className="w-full">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Corrente
        </CardTitle>
      </CardHeader>
      <CardContent className="w-full">
        <div className="grid grid-cols-3 gap-4 text-center w-full">
          <div>
            <div className="text-xl font-bold">125A</div>
            <div className="text-sm text-muted-foreground">L1</div>
          </div>
          <div>
            <div className="text-xl font-bold">130A</div>
            <div className="text-sm text-muted-foreground">L2</div>
          </div>
          <div>
            <div className="text-xl font-bold">128A</div>
            <div className="text-sm text-muted-foreground">L3</div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

// Componente do Diagrama Unifilar
const SinopticoDiagrama = () => (
  <Card className="h-full w-full">
    <CardHeader className="w-full">
      <CardTitle>Diagrama Unifilar</CardTitle>
    </CardHeader>
    <CardContent className="h-full w-full">
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 w-full">
        <div className="text-center space-y-4 w-full">
          {/* Representação visual simples */}
          <div className="flex items-center justify-center space-x-8 w-full">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs mt-1">Geração</span>
            </div>
            <div className="border-t-2 border-gray-400 w-16"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs mt-1">Medição</span>
            </div>
            <div className="border-t-2 border-gray-400 w-16"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs mt-1">Rede</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Diagrama unifilar simplificado
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Componente dos Indicadores do Rodapé
const SinopticoIndicadores = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
    <Card className="w-full">
      <CardContent className="p-4 w-full">
        <div className="flex items-center space-x-2 w-full">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">Sistema</div>
            <div className="text-sm text-muted-foreground">Normal</div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="w-full">
      <CardContent className="p-4 w-full">
        <div className="flex items-center space-x-2 w-full">
          <Zap className="h-5 w-5 text-blue-500" />
          <div>
            <div className="font-medium">2.350 kW</div>
            <div className="text-sm text-muted-foreground">Potência Total</div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="w-full">
      <CardContent className="p-4 w-full">
        <div className="flex items-center space-x-2 w-full">
          <Activity className="h-5 w-5 text-orange-500" />
          <div>
            <div className="font-medium">0.92</div>
            <div className="text-sm text-muted-foreground">
              Fator de Potência
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="w-full">
      <CardContent className="p-4 w-full">
        <div className="flex items-center space-x-2 w-full">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <div>
            <div className="font-medium">0</div>
            <div className="text-sm text-muted-foreground">Alertas</div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

export function SinopticoPage() {
  const { ativoId } = useParams<{ ativoId: string }>();
  const navigate = useNavigate();

  // Mock data para o ativo
  const [ativoData] = useState({
    id: ativoId,
    nome: "UFV Solar Goiânia",
    tipo: "Usina Fotovoltaica",
    status: "NORMAL",
    potencia: "2500 kW",
    localizacao: "Goiânia - GO",
  });

  const handleVoltar = () => {
    navigate(-1); // Volta para página anterior
  };

  return (
    <Layout>
      <Layout.Main className="w-full">
        <div className="w-full space-y-6">
          {/* Header com botão voltar */}
          <div className="flex items-center gap-4 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVoltar}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="flex-1">
              <TitleCard title={`Sinóptico - ${ativoData.nome}`} />
            </div>
          </div>

          {/* Status da Rede */}
          <SinopticoHeader />

          {/* Layout Principal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* Gráficos à Esquerda */}
            <div className="w-full">
              <SinopticoGraficos />
            </div>

            {/* Diagrama Unifilar à Direita */}
            <div className="w-full">
              <SinopticoDiagrama />
            </div>
          </div>

          {/* Indicadores do Rodapé */}
          <SinopticoIndicadores />
        </div>
      </Layout.Main>
    </Layout>
  );
}