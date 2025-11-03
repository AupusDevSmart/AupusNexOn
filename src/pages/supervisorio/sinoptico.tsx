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
  Zap,
  XCircle,
  AlertCircle,
  Wrench,
  Gauge,
  Power,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ConexoesDiagrama } from "@/features/supervisorio/components/conexoes-diagrama";

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
  const { id } = useParams<{ id: string }>();
  const ativoId = id || 'ativo-1';
  const navigate = useNavigate();
  
  const { dados, loading } = useDadosTempoReal(ativoId);
  const { historico } = useHistoricoDados(ativoId);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Modais dos equipamentos
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [dadosEquipamento, setDadosEquipamento] = useState<any>(null);

  // ========== DADOS DO DIAGRAMA ==========
  const [componentes] = useState([
    { id: 'rede', tipo: 'MEDIDOR', nome: 'REDE', posicao: { x: 12.5, y: 20 }, status: 'NORMAL', dados: {} },
    { id: 'medidor', tipo: 'MEDIDOR', nome: 'M-300', posicao: { x: 31.25, y: 20 }, status: 'NORMAL', dados: {} },
    { id: 'transformador', tipo: 'TRANSFORMADOR', nome: 'TRANSF', posicao: { x: 50, y: 20 }, status: 'NORMAL', dados: {} },
    { id: 'inversor', tipo: 'INVERSOR', nome: 'INV', posicao: { x: 68.75, y: 20 }, status: 'NORMAL', dados: {} },
    { id: 'carga', tipo: 'MOTOR', nome: 'CARGA', posicao: { x: 87.5, y: 20 }, status: 'NORMAL', dados: {} },
  ]);

  const [connections] = useState([
    { id: 'conn1', from: 'rede', to: 'medidor', fromPort: 'right' as const, toPort: 'left' as const },
    { id: 'conn2', from: 'medidor', to: 'transformador', fromPort: 'right' as const, toPort: 'left' as const },
    { id: 'conn3', from: 'transformador', to: 'inversor', fromPort: 'right' as const, toPort: 'left' as const },
    { id: 'conn4', from: 'inversor', to: 'carga', fromPort: 'right' as const, toPort: 'left' as const },
  ]);

  // Monitorar mudanças de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!diagramRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await diagramRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Erro ao alternar fullscreen:', err);
    }
  };

  // Handlers para abrir modais dos equipamentos
  const abrirModalMedidor = () => {
    setDadosEquipamento({
      ufer: 145.8,
      demanda: 2350,
      energiaConsumida: 12500,
      energiaInjetada: 8750,
      tensao: { l1: dados.tensoes.l1, l2: dados.tensoes.l2, l3: dados.tensoes.l3 },
      corrente: { l1: dados.corrente.l1, l2: dados.corrente.l2, l3: dados.corrente.l3 },
      fatorPotencia: dados.indicadores.fatorPotencia
    });
    setModalAberto('medidor');
  };

  const abrirModalTransformador = () => {
    setDadosEquipamento({
      potenciaNominal: 3000,
      potenciaAtual: dados.potencia.total,
      carregamento: Math.round((dados.potencia.total / 3000) * 100),
      temperatura: 65,
      tensaoPrimario: { l1: 13800, l2: 13800, l3: 13800 },
      tensaoSecundario: dados.tensoes,
      corrente: dados.corrente,
      status: 'normal'
    });
    setModalAberto('transformador');
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/supervisorio/coa')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para COA
            </Button>
            <TitleCard 
              title="Sinóptico do Ativo" 
              description={`Monitoramento em tempo real - Ativo #${ativoId}`}
            />
          </div>
          
          {/* Status da Rede */}
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${dados.faltaEnergia ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-sm font-medium">
                {dados.faltaEnergia ? `Falta de Energia - ${dados.faltaEnergia.protocolo}` : 'Rede Normal'}
              </span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráficos à esquerda */}
          <div className="lg:col-span-1 space-y-6">
            {/* Gráfico Potência x Tempo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Potência x Tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={historico.potencia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tempo" style={{ fontSize: '10px' }} />
                    <YAxis style={{ fontSize: '10px' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="potencia" stroke="#3b82f6" strokeWidth={2} name="Potência (kW)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Gráfico Tensão x Tempo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tensão x Tempo (PRODIST)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={historico.tensao}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tempo" style={{ fontSize: '10px' }} />
                    <YAxis domain={[200, 240]} style={{ fontSize: '10px' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <ReferenceLine y={231} stroke="red" strokeDasharray="3 3" label="Máx" />
                    <ReferenceLine y={201} stroke="red" strokeDasharray="3 3" label="Mín" />
                    <Line type="monotone" dataKey="l1" stroke="#ef4444" strokeWidth={2} name="L1" />
                    <Line type="monotone" dataKey="l2" stroke="#f59e0b" strokeWidth={2} name="L2" />
                    <Line type="monotone" dataKey="l3" stroke="#10b981" strokeWidth={2} name="L3" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Diagrama Unifilar à direita */}
          <div className="lg:col-span-2">
            <Card className="p-4 relative" ref={diagramRef}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Diagrama Unifilar</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <><Minimize2 className="h-4 w-4 mr-2" /> Sair</>
                  ) : (
                    <><Maximize2 className="h-4 w-4 mr-2" /> Tela Cheia</>
                  )}
                </Button>
              </div>

              {/* Container do Diagrama com Linhas */}
              <div 
                ref={containerRef}
                className="relative w-full h-[500px] bg-muted/30 rounded-lg overflow-hidden"
              >
                {/* COMPONENTE DE LINHAS - AGORA VAI FUNCIONAR NO FULLSCREEN! */}
                <ConexoesDiagrama
                  connections={connections}
                  componentes={componentes}
                  containerRef={containerRef}
                  modoEdicao={false}
                  className="diagram-svg"
                />

                {/* Componentes Clicáveis */}
                <div className="absolute inset-0 pointer-events-none z-30">
                  {componentes.map((comp) => (
                    <div
                      key={comp.id}
                      className="absolute pointer-events-auto"
                      style={{
                        left: `${comp.posicao.x}%`,
                        top: `${comp.posicao.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div
                        onClick={() => {
                          if (comp.id === 'medidor') abrirModalMedidor();
                          if (comp.id === 'transformador') abrirModalTransformador();
                        }}
                        className={`${comp.id === 'medidor' || comp.id === 'transformador' ? 'cursor-pointer' : ''}`}
                      >
                        <Card className="p-3 hover:shadow-lg transition-shadow min-w-[60px]">
                          <div className="text-xs font-semibold text-center whitespace-nowrap">
                            {comp.nome}
                          </div>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Rodapé com indicadores */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mt-6">
          {[
            { label: 'THD', value: `${dados.indicadores.thd}%`, icon: Activity, color: 'text-green-600' },
            { label: 'FP', value: dados.indicadores.fatorPotencia, icon: TrendingUp, color: 'text-green-600' },
            { label: 'DT', value: `${dados.indicadores.dt}%`, icon: Gauge, color: 'text-yellow-600' },
            { label: 'Freq', value: `${dados.frequencia.toFixed(2)}Hz`, icon: RotateCcw, color: 'text-green-600' },
            { label: 'Alarmes', value: dados.indicadores.alarmes, icon: AlertTriangle, color: 'text-yellow-600' },
            { label: 'Falhas', value: dados.indicadores.falhas, icon: XCircle, color: 'text-red-600' },
            { label: 'Urgências', value: dados.indicadores.urgencias, icon: AlertCircle, color: 'text-red-600' },
            { label: 'OS', value: dados.indicadores.osAbertas, icon: Wrench, color: 'text-blue-600' },
          ].map((indicator) => (
            <Card key={indicator.label} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <indicator.icon className={`h-4 w-4 ${indicator.color}`} />
                <span className="text-xs text-muted-foreground">{indicator.label}</span>
              </div>
              <div className={`text-lg font-bold ${indicator.color}`}>
                {indicator.value}
              </div>
            </Card>
          ))}
        </div>

        {/* Modais dos Equipamentos */}
        {modalAberto === 'medidor' && dadosEquipamento && (
          <MedidorEnergiaModal 
            isOpen={true} 
            onClose={() => setModalAberto(null)} 
            dados={dadosEquipamento} 
          />
        )}
        
        {modalAberto === 'transformador' && dadosEquipamento && (
          <TransformadorModal 
            isOpen={true} 
            onClose={() => setModalAberto(null)} 
            dados={dadosEquipamento} 
          />
        )}
      </Layout.Main>
    </Layout>
  );
}