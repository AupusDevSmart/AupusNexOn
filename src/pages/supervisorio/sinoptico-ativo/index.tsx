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
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Componentes implementados
import { ConexoesDiagrama } from "@/features/supervisorio/components/conexoes-diagrama";
import { DisjuntorModal } from "@/features/supervisorio/components/disjuntor-modal";
import { InversorModal } from "@/features/supervisorio/components/inversor-modal";
import { MedidorModal } from "@/features/supervisorio/components/medidor-modal";
import { SinopticoDiagrama } from "@/features/supervisorio/components/sinoptico-diagrama";
import { SinopticoGraficos } from "@/features/supervisorio/components/sinoptico-graficos";
import { SinopticoIndicadores } from "@/features/supervisorio/components/sinoptico-indicadores";
import { TransformadorModal } from "@/features/supervisorio/components/transformador-modal";

// Tipos - CORRIGIDOS com interfaces locais caso os imports falhem
import type { ComponenteDU } from "@/types/dtos/sinoptico-ativo";

// Interfaces de backup caso os imports não funcionem
interface ComponenteDUBackup {
  id: string;
  tipo: string;
  nome: string;
  posicao: { x: number; y: number };
  status: "NORMAL" | "ALARME" | "FALHA";
  dados: any;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort: "top" | "bottom" | "left" | "right";
  toPort: "top" | "bottom" | "left" | "right";
}

interface Position {
  x: number;
  y: number;
}

// Tipos de componentes disponíveis - EXPANDIDO
const TIPOS_COMPONENTES = [
  // Componentes básicos
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

  // Componentes de subestação
  { tipo: "TSA", icon: Square, label: "TSA", cor: "bg-emerald-600" },
  {
    tipo: "RETIFICADOR",
    icon: Triangle,
    label: "Retificador",
    cor: "bg-orange-500",
  },
  {
    tipo: "BANCO_BATERIAS",
    icon: Square,
    label: "Banco Baterias",
    cor: "bg-cyan-600",
  },
  { tipo: "BARRAMENTO", icon: Square, label: "Barramento", cor: "bg-gray-600" },

  // Painéis e sistemas
  {
    tipo: "PAINEL_PMT",
    icon: Square,
    label: "Painel PMT",
    cor: "bg-slate-600",
  },
  { tipo: "SKID", icon: Square, label: "SKID", cor: "bg-violet-600" },
  {
    tipo: "SALA_COMANDO",
    icon: Square,
    label: "Sala Comando",
    cor: "bg-pink-600",
  },

  // Sistemas de controle
  { tipo: "SCADA", icon: Circle, label: "SCADA", cor: "bg-teal-600" },
  { tipo: "CFTV", icon: Circle, label: "CFTV", cor: "bg-lime-600" },
  { tipo: "TELECOM", icon: Circle, label: "Telecom", cor: "bg-amber-600" },
];

// Função para obter classes de status - CORRIGIDA
const getStatusClasses = (status: string) => {
  switch (status) {
    case "NORMAL":
      return {
        stroke: "stroke-green-600 dark:stroke-green-400",
        fill: "fill-green-600 dark:fill-green-400",
        bg: "bg-green-500",
      };
    case "ALARME":
      return {
        stroke: "stroke-amber-600 dark:stroke-amber-400",
        fill: "fill-amber-600 dark:fill-amber-400",
        bg: "bg-amber-500",
      };
    case "FALHA":
      return {
        stroke: "stroke-red-600 dark:stroke-red-400",
        fill: "fill-red-600 dark:fill-red-400",
        bg: "bg-red-500",
      };
    default:
      return {
        stroke: "stroke-muted-foreground",
        fill: "fill-muted-foreground",
        bg: "bg-muted",
      };
  }
};

