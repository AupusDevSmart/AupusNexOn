import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Zap,
  XCircle,
  AlertCircle,
  Wrench,
  Thermometer,
  Gauge,
  Power,
  RotateCcw,
  Battery,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

// Tipos para os dados dos equipamentos
interface MedidorEnergia {
  ufer: number;
  demanda: number;
  energiaConsumida: number;
  energiaInjetada: number;
  tensao: { l1: number; l2: number; l3: number };
  corrente: { l1: number; l2: number; l3: number };
  fatorPotencia: number;
}

interface Transformador {
  potenciaNominal: number;
  potenciaAtual: number;
  carregamento: number;
  temperatura: number;
  tensaoPrimario: { l1: number; l2: number; l3: number };
  tensaoSecundario: { l1: number; l2: number; l3: number };
  corrente: { l1: number; l2: number; l3: number };
  status: 'normal' | 'alerta' | 'falha';
}

interface InversorSolar {
  potenciaAC: number;
  potenciaCC: number;
  tensaoMPPT1: number;
  tensaoMPPT2: number;
  correnteString1: number;
  correnteString2: number;
  eficiencia: number;
  temperatura: number;
  geracaoHoje: number;
  geracaoTotal: number;
  status: 'produzindo' | 'standby' | 'falha';
}

interface MotorEletrico {
  tensao: { l1: number; l2: number; l3: number };
  corrente: { l1: number; l2: number; l3: number };
  vibracao: number;
  temperatura: number;
  desequilibrioTensao: number;
  rpm: number;
  potencia: number;
  status: 'funcionando' | 'parado' | 'falha';
}

interface BancoCapacitores {
  tensao: number;
  corrente: number;
  potenciaReativa: number;
  status: 'ligado' | 'desligado' | 'falha';
  numeroEstagiOS: number;
  estagiosLigados: number;
}

interface DisjuntorChave {
  status: 'aberto' | 'fechado';
  estadoMola: 'armada' | 'desarmada';
  corrente: number;
  tensao: number;
  numeroOperacoes: number;
  ultimaOperacao: string;
  tipo: 'disjuntor' | 'chave';
}

// Hook personalizado para dados em tempo real
const useDadosTempoReal = (ativoId: string) => {
  const [dados, setDados] = useState({
    statusRede: 'Normal',
    tensoes: { l1: 220, l2: 219, l3: 221 },
    frequencia: 60.02,
    potencia: { l1: 750, l2: 820, l3: 780, total: 2350 },
    corrente: { l1: 125, l2: 130, l3: 128 },
    indicadores: {
      thd: 2.3,
      fatorPotencia: 0.92,
      dt: 1.8,
      alarmes: 0,
      falhas: 1,
      urgencias: 0,
      osAbertas: 3
    },
    faltaEnergia: null as { tempoInicio: string; protocolo: string } | null
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    try {
      setLoading(true);
      
      // Simulação de dados dinâmicos para demonstração
      setDados(prevDados => ({
        ...prevDados,
        tensoes: {
          l1: 220 + Math.random() * 4 - 2,
          l2: 219 + Math.random() * 4 - 2,
          l3: 221 + Math.random() * 4 - 2,
        },
        frequencia: 60 + Math.random() * 0.2 - 0.1,
        potencia: {
          l1: 750 + Math.random() * 100 - 50,
          l2: 820 + Math.random() * 100 - 50,
          l3: 780 + Math.random() * 100 - 50,
          total: 2350 + Math.random() * 200 - 100,
        }
      }));
      
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [ativoId]);

  useEffect(() => {
    fetchDados();
    const interval = setInterval(fetchDados, 3000);
    return () => clearInterval(interval);
  }, [ativoId, fetchDados]);

  return { dados, loading, error, refetch: fetchDados };
};

// Hook para histórico de dados
const useHistoricoDados = (ativoId: string) => {
  const [historico] = useState({
    potencia: [
      { tempo: '09:00', potencia: 750 },
      { tempo: '09:15', potencia: 820 },
      { tempo: '09:30', potencia: 890 },
      { tempo: '09:45', potencia: 945 },
      { tempo: '10:00', potencia: 1020 },
      { tempo: '10:15', potencia: 1150 },
      { tempo: '10:30', potencia: 1280 },
      { tempo: '10:45', potencia: 1420 },
      { tempo: '11:00', potencia: 1580 },
      { tempo: '11:15', potencia: 1650 },
    ],
    tensao: [
      { tempo: '09:00', l1: 220, l2: 218, l3: 221 },
      { tempo: '09:15', l1: 219, l2: 220, l3: 219 },
      { tempo: '09:30', l1: 221, l2: 219, l3: 220 },
      { tempo: '09:45', l1: 220, l2: 221, l3: 218 },
      { tempo: '10:00', l1: 218, l2: 220, l3: 222 },
      { tempo: '10:15', l1: 220, l2: 219, l3: 220 },
      { tempo: '10:30', l1: 221, l2: 220, l3: 219 },
      { tempo: '10:45', l1: 219, l2: 221, l3: 220 },
      { tempo: '11:00', l1: 220, l2: 220, l3: 221 },
      { tempo: '11:15', l1: 221, l2: 219, l3: 220 },
    ]
  });

  return { historico };
};

// MODALS DOS EQUIPAMENTOS

// Modal do Medidor de Energia
const MedidorEnergiaModal = ({ isOpen, onClose, dados }: { isOpen: boolean; onClose: () => void; dados: MedidorEnergia; }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-500" />
          Medidor de Energia
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{dados.ufer.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">UFER (MWh)</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{dados.demanda.toFixed(0)} kW</div>
                <div className="text-sm text-muted-foreground">Demanda Atual</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Energia
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-bold text-red-600">{dados.energiaConsumida.toLocaleString()} kWh</div>
              <div className="text-sm text-red-700">Consumida</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">{dados.energiaInjetada.toLocaleString()} kWh</div>
              <div className="text-sm text-green-700">Injetada</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Medições por Fase</h4>
          <div className="space-y-2">
            {(['l1', 'l2', 'l3'] as const).map((fase) => (
              <div key={fase} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Fase {fase.toUpperCase()}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm">{dados.tensao[fase].toFixed(1)}V</span>
                  <span className="text-sm">{dados.corrente[fase].toFixed(1)}A</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-medium">Fator de Potência</span>
            <div className="text-right">
              <div className="text-xl font-bold text-blue-600">{dados.fatorPotencia}</div>
              <Badge variant={dados.fatorPotencia > 0.92 ? "default" : "destructive"}>
                {dados.fatorPotencia > 0.92 ? "Normal" : "Baixo"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

// Modal do Transformador  
const TransformadorModal = ({ isOpen, onClose, dados }: { isOpen: boolean; onClose: () => void; dados: Transformador; }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Power className="h-5 w-5 text-purple-500" />
          Transformador
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <Badge variant={dados.status === 'normal' ? "default" : "destructive"} className="mb-2">
                  {dados.status.toUpperCase()}
                </Badge>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{dados.carregamento}%</div>
                <Progress value={dados.carregamento} className="mt-2" />
                <div className="text-sm text-muted-foreground mt-1">Carregamento</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Potências
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{dados.potenciaNominal} kVA</div>
              <div className="text-sm text-blue-700">Nominal</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">{dados.potenciaAtual} kVA</div>
              <div className="text-sm text-green-700">Atual</div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

// Componente principal
export default function SinopticoPage() {
  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold">Sinóptico em Desenvolvimento</h1>
        <p className="text-muted-foreground mt-2">Esta página está em construção.</p>
      </div>
    </Layout>
  );
}