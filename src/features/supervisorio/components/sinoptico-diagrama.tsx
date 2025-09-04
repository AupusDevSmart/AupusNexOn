import { useState } from "react";

// Interface do componente
interface ComponenteDU {
  id: string;
  tipo: string;
  nome: string;
  posicao: { x: number; y: number };
  status: string;
  dados: any;
}

// Props do componente
interface SinopticoDiagramaProps {
  componentes: ComponenteDU[];
  onComponenteClick: (componente: ComponenteDU) => void;
  className?: string;
  mostrarGrid?: boolean;
}

// Componente para renderizar símbolos elétricos - APENAS VISUALIZAÇÃO
const ElectricalSymbol = ({
  tipo,
  status = "NORMAL",
  onClick,
}: {
  tipo: string;
  status: string;
  onClick?: () => void;
}) => {
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

// Componente principal - APENAS VISUALIZAÇÃO
export function SinopticoDiagrama({
  componentes,
  onComponenteClick,
  className = "",
  mostrarGrid = false,
}: SinopticoDiagramaProps) {
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  return (
    <div className={`relative w-full h-full min-h-[400px] ${className}`}>
      {/* Grid de visualização */}
      {mostrarGrid && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <pattern
              id="grid-sinoptico"
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
          <rect width="100%" height="100%" fill="url(#grid-sinoptico)" />
        </svg>
      )}
      {/* Área de visualização dos componentes */}
      <div className="absolute inset-0">
        {componentes.map((componente) => (
          <div
            key={componente.id}
            className="absolute"
            style={{
              left: `${componente.posicao.x}%`,
              top: `${componente.posicao.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onMouseEnter={() => setHoveredComponent(componente.id)}
            onMouseLeave={() => setHoveredComponent(null)}
            onClick={() => onComponenteClick(componente)}
          >
            <ElectricalSymbol
              tipo={componente.tipo}
              status={componente.status}
            />

            {/* Label do componente */}
            <div
              className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-muted-foreground bg-background/90 px-2 py-1 rounded whitespace-nowrap border transition-opacity ${
                hoveredComponent === componente.id
                  ? "opacity-100"
                  : "opacity-80"
              }`}
            >
              {componente.nome}
            </div>

            {/* Highlight no hover */}
            {hoveredComponent === componente.id && (
              <div className="absolute inset-0 ring-2 ring-blue-400 ring-offset-1 rounded-lg pointer-events-none animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Indicador quando não há componentes */}
      {componentes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <div className="text-4xl mb-2">⚡</div>
            <p className="text-lg font-medium">Nenhum componente no diagrama</p>
            <p className="text-sm">
              Adicione componentes para visualizar o diagrama unifilar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
