import type { A966Reading } from "@/components/equipment/A966/A966.types";
import A966Gateway from "@/components/equipment/A966/A966Gateway";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useMqttWebSocket } from "@/hooks/useMqttWebSocket";
import { useMemo } from "react";

interface A966ModalProps {
  open: boolean;
  onClose: () => void;
  componenteData?: any;
  nomeComponente?: string;
}

export function A966Modal({
  open,
  onClose,
  componenteData,
  nomeComponente,
}: A966ModalProps) {
  // ============================================
  // INTEGRAÇÃO WEBSOCKET MQTT EM TEMPO REAL
  // ============================================
  const topic = componenteData?.tag || 'IMS/a966/state';
  const { data: mqttData, isConnected, error } = useMqttWebSocket(topic);

  // Converter dados MQTT para formato A966Reading
  const dados: A966Reading = useMemo(() => {
    if (!mqttData?.payload?.data) {
      return {
        inputs: {},
        outputs: {},
        systemStatus: {},
        network: {
          connectionType: 'wifi',
        },
        iotStatus: {},
      };
    }

    const d = mqttData.payload.data;

    return {
      inputs: {
        modbus: {
          protocol: 'modbus',
          interface: 'rs485',
          status: d.rede === 0 ? 'disconnected' : 'connected',
          devices: d.rede || 0,
        },
      },
      outputs: {
        mqttWifi: {
          protocol: 'mqtt',
          interface: 'wifi',
          status: isConnected ? 'connected' : 'disconnected',
        },
      },
      systemStatus: {
        uptime: parseInt(mqttData.payload.time || '0'),
        signalStrength: d.wrssi || 0,
        firmwareVersion: d.ver || '---',
        serialNumber: d.nserie || '---',
      },
      network: {
        ipAddress: d.ip || '---',
        ssid: d.ssid || '---',
        macAddress: d.mac || '---',
        connectionType: 'wifi',
      },
      iotStatus: {
        platform: 'MQTT',
        lastSync: new Date(mqttData.timestamp).toLocaleTimeString('pt-BR'),
        dataPoints: 0,
      },
    };
  }, [mqttData, isConnected]);

  const nome = nomeComponente || componenteData?.nome || 'IMS A966';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-500" />
              {nome} - Gateway IoT A-966
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
            <A966Gateway
              id="a966-modal"
              name={nome}
              readings={dados}
              status={isConnected ? "online" : "offline"}
              displayMode="all"
              scale={1.0}
              onConfig={() => console.log("Configurar", nome)}
            />

            <div className="mt-6 text-center space-y-2">
              <Badge variant="outline" className="text-xs">
                Gateway IoT em Tempo Real
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
                <span className="text-xs font-mono text-green-400">📡 MQTT JSON Data</span>
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
