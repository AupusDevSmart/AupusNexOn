import { Layout } from "@/components/common/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Activity,
  ArrowLeft,
  Circle,
  Copy,
  Edit3,
  Grid3x3,
  Move,
  Redo,
  Save,
  Square,
  Trash2,
  Triangle,
  Undo,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Componentes implementados
import { DisjuntorModal } from "@/features/supervisorio/components/disjuntor-modal";
import { InversorModal } from "@/features/supervisorio/components/inversor-modal";
import { MedidorModal } from "@/features/supervisorio/components/medidor-modal";
import { SinopticoDiagrama } from "@/features/supervisorio/components/sinoptico-diagrama";
import { SinopticoGraficos } from "@/features/supervisorio/components/sinoptico-graficos";
import { SinopticoIndicadores } from "@/features/supervisorio/components/sinoptico-indicadores";
import { TransformadorModal } from "@/features/supervisorio/components/transformador-modal";

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

// Tipos de componentes disponíveis para adicionar
const TIPOS_COMPONENTES = [
  { tipo: "MEDIDOR", icon: Activity, label: "Medidor", cor: "bg-blue-500" },
  {
    tipo: "TRANSFORMADOR",
    icon: Square,
    label: "Transformador",
    cor: "bg-green-500",
  },
  { tipo: "INVERSOR", icon: Zap, label: "Inversor", cor: "bg-yellow-500" },
  { tipo: "DISJUNTOR", icon: Square, label: "Disjuntor", cor: "bg-red-500" },
  { tipo: "MOTOR", icon: Circle, label: "Motor", cor: "bg-purple-500" },
  {
    tipo: "CAPACITOR",
    icon: Triangle,
    label: "Capacitor",
    cor: "bg-indigo-500",
  },
];

