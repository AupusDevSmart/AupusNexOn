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
  Link,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Componentes implementados
import { DisjuntorModal } from "@/features/supervisorio/components/disjuntor-modal";
import { InversorModal } from "@/features/supervisorio/components/inversor-modal";
import { MedidorModal } from "@/features/supervisorio/components/medidor-modal";
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

// Interface para conexões
interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort: "top" | "bottom" | "left" | "right";
  toPort: "top" | "bottom" | "left" | "right";
}

// Interface para posição
interface Position {
  x: number;
  y: number;
}

// Tipos de componentes disponíveis
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

// Componente para renderizar símbolos elétricos
const ElectricalSymbol = ({
  tipo,
  status = "NORMAL",
  onClick,
}: {
  tipo: string;
  status: string;
  onClick?: () => void;
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "#059669";
      case "ALARME":
        return "#f59e0b";
      case "FALHA":
        return "#dc2626";
      default:
        return "#374151";
    }
  };

  const strokeColor = getStatusColor(status);

  const renderSymbol = () => {
    switch (tipo) {
      case "MEDIDOR":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="18"
              stroke={strokeColor}
              strokeWidth="2"
              fill="white"
            />
            <text
              x="20"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="bold"
              fill={strokeColor}
            >
              M
            </text>
          </svg>
        );

      case "TRANSFORMADOR":
        return (
          <svg width="60" height="40" viewBox="0 0 60 40">
            <circle
              cx="15"
              cy="20"
              r="12"
              stroke={strokeColor}
              strokeWidth="2"
              fill="white"
            />
            <circle
              cx="45"
              cy="20"
              r="12"
              stroke={strokeColor}
              strokeWidth="2"
              fill="white"
            />
            <line
              x1="27"
              y1="20"
              x2="33"
              y2="20"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <line
              x1="29"
              y1="8"
              x2="29"
              y2="32"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <line
              x1="31"
              y1="8"
              x2="31"
              y2="32"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </svg>
        );

      case "INVERSOR":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              stroke={strokeColor}
              strokeWidth="2"
              fill="white"
              rx="2"
            />
            <path
              d="M8,20 Q14,12 20,20 T32,20"
              stroke={strokeColor}
              strokeWidth="2"
              fill="none"
            />
            <text
              x="20"
              y="32"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="8"
              fontWeight="bold"
              fill={strokeColor}
            >
              INV
            </text>
          </svg>
        );

      case "DISJUNTOR":
        return (
          <svg width="40" height="20" viewBox="0 0 40 20">
            <rect
              x="2"
              y="2"
              width="36"
              height="16"
              stroke={strokeColor}
              strokeWidth="2"
              fill="white"
            />
            {status === "FALHA" ? (
              <path
                d="M8,10 L16,4 M24,16 L32,10"
                stroke={strokeColor}
                strokeWidth="2"
              />
            ) : (
              <path
                d="M8,10 L16,6 L24,14 L32,10"
                stroke={strokeColor}
                strokeWidth="2"
                fill="none"
              />
            )}
          </svg>
        );

      case "MOTOR":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="18"
              stroke={strokeColor}
              strokeWidth="2"
              fill="white"
            />
            <text
              x="20"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="bold"
              fill={strokeColor}
            >
              M
            </text>
            <line
              x1="5"
              y1="5"
              x2="12"
              y2="12"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <line
              x1="35"
              y1="5"
              x2="28"
              y2="12"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <line
              x1="20"
              y1="38"
              x2="20"
              y2="31"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </svg>
        );

      case "CAPACITOR":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              rx="4"
              stroke={strokeColor}
              strokeWidth="2"
              fill="white"
            />
            <line
              x1="15"
              y1="8"
              x2="15"
              y2="32"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <line
              x1="25"
              y1="8"
              x2="25"
              y2="32"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <text
              x="20"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="bold"
              fill={strokeColor}
            >
              C
            </text>
          </svg>
        );

      default:
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              stroke={strokeColor}
              strokeWidth="2"
              fill="white"
            />
            <text
              x="20"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fill={strokeColor}
            >
              ?
            </text>
          </svg>
        );
    }
  };

  return (
    <div
      className="relative cursor-pointer transition-transform hover:scale-105"
      onClick={onClick}
    >
      {renderSymbol()}
      <div
        className={`absolute -top-2 -right-2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
          status === "NORMAL"
            ? "bg-green-500"
            : status === "ALARME"
            ? "bg-yellow-500"
            : "bg-red-500"
        }`}
      />
    </div>
  );
};

