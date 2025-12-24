import { Layout } from "@/components/common/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Building,
  Circle,
  Copy,
  Edit3,
  Gauge,
  HardDrive,
  Link,
  Maximize,
  Minimize,
  Move,
  Network,
  Redo,
  Router,
  Save,
  Square,
  Trash2,
  Triangle,
  Undo,
  X,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Componentes implementados
import type { A966Reading } from "@/components/equipment/A966/A966.types";
import type { LandisGyrE750Reading } from "@/components/equipment/LandisGyr/LandisGyr.types";
import type { M300Reading } from "@/components/equipment/M300/M300.types"; // Hook para histórico undo/redo - REMOVIDO
import { A966Modal } from "@/features/supervisorio/components/a966-modal";
import { DomAnchoredConnectionsOverlay } from "@/features/supervisorio/components/DomAnchoredConnectionsOverlay";
import "@/features/supervisorio/components/DomAnchoredConnectionsOverlay.css";
import { DiagramGrid, useGridSettings } from "@/features/supervisorio/components/DiagramGrid";
import { DisjuntorModal } from "@/features/supervisorio/components/disjuntor-modal";
import { InversorModal } from "@/features/supervisorio/components/inversor-modal";
import { InversorMqttDataModal } from "@/features/equipamentos/components/InversorMqttDataModal";
// Removido: MultiplosInversoresGraficosModal - seleção é feita via modal de configuração
import { PivoModal, type DadosPivo } from "@/features/supervisorio/components/pivo";
import { LandisGyrModal } from "@/features/supervisorio/components/landisgyr-modal";
import { M160Modal } from "@/features/supervisorio/components/m160-modal";
import { M300Modal } from "@/features/supervisorio/components/m300-modal";
import { MedidorModal } from "@/features/supervisorio/components/medidor-modal";
import { SinopticoDiagrama } from "@/features/supervisorio/components/sinoptico-diagrama";
import { SinopticoGraficos } from "@/features/supervisorio/components/sinoptico-graficos";
import { SinopticoGraficosV2 } from "@/features/supervisorio/components/sinoptico-graficos-v2";
import { SinopticoIndicadores } from "@/features/supervisorio/components/sinoptico-indicadores";
import { TransformadorModal } from "@/features/supervisorio/components/transformador-modal";
// TEMPORÁRIO: MQTT comentado - implementar depois
// import { useMqttWebSocket } from "@/hooks/useMqttWebSocket";
import {
  createJunctionNode,
  splitConnectionWithJunction,
  calculateJunctionPositionOnLine,
  detectEdgeClick,
} from "@/features/supervisorio/utils/junctionHelpers";
// import { useHistory } from "@/features/supervisorio/hooks/useHistory";

// NOVO: Imports para integração com backend
// TEMPORÁRIO: Hook comentado - implementar carregamento depois
// import { useDiagramaUnidade } from '@/hooks/useDiagramaUnidade';
import { api } from '@/config/api';
import { ModalSelecionarUnidade } from '@/components/supervisorio/ModalSelecionarUnidade';
import { ModalCriarEquipamentoRapido } from '@/features/supervisorio/components/ModalCriarEquipamentoRapido';
import type { PlantaResponse } from '@/services/plantas.services';
import type { Unidade } from '@/services/unidades.services';

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

// Interface para o estado do diagrama (para histórico)
interface DiagramState {
  componentes: ComponenteDU[];
  connections: Connection[];
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
  { tipo: "DISJUNTOR", icon: Square, label: "Disjuntor (Sem Supervisão)", cor: "bg-red-500" },
  { tipo: "DISJUNTOR_FECHADO", icon: Square, label: "Disjuntor Fechado", cor: "bg-red-500" },
  { tipo: "DISJUNTOR_ABERTO", icon: Square, label: "Disjuntor Aberto", cor: "bg-red-500" },
  { tipo: "MOTOR", icon: Circle, label: "Motor", cor: "bg-purple-500" },
  { tipo: "BOTOEIRA", icon: Circle, label: "Botoeira", cor: "bg-cyan-500" },
  {
    tipo: "CHAVE_ABERTA",
    icon: Square,
    label: "Chave Aberta",
    cor: "bg-amber-500",
  },
  {
    tipo: "CHAVE_FECHADA",
    icon: Square,
    label: "Chave Fechada",
    cor: "bg-amber-500",
  },
  {
    tipo: "CHAVE_FUSIVEL",
    icon: Zap,
    label: "Chave Fusível",
    cor: "bg-orange-500",
  },
  { tipo: "RELE", icon: Triangle, label: "Relé", cor: "bg-indigo-500" },
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

  // Componentes SCADA
  {
    tipo: "M160",
    icon: Gauge,
    label: "M160 Multimedidor",
    cor: "bg-green-600",
  },
  {
    tipo: "M300",
    icon: Activity,
    label: "M300 Multimeter",
    cor: "bg-blue-600",
  },
  {
    tipo: "LANDIS_E750",
    icon: HardDrive,
    label: "Landis+Gyr E750",
    cor: "bg-purple-600",
  },
  { tipo: "A966", icon: Router, label: "A-966 Gateway", cor: "bg-orange-600" },
  { tipo: "PONTO", icon: Circle, label: "Ponto", cor: "bg-blue-500" },
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

// Função helper para obter classes CSS baseado na posição do label
const getLabelPositionClasses = (position?: string) => {
  switch (position) {
    case "top":
      return "absolute -top-6 left-1/2 transform -translate-x-1/2";
    case "bottom":
      return "absolute -bottom-6 left-1/2 transform -translate-x-1/2";
    case "left":
      return "absolute top-1/2 -left-2 transform -translate-x-full -translate-y-1/2";
    case "right":
      return "absolute top-1/2 -right-2 transform translate-x-full -translate-y-1/2";
    default:
      // Default é bottom (padrão antigo)
      return "absolute -bottom-6 left-1/2 transform -translate-x-1/2";
  }
};

// Componente para renderizar símbolos elétricos - APENAS PARA MODO EDIÇÃO
const ElectricalSymbol = React.memo(({
  tipo,
  status = "NORMAL",
  onClick,
  dados,
}: {
  tipo: string;
  status: string;
  onClick?: () => void;
  dados?: any;
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
            transform="rotate(90)"
            style={{ transformOrigin: "center" }}
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
            {/* Apenas bordas, sem preenchimento */}
            <rect
              x="2"
              y="2"
              width="36"
              height="16"
              className={statusClasses.stroke}
              strokeWidth="2"
              rx="2"
              fill="none"
            />
          </svg>
        );
  case "DISJUNTOR_FECHADO":
  return (
    <svg
      width="32"
      height="16"
      viewBox="0 0 40 20"
      className="drop-shadow-sm"
    >
      {/* Apenas bordas vermelhas, sem preenchimento - FECHADO/ENERGIZADO */}
      <rect
        x="2"
        y="2"
        width="36"
        height="16"
        className="stroke-red-600 dark:stroke-red-500"
        strokeWidth="2"
        rx="2"
        fill="none"
      />
    </svg>
  );

case "DISJUNTOR_ABERTO":
  return (
    <svg
      width="32"
      height="16"
      viewBox="0 0 40 20"
      className="drop-shadow-sm"
    >
      {/* Apenas bordas verdes, sem preenchimento - ABERTO/DESENERGIZADO */}
      <rect
        x="2"
        y="2"
        width="36"
        height="16"
        className="stroke-green-600 dark:stroke-green-500"
        strokeWidth="2"
        rx="2"
        fill="none"
      />
    </svg>
  );

        case "BARRAMENTO":
            return (
    <svg
      width="80"
      height="13"
      viewBox="0 0 100 20"
      className="drop-shadow-sm"
    >
      {/* Barra horizontal - mais grossa e simples */}
      <rect
        x="5"
        y="6"
        width="90"
        height="8"
        className={statusClasses.fill}
        rx="2"
      />
      {/* Contorno */}
      <rect
        x="5"
        y="6"
        width="90"
        height="8"
        className={`${statusClasses.stroke} fill-none`}
        strokeWidth="2"
        rx="2"
      />
    </svg>
  );
      case "BOTOEIRA":
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
              r="14"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <circle cx="20" cy="20" r="8" className={statusClasses.fill} />
            <line
              x1="20"
              y1="6"
              x2="20"
              y2="12"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <line
              x1="20"
              y1="28"
              x2="20"
              y2="34"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
          </svg>
        );

      case "CHAVE_ABERTA":
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <circle
              cx="10"
              cy="20"
              r="4"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <circle
              cx="30"
              cy="20"
              r="4"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            {/* Linha diagonal = aberta */}
            <line
              x1="10"
              y1="20"
              x2="26"
              y2="8"
              className="stroke-red-600"
              strokeWidth="2"
            />
          </svg>
        );

      case "CHAVE_FECHADA":
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <circle
              cx="10"
              cy="20"
              r="4"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <circle
              cx="30"
              cy="20"
              r="4"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            {/* Linha horizontal = fechada */}
            <line
              x1="10"
              y1="20"
              x2="30"
              y2="20"
              className="stroke-green-600"
              strokeWidth="2"
            />
          </svg>
        );

      case "CHAVE_FUSIVEL":
        return (
          <svg width="48" height="32" viewBox="0 0 60 40" className="drop-shadow-sm">
            <line x1="5" y1="20" x2="22" y2="20" className={statusClasses.stroke} strokeWidth="2.5" />
            <circle cx="30" cy="20" r="10" className={`${statusClasses.stroke} fill-background`} strokeWidth="2.5" />
            <path d="M 22 20 A 8 8 0 0 0 38 20" className={statusClasses.stroke} strokeWidth="2" fill="none" />
            <line x1="38" y1="20" x2="55" y2="20" className={statusClasses.stroke} strokeWidth="2.5" />
            <circle cx="5" cy="20" r="2.5" className={statusClasses.fill} />
            <circle cx="55" cy="20" r="2.5" className={statusClasses.fill} />
            <text x="30" y="20" textAnchor="middle" dominantBaseline="middle" fontSize="7" fontWeight="600" className={statusClasses.fill}>CF</text>
          </svg>
        );
        case "PONTO":
