import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Componentes implementados
import { DisjuntorModal } from "@/features/supervisorio/components/disjuntor-modal";
import { InversorModal } from "@/features/supervisorio/components/inversor-modal";
import { MedidorModal } from "@/features/supervisorio/components/medidor-modal";
import { SinopticoDiagrama } from "@/features/supervisorio/components/sinoptico-diagrama";
import { SinopticoGraficos } from "@/features/supervisorio/components/sinoptico-graficos";
// REMOVIDO: import { SinopticoHeader } from "@/features/supervisorio/components/sinoptico-header";
import { SinopticoIndicadores } from "@/features/supervisorio/components/sinoptico-indicadores";
import { TransformadorModal } from "@/features/supervisorio/components/transformador-modal";
// Adicione estas importações após as outras

// Tipos
import type {
  AtivoData,
  ComponenteDU,
  DadosDisjuntor,
  DadosGrafico,
  DadosInversor,
  DadosMedidor,
  DadosTransformador,
  IndicadoresRodape,
  StatusRede,
} from "@/types/dtos/sinoptico-ativo";

export function SinopticoAtivoPage() {
  const { ativoId } = useParams<{ ativoId: string }>();
  const navigate = useNavigate();

  // Estados para modais
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [componenteSelecionado, setComponenteSelecionado] =
    useState<ComponenteDU | null>(null);

  // Mock data para o ativo
  const [ativoData] = useState<AtivoData>({
    id: ativoId || "1",
    nome: "UFV Solar Goiânia",
    tipo: "UFV",
    status: "NORMAL",
    potencia: 2500000, // 2.5 MW em watts
    tensao: 220,
    corrente: 11363, // calculado para 2.5MW a 220V
    localizacao: "Goiânia - GO",
    ultimaAtualizacao: new Date().toISOString(),
  });

  const [statusRede] = useState<StatusRede>({
    status: "NORMAL",
    tensaoRede: 220.5,
    frequencia: 60.02,
  });

  // Dados dos gráficos (simulados)
  const [dadosGraficos] = useState<DadosGrafico[]>(() => {
    const agora = new Date();
    return Array.from({ length: 24 }, (_, i) => {
      const timestamp = new Date(
        agora.getTime() - (23 - i) * 60 * 60 * 1000
      ).toISOString();
      return {
        timestamp,
        potencia:
          1.8 + Math.sin((i / 24) * Math.PI * 2) * 0.7 + Math.random() * 0.2,
        tensao: 220 + Math.sin((i / 12) * Math.PI) * 3 + Math.random() * 2,
        corrente:
          8000 + Math.sin((i / 24) * Math.PI * 2) * 2000 + Math.random() * 500,
      };
    });
  });

  const [indicadores] = useState<IndicadoresRodape>({
    thd: 3.2,
    fp: 0.95,
    dt: 2.1,
    frequencia: 60.02,
    alarmes: 1,
    falhas: 0,
    urgencias: 0,
    osAbertas: 2,
  });

  const [componentes] = useState<ComponenteDU[]>([
    {
      id: "medidor-01",
      tipo: "MEDIDOR",
      nome: "Medidor Principal",
      posicao: { x: 20, y: 30 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "transformador-01",
      tipo: "TRANSFORMADOR",
      nome: "Trafo 13.8kV/380V",
      posicao: { x: 35, y: 70 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "inversor-01",
      tipo: "INVERSOR",
      nome: "Inversor Solar 1",
      posicao: { x: 50, y: 30 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "inversor-02",
      tipo: "INVERSOR",
      nome: "Inversor Solar 2",
      posicao: { x: 65, y: 70 },
      status: "ALARME",
      dados: {},
    },
    {
      id: "disjuntor-01",
      tipo: "DISJUNTOR",
      nome: "Disjuntor Principal",
      posicao: { x: 80, y: 30 },
      status: "NORMAL",
      dados: {},
    },
  ]);

  // Dados específicos para cada tipo de componente
  const dadosMedidor: DadosMedidor = {
    ufer: 0.952,
    demanda: 2485.5,
    energiaConsumida: 15847.2,
    energiaInjetada: 42156.8,
    tensaoFases: { a: 220.1, b: 219.8, c: 220.4 },
    correnteFases: { a: 3789.2, b: 3821.1, c: 3752.7 },
  };

  const dadosInversor: DadosInversor = {
    potenciaAC: 1250.5,
    potenciaDC: 1310.2,
    tensoesMPPT: [850.5, 845.2, 852.1, 848.7],
    correntePorString: [12.5, 12.3, 12.7, 12.1],
    curvaGeracao: [
      { hora: "06:00", potencia: 0 },
      { hora: "07:00", potencia: 150.5 },
      { hora: "08:00", potencia: 450.2 },
      { hora: "09:00", potencia: 750.8 },
      { hora: "10:00", potencia: 980.1 },
      { hora: "11:00", potencia: 1120.5 },
      { hora: "12:00", potencia: 1250.5 },
      { hora: "13:00", potencia: 1180.2 },
      { hora: "14:00", potencia: 1050.8 },
      { hora: "15:00", potencia: 850.3 },
      { hora: "16:00", potencia: 620.7 },
      { hora: "17:00", potencia: 320.1 },
      { hora: "18:00", potencia: 50.2 },
      { hora: "19:00", potencia: 0 },
    ],
    eficiencia: 0.954,
    temperatura: 45.2,
  };

  const dadosDisjuntor: DadosDisjuntor = {
    status: "FECHADO",
    estadoMola: "ARMADO",
    corrente: 3789.2,
    ultimaOperacao: new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    ).toISOString(),
    numeroOperacoes: 1247,
  };

  const dadosTransformador: DadosTransformador = {
    potencias: {
      ativa: 2350000, // 2.35 MW
      reativa: 450000, // 450 kVAr
      aparente: 2392500, // 2.39 MVA
    },
    tensoes: {
      primario: 13800, // 13.8 kV
      secundario: 380, // 380 V
    },
    correntes: {
      primario: 100.2,
      secundario: 3625.5,
    },
    temperatura: 65.8,
    carregamento: 85.2,
  };

  const handleVoltar = () => {
    navigate(-1);
  };

  const handleComponenteClick = (componente: ComponenteDU) => {
    setComponenteSelecionado(componente);
    setModalAberto(componente.tipo);
  };

  const fecharModal = () => {
    setModalAberto(null);
    setComponenteSelecionado(null);
  };
  // Estados para os novos modais
  const [modalIndicadorAberto, setModalIndicadorAberto] = useState<
    string | null
  >(null);

  // Dados de exemplo para os modais
  const [alarmes] = useState([
    {
      id: "alm-001",
      equipamento: "Inversor Solar 2",
      descricao: "Temperatura do inversor acima do limite normal (45°C > 40°C)",
      prioridade: "MEDIA" as const,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: "ATIVO" as const,
      responsavel: "João Silva",
      observacoes: "Verificar sistema de ventilação do inversor",
    },
  ]);

  return (
    <Layout>
      <Layout.Main>
        {/* Header com botão voltar */}
        <div className="flex items-center gap-4 m-6 max-w-full">
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

        {/* Indicadores movidos para o topo */}
        <div className="mt-6">
          <SinopticoIndicadores indicadores={indicadores} />
        </div>

        {/* REMOVIDO: Cards superiores - Status da Rede, Status do Ativo, Tensão da Rede, Potência Atual */}
        {/* <SinopticoHeader ativo={ativoData} statusRede={statusRede} /> */}

        {/* Layout Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 w-full">
          {/* Gráficos à Esquerda */}
          <div className="space-y-6 w-full">
            <SinopticoGraficos
              dadosPotencia={dadosGraficos}
              dadosTensao={dadosGraficos}
            />
          </div>

          {/* Diagrama Unifilar à Direita */}
          <div>
            <SinopticoDiagrama
              componentes={componentes}
              onComponenteClick={handleComponenteClick}
            />
          </div>
        </div>

        {/* REMOVIDO: Indicadores do rodapé - movidos para o topo */}

        {/* Modais específicos para cada tipo de componente */}
        <MedidorModal
          open={modalAberto === "MEDIDOR"}
          onClose={fecharModal}
          dados={dadosMedidor}
          nomeComponente={componenteSelecionado?.nome || ""}
        />

        <InversorModal
          open={modalAberto === "INVERSOR"}
          onClose={fecharModal}
          dados={dadosInversor}
          nomeComponente={componenteSelecionado?.nome || ""}
        />

        <DisjuntorModal
          open={modalAberto === "DISJUNTOR"}
          onClose={fecharModal}
          dados={dadosDisjuntor}
          nomeComponente={componenteSelecionado?.nome || ""}
        />

        <TransformadorModal
          open={modalAberto === "TRANSFORMADOR"}
          onClose={fecharModal}
          dados={dadosTransformador}
          nomeComponente={componenteSelecionado?.nome || ""}
        />
      </Layout.Main>
    </Layout>
  );
}
