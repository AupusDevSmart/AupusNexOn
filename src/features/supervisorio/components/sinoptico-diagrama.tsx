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

// Interfaces básicas (substitui imports não encontrados)
interface ComponenteDU {
  id: string;
  tipo: string;
  nome: string;
  posicao: { x: number; y: number };
  status: string;
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

// Componente para renderizar símbolos elétricos - CORRIGIDO
const ElectricalSymbol = ({
  tipo,
  status = "NORMAL",
  onClick,
}: {
  tipo: string;
  status: string;
  onClick?: () => void;
}) => {
  // Corrigir tipagem - usar interface explícita
  interface StatusClasses {
    stroke: string;
    fill: string;
    bg: string;
  }

  const getStatusClasses = (status: string): StatusClasses => {
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

      case "TSA":
        return (
          <svg
            width="48"
            height="40"
            viewBox="0 0 60 50"
            className="drop-shadow-sm"
          >
            <rect
              x="5"
              y="10"
              width="50"
              height="30"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <circle
              cx="20"
              cy="25"
              r="8"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <circle
              cx="40"
              cy="25"
              r="8"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <text
              x="30"
              y="48"
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
            height="24"
            viewBox="0 0 40 30"
            className="drop-shadow-sm"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="26"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            <path
              d="M6,15 Q12,8 18,15 T30,15"
              className={statusClasses.stroke}
              strokeWidth="1.5"
              fill="none"
            />
            <line
              x1="32"
              y1="10"
              x2="32"
              y2="20"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <text
              x="20"
              y="25"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="6"
              fontWeight="600"
              className={statusClasses.fill}
            >
              RET
            </text>
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
              x="2"
              y="5"
              width="46"
              height="20"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            {[8, 14, 20, 26, 32, 38].map((x, i) => (
              <g key={i}>
                <line
                  x1={x}
                  y1="8"
                  x2={x}
                  y2="22"
                  className={statusClasses.stroke}
                  strokeWidth="2"
                />
                <line
                  x1={x + 3}
                  y1="10"
                  x2={x + 3}
                  y2="20"
                  className={statusClasses.stroke}
                  strokeWidth="1"
                />
              </g>
            ))}
          </svg>
        );

      case "PAINEL_PMT":
        return (
          <svg
            width="40"
            height="32"
            viewBox="0 0 50 40"
            className="drop-shadow-sm"
          >
            <rect
              x="2"
              y="2"
              width="46"
              height="36"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <rect
              x="6"
              y="6"
              width="8"
              height="6"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <rect
              x="18"
              y="6"
              width="8"
              height="6"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <rect
              x="30"
              y="6"
              width="8"
              height="6"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="10"
              cy="20"
              r="3"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="22"
              cy="20"
              r="3"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="34"
              cy="20"
              r="3"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <text
              x="25"
              y="35"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="8"
              fontWeight="600"
              className={statusClasses.fill}
            >
              PMT
            </text>
          </svg>
        );

      case "SKID":
        return (
          <svg
            width="36"
            height="28"
            viewBox="0 0 45 35"
            className="drop-shadow-sm"
          >
            <rect
              x="2"
              y="2"
              width="41"
              height="31"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <line
              x1="15"
              y1="2"
              x2="15"
              y2="33"
              className={statusClasses.stroke}
              strokeWidth="1"
              opacity="0.5"
            />
            <line
              x1="30"
              y1="2"
              x2="30"
              y2="33"
              className={statusClasses.stroke}
              strokeWidth="1"
              opacity="0.5"
            />
            <line
              x1="2"
              y1="12"
              x2="43"
              y2="12"
              className={statusClasses.stroke}
              strokeWidth="1"
              opacity="0.5"
            />
            <line
              x1="2"
              y1="23"
              x2="43"
              y2="23"
              className={statusClasses.stroke}
              strokeWidth="1"
              opacity="0.5"
            />
            <text
              x="22.5"
              y="18"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="8"
              fontWeight="600"
              className={statusClasses.fill}
            >
              SKID
            </text>
          </svg>
        );

      case "SALA_COMANDO":
        return (
          <svg
            width="44"
            height="32"
            viewBox="0 0 55 40"
            className="drop-shadow-sm"
          >
            <rect
              x="2"
              y="2"
              width="51"
              height="36"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="4"
            />
            <rect
              x="8"
              y="8"
              width="39"
              height="8"
              className={statusClasses.stroke}
              strokeWidth="1.5"
              fill="none"
            />
            <rect
              x="10"
              y="10"
              width="6"
              height="4"
              className={statusClasses.fill}
            />
            <rect
              x="18"
              y="10"
              width="6"
              height="4"
              className={statusClasses.fill}
            />
            <rect
              x="26"
              y="10"
              width="6"
              height="4"
              className={statusClasses.fill}
            />
            <circle
              cx="12"
              cy="25"
              r="2"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="20"
              cy="25"
              r="2"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="28"
              cy="25"
              r="2"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="36"
              cy="25"
              r="2"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
          </svg>
        );

      case "SCADA":
        return (
          <svg
            width="28"
            height="28"
            viewBox="0 0 35 35"
            className="drop-shadow-sm"
          >
            <circle
              cx="17.5"
              cy="17.5"
              r="15"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <circle
              cx="17.5"
              cy="17.5"
              r="8"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="17.5"
              cy="17.5"
              r="4"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="17.5"
              cy="17.5"
              r="1.5"
              className={statusClasses.fill}
            />
            <circle cx="17.5" cy="8.5" r="1" className={statusClasses.fill} />
            <circle cx="17.5" cy="26.5" r="1" className={statusClasses.fill} />
            <circle cx="8.5" cy="17.5" r="1" className={statusClasses.fill} />
            <circle cx="26.5" cy="17.5" r="1" className={statusClasses.fill} />
          </svg>
        );

      case "CFTV":
        return (
          <svg
            width="28"
            height="28"
            viewBox="0 0 35 35"
            className="drop-shadow-sm"
          >
            <circle
              cx="17.5"
              cy="17.5"
              r="15"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <rect
              x="10"
              y="12"
              width="15"
              height="11"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="1.5"
              rx="2"
            />
            <circle
              cx="17.5"
              cy="17.5"
              r="4"
              className={statusClasses.stroke}
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="17.5" cy="17.5" r="2" className={statusClasses.fill} />
            <line
              x1="17.5"
              y1="23"
              x2="17.5"
              y2="28"
              className={statusClasses.stroke}
              strokeWidth="1.5"
            />
          </svg>
        );

      case "TELECOM":
        return (
          <svg
            width="28"
            height="28"
            viewBox="0 0 35 35"
            className="drop-shadow-sm"
          >
            <circle
              cx="17.5"
              cy="17.5"
              r="15"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <line
              x1="17.5"
              y1="8"
              x2="17.5"
              y2="27"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <path
              d="M12,12 Q17.5,8 23,12"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M10,15 Q17.5,10 25,15"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M8,18 Q17.5,12 27,18"
              className={statusClasses.stroke}
              strokeWidth="1"
              fill="none"
            />
            <circle cx="17.5" cy="25" r="2" className={statusClasses.fill} />
          </svg>
        );

      case "BARRAMENTO":
        return (
          <svg
            width="40"
            height="12"
            viewBox="0 0 50 15"
            className="drop-shadow-sm"
          >
            <rect
              x="2"
              y="4"
              width="46"
              height="7"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="1"
            />
            <line
              x1="12"
              y1="4"
              x2="12"
              y2="11"
              className={statusClasses.stroke}
              strokeWidth="1"
            />
            <line
              x1="22"
              y1="4"
              x2="22"
              y2="11"
              className={statusClasses.stroke}
              strokeWidth="1"
            />
            <line
              x1="32"
              y1="4"
              x2="32"
              y2="11"
              className={statusClasses.stroke}
              strokeWidth="1"
            />
            <line
              x1="42"
              y1="4"
              x2="42"
              y2="11"
              className={statusClasses.stroke}
              strokeWidth="1"
            />
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

// Componente principal
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
  const [componentes, setComponentes] = useState<ComponenteDU[]>([
    {
      id: "tsa-01",
      tipo: "TSA",
      nome: "TSA 1",
      posicao: { x: 20, y: 20 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "tsa-02",
      tipo: "TSA",
      nome: "TSA 2",
      posicao: { x: 60, y: 20 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "retificador-01",
      tipo: "RETIFICADOR",
      nome: "RET-1",
      posicao: { x: 30, y: 50 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "retificador-02",
      tipo: "RETIFICADOR",
      nome: "RET-2",
      posicao: { x: 50, y: 50 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "banco-baterias-01",
      tipo: "BANCO_BATERIAS",
      nome: "Banco de Baterias 1",
      posicao: { x: 35, y: 70 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "banco-baterias-02",
      tipo: "BANCO_BATERIAS",
      nome: "Banco de Baterias 2",
      posicao: { x: 45, y: 70 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "painel-pmt",
      tipo: "PAINEL_PMT",
      nome: "PMT",
      posicao: { x: 15, y: 85 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "skid-01",
      tipo: "SKID",
      nome: "SKID1",
      posicao: { x: 30, y: 85 },
      status: "NORMAL",
      dados: {},
    },
    {
      id: "skid-02",
      tipo: "SKID",
      nome: "SKID2",
      posicao: { x: 45, y: 85 },
      status: "ALARME",
      dados: {},
    },
    {
      id: "sala-comando",
      tipo: "SALA_COMANDO",
      nome: "Sala de Comando",
      posicao: { x: 70, y: 85 },
      status: "NORMAL",
      dados: {},
    },
  ]);

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
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-full space-y-3 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
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
            Sinóptico - Diagrama Unifilar
          </h1>
        </div>

        {/* Barra de Ferramentas */}
        {modoEdicao && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 border-r pr-4">
                <span className="text-sm font-medium">Modo:</span>
                <div className="flex gap-1">
                  <Button
                    variant={
                      modoFerramenta === "selecionar" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => {
                      setModoFerramenta("selecionar");
                      setIsDragging(false);
                      setComponenteDragId(null);
                    }}
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
                        onClick={() => duplicarComponente(componenteEditando)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removerComponente(componenteEditando)}
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
                    {connecting && connecting.from === componenteEditando && (
                      <Badge variant="secondary" className="animate-pulse">
                        Conectando...
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
        )}

        {/* Diagrama Principal */}
        <Card className="flex flex-col min-h-[800px]">
          <div className="flex items-center justify-between p-4 pb-2 border-b flex-shrink-0">
            <h3 className="text-lg font-semibold text-foreground">
              Diagrama Unifilar - Sistema Elétrico
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
              <div className="text-xs text-muted-foreground flex items-center gap-3">
                <span>Componentes: {componentes.length}</span>
                <span>Conexões: {connections.length}</span>
              </div>
              <Button
                variant={modoEdicao ? "default" : "outline"}
                size="sm"
                onClick={toggleModoEdicao}
                className="flex items-center gap-2"
              >
                {modoEdicao ? (
                  <>
                    <X className="h-4 w-4" />
                    Sair da Edição
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Área do Diagrama */}
          <div className="relative flex-1 min-h-[580px]" ref={canvasRef}>
            {/* SVG para conexões e grid */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
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
                        className="stroke-border"
                        strokeWidth="0.5"
                        opacity="0.3"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </>
              )}

              {/* Conexões */}
              {connections.map((conn) => {
                const fromComp = componentes.find((c) => c.id === conn.from);
                const toComp = componentes.find((c) => c.id === conn.to);
                if (!fromComp || !toComp || !canvasRef.current) return null;

                const rect = canvasRef.current.getBoundingClientRect();
                const fromX = (fromComp.posicao.x / 100) * rect.width;
                const fromY = (fromComp.posicao.y / 100) * rect.height;
                const toX = (toComp.posicao.x / 100) * rect.width;
                const toY = (toComp.posicao.y / 100) * rect.height;

                return (
                  <g key={conn.id}>
                    <line
                      x1={fromX}
                      y1={fromY}
                      x2={toX}
                      y2={toY}
                      className="stroke-muted-foreground"
                      strokeWidth="2"
                    />
                    <circle
                      cx={fromX}
                      cy={fromY}
                      r="3"
                      className="fill-muted-foreground"
                    />
                    <circle
                      cx={toX}
                      cy={toY}
                      r="3"
                      className="fill-muted-foreground"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Componentes */}
            <div className="absolute inset-0 z-20">
              {componentes.map((componente) => (
                <div
                  key={componente.id}
                  className="absolute"
                  style={{
                    left: `${componente.posicao.x}%`,
                    top: `${componente.posicao.y}%`,
                    transform: "translate(-50%, -50%)",
                    cursor: modoFerramenta === "arrastar" ? "grab" : "pointer",
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
                >
                  <ElectricalSymbol
                    tipo={componente.tipo}
                    status={componente.status}
                  />
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-muted-foreground bg-background/90 px-2 py-1 rounded whitespace-nowrap border">
                    {componente.nome}
                  </div>

                  {/* Indicador de seleção */}
                  {componenteEditando === componente.id && (
                    <div className="absolute inset-0 ring-2 ring-blue-500 ring-offset-2 rounded-lg pointer-events-none" />
                  )}

                  {/* Indicador de conexão */}
                  {connecting && connecting.from === componente.id && (
                    <div className="absolute inset-0 ring-2 ring-amber-400 ring-offset-2 rounded-lg pointer-events-none animate-pulse">
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-amber-400 text-amber-900 text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium">
                        Clique em outro componente
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Indicador de modo */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground bg-background/90 px-3 py-2 rounded-full border">
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
                  <span className="text-amber-600">• Conectando...</span>
                )}
                {isDragging && (
                  <span className="text-green-600">• Arrastando...</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal básico */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {componenteSelecionado?.nome}
              </h2>
              <Button variant="ghost" size="sm" onClick={fecharModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <p>
                <strong>Tipo:</strong> {componenteSelecionado?.tipo}
              </p>
              <p>
                <strong>Status:</strong> {componenteSelecionado?.status}
              </p>
              <p>
                <strong>ID:</strong> {componenteSelecionado?.id}
              </p>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={fecharModal}>Fechar</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
