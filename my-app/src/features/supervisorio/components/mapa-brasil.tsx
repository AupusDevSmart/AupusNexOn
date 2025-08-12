// src/features/supervisorio/components/mapa-brasil.tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

interface Ativo {
  id: string;
  nome: string;
  tipo: "UFV" | "CARGA" | "TRANSFORMADOR";
  estado: string;
  cidade: string;
  coordenadas: {
    latitude: number;
    longitude: number;
    x: number;
    y: number;
  };
  status: "NORMAL" | "ALARME" | "TRIP" | "URGENCIA";
  potenciaNominal: number;
  potenciaAtual?: number;
  eficiencia?: number;
  disponibilidade?: number;
  ultimaAtualizacao: string;
}

interface MapaBrasilProps {
  ativos: Ativo[];
  onAtivoClick: (ativoId: string) => void;
  atualizacaoTempo?: number;
}

export function MapaBrasil({
  ativos,
  onAtivoClick,
  atualizacaoTempo = 5,
}: MapaBrasilProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Função para calcular o centro e zoom baseado nos ativos
  const calcularFocoInteligente = useCallback(() => {
    if (ativos.length === 0) {
      // Padrão: Centro do Brasil
      return {
        center: [-14.235, -51.9253] as [number, number],
        zoom: 4,
      };
    }

    // Obter estados únicos dos ativos
    const estadosUnicos = [...new Set(ativos.map((ativo) => ativo.estado))];

    // Se há apenas um estado (como Goiás), focar nele
    if (estadosUnicos.length === 1) {
      // Coordenadas dos estados brasileiros para foco
      const coordenadasEstados: Record<
        string,
        { lat: number; lng: number; zoom: number }
      > = {
        Goiás: { lat: -16.6869, lng: -49.2648, zoom: 7 },
        "São Paulo": { lat: -23.5505, lng: -46.6333, zoom: 7 },
        "Rio de Janeiro": { lat: -22.9068, lng: -43.1729, zoom: 8 },
        "Minas Gerais": { lat: -19.9167, lng: -43.9345, zoom: 7 },
        Bahia: { lat: -12.9714, lng: -38.5014, zoom: 6 },
        Ceará: { lat: -3.7319, lng: -38.5267, zoom: 7 },
        // Adicione mais estados conforme necessário
      };

      const estado = estadosUnicos[0];
      const coordEstado = coordenadasEstados[estado];

      if (coordEstado) {
        return {
          center: [coordEstado.lat, coordEstado.lng] as [number, number],
          zoom: coordEstado.zoom,
        };
      }
    }

    // Se há múltiplos estados, calcular bounding box
    const lats = ativos.map((ativo) => ativo.coordenadas.latitude);
    const lngs = ativos.map((ativo) => ativo.coordenadas.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Calcular zoom baseado na distância
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    let zoom = 7;
    if (maxDiff > 20) zoom = 4;
    else if (maxDiff > 10) zoom = 5;
    else if (maxDiff > 5) zoom = 6;
    else if (maxDiff > 2) zoom = 7;
    else zoom = 8;

    return {
      center: [centerLat, centerLng] as [number, number],
      zoom,
    };
  }, [ativos]);

  // Inicializar mapa
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as any).L &&
      mapRef.current &&
      !mapInstanceRef.current
    ) {
      const L = (window as any).L;
      const { center, zoom } = calcularFocoInteligente();

      // Criar mapa com foco inteligente
      const map = L.map(mapRef.current, {
        zoomControl: false, // Removemos o controle padrão para usar nossos botões
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
      }).setView(center, zoom);

      // Adicionar camada do OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
        minZoom: 4,
      }).addTo(map);

      mapInstanceRef.current = map;
    }
  }, [calcularFocoInteligente]);

  // Atualizar marcadores e refocar quando ativos mudarem
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

      // Refocar no estado/região dos ativos
      const { center, zoom } = calcularFocoInteligente();
      map.setView(center, zoom, { animate: true, duration: 1 });

      // Adicionar novos marcadores
      ativos.forEach((ativo) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case "NORMAL":
              return "#10B981"; // Verde
            case "ALARME":
              return "#F59E0B"; // Amarelo
            case "TRIP":
              return "#EF4444"; // Vermelho
            case "URGENCIA":
              return "#DC2626"; // Vermelho escuro
            default:
              return "#6B7280"; // Cinza
          }
        };

        const getTipoIcon = (tipo: string) => {
          switch (tipo) {
            case "UFV":
              return "☀️";
            case "CARGA":
              return "⚡";
            case "TRANSFORMADOR":
              return "🔌";
            default:
              return "⚙️";
          }
        };

        // Criar ícone customizado mais elaborado
        const icon = L.divIcon({
          html: `
            <div style="
              position: relative;
              width: 24px;
              height: 24px;
            ">
              <div style="
                width: 20px;
                height: 20px;
                background-color: ${getStatusColor(ativo.status)};
                border: 2px solid #fff;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
              ">${getTipoIcon(ativo.tipo)}</div>
              ${
                ativo.status === "TRIP" || ativo.status === "URGENCIA"
                  ? `<div style="
                  position: absolute;
                  top: -2px;
                  right: -2px;
                  width: 8px;
                  height: 8px;
                  background-color: #EF4444;
                  border: 1px solid #fff;
                  border-radius: 50%;
                  animation: pulse 2s infinite;
                "></div>`
                  : ""
              }
            </div>
          `,
          className: "custom-marker-coa",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        // Criar marcador com popup detalhado
        const marker = L.marker(
          [ativo.coordenadas.latitude, ativo.coordenadas.longitude],
          { icon }
        )
          .addTo(map)
          .bindPopup(
            `
            <div style="min-width: 250px; font-family: system-ui;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="font-size: 16px;">${getTipoIcon(ativo.tipo)}</span>
                <h3 style="margin: 0; font-weight: bold; font-size: 14px;">${
                  ativo.nome
                }</h3>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 12px;">
                <div>
                  <strong>Tipo:</strong><br/>
                  <span style="color: #6B7280;">${ativo.tipo}</span>
                </div>
                <div>
                  <strong>Status:</strong><br/>
                  <span style="
                    color: ${getStatusColor(ativo.status)};
                    font-weight: bold;
                  ">${ativo.status}</span>
                </div>
                <div>
                  <strong>Potência:</strong><br/>
                  <span style="color: #6B7280;">${
                    ativo.potenciaNominal
                  } MW</span>
                </div>
                <div>
                  <strong>Localização:</strong><br/>
                  <span style="color: #6B7280;">${ativo.cidade}, ${
              ativo.estado
            }</span>
                </div>
              </div>
              
              ${
                ativo.potenciaAtual !== undefined
                  ? `
                <div style="margin-bottom: 12px; font-size: 12px;">
                  <strong>Geração Atual:</strong> 
                  <span style="color: ${
                    ativo.potenciaAtual === 0 ? "#EF4444" : "#10B981"
                  }; font-weight: bold;">
                    ${ativo.potenciaAtual} MW
                  </span>
                </div>
              `
                  : ""
              }
              
              ${
                ativo.eficiencia !== undefined
                  ? `
                <div style="margin-bottom: 12px; font-size: 12px;">
                  <strong>Eficiência:</strong> 
                  <span style="color: #6B7280;">${ativo.eficiencia}%</span>
                </div>
              `
                  : ""
              }
              
              <button 
                onclick="window.abrirSinopticoAtivo('${ativo.id}')"
                style="
                  background: #3B82F6;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 6px;
                  cursor: pointer;
                  width: 100%;
                  font-size: 12px;
                  font-weight: 500;
                "
                onmouseover="this.style.background='#2563EB'"
                onmouseout="this.style.background='#3B82F6'"
              >
                🔍 Ver Sinóptico
              </button>
            </div>
          `,
            {
              maxWidth: 300,
              className: "custom-popup-coa",
            }
          );

        // Adicionar evento de clique
        marker.on("click", () => {
          console.log(`Clicado no ativo: ${ativo.id}`);
        });

        markersRef.current.push(marker);
      });

      // Função global para abrir sinóptico
      (window as any).abrirSinopticoAtivo = (ativoId: string) => {
        onAtivoClick(ativoId);
      };
    }
  }, [ativos, onAtivoClick, calcularFocoInteligente]);

  // Funções de controle de zoom
  const zoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const zoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const resetView = () => {
    if (mapInstanceRef.current) {
      const { center, zoom } = calcularFocoInteligente();
      mapInstanceRef.current.setView(center, zoom, {
        animate: true,
        duration: 1,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "#10B981";
      case "ALARME":
        return "#F59E0B";
      case "TRIP":
        return "#EF4444";
      case "URGENCIA":
        return "#DC2626";
      default:
        return "#6B7280";
    }
  };

  return (
    <Card className="p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Mapa dos Ativos
          </h3>
          <p className="text-sm text-muted-foreground">
            {ativos.length} ativo{ativos.length !== 1 ? "s" : ""} monitorado
            {ativos.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Controles de Zoom */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetView}
            title="Reset View"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        {/* Contêiner do Mapa */}
        <div
          ref={mapRef}
          className="w-full h-96 rounded-lg border border-border bg-muted"
          style={{ minHeight: "400px" }}
        >
          {/* Fallback se o Leaflet não carregar */}
          {typeof window === "undefined" || !(window as any).L ? (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="mb-2">🗺️ Carregando mapa...</div>
                <div className="text-sm">
                  Focando nos estados com instalações
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Indicador de atualização */}
        {atualizacaoTempo && (
          <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1 text-xs text-muted-foreground">
            ⟳ Atualiza a cada {atualizacaoTempo}s
          </div>
        )}

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor("NORMAL") }}
            ></div>
            <span className="text-muted-foreground">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor("ALARME") }}
            ></div>
            <span className="text-muted-foreground">Alarme</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor("TRIP") }}
            ></div>
            <span className="text-muted-foreground">Trip</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor("URGENCIA") }}
            ></div>
            <span className="text-muted-foreground">Urgência</span>
          </div>
        </div>
      </div>

      {/* CSS para animações */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .custom-marker-coa {
          background: transparent !important;
          border: none !important;
        }

        .custom-popup-coa {
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }

        .custom-popup-coa .leaflet-popup-content-wrapper {
          border-radius: 8px;
          padding: 0;
        }

        .custom-popup-coa .leaflet-popup-content {
          margin: 16px;
        }

        .custom-popup-coa .leaflet-popup-tip {
          background: white;
        }
      `}</style>
    </Card>
  );
}