// Componente para renderizar símbolos elétricos - APENAS PARA MODO EDIÇÃO
const ElectricalSymbol = ({
  tipo,
  status = "NORMAL",
  onClick,
}: {
  tipo: string;
  status: string;
  onClick?: () => void;
}) => {
  const statusClasses = getStatusClasses(status);

  const renderSymbol = () => {
    switch (tipo) {
      case "MEDIDOR":
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <text
              x="20"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="600"
              className={statusClasses.fill}
            >
              M
            </text>
          </svg>
        );

      case "TRANSFORMADOR":
        return (
          <svg
            width="48"
            height="32"
            viewBox="0 0 60 40"
            className="drop-shadow-sm"
          >
            <circle
              cx="15"
              cy="20"
              r="12"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <circle
              cx="45"
              cy="20"
              r="12"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <line
              x1="27"
              y1="20"
              x2="33"
              y2="20"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="29"
              y1="8"
              x2="29"
              y2="32"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="31"
              y1="8"
              x2="31"
              y2="32"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
          </svg>
        );

      case "INVERSOR":
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <path
              d="M8,20 Q14,12 20,20 T32,20"
              className={statusClasses.stroke}
              strokeWidth="2"
              fill="none"
            />
            <text
              x="20"
              y="32"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="8"
              fontWeight="600"
              className={statusClasses.fill}
            >
              INV
            </text>
          </svg>
        );

      case "DISJUNTOR":
        return (
          <svg
            width="32"
            height="16"
            viewBox="0 0 40 20"
            className="drop-shadow-sm"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="16"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            {status === "FALHA" ? (
              <path
                d="M8,10 L16,4 M24,16 L32,10"
                className={statusClasses.stroke}
                strokeWidth="2"
              />
            ) : (
              <path
                d="M8,10 L16,6 L24,14 L32,10"
                className={statusClasses.stroke}
                strokeWidth="2"
                fill="none"
              />
            )}
          </svg>
        );

      case "TSA":
        return (
          <svg
            width="40"
            height="32"
            viewBox="0 0 50 40"
            className="drop-shadow-sm"
          >
            <rect
              x="5"
              y="5"
              width="40"
              height="30"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <rect
              x="10"
              y="10"
              width="8"
              height="8"
              className={statusClasses.fill}
              rx="1"
            />
            <rect
              x="21"
              y="10"
              width="8"
              height="8"
              className={statusClasses.fill}
              rx="1"
            />
            <rect
              x="32"
              y="10"
              width="8"
              height="8"
              className={statusClasses.fill}
              rx="1"
            />
            <text
              x="25"
              y="30"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="8"
              fontWeight="600"
              className={statusClasses.fill}
            >
              TSA
            </text>
          </svg>
        );

      case "RETIFICADOR":
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <path
              d="M15,12 L25,20 L15,28"
              className={statusClasses.stroke}
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="12"
              y1="20"
              x2="15"
              y2="20"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="25"
              y1="20"
              x2="28"
              y2="20"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
          </svg>
        );

      case "BANCO_BATERIAS":
        return (
          <svg
            width="40"
            height="24"
            viewBox="0 0 50 30"
            className="drop-shadow-sm"
          >
            <rect
              x="5"
              y="8"
              width="12"
              height="14"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            <rect
              x="19"
              y="8"
              width="12"
              height="14"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            <rect
              x="33"
              y="8"
              width="12"
              height="14"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            <line
              x1="11"
              y1="6"
              x2="11"
              y2="8"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="25"
              y1="6"
              x2="25"
              y2="8"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="39"
              y1="6"
              x2="39"
              y2="8"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
          </svg>
        );

      case "MOTOR":
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <text
              x="20"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="600"
              className={statusClasses.fill}
            >
              M
            </text>
            <line
              x1="5"
              y1="5"
              x2="12"
              y2="12"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="35"
              y1="5"
              x2="28"
              y2="12"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="20"
              y1="38"
              x2="20"
              y2="31"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
          </svg>
        );

      case "CAPACITOR":
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              rx="4"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <line
              x1="15"
              y1="8"
              x2="15"
              y2="32"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="25"
              y1="8"
              x2="25"
              y2="32"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <text
              x="20"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="600"
              className={statusClasses.fill}
            >
              C
            </text>
          </svg>
        );

      default:
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <text
              x="20"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              className="fill-muted-foreground"
            >
              ?
            </text>
          </svg>
        );
    }
  };

  return (
    <div
      className="relative cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-md"
      onClick={onClick}
    >
      {renderSymbol()}
      <div
        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background shadow-lg ${statusClasses.bg}`}
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

  // Mock data atualizado com dados realistas
  const [ativoData] = useState({
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

  const [dadosGraficos] = useState(() => {
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

  const [indicadores] = useState({
    thd: 3.2,
    fp: 0.95,
    dt: 2.1,
    frequencia: 60.02,
    alarmes: 1,
    falhas: 0,
    urgencias: 0,
    osAbertas: 2,
  });

  // Componentes com tipos expandidos
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
    {
      id: "tsa-01",
      tipo: "TSA",
      nome: "TSA Principal",
      posicao: { x: 25, y: 50 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "retificador-01",
      tipo: "RETIFICADOR",
      nome: "Retificador 24V",
      posicao: { x: 55, y: 50 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "baterias-01",
      tipo: "BANCO_BATERIAS",
      nome: "Banco Baterias",
      posicao: { x: 75, y: 50 },
      status: "NORMAL",
      dados: {},
    },
  ]);

  // CARREGAR DIAGRAMA SALVO AO INICIALIZAR
  useEffect(() => {
    const carregarDiagrama = () => {
      try {
        const diagramaSalvo = localStorage.getItem(`diagrama_${ativoId}`);
        if (diagramaSalvo) {
          const data = JSON.parse(diagramaSalvo);
          if (data.componentes) setComponentes(data.componentes);
          if (data.connections) setConnections(data.connections);
          console.log("Diagrama carregado com sucesso:", data);
        }
      } catch (error) {
        console.error("Erro ao carregar diagrama:", error);
      }
    };

    if (ativoId) {
      carregarDiagrama();
    }
  }, [ativoId]);

  // FUNÇÕES DE LAYOUT COM PREVENÇÃO DE SOBREPOSIÇÃO
  const MIN_SPACING = 15; // Espaçamento mínimo entre componentes em %

  const autoArrangeComponents = useCallback(() => {
    const arranged = [...componentes];
    const categories = {
      MEDIDOR: { row: 1, order: 1 },
      TRANSFORMADOR: { row: 2, order: 1 },
      INVERSOR: { row: 3, order: 1 },
      DISJUNTOR: { row: 1, order: 2 },
      TSA: { row: 2, order: 2 },
      RETIFICADOR: { row: 3, order: 2 },
      BANCO_BATERIAS: { row: 4, order: 1 },
      MOTOR: { row: 4, order: 2 },
      CAPACITOR: { row: 4, order: 3 },
    };

    const grouped = arranged.reduce((acc, comp) => {
      const category = categories[comp.tipo] || { row: 5, order: 1 };
      const key = `${category.row}-${category.order}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(comp);
      return acc;
    }, {} as Record<string, ComponenteDU[]>);

    const newComponents: ComponenteDU[] = [];

    Object.entries(grouped).forEach(([key, components]) => {
      const [row, order] = key.split("-").map(Number);
      const baseY = 15 + (row - 1) * 20; // 15%, 35%, 55%, 75%
      const baseX = 10 + (order - 1) * 30; // 10%, 40%, 70%

      // Distribuição horizontal inteligente para cada grupo
      const startX = baseX;
      const maxX = baseX + 25; // Máximo 25% de largura por coluna
      const numInGroup = components.length;

      if (numInGroup === 1) {
        // Se só há 1 componente no grupo, usar posição base
        newComponents.push({
          ...components[0],
          posicao: {
            x: startX,
            y: baseY,
          },
        });
      } else {
        // Se há múltiplos componentes, distribuir uniformemente
        const availableWidth = maxX - startX;
        const spacing = availableWidth / (numInGroup - 1);

        components.forEach((comp, index) => {
          newComponents.push({
            ...comp,
            posicao: {
              x: Math.min(startX + index * spacing, 85),
              y: baseY,
            },
          });
        });
      }
    });

    setComponentes(newComponents);
  }, [componentes]);

  const alignHorizontal = useCallback(() => {
    if (componentes.length < 2) return;

    // Calcular Y médio
    const avgY =
      componentes.reduce((sum, comp) => sum + comp.posicao.y, 0) /
      componentes.length;

    // Ordenar por posição X para manter ordem
    const sortedComponents = [...componentes].sort(
      (a, b) => a.posicao.x - b.posicao.x
    );

    const aligned: ComponenteDU[] = [];
    let currentX = 10; // Começar em 10%

    sortedComponents.forEach((comp) => {
      aligned.push({
        ...comp,
        posicao: {
          x: currentX,
          y: avgY,
        },
      });

      currentX += MIN_SPACING; // Próximo componente com espaçamento
      if (currentX > 85) currentX = 85; // Limitar à tela
    });

    setComponentes(aligned);
  }, [componentes]);

  const alignVertical = useCallback(() => {
    if (componentes.length < 2) return;

    // Calcular X médio
    const avgX =
      componentes.reduce((sum, comp) => sum + comp.posicao.x, 0) /
      componentes.length;

    // Ordenar por posição Y para manter ordem
    const sortedComponents = [...componentes].sort(
      (a, b) => a.posicao.y - b.posicao.y
    );

    const aligned: ComponenteDU[] = [];

    // Calcular espaçamento disponível
    const startY = 10;
    const endY = 85;
    const availableSpace = endY - startY;
    const numComponents = sortedComponents.length;

    if (numComponents === 1) {
      // Se só há 1 componente, centralizar
      aligned.push({
        ...sortedComponents[0],
        posicao: {
          x: avgX,
          y: 50, // Centro da tela
        },
      });
    } else {
      // Se há múltiplos componentes, distribuir uniformemente
      const spacing = availableSpace / (numComponents - 1);

      sortedComponents.forEach((comp, index) => {
        aligned.push({
          ...comp,
          posicao: {
            x: avgX,
            y: startY + index * spacing,
          },
        });
      });
    }

    setComponentes(aligned);
  }, [componentes]);

  // Mock data para modais
  const dadosMedidor = {
    ufer: 0.952,
    demanda: 2485.5,
    energiaConsumida: 15847.2,
    energiaInjetada: 42156.8,
    tensaoFases: { a: 220.1, b: 219.8, c: 220.4 },
    correnteFases: { a: 3789.2, b: 3821.1, c: 3752.7 },
  };

  const dadosInversor = {
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

  const dadosDisjuntor = {
    status: "FECHADO",
    estadoMola: "ARMADO",
    corrente: 3789.2,
    ultimaOperacao: new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    ).toISOString(),
    numeroOperacoes: 1247,
  };

  const dadosTransformador = {
    potencias: { ativa: 2350000, reativa: 450000, aparente: 2392500 },
    tensoes: { primario: 13800, secundario: 380 },
    correntes: { primario: 100.2, secundario: 3625.5 },
    temperatura: 65.8,
    carregamento: 85.2,
  };

  // Funções de navegação
  const handleVoltar = () => {
    navigate(-1);
  };

  // Função principal de clique em componente
  const handleComponenteClick = useCallback(
    (componente: ComponenteDU, event?: React.MouseEvent) => {
      if (modoEdicao) {
        if (modoFerramenta === "selecionar") {
          setComponenteEditando(componente.id);
        } else if (modoFerramenta === "conectar" && event) {
          const port = determineClickPort(event);
          startConnection(componente.id, port);
        }
        return;
      }
      setComponenteSelecionado(componente);
      setModalAberto(componente.tipo);
    },
    [modoEdicao, modoFerramenta]
  );

  // Utilitários para conexões
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

  // Sistema de drag and drop
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

      // Aplicar limites
      newX = Math.max(2, Math.min(98, newX));
      newY = Math.max(2, Math.min(98, newY));

      setComponentes((prev) =>
        prev.map((comp) =>
          comp.id === componenteDragId
            ? { ...comp, posicao: { x: newX, y: newY } }
            : comp
        )
      );
    },
    [isDragging, componenteDragId, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setComponenteDragId(null);
  }, [isDragging]);

  // Event listeners para drag
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

  // Sistema de conexões
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

  // Funções de controle
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

  // Função para remover conexão
  const removerConexao = (connectionId: string) => {
    setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
  };

  // Funções de edição de componentes
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
    const diagramaData = {
      ativoId: ativoId,
      componentes: componentes,
      connections: connections,
      ultimaAtualizacao: new Date().toISOString(),
    };

    localStorage.setItem(`diagrama_${ativoId}`, JSON.stringify(diagramaData));
    console.log("Diagrama salvo no localStorage:", diagramaData);
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

          {/* Barra de Ferramentas - SÓ APARECE NO MODO EDIÇÃO */}
          {modoEdicao && (
            <div className="mb-6">
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Modos de Ferramentas */}
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
                        Selecionar
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

                  {/* Adicionar Componentes */}
                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Adicionar:</span>
                    <select
                      className="h-8 px-3 py-1 text-sm border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-w-[180px]"
                      onChange={(e) => {
                        if (e.target.value) {
                          adicionarComponente(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Selecione um componente
                      </option>
                      <optgroup label="Componentes Básicos">
                        <option value="MEDIDOR">Medidor</option>
                        <option value="TRANSFORMADOR">Transformador</option>
                        <option value="INVERSOR">Inversor</option>
                        <option value="DISJUNTOR">Disjuntor</option>
                        <option value="MOTOR">Motor</option>
                        <option value="CAPACITOR">Capacitor</option>
                      </optgroup>
                      <optgroup label="Subestação">
                        <option value="TSA">TSA</option>
                        <option value="RETIFICADOR">Retificador</option>
                        <option value="BANCO_BATERIAS">Banco Baterias</option>
                        <option value="BARRAMENTO">Barramento</option>
                      </optgroup>
                      <optgroup label="Painéis e Sistemas">
                        <option value="PAINEL_PMT">Painel PMT</option>
                        <option value="SKID">SKID</option>
                        <option value="SALA_COMANDO">Sala Comando</option>
                      </optgroup>
                      <optgroup label="Controle">
                        <option value="SCADA">SCADA</option>
                        <option value="CFTV">CFTV</option>
                        <option value="TELECOM">Telecom</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Ações:</span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title="Desfazer (em desenvolvimento)"
                      >
                        <Undo className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title="Refazer (em desenvolvimento)"
                      >
                        <Redo className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={limparConexoes}
                        disabled={connections.length === 0}
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
                            title="Duplicar componente"
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
                            title="Remover componente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ferramentas de Layout */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Layout:</span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={autoArrangeComponents}
                        title="Organizar automaticamente"
                      >
                        Auto
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={alignHorizontal}
                        title="Alinhar horizontalmente"
                      >
                        ═══
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={alignVertical}
                        title="Alinhar verticalmente"
                      >
                        |||
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Info do Componente Selecionado */}
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

          {/* Layout Principal */}
          <div className="w-full">
            {!modoEdicao && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-fit">
                {/* Gráficos à Esquerda */}
                <div className="lg:col-span-1 flex">
                  <SinopticoGraficos
                    dadosPotencia={dadosGraficos}
                    dadosTensao={dadosGraficos}
                  />
                </div>

                {/* Diagrama Unifilar - MODO VISUALIZAÇÃO */}
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

                    <div
                      className="flex-1 min-h-[580px] relative"
                      ref={canvasRef}
                    >
                      {/* COMPONENTE DE CONEXÕES PARA MODO VISUALIZAÇÃO */}
                      <ConexoesDiagrama
                        connections={connections}
                        componentes={componentes}
                        containerRef={canvasRef}
                        modoEdicao={false}
                        className="z-10"
                      />

                      <SinopticoDiagrama
                        componentes={componentes}
                        onComponenteClick={handleComponenteClick}
                        modoEdicao={modoEdicao}
                        componenteEditando={componenteEditando}
                        connecting={connecting}
                      />
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Modo Edição - Tela Cheia */}
            {modoEdicao && (
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

                <div className="relative flex-1 min-h-[580px]" ref={canvasRef}>
                  {/* COMPONENTE DE CONEXÕES PARA MODO EDIÇÃO */}
                  <ConexoesDiagrama
                    connections={connections}
                    componentes={componentes}
                    containerRef={canvasRef}
                    modoEdicao={true}
                    connecting={connecting}
                    onRemoverConexao={removerConexao}
                    className="z-10"
                  />

                  <SinopticoDiagrama
                    componentes={componentes}
                    onComponenteClick={handleComponenteClick}
                    modoEdicao={modoEdicao}
                    componenteEditando={componenteEditando}
                    connecting={connecting}
                  />

                  {/* Componentes no Modo Edição */}
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
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-muted-foreground bg-background/90 px-2 py-1 rounded whitespace-nowrap border">
                          {componente.nome}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Overlay de Edição */}
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
                        {/* Portas de Conexão */}
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
                                className={`absolute w-5 h-5 rounded-full border-2 border-background cursor-pointer transition-all duration-200 pointer-events-auto z-30 hover:scale-110 shadow-lg ${
                                  connecting &&
                                  connecting.from === componente.id &&
                                  connecting.port === port
                                    ? "bg-amber-500 animate-pulse"
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
                                    port as "top" | "bottom" | "left" | "right"
                                  );
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                title={`${
                                  connecting ? "Finalizar" : "Iniciar"
                                } conexão`}
                              >
                                <div className="absolute inset-1 rounded-full bg-background/40" />
                              </div>
                            ))}
                          </>
                        )}

                        {/* Indicadores de Seleção */}
                        {componenteEditando === componente.id && (
                          <div className="absolute inset-0 ring-2 ring-blue-500 ring-offset-2 rounded-lg pointer-events-none" />
                        )}

                        {/* Indicador de Conexão Ativa */}
                        {connecting && connecting.from === componente.id && (
                          <div className="absolute inset-0 ring-2 ring-amber-400 ring-offset-2 rounded-lg pointer-events-none animate-pulse">
                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-amber-400 text-amber-900 text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium">
                              Clique em outro componente
                            </div>
                          </div>
                        )}

                        {/* Área de Interação */}
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

                  {/* Indicador de Status */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground bg-background/90 px-3 py-2 rounded-full border">
                    <div className="flex items-center gap-2">
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
                      {/* ADICIONAR INFO DE CONEXÕES */}
                      <span className="text-muted-foreground">
                        • {connections.length} conexões
                      </span>
                      {connecting && (
                        <span className="text-amber-600">• Conectando...</span>
                      )}
                      {isDragging && (
                        <span className="text-green-600">• Arrastando...</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Modals */}
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
