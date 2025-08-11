// src/features/supervisorio/components/mapa-brasil.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Filter, MapPin, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// Tipos simples para Leaflet
type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  setMaxBounds: (bounds: unknown) => LeafletMap;
  on: (event: string, handler: () => void) => LeafletMap;
  removeLayer: (layer: unknown) => LeafletMap;
  scrollWheelZoom: {
    enable: () => void;
    disable: () => void;
  };
  getContainer: () => HTMLElement;
  zoomIn: () => LeafletMap;
  zoomOut: () => LeafletMap;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (
    content: string,
    options?: Record<string, unknown>
  ) => LeafletMarker;
  on: (event: string, handler: () => void) => LeafletMarker;
};

// Declaração global para Leaflet
declare global {
  interface Window {
    L?: {
      map: (
        element: HTMLElement,
        options?: Record<string, unknown>
      ) => LeafletMap;
      tileLayer: (
        url: string,
        options?: Record<string, unknown>
      ) => { addTo: (map: LeafletMap) => unknown };
      latLngBounds: (corner1: unknown, corner2: unknown) => unknown;
      latLng: (latitude: number, longitude: number) => unknown;
      marker: (
        latlng: [number, number],
        options?: Record<string, unknown>
      ) => LeafletMarker;
      divIcon: (options: Record<string, unknown>) => unknown;
      DomUtil: {
        create: (tagName: string, className?: string) => HTMLElement;
      };
      control: (options?: Record<string, unknown>) => {
        onAdd?: (map: LeafletMap) => HTMLElement;
        addTo: (map: LeafletMap) => unknown;
      };
    };
    abrirSinoptico?: (id: string) => void;
  }
}

// Tipos para os dados dos ativos
interface AtivoMapa {
  id: string;
  nome: string;
  tipo: "UFV" | "CARGA" | "TRANSFORMADOR" | "BATERIA";
  estado: string;
  cidade: string;
  coordenadas: {
    latitude: number;
    longitude: number;
  };
  status: "NORMAL" | "ALARME" | "URGENCIA" | "TRIP";
  potenciaNominal: number;
  potenciaAtual?: number;
  ultimaAtualizacao: string;
  eficiencia?: number;
  disponibilidade?: number;
}

interface MapaBrasilProps {
  ativos: AtivoMapa[];
  onAtivoClick?: (ativoId: string) => void;
  atualizacaoTempo?: number;
}