export function SinopticoAtivoPage() {
  const { ativoId } = useParams<{ ativoId: string }>();
  const navigate = useNavigate();

  // Estados para modais
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [componenteSelecionado, setComponenteSelecionado] =
    useState<ComponenteDU | null>(null);

  // Estados para o modo de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [modoFerramenta, setModoFerramenta] = useState<
    "selecionar" | "arrastar" | "conectar"
  >("selecionar");
  const [mostrarGrid, setMostrarGrid] = useState(false);
  const [componenteEditando, setComponenteEditando] = useState<string | null>(
    null
  );

  // Estados para drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [componenteDragId, setComponenteDragId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Estados para conexões
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connecting, setConnecting] = useState<{
    from: string;
    port: "top" | "bottom" | "left" | "right";
  } | null>(null);

  // Mock data
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

  // Dados específicos para modais
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
    potencias: { ativa: 2350000, reativa: 450000, aparente: 2392500 },
    tensoes: { primario: 13800, secundario: 380 },
    correntes: { primario: 100.2, secundario: 3625.5 },
    temperatura: 65.8,
    carregamento: 85.2,
  };

  const handleVoltar = () => {
    navigate(-1);
  };

  const handleComponenteClick = useCallback(
    (componente: ComponenteDU, event?: React.MouseEvent) => {
      if (modoEdicao) {
        if (modoFerramenta === "selecionar") {
          setComponenteEditando(componente.id);
        } else if (modoFerramenta === "conectar") {
          const port = determineClickPort(event!);
          startConnection(componente.id, port);
        }
        return;
      }
      setComponenteSelecionado(componente);
      setModalAberto(componente.tipo);
    },
    [modoEdicao, modoFerramenta]
  );

  const determineClickPort = (
    event: React.MouseEvent
  ): "top" | "bottom" | "left" | "right" => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    if (Math.abs(x - centerX) > Math.abs(y - centerY)) {
      return x > centerX ? "right" : "left";
    } else {
      return y > centerY ? "bottom" : "top";
    }
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, componentId: string) => {
      if (modoFerramenta !== "arrastar" || !modoEdicao) return;

      e.preventDefault();
      e.stopPropagation();

      const component = componentes.find((c) => c.id === componentId);
      if (!component || !canvasRef.current) return;

      setComponenteEditando(componentId);
      setComponenteDragId(componentId);
      setIsDragging(true);

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const componentX = (component.posicao.x / 100) * canvasRect.width;
      const componentY = (component.posicao.y / 100) * canvasRect.height;

      setDragOffset({
        x: e.clientX - canvasRect.left - componentX,
        y: e.clientY - canvasRect.top - componentY,
      });
    },
    [modoFerramenta, modoEdicao, componentes]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !componenteDragId || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - canvasRect.left - dragOffset.x;
      const mouseY = e.clientY - canvasRect.top - dragOffset.y;

      let newX = (mouseX / canvasRect.width) * 100;
      let newY = (mouseY / canvasRect.height) * 100;

      newX = Math.max(2, Math.min(98, newX));
      newY = Math.max(2, Math.min(98, newY));

      if (mostrarGrid) {
        newX = Math.round(newX / 5) * 5;
        newY = Math.round(newY / 5) * 5;
      }

      setComponentes((prev) =>
        prev.map((comp) =>
          comp.id === componenteDragId
            ? { ...comp, posicao: { x: newX, y: newY } }
            : comp
        )
      );
    },
    [isDragging, componenteDragId, dragOffset, mostrarGrid]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setComponenteDragId(null);
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const startConnection = useCallback(
    (componentId: string, port: "top" | "bottom" | "left" | "right") => {
      if (modoFerramenta !== "conectar" || !modoEdicao) return;

      if (connecting) {
        if (connecting.from === componentId && connecting.port === port) {
          setConnecting(null);
          return;
        }

        if (connecting.from !== componentId) {
          const newConnection: Connection = {
            id: `conn-${Date.now()}`,
            from: connecting.from,
            to: componentId,
            fromPort: connecting.port,
            toPort: port,
          };
          setConnections((prev) => [...prev, newConnection]);
          setConnecting(null);
        }
      } else {
        setConnecting({ from: componentId, port });
        setComponenteEditando(componentId);
      }
    },
    [modoFerramenta, modoEdicao, connecting]
  );

  const fecharModal = () => {
    setModalAberto(null);
    setComponenteSelecionado(null);
  };

  const toggleModoEdicao = () => {
    setModoEdicao(!modoEdicao);
    if (modoEdicao) {
      setComponenteEditando(null);
      setModoFerramenta("selecionar");
      setConnecting(null);
      setIsDragging(false);
      setComponenteDragId(null);
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
    setConnections((prev) =>
      prev.filter((conn) => conn.from !== id && conn.to !== id)
    );
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

  const limparConexoes = () => {
    setConnections([]);
    setConnecting(null);
  };

  const salvarDiagrama = () => {
    console.log("Salvando diagrama...", { componentes, connections });
    alert("Diagrama salvo com sucesso!");
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="w-full max-w-full space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3 p-2">
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

          {/* Barra de Ferramentas */}
          {modoEdicao && (
            <div className="mb-6">
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
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
                        onClick={() => {
                          setModoFerramenta("selecionar");
                          setIsDragging(false);
                          setComponenteDragId(null);
                        }}
                        className="flex items-center gap-1"
                      >
                        <span className="flex items-center gap-1">
                          Selecionar
                        </span>
                      </Button>
                      <Button
                        variant={
                          modoFerramenta === "arrastar" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => {
                          setModoFerramenta("arrastar");
                          setConnecting(null);
                        }}
                        className="flex items-center gap-1"
                      >
                        <Move className="h-4 w-4" />
                        Arrastar
                      </Button>
                      <Button
                        variant={
                          modoFerramenta === "conectar" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => {
                          setModoFerramenta("conectar");
                          setIsDragging(false);
                          setComponenteDragId(null);
                        }}
                        className="flex items-center gap-1"
                      >
                        <Link className="h-4 w-4" />
                        Conectar
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Adicionar:</span>
                    <div className="flex gap-1 flex-wrap">
                      {TIPOS_COMPONENTES.map(({ tipo, icon: Icon, label }) => (
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
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Ações:</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled>
                        <Undo className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <Redo className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={limparConexoes}
                        title="Limpar conexões"
                      >
                        <X className="h-4 w-4" />
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

                {componenteEditando && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <Badge variant="outline" className="mr-2">
                            {
                              componentes.find(
                                (c) => c.id === componenteEditando
                              )?.tipo
                            }
                          </Badge>
                          <span className="text-sm font-medium">
                            {
                              componentes.find(
                                (c) => c.id === componenteEditando
                              )?.nome
                            }
                          </span>
                        </div>
                        {connecting &&
                          connecting.from === componenteEditando && (
                            <Badge
                              variant="secondary"
                              className="animate-pulse"
                            >
                              Conectando...
                            </Badge>
                          )}
                        {isDragging &&
                          componenteDragId === componenteEditando && (
                            <Badge
                              variant="secondary"
                              className="animate-pulse"
                            >
                              Arrastando...
                            </Badge>
                          )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Conexões:{" "}
                          {
                            connections.filter(
                              (c) =>
                                c.from === componenteEditando ||
                                c.to === componenteEditando
                            ).length
                          }
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setComponenteEditando(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Layout Principal - Cards com mesma altura */}
          <div className="w-full">
            {!modoEdicao && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-fit">
                {/* Gráficos à Esquerda - 1/3 */}
                <div className="lg:col-span-1 flex">
                  <SinopticoGraficos
                    dadosPotencia={dadosGraficos}
                    dadosTensao={dadosGraficos}
                  />
                </div>

                {/* Diagrama Unifilar - 2/3 */}
                <div className="lg:col-span-2 flex">
                  <Card className="flex flex-col w-full min-h-[900px]">
                    <div className="flex items-center justify-between p-4 pb-2 border-b flex-shrink-0">
                      <h3 className="text-lg font-semibold text-foreground">
                        Diagrama Unifilar
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleModoEdicao}
                          className="flex items-center gap-2"
                        >
                          <Edit3 className="h-4 w-4" />
                          Editar
                        </Button>
                      </div>
                    </div>

                    {/* Área do Diagrama - modo visualização */}
                    <div
                      className="relative flex-1 min-h-[580px]"
                      ref={canvasRef}
                    >
                      {/* Componentes com símbolos elétricos */}
                      <div className="absolute inset-0 z-10">
                        {componentes.map((componente) => (
                          <div
                            key={componente.id}
                            className="absolute"
                            style={{
                              left: `${componente.posicao.x}%`,
                              top: `${componente.posicao.y}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <ElectricalSymbol
                              tipo={componente.tipo}
                              status={componente.status}
                              onClick={() => handleComponenteClick(componente)}
                            />
                            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 bg-white/90 px-2 py-1 rounded whitespace-nowrap">
                              {componente.nome}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Modo edição mantém a estrutura original */}
            {modoEdicao && (
              <div className="w-full">
                <Card className="flex flex-col min-h-[900px]">
                  <div className="flex items-center justify-between p-4 pb-2 border-b flex-shrink-0">
                    <h3 className="text-lg font-semibold text-foreground">
                      Diagrama Unifilar
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={salvarDiagrama}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Salvar
                      </Button>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span>Componentes: {componentes.length}</span>
                        <span>Conexões: {connections.length}</span>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={toggleModoEdicao}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Sair da Edição
                      </Button>
                    </div>
                  </div>

                  {/* Área do Diagrama */}
                  <div
                    className="relative flex-1 min-h-[580px]"
                    ref={canvasRef}
                  >
                    {/* SVG para conexões */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                      {connections.map((conn) => {
                        const fromComp = componentes.find(
                          (c) => c.id === conn.from
                        );
                        const toComp = componentes.find(
                          (c) => c.id === conn.to
                        );
                        if (!fromComp || !toComp || !canvasRef.current)
                          return null;

                        const rect = canvasRef.current.getBoundingClientRect();
                        const fromCenterX =
                          (fromComp.posicao.x / 100) * rect.width;
                        const fromCenterY =
                          (fromComp.posicao.y / 100) * rect.height;
                        const toCenterX = (toComp.posicao.x / 100) * rect.width;
                        const toCenterY =
                          (toComp.posicao.y / 100) * rect.height;

                        const symbolRadius = 25;
                        let fromX = fromCenterX;
                        let fromY = fromCenterY;
                        let toX = toCenterX;
                        let toY = toCenterY;

                        switch (conn.fromPort) {
                          case "top":
                            fromY -= symbolRadius;
                            break;
                          case "bottom":
                            fromY += symbolRadius;
                            break;
                          case "left":
                            fromX -= symbolRadius;
                            break;
                          case "right":
                            fromX += symbolRadius;
                            break;
                        }

                        switch (conn.toPort) {
                          case "top":
                            toY -= symbolRadius;
                            break;
                          case "bottom":
                            toY += symbolRadius;
                            break;
                          case "left":
                            toX -= symbolRadius;
                            break;
                          case "right":
                            toX += symbolRadius;
                            break;
                        }

                        return (
                          <g key={conn.id}>
                            <line
                              x1={fromX}
                              y1={fromY}
                              x2={toX}
                              y2={toY}
                              stroke="#374151"
                              strokeWidth="2"
                              className="drop-shadow-sm"
                            />
                            <circle
                              cx={fromX}
                              cy={fromY}
                              r="3"
                              fill="#374151"
                              className="drop-shadow-sm"
                            />
                            <circle
                              cx={toX}
                              cy={toY}
                              r="3"
                              fill="#374151"
                              className="drop-shadow-sm"
                            />
                          </g>
                        );
                      })}

                      {/* Grid quando ativo */}
                      {modoEdicao && mostrarGrid && (
                        <>
                          <defs>
                            <pattern
                              id="grid"
                              width="40"
                              height="40"
                              patternUnits="userSpaceOnUse"
                            >
                              <path
                                d="M 40 0 L 0 0 0 40"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="0.5"
                                opacity="0.3"
                              />
                            </pattern>
                          </defs>
                          <rect
                            width="100%"
                            height="100%"
                            fill="url(#grid)"
                            className="pointer-events-none"
                          />
                        </>
                      )}
                    </svg>

                    {/* Componentes com símbolos elétricos */}
                    <div className="absolute inset-0 z-10">
                      {componentes.map((componente) => (
                        <div
                          key={componente.id}
                          className="absolute"
                          style={{
                            left: `${componente.posicao.x}%`,
                            top: `${componente.posicao.y}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <ElectricalSymbol
                            tipo={componente.tipo}
                            status={componente.status}
                            onClick={() => handleComponenteClick(componente)}
                          />
                          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 bg-white/90 px-2 py-1 rounded whitespace-nowrap">
                            {componente.nome}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Overlay de edição */}
                    <div className="absolute inset-0 z-20 pointer-events-none">
                      {componentes.map((componente) => (
                        <div
                          key={`overlay-${componente.id}`}
                          className="absolute"
                          style={{
                            left: `${componente.posicao.x}%`,
                            top: `${componente.posicao.y}%`,
                            transform: "translate(-50%, -50%)",
                            width: "60px",
                            height: "60px",
                          }}
                        >
                          {/* Portas de conexão */}
                          {modoFerramenta === "conectar" && (
                            <>
                              {[
                                {
                                  port: "top",
                                  style: {
                                    left: "50%",
                                    top: "-10px",
                                    transform: "translateX(-50%)",
                                  },
                                },
                                {
                                  port: "bottom",
                                  style: {
                                    left: "50%",
                                    bottom: "-10px",
                                    transform: "translateX(-50%)",
                                  },
                                },
                                {
                                  port: "left",
                                  style: {
                                    left: "-10px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                  },
                                },
                                {
                                  port: "right",
                                  style: {
                                    right: "-10px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                  },
                                },
                              ].map(({ port, style }) => (
                                <div
                                  key={port}
                                  className={`absolute w-5 h-5 rounded-full border-2 border-white cursor-pointer transition-all duration-200 pointer-events-auto z-30 hover:scale-110 shadow-lg ${
                                    connecting &&
                                    connecting.from === componente.id &&
                                    connecting.port === port
                                      ? "bg-yellow-500 animate-pulse"
                                      : connecting &&
                                        connecting.from === componente.id
                                      ? "bg-blue-300"
                                      : connecting &&
                                        connecting.from !== componente.id
                                      ? "bg-green-500 hover:bg-green-600"
                                      : "bg-blue-500 hover:bg-blue-600"
                                  }`}
                                  style={style as React.CSSProperties}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    startConnection(
                                      componente.id,
                                      port as
                                        | "top"
                                        | "bottom"
                                        | "left"
                                        | "right"
                                    );
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  title={`${
                                    connecting ? "Finalizar" : "Iniciar"
                                  } conexão pela ${
                                    port === "top"
                                      ? "parte superior"
                                      : port === "bottom"
                                      ? "parte inferior"
                                      : port === "left"
                                      ? "esquerda"
                                      : "direita"
                                  }`}
                                >
                                  <div className="absolute inset-1 rounded-full bg-white/40" />
                                </div>
                              ))}
                            </>
                          )}

                          {/* Portas pequenas para componente selecionado */}
                          {componenteEditando === componente.id &&
                            modoFerramenta !== "conectar" && (
                              <>
                                {[
                                  {
                                    port: "top",
                                    style: {
                                      left: "50%",
                                      top: "-6px",
                                      transform: "translateX(-50%)",
                                    },
                                  },
                                  {
                                    port: "bottom",
                                    style: {
                                      left: "50%",
                                      bottom: "-6px",
                                      transform: "translateX(-50%)",
                                    },
                                  },
                                  {
                                    port: "left",
                                    style: {
                                      left: "-6px",
                                      top: "50%",
                                      transform: "translateY(-50%)",
                                    },
                                  },
                                  {
                                    port: "right",
                                    style: {
                                      right: "-6px",
                                      top: "50%",
                                      transform: "translateY(-50%)",
                                    },
                                  },
                                ].map(({ port, style }) => (
                                  <div
                                    key={port}
                                    className="absolute w-3 h-3 bg-gray-400 rounded-full border border-white pointer-events-none shadow-sm"
                                    style={style as React.CSSProperties}
                                  />
                                ))}
                              </>
                            )}

                          {/* Indicador de seleção */}
                          {componenteEditando === componente.id && (
                            <div className="absolute inset-0 ring-2 ring-blue-500 ring-offset-2 rounded-lg pointer-events-none" />
                          )}

                          {/* Indicador de conexão */}
                          {connecting && connecting.from === componente.id && (
                            <div className="absolute inset-0 ring-2 ring-yellow-400 ring-offset-2 rounded-lg pointer-events-none animate-pulse">
                              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium">
                                Clique em outro componente
                              </div>
                            </div>
                          )}

                          {/* Área de interação */}
                          <div
                            className="absolute inset-0 pointer-events-auto"
                            style={{
                              cursor:
                                modoFerramenta === "arrastar"
                                  ? isDragging &&
                                    componenteDragId === componente.id
                                    ? "grabbing"
                                    : "grab"
                                  : modoFerramenta === "conectar"
                                  ? "crosshair"
                                  : "pointer",
                            }}
                            onMouseDown={(e) => {
                              if (modoFerramenta === "arrastar") {
                                handleMouseDown(e, componente.id);
                              }
                            }}
                            onClick={(e) => {
                              if (modoFerramenta !== "arrastar") {
                                e.stopPropagation();
                                handleComponenteClick(componente, e);
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Indicador de modo */}
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground bg-background/90 px-3 py-2 rounded-full border">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              modoFerramenta === "selecionar"
                                ? "bg-blue-500"
                                : modoFerramenta === "arrastar"
                                ? "bg-green-500"
                                : "bg-purple-500"
                            }`}
                          />
                          <span>
                            {modoFerramenta === "selecionar" && "Modo Seleção"}
                            {modoFerramenta === "arrastar" && "Modo Arrastar"}
                            {modoFerramenta === "conectar" && "Modo Conectar"}
                          </span>
                        </div>
                        {connecting && (
                          <span className="text-yellow-600">
                            • Conectando...
                          </span>
                        )}
                        {isDragging && (
                          <span className="text-green-600">
                            • Arrastando...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Modais */}
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
