import type { M160Reading } from "@/components/equipment/M160/M160.types";
import M160Multimeter from "@/components/equipment/M160/M160Multimeter";
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

interface M160ModalProps {
  isOpen: boolean;
  onClose: () => void;
  componenteData: any;
}

export function M160Modal({ isOpen, onClose, componenteData }: M160ModalProps) {
  // ============================================
  // INTEGRAÇÃO WEBSOCKET MQTT EM TEMPO REAL
  // ============================================
  // TEMPORÁRIO: Desabilitado para evitar erros de conexão enquanto backend não está configurado
  // const topic = componenteData?.tag || 'OLI/GO/CHI/CAB/M160-1';
  // const { data: mqttData, isConnected, error } = useMqttWebSocket(topic);
  const mqttData = null;
  const isConnected = false;
  const error = 'Backend MQTT não configurado (modo teste)';

  // Converter dados MQTT para formato M160Reading
  const dadosM160: M160Reading = useMemo(() => {
    if (!mqttData?.payload?.Dados) {
      return {
        voltage: { L1: 0, L2: 0, L3: 0, LN: 0 },
        current: { L1: 0, L2: 0, L3: 0, N: 0 },
        power: {
          active: 0,
          reactive: 0,
          apparent: 0,
          import: 0,
          export: 0,
        },
        frequency: 60.0,
        powerFactor: 0,
        thd: { voltage: 0, current: 0 },
        energy: {
          activeImport: 0,
          activeExport: 0,
          reactiveImport: 0,
          reactiveExport: 0,
        },
      };
    }

    const d = mqttData.payload.Dados;

    // Calcular potências totais
    const Pa = d.Pa || 0;
    const Pb = d.Pb || 0;
    const Pc = d.Pc || 0;
    const potenciaAtiva = Pa + Pb + Pc;

    return {
      voltage: {
        L1: d.Va || 0,
        L2: d.Vb || 0,
        L3: d.Vc || 0,
        LN: ((d.Va || 0) + (d.Vb || 0) + (d.Vc || 0)) / 3,
      },
      current: {
        L1: d.Ia || 0,
        L2: d.Ib || 0,
        L3: d.Ic || 0,
        N: 0,
      },
      power: {
        active: potenciaAtiva,
        reactive: d.qhfi || 0,
        apparent: Math.sqrt(Math.pow(potenciaAtiva, 2) + Math.pow(d.qhfi || 0, 2)),
        import: potenciaAtiva >= 0 ? potenciaAtiva : 0,
        export: potenciaAtiva < 0 ? Math.abs(potenciaAtiva) : 0,
      },
      frequency: 60.0,
      powerFactor: d.FPA || 0,
      powerFactorB: d.FPB || 0,
      powerFactorC: d.FPC || 0,
      thd: { voltage: 0, current: 0 },
      energy: {
        activeImport: d.phf || 0,
        activeExport: d.phr || 0,
        reactiveImport: d.qhfi || 0,
        reactiveExport: d.qhri || 0,
      },
    };
  }, [mqttData]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-green-500" />
              {componenteData?.nome || "M160"} - Multimedidor 4Q
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
            <M160Multimeter
              id="m160-modal"
              name={componenteData?.nome || "M160"}
              readings={dadosM160}
              status={isConnected ? "online" : "offline"}
              displayMode="all"
              scale={1.0}
              navigation={{
                enableManualNavigation: true,
                showDisplayLabel: true,
                showPositionIndicator: true,
                allowAutoRotationToggle: false,
              }}
              onConfig={() => console.log("Configurar M160")}
            />

            <div className="mt-6 text-center space-y-2">
              <Badge variant="outline" className="text-xs">
                Display Interativo com Navegação
              </Badge>
              {mqttData && (
                <div className="text-xs text-gray-400 mt-2">
                  Última atualização: {new Date(mqttData.timestamp).toLocaleTimeString('pt-BR')}
                </div>
              )}

              {/* Debug: Mostrar JSON completo */}
              {/* {mqttData && (
                <div className="mt-4 p-3 bg-gray-800 rounded text-left">
                  <div className="font-bold text-white mb-2">📊 JSON MQTT Completo:</div>
                  <pre className="text-xs text-green-400 overflow-auto max-h-64 bg-black p-2 rounded">
                    {JSON.stringify(mqttData, null, 2)}
                  </pre>
                </div>
              )} */}

              {/* Debug: Mostrar valores recebidos */}
              {/* {mqttData?.payload?.Dados && (
                <div className="mt-4 p-3 bg-gray-800 rounded text-left text-xs">
                  <div className="font-bold text-white mb-2">📊 Dados Extraídos:</div>
                  <div className="grid grid-cols-2 gap-2 text-gray-300">
                    <div>Tensões: Va={mqttData.payload.Dados.Va}V, Vb={mqttData.payload.Dados.Vb}V, Vc={mqttData.payload.Dados.Vc}V</div>
                    <div>Correntes: Ia={mqttData.payload.Dados.Ia}A, Ib={mqttData.payload.Dados.Ib}A, Ic={mqttData.payload.Dados.Ic}A</div>
                    <div>Potências: Pa={mqttData.payload.Dados.Pa}W, Pb={mqttData.payload.Dados.Pb}W, Pc={mqttData.payload.Dados.Pc}W</div>
                    <div>Energia: phf={mqttData.payload.Dados.phf}, phr={mqttData.payload.Dados.phr}</div>
                    <div>Reativa: qhfi={mqttData.payload.Dados.qhfi}, qhri={mqttData.payload.Dados.qhri}</div>
                    <div>FP: FPA={mqttData.payload.Dados.FPA}, FPB={mqttData.payload.Dados.FPB}, FPC={mqttData.payload.Dados.FPC}</div>
                  </div>
                </div>
              )} */}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default M160Modal;
