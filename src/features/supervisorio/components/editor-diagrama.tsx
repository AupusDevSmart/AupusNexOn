// src/features/supervisorio/components/editor-diagrama.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  Circle,
  Copy,
  Download,
  Grid3x3,
  Layers,
  Move,
  Redo,
  Save,
  Settings,
  Square,
  Trash2,
  Triangle,
  Undo,
  Upload,
  Zap,
} from "lucide-react";
import React, { useCallback, useRef, useState } from "react";

// Tipos de componentes disponíveis
const COMPONENT_TYPES = [
  { type: "MEDIDOR", icon: Activity, label: "Medidor", color: "bg-blue-500" },
  {
    type: "TRANSFORMADOR",
    icon: Square,
    label: "Transformador",
    color: "bg-green-500",
  },
  { type: "INVERSOR", icon: Zap, label: "Inversor", color: "bg-yellow-500" },
  { type: "DISJUNTOR", icon: Square, label: "Disjuntor", color: "bg-red-500" },
  { type: "MOTOR", icon: Circle, label: "Motor", color: "bg-purple-500" },
  {
    type: "CAPACITOR",
    icon: Triangle,
    label: "Capacitor",
    color: "bg-indigo-500",
  },
];

// Interface para componentes do diagrama
interface DiagramComponent {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  status: "NORMAL" | "ALARME" | "FALHA";
  rotation: number;
  properties: Record<string, any>;
}

// Interface para conexões
interface Connection {
  id: string;
  from: string;
  to: string;
  points: { x: number; y: number }[];
}

