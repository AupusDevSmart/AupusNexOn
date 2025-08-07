// src/pages/supervisorio/sinoptico-ativo/index.tsx

import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Placeholder components - será criado em seguida
const SinopticoHeader = () => (
  <div className="bg-muted p-4 rounded">Header do Sinóptico</div>
);
const SinopticoGraficos = () => (
  <div className="bg-muted p-4 rounded h-64">Gráficos Potência/Tensão</div>
);
const SinopticoDiagrama = () => (
  <div className="bg-muted p-4 rounded h-64">Diagrama Unifilar</div>
);
const SinopticoIndicadores = () => (
  <div className="bg-muted p-4 rounded">Indicadores Rodapé</div>
);

export function SinopticoAtivoPage() {
  const { ativoId } = useParams<{ ativoId: string }>();
  const navigate = useNavigate();

  // Mock data para o ativo
  const [ativoData, setAtivoData] = useState({
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
      <Layout.Main>
        {/* Header com botão voltar */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleVoltar}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <TitleCard title={`Sinóptico - ${ativoData.nome}`} />
        </div>

        {/* Status da Rede */}
        <SinopticoHeader />

        {/* Layout Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Gráficos à Esquerda */}
          <div className="space-y-6">
            <SinopticoGraficos />
          </div>

          {/* Diagrama Unifilar à Direita */}
          <div>
            <SinopticoDiagrama />
          </div>
        </div>

        {/* Indicadores do Rodapé */}
        <div className="mt-6">
          <SinopticoIndicadores />
        </div>
      </Layout.Main>
    </Layout>
  );
}