export function MapaBrasil({
  ativos,
  onAtivoClick,
  atualizacaoTempo = 5,
}: MapaBrasilProps) {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  const [ativoSelecionado, setAtivoSelecionado] = useState<string | null>(null);
  const [filtroTipos, setFiltroTipos] = useState({
    UFV: true,
    CARGA: true,
    TRANSFORMADOR: true,
    BATERIA: true,
  });
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());

  // Simular atualizações em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setUltimaAtualizacao(new Date());
    }, atualizacaoTempo * 1000);

    return () => clearInterval(interval);
  }, [atualizacaoTempo]);

  // Inicializar mapa Leaflet
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.L &&
      mapRef.current &&
      !mapInstanceRef.current
    ) {
      const L = window.L;

      // Inicializar o mapa centrado no Brasil
      const map = L.map(mapRef.current, {
        zoomControl: false, // Vamos criar controles customizados
        scrollWheelZoom: false, // ❌ DESABILITADO por padrão
        doubleClickZoom: true,
        touchZoom: true,
        dragging: true, // ✅ ARRASTAR COM MOUSE
      }).setView([-14.235, -51.9253], 5);

      // Camada de tiles com melhor qualidade
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
        minZoom: 4,
      }).addTo(map);

      // Definir limites do Brasil para evitar pan excessivo
      const brasilBounds = L.latLngBounds(
        L.latLng(5.27438888, -73.98283055), // Nordeste
        L.latLng(-33.75118637, -34.79314722) // Sudoeste
      );
      map.setMaxBounds(brasilBounds);

      // ✅ CONTROLE DE SCROLL INTELIGENTE
      // Só permite zoom com scroll quando o mapa está em foco (hover)
      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());

      // Habilitar zoom com scroll ao passar mouse por cima
      map.getContainer().addEventListener("mouseenter", () => {
        map.scrollWheelZoom.enable();
      });

      // Desabilitar zoom com scroll ao sair com mouse
      map.getContainer().addEventListener("mouseleave", () => {
        map.scrollWheelZoom.disable();
      });

      // Adicionar indicador visual quando scroll zoom está ativo
      const scrollIndicator = L.control({ position: "topleft" });
      scrollIndicator.onAdd = function () {
        const div = L.DomUtil.create("div", "scroll-indicator");
        div.innerHTML = `
          <div id="scroll-hint" style="
            background: rgba(59, 130, 246, 0.9);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            display: none;
            white-space: nowrap;
          ">
            🖱️ Scroll para zoom
          </div>
        `;
        return div;
      };
      scrollIndicator.addTo(map);

      // Mostrar/esconder indicador
      map.getContainer().addEventListener("mouseenter", () => {
        const hint = document.getElementById("scroll-hint");
        if (hint) hint.style.display = "block";
        setTimeout(() => {
          if (hint) hint.style.display = "none";
        }, 2000);
      });

      mapInstanceRef.current = map;
    }
  }, []);

  // Atualizar marcadores
  useEffect(() => {
    if (mapInstanceRef.current && typeof window !== "undefined" && window.L) {
      const L = window.L;
      const map = mapInstanceRef.current;

      // Limpar marcadores existentes
      markersRef.current.forEach((marker) => map.removeLayer(marker));
      markersRef.current = [];

      // Filtrar ativos conforme tipos selecionados
      const ativosFiltrados = ativos.filter((ativo) => filtroTipos[ativo.tipo]);

      // Adicionar novos marcadores
      ativosFiltrados.forEach((ativo) => {
        const isSelected = ativoSelecionado === ativo.id;

        // Cores por status (igual ao padrão do projeto)
        const getStatusColor = (status: string) => {
          switch (status) {
            case "NORMAL":
              return "#10B981"; // Verde
            case "ALARME":
              return "#F59E0B"; // Amarelo
            case "URGENCIA":
              return "#EF4444"; // Vermelho
            case "TRIP":
              return "#EF4444"; // Vermelho
            default:
              return "#6B7280"; // Cinza
          }
        };

        // Ícones por tipo
        const getTipoIcon = (tipo: string) => {
          switch (tipo) {
            case "UFV":
              return "☀️";
            case "CARGA":
              return "⚡";
            case "TRANSFORMADOR":
              return "🔌";
            case "BATERIA":
              return "🔋";
            default:
              return "📍";
          }
        };

        // Criar ícone customizado igual ao padrão do projeto
        const icon = L.divIcon({
          html: `
            <div style="
              width: ${isSelected ? "28px" : "20px"};
              height: ${isSelected ? "28px" : "20px"};
              background-color: ${getStatusColor(ativo.status)};
              border: 3px solid #fff;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? "12px" : "10px"};
              ${isSelected ? "animation: pulse 2s infinite;" : ""}
              ${
                ativo.status === "URGENCIA" || ativo.status === "TRIP"
                  ? "animation: ping 2s infinite;"
                  : ""
              }
            ">
              ${getTipoIcon(ativo.tipo)}
            </div>
          `,
          className: "custom-marker",
          iconSize: [isSelected ? 28 : 20, isSelected ? 28 : 20],
          iconAnchor: [isSelected ? 14 : 10, isSelected ? 14 : 10],
        });

        // Criar marcador
        const marker = L.marker(
          [ativo.coordenadas.latitude, ativo.coordenadas.longitude],
          { icon }
        )
          .addTo(map)
          .bindPopup(
            `
            <div style="min-width: 250px; font-family: system-ui;">
              <h3 style="margin: 0 0 12px 0; font-weight: bold; color: #1f2937; font-size: 16px;">
                ${getTipoIcon(ativo.tipo)} ${ativo.nome}
              </h3>
              <div style="margin: 8px 0; padding: 8px; background: #f9fafb; border-radius: 6px; font-size: 14px;">
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <strong>Tipo:</strong> 
                  <span>${ativo.tipo}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <strong>Status:</strong> 
                  <span style="
                    padding: 2px 8px; 
                    border-radius: 12px; 
                    background: ${getStatusColor(ativo.status)}20; 
                    color: ${getStatusColor(ativo.status)};
                    font-weight: bold;
                    font-size: 12px;
                  ">${ativo.status}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <strong>Localização:</strong> 
                  <span>${ativo.cidade}, ${ativo.estado}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <strong>Potência:</strong> 
                  <span>${ativo.potenciaNominal} MW</span>
                </div>
                ${
                  ativo.potenciaAtual !== undefined
                    ? `
                  <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                    <strong>Geração Atual:</strong> 
                    <span style="color: #10B981; font-weight: bold;">${ativo.potenciaAtual} MW</span>
                  </div>
                `
                    : ""
                }
                ${
                  ativo.eficiencia !== undefined
                    ? `
                  <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                    <strong>Eficiência:</strong> 
                    <span>${ativo.eficiencia}%</span>
                  </div>
                `
                    : ""
                }
                ${
                  ativo.disponibilidade !== undefined
                    ? `
                  <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                    <strong>Disponibilidade:</strong> 
                    <span>${ativo.disponibilidade}%</span>
                  </div>
                `
                    : ""
                }
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <strong>Atualização:</strong> 
                  <span style="font-size: 12px; color: #6b7280;">
                    ${new Date(ativo.ultimaAtualizacao).toLocaleTimeString(
                      "pt-BR"
                    )}
                  </span>
                </div>
              </div>
              <button
                onclick="window.abrirSinoptico('${ativo.id}')"
                style="
                  width: 100%;
                  background: #3B82F6;
                  color: white;
                  border: none;
                  padding: 10px 16px;
                  border-radius: 6px;
                  cursor: pointer;
                  margin-top: 12px;
                  font-weight: bold;
                  font-size: 14px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
                  transition: background 0.2s;
                "
                onmouseover="this.style.background='#2563EB'"
                onmouseout="this.style.background='#3B82F6'"
              >
                <span>🔍</span> Abrir Sinóptico
              </button>
            </div>
          `,
            {
              maxWidth: 280,
              className: "custom-popup",
            }
          );

        // Evento de clique para seleção visual
        marker.on("click", () => {
          setAtivoSelecionado(ativo.id);
          if (onAtivoClick) {
            onAtivoClick(ativo.id);
          }
        });

        markersRef.current.push(marker);
      });

      // Função global para abrir sinóptico
      window.abrirSinoptico = (ativoId: string) => {
        navigate(`/supervisorio/sinoptico-ativo/${ativoId}`);
      };
    }
  }, [ativos, ativoSelecionado, onAtivoClick, filtroTipos, navigate]);

  // Controles de zoom
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([-14.235, -51.9253], 5);
      setAtivoSelecionado(null);
    }
  };

  // Filtrar ativos conforme tipos selecionados
  const ativosFiltrados = ativos.filter((ativo) => filtroTipos[ativo.tipo]);

  // Estatísticas por status
  const estatisticas = {
    normal: ativosFiltrados.filter((a) => a.status === "NORMAL").length,
    alarme: ativosFiltrados.filter((a) => a.status === "ALARME").length,
    urgencia: ativosFiltrados.filter((a) =>
      ["URGENCIA", "TRIP"].includes(a.status)
    ).length,
    total: ativosFiltrados.length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "#10B981";
      case "ALARME":
        return "#F59E0B";
      case "URGENCIA":
        return "#EF4444";
      case "TRIP":
        return "#EF4444";
      default:
        return "#6B7280";
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
      case "BATERIA":
        return "🔋";
      default:
        return "📍";
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Mapa de Ativos - Brasil
            <Badge variant="outline" className="ml-2">
              {estatisticas.total} ativos visíveis
            </Badge>
          </CardTitle>

          {/* Indicador de atualização */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Atualizado: {ultimaAtualizacao.toLocaleTimeString()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        {/* Controles e Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
          {/* Filtros por tipo */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>

            {Object.entries(filtroTipos).map(([tipo, ativo]) => (
              <div key={tipo} className="flex items-center space-x-2">
                <Switch
                  id={tipo}
                  checked={ativo}
                  onCheckedChange={(checked) =>
                    setFiltroTipos((prev) => ({ ...prev, [tipo]: checked }))
                  }
                />
                <label
                  htmlFor={tipo}
                  className="text-sm font-medium cursor-pointer flex items-center gap-1"
                >
                  <span>{getTipoIcon(tipo)}</span>
                  {tipo}
                  <Badge variant="outline" className="text-xs">
                    {ativos.filter((a) => a.tipo === tipo).length}
                  </Badge>
                </label>
              </div>
            ))}
          </div>

          {/* Controles de visualização */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              className="flex items-center gap-1"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              className="flex items-center gap-1"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetView}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Container do Mapa */}
        <div className="relative">
          <div
            ref={mapRef}
            className="w-full rounded-lg border border-border bg-muted"
            style={{ height: "400px" }}
          >
            {/* Fallback se o Leaflet não carregar */}
            {typeof window === "undefined" || !window.L ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="mb-2">⚠️ Carregando mapa interativo...</div>
                  <div className="text-sm">
                    Certifique-se de que os scripts do Leaflet foram carregados
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Instruções de uso */}
          <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur p-2 rounded text-xs text-muted-foreground max-w-xs">
            💡 <strong>Dicas:</strong>
            <br />• <strong>Passe o mouse sobre o mapa</strong> para ativar zoom
            <br />
            • Use +/- ou scroll para zoom
            <br />
            • Arraste para mover o mapa
            <br />• Clique nos pinos para ver detalhes
          </div>
        </div>

        {/* Legenda com estatísticas - compacta */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Status:</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getStatusColor("NORMAL") }}
              ></div>
              <span className="text-sm">Normal</span>
              <Badge variant="outline" className="text-xs px-1 h-5">
                {estatisticas.normal}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getStatusColor("ALARME") }}
              ></div>
              <span className="text-sm">Alarme</span>
              <Badge variant="outline" className="text-xs px-1 h-5">
                {estatisticas.alarme}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: getStatusColor("URGENCIA") }}
              ></div>
              <span className="text-sm">Crítico</span>
              <Badge variant="outline" className="text-xs px-1 h-5">
                {estatisticas.urgencia}
              </Badge>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            🖱️ Hover no mapa → Scroll para zoom
          </div>
        </div>
      </CardContent>

      {/* CSS para animações */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes ping {
            0% { transform: scale(1); opacity: 1; }
            25% { transform: scale(1.2); opacity: 0.8; }
            50% { transform: scale(1.4); opacity: 0.6; }
            75% { transform: scale(1.2); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }

          .leaflet-container { z-index: 1 !important; }
          .leaflet-popup-content { margin: 8px 12px !important; }
          .custom-popup .leaflet-popup-content-wrapper { 
            border-radius: 8px !important; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          }
        `,
        }}
      />
    </Card>
  );
}
