// src/features/supervisorio/components/mapa-brasil.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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

export function MapaBrasil({
  ativos,
  onAtivoClick,
  atualizacaoTempo = 5,
  focoAtivo = null,
}: MapaBrasilProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const navigate = useNavigate();

  // Estados para o modal sinóptico
  const [ativoSelecionado, setAtivoSelecionado] = useState<Ativo | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

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

      // Criar mapa com foco inteligente - SEM controles padrão
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

        // Adicionar evento de clique para abrir modal sinóptico
        marker.on("click", () => {
          setAtivoSelecionado(ativo);
          setModalAberto(true);

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

  const fecharModal = () => {
    setAtivoSelecionado(null);
    setModalAberto(false);
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
    <Card className="p-0 h-full relative z-0 border-0 shadow-none bg-transparent">
      {/* Layout Principal: Mapa + Tabelas lado a lado */}
      <div className="flex gap-1">
        {/* LADO ESQUERDO: Mapa (50%) */}
        <div className="w-1/2 relative">
          <div
            ref={mapRef}
            className="w-full h-[600px] rounded-lg border border-border bg-muted relative z-0"
            style={{ minHeight: "600px" }}
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
            <div className="absolute top-1 left-1 bg-background/90 backdrop-blur-sm border rounded-lg px-2 py-1 text-xs text-muted-foreground z-10">
              ⟳ Atualiza a cada {atualizacaoTempo}s
            </div>
          )}

          {/* CONTROLES + LEGENDA - Agora horizontais abaixo do mapa */}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            {/* Legenda do mapa à esquerda */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor("NORMAL") }}
                ></div>
                <span className="text-muted-foreground">Normal</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor("ALARME") }}
                ></div>
                <span className="text-muted-foreground">Alarme</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor("TRIP") }}
                ></div>
                <span className="text-muted-foreground">Trip</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor("URGENCIA") }}
                ></div>
                <span className="text-muted-foreground">Urgência</span>
              </div>
            </div>

            {/* Controles do mapa à direita - Horizontais */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={zoomIn}
                className="w-6 h-6 p-0"
                title="Aumentar zoom"
              >
                <Plus className="h-3 w-3" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={zoomOut}
                className="w-6 h-6 p-0"
                title="Diminuir zoom"
              >
                <Minus className="h-3 w-3" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={resetView}
                className="w-6 h-6 p-0"
                title="Recarregar mapa"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Tabelas (50%) */}
        <div className="w-1/2 space-y-2 h-[600px] flex flex-col">
          {/* Tabela de Usinas Fotovoltaicas */}
          <div className="bg-card border rounded-lg p-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <h3 className="text-sm font-semibold text-foreground">
                USINAS FOTOVOLTAICAS
              </h3>
              <span className="text-xs text-muted-foreground ml-auto">
                (5 mais recentes)
              </span>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 text-muted-foreground font-medium text-xs">
                      Nome
                    </th>
                    <th className="text-left py-2 text-muted-foreground font-medium text-xs">
                      Potência
                    </th>
                    <th className="text-center py-2 text-muted-foreground font-medium text-xs">
                      Status
                    </th>
                    <th className="text-center py-2 text-muted-foreground font-medium text-xs">
                      Trip
                    </th>
                    <th className="text-center py-2 text-muted-foreground font-medium text-xs">
                      Alarme
                    </th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">
                      Update
                    </th>
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  {ativos
                    .filter((ativo) => ativo.tipo === "UFV")
                    .slice(0, 5)
                    .map((ativo, index) => {
                      const percentage = Math.round(
                        ((ativo.potenciaAtual || 0) / ativo.potenciaNominal) *
                          100
                      );
                      const updateTime = new Date(
                        ativo.ultimaAtualizacao
                      ).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const tripsCount = ativo.status === "TRIP" ? 1 : 0;
                      const alarmesCount = ativo.status === "ALARME" ? 1 : 0;

                      return (
                        <tr
                          key={ativo.id}
                          className="border-b border-border/30 hover:bg-muted/30"
                        >
                          <td
                            className="py-2 text-foreground font-medium truncate max-w-[140px] text-sm"
                            title={ativo.nome}
                          >
                            {ativo.nome}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 transition-all duration-300"
                                  style={{
                                    width: `${Math.min(percentage, 100)}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">
                                {percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2 text-center">
                            <div
                              className="w-3 h-3 rounded-full mx-auto"
                              style={{
                                backgroundColor:
                                  ativo.status === "NORMAL"
                                    ? "#10B981"
                                    : ativo.status === "ALARME"
                                    ? "#F59E0B"
                                    : "#EF4444",
                              }}
                            ></div>
                          </td>
                          <td className="py-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                                tripsCount > 0
                                  ? "bg-red-100 text-red-600"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {tripsCount}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                                alarmesCount > 0
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {alarmesCount}
                            </span>
                          </td>
                          <td className="py-2 text-right text-muted-foreground font-mono text-xs">
                            {updateTime}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela de Cargas Monitoradas */}
          <div className="bg-card border rounded-lg p-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <h3 className="text-sm font-semibold text-foreground">
                CARGAS MONITORADAS
              </h3>
              <span className="text-xs text-muted-foreground ml-auto">
                (5 mais recentes)
              </span>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 text-muted-foreground font-medium text-xs">
                      Nome
                    </th>
                    <th className="text-left py-2 text-muted-foreground font-medium text-xs">
                      Consumo
                    </th>
                    <th className="text-center py-2 text-muted-foreground font-medium text-xs">
                      Status
                    </th>
                    <th className="text-center py-2 text-muted-foreground font-medium text-xs">
                      Trip
                    </th>
                    <th className="text-center py-2 text-muted-foreground font-medium text-xs">
                      Alarme
                    </th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">
                      Update
                    </th>
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  {(() => {
                    const cargas = ativos.filter(
                      (ativo) => ativo.tipo === "CARGA"
                    );
                    if (cargas.length === 0) {
                      return (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-4 text-center text-muted-foreground text-sm"
                          >
                            Nenhuma carga monitorada encontrada
                          </td>
                        </tr>
                      );
                    }
                    return cargas.slice(0, 5).map((ativo, index) => {
                      const percentage = Math.round(
                        ((ativo.potenciaAtual || 0) / ativo.potenciaNominal) *
                          100
                      );
                      const updateTime = new Date(
                        ativo.ultimaAtualizacao
                      ).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const tripsCount = ativo.status === "TRIP" ? 1 : 0;
                      const alarmesCount = ativo.status === "ALARME" ? 1 : 0;

                      return (
                        <tr
                          key={ativo.id}
                          className="border-b border-border/30 hover:bg-muted/30"
                        >
                          <td
                            className="py-2 text-foreground font-medium truncate max-w-[140px] text-sm"
                            title={ativo.nome}
                          >
                            {ativo.nome}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all duration-300"
                                  style={{
                                    width: `${Math.min(percentage, 100)}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">
                                {percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2 text-center">
                            <div
                              className="w-3 h-3 rounded-full mx-auto"
                              style={{
                                backgroundColor:
                                  ativo.status === "NORMAL"
                                    ? "#10B981"
                                    : ativo.status === "ALARME"
                                    ? "#F59E0B"
                                    : "#EF4444",
                              }}
                            ></div>
                          </td>
                          <td className="py-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                                tripsCount > 0
                                  ? "bg-red-100 text-red-600"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {tripsCount}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                                alarmesCount > 0
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {alarmesCount}
                            </span>
                          </td>
                          <td className="py-2 text-right text-muted-foreground font-mono text-xs">
                            {updateTime}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal do Sinóptico */}
      <Dialog open={modalAberto} onOpenChange={fecharModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              {ativoSelecionado?.nome}
            </DialogTitle>
          </DialogHeader>

          {ativoSelecionado && (
            <div className="space-y-4">
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
              {(ativoSelecionado.eficiencia !== undefined ||
                ativoSelecionado.disponibilidade !== undefined) && (
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
                  {ativoSelecionado.disponibilidade !== undefined && (
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
                  {new Date(ativoSelecionado.ultimaAtualizacao).toLocaleString(
                    "pt-BR"
                  )}
                </p>
              </div>

              {/* Botão para Sinóptico Completo */}
              <div className="pt-4 border-t">
                <Button
                  onClick={() => {
                    fecharModal();
                    navigate("/supervisorio/sinoptico");
                  }}
                  className="w-full"
                  size="sm"
                >
                  Ver Sinóptico Completo
                </Button>
              </div>
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
    </Card>
  );
}
