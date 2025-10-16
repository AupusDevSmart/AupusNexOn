interface PivoSymbolProps {
  status: "NORMAL" | "ALARME" | "FALHA" | "DESLIGADO";
  rotacao?: number;
  operando?: boolean;
  onClick?: () => void;
  estado?: "ABERTO" | "FECHADO"; // ✅ NOVA PROPRIEDADE
}

export function PivoSymbol({
  status = "NORMAL",
  rotacao = 0,
  operando = false,
  onClick,
  estado = "ABERTO", // ✅ Padrão é ABERTO
}: PivoSymbolProps) {
  // ✅ NOVA LÓGICA: Sobrescrever cor baseado no estado
  const getStatusClasses = () => {
    // Se está fechado, sempre vermelho independente do status
    if (estado === "FECHADO") {
      return {
        stroke: "stroke-red-500",
        fill: "fill-red-500",
      };
    }
    
    // Se está aberto, usar cor baseada no status
    if (estado === "ABERTO") {
      if (status === "ALARME") {
        return {
          stroke: "stroke-amber-500",
          fill: "fill-amber-500",
        };
      }
      if (status === "FALHA") {
        return {
          stroke: "stroke-red-500",
          fill: "fill-red-500",
        };
      }
      // Normal = verde
      return {
        stroke: "stroke-green-500",
        fill: "fill-green-500",
      };
    }

    // Desligado = cinza
    return {
      stroke: "stroke-gray-400",
      fill: "fill-gray-400",
    };
  };

  const currentClasses = getStatusClasses();

  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 60 60"
      className="drop-shadow-sm cursor-pointer transition-transform hover:scale-110"
      onClick={onClick}
    >
      {/* Círculo externo - área de irrigação */}
      <circle
        cx="30"
        cy="30"
        r="24"
        className={`${currentClasses.stroke} fill-none`}
        strokeWidth="2"
        strokeDasharray="4,2"
        opacity={estado === "FECHADO" ? "0.3" : "0.6"} // ✅ Mais opaco quando fechado
      />

      {/* Círculo intermediário */}
      <circle
        cx="30"
        cy="30"
        r="18"
        className={`${currentClasses.stroke} fill-none`}
        strokeWidth="1"
        opacity={estado === "FECHADO" ? "0.2" : "0.3"}
      />

      {/* Ponto central - torre fixa */}
      <circle cx="30" cy="30" r="4" className={currentClasses.fill} />

      {/* Anel interno no centro */}
      <circle
        cx="30"
        cy="30"
        r="6"
        className={`${currentClasses.stroke} fill-background`}
        strokeWidth="1.5"
      />

      {/* ✅ VISUAL DIFERENTE PARA FECHADO */}
      {estado === "FECHADO" ? (
        // Pivô Fechado: Braço com X indicando bloqueio
        <g>
          {/* Braço do pivô (opaco) */}
          <line
            x1="30"
            y1="30"
            x2="54"
            y2="30"
            className={currentClasses.stroke}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.5"
          />
          
          {/* X indicando fechado/bloqueado */}
          <g transform="translate(44, 30)">
            <line
              x1="-6"
              y1="-6"
              x2="6"
              y2="6"
              className="stroke-red-600"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="-6"
              x2="-6"
              y2="6"
              className="stroke-red-600"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </g>
      ) : (
        // Pivô Aberto: Braço rotacionável com gotas
        <g transform={`rotate(${rotacao} 30 30)`}>
          {/* Braço do pivô */}
          <line
            x1="30"
            y1="30"
            x2="54"
            y2="30"
            className={currentClasses.stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Setas indicando rotação (quando operando) */}
          {operando && (
            <path
              d="M 50 26 L 54 30 L 50 34"
              className={currentClasses.stroke}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 54 30"
                to="360 54 30"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>
          )}

          {/* Gotas de água (quando operando) */}
          {operando && (
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
      )}

      {/* LED de status */}
      <circle 
        cx="52" 
        cy="8" 
        r="5" 
        className={currentClasses.fill} 
        opacity="0.9"
      >
        {operando && estado === "ABERTO" && (
          <animate
            attributeName="opacity"
            values="0.9;0.4;0.9"
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Label */}
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
        {estado === "FECHADO" ? "PF" : "PV"} {/* ✅ PF = Pivô Fechado, PV = Pivô aberto */}
      </text>
    </svg>
  );
}