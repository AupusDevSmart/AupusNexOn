import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  Minus,
  Plus,
  RotateCcw,
  MapPin,
  Zap,
  AlertTriangle,
  WifiOff
} from "lucide-react";
import { UnidadeResumo } from "../api/coa-api";

interface MapaCoaProps {
  unidades: UnidadeResumo[];
  onUnidadeClick?: (unidadeId: string) => void;
}

export function MapaCoa({ unidades, onUnidadeClick }: MapaCoaProps) {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [unidadeSelecionada, setUnidadeSelecionada] = useState<UnidadeResumo | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  // Filtrar apenas unidades com coordenadas
  const unidadesComCoordenadas = unidades.filter(u => u.coordenadas);

  // Debug: ver quantas unidades temos
  console.log('[MapaCoa] Total de unidades recebidas:', unidades.length);
  console.log('[MapaCoa] Unidades com coordenadas:', unidadesComCoordenadas.length);
  console.log('[MapaCoa] Unidades:', unidades.map(u => ({
    nome: u.nome,
    temCoordenadas: !!u.coordenadas,
    coordenadas: u.coordenadas
  })));

  // Calcular centro e zoom baseado nas unidades
  const calcularFocoInteligente = useCallback(() => {
    if (unidadesComCoordenadas.length === 0) {
      // Centro de Goiás, Brasil por padrão (Goiânia)
      // Leaflet usa [latitude, longitude] - coordenadas de Goiânia: -16.6869° S, -49.2648° W
      return {
        center: [-16.6869, -49.2648] as [number, number],
        zoom: 5,
      };
    }

    // Calcular bounding box
    const lats = unidadesComCoordenadas.map(u => u.coordenadas!.latitude);
    const lngs = unidadesComCoordenadas.map(u => u.coordenadas!.longitude);

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
  }, [unidadesComCoordenadas]);

  // Inicializar mapa
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as any).L &&
      mapRef.current &&
      !mapInstanceRef.current
    ) {
      const L = (window as any).L;

      // SEMPRE iniciar em Goiás (Goiânia) independente de ter unidades
      const centerGoias = [-16.6869, -49.2648] as [number, number];
      const zoomGoias = 5;

      // Criar mapa
      const map = L.map(mapRef.current, {
        zoomControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
      }).setView(centerGoias, zoomGoias);

      // Adicionar camada do mapa
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        {
          attribution: "© OpenStreetMap contributors, © CartoDB",
          maxZoom: 18,
          minZoom: 4,
        }
      ).addTo(map);

      mapInstanceRef.current = map;
    }
  }, []); // Executar apenas uma vez na montagem

  // Atualizar marcadores quando unidades mudarem
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

      // Se não houver unidades com coordenadas, não criar marcadores
      if (unidadesComCoordenadas.length === 0) {
        return;
      }

      // NÃO reposicionar o mapa automaticamente - deixar o usuário controlar
      // O mapa sempre inicia em Goiás e o usuário pode navegar manualmente ou usar o botão reset

      // Adicionar novos marcadores
      unidadesComCoordenadas.forEach((unidade) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case "ONLINE":
              return "#10B981"; // Verde
            case "ALERTA":
              return "#F59E0B"; // Amarelo
            case "OFFLINE":
              return "#6B7280"; // Cinza
            default:
              return "#6B7280";
          }
        };

        const getTipoIcon = (tipo?: string) => {
          if (!tipo) return "⚡";
          if (tipo.toLowerCase().includes("solar") || tipo.toLowerCase().includes("ufv")) {
            return "☀️";
          } else if (tipo.toLowerCase().includes("carga")) {
            return "⚡";
          } else if (tipo.toLowerCase().includes("transform")) {
            return "🔌";
          }
          return "⚙️";
        };

        const isSelected = unidadeSelecionada?.id === unidade.id;

        // Criar ícone customizado
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
                background-color: ${getStatusColor(unidade.status)};
                border: 2px solid #fff;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isSelected ? "14px" : "10px"};
                ${isSelected ? "animation: pulse 2s infinite;" : ""}
              ">${getTipoIcon(unidade.tipo)}</div>
              ${
                unidade.status === "ALERTA"
                  ? `<div style="
                  position: absolute;
                  top: -2px;
                  right: -2px;
                  width: 8px;
                  height: 8px;
                  background-color: #F59E0B;
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
          [unidade.coordenadas!.latitude, unidade.coordenadas!.longitude],
          { icon }
        ).addTo(map);

        // Adicionar popup com informações da unidade
        const popupContent = `
          <div style="min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; font-weight: bold;">${unidade.nome}</h4>
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Status:</strong> ${unidade.status}
            </p>
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Tipo:</strong> ${unidade.tipo || 'N/A'}
            </p>
            ${unidade.cidade ? `
              <p style="margin: 4px 0; font-size: 12px;">
                <strong>Local:</strong> ${unidade.cidade}${unidade.estado ? `, ${unidade.estado}` : ''}
              </p>
            ` : ''}
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Potência:</strong> ${unidade.metricas.potenciaAtual.toFixed(1)} kW
            </p>
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Energia Hoje:</strong> ${unidade.metricas.energiaHoje.toFixed(1)} kWh
            </p>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 250,
          minWidth: 200,
        });

        // Evento de clique para abrir modal
        marker.on("click", () => {
          setUnidadeSelecionada(unidade);
          setModalAberto(true);

          // Centralizar mapa na unidade
          map.setView(
            [unidade.coordenadas!.latitude, unidade.coordenadas!.longitude],
            Math.max(map.getZoom(), 10),
            { animate: true, duration: 0.5 }
          );
        });

        markersRef.current.push(marker);
      });
    }
  }, [unidadesComCoordenadas, unidadeSelecionada, calcularFocoInteligente]);

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

  const fecharModal = () => {
    setUnidadeSelecionada(null);
    setModalAberto(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ONLINE":
        return "#10B981";
      case "ALERTA":
        return "#F59E0B";
      case "OFFLINE":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  // Renderizar mapa sempre, mesmo sem unidades (mostrará Goiás por padrão)

  const navegarParaUnidade = (unidade: UnidadeResumo) => {
    if (mapInstanceRef.current && unidade.coordenadas) {
      mapInstanceRef.current.setView(
        [unidade.coordenadas.latitude, unidade.coordenadas.longitude],
        12,
        { animate: true, duration: 1 }
      );
      setUnidadeSelecionada(unidade);
      setModalAberto(true);
    }
  };

  return (
    <>
      {/* COMENTADO: Lista de Unidades lateral - pode ser reativada futuramente */}
      {/* <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <Card className="p-4 h-[400px] overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Unidades ({unidadesComCoordenadas.length})</h3>
            </div>
            {unidadesComCoordenadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma unidade com coordenadas cadastradas
                </p>
              </div>
            ) : (
              unidadesComCoordenadas.map((unidade) => (
                <button
                  key={unidade.id}
                  onClick={() => navegarParaUnidade(unidade)}
                  className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors border border-transparent hover:border-border"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getStatusColor(unidade.status) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{unidade.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {unidade.cidade}, {unidade.estado}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card> */}

        {/* Mapa - Agora ocupa toda a largura */}
        <Card className="p-0 h-full relative border-0 shadow-none bg-transparent z-[0]">
          <div className="relative h-full">
            <div
              ref={mapRef}
              className="w-full h-full min-h-[400px] rounded-lg border border-border bg-muted relative z-1"
            >
              {/* Fallback se o Leaflet não carregar */}
              {typeof window === "undefined" || !(window as any).L ? (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <div className="mb-2">🗺️ Carregando mapa...</div>
                  </div>
                </div>
              ) : null}
            </div>

          {/* Indicador de unidades */}
          <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{unidadesComCoordenadas.length} unidades no mapa</span>
            </div>
          </div>

          {/* Controles do mapa */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={zoomIn}
              className="h-8 w-8 bg-background/90 backdrop-blur-sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={zoomOut}
              className="h-8 w-8 bg-background/90 backdrop-blur-sm"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetView}
              className="h-8 w-8 bg-background/90 backdrop-blur-sm"
              title={unidadesComCoordenadas.length > 0 ? "Enquadrar todas as unidades" : "Voltar para Goiás"}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Legenda */}
          <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor("ONLINE") }}
                />
                <span>Online</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor("ALERTA") }}
                />
                <span>Alerta</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor("OFFLINE") }}
                />
                <span>Offline</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal de detalhes da unidade */}
      <Dialog open={modalAberto} onOpenChange={fecharModal}>
        <DialogContent className="sm:max-w-md z-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              {unidadeSelecionada?.nome}
            </DialogTitle>
            <DialogDescription>
              Detalhes e métricas da unidade selecionada
            </DialogDescription>
          </DialogHeader>

          {unidadeSelecionada && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Status
                  </span>
                  <Badge
                    variant={unidadeSelecionada.status === "ONLINE" ? "default" : unidadeSelecionada.status === "ALERTA" ? "destructive" : "secondary"}
                    className={`mt-1 ${
                      unidadeSelecionada.status === "ONLINE"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : unidadeSelecionada.status === "ALERTA"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : ""
                    }`}
                  >
                    {unidadeSelecionada.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Tipo
                  </span>
                  <p className="text-sm font-medium">
                    {unidadeSelecionada.tipo || "N/A"}
                  </p>
                </div>
              </div>

              {(unidadeSelecionada.cidade || unidadeSelecionada.estado) && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Localização
                  </span>
                  <p className="text-sm">
                    {unidadeSelecionada.cidade}
                    {unidadeSelecionada.cidade && unidadeSelecionada.estado && ", "}
                    {unidadeSelecionada.estado}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Potência Atual
                  </span>
                  <p className="text-lg font-semibold text-green-600">
                    {unidadeSelecionada.metricas.potenciaAtual.toFixed(1)} kW
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Energia Hoje
                  </span>
                  <p className="text-lg font-semibold text-blue-600">
                    {unidadeSelecionada.metricas.energiaHoje.toFixed(1)} kWh
                  </p>
                </div>
              </div>

              {unidadeSelecionada.metricas.fatorPotencia > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Fator de Potência
                  </span>
                  <p className="text-sm font-medium">
                    {unidadeSelecionada.metricas.fatorPotencia.toFixed(2)}
                  </p>
                </div>
              )}

              {unidadeSelecionada.ultimaLeitura && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Última Atualização
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {new Date(unidadeSelecionada.ultimaLeitura).toLocaleString(
                      "pt-BR"
                    )}
                  </p>
                </div>
              )}

              <Button
                onClick={() => {
                  navigate(`/supervisorio/sinoptico-ativo/${unidadeSelecionada.id}`);
                  fecharModal();
                }}
                className="w-full"
                size="sm"
              >
                Ver Detalhes Completos
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </>
  );
}