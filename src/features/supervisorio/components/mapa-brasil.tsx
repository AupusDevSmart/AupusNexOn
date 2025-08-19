// src/features/supervisorio/components/mapa-brasil.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  focoAtivo?: string | null;
}

// Dados mock para gráficos
const dadosGraficos24h = [
  { hora: "00:00", potencia: 0, meta: 0 },
  { hora: "06:00", potencia: 15, meta: 20 },
  { hora: "09:00", potencia: 45, meta: 50 },
  { hora: "12:00", potencia: 85, meta: 80 },
  { hora: "15:00", potencia: 70, meta: 75 },
  { hora: "18:00", potencia: 25, meta: 30 },
  { hora: "21:00", potencia: 5, meta: 10 },
];

export function MapaBrasil({
  ativos,
  onAtivoClick,
  atualizacaoTempo = 5,
  focoAtivo = null,
}: MapaBrasilProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Estados para o painel sinóptico
  const [ativoSelecionado, setAtivoSelecionado] = useState<Ativo | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);

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
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        {
          attribution: "© OpenStreetMap contributors,  © CartoDB",
          maxZoom: 18,
          minZoom: 4,
        }
      ).addTo(map);

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
        const isSelected =
          focoAtivo === ativo.id || ativoSelecionado?.id === ativo.id;

        // Criar ícone customizado mais elaborado
        const icon = L.divIcon({
          html: `
            <div style="
              position: relative;
              width: ${isSelected ? "32px" : "24px"};
              height: ${isSelected ? "32px" : "24px"};
            ">
              <div style="
                width: ${isSelected ? "28px" : "20px"};
                height: ${isSelected ? "28px" : "20px"};
                background-color: ${getStatusColor(ativo.status)};
                border: 2px solid #fff;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isSelected ? "14px" : "10px"};
                ${isSelected ? "animation: pulse 2s infinite;" : ""}
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
          iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
          iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
        });

        // Criar marcador
        const marker = L.marker(
          [ativo.coordenadas.latitude, ativo.coordenadas.longitude],
          { icon }
        ).addTo(map);

        // Adicionar evento de clique para abrir painel sinóptico
        marker.on("click", () => {
          setAtivoSelecionado(ativo);
          setPainelAberto(true);

          // Centralizar mapa no ativo
          map.setView(
            [ativo.coordenadas.latitude, ativo.coordenadas.longitude],
            Math.max(map.getZoom(), 10),
            { animate: true, duration: 0.5 }
          );
        });

        markersRef.current.push(marker);
      });

      // Função global para abrir sinóptico
      (window as any).abrirSinopticoAtivo = (ativoId: string) => {
        onAtivoClick(ativoId);
      };

      // Lógica de zoom automático para ativo focado
      if (focoAtivo) {
        const ativoFocado = ativos.find((a) => a.id === focoAtivo);
        if (ativoFocado) {
          // Dar zoom na localização do ativo focado
          map.setView(
            [
              ativoFocado.coordenadas.latitude,
              ativoFocado.coordenadas.longitude,
            ],
            12,
            {
              animate: true,
              duration: 1.0,
            }
          );
        }
      }
    }
  }, [
    ativos,
    onAtivoClick,
    calcularFocoInteligente,
    focoAtivo,
    ativoSelecionado,
  ]);

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

  const centralizarAtivo = () => {
    if (ativoSelecionado && mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [
          ativoSelecionado.coordenadas.latitude,
          ativoSelecionado.coordenadas.longitude,
        ],
        12,
        { animate: true, duration: 1 }
      );
    }
  };

  const fecharPainel = () => {
    setAtivoSelecionado(null);
    setPainelAberto(false);
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
    <Card className="p-2 h-full relative z-0">
      <div className="flex items-center justify-end mb-2">
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
        {/* Layout 2/3 + 1/3 com Mapa e Sinóptico */}
        <div
          className={`grid gap-4 transition-all duration-300 ${
            painelAberto ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
          }`}
        >
          {/* ÁREA DO MAPA - 2/3 quando painel aberto */}
          <div className={painelAberto ? "lg:col-span-2" : "col-span-1"}>
            <div
              ref={mapRef}
              className="w-full h-96 rounded-lg border border-border bg-muted relative z-0"
              style={{ minHeight: "420px" }}
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
          </div>

          {/* PAINEL SINÓPTICO LATERAL - 1/3 da tela */}
          {painelAberto && ativoSelecionado && (
            <div className="lg:col-span-1">
              <div
                className="h-96 bg-slate-50 dark:bg-gray-700/50 rounded-lg border border-border overflow-hidden flex flex-col"
                style={{ minHeight: "420px" }}
              >
                {/* Header do Painel */}
                <div className="flex items-center justify-between p-3 border-b bg-white dark:bg-gray-800 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <h3 className="font-semibold text-slate-800 dark:text-gray-200 text-sm">
                      {ativoSelecionado.nome}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fecharPainel}
                    className="h-6 w-6 p-0 text-slate-500 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Conteúdo Simples - Ocupa toda altura restante */}
                <div className="flex-1 p-4 space-y-4 flex flex-col justify-center">
                  {/* Tipo e Status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase">
                        Tipo:
                      </span>
                      <p className="text-sm font-medium text-slate-800 dark:text-gray-200">
                        {ativoSelecionado.tipo}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase">
                        Status:
                      </span>
                      <Badge
                        variant={
                          ativoSelecionado.status === "NORMAL"
                            ? "default"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {ativoSelecionado.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Localização */}
                  <div>
                    <span className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase">
                      Localização:
                    </span>
                    <p className="text-sm text-slate-700 dark:text-gray-300">
                      {ativoSelecionado.cidade}, {ativoSelecionado.estado}
                    </p>
                  </div>

                  {/* Potência Nominal e Geração Atual */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase">
                        Potência Nominal:
                      </span>
                      <p className="text-sm font-medium text-blue-600">
                        {ativoSelecionado.potenciaNominal} MW
                      </p>
                    </div>
                    {ativoSelecionado.potenciaAtual !== undefined && (
                      <div>
                        <span className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase">
                          Geração Atual:
                        </span>
                        <p className="text-sm font-medium text-green-600">
                          {ativoSelecionado.potenciaAtual} MW
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Eficiência e Disponibilidade */}
                  {(ativoSelecionado.eficiencia ||
                    ativoSelecionado.disponibilidade) && (
                    <div className="grid grid-cols-2 gap-3">
                      {ativoSelecionado.eficiencia !== undefined && (
                        <div>
                          <span className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase">
                            Eficiência:
                          </span>
                          <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
                            {ativoSelecionado.eficiencia}%
                          </p>
                        </div>
                      )}
                      {ativoSelecionado.disponibilidade && (
                        <div>
                          <span className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase">
                            Disponibilidade:
                          </span>
                          <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
                            {ativoSelecionado.disponibilidade}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Última Atualização */}
                  <div>
                    <span className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase">
                      Última Atualização:
                    </span>
                    <p className="text-xs text-slate-500 dark:text-gray-500">
                      {new Date(
                        ativoSelecionado.ultimaAtualizacao
                      ).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Indicador de atualização */}
        {atualizacaoTempo && (
          <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1 text-xs text-muted-foreground z-10">
            ⟳ Atualiza a cada {atualizacaoTempo}s
          </div>
        )}

        {/* Legenda */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm">
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
      <style>{`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
          }
          
          .custom-marker-coa {
            background: transparent !important;
            border: none !important;
          }
        `}</style>
    </Card>
  );
}