case "PONTO_JUNCAO":
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      className="drop-shadow-sm"
    >
      {/* Círculo principal - ponto de junção */}
      <circle
        cx="10"
        cy="10"
        r="6"
        className={statusClasses.fill}
      />
      {/* Contorno */}
      <circle
        cx="10"
        cy="10"
        r="6"
        className={`${statusClasses.stroke} fill-none`}
        strokeWidth="2"
      />
      {/* Ponto central menor para dar profundidade */}
      <circle
        cx="10"
        cy="10"
        r="3"
        className="fill-background"
        opacity="0.3"
      />
    </svg>
  );

      case "RELE":
        return (
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            className="drop-shadow-sm"
          >
            <rect
              x="8"
              y="8"
              width="24"
              height="24"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            <line
              x1="14"
              y1="20"
              x2="26"
              y2="20"
              className={statusClasses.stroke}
              strokeWidth="2"
            />
            <circle cx="14" cy="20" r="2" className={statusClasses.fill} />
            <circle cx="26" cy="20" r="2" className={statusClasses.fill} />
            <path
              d="M20,14 L20,26"
              className={statusClasses.stroke}
              strokeWidth="1.5"
              strokeDasharray="2,2"
            />
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
      case "M160":
      case "METER_M160": // ✅ Suporte ao novo código
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
              rx="6"
            />
            <circle
              cx="20"
              cy="15"
              r="6"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="1.5"
            />
            <text
              x="20"
              y="15"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="6"
              fontWeight="600"
              className={statusClasses.fill}
            >
              M160
            </text>
            <line
              x1="8"
              y1="28"
              x2="32"
              y2="28"
              className={statusClasses.stroke}
              strokeWidth="1.5"
            />
            <circle cx="12" cy="28" r="1.5" className={statusClasses.fill} />
            <circle cx="20" cy="28" r="1.5" className={statusClasses.fill} />
            <circle cx="28" cy="28" r="1.5" className={statusClasses.fill} />
          </svg>
        );

      case "M300":
        return (
          <svg
            width="36"
            height="36"
            viewBox="0 0 44 44"
            className="drop-shadow-sm"
          >
            {/* Corpo retangular do multímetro */}
            <rect
              x="4"
              y="4"
              width="36"
              height="36"
              rx="4"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />

            {/* Display LCD (retângulo superior) */}
            <rect
              x="8"
              y="8"
              width="28"
              height="10"
              rx="1"
              className="fill-gray-800 stroke-gray-600"
              strokeWidth="1"
            />

            {/* Texto M300 */}
            <text
              x="22"
              y="28"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="600"
              className={statusClasses.fill}
            >
              M300
            </text>

            {/* LEDs de status (pequenos círculos) */}
            <circle cx="10" cy="32" r="2" className={statusClasses.fill} />
            <circle cx="16" cy="32" r="2" className={statusClasses.fill} />

            {/* Conectores na parte inferior */}
            <rect
              x="12"
              y="38"
              width="2"
              height="4"
              className="fill-gray-600"
            />
            <rect
              x="18"
              y="38"
              width="2"
              height="4"
              className="fill-gray-600"
            />
            <rect
              x="24"
              y="38"
              width="2"
              height="4"
              className="fill-gray-600"
            />
            <rect
              x="30"
              y="38"
              width="2"
              height="4"
              className="fill-gray-600"
            />
          </svg>
        );

      case "LANDIS_E750":
        return (
          <svg
            width="40"
            height="40"
            viewBox="0 0 50 50"
            className="drop-shadow-sm"
          >
            {/* Corpo principal do medidor */}
            <rect
              x="5"
              y="5"
              width="40"
              height="40"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="4"
            />

            {/* Display LCD superior */}
            <rect
              x="9"
              y="9"
              width="32"
              height="12"
              className={statusClasses.fill}
              rx="2"
            />

            {/* Texto E750 no display */}
            <text
              x="25"
              y="15"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="7"
              fontWeight="600"
              className="fill-background"
            >
              E750
            </text>

            {/* Indicadores de energia (3 retângulos) */}
            <rect
              x="9"
              y="25"
              width="8"
              height="5"
              className={statusClasses.fill}
              rx="1"
            />
            <rect
              x="21"
              y="25"
              width="8"
              height="5"
              className={statusClasses.fill}
              rx="1"
            />
            <rect
              x="33"
              y="25"
              width="8"
              height="5"
              className={statusClasses.fill}
              rx="1"
            />

            {/* Logo/Marca SyM2 */}
            <text
              x="25"
              y="38"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="6"
              fontWeight="600"
              className={statusClasses.fill}
            >
              SyM²
            </text>
          </svg>
        );

      case "A966":
        return (
          <svg
            width="40"
            height="32"
            viewBox="0 0 50 40"
            className="drop-shadow-sm"
          >
            {/* Corpo do gateway */}
            <rect
              x="5"
              y="5"
              width="40"
              height="30"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="4"
            />

            {/* Antena WiFi esquerda */}
            <path
              d="M 12 5 Q 12 2 15 1"
              fill="none"
              className={statusClasses.stroke}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Antena WiFi direita */}
            <path
              d="M 38 5 Q 38 2 35 1"
              fill="none"
              className={statusClasses.stroke}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Indicadores de sinal */}
            <circle cx="15" cy="15" r="2" className={statusClasses.fill} />
            <circle cx="25" cy="15" r="2" className={statusClasses.fill} />
            <circle cx="35" cy="15" r="2" className={statusClasses.fill} />

            {/* Portas de comunicação */}
            <rect
              x="12"
              y="23"
              width="6"
              height="4"
              className="fill-blue-500"
              rx="1"
            />
            <rect
              x="22"
              y="23"
              width="6"
              height="4"
              className="fill-blue-500"
              rx="1"
            />
            <rect
              x="32"
              y="23"
              width="6"
              height="4"
              className="fill-blue-500"
              rx="1"
            />

            {/* Label A966 */}
            <text
              x="25"
              y="12"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="7"
              fontWeight="600"
              className={statusClasses.fill}
            >
              A966
            </text>
          </svg>
        );

      case "PIVO":
        // Renderização do PIVO com suporte a estado simulado
        const isOperando = dados?.operando || false;

        return (
          <svg
            width="48"
            height="48"
            viewBox="0 0 60 60"
            className="drop-shadow-sm"
          >
            {/* Círculo externo - área de irrigação */}
            <circle
              cx="30"
              cy="30"
              r="24"
              className={`${statusClasses.stroke} fill-none`}
              strokeWidth="2"
              strokeDasharray="4,2"
              opacity={isOperando ? "0.6" : "0.3"}
            />

            {/* Círculo intermediário */}
            <circle
              cx="30"
              cy="30"
              r="18"
              className={`${statusClasses.stroke} fill-none`}
              strokeWidth="1"
              opacity={isOperando ? "0.3" : "0.2"}
            />

            {/* Ponto central - torre fixa */}
            <circle cx="30" cy="30" r="4" className={statusClasses.fill} />

            {/* Anel interno no centro */}
            <circle
              cx="30"
              cy="30"
              r="6"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="1.5"
            />

            {/* Braço do pivô - com animação quando irrigando */}
            <g className={isOperando ? "animate-spin-slow" : ""} style={{ transformOrigin: "30px 30px" }}>
              <line
                x1="30"
                y1="30"
                x2="54"
                y2="30"
                className={statusClasses.stroke}
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Seta na ponta */}
              <path
                d="M 50 26 L 54 30 L 50 34"
                className={statusClasses.stroke}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              {/* Gotas de água - visíveis quando irrigando */}
              {isOperando && (
                <>
                  <circle cx="38" cy="30" r="1.5" className="fill-blue-400">
                    <animate
                      attributeName="opacity"
                      values="1;0.3;1"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx="44" cy="30" r="1.5" className="fill-blue-400">
                    <animate
                      attributeName="opacity"
                      values="0.3;1;0.3"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx="50" cy="30" r="1.5" className="fill-blue-400">
                    <animate
                      attributeName="opacity"
                      values="1;0.3;1"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}
            </g>

            {/* LED de status - pisca quando irrigando */}
            <circle
              cx="52"
              cy="8"
              r="5"
              className={statusClasses.fill}
              opacity="0.9"
            >
              {isOperando && (
                <animate
                  attributeName="opacity"
                  values="0.9;0.4;0.9"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              )}
            </circle>

            {/* Label dinâmico */}
            <text
              x="30"
              y="32"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fontWeight="700"
              className="fill-background"
              style={{ pointerEvents: "none" }}
            >
              {isOperando ? "PF" : "PV"}
            </text>
          </svg>
        );

      case "JUNCTION":
        // Junction node - apenas um pequeno ponto azul
        return (
          <svg
            width="6"
            height="6"
            viewBox="0 0 6 6"
            style={{ overflow: "visible" }}
          >
            <circle
              cx="3"
              cy="3"
              r="2.5"
              className="fill-blue-600 dark:fill-blue-400"
            />
          </svg>
        );

      case "PAINEL_SOLAR":
      case "placa_solar":
        // Módulo Fotovoltaico
        return (
          <svg
            width="40"
            height="36"
            viewBox="0 0 200 180"
            className="drop-shadow-sm"
          >
            {/* Retângulo externo (módulo fotovoltaico) */}
            <rect
              x="20"
              y="20"
              width="160"
              height="120"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2.5"
            />

            {/* Triângulo invertido (estilo envelope - ponta no meio) */}
            <polygon
              points="20,20 100,80 180,20"
              className={statusClasses.stroke}
              strokeWidth="2.5"
              fill="none"
            />

            {/* Linha vertical de conexão */}
            <line
              x1="100"
              y1="140"
              x2="100"
              y2="170"
              className={statusClasses.stroke}
              strokeWidth="2.5"
            />

            {/* Texto "PV" */}
            <text
              x="100"
              y="130"
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              className={statusClasses.fill}
            >
              PV
            </text>
          </svg>
        );

      case "PIVO_ABERTO":
        return (
          <svg
            width="40"
            height="40"
            viewBox="0 0 50 50"
            className="drop-shadow-sm"
          >
            <circle
              cx="25"
              cy="25"
              r="22"
              className="stroke-green-600 dark:stroke-green-400 fill-background"
              strokeWidth="2"
            />
            <circle
              cx="25"
              cy="25"
              r="16"
              className="stroke-green-600 dark:stroke-green-400 fill-none"
              strokeWidth="1.5"
              strokeDasharray="3,2"
            />
            <text
              x="25"
              y="28"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fontWeight="600"
              className="fill-green-600 dark:fill-green-400"
            >
              PV
            </text>
          </svg>
        );

      case "PIVO_FECHADO":
        return (
          <svg
            width="40"
            height="40"
            viewBox="0 0 50 50"
            className="drop-shadow-sm"
          >
            <circle
              cx="25"
              cy="25"
              r="22"
              className="stroke-red-600 dark:stroke-red-400 fill-red-100 dark:fill-red-900"
              strokeWidth="2"
            />
            <circle
              cx="25"
              cy="25"
              r="16"
              className="stroke-red-600 dark:stroke-red-400 fill-none"
              strokeWidth="1.5"
            />
            <text
              x="25"
              y="28"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fontWeight="600"
              className="fill-red-600 dark:fill-red-400"
            >
              PF
            </text>
          </svg>
        );

      case "PAINEL_PMT":
        return (
          <svg width="40" height="32" viewBox="0 0 50 40" className="drop-shadow-sm">
            <rect
              x="5"
              y="5"
              width="40"
              height="30"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <circle cx="15" cy="15" r="2" className={statusClasses.fill} />
            <circle cx="25" cy="15" r="2" className={statusClasses.fill} />
            <circle cx="35" cy="15" r="2" className={statusClasses.fill} />
            <circle cx="15" cy="25" r="2" className={statusClasses.fill} />
            <circle cx="25" cy="25" r="2" className={statusClasses.fill} />
            <circle cx="35" cy="25" r="2" className={statusClasses.fill} />
            <text
              x="25"
              y="20"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7"
              fontWeight="600"
              className={statusClasses.fill}
            >
              PMT
            </text>
          </svg>
        );

      case "SALA_COMANDO":
        return (
          <svg width="48" height="36" viewBox="0 0 60 45" className="drop-shadow-sm">
            <rect
              x="5"
              y="5"
              width="50"
              height="35"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            <rect x="10" y="12" width="18" height="12" className={statusClasses.fill} rx="1" />
            <rect x="32" y="12" width="18" height="12" className={statusClasses.fill} rx="1" />
            <line x1="15" y1="30" x2="25" y2="30" className={statusClasses.stroke} strokeWidth="1.5" />
            <line x1="35" y1="30" x2="45" y2="30" className={statusClasses.stroke} strokeWidth="1.5" />
            <text
              x="30"
              y="40"
              textAnchor="middle"
              fontSize="6"
              fontWeight="600"
              className={statusClasses.fill}
            >
              CTRL
            </text>
          </svg>
        );

      case "SCADA":
        return (
          <svg width="40" height="32" viewBox="0 0 50 40" className="drop-shadow-sm">
            <rect
              x="5"
              y="8"
              width="40"
              height="24"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="2"
            />
            <line x1="5" y1="14" x2="45" y2="14" className={statusClasses.stroke} strokeWidth="1" />
            <circle cx="15" cy="21" r="3" className={statusClasses.fill} />
            <circle cx="25" cy="21" r="3" className={statusClasses.fill} />
            <circle cx="35" cy="21" r="3" className={statusClasses.fill} />
            <text
              x="25"
              y="11"
              textAnchor="middle"
              fontSize="5"
              fontWeight="600"
              className={statusClasses.fill}
            >
              SCADA
            </text>
          </svg>
        );

      case "SKID":
        return (
          <svg width="48" height="32" viewBox="0 0 60 40" className="drop-shadow-sm">
            <rect
              x="5"
              y="5"
              width="50"
              height="30"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <rect x="12" y="12" width="10" height="16" className={statusClasses.fill} rx="1" />
            <rect x="25" y="12" width="10" height="16" className={statusClasses.fill} rx="1" />
            <rect x="38" y="12" width="10" height="16" className={statusClasses.fill} rx="1" />
            <text
              x="30"
              y="35"
              textAnchor="middle"
              fontSize="6"
              fontWeight="600"
              className={statusClasses.fill}
            >
              SKID
            </text>
          </svg>
        );

      case "TELECOM":
        return (
          <svg width="32" height="32" viewBox="0 0 40 40" className="drop-shadow-sm">
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
              rx="3"
            />
            <circle cx="13" cy="13" r="2" className={statusClasses.fill} />
            <circle cx="27" cy="13" r="2" className={statusClasses.fill} />
            <path
              d="M20,20 Q15,25 10,30 M20,20 Q25,25 30,30"
              className={statusClasses.stroke}
              strokeWidth="1.5"
              fill="none"
            />
            <text
              x="20"
              y="36"
              textAnchor="middle"
              fontSize="6"
              fontWeight="600"
              className={statusClasses.fill}
            >
              TEL
            </text>
          </svg>
        );

      case "CFTV":
        return (
          <svg width="32" height="32" viewBox="0 0 40 40" className="drop-shadow-sm">
            <circle
              cx="20"
              cy="20"
              r="16"
              className={`${statusClasses.stroke} fill-background`}
              strokeWidth="2"
            />
            <circle cx="20" cy="20" r="8" className={statusClasses.fill} />
            <circle cx="20" cy="20" r="4" className="fill-background" />
            <text
              x="20"
              y="36"
              textAnchor="middle"
              fontSize="6"
              fontWeight="600"
              className={statusClasses.fill}
            >
              CAM
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
      {/* Não mostrar indicador de status para PONTO e JUNCTION */}
      {tipo !== "PONTO" && tipo !== "PONTO_JUNCAO" && tipo !== "JUNCTION" && (
        <div
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background shadow-lg ${statusClasses.bg}`}
        />
      )}
    </div>
  );
});
// Modal LandisGyr inline
function LandisGyrModalInline({
  open,
  onClose,
  dados,
  nomeComponente,
}: {
  open: boolean;
  onClose: () => void;
  dados: LandisGyrE750Reading;
  nomeComponente: string;
}) {
  const [Component, setComponent] = React.useState<any>(null);

  React.useEffect(() => {
    import("@/components/equipment/LandisGyr/LandisGyrE750").then((m) =>
      setComponent(() => m.default)
    );
  }, []);

  if (!Component) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-purple-500" />
            {nomeComponente} - Medidor Landis+Gyr E750
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center items-center py-6">
          <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
            <Component
              id="landisgyr-modal"
              name={nomeComponente}
              readings={dados}
              status="online"
              scale={1.0}
              onConfig={() => console.log("Config")}
            />
            <div className="mt-6 text-center">
              <Badge variant="outline" className="text-xs">
                Medidor Inteligente em Tempo Real
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function SinopticoAtivoPage() {
  const { ativoId: ativoIdRaw } = useParams<{ ativoId?: string }>();
  const navigate = useNavigate();

  // Limpar espaços em branco do ID da URL
  const ativoId = ativoIdRaw?.trim();

  // NOVO: Estados para integração com backend
  const [unidadeId, setUnidadeId] = useState<string | undefined>(ativoId);
  const [plantaAtual, setPlantaAtual] = useState<PlantaResponse | null>(null);
  const [unidadeAtual, setUnidadeAtual] = useState<Unidade | null>(null);
  // Abrir modal automaticamente se não tiver unidade selecionada
  const [modalSelecionarUnidade, setModalSelecionarUnidade] = useState(!ativoId);

  // TEMPORÁRIO: Hook comentado para evitar loop infinito - implementar carregamento depois
  // const {
  //   unidade,
  //   diagrama,
  //   equipamentos,
  //   componentes: componentesCarregados,
  //   loading: loadingDiagrama,
  //   error: errorDiagrama,
  //   reloadDiagrama,
  //   saveDiagrama,
  // } = useDiagramaUnidade(unidadeId);

  const [loadingDiagrama, setLoadingDiagrama] = useState(false);
  const [errorDiagrama, setErrorDiagrama] = useState<string | null>(null);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [diagramaIdAtual, setDiagramaIdAtual] = useState<string | null>(null);
  const [isSavingDiagrama, setIsSavingDiagrama] = useState(false);

  // Atualizar título da página quando unidade carrega
  useEffect(() => {
    if (unidadeAtual?.nome) {
      document.title = `Sinóptico - ${unidadeAtual.nome}`;
    } else {
      document.title = 'Sinóptico';
    }

    // Cleanup: restaurar título ao desmontar
    return () => {
      document.title = 'AupusNexOn';
    };
  }, [unidadeAtual]);

  // Carregar dados da unidade quando o componente monta ou quando unidadeId muda
  useEffect(() => {
    const carregarUnidade = async () => {
      if (!unidadeId) return;

      try {
        const response = await api.get(`/unidades/${unidadeId}`);
        const unidadeData = response.data?.data || response.data;

        // Converter snake_case para camelCase
        const unidadeFormatada: Unidade = {
          ...unidadeData,
          demandaGeracao: unidadeData.demanda_geracao || unidadeData.demandaGeracao,
          demandaCarga: unidadeData.demanda_carga || unidadeData.demandaCarga,
          tipoUnidade: unidadeData.tipo_unidade || unidadeData.tipoUnidade,
          concessionariaId: unidadeData.concessionaria_id || unidadeData.concessionariaId,
          plantaId: unidadeData.planta_id || unidadeData.plantaId,
        };

        setUnidadeAtual(unidadeFormatada);

        // Carregar planta se tiver plantaId
        if (unidadeData.planta_id) {
          try {
            const plantaResponse = await api.get(`/plantas/${unidadeData.planta_id}`);
            const plantaData = plantaResponse.data?.data || plantaResponse.data;
            setPlantaAtual(plantaData);
          } catch (err) {
            console.error('❌ Erro ao carregar planta:', err);
          }
        }
      } catch (error) {
        console.error('❌ [SINÓPTICO] Erro ao carregar unidade:', error);
      }
    };

    carregarUnidade();
  }, [unidadeId]);

  const reloadDiagrama = useCallback(async () => {
    if (!unidadeId) return;
    console.log('🔄 Recarregando diagrama da unidade:', unidadeId);
    await loadDiagramaFromBackend();
  }, [unidadeId]);

  // Estado local dos componentes (para edição)
  const [componentes, setComponentes] = useState<ComponenteDU[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [diagramaCarregado, setDiagramaCarregado] = useState(false);

  // Rastrear equipamentos que tiveram nome/tag modificados (para otimizar salvamento)
  const [equipamentosModificados, setEquipamentosModificados] = useState<Set<string>>(new Set());

  // OTIMIZAÇÃO: Log simplificado sem stack trace
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔄 [STATE] connections:', connections.length);
    }
  }, [connections]);

  // Função para carregar diagrama do backend
  const loadDiagramaFromBackend = useCallback(async () => {
    if (!unidadeId) return;

    console.log('📡 Carregando diagrama e equipamentos do backend para unidade:', unidadeId);
    setLoadingDiagrama(true);
    setErrorDiagrama(null);

    try {
      // OTIMIZAÇÃO: Carregar equipamentos e diagrama em PARALELO
      const [
        { equipamentosApi },
        { DiagramasService }
      ] = await Promise.all([
        import('@/services/equipamentos.services'),
        import('@/services/diagramas.services')
      ]);

      const [equipamentosResponse, diagramaAtivo] = await Promise.all([
        equipamentosApi.findByUnidade(unidadeId, { limit: 100 }),
        DiagramasService.getActiveDiagrama(unidadeId).catch(() => null)
      ]);

      // Processar equipamentos
      const equipamentosData = Array.isArray(equipamentosResponse?.data?.data)
        ? equipamentosResponse.data.data
        : Array.isArray(equipamentosResponse?.data)
          ? equipamentosResponse.data
          : Array.isArray(equipamentosResponse)
            ? equipamentosResponse
            : [];
      console.log('✅ Equipamentos carregados:', equipamentosData.length);
      setEquipamentos(equipamentosData);

      if (diagramaAtivo) {
        setDiagramaIdAtual(diagramaAtivo.id.trim());

        // Buscar diagrama completo com equipamentos e conexões
        try {
          const diagramaCompleto = await DiagramasService.getDiagrama(diagramaAtivo.id);

          // Converter equipamentos do backend para componentes do frontend
          const componentesCarregados = (diagramaCompleto.equipamentos || []).map((eq: any) => {
            const equipamentoId = (eq.id || '').trim();
            // Para BARRAMENTO/PONTO, usar tipo_equipamento direto. Para outros, usar tipo.codigo
            const tipoComponente = eq.tipo_equipamento || eq.tipo?.codigo || 'MEDIDOR';

            return {
              id: `eq-${equipamentoId}`,
              tipo: tipoComponente,
              nome: eq.nome,
              tag: eq.tag,
              posicao: {
                x: eq.posicao?.x || 0,
                y: eq.posicao?.y || 0,
              },
              rotacao: eq.rotacao || 0,
              label_position: eq.label_position || 'bottom',
              status: eq.status || 'NORMAL',
              dados: {
                equipamento_id: equipamentoId,
                tag: eq.tag,
                fabricante: eq.fabricante,
                modelo: eq.modelo,
                mqtt_topico: eq.topico_mqtt,
                mqtt_habilitado: eq.mqtt_habilitado,
                ...eq.propriedades,
              },
            };
          });

          // Converter TODAS as conexões do backend (incluindo virtuais)
          const conexoesCarregadas = (diagramaCompleto.conexoes || []).map((conn: any) => {
            const origemId = (conn.origem?.equipamentoId || '').trim();
            const destinoId = (conn.destino?.equipamentoId || '').trim();

            const fromId = `eq-${origemId}`;
            const toId = `eq-${destinoId}`;

            return {
              id: conn.id,
              from: fromId,
              to: toId,
              fromPort: conn.origem?.porta,
              toPort: conn.destino?.porta,
              source: fromId,
              target: toId,
              sourceHandle: conn.origem?.porta,
              targetHandle: conn.destino?.porta,
              style: {
                stroke: conn.visual?.cor || '#22c55e',
                strokeWidth: conn.visual?.espessura || 2,
              },
            };
          });

          setComponentes(componentesCarregados);
          setConnections(conexoesCarregadas);
          if (import.meta.env.DEV) {
            console.log('✅ Diagrama:', componentesCarregados.length, 'componentes,', conexoesCarregadas.length, 'conexões');
          }
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error('Erro ao carregar diagrama:', err);
          }
          setComponentes([]);
          setConnections([]);
        }
      } else {
        setComponentes([]);
        setConnections([]);
      }

      setDiagramaCarregado(true);
      // Limpar equipamentos modificados ao carregar novo diagrama
      setEquipamentosModificados(new Set());
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar diagrama:', error);
      }
      setErrorDiagrama(error.message || 'Erro ao carregar diagrama');
      setComponentes([]);
      setConnections([]);
      setDiagramaCarregado(false);
    } finally {
      setLoadingDiagrama(false);
    }
  }, [unidadeId]);

  // Carregar diagrama quando selecionar uma unidade
  useEffect(() => {
    if (unidadeId) {
      loadDiagramaFromBackend();
    } else {
      // Limpar componentes se não houver unidade
      setComponentes([]);
      setConnections([]);
      setEquipamentos([]);
      setDiagramaCarregado(false);
    }
  }, [unidadeId, loadDiagramaFromBackend]);

  // Estados para modais
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [componenteSelecionado, setComponenteSelecionado] =
    useState<ComponenteDU | null>(null);
  const [diagramaFullscreen, setDiagramaFullscreen] = useState(false);

  // OTIMIZAÇÃO: Log simplificado
  useEffect(() => {
    if (import.meta.env.DEV && componenteSelecionado) {
      console.log('🔄 Selecionado:', componenteSelecionado.nome);
    }
  }, [componenteSelecionado]);

  // Estados para modal MQTT do inversor
  const [inversorMqttModalOpen, setInversorMqttModalOpen] = useState(false);
  const [selectedInversorMqttId, setSelectedInversorMqttId] = useState<string | null>(null);
  const [pivoModalOpen, setPivoModalOpen] = useState(false);
  const [selectedPivoId, setSelectedPivoId] = useState<string | null>(null);

  // Estado para modal de criação rápida de equipamentos
  const [modalCriarRapido, setModalCriarRapido] = useState(false);
  // Estado simulado dos pivôs (chave: equipamento_id, valor: dados do pivô)
  const [pivoStates, setPivoStates] = useState<Record<string, any>>({});

  // Estado removido - seleção múltipla não é necessária
  // A seleção de equipamentos para o gráfico de demanda é feita via modal de configuração

  // Estados para o modo de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  // CORRIGIDO: Tipo ajustado para "selecionar" | "conectar"
  const [modoFerramenta, setModoFerramenta] = useState<
    "selecionar" | "conectar"
  >("selecionar");
  const [componenteEditando, setComponenteEditando] = useState<string | null>(
    null
  );

  // OTIMIZAÇÃO: Log simplificado
  useEffect(() => {
    if (import.meta.env.DEV && componenteEditando) {
      console.log('🔄 Editando:', componenteEditando);
    }
  }, [componenteEditando]);

  // Estados para drag and drop
  const [isDragging, setIsDragging] = useState(false);

  // Hook para configurações do grid (apenas visual)
  const {
    gridSettings,
    toggleGrid,
    updateGridSize,
    updateOpacity
  } = useGridSettings();
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [componenteDragId, setComponenteDragId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const diagramCardRef = useRef<HTMLDivElement>(null);

  // Helper para pegar o canvas correto baseado no contexto
  const getActiveCanvasRef = useCallback(() => {
    return canvasRef;
  }, []);

  // Funções para gerenciar fullscreen nativo
  const toggleFullscreen = useCallback(async () => {
    if (!diagramCardRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await diagramCardRef.current.requestFullscreen();
        setDiagramaFullscreen(true);
      } else {
        await document.exitFullscreen();
        setDiagramaFullscreen(false);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Erro fullscreen:", error);
      }
    }
  }, []);

  // Listener para mudanças no fullscreen (ESC, etc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setDiagramaFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Prevenir navegação durante salvamento
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSavingDiagrama) {
        e.preventDefault();
        e.returnValue = 'O diagrama está sendo salvo. Tem certeza que deseja sair?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSavingDiagrama]);

  // Estados para conexões
  const [connecting, setConnecting] = useState<{
    from: string;
    port: "top" | "bottom" | "left" | "right";
  } | null>(null);

  // Função auxiliar para atualizar o diagrama
  const updateDiagram = useCallback(
    (
      newComponentes?: ComponenteDU[],
      newConnections?: Connection[]
    ) => {
      if (newComponentes) setComponentes(newComponentes);
      if (newConnections) setConnections(newConnections);
    },
    []
  );

  // REMOVIDO: useEffect de carregamento - agora usa hook useDiagramaUnidade
  // REMOVIDO: useEffect de auto-save - salvamento manual via botão

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

  // TEMPORÁRIO: MQTT desabilitado - implementar depois de salvar diagrama funcionar
  // const { data: m160Data } = useMqttWebSocket("");
  // const { data: a966Data } = useMqttWebSocket("");
  // const { data: landisData } = useMqttWebSocket("");
  const m160Data = null;

  // Estado para histórico de dados MQTT (usado nos gráficos)
  const [historicoMqtt, setHistoricoMqtt] = useState<any[]>([]);

  // TEMPORÁRIO: useEffect MQTT comentado
  // useEffect(() => {
  //   if (m160Data?.payload?.Dados) {
  //     const agora = Date.now();
  //     if (agora - ultimaAtualizacaoRef.current < 5000) {
  //       return;
  //     }
  //     ultimaAtualizacaoRef.current = agora;
  //     const m160Dados = m160Data.payload.Dados;
  //     const timestamp = new Date().toISOString();
  //     const novoPonto = {
  //       timestamp,
  //       potencia: ((m160Dados.Pa || 0) + (m160Dados.Pb || 0) + (m160Dados.Pc || 0)),
  //       tensao: ((m160Dados.Va || 0)),
  //       corrente: ((m160Dados.Ia || 0) + (m160Dados.Ib || 0) + (m160Dados.Ic || 0)),
  //       fatorPotencia: (m160Dados.FPA !== 999 && m160Dados.FPA !== 0) ? m160Dados.FPA / 1000 : 1,
  //       limiteMinimo: 0.92,
  //     };
  //     setHistoricoMqtt(prev => {
  //       const novoHistorico = [...prev, novoPonto];
  //       return novoHistorico.slice(-100);
  //     });
  //   }
  // }, [m160Data]);

  // Dados do gráfico - recalcula quando a unidade muda
  const dadosGraficos = useMemo(() => {
    const agora = new Date();

    // Usar demanda de geração da unidade, se existir
    const demandaBase = unidadeAtual?.demandaGeracao || 1800;

    return Array.from({ length: 288 }, (_, i) => {
      // 288 pontos = 24h em intervalos de 5 min
      const timestamp = new Date(
        agora.getTime() - (287 - i) * 5 * 60 * 1000 // 5 minutos entre cada ponto
      ).toISOString();

      // Simula um dia típico com picos de demanda baseado na demanda real da unidade
      const hora = i / 12; // Converte índice para hora do dia
      let potencia = demandaBase * 0.7; // Base: 70% da demanda

      // Padrão diário: baixa demanda de madrugada, picos nos horários comerciais
      if (hora >= 6 && hora < 9) {
        // Manhã: aumento progressivo (70% a 85% da demanda)
        potencia = demandaBase * 0.7 + (hora - 6) * (demandaBase * 0.05) + Math.random() * (demandaBase * 0.05);
      } else if (hora >= 9 && hora < 12) {
        // Meio da manhã: demanda alta (85% a 95%)
        potencia =
          demandaBase * 0.85 + Math.sin((hora - 9) * Math.PI) * (demandaBase * 0.1) + Math.random() * (demandaBase * 0.08);
      } else if (hora >= 12 && hora < 14) {
        // Horário de almoço: pico máximo (95% a 105% - pode ultrapassar!)
        potencia =
          demandaBase * 0.95 +
          Math.sin((hora - 12) * Math.PI * 2) * (demandaBase * 0.1) +
          Math.random() * (demandaBase * 0.08);
      } else if (hora >= 14 && hora < 18) {
        // Tarde: demanda elevada (80% a 95%)
        potencia =
          demandaBase * 0.85 + Math.sin((hora - 14) * Math.PI) * (demandaBase * 0.1) + Math.random() * (demandaBase * 0.06);
      } else if (hora >= 18 && hora < 20) {
        // Final do expediente: novo pico (90% a 105%)
        potencia =
          demandaBase * 0.90 + Math.sin((hora - 18) * Math.PI) * (demandaBase * 0.12) + Math.random() * (demandaBase * 0.05);
      } else {
        // Madrugada/noite: demanda baixa (60% a 70%)
        potencia = demandaBase * 0.6 + Math.random() * (demandaBase * 0.1);
      }

      return {
        timestamp,
        potencia: Math.round(potencia * 10) / 10,
        tensao: 220 + Math.sin((i / 288) * Math.PI * 2) * 3 + Math.random() * 2,
        corrente:
          8000 + Math.sin((i / 288) * Math.PI * 2) * 2000 + Math.random() * 500,
        fatorPotencia: Math.min(
          0.92,
          0.85 + Math.sin((i / 288) * Math.PI * 4) * 0.05 + Math.random() * 0.02
        ),
        limiteMinimo: 0.92,
      };
    });
  }, [unidadeAtual]);

  // Calcular indicadores baseados em dados MQTT ou usar valores fixos
  const indicadores = useMemo(() => {
    if (m160Data?.payload?.Dados) {
      // Extrair dados do M160
      const m160Dados = m160Data.payload.Dados;
      const Va = m160Dados.Va || 0;
      const Vb = m160Dados.Vb || 0;
      const Vc = m160Dados.Vc || 0;
      const FPA = m160Dados.FPA || 0;

      // Calcular FP médio (converter de escala 0-999 para 0-1)
      const fpMedia = FPA !== 999 ? FPA / 1000 : 0.95;

      // Calcular desequilíbrio de tensão (DT)
      const tensaoMedia = (Va + Vb + Vc) / 3;
      const maxDesvio = Math.max(
        Math.abs(Va - tensaoMedia),
        Math.abs(Vb - tensaoMedia),
        Math.abs(Vc - tensaoMedia)
      );
      const dt = tensaoMedia > 0 ? (maxDesvio / tensaoMedia) * 100 : 2.1;

      return {
        thd: 3.2,
        fp: fpMedia,
        dt: dt,
        frequencia: 60.0,
        alarmes: 0,
        falhas: 0,
        urgencias: 0,
        osAbertas: 0,
      };
    }

    // Valores padrão quando não há dados MQTT
    return {
      thd: 3.2,
      fp: 0.95,
      dt: 2.1,
      frequencia: 60.02,
      alarmes: 1,
      falhas: 0,
      urgencias: 0,
      osAbertas: 2,
    };
  }, [m160Data]);

  // Sistema de Undo/Redo simples
  const [history, setHistory] = useState<DiagramState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addToHistory = useCallback(
    (state: DiagramState) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(state);
        return newHistory.slice(-50); // Manter apenas as últimas 50 ações
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  const undo = useCallback(() => {
    if (canUndo) {
      const prevState = history[historyIndex - 1];
      setComponentes(prevState.componentes);
      setConnections(prevState.connections);
      setHistoryIndex((prev) => prev - 1);
    }
  }, [canUndo, history, historyIndex]);

  const redo = useCallback(() => {
    if (canRedo) {
      const nextState = history[historyIndex + 1];
      setComponentes(nextState.componentes);
      setConnections(nextState.connections);
      setHistoryIndex((prev) => prev + 1);
    }
  }, [canRedo, history, historyIndex]);

  // OTIMIZAÇÃO: Debounce para atualizar histórico (evita JSON.stringify frequente)
  const debouncedAddToHistory = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (state: DiagramState) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const lastState = history[historyIndex];
          // Comparação simples por tamanho primeiro
          if (!lastState ||
              lastState.componentes.length !== state.componentes.length ||
              lastState.connections.length !== state.connections.length) {
            addToHistory(state);
          }
        }, 500); // 500ms de debounce
      };
    })(),
    [historyIndex, history, addToHistory]
  );

  // Atualizar histórico quando componentes/conexões mudarem
  useEffect(() => {
    if (diagramaCarregado && componentes.length > 0) {
      debouncedAddToHistory({ componentes, connections });
    }
  }, [componentes, connections, diagramaCarregado, debouncedAddToHistory]);

  // Atalhos de teclado para undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case "z":
            if (event.shiftKey) {
              event.preventDefault();
              redo();
            } else {
              event.preventDefault();
              undo();
            }
            break;
          case "y":
            event.preventDefault();
            redo();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Mock data para modais
  const dadosMedidor = {
    ufer: 0.952,
    demanda: 24855.0, // Multiplicado por 10
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

  const dadosM160: M160Reading = {
    voltage: {
      L1: 220.5,
      L2: 219.8,
      L3: 221.2,
      LN: 127.3,
    },
    current: {
      L1: 15.2,
      L2: 14.8,
      L3: 15.5,
      N: 2.1,
    },
    power: {
      active: -8.5, // Negativo = gerando energia (4 quadrantes)
      reactive: 3.2,
      apparent: 9.1,
      import: 0,
      export: 8.5,
    },
    frequency: 60.02,
    powerFactor: 0.95,
    thd: {
      voltage: 2.1, // THD de tensão (%)
      current: 4.8, // THD de corrente (%)
    },
    energy: {
      activeImport: 1234.56, // Energia ativa importada
      activeExport: 567.89, // Energia ativa exportada
      reactiveImport: 234.12, // Energia reativa importada
      reactiveExport: 89.45, // Energia reativa exportada
    },
  };

  // Dados mockados para M300 (Multímetro básico)
  const dadosM300: M300Reading = {
    voltage: {
      L1: 220.5,
      L2: 219.8,
      L3: 221.2,
    },
    current: {
      L1: 15.2,
      L2: 14.8,
      L3: 15.5,
    },
    power: {
      active: 10.5,
      reactive: 3.2,
      apparent: 11.0,
    },
    frequency: 60.02,
    powerFactor: 0.95,
  };

  // Dados mockados do A966 Gateway
  const dadosA966: A966Reading = {
    inputs: {
      modbus: {
        protocol: "modbus",
        interface: "rs485",
        status: "connected",
        baudRate: 9600,
        devices: 3,
        messagesPerMinute: 120,
      },
      ssu: {
        protocol: "ssu",
        interface: "rs485",
        status: "connected",
        baudRate: 115200,
        devices: 12,
        dataRate: 2048,
      },
    },
    outputs: {
      mqttWifi: {
        protocol: "mqtt",
        interface: "wifi",
        status: "connected",
        messagesPerMinute: 60,
      },
      mqttEthernet: {
        protocol: "mqtt",
        interface: "ethernet",
        status: "connected",
        messagesPerMinute: 60,
      },
    },
    systemStatus: {
      cpu: 35,
      memory: 48,
      temperature: 45,
      uptime: 720, // 30 dias em horas
      signalStrength: 85,
    },
    network: {
      ipAddress: "192.168.1.100",
      macAddress: "A4:CF:12:34:56:78",
      ssid: "NexON-Industrial",
      gateway: "192.168.1.1",
      connectionType: "both",
    },
    iotStatus: {
      platform: "NexON Cloud",
      lastSync: new Date().toISOString(),
      dataPoints: 15847,
      errors: 0,
    },
  };

  // Dados mockados do LandisGyr E750
  const dadosLandisGyr: LandisGyrE750Reading = {
    voltage: {
      L1: 220.5,
      L2: 219.8,
      L3: 221.2,
      phaseAngles: {
        L1: 0,
        L2: 120,
        L3: 240,
      },
    },
    current: {
      L1: 45.2,
      L2: 44.8,
      L3: 45.5,
      N: 2.1,
      phaseAngles: {
        L1: -15,
        L2: 105,
        L3: 225,
      },
    },
    energy: {
      activeImport: 125847.5, // kWh importada
      activeExport: 87432.8, // kWh exportada
      reactiveQ1: 12458.2,
      reactiveQ2: 8745.6,
      reactiveQ3: 9854.3,
      reactiveQ4: 7456.9,
    },
    power: {
      active: 29.85, // kW
      reactive: 8.5, // kVAr
      apparent: 31.05, // kVA
    },
    loadProfile: {
      channels: 6,
      interval: 15, // 15 minutos
      depth: 90, // 3 meses em dias
    },
    communication: {
      moduleType: "GSM_GPRS",
      signalStrength: 85,
      connectionStatus: "connected",
      lastSync: new Date(Date.now() - 5 * 60 * 1000), // 5 minutos atrás
    },
    system: {
      firmwareVersion: "v4.2.1",
      moduleId: "E750-2024-001",
      signatureStatus: "valid",
      secondIndex: 3600,
      batteryBackup: 168, // 7 dias em horas
    },
    tariff: {
      currentTariff: 1,
      tariffChanges: 4,
    },
    qualityMonitoring: {
      voltageMonitoring: true,
      currentMonitoring: true,
      neutralDisconnected: false,
      harmonicAccuracy: true,
    },
  };

  // Função principal de clique em componente - CORRIGIDO + MQTT + Multi-seleção
  const handleComponenteClick = useCallback(
    (componente: ComponenteDU, event?: React.MouseEvent) => {
      console.log('🖱️ [CLICK] Componente clicado:', {
        id: componente.id,
        tipo: componente.tipo,
        nome: componente.nome,
        modoEdicao,
        diagramaFullscreen,
        dados: componente.dados
      });

      if (modoEdicao) {
        console.log('✏️ [MODO EDIÇÃO] Componente clicado no modo edição:', {
          modoFerramenta,
          componenteId: componente.id,
          componenteNome: componente.nome
        });

        if (modoFerramenta === "selecionar") {
          console.log('🎯 [EDIÇÃO] setComponenteEditando sendo chamado com:', componente.id);
          setComponenteEditando(componente.id);
          console.log('✅ [EDIÇÃO] setComponenteEditando executado');
        } else if (modoFerramenta === "conectar" && event) {
          const port = determineClickPort(event);
          console.log('🔌 [EDIÇÃO] Iniciando conexão:', { from: componente.id, port });
          startConnection(componente.id, port);
        }
        return;
      }

      // Lógica de seleção múltipla removida
      // A seleção de equipamentos para agregação é feita via modal de configuração

      console.log('✅ [SET] setComponenteSelecionado sendo chamado com:', {
        id: componente.id,
        nome: componente.nome,
        tipo: componente.tipo
      });
      setComponenteSelecionado(componente);
      console.log('🎯 [SET] setComponenteSelecionado executado');

      // Detectar Inversor com MQTT Habilitado
      if (componente.tipo === 'INVERSOR' &&
          componente.dados?.mqtt_habilitado === true &&
          componente.dados?.equipamento_id) {
        console.log('🔌 [MODAL] Abrindo InversorMqttDataModal para:', componente.dados.equipamento_id);
        setSelectedInversorMqttId(componente.dados.equipamento_id);
        setInversorMqttModalOpen(true);
        return;
      }

      // ❌ DESABILITADO: Pivo modal não funciona completamente ainda
      // if (componente.tipo === 'PIVO' && componente.dados?.equipamento_id) {
      //   console.log('🚜 [MODAL] Abrindo PivoModal para:', componente.dados.equipamento_id);
      //   setSelectedPivoId(componente.dados.equipamento_id);
      //   setPivoModalOpen(true);
      //   return;
      // }

      // Detectar tópico MQTT e abrir modal correto
      const tag = (componente as any).tag || '';

      // ✅ HABILITADO: Apenas M160 e INVERSOR funcionam completamente
      if (tag.includes('M160') || componente.tipo === 'M160' || componente.tipo === 'METER_M160') {
        console.log('📊 [MODAL] Abrindo M160Modal');
        setModalAberto('M160');
      }
      // ❌ DESABILITADO: Outros modais não funcionam completamente ainda
      // else if (tag.includes('a966/state') && !tag.includes('LANDIS')) {
      //   console.log('📊 [MODAL] Abrindo A966Modal');
      //   setModalAberto('A966');
      // } else if (tag.includes('LANDIS')) {
      //   console.log('📊 [MODAL] Abrindo LandisModal');
      //   setModalAberto('LANDIS_E750');
      // } else {
      //   console.log('📊 [MODAL] Abrindo modal padrão para tipo:', componente.tipo);
      //   setModalAberto(componente.tipo);
      // }
    },
    [modoEdicao, modoFerramenta, diagramaFullscreen]
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

  // Sistema de drag and drop - CORRIGIDO
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, componentId: string) => {
      if (modoFerramenta !== "selecionar" || !modoEdicao) return;

      e.preventDefault();
      e.stopPropagation();

      const component = componentes.find((c) => c.id === componentId);
      const activeCanvas = getActiveCanvasRef();
      if (!component || !activeCanvas.current) return;

      setComponenteEditando(componentId);
      setComponenteDragId(componentId);
      setIsDragging(true);

      const canvasRect = activeCanvas.current.getBoundingClientRect();
      const componentX = (component.posicao.x / 100) * canvasRect.width;
      const componentY = (component.posicao.y / 100) * canvasRect.height;

      setDragOffset({
        x: e.clientX - canvasRect.left - componentX,
        y: e.clientY - canvasRect.top - componentY,
      });
    },
    [modoFerramenta, modoEdicao, componentes, getActiveCanvasRef]
  );

  // Throttle com requestAnimationFrame para performance máxima
  const rafIdRef = useRef<number | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback(
  (e: MouseEvent) => {
    const activeCanvas = getActiveCanvasRef();
    if (!isDragging || !componenteDragId || !activeCanvas.current) return;

    // Armazenar posição do mouse
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Cancelar frame anterior se ainda não executou
    if (rafIdRef.current !== null) {
      return;
    }

    // Throttle com requestAnimationFrame - executa no próximo frame
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;

      if (!lastMousePosRef.current || !activeCanvas.current) return;

      const canvasRect = activeCanvas.current.getBoundingClientRect();
      const mouseX = lastMousePosRef.current.x - canvasRect.left - dragOffset.x;
      const mouseY = lastMousePosRef.current.y - canvasRect.top - dragOffset.y;

      let newX = (mouseX / canvasRect.width) * 100;
      let newY = (mouseY / canvasRect.height) * 100;

      // Movimento livre - apenas arredondamento mínimo
      newX = Math.round(newX * 100) / 100;
      newY = Math.round(newY * 100) / 100;

      // Aplicar limites
      newX = Math.max(2, Math.min(98, newX));
      newY = Math.max(2, Math.min(98, newY));

      // Atualização otimizada - cria novo array apenas uma vez
      setComponentes(prevComponentes =>
        prevComponentes.map((comp) =>
          comp.id === componenteDragId
            ? { ...comp, posicao: { x: newX, y: newY } }
            : comp
        )
      );
    });
  },
  [isDragging, componenteDragId, dragOffset, getActiveCanvasRef]
);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    // Cancelar qualquer animationFrame pendente
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

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
        // Cancelar qualquer animationFrame pendente ao desmontar
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
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
          updateDiagram(undefined, [...connections, newConnection]);
          setConnecting(null);
        }
      } else {
        setConnecting({ from: componentId, port });
        setComponenteEditando(componentId);
      }
    },
    [modoFerramenta, modoEdicao, connecting, connections, updateDiagram]
  );

  // Funções de controle
  const fecharModal = () => {
    setModalAberto(null);
    setComponenteSelecionado(null);
  };

  // NOVO: Handler para selecionar unidade
  const handleUnidadeSelect = useCallback((
    novaUnidadeId: string,
    planta: PlantaResponse,
    unidade: Unidade
  ) => {
    // Limpar espaços em branco do ID (pode vir do banco de dados com espaços)
    const unidadeIdLimpo = novaUnidadeId.trim();

    // console.log('🏭 [SINÓPTICO] Unidade selecionada:', {
    //   nome: unidade.nome,
    //   id: unidadeIdLimpo,
    //   demandaGeracao: unidade.demandaGeracao,
    //   demandaCarga: unidade.demandaCarga,
    //   tipo: unidade.tipo,
    //   potencia: unidade.potencia,
    // });

    setUnidadeId(unidadeIdLimpo);
    setPlantaAtual(planta);
    setUnidadeAtual(unidade);

    // Fechar modal após seleção
    setModalSelecionarUnidade(false);

    // Atualizar URL com ID limpo
    navigate(`/supervisorio/sinoptico-ativo/${unidadeIdLimpo}`, { replace: true });
  }, [navigate]);

  const toggleModoEdicao = () => {
    setModoEdicao(!modoEdicao);
    if (modoEdicao) {
      setComponenteEditando(null);
      setConnecting(null);
      setIsDragging(false);
      setComponenteDragId(null);
    }
  };

  // Função para remover conexão
  const removerConexao = (connectionId: string) => {
    console.log('═══════════════════════════════════════════════════');
    console.log('🗑️ [removerConexao] INICIANDO REMOÇÃO');
    console.log('═══════════════════════════════════════════════════');
    console.log('Connection ID a remover:', connectionId);
    console.log('Total de conexões ANTES:', connections.length);
    console.log('IDs das conexões ANTES:', connections.map(c => c.id));

    const novasConexoes = connections.filter((conn) => {
      const manter = conn.id !== connectionId;
      if (!manter) {
        console.log('❌ Removendo conexão:', conn.id);
      }
      return manter;
    });

    console.log('Total de conexões DEPOIS do filtro:', novasConexoes.length);
    console.log('IDs das conexões DEPOIS:', novasConexoes.map(c => c.id));
    console.log('Conexões removidas:', connections.length - novasConexoes.length);

    console.log('📝 Chamando setConnections com', novasConexoes.length, 'conexões...');
    setConnections(novasConexoes);
    console.log('✅ setConnections CHAMADO!');

    // Verificar após 100ms se o estado realmente mudou
    setTimeout(() => {
      console.log('⏱️ [Verificação após 100ms] Total de conexões:', connections.length);
    }, 100);

    console.log('⚠️ NÃO ESQUEÇA DE SALVAR O DIAGRAMA!');
    console.log('═══════════════════════════════════════════════════');
  };

  // Funções de edição de componentes
  const adicionarComponente = async (tipo: string) => {
    // Verificar se é um equipamento da unidade
    if (tipo.startsWith('EQUIPAMENTO:')) {
      const equipamentoId = tipo.replace('EQUIPAMENTO:', '').trim();
      const equipamento = Array.isArray(equipamentos) ? equipamentos.find(eq => eq.id.trim() === equipamentoId) : null;

      if (equipamento) {
        // Posição inicial padrão (sem snap)
        const initialX = 40;
        const initialY = 40;

        const novoComponente: ComponenteDU = {
          id: `eq-${equipamentoId}`,
          tipo: equipamento.tipoEquipamento?.codigo || 'MEDIDOR',
          nome: equipamento.nome,
          tag: equipamento.tag,
          posicao: { x: initialX, y: initialY },
          rotacao: equipamento.rotacao || 0,
          status: equipamento.status || 'NORMAL',
          dados: {
            equipamento_id: equipamento.id.trim(),
            tag: equipamento.tag,
            fabricante: equipamento.fabricante,
            modelo: equipamento.modelo,
            numero_serie: equipamento.numero_serie,
            mqtt_topico: equipamento.topico_mqtt,
            mqtt_habilitado: equipamento.mqtt_habilitado,
            // Para PIVO, adicionar estado inicial
            ...(equipamento.tipoEquipamento?.codigo === 'PIVO' ? { operando: false } : {})
          },
        };

        // Se for um PIVO, inicializar seu estado simulado
        if (equipamento.tipoEquipamento?.codigo === 'PIVO') {
          setPivoStates(prev => ({
            ...prev,
            [equipamento.id.trim()]: {
              status: "DESLIGADO",
              operando: false,
              velocidadeRotacao: 0,
              modoOperacao: "MANUAL",
              tempoOperacao: "0h 00min",
              setorAtual: 0
            }
          }));
        }

        updateDiagram([...componentes, novoComponente]);
        console.log('✅ Equipamento adicionado ao diagrama:', equipamento.nome);
      }
    } else if (tipo === 'BARRAMENTO' || tipo === 'PONTO') {
      // Componentes visuais: criar no backend primeiro
      try {
        console.log('🔧 Criando componente virtual:', { tipo, unidadeId });
        const { equipamentosApi } = await import('@/services/equipamentos.services');
        const equipamentoVirtual = await equipamentosApi.criarComponenteVisual(
          unidadeId,
          tipo,
          `${tipo} ${componentes.filter(c => c.tipo === tipo).length + 1}`
        );

        console.log('📦 Resposta do backend:', equipamentoVirtual);

        // A resposta vem como { success: true, data: { id, nome, ... }, meta: {...} }
        const equipamentoData = equipamentoVirtual?.data;

        // IMPORTANTE: Fazer trim do ID porque o backend pode retornar com espaços extras
        const equipamentoId = equipamentoData?.id?.trim();

        if (!equipamentoData || !equipamentoId) {
          throw new Error('Backend não retornou ID válido para o componente virtual');
        }

        // Posição inicial padrão (sem snap)
        const initialX = 40;
        const initialY = 40;

        const novoComponente: ComponenteDU = {
          id: `eq-${equipamentoId}`,
          tipo: equipamentoData.tipo_equipamento?.trim() || tipo,
          nome: equipamentoData.nome?.trim() || `${tipo} ${componentes.length + 1}`,
          posicao: { x: initialX, y: initialY },
          rotacao: 0,
          status: 'NORMAL',
          dados: {
            equipamento_id: equipamentoId,
          },
        };

        console.log('✅ Componente virtual criado:', novoComponente);
        updateDiagram([...componentes, novoComponente]);
      } catch (err: any) {
        console.error('❌ Erro ao criar componente virtual:', err);
        console.error('Stack:', err.stack);
        alert(`Erro ao criar ${tipo}: ${err.message}`);
      }
    } else {
      // Componente genérico (JUNCTION, etc)
      const novoId = `${tipo.toLowerCase()}-${Date.now()}`;
      const novoComponente: ComponenteDU = {
        id: novoId,
        tipo: tipo,
        nome: `${tipo} ${componentes.length + 1}`,
        posicao: { x: 40, y: 40 },
        status: "NORMAL",
        dados: {},
      };
      updateDiagram([...componentes, novoComponente]);
    }
  };

  // Handler para equipamento criado via modal de criação rápida
  const handleEquipamentoCriado = async (equipamento: any) => {
    console.log('🎉 [CRIAÇÃO RÁPIDA] Equipamento criado:', equipamento);

    try {
      // Recarregar lista de equipamentos para incluir o novo
      await loadDiagramaFromBackend();

      // Extrair tipo do equipamento (pode vir em diferentes formatos)
      const tipoEquipamento = equipamento.tipoEquipamento
        || equipamento.tipo_equipamento_rel
        || equipamento.tipo_equipamento;

      const tipoCodigo = tipoEquipamento?.codigo || 'MEDIDOR';

      // Posição inicial padrão (mesma lógica do select de equipamentos cadastrados)
      const posicaoInicial = {
        x: 40,
        y: 40
      };

      // Adicionar automaticamente ao diagrama
      const novoComponente: ComponenteDU = {
        id: `eq-${equipamento.id.trim()}`,
        tipo: tipoCodigo,
        nome: equipamento.nome?.trim() || 'Equipamento',
        tag: equipamento.tag?.trim(),
        posicao: posicaoInicial,
        rotacao: 0,
        status: 'NORMAL',
        dados: {
          equipamento_id: equipamento.id.trim(),
          tag: equipamento.tag?.trim(),
          fabricante: equipamento.fabricante,
          modelo: equipamento.modelo,
          numero_serie: equipamento.numero_serie,
        },
      };

      // Se for um PIVO, inicializar seu estado simulado
      if (tipoCodigo === 'PIVO') {
        setPivoStates(prev => ({
          ...prev,
          [equipamento.id.trim()]: {
            status: "DESLIGADO",
            operando: false,
            velocidadeRotacao: 0,
            modoOperacao: "MANUAL",
            tempoOperacao: "0h 00min",
            setorAtual: 0
          }
        }));
      }

      updateDiagram([...componentes, novoComponente]);

      console.log('✅ [CRIAÇÃO RÁPIDA] Equipamento adicionado ao diagrama:', novoComponente);
    } catch (error) {
      console.error('❌ [CRIAÇÃO RÁPIDA] Erro ao processar equipamento:', error);
    }
  };

  const removerComponente = async (id: string) => {
    const componente = componentes.find((c) => c.id === id);

    // Remover do estado local imediatamente
    const newComponentes = componentes.filter((c) => c.id !== id);
    const newConnections = connections.filter(
      (conn) => conn.from !== id && conn.to !== id
    );
    updateDiagram(newComponentes, newConnections);
    setComponenteEditando(null);

    // Remover do backend se tiver diagrama ativo e equipamento_id
    if (diagramaIdAtual && componente?.dados?.equipamento_id) {
      try {
        const { DiagramasService } = await import('@/services/diagramas.services');
        await DiagramasService.removeEquipamento(diagramaIdAtual, componente.dados.equipamento_id);
        console.log('✅ Equipamento removido do diagrama no backend:', componente.dados.equipamento_id);
      } catch (err: any) {
        console.error('❌ Erro ao remover equipamento do backend:', err);
        // Não reverter a remoção local, apenas avisar
        console.warn('⚠️ Equipamento removido localmente mas falha no backend. Salve novamente para sincronizar.');
      }
    }
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
      updateDiagram([...componentes, novoComponente]);
    }
  };

  const limparConexoes = () => {
    updateDiagram(undefined, []);
    setConnecting(null);
  };

  // Função para criar junction node INVISÍVEL ao clicar em uma edge
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, connection: Connection) => {
      const activeCanvas = getActiveCanvasRef();
      if (!modoEdicao || !activeCanvas.current) return;

      const rect = activeCanvas.current.getBoundingClientRect();
      const clickPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      // Detectar se o clique foi próximo à linha
      const isNearEdge = detectEdgeClick(
        clickPoint,
        connection,
        componentes,
        rect,
        10 // threshold de 10 pixels
      );

      if (isNearEdge) {
        // Calcular posição do junction na linha
        const junctionPosition = calculateJunctionPositionOnLine(
          clickPoint,
          connection,
          componentes,
          rect
        );

        if (junctionPosition) {
          // Criar o junction node INVISÍVEL
          const junctionNode = createJunctionNode(junctionPosition, componentes);

          // Dividir a conexão original em duas
          const { connection1, connection2 } = splitConnectionWithJunction(
            connection,
            junctionNode.id
          );

          // Atualizar o diagrama
          const newConnections = connections
            .filter((c) => c.id !== connection.id) // Remove conexão original
            .concat([connection1, connection2]); // Adiciona as duas novas

          updateDiagram([...componentes, junctionNode], newConnections);

          console.log("✅ Junction invisível criado:", junctionNode.id);
        }
      }
    },
    [modoEdicao, componentes, connections, updateDiagram, getActiveCanvasRef]
  );

  const salvarDiagrama = useCallback(async () => {
    if (!unidadeId) {
      alert('❌ Nenhuma unidade selecionada. Use o botão "Selecionar Unidade" primeiro.');
      return;
    }

    // Confirmação antes de salvar
    const confirmar = window.confirm(
      `🔄 Deseja salvar o diagrama?\n\n` +
      `📊 Componentes: ${componentes.length}\n` +
      `🔗 Conexões: ${connections.length}\n\n` +
      `Esta ação irá sobrescrever o diagrama existente no servidor.`
    );

    if (!confirmar) {
      console.log('❌ Salvamento cancelado pelo usuário');
      return;
    }

    // Iniciar loading
    setIsSavingDiagrama(true);

    try {
      console.log('💾 Salvando diagrama no backend...');
      console.log('📊 Componentes:', componentes.length);
      console.log('🔗 Conexões:', connections.length);

      // Permitir salvar diagrama vazio
      if (componentes.length === 0) {
        console.log('ℹ️ Salvando diagrama vazio (sem componentes)');
      }

      // Importar o serviço dinamicamente
      const { DiagramasService } = await import('@/services/diagramas.services');

      let diagramaId: string;

      // Buscar diagrama ativo existente para esta unidade
      console.log('🔍 Buscando diagrama ativo para a unidade...');
      const diagramaAtivo = await DiagramasService.getActiveDiagrama(unidadeId);

      if (diagramaAtivo) {
        console.log('✅ Diagrama ativo encontrado:', diagramaAtivo.id);
        console.log('🗑️ Para limpar conexões duplicadas, use: DELETE FROM equipamentos_conexoes WHERE diagrama_id = \'' + diagramaAtivo.id + '\';');
        diagramaId = diagramaAtivo.id.trim();

        // Limpar equipamentos e conexões existentes antes de salvar os novos
        console.log('🧹 Limpando equipamentos e conexões antigas do diagrama...');
        // Como não temos endpoint de limpar tudo, vamos reutilizar o diagrama existente
        // O backend deve ter lógica para substituir ou atualizar
      } else {
        // Criar novo diagrama apenas se não existir nenhum ativo
        console.log('🆕 Nenhum diagrama ativo encontrado. Criando novo diagrama...');
        const novoDiagrama = await DiagramasService.createDiagrama({
          unidadeId: unidadeId,
          nome: `Diagrama - ${unidadeAtual?.nome || 'Unidade'}`,
          ativo: true,
        });
        console.log('✅ Novo diagrama criado:', novoDiagrama);
        diagramaId = novoDiagrama?.id?.trim() || '';

        if (!diagramaId) {
          throw new Error('Diagrama ID não foi retornado pelo backend');
        }
      }

      // Atualizar nome e tag APENAS dos equipamentos que foram modificados
      if (equipamentosModificados.size > 0) {
        console.log(`📝 Atualizando ${equipamentosModificados.size} equipamentos modificados...`);
        const { equipamentosApi } = await import('@/services/equipamentos.services');

        for (const equipamentoId of equipamentosModificados) {
          // Encontrar o componente correspondente
          const comp = componentes.find(c => c.dados?.equipamento_id === equipamentoId);
          if (!comp) continue;

          try {
            const updateData: any = {};

            // Sempre enviar nome se existir e não for null/undefined
            if (comp.nome !== null && comp.nome !== undefined && typeof comp.nome === 'string') {
              const nomeTrimmed = comp.nome.trim();
              if (nomeTrimmed !== '') {
                updateData.nome = nomeTrimmed;
              }
            }

            // Enviar tag se existir e não for null/undefined (pode ser string vazia para limpar)
            if (comp.tag !== null && comp.tag !== undefined && typeof comp.tag === 'string') {
              updateData.tag = comp.tag.trim();
            }

            // Só fazer update se houver algo para atualizar
            if (Object.keys(updateData).length > 0) {
              await equipamentosApi.update(equipamentoId, updateData);
              console.log(`✅ Equipamento ${equipamentoId} atualizado:`, updateData);
            }
          } catch (err: any) {
            console.warn(`⚠️ Erro ao atualizar equipamento ${equipamentoId}:`, err.message);
            // Continuar mesmo se houver erro (não bloquear salvamento do diagrama)
          }
        }

        // Limpar o set de equipamentos modificados após salvar
        setEquipamentosModificados(new Set());
      } else {
        console.log('ℹ️ Nenhum equipamento teve nome/tag modificado');
      }

      // TODOS os componentes agora têm equipamento_id (incluindo BARRAMENTO/PONTO)
      const equipamentosParaSalvar = componentes
        .filter(comp => comp.dados?.equipamento_id) // Só salvar componentes com equipamento_id
        .map(comp => ({
          equipamentoId: comp.dados.equipamento_id,
          posicao: {
            x: comp.posicao?.x || 0,
            y: comp.posicao?.y || 0,
          },
          rotacao: comp.rotacao || 0,
          labelPosition: comp.label_position || 'bottom',
        }));

      console.log(`📦 Salvando ${equipamentosParaSalvar.length} equipamentos (incluindo virtuais) no diagrama ${diagramaId}...`);

      // ✅ OTIMIZAÇÃO: Remover equipamentos e conexões antigas EM PARALELO
      console.log('🧹 [PARALELO] Limpando equipamentos e conexões antigas...');
      try {
        await Promise.all([
          DiagramasService.removeAllEquipamentos(diagramaId),
          DiagramasService.removeAllConnections(diagramaId)
        ]);
        console.log('✅ [PARALELO] Equipamentos e conexões antigas removidos');
      } catch (err: any) {
        console.warn('⚠️ Erro ao limpar dados antigos (pode ser que não existam):', err.message);
      }

      // ✅ Adicionar novos equipamentos (se houver)
      if (equipamentosParaSalvar.length > 0) {
        try {
          const resultadoEquipamentos = await DiagramasService.addEquipamentosBulk(
            diagramaId,
            equipamentosParaSalvar
          );
          console.log('✅ Equipamentos salvos:', resultadoEquipamentos);
        } catch (err: any) {
          console.error('❌ Erro ao salvar equipamentos:', err);
          throw new Error(`Erro ao salvar equipamentos: ${err.message}`);
        }
      } else {
        console.log('ℹ️ Diagrama vazio salvo (nenhum equipamento)');
      }

      if (connections.length > 0) {
        console.log(`🔗 Salvando ${connections.length} conexões novas...`);

        // Helper function para converter ID visual para ID real do equipamento
        const getEquipamentoIdReal = (visualId: string | undefined): string | null => {
          if (!visualId) {
            console.warn('⚠️ visualId is undefined');
            return null;
          }

          const comp = componentes.find(c => c.id === visualId);
          if (comp?.dados?.equipamento_id) {
            return comp.dados.equipamento_id;
          }

          // Se não encontrou o componente, tenta extrair do ID visual
          if (visualId.startsWith('eq-')) {
            return visualId.replace('eq-', '').trim();
          }

          // Se não tem prefixo 'eq-', retorna null (não é equipamento)
          return null;
        };

        // Filtrar conexões válidas (que têm equipamento_id válido em ambos os lados)
        const conexoesValidas = connections.filter(conn => {
          const sourceId = getEquipamentoIdReal(conn.source || conn.from);
          const targetId = getEquipamentoIdReal(conn.target || conn.to);

          if (!sourceId || !targetId) {
            console.warn('⚠️ Conexão ignorada (sem equipamento_id em um dos lados):', {
              from: conn.from || conn.source,
              to: conn.to || conn.target
            });
            return false;
          }

          return true;
        });

        console.log(`✅ ${conexoesValidas.length} conexões válidas de ${connections.length} totais`);

        const conexoesParaSalvar = conexoesValidas.map(conn => ({
          origem: {
            equipamentoId: getEquipamentoIdReal(conn.source || conn.from)!,
            porta: ((conn.sourceHandle || conn.fromPort) || 'right') as 'top' | 'bottom' | 'left' | 'right',
          },
          destino: {
            equipamentoId: getEquipamentoIdReal(conn.target || conn.to)!,
            porta: ((conn.targetHandle || conn.toPort) || 'left') as 'top' | 'bottom' | 'left' | 'right',
          },
          visual: {
            tipoLinha: 'solida' as const,
            cor: conn.style?.stroke || '#22c55e',
            espessura: 2,
          },
        }));

        console.log('📤 Preparando para salvar conexões...');

        if (conexoesParaSalvar.length > 0) {
          try {
            // Se houver muitas conexões (>50), processar em lotes menores para evitar timeout
            const BATCH_SIZE = 50;

            if (conexoesParaSalvar.length > BATCH_SIZE) {
              console.log(`🔄 Processando ${conexoesParaSalvar.length} conexões em lotes de ${BATCH_SIZE}...`);

              // Dividir em lotes
              const batches = [];
              for (let i = 0; i < conexoesParaSalvar.length; i += BATCH_SIZE) {
                batches.push(conexoesParaSalvar.slice(i, i + BATCH_SIZE));
              }

              // Processar lotes em grupos de 3 em paralelo (para não sobrecarregar)
              const PARALLEL_BATCHES = 3;
              for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
                const parallelBatches = batches.slice(i, i + PARALLEL_BATCHES);
                const startBatch = i + 1;
                const endBatch = Math.min(i + PARALLEL_BATCHES, batches.length);

                console.log(`📦 Salvando lotes ${startBatch}-${endBatch} de ${batches.length} em paralelo...`);

                await Promise.all(
                  parallelBatches.map((batch, idx) =>
                    DiagramasService.createConexoesBulk(diagramaId, batch)
                      .then(() => console.log(`✅ Lote ${i + idx + 1}/${batches.length} salvo`))
                  )
                );
              }

              console.log(`✅ Todas as ${conexoesParaSalvar.length} conexões salvas em ${batches.length} lotes`);
            } else {
              // Poucas conexões, salvar tudo de uma vez
              console.log(`📤 Enviando ${conexoesParaSalvar.length} conexões em um único lote...`);
              const resultadoConexoes = await DiagramasService.createConexoesBulk(
                diagramaId,
                conexoesParaSalvar
              );
              console.log('✅ Conexões salvas:', resultadoConexoes);
            }
          } catch (err: any) {
            console.error('❌ Erro ao salvar conexões:', err);
            throw new Error(`Erro ao salvar conexões: ${err.message}`);
          }
        } else {
          console.warn('⚠️ Nenhuma conexão válida para salvar');
        }
      }

      // Backup no localStorage
      const diagramaData = {
        componentes,
        connections,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(`diagrama_${unidadeId}`, JSON.stringify(diagramaData));

      alert(`✅ Diagrama salvo com sucesso!\n\nDiagrama ID: ${diagramaId}\nComponentes: ${componentes.length}\nConexões: ${connections.length}`);
    } catch (error: any) {
      console.error('❌ Erro ao salvar diagrama:', error);
      alert(`❌ Erro ao salvar diagrama: ${error.message || 'Erro desconhecido'}`);
    } finally {
      // Finalizar loading
      setIsSavingDiagrama(false);
    }
  }, [unidadeId, componentes, connections, unidadeAtual]); 
    
  // LOADING STATE - Não renderizar até selecionar unidade e carregar
  if (!diagramaCarregado || !unidadeId) {
    return (
      <Layout>
        <Layout.Main>
          <div className="flex flex-col items-center justify-center h-full w-full gap-6">
            {!unidadeId ? (
              // Mensagem para selecionar unidade
              <div className="text-center max-w-md">
                <Building className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Selecione uma Unidade
                </h2>
                <p className="text-gray-600 mb-6">
                  Para visualizar o diagrama sinóptico, primeiro escolha uma planta e depois uma unidade.
                </p>
                <button
                  onClick={() => setModalSelecionarUnidade(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-xl"
                >
                  Selecionar Planta e Unidade
                </button>
              </div>
            ) : (
              // Loading de diagrama
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-lg text-gray-700">Carregando diagrama...</p>
                {unidadeAtual?.nome && (
                  <p className="text-sm text-gray-500 mt-2">
                    Unidade: {unidadeAtual.nome}
                  </p>
                )}
              </div>
            )}
          </div>
        </Layout.Main>

        {/* Modal de seleção */}
        <ModalSelecionarUnidade
          isOpen={modalSelecionarUnidade}
          onClose={() => setModalSelecionarUnidade(false)}
          onSelect={handleUnidadeSelect}
          currentPlantaId={plantaAtual?.id}
          currentUnidadeId={unidadeId}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Main>
        {/* Loading Overlay para salvamento */}
        {isSavingDiagrama && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 dark:border-blue-800"></div>
                <div className="absolute inset-0 animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-600 dark:border-t-blue-400"></div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Salvando Diagrama
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Por favor, aguarde enquanto o diagrama está sendo salvo...
                </p>
                <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-500">
                  <p>📊 {componentes.length} componentes</p>
                  <p>🔗 {connections.length} conexões</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-full space-y-3">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-2 sm:p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              disabled={isSavingDiagrama}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-1 w-full sm:w-auto">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">
                <span className="hidden sm:inline">Sinóptico - </span>
                {unidadeAtual ? (
                  <>
                    <span className="hidden md:inline">{plantaAtual?.nome} → </span>
                    {unidadeAtual.nome}
                  </>
                ) : unidadeId ? (
                  // Enquanto carrega, mostra "Carregando..." ao invés do ID
                  <span className="text-muted-foreground animate-pulse">Carregando unidade...</span>
                ) : (
                  'Selecione uma Unidade'
                )}
              </h1>

              {/* NOVO: Botão para selecionar unidade */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalSelecionarUnidade(true)}
                className="flex items-center gap-2"
              >
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {unidadeAtual ? 'Trocar Unidade' : 'Selecionar Unidade'}
                </span>
                <span className="sm:hidden">
                  {unidadeAtual ? 'Trocar' : 'Selecionar'}
                </span>
              </Button>

              {loadingDiagrama && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-600">
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-blue-600"></div>
                  <span className="hidden sm:inline">Carregando...</span>
                </div>
              )}
            </div>

            {/* Debug info */}
            <div className="text-xs text-muted-foreground hidden lg:block">
              Componentes: {componentes.length} | Equipamentos: {Array.isArray(equipamentos) ? equipamentos.length : 0}
            </div>
          </div>

          {/* Indicadores - Comentados temporariamente (não podem ser calculados corretamente ainda) */}
          {/* <SinopticoIndicadores indicadores={indicadores} /> */}

          {/* Barra de Ferramentas - SÓ APARECE NO MODO EDIÇÃO */}
          {modoEdicao && (
            <div className="mb-6 relative z-50">
              <Card className="p-4 bg-white dark:bg-gray-900 shadow-lg">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Modos de Ferramentas - CORRIGIDO: BOTÃO ÚNICO */}
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
                          setConnecting(null);
                          setIsDragging(false);
                          setComponenteDragId(null);
                        }}
                        className="flex items-center gap-1"
                      >
                        <Move className="h-4 w-4" />
                        Selecionar
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

                  {/* Grid removido - aparece automaticamente no modo de edição (25px fixo) */}

                  {/* Botão Criar Equipamento Rápido */}
                  <div className="flex items-center gap-2 border-r pr-4">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setModalCriarRapido(true)}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Novo Equipamento
                    </Button>
                  </div>

                  {/* Adicionar Componentes */}
                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Adicionar:</span>
                    <select
                      className="h-8 px-3 py-1 text-sm border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-w-[280px]"
                      onChange={(e) => {
                        if (e.target.value) {
                          adicionarComponente(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Selecione um equipamento
                      </option>

                      {/* Equipamentos UC da Unidade (apenas equipamentos principais) */}
                      {Array.isArray(equipamentos) && equipamentos.filter(eq => eq.classificacao === 'UC').length > 0 ? (
                        <optgroup label="📦 Equipamentos da Unidade (UC)">
                          {(() => {
                            // Filtrar equipamentos UC que não estão no diagrama
                            const equipamentosFiltrados = equipamentos.filter(eq => {
                              const isUC = eq.classificacao === 'UC';
                              const jaNoDiagrama = componentes.some(comp => {
                                // Usar trim() para comparar IDs (remover espaços em branco)
                                const match = comp.dados?.equipamento_id?.trim() === eq.id?.trim();
                                return match;
                              });

                              return isUC && !jaNoDiagrama;
                            });

                            return equipamentosFiltrados.map(equipamento => (
                              <option key={equipamento.id} value={`EQUIPAMENTO:${equipamento.id}`}>
                                {equipamento.nome}
                                {equipamento.tag && ` [${equipamento.tag}]`}
                                {equipamento.fabricante && ` - ${equipamento.fabricante}`}
                              </option>
                            ));
                          })()}
                          {Array.isArray(equipamentos) && equipamentos.filter(eq => eq.classificacao === 'UC' && !componentes.some(comp => comp.dados?.equipamento_id?.trim() === eq.id?.trim())).length === 0 && (
                            <option value="" disabled>Todos equipamentos já adicionados</option>
                          )}
                        </optgroup>
                      ) : (
                        <optgroup label="📦 Equipamentos da Unidade">
                          <option value="" disabled>Nenhum equipamento UC cadastrado</option>
                        </optgroup>
                      )}

                      {/* Componentes auxiliares para o diagrama */}
                      <optgroup label="⚡ Componentes Auxiliares">
                        <option value="PONTO">• Ponto de Junção</option>
                        <option value="BARRAMENTO">• Barramento</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Ações - BOTÕES UNDO/REDO FUNCIONAIS */}
                  <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-sm font-medium">Ações:</span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={undo}
                        disabled={!canUndo}
                        title={
                          canUndo
                            ? "Desfazer última ação (Ctrl+Z)"
                            : "Nenhuma ação para desfazer"
                        }
                      >
                        <Undo className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={redo}
                        disabled={!canRedo}
                        title={
                          canRedo
                            ? "Refazer ação (Ctrl+Y)"
                            : "Nenhuma ação para refazer"
                        }
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
                </div>

                {/* Info do Componente Selecionado */}
                {(() => {
                  console.log('📊 [RENDER] Info do Componente Selecionado:', {
                    componenteEditando,
                    hasComponenteEditando: !!componenteEditando,
                    componenteEncontrado: componentes.find(c => c.id === componenteEditando)
                  });
                  return null;
                })()}
                {componenteEditando && (() => {
                  const componenteSelecionado = componentes.find(c => c.id === componenteEditando);
                  if (!componenteSelecionado) return null;

                  return (
                    <div className="mt-4 pt-4 border-t relative z-50 bg-white dark:bg-gray-900">
                      {/* Cabeçalho com estados e conexões */}
                      <div className="flex items-center justify-end gap-2 mb-3">
                        {connecting && connecting.from === componenteEditando && (
                          <Badge variant="secondary" className="animate-pulse">
                            Conectando...
                          </Badge>
                        )}
                        {isDragging && componenteDragId === componenteEditando && (
                          <Badge variant="secondary" className="animate-pulse">
                            Arrastando...
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Conexões: {connections.filter(c => c.from === componenteEditando || c.to === componenteEditando).length}
                        </span>
                      </div>

                      {/* Painel de Propriedades Editáveis - Layout Reorganizado */}
                      <div className="flex gap-3 items-start">
                        {/* Coluna 1: Nome, Tag e Tipo */}
                        <div className="flex flex-col gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
                              Nome
                              <Edit3 className="h-3 w-3 text-blue-500" />
                            </label>
                            <input
                              type="text"
                              value={componenteSelecionado.nome}
                              onChange={(e) => {
                                setComponentes(componentes.map(c =>
                                  c.id === componenteEditando
                                    ? { ...c, nome: e.target.value }
                                    : c
                                ));
                                // Marcar equipamento como modificado
                                if (componenteSelecionado.dados?.equipamento_id) {
                                  setEquipamentosModificados(prev => new Set(prev).add(componenteSelecionado.dados.equipamento_id));
                                }
                              }}
                              placeholder="Nome do equipamento"
                              className="w-40 px-2 py-1 text-sm border rounded bg-background focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              title="Digite o nome do equipamento"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
                              Tag
                              <Edit3 className="h-3 w-3 text-blue-500" />
                            </label>
                            <input
                              type="text"
                              value={componenteSelecionado.tag || ''}
                              onChange={(e) => {
                                setComponentes(componentes.map(c =>
                                  c.id === componenteEditando
                                    ? { ...c, tag: e.target.value }
                                    : c
                                ));
                                // Marcar equipamento como modificado
                                if (componenteSelecionado.dados?.equipamento_id) {
                                  setEquipamentosModificados(prev => new Set(prev).add(componenteSelecionado.dados.equipamento_id));
                                }
                              }}
                              placeholder="Tag do equipamento"
                              className="w-40 px-2 py-1 text-sm border rounded bg-background focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              title="A tag será exibida no diagrama (se preenchida, substitui o nome)"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
                            <Badge variant="outline" className="w-40 justify-center">
                              {componenteSelecionado.tipo}
                            </Badge>
                          </div>
                          {/* Nota informativa */}
                          <div className="text-[10px] text-muted-foreground bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                            {componenteSelecionado.tag
                              ? `Exibindo: "${componenteSelecionado.tag}"`
                              : `Exibindo: "${componenteSelecionado.nome}"`
                            }
                          </div>
                        </div>
                        {/* Posições X e Y em coluna */}
                        <div className="flex flex-col gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Posição X (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={componenteSelecionado.posicao?.x || 0}
                              onChange={(e) => {
                                setComponentes(componentes.map(c =>
                                  c.id === componenteEditando
                                    ? { ...c, posicao: { ...c.posicao, x: parseFloat(e.target.value) || 0 } }
                                    : c
                                ));
                              }}
                              className="w-24 px-2 py-1 text-sm border rounded bg-background"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Posição Y (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={componenteSelecionado.posicao?.y || 0}
                              onChange={(e) => {
                                setComponentes(componentes.map(c =>
                                  c.id === componenteEditando
                                    ? { ...c, posicao: { ...c.posicao, y: parseFloat(e.target.value) || 0 } }
                                    : c
                                ));
                              }}
                              className="w-24 px-2 py-1 text-sm border rounded bg-background"
                            />
                          </div>
                        </div>

                        {/* Seletor de Posição do Label - Mais compacto */}
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground block mb-1">Posição do Nome</label>
                          <div className="flex items-center gap-4">
                            {/* Seletor Visual em Cruz - mais compacto */}
                            <div className="flex flex-col items-center gap-0.5 p-1.5 border rounded bg-background">
                              {/* TOP */}
                              <button
                                onClick={() => {
                                  setComponentes(componentes.map(c =>
                                    c.id === componenteEditando
                                      ? { ...c, label_position: 'top' }
                                      : c
                                  ));
                                }}
                                className={`p-1 rounded transition-colors ${
                                  (componenteSelecionado.label_position || 'top') === 'top'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                                title="Nome acima"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 3l-7 7h14l-7-7z"/>
                                </svg>
                              </button>

                              {/* LEFT, CENTER, RIGHT */}
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => {
                                    setComponentes(componentes.map(c =>
                                      c.id === componenteEditando
                                        ? { ...c, label_position: 'left' }
                                        : c
                                    ));
                                  }}
                                  className={`p-1 rounded transition-colors ${
                                    componenteSelecionado.label_position === 'left'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                  }`}
                                  title="Nome à esquerda"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3 10l7-7v14l-7-7z"/>
                                  </svg>
                                </button>

                                {/* Centro - representação do equipamento */}
                                <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded border border-gray-400 dark:border-gray-500"></div>

                                <button
                                  onClick={() => {
                                    setComponentes(componentes.map(c =>
                                      c.id === componenteEditando
                                        ? { ...c, label_position: 'right' }
                                        : c
                                    ));
                                  }}
                                  className={`p-1 rounded transition-colors ${
                                    componenteSelecionado.label_position === 'right'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                  }`}
                                  title="Nome à direita"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17 10l-7 7V3l7 7z"/>
                                  </svg>
                                </button>
                              </div>

                              {/* BOTTOM */}
                              <button
                                onClick={() => {
                                  setComponentes(componentes.map(c =>
                                    c.id === componenteEditando
                                      ? { ...c, label_position: 'bottom' }
                                      : c
                                  ));
                                }}
                                className={`p-1 rounded transition-colors ${
                                  componenteSelecionado.label_position === 'bottom'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                                title="Nome abaixo"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 17l7-7H3l7 7z"/>
                                </svg>
                              </button>
                            </div>

                            {/* Texto indicador ao lado */}
                            <p className="text-xs text-muted-foreground">
                              {componenteSelecionado.label_position === 'top' && 'Acima'}
                              {componenteSelecionado.label_position === 'bottom' && 'Abaixo'}
                              {componenteSelecionado.label_position === 'left' && 'À esquerda'}
                              {componenteSelecionado.label_position === 'right' && 'À direita'}
                              {!componenteSelecionado.label_position && 'Acima (padrão)'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}

          {/* Layout Principal */}
          <div className="w-full">
            {!modoEdicao && (() => {
              const valorContratadoReal = unidadeAtual?.demandaGeracao || 2300;
              // console.log('📊 [GRÁFICO DEMANDA] Renderizando com:', {
              //   valorContratado: valorContratadoReal,
              //   unidadeNome: unidadeAtual?.nome,
              //   demandaGeracao: unidadeAtual?.demandaGeracao,
              //   demandaCarga: unidadeAtual?.demandaCarga,
              //   usandoFallback: !unidadeAtual?.demandaGeracao,
              // });

              // Verificar se há pelo menos um gráfico visível para adaptar layout
              const temGraficosVisiveis = unidadeAtual && (
                equipamentos.some(e => e.mqtt_habilitado) || // Tem equipamentos para demanda
                equipamentos.some(e => e.tipo_equipamento?.includes('M160')) // Tem M160 para tensão/FP
              );

              return (
              <div className={`grid grid-cols-1 ${temGraficosVisiveis ? 'xl:grid-cols-3' : ''} gap-6`}>
                {/* Gráficos - Painel Lateral (1/3 da largura em telas grandes) - Só renderiza se tiver gráficos */}
                {temGraficosVisiveis && (
                <div className="xl:col-span-1 flex flex-col gap-4">
                  <SinopticoGraficosV2
                    unidadeId={unidadeId}
                    dadosPotencia={
                      historicoMqtt.length > 0
                        ? historicoMqtt
                        : dadosGraficos
                    }
                    dadosTensao={
                      historicoMqtt.length > 0
                        ? historicoMqtt
                        : dadosGraficos
                    }
                    valorContratado={valorContratadoReal}
                    percentualAdicional={5}
                  />
                </div>
                )}

                {/* Diagrama Unifilar - MODO VISUALIZAÇÃO - Adapta largura baseado em gráficos visíveis */}
                <div className={temGraficosVisiveis ? "xl:col-span-2 flex" : "flex"}>
                  <Card
                    ref={diagramCardRef}
                    className={`flex flex-col w-full min-h-[900px] overflow-visible ${
                      diagramaFullscreen
                        ? 'fixed inset-0 z-50 m-0 rounded-none border-0 !bg-slate-50 dark:!bg-slate-900'
                        : 'bg-slate-50 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 pb-2 border-b flex-shrink-0 bg-slate-50 dark:bg-slate-900 gap-3">
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                          <Network className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="hidden sm:inline">Diagrama Unifilar</span>
                          <span className="sm:hidden">Diagrama</span>
                          {diagramaFullscreen && <span className="hidden sm:inline">- Tela Cheia</span>}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Grid removido - aparece automaticamente no modo de edição (25px fixo) */}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleFullscreen}
                          className="flex items-center gap-1 sm:gap-2"
                        >
                          {diagramaFullscreen ? (
                            <>
                              <Minimize className="h-4 w-4" />
                              <span className="hidden sm:inline">Sair</span>
                            </>
                          ) : (
                            <>
                              <Maximize className="h-4 w-4" />
                              <span className="hidden sm:inline">Tela Cheia</span>
                            </>
                          )}
                        </Button>
                        {!diagramaFullscreen && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={toggleModoEdicao}
                              className="flex items-center gap-1 sm:gap-2"
                            >
                              <Edit3 className="h-4 w-4" />
                              <span className="hidden sm:inline">Editar</span>
                            </Button>

                          </>
                        )}
                      </div>
                    </div>

                    <div
                      className={`flex-1 relative w-full overflow-auto !bg-slate-50 dark:!bg-slate-900 ${
                        diagramaFullscreen ? 'h-[calc(100vh-73px)]' : 'min-h-[580px] h-[700px]'
                      }`}
                      ref={canvasRef}
                    >
                      {/* Grid removido do modo visualização - aparece apenas no modo de edição */}

                      {/* COMPONENTE DE CONEXÕES PARA MODO VISUALIZAÇÃO */}
                      <DomAnchoredConnectionsOverlay
                        connections={connections}
                        componentes={componentes}
                        containerRef={canvasRef}
                        modoEdicao={false}
                        onEdgeClick={handleEdgeClick}
                        isFullscreen={diagramaFullscreen}
                      />

                      <SinopticoDiagrama
                        componentes={componentes}
                        onComponenteClick={handleComponenteClick}
                        modoEdicao={modoEdicao}
                        componenteEditando={componenteEditando}
                        connecting={connecting}
                      />
                    </div>

                    {/* Container para modais em fullscreen */}
                    {diagramaFullscreen && <div id="fullscreen-modal-container" />}
                  </Card>
                </div>
              </div>
              );
            })()}

            {/* Modo Edição - Tela Cheia */}
            {modoEdicao && (
              <Card className="flex flex-col min-h-[900px] bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between p-4 pb-2 border-b flex-shrink-0 bg-slate-50 dark:bg-slate-900">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Diagrama Unifilar
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={salvarDiagrama}
                      disabled={isSavingDiagrama}
                      className="flex items-center gap-2"
                    >
                      {isSavingDiagrama ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Salvar
                        </>
                      )}
                    </Button>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>Componentes: {componentes.length}</span>
                      <span>Conexões: {connections.length}</span>
                      <span>Histórico: {canUndo ? "Disponível" : "Vazio"}</span>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={toggleModoEdicao}
                      disabled={isSavingDiagrama}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Sair da Edição
                    </Button>
                  </div>
                </div>

                <div className="relative flex-1 min-h-[580px] bg-slate-50 dark:bg-slate-900 overflow-visible" ref={canvasRef}>
                  {/* GRID DE FUNDO - MODO EDIÇÃO (25px fixo, opacidade 100%) */}
                  {canvasRef.current && (
                    <DiagramGrid
                      width={canvasRef.current.offsetWidth || 1920}
                      height={canvasRef.current.offsetHeight || 1080}
                      visible={true}
                      gridSize={25}
                      subdivisions={5}
                      opacity={1.0}
                      // Cores adaptativas: escuro no tema claro, claro no tema escuro
                      gridColor={document.documentElement.classList.contains('dark') ? "#94a3b8" : "#64748b"}
                      subGridColor={document.documentElement.classList.contains('dark') ? "#475569" : "#cbd5e1"}
                    />
                  )}

                  {/* COMPONENTE DE CONEXÕES PARA MODO EDIÇÃO */}
                  <DomAnchoredConnectionsOverlay
                    connections={connections}
                    componentes={componentes}
                    containerRef={canvasRef}
                    modoEdicao={true}
                    connecting={connecting}
                    onRemoverConexao={removerConexao}
                    onEdgeClick={handleEdgeClick}
                  />

                  <SinopticoDiagrama
                    componentes={componentes}
                    onComponenteClick={handleComponenteClick}
                    modoEdicao={modoEdicao}
                    componenteEditando={componenteEditando}
                    connecting={connecting}
                  />

                  {/* Componentes no Modo Edição */}
                  <div className="absolute inset-0" style={{ zIndex: 40 }}>
                    {componentes
                      .filter(comp => comp.tipo !== "PONTO" && comp.tipo !== "JUNCTION")
                      .filter(comp => comp.posicao && typeof comp.posicao.x === 'number' && typeof comp.posicao.y === 'number')
                      .map((componente) => (
                        <div
                          key={componente.id}
                          data-node-id={componente.id}
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
                            dados={componente.dados}
                            onClick={() => handleComponenteClick(componente)}
                          />
                          {/* Não mostrar nome para junction nodes e pontos */}
                          {componente.tipo !== "JUNCTION" && componente.tipo !== "PONTO" && (
                            <div className={`${getLabelPositionClasses(componente.label_position)} text-xs font-medium text-muted-foreground bg-background/90 px-2 py-1 rounded whitespace-nowrap border`}>
                              {componente.tag || componente.nome}
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>

                  {/* Overlay de Edição - Junction Points e Pontos */}
                  <div className="absolute inset-0 z-40 pointer-events-none">
                    {componentes
                      .filter(comp => comp.tipo === "PONTO" || comp.tipo === "JUNCTION")
                      .filter(comp => comp.posicao && typeof comp.posicao.x === 'number' && typeof comp.posicao.y === 'number')
                      .map((componente) => (
                        <div
                          key={`overlay-junction-${componente.id}`}
                          data-node-id={componente.id}
                          className="absolute"
                          style={{
                            left: `${componente.posicao.x}%`,
                            top: `${componente.posicao.y}%`,
                            transform: "translate(-50%, -50%)",
                            width: "30px",
                            height: "30px",
                          }}
                        >
                          {/* Símbolo do Junction Point - CENTRALIZADO */}
                          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                            <ElectricalSymbol
                              tipo={componente.tipo}
                              status={componente.status}
                            />
                          </div>

                          {/* Highlight quando selecionado */}
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

                          {/* Portas de Conexão para Junction Points */}
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
                                <button
                                  key={port}
                                  className="absolute w-4 h-4 bg-blue-500 hover:bg-blue-600 border-2 border-white rounded-full pointer-events-auto transition-all hover:scale-125 shadow-md z-50"
                                  style={style}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startConnection(componente.id, port as "top" | "bottom" | "left" | "right");
                                  }}
                                  title={`Conectar ${port}`}
                                />
                              ))}
                            </>
                          )}

                          {/* Área de Interação */}
                          <div
                            className={`absolute inset-0 ${
                              modoFerramenta === "conectar"
                                ? "pointer-events-none"
                                : "pointer-events-auto"
                            }`}
                            style={{
                              cursor:
                                modoFerramenta === "selecionar"
                                  ? isDragging &&
                                    componenteDragId === componente.id
                                    ? "grabbing"
                                    : "grab"
                                  : modoFerramenta === "conectar"
                                  ? "crosshair"
                                  : "pointer",
                            }}
                            onMouseDown={(e) => {
                              if (modoFerramenta === "selecionar") {
                                handleMouseDown(e, componente.id);
                              }
                            }}
                            onClick={(e) => {
                              if (modoFerramenta !== "selecionar") {
                                e.stopPropagation();
                                handleComponenteClick(componente, e);
                              }
                            }}
                          />
                        </div>
                      ))
                    }
                  </div>

                  {/* Overlay de Edição - Componentes Normais */}
                  <div className="absolute inset-0 z-40 pointer-events-none">
                    {componentes
                      .filter(comp => comp.tipo !== "PONTO" && comp.tipo !== "JUNCTION")
                      .filter(comp => comp.posicao && typeof comp.posicao.x === 'number' && typeof comp.posicao.y === 'number')
                      .map((componente) => (
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
                                className={`absolute w-6 h-6 rounded-full border-2 border-background cursor-pointer transition-all duration-200 pointer-events-auto z-50 hover:scale-110 shadow-lg ${
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
                                  console.log('PORTA CLICADA:', {
                                    componente: componente.id,
                                    port,
                                    connecting,
                                    modoFerramenta
                                  });
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

                        {/* Área de Interação - CORRIGIDO */}
                        <div
                          className={`absolute inset-0 ${
                            modoFerramenta === "conectar"
                              ? "pointer-events-none"
                              : "pointer-events-auto"
                          }`}
                          style={{
                            cursor:
                              modoFerramenta === "selecionar"
                                ? isDragging &&
                                  componenteDragId === componente.id
                                  ? "grabbing"
                                  : "grab"
                                : modoFerramenta === "conectar"
                                ? "crosshair"
                                : "pointer",
                          }}
                          onMouseDown={(e) => {
                            if (modoFerramenta === "selecionar") {
                              handleMouseDown(e, componente.id);
                            }
                          }}
                          onClick={(e) => {
                            if (modoFerramenta !== "selecionar") {
                              e.stopPropagation();
                              handleComponenteClick(componente, e);
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Indicador de Status - CORRIGIDO */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground bg-background/90 px-3 py-2 rounded-full border">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          modoFerramenta === "selecionar"
                            ? "bg-blue-500"
                            : "bg-purple-500"
                        }`}
                      />
                      <span>
                        {modoFerramenta === "selecionar" &&
                          "Clique para selecionar, arraste para mover"}
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

        {/* Modal MQTT de Dados do Inversor (Real-time) */}
        <InversorMqttDataModal
          equipamentoId={selectedInversorMqttId}
          open={inversorMqttModalOpen}
          onOpenChange={setInversorMqttModalOpen}
        />

        {/* Modal do Pivô */}
        {pivoModalOpen && selectedPivoId && (
          <PivoModal
            open={pivoModalOpen}
            onClose={() => {
              setPivoModalOpen(false);
              setSelectedPivoId(null);
            }}
            dados={{
              status: pivoStates[selectedPivoId]?.status || "DESLIGADO",
              operando: pivoStates[selectedPivoId]?.operando || false,
              velocidadeRotacao: pivoStates[selectedPivoId]?.velocidadeRotacao || 0,
              pressaoAgua: pivoStates[selectedPivoId]?.operando ? 3.5 : 0,
              vazaoAgua: pivoStates[selectedPivoId]?.operando ? 120 : 0,
              areaIrrigada: 50,
              tempoOperacao: pivoStates[selectedPivoId]?.tempoOperacao || "0h 00min",
              setorAtual: pivoStates[selectedPivoId]?.setorAtual || 0,
              umidadeSolo: 65,
              modoOperacao: pivoStates[selectedPivoId]?.modoOperacao || "MANUAL",
              ultimaManutencao: "15/11/2024"
            } as DadosPivo}
            nomeComponente={componenteSelecionado?.nome || "Pivô Central"}
            // Funções de controle simuladas
            onLigar={() => {
              // Apenas atualizar o estado local
              setPivoStates(prev => ({
                ...prev,
                [selectedPivoId]: {
                  ...prev[selectedPivoId],
                  status: "NORMAL",
                  velocidadeRotacao: 2.5,
                  tempoOperacao: "0h 01min"
                }
              }));

              // Atualizar status do componente
              setComponentes(prev => prev.map(c =>
                c.dados?.equipamento_id === selectedPivoId
                  ? { ...c, status: "NORMAL" }
                  : c
              ));
            }}
            onDesligar={() => {
              // Apenas atualizar o estado local
              setPivoStates(prev => ({
                ...prev,
                [selectedPivoId]: {
                  ...prev[selectedPivoId],
                  status: "DESLIGADO",
                  operando: false,
                  velocidadeRotacao: 0
                }
              }));

              // Atualizar status e operação do componente
              setComponentes(prev => prev.map(c =>
                c.dados?.equipamento_id === selectedPivoId
                  ? { ...c, status: "INATIVO", dados: { ...c.dados, operando: false }}
                  : c
              ));
            }}
            onIniciarIrrigacao={() => {
              // Atualizar apenas o estado local do PIVO
              setPivoStates(prev => ({
                ...prev,
                [selectedPivoId]: {
                  ...prev[selectedPivoId],
                  operando: true,
                  setorAtual: 0
                }
              }));

              // Atualizar apenas os dados do componente específico sem re-renderizar todo o diagrama
              setComponentes(prev => prev.map(c =>
                c.dados?.equipamento_id === selectedPivoId
                  ? { ...c, dados: { ...c.dados, operando: true }}
                  : c
              ));

              // Simular rotação gradual do pivô
              let angle = 0;
              const interval = setInterval(() => {
                angle += 5;
                if (angle >= 360) {
                  clearInterval(interval);
                  angle = 0;
                }
                setPivoStates(prev => ({
                  ...prev,
                  [selectedPivoId]: {
                    ...prev[selectedPivoId],
                    setorAtual: angle
                  }
                }));
              }, 1000); // Atualiza a cada 1 segundo
            }}
            onPararIrrigacao={() => {
              // Atualizar apenas o estado local do PIVO
              setPivoStates(prev => ({
                ...prev,
                [selectedPivoId]: {
                  ...prev[selectedPivoId],
                  operando: false
                }
              }));

              // Atualizar apenas os dados do componente específico
              setComponentes(prev => prev.map(c =>
                c.dados?.equipamento_id === selectedPivoId
                  ? { ...c, dados: { ...c.dados, operando: false }}
                  : c
              ));
            }}
            onAlterarVelocidade={(velocidade) => {
              setPivoStates(prev => ({
                ...prev,
                [selectedPivoId]: {
                  ...prev[selectedPivoId],
                  velocidadeRotacao: velocidade
                }
              }));
            }}
            onAlterarModo={(modo) => {
              setPivoStates(prev => ({
                ...prev,
                [selectedPivoId]: {
                  ...prev[selectedPivoId],
                  modoOperacao: modo
                }
              }));
            }}
          />
        )}

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

        {modalAberto === "M160" && (
          <M160Modal
            isOpen={true}
            onClose={fecharModal}
            componenteData={componenteSelecionado}
          />
        )}
        <M300Modal
          open={modalAberto === "M300"}
          onClose={fecharModal}
          dados={dadosM300}
          nomeComponente={componenteSelecionado?.nome || ""}
        />
        <A966Modal
          open={modalAberto === "A966"}
          onClose={fecharModal}
          componenteData={componenteSelecionado}
          nomeComponente={componenteSelecionado?.nome || "Gateway A966"}
        />
        <LandisGyrModal
          open={modalAberto === "LANDIS_E750"}
          onClose={fecharModal}
          componenteData={componenteSelecionado}
          nomeComponente={
            componenteSelecionado?.nome || "Medidor Landis+Gyr E750"
          }
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

        {/* Seleção de equipamentos para agregação é feita via modal de configuração */}

        {/* Modal de seleção de unidade - disponível sempre */}
        <ModalSelecionarUnidade
          isOpen={modalSelecionarUnidade}
          onClose={() => setModalSelecionarUnidade(false)}
          onSelect={handleUnidadeSelect}
          currentPlantaId={plantaAtual?.id}
          currentUnidadeId={unidadeId}
        />

        {/* Modal Criar Equipamento Rápido */}
        <ModalCriarEquipamentoRapido
          open={modalCriarRapido}
          onClose={() => setModalCriarRapido(false)}
          onEquipamentoCriado={handleEquipamentoCriado}
          unidadeId={unidadeId}
        />

      </Layout.Main>
    </Layout>
  );
}
