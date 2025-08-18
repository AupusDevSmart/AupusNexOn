// src/features/usinas/components/mapa-usinas.tsx
import { Card } from "@/components/ui/card";
import { useEffect, useRef } from "react";

interface Usina {
  id: number;
  nome: string;
  lat: number;
  lng: number;
  status: "operacao" | "alerta" | "falha";
  potencia: number;
}

interface MapaUsinasProps {
  usinas: Usina[];
  onUsinaClick: (id: number) => void;
  usinaSelecionada: number | null;
}

export function MapaUsinas({
  usinas,
  onUsinaClick,
  usinaSelecionada,
}: MapaUsinasProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    // Verificar se o Leaflet está disponível
    if (
      typeof window !== "undefined" &&
      (window as any).L &&
      mapRef.current &&
      !mapInstanceRef.current
    ) {
      const L = (window as any).L;

      // Inicializar o mapa centrado no Brasil
      const map = L.map(mapRef.current).setView([-14.235, -51.9253], 4);

      // Adicionar camada do OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      mapInstanceRef.current = map;
    }
  }, []);

  useEffect(() => {
    if (
      mapInstanceRef.current &&
      typeof window !== "undefined" &&
      (window as any).L
    ) {
      const L = (window as any).L;
      const map = mapInstanceRef.current;

      // Limpar marcadores existentes
      markersRef.current.forEach((marker) => map.removeLayer(marker));
      markersRef.current = [];

      // Adicionar novos marcadores
      usinas.forEach((usina) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case "operacao":
              return "#10B981";
            case "alerta":
              return "#F59E0B";
            case "falha":
              return "#EF4444";
            default:
              return "#6B7280";
          }
        };

        const isSelected = usinaSelecionada === usina.id;

        // Criar ícone customizado
        const icon = L.divIcon({
          html: `
            <div style="
              width: ${isSelected ? "24px" : "16px"};
              height: ${isSelected ? "24px" : "16px"};
              background-color: ${getStatusColor(usina.status)};
              border: 3px solid #fff;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              ${isSelected ? "animation: pulse 2s infinite;" : ""}
            "></div>
          `,
          className: "custom-marker",
          iconSize: [isSelected ? 24 : 16, isSelected ? 24 : 16],
          iconAnchor: [isSelected ? 12 : 8, isSelected ? 12 : 8],
        });

        // Criar marcador
        const marker = L.marker([usina.lat, usina.lng], { icon }).addTo(map)
          .bindPopup(`
            <div style="min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-weight: bold;">${
                usina.nome
              }</h3>
              <p style="margin: 4px 0;"><strong>Potência:</strong> ${
                usina.potencia
              } kW</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> ${
                usina.status === "operacao"
                  ? "Em Operação"
                  : usina.status === "alerta"
                  ? "Em Alerta"
                  : "Com Falha"
              }</p>
              <button 
                onclick="window.abrirDetalhesUsina(${usina.id})"
                style="
                  background: #3B82F6;
                  color: white;
                  border: none;
                  padding: 6px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                  margin-top: 8px;
                "
              >
                Ver Detalhes
              </button>
            </div>
          `);

        // Adicionar evento de clique apenas para seleção visual
        marker.on("click", () => {
          onUsinaClick(usina.id); // Apenas seleciona visualmente, não abre modal
        });

        markersRef.current.push(marker);
      });

      // Função global para abrir detalhes via popup (apenas botão "Ver Detalhes")
      (window as any).abrirDetalhesUsina = (id: number) => {
        console.log("Botão Ver Detalhes clicado para usina:", id); // Debug
        window.dispatchEvent(
          new CustomEvent("abrirModalUsina", { detail: { id } })
        );
      };
    }
  }, [usinas, usinaSelecionada, onUsinaClick]);

  const getStatusColor = (status: Usina["status"]) => {
    switch (status) {
      case "operacao":
        return "#10B981";
      case "alerta":
        return "#F59E0B";
      case "falha":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  return (
    <Card className="p-6 h-full relative z-0">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Localização das Usinas
        </h3>
      </div>

      <div className="relative z-0">
        {/* Contêiner do Mapa */}
        <div
          ref={mapRef}
          className="w-full h-96 rounded-lg border border-border bg-muted relative z-0"
          style={{ minHeight: "400px" }}
        >
          {/* Fallback se o Leaflet não carregar */}
          {typeof window === "undefined" || !(window as any).L ? (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="mb-2">Carregando mapa...</div>
                <div className="text-sm">
                  Certifique-se de que os scripts do Leaflet foram carregados
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor("operacao") }}
            ></div>
            <span className="text-sm text-muted-foreground">
              Ativos em operação
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor("alerta") }}
            ></div>
            <span className="text-sm text-muted-foreground">
              Ativos em alerta
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor("falha") }}
            ></div>
            <span className="text-sm text-muted-foreground">
              Com falha/offline
            </span>
          </div>
        </div>
      </div>

      {/* CSS para animação e z-index do Leaflet */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Forçar z-index baixo para elementos do Leaflet */
        :global(.leaflet-container) {
          z-index: 1 !important;
        }

        :global(.leaflet-pane) {
          z-index: 1 !important;
        }

        :global(.leaflet-top),
        :global(.leaflet-bottom) {
          z-index: 1 !important;
        }
      `}</style>
    </Card>
  );
}