export function SinopticoAtivoPage() {
  const { ativoId } = useParams<{ ativoId: string }>();
  const navigate = useNavigate();

  // Estados para modais
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [componenteSelecionado, setComponenteSelecionado] =
    useState<ComponenteDU | null>(null);

  // NOVO: Estados para o modo de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [modoFerramenta, setModoFerramenta] = useState<
    "selecionar" | "desenhar" | "conectar"
  >("selecionar");
  const [tipoComponenteSelecionado, setTipoComponenteSelecionado] =
    useState("MEDIDOR");
  const [mostrarGrid, setMostrarGrid] = useState(true);
  const [componenteEditando, setComponenteEditando] = useState<string | null>(
    null
  );

  // Mock data para o ativo
  const [ativoData] = useState<AtivoData>({
    id: ativoId || "1",
    nome: "UFV Solar Goiânia",
    tipo: "UFV",
    status: "NORMAL",
    potencia: 2500000,
    tensao: 220,
    corrente: 11363,
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

  // MODIFICADO: componentes agora podem ser editados
  const [componentes, setComponentes] = useState<ComponenteDU[]>([
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
      ativa: 2350000,
      reativa: 450000,
      aparente: 2392500,
    },
    tensoes: {
      primario: 13800,
      secundario: 380,
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
    if (modoEdicao) {
      setComponenteEditando(componente.id);
      return;
    }
    setComponenteSelecionado(componente);
    setModalAberto(componente.tipo);
  };

  const fecharModal = () => {
    setModalAberto(null);
    setComponenteSelecionado(null);
  };

  // NOVAS: Funções para o modo de edição
  const toggleModoEdicao = () => {
    setModoEdicao(!modoEdicao);
    if (modoEdicao) {
      setComponenteEditando(null);
      setModoFerramenta("selecionar");
    }
  };

  const adicionarComponente = (tipo: string) => {
    const novoId = `${tipo.toLowerCase()}-${Date.now()}`;
    const novoComponente: ComponenteDU = {
      id: novoId,
      tipo: tipo,
      nome: `${tipo} ${componentes.length + 1}`,
      posicao: { x: 40, y: 40 },
      status: "NORMAL",
      dados: {},
    };
    setComponentes([...componentes, novoComponente]);
  };

  const removerComponente = (id: string) => {
    setComponentes(componentes.filter((c) => c.id !== id));
    setComponenteEditando(null);
  };

  const duplicarComponente = (id: string) => {
    const componenteOriginal = componentes.find((c) => c.id === id);
    if (componenteOriginal) {
      const novoComponente: ComponenteDU = {
        ...componenteOriginal,
        id: `${componenteOriginal.tipo.toLowerCase()}-${Date.now()}`,
        nome: `${componenteOriginal.nome} (Cópia)`,
        posicao: {
          x: componenteOriginal.posicao.x + 5,
          y: componenteOriginal.posicao.y + 5,
        },
      };
      setComponentes([...componentes, novoComponente]);
    }
  };

  const salvarDiagrama = () => {
    console.log("Salvando diagrama...", componentes);
    alert("Diagrama salvo com sucesso!");
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
        {/* Container principal com espaçamento do COA */}
        <div className="flex flex-col gap-3 p-3">
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
            <h1 className="text-2xl font-bold text-foreground">
              Sinóptico - {ativoData.nome}
            </h1>
          </div>

          {/* Indicadores */}
          <SinopticoIndicadores indicadores={indicadores} />

          {/* Barra de Ferramentas (só no modo edição) - MOVIDA para depois dos indicadores */}
          {modoEdicao && (
            <div className="mb-6">
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Modos de Ferramenta */}
                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Modo:</span>
                    <div className="flex gap-1">
                      <Button
                        variant={
                          modoFerramenta === "selecionar"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => setModoFerramenta("selecionar")}
                        className="flex items-center gap-1"
                      >
                        <Move className="h-4 w-4" />
                        Selecionar
                      </Button>
                      <Button
                        variant={
                          modoFerramenta === "desenhar" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setModoFerramenta("desenhar")}
                        className="flex items-center gap-1"
                      >
                        <Square className="h-4 w-4" />
                        Desenhar
                      </Button>
                    </div>
                  </div>

                  {/* Biblioteca de Componentes */}
                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Adicionar:</span>
                    <div className="flex gap-1 flex-wrap">
                      {TIPOS_COMPONENTES.map(
                        ({ tipo, icon: Icon, label, cor }) => (
                          <Button
                            key={tipo}
                            variant="outline"
                            size="sm"
                            onClick={() => adicionarComponente(tipo)}
                            className="flex items-center gap-1 h-8"
                            title={`Adicionar ${label}`}
                          >
                            <Icon className="h-3 w-3" />
                            {label}
                          </Button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Ações:</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled>
                        <Undo className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <Redo className="h-4 w-4" />
                      </Button>
                      {componenteEditando && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              duplicarComponente(componenteEditando)
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              removerComponente(componenteEditando)
                            }
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Visualização */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Visualização:</span>
                    <Button
                      variant={mostrarGrid ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMostrarGrid(!mostrarGrid)}
                      className="flex items-center gap-1"
                    >
                      <Grid3x3 className="h-4 w-4" />
                      Grid
                    </Button>
                  </div>
                </div>

                {/* Informações do componente selecionado */}
                {componenteEditando && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="mr-2">
                          {
                            componentes.find((c) => c.id === componenteEditando)
                              ?.tipo
                          }
                        </Badge>
                        <span className="text-sm font-medium">
                          {
                            componentes.find((c) => c.id === componenteEditando)
                              ?.nome
                          }
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setComponenteEditando(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Layout Principal */}
          <div
            className={`grid grid-cols-1 ${
              modoEdicao ? "lg:grid-cols-1" : "lg:grid-cols-2"
            } gap-6 w-full`}
          >
            {/* Gráficos à Esquerda (ocultos no modo edição para dar mais espaço) */}
            {!modoEdicao && (
              <div className="space-y-6 w-full">
                <SinopticoGraficos
                  dadosPotencia={dadosGraficos}
                  dadosTensao={dadosGraficos}
                />
              </div>
            )}

            {/* Diagrama Unifilar */}
            <div className={modoEdicao ? "col-span-1" : ""}>
              <Card className="h-full flex flex-col">
                {/* Header do Diagrama com Botão Editar */}
                <div className="flex items-center justify-between p-4 pb-2 border-b flex-shrink-0">
                  <h3 className="text-lg font-semibold text-foreground">
                    Diagrama Unifilar
                  </h3>
                  <div className="flex items-center gap-2">
                    {modoEdicao && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={salvarDiagrama}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Salvar
                      </Button>
                    )}
                    <Button
                      variant={modoEdicao ? "default" : "outline"}
                      size="sm"
                      onClick={toggleModoEdicao}
                      className="flex items-center gap-2"
                    >
                      {modoEdicao ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Edit3 className="h-4 w-4" />
                      )}
                      {modoEdicao ? "Sair da Edição" : "Editar"}
                    </Button>
                  </div>
                </div>

                {/* Conteúdo do Diagrama - ocupa toda altura restante */}
                <div className="relative flex-1">
                  <SinopticoDiagrama
                    componentes={componentes}
                    onComponenteClick={handleComponenteClick}
                  />

                  {modoEdicao && (
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      Modo de Edição Ativo - {componentes.length} componentes
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>

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
