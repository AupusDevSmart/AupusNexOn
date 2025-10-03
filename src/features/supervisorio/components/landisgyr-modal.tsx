import type { LandisGyrE750Reading } from "@/components/equipment/LandisGyr/LandisGyr.types";
import LandisGyrE750 from "@/components/equipment/LandisGyr/LandisGyrE750";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gauge, WifiOff, Loader2 } from "lucide-react";
import { useMqttWebSocket } from "@/hooks/useMqttWebSocket";
import { useMemo } from "react";

interface LandisGyrModalProps {
  open: boolean;
  onClose: () => void;
  componenteData?: any;
  nomeComponente?: string;
}

export function LandisGyrModal({
  open,
  onClose,
  componenteData,
  nomeComponente,
}: LandisGyrModalProps) {
  // ============================================
  // INTEGRAÇÃO WEBSOCKET MQTT EM TEMPO REAL
  // ============================================
  const topic = componenteData?.tag || 'IMS/a966/LANDIS/state';
  const { data: mqttData, isConnected, error } = useMqttWebSocket(topic);

  // Converter dados MQTT para formato LandisGyrE750Reading
  const dados: LandisGyrE750Reading = useMemo(() => {
    if (!mqttData?.payload?.data) {
      return {
        voltage: { L1: 0, L2: 0, L3: 0 },
        current: { L1: 0, L2: 0, L3: 0 },
        energy: {
          activeImport: 0,
          activeExport: 0,
          reactiveQ1: 0,
          reactiveQ2: 0,
          reactiveQ3: 0,
          reactiveQ4: 0,
        },
        power: {
          active: 0,
          reactive: 0,
          apparent: 0,
        },
        system: {
          cdo: '---',
          sts: 0,
          frame: '---',
        },
      };
    }

    const d = mqttData.payload.data;

    return {
      voltage: { L1: 0, L2: 0, L3: 0 },
      current: { L1: 0, L2: 0, L3: 0 },
      energy: {
        activeImport: d.phf || 0,
        activeExport: d.phr || 0,
        reactiveQ1: d.qhfi || 0,
        reactiveQ2: d.qhri || 0,
        reactiveQ3: d.qhfc || 0,
        reactiveQ4: d.qhrc || 0,
      },
      power: {
        active: 0,
        reactive: d.qhfi || 0,
        apparent: 0,
      },
      system: {
        cdo: d.cdo || '---',
        sts: d.sts || 0,
        frame: d.frame || '---',
        uptime: parseInt(mqttData.payload.time || '0'),
      },
    };
  }, [mqttData]);

  const nome = nomeComponente || componenteData?.nome || 'Landis Gyr';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-purple-500" />
              {nome} - Medidor Landis+Gyr E750
            </div>
            {/* Indicador de Status de Conexão */}
            {isConnected ? (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/50">
                🟢 Tempo Real
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/50">
                {error ? <WifiOff className="h-3 w-3 mr-1" /> : <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {error ? 'Desconectado' : 'Conectando...'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Mostrar erro se houver */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-md p-3 mb-4">
            <p className="text-sm text-red-500">⚠️ Erro de conexão: {error}</p>
            <p className="text-xs text-red-400 mt-1">Verifique se o backend está rodando em http://localhost:3000</p>
          </div>
        )}

        <div className="flex justify-center items-center py-6">
          <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
            <LandisGyrE750
              id="landisgyr-modal"
              name={nome}
              readings={dados}
              status={isConnected ? "online" : "offline"}
              displayMode="all"
              scale={1.5}
              navigation={{
                enableManualNavigation: true,
                showDisplayLabel: true,
                showPositionIndicator: true,
                allowAutoRotationToggle: false,
              }}
              onConfig={() => console.log("Configurar", nome)}
            />

            <div className="mt-6 text-center space-y-2">
              <Badge variant="outline" className="text-xs">
                Medidor Inteligente em Tempo Real
              </Badge>
              {mqttData && (
                <div className="text-xs text-gray-400 mt-2">
                  Última atualização: {new Date(mqttData.timestamp).toLocaleTimeString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* JSON RAW DATA */}
        {/* {mqttData && (
          <div className="mt-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-purple-400">📡 MQTT JSON Data</span>
                <Badge variant="outline" className="text-xs">
                  Tópico: {topic}
                </Badge>
              </div>
              <pre className="text-xs font-mono text-gray-300 overflow-auto max-h-64 bg-black p-3 rounded border border-gray-800">
                {JSON.stringify(mqttData, null, 2)}
              </pre>
            </div>
          </div>
        )} */}
      </DialogContent>
    </Dialog>
  );
}