export function EditorDiagramaUnifilar() {
  const [components, setComponents] = useState<DiagramComponent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(
    null
  );
  const [dragMode, setDragMode] = useState<"select" | "draw" | "connect">(
    "select"
  );
  const [selectedType, setSelectedType] = useState<string>("MEDIDOR");
  const [isDrawing, setIsDrawing] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Função para adicionar componente
  const addComponent = useCallback(
    (x: number, y: number, type: string) => {
      const newComponent: DiagramComponent = {
        id: `comp_${Date.now()}`,
        type,
        label: `${type} ${components.length + 1}`,
        x,
        y,
        status: "NORMAL",
        rotation: 0,
        properties: {},
      };
      setComponents((prev) => [...prev, newComponent]);
    },
    [components.length]
  );

  // Handler para clique no canvas
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (dragMode === "draw" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      addComponent(x, y, selectedType);
    }
  };

  // Renderizar componente
  const renderComponent = (component: DiagramComponent) => {
    const typeConfig = COMPONENT_TYPES.find((t) => t.type === component.type);
    const IconComponent = typeConfig?.icon || Settings;

    return (
      <div
        key={component.id}
        className={`absolute cursor-pointer transition-all duration-200 ${
          selectedComponent === component.id
            ? "ring-4 ring-blue-400 scale-110"
            : ""
        }`}
        style={{
          left: `${component.x}%`,
          top: `${component.y}%`,
          transform: `translate(-50%, -50%) rotate(${component.rotation}deg)`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedComponent(component.id);
        }}
      >
        <div
          className={`p-3 rounded-lg text-white shadow-lg ${
            typeConfig?.color || "bg-gray-500"
          } ${component.status !== "NORMAL" ? "animate-pulse" : ""}`}
        >
          <IconComponent className="h-6 w-6" />
          {component.status !== "NORMAL" && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white"></div>
          )}
        </div>
        <div className="mt-1 text-xs text-center max-w-16 truncate font-medium">
          {component.label}
        </div>
        <Badge
          className={`text-xs mt-0.5 ${
            component.status === "NORMAL"
              ? "bg-green-100 text-green-800"
              : component.status === "ALARME"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {component.status}
        </Badge>
      </div>
    );
  };

  return (
    <div className="w-full h-screen flex">
      {/* Barra de Ferramentas Lateral */}
      <div className="w-80 bg-muted/30 border-r p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Ferramentas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Modos de Interação */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Modo de Edição:</label>
              <div className="grid grid-cols-3 gap-1">
                <Button
                  size="sm"
                  variant={dragMode === "select" ? "default" : "outline"}
                  onClick={() => setDragMode("select")}
                >
                  <Move className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={dragMode === "draw" ? "default" : "outline"}
                  onClick={() => setDragMode("draw")}
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={dragMode === "connect" ? "default" : "outline"}
                  onClick={() => setDragMode("connect")}
                >
                  <Activity className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Selecionar • Desenhar • Conectar
              </div>
            </div>

            <Separator />

            {/* Biblioteca de Componentes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Componentes Elétricos:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COMPONENT_TYPES.map((type) => (
                  <Button
                    key={type.type}
                    size="sm"
                    variant={selectedType === type.type ? "default" : "outline"}
                    className={`h-auto p-3 flex flex-col items-center gap-1 ${
                      selectedType === type.type
                        ? type.color + " text-white"
                        : ""
                    }`}
                    onClick={() => setSelectedType(type.type)}
                  >
                    <type.icon className="h-4 w-4" />
                    <span className="text-xs">{type.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Propriedades do Componente Selecionado */}
            {selectedComponent && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Propriedades:</label>
                <div className="space-y-2">
                  <Input
                    placeholder="Nome do componente"
                    value={
                      components.find((c) => c.id === selectedComponent)
                        ?.label || ""
                    }
                    onChange={(e) => {
                      setComponents((prev) =>
                        prev.map((c) =>
                          c.id === selectedComponent
                            ? { ...c, label: e.target.value }
                            : c
                        )
                      );
                    }}
                  />
                  <select
                    className="w-full p-2 border rounded"
                    value={
                      components.find((c) => c.id === selectedComponent)
                        ?.status || "NORMAL"
                    }
                    onChange={(e) => {
                      setComponents((prev) =>
                        prev.map((c) =>
                          c.id === selectedComponent
                            ? { ...c, status: e.target.value as any }
                            : c
                        )
                      );
                    }}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="ALARME">Alarme</option>
                    <option value="FALHA">Falha</option>
                  </select>
                </div>
              </div>
            )}

            <Separator />

            {/* Ações */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ações:</label>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline">
                  <Undo className="h-4 w-4 mr-1" />
                  Desfazer
                </Button>
                <Button size="sm" variant="outline">
                  <Redo className="h-4 w-4 mr-1" />
                  Refazer
                </Button>
                <Button size="sm" variant="outline">
                  <Copy className="h-4 w-4 mr-1" />
                  Duplicar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (selectedComponent) {
                      setComponents((prev) =>
                        prev.filter((c) => c.id !== selectedComponent)
                      );
                      setSelectedComponent(null);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controles de Visualização */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Visualização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              size="sm"
              variant={showGrid ? "default" : "outline"}
              onClick={() => setShowGrid(!showGrid)}
              className="w-full"
            >
              <Grid3x3 className="h-4 w-4 mr-2" />
              {showGrid ? "Ocultar Grade" : "Mostrar Grade"}
            </Button>
            <Button size="sm" variant="outline" className="w-full">
              <Layers className="h-4 w-4 mr-2" />
              Camadas
            </Button>
          </CardContent>
        </Card>

        {/* Salvar/Carregar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button size="sm" className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Salvar Diagrama
            </Button>
            <Button size="sm" variant="outline" className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Carregar Diagrama
            </Button>
            <Button size="sm" variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Exportar PNG/SVG
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Área Principal de Desenho */}
      <div className="flex-1 flex flex-col">
        {/* Barra de Ferramentas Superior */}
        <div className="h-16 bg-background border-b px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">
              Editor de Diagrama Unifilar
            </h2>
            <Badge variant="outline">{components.length} componentes</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Modo:{" "}
              {dragMode === "select"
                ? "Selecionar"
                : dragMode === "draw"
                ? "Desenhar"
                : "Conectar"}
            </span>
            <Button size="sm" variant="outline">
              Pré-visualizar
            </Button>
          </div>
        </div>

        {/* Canvas de Desenho */}
        <div className="flex-1 relative overflow-hidden bg-muted/10">
          <div
            ref={canvasRef}
            className="w-full h-full relative cursor-crosshair"
            onClick={handleCanvasClick}
            style={{
              backgroundImage: showGrid
                ? "radial-gradient(circle, #ccc 1px, transparent 1px)"
                : "none",
              backgroundSize: showGrid ? "20px 20px" : "none",
            }}
          >
            {/* Grid de fundo */}
            {showGrid && (
              <div className="absolute inset-0 opacity-20">
                <svg className="w-full h-full">
                  <defs>
                    <pattern
                      id="grid"
                      width="20"
                      height="20"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="#ccc"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
            )}

            {/* Linhas de Conexão */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {connections.map((connection) => (
                <path
                  key={connection.id}
                  d={`M ${connection.points
                    .map((p) => `${p.x},${p.y}`)
                    .join(" L ")}`}
                  stroke="#666"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
              ))}
            </svg>

            {/* Componentes do Diagrama */}
            {components.map(renderComponent)}

            {/* Indicador de modo de desenho */}
            {dragMode === "draw" && (
              <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded text-sm">
                Clique para adicionar{" "}
                {COMPONENT_TYPES.find((t) => t.type === selectedType)?.label}
              </div>
            )}
          </div>
        </div>

        {/* Barra de Status */}
        <div className="h-8 bg-muted/30 border-t px-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span>Zoom: 100%</span>
            <span>
              Posição:{" "}
              {selectedComponent
                ? `${Math.round(
                    components.find((c) => c.id === selectedComponent)?.x || 0
                  )}%, ${Math.round(
                    components.find((c) => c.id === selectedComponent)?.y || 0
                  )}%`
                : "0%, 0%"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Conectado</span>
            </div>
            <span>Salvo automaticamente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
