import { Layout } from "@/components/common/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  ArrowLeft,
  Circle,
  Copy,
  Edit3,
  Gauge,
  HardDrive,
  Link,
  Maximize,
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
import { ConexoesDiagrama } from "@/features/supervisorio/components/conexoes-diagrama";
import { DisjuntorModal } from "@/features/supervisorio/components/disjuntor-modal";
import { InversorModal } from "@/features/supervisorio/components/inversor-modal";
import { LandisGyrModal } from "@/features/supervisorio/components/landisgyr-modal";
import { M160Modal } from "@/features/supervisorio/components/m160-modal";
import { M300Modal } from "@/features/supervisorio/components/m300-modal";
import { MedidorModal } from "@/features/supervisorio/components/medidor-modal";
import { SinopticoDiagrama } from "@/features/supervisorio/components/sinoptico-diagrama";
import { SinopticoGraficos } from "@/features/supervisorio/components/sinoptico-graficos";
import { SinopticoIndicadores } from "@/features/supervisorio/components/sinoptico-indicadores";
import { TransformadorModal } from "@/features/supervisorio/components/transformador-modal";
import { useMqttWebSocket } from "@/hooks/useMqttWebSocket";
import {
  createJunctionNode,
  splitConnectionWithJunction,
  calculateJunctionPositionOnLine,
  detectEdgeClick,
} from "@/features/supervisorio/utils/junctionHelpers";
// import { useHistory } from "@/features/supervisorio/hooks/useHistory";

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
      {/* Caixa cinza preenchida */}
      <rect
        x="2"
        y="2"
        width="36"
        height="16"
        className="fill-gray-600 dark:fill-gray-500"
        rx="2"
      />
      {/* Contorno */}
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
      {/* Caixa vermelha preenchida - FECHADO/ENERGIZADO */}
      <rect
        x="2"
        y="2"
        width="36"
        height="16"
        className="fill-red-600 dark:fill-red-500"
        rx="2"
      />
      {/* Contorno */}
      <rect
        x="2"
        y="2"
        width="36"
        height="16"
        className="stroke-red-800 dark:stroke-red-700"
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
      {/* Caixa verde preenchida - ABERTO/DESENERGIZADO */}
      <rect
        x="2"
        y="2"
        width="36"
        height="16"
        className="fill-green-600 dark:fill-green-500"
        rx="2"
      />
      {/* Contorno */}
      <rect
        x="2"
        y="2"
        width="36"
        height="16"
        className="stroke-green-800 dark:stroke-green-700"
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
  const { ativoId } = useParams<{ ativoId: string }>();
  const navigate = useNavigate();

  // NOVO: Ativo selecionado (substitui ativoId)
  const [ativoSelecionado, setAtivoSelecionado] =
    useState<string>("ativo-principal");

  // NOVO: Estados principais
  const [componentes, setComponentes] = useState<ComponenteDU[]>([
    {
      id: "m160-1",
      tipo: "M160",
      nome: "M160 Multimedidor",
      posicao: { x: 20, y: 50 },
      status: "NORMAL",
      tag: "OLI/GO/CHI/CAB/M160-1",
      dados: {}
    },
    {
      id: "a966-1",
      tipo: "A966",
      nome: "A966 Gateway IoT",
      posicao: { x: 50, y: 50 },
      status: "NORMAL",
      tag: "IMS/a966/state",
      dados: {}
    },
    {
      id: "landis-1",
      tipo: "LANDIS_E750",
      nome: "Landis+Gyr E750",
      posicao: { x: 80, y: 50 },
      status: "NORMAL",
      tag: "IMS/a966/LANDIS/state",
      dados: {}
    },
  ]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [diagramaCarregado, setDiagramaCarregado] = useState(false);

  // Estados para modais
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [componenteSelecionado, setComponenteSelecionado] =
    useState<ComponenteDU | null>(null);
  const [diagramaFullscreen, setDiagramaFullscreen] = useState(false);

  // Estados para o modo de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  // CORRIGIDO: Tipo ajustado para "selecionar" | "conectar"
  const [modoFerramenta, setModoFerramenta] = useState<
    "selecionar" | "conectar"
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
  const [connecting, setConnecting] = useState<{
    from: string;
    port: "top" | "bottom" | "left" | "right";
  } | null>(null);

  // Lista de ativos disponíveis
  const ativosDisponiveis = [
    { id: "ativo-principal", nome: "UFV Solar Goiânia" },
    { id: "ativo-secundario", nome: "UFV Industrial Brasília" },
    { id: "ativo-teste", nome: "Usina Teste" },
    { id: "mqtt-devices", nome: "Equipamentos MQTT" },
  ];

  // Função do diagrama padrão
  const getDiagramaPadrao = useCallback(
    (): ComponenteDU[] => {
      // Diagrama específico para equipamentos MQTT
      if (ativoSelecionado === "mqtt-devices") {
        return [
          {
            id: "m160-1",
            tipo: "M160",
            nome: "M160 Multimedidor",
            posicao: { x: 20, y: 50 },
            status: "NORMAL",
            tag: "OLI/GO/CHI/CAB/M160-1",
            dados: {}
          },
          {
            id: "a966-1",
            tipo: "A966",
            nome: "A966 Gateway IoT",
            posicao: { x: 50, y: 50 },
            status: "NORMAL",
            tag: "IMS/a966/state",
            dados: {}
          },
          {
            id: "landis-1",
            tipo: "LANDIS_E750",
            nome: "Landis+Gyr E750",
            posicao: { x: 80, y: 50 },
            status: "NORMAL",
            tag: "IMS/a966/LANDIS/state",
            dados: {}
          },
        ];
      }

      // Diagrama padrão para outros ativos
      return [
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
      {
        id: "m300-01",
        tipo: "M300",
        nome: "M300-01",
        posicao: { x: 60, y: 30 },
        status: "NORMAL",
        dados: {},
      },
      {
        id: "a966-01",
        tipo: "A966",
        nome: "Gateway Principal",
        posicao: { x: 45, y: 50 },
        status: "NORMAL",
        dados: {},
      },
      {
        id: "landisgyr-01",
        tipo: "LANDIS_E750",
        nome: "Medidor Principal",
        posicao: { x: 70, y: 40 },
        status: "NORMAL",
        dados: {},
      },
      ];
    },
    [ativoSelecionado]
  );

  // Estados já definidos acima - remover esta seção completamente

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

  // CARREGAR DIAGRAMA SALVO
useEffect(() => {
  const carregarDiagrama = () => {
    console.log("📂 === CARREGAMENTO INICIADO ===");
    console.log("🎯 Ativo selecionado:", ativoSelecionado);

    try {
      const key = `diagrama_${ativoSelecionado}`;
      console.log("🔑 Buscando key:", key);
      
      const diagramaSalvo = localStorage.getItem(key);
      console.log("📦 Dados encontrados?", diagramaSalvo ? "SIM" : "NÃO");

      if (diagramaSalvo) {
        const data = JSON.parse(diagramaSalvo);
        console.log("✅ Dados parseados:", {
          componentes: data.componentes?.length || 0,
          connections: data.connections?.length || 0,
          ultimaAtualizacao: data.ultimaAtualizacao
        });

        if (data.componentes && Array.isArray(data.componentes) && data.componentes.length > 0) {
          setComponentes(data.componentes);
          setConnections(data.connections || []);
          console.log("📊 Diagrama restaurado com sucesso!");
        } else {
          console.log("⚠️ Dados inválidos, usando diagrama padrão");
          setComponentes(getDiagramaPadrao());
          setConnections([]);
        }
      } else {
        console.log("📋 Nenhum dado salvo, usando diagrama padrão");
        setComponentes(getDiagramaPadrao());
        setConnections([]);
      }
    } catch (error) {
      console.error("❌ Erro ao carregar:", error);
      setComponentes(getDiagramaPadrao());
      setConnections([]);
    }

    setDiagramaCarregado(true);
    console.log("✅ Carregamento finalizado");
  };

  carregarDiagrama();
}, [ativoSelecionado, getDiagramaPadrao]); 

  // AUTO-SAVE quando houver mudanças
  useEffect(() => {
    if (!diagramaCarregado || componentes.length === 0) return;

    const timeoutId = setTimeout(() => {
      try {
        const diagramaData = {
          ativoId: ativoSelecionado,
          componentes,
          connections,
          ultimaAtualizacao: new Date().toISOString(),
          versao: "1.0",
        };

        const key = `diagrama_${ativoSelecionado}`;
        localStorage.setItem(key, JSON.stringify(diagramaData));
        console.log(
          "💾 Auto-save:",
          key,
          componentes.length,
          "componentes"
        );
      } catch (error) {
        console.error("❌ Erro auto-save:", error);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [
    componentes,
    connections,
    diagramaCarregado,
    ativoSelecionado,
  ]);

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

  // Hooks MQTT para equipamentos (apenas quando mqtt-devices está selecionado)
  const { data: m160Data } = useMqttWebSocket(
    ativoSelecionado === "mqtt-devices" ? "OLI/GO/CHI/CAB/M160-1" : ""
  );
  const { data: a966Data } = useMqttWebSocket(
    ativoSelecionado === "mqtt-devices" ? "IMS/a966/state" : ""
  );
  const { data: landisData } = useMqttWebSocket(
    ativoSelecionado === "mqtt-devices" ? "IMS/a966/LANDIS/state" : ""
  );

  // Estado para histórico de dados MQTT (usado nos gráficos)
  const [historicoMqtt, setHistoricoMqtt] = useState<any[]>([]);
  const ultimaAtualizacaoRef = useRef<number>(0);

  // Adicionar dados MQTT ao histórico (throttle de 5 segundos)
  useEffect(() => {
    if (ativoSelecionado === "mqtt-devices" && m160Data?.payload?.Dados) {
      const agora = Date.now();

      // Atualizar apenas a cada 5 segundos
      if (agora - ultimaAtualizacaoRef.current < 5000) {
        return;
      }

      ultimaAtualizacaoRef.current = agora;

      const m160Dados = m160Data.payload.Dados;
      const timestamp = new Date().toISOString();

      const novoPonto = {
        timestamp,
        potencia: ((m160Dados.Pa || 0) + (m160Dados.Pb || 0) + (m160Dados.Pc || 0)), // Multiplicado por 10
        tensao: ((m160Dados.Va || 0)),
        corrente: ((m160Dados.Ia || 0) + (m160Dados.Ib || 0) + (m160Dados.Ic || 0)),
        fatorPotencia: (m160Dados.FPA !== 999 && m160Dados.FPA !== 0) ? m160Dados.FPA / 1000 : 1,
        limiteMinimo: 0.92,
      };

      setHistoricoMqtt(prev => {
        const novoHistorico = [...prev, novoPonto];
        // Manter apenas últimos 100 pontos para reduzir uso de memória
        return novoHistorico.slice(-100);
      });
    }
  }, [ativoSelecionado, m160Data]);

  const [dadosGraficos] = useState(() => {
    const agora = new Date();
    return Array.from({ length: 288 }, (_, i) => {
      // 288 pontos = 24h em intervalos de 5 min
      const timestamp = new Date(
        agora.getTime() - (287 - i) * 5 * 60 * 1000 // 5 minutos entre cada ponto
      ).toISOString();

      // Simula um dia típico com picos de demanda
      const hora = i / 12; // Converte índice para hora do dia
      let potencia = 1800; // Base

      // Padrão diário: baixa demanda de madrugada, picos nos horários comerciais
      if (hora >= 6 && hora < 9) {
        // Manhã: aumento progressivo
        potencia = 1900 + (hora - 6) * 150 + Math.random() * 100;
      } else if (hora >= 9 && hora < 12) {
        // Meio da manhã: demanda alta, alguns picos ultrapassam
        potencia =
          2200 + Math.sin((hora - 9) * Math.PI) * 200 + Math.random() * 150;
      } else if (hora >= 12 && hora < 14) {
        // Horário de almoço: pico máximo - ULTRAPASSA OS LIMITES
        potencia =
          2400 +
          Math.sin((hora - 12) * Math.PI * 2) * 250 +
          Math.random() * 150;
      } else if (hora >= 14 && hora < 18) {
        // Tarde: demanda elevada, próxima ao limite
        potencia =
          2100 + Math.sin((hora - 14) * Math.PI) * 150 + Math.random() * 120;
      } else if (hora >= 18 && hora < 20) {
        // Final do expediente: novo pico - PODE ULTRAPASSAR
        potencia =
          2300 + Math.sin((hora - 18) * Math.PI) * 200 + Math.random() * 100;
      } else {
        // Madrugada/noite: demanda baixa
        potencia = 1600 + Math.random() * 100;
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
  });

  // Calcular indicadores baseados em dados MQTT ou usar valores fixos
  const indicadores = useMemo(() => {
    if (ativoSelecionado === "mqtt-devices" && m160Data?.payload?.Dados) {
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

    // Valores padrão para outros ativos
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
  }, [ativoSelecionado, m160Data]);

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

  // Atualizar histórico quando componentes/conexões mudarem
  useEffect(() => {
    if (diagramaCarregado && componentes.length > 0) {
      const currentState = { componentes, connections };
      const lastState = history[historyIndex];

      // Só adicionar ao histórico se houve mudança real
      if (
        !lastState ||
        JSON.stringify(lastState.componentes) !== JSON.stringify(componentes) ||
        JSON.stringify(lastState.connections) !== JSON.stringify(connections)
      ) {
        addToHistory(currentState);
      }
    }
  }, [componentes, connections, diagramaCarregado]);

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

    updateDiagram(newComponents);
  }, [componentes, updateDiagram]);

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

    updateDiagram(aligned);
  }, [componentes, updateDiagram]);

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

    updateDiagram(aligned);
  }, [componentes, updateDiagram]);

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

  // Função principal de clique em componente - CORRIGIDO + MQTT
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

      // ============================================
      // LÓGICA PARA DETECTAR TÓPICO MQTT E ABRIR MODAL CORRETO
      // ============================================
      // Verifica se o componente tem um 'tag' (tópico MQTT)
      // e abre o modal específico baseado no tópico

      const tag = (componente as any).tag || '';

      if (tag.includes('M160')) {
        setModalAberto('M160');
      } else if (tag.includes('a966/state') && !tag.includes('LANDIS')) {
        setModalAberto('A966');
      } else if (tag.includes('LANDIS')) {
        setModalAberto('LANDIS_E750');
      } else {
        // Fallback para o tipo original
        setModalAberto(componente.tipo);
      }
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

  // Sistema de drag and drop - CORRIGIDO
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, componentId: string) => {
      if (modoFerramenta !== "selecionar" || !modoEdicao) return;

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

    // ===== SNAP TO GRID (5%) =====
    
    const gridSize = 1; 
    newX = Math.round(newX / gridSize) * gridSize;
    newY = Math.round(newY / gridSize) * gridSize;
    // =============================

    // Aplicar limites
    newX = Math.max(2, Math.min(98, newX));
    newY = Math.max(2, Math.min(98, newY));

    const newComponentes = componentes.map((comp) =>
      comp.id === componenteDragId
        ? { ...comp, posicao: { x: newX, y: newY } }
        : comp
    );

    setComponentes(newComponentes);
  },
  [isDragging, componenteDragId, dragOffset, componentes]
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
    updateDiagram(
      undefined,
      connections.filter((conn) => conn.id !== connectionId)
    );
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
    updateDiagram([...componentes, novoComponente]);
  };

  const removerComponente = (id: string) => {
    const newComponentes = componentes.filter((c) => c.id !== id);
    const newConnections = connections.filter(
      (conn) => conn.from !== id && conn.to !== id
    );
    updateDiagram(newComponentes, newConnections);
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
      if (!modoEdicao || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
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
    [modoEdicao, componentes, connections, updateDiagram]
  );

  const salvarDiagrama = useCallback(() => {
  console.log("💾 === SALVAMENTO MANUAL INICIADO ===");
  console.log("📊 Ativo:", ativoSelecionado);
  console.log("📦 Componentes:", componentes.length);
  console.log("🔗 Conexões:", connections.length);
  console.log("📋 Componentes:", componentes.map(c => ({ id: c.id, tipo: c.tipo, nome: c.nome })));

  try {
    const diagramaData = {
      ativoId: ativoSelecionado,
      componentes,
      connections,
      ultimaAtualizacao: new Date().toISOString(),
      versao: "1.0",
    };

    const key = `diagrama_${ativoSelecionado}`;
    const dataString = JSON.stringify(diagramaData);
    
    console.log("🔑 Key:", key);
    console.log("📏 Tamanho dos dados:", dataString.length, "caracteres");

    localStorage.setItem(key, dataString);
    console.log("✅ Dados salvos no localStorage");

    // Verificação imediata
    const verificacao = localStorage.getItem(key);
    if (verificacao) {
      const dadosVerificados = JSON.parse(verificacao);
      console.log("✅ VERIFICAÇÃO: Dados recuperados com sucesso!");
      console.log("📦 Componentes verificados:", dadosVerificados.componentes.length);
      console.log("🔗 Conexões verificadas:", dadosVerificados.connections.length);
      
      alert(`✅ Diagrama salvo com sucesso!\n\nAtivo: ${ativoSelecionado}\nComponentes: ${componentes.length}\nConexões: ${connections.length}`);
    } else {
      console.error("❌ ERRO: Dados não encontrados após salvar!");
      alert("❌ Erro: Não foi possível verificar o salvamento!");
    }
  } catch (error) {
    console.error("❌ ERRO ao salvar:", error);
    alert(`❌ Erro ao salvar diagrama: ${error}`);
  }
}, [ativoSelecionado, componentes, connections]); 
    
  // LOADING STATE - Não renderizar até carregar
  if (!diagramaCarregado) {
    return (
      <Layout>
        <Layout.Main>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando diagrama...</p>
              <p className="text-xs text-muted-foreground mt-2">
                Ativo: {ativoSelecionado}
              </p>
            </div>
          </div>
        </Layout.Main>
      </Layout>
    );
  }

  const ativoAtual = ativosDisponiveis.find((a) => a.id === ativoSelecionado);

  return (
    <Layout>
      <Layout.Main>
        <div className="w-full max-w-full space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3 p-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>

            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                Sinóptico - {ativoAtual?.nome}
              </h1>

              {/* Seletor de Ativo */}
              <select
                value={ativoSelecionado}
                onChange={(e) => setAtivoSelecionado(e.target.value)}
                className="h-8 px-3 py-1 text-sm border border-input bg-background rounded-md"
              >
                {ativosDisponiveis.map((ativo) => (
                  <option key={ativo.id} value={ativo.id}>
                    {ativo.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Debug info */}
            <div className="text-xs text-muted-foreground">
              Componentes: {componentes.length} | LocalStorage: diagrama_
              {ativoSelecionado}
            </div>
          </div>

          {/* Indicadores */}
          <SinopticoIndicadores indicadores={indicadores} />

          {/* Barra de Ferramentas - SÓ APARECE NO MODO EDIÇÃO */}
          {modoEdicao && (
            <div className="mb-6">
              <Card className="p-4">
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
                        <option value="PONTO">Ponto (Junção)</option>
                        <option value="MEDIDOR">Medidor</option>
                        <option value="TRANSFORMADOR">Transformador</option>
                        <option value="INVERSOR">Inversor</option>
                        <option value="DISJUNTOR">Disjuntor (Sem Supervisão)</option>         
                        <option value="DISJUNTOR_FECHADO">Disjuntor Fechado (Vermelho)</option> 
                        <option value="DISJUNTOR_ABERTO">Disjuntor Aberto (Verde)</option>     
                        <option value="BOTOEIRA">Botoeira</option>
                        <option value="CHAVE_ABERTA">Chave Aberta</option>
                        <option value="CHAVE_FECHADA">Chave Fechada</option>
                        <option value="CHAVE_FUSIVEL">Chave Fusível</option>
                        <option value="RELE">Relé</option>
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
                      <optgroup label="Equipamentos SCADA">
                        <option value="M160">M160 Multimedidor</option>
                        <option value="M300">M300 Multimeter</option>
                        <option value="LANDIS_E750">Landis+Gyr E750</option>
                        <option value="A966">A-966 Gateway</option>
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
                    dadosPotencia={
                      ativoSelecionado === "mqtt-devices" && historicoMqtt.length > 0
                        ? historicoMqtt
                        : dadosGraficos
                    }
                    dadosTensao={
                      ativoSelecionado === "mqtt-devices" && historicoMqtt.length > 0
                        ? historicoMqtt
                        : dadosGraficos
                    }
                    valorContratado={2300} //simulando valores
                    percentualAdicional={5} //simulando valores
                  />
                </div>

                {/* Diagrama Unifilar - MODO VISUALIZAÇÃO */}
                <div className="lg:col-span-2 flex">
                  <Card className="flex flex-col w-full min-h-[900px]">
                    <div className="flex items-center justify-between p-4 pb-2 border-b flex-shrink-0">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Network className="h-5 w-5" />
                        Diagrama Unifilar
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDiagramaFullscreen(true)}
                          className="flex items-center gap-2"
                        >
                          <Maximize className="h-4 w-4" />
                          Tela Cheia
                        </Button>
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
                        onEdgeClick={handleEdgeClick}
                        className="z-30"
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
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Network className="h-5 w-5" />
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
                      <span>Histórico: {canUndo ? "Disponível" : "Vazio"}</span>
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
                    onEdgeClick={handleEdgeClick}
                    className="z-30"
                  />

                  <SinopticoDiagrama
                    componentes={componentes}
                    onComponenteClick={handleComponenteClick}
                    modoEdicao={modoEdicao}
                    componenteEditando={componenteEditando}
                    connecting={connecting}
                  />

                  {/* Componentes no Modo Edição */}
                  <div className="absolute inset-0 z-5">
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
                        {/* Não mostrar nome para junction nodes e pontos */}
                        {componente.tipo !== "JUNCTION" && componente.tipo !== "PONTO" && (
                          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-muted-foreground bg-background/90 px-2 py-1 rounded whitespace-nowrap border">
                            {componente.nome}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Overlay de Edição */}
                  <div className="absolute inset-0 z-40 pointer-events-none">
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

        {/* Modal Fullscreen do Diagrama */}
        <Dialog open={diagramaFullscreen} onOpenChange={setDiagramaFullscreen}>
          <DialogContent className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 m-0">
            <div className="flex flex-col h-full">
              {/* Header do Modal */}
              <DialogHeader className="border-b p-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Diagrama Unifilar - Tela Cheia
                  </DialogTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDiagramaFullscreen(false)}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Fechar
                  </Button>
                </div>
              </DialogHeader>

              {/* Conteúdo do Diagrama */}
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0" ref={canvasRef}>
                  {/* Componente de Conexões */}
                  <ConexoesDiagrama
                    connections={connections}
                    componentes={componentes}
                    containerRef={canvasRef}
                    modoEdicao={false}
                    onEdgeClick={handleEdgeClick}
                    className="z-30"
                  />

                  {/* Componente do Diagrama */}
                  <SinopticoDiagrama
                    componentes={componentes}
                    onComponenteClick={handleComponenteClick}
                    modoEdicao={false}
                    componenteEditando={null}
                    connecting={null}
                    mostrarGrid={true}
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Layout.Main>
    </Layout>
  );
}
