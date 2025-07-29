// src/features/usinas/components/modal-detalhes-usina.tsx
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Zap, MapPin, Activity, Clock, Thermometer, Gauge, TrendingUp, Settings } from 'lucide-react';

interface Usina {
  id: number;
  nome: string;
  lat: number;
  lng: number;
  status: 'operacao' | 'alerta' | 'falha';
  potencia: number;
}

interface ModalDetalhesUsinaProps {
  usina: Usina | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalDetalhesUsina({ usina, isOpen, onClose }: ModalDetalhesUsinaProps) {
  // Fechar modal com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden'; // Prevenir scroll
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!usina) return null;

  const getStatusInfo = (status: Usina['status']) => {
    switch (status) {
      case 'operacao':
        return {
          label: 'Em Operação',
          className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
        };
      case 'alerta':
        return {
          label: 'Em Alerta',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
        };
      case 'falha':
        return {
          label: 'Com Falha',
          className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        };
      default:
        return {
          label: 'Desconhecido',
          className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800'
        };
    }
  };

  const statusInfo = getStatusInfo(usina.status);

  // Dados simulados específicos da usina
  const detalhes = {
    tensaoAtual: 220 + Math.floor(Math.random() * 20),
    corrente: Math.floor(usina.potencia / 220 * 10) / 10,
    eficiencia: 85 + Math.floor(Math.random() * 10),
    temperaturaInversor: 45 + Math.floor(Math.random() * 15),
    ultimaManutencao: '15/03/2025',
    proximaManutencao: '15/06/2025',
    horasOperacao: Math.floor(Math.random() * 8760),
    energiaGerada: Math.floor(usina.potencia * 24 * 30 * 0.8), // kWh no mês
    alarmes: Math.floor(Math.random() * 5)
  };

  return (
    <>
      {/* Overlay semi-transparente */}
      <div 
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Modal no lado direito sobre tudo */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-96 lg:w-[500px] bg-background border-l border-border z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Detalhes da Usina
              </h2>
              <p className="text-sm text-muted-foreground">
                Informações em tempo real
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-background"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Nome e Status */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {usina.nome}
              </h3>
              <Badge variant="outline" className={statusInfo.className}>
                <Activity className="h-3 w-3 mr-2" />
                {statusInfo.label}
              </Badge>
            </div>
            
            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Potência</span>
                </div>
                <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                  {usina.potencia}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">kW</div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Eficiência</span>
                </div>
                <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                  {detalhes.eficiencia}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">%</div>
              </div>
            </div>
            
            {/* Métricas Detalhadas */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-foreground">Métricas Operacionais</h4>
              
              <div className="grid grid-cols-1 gap-3">
                <div className="flex justify-between items-center py-3 px-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-foreground">Tensão Atual</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{detalhes.tensaoAtual}V</span>
                </div>
                
                <div className="flex justify-between items-center py-3 px-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-foreground">Corrente</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{detalhes.corrente}A</span>
                </div>
                
                <div className="flex justify-between items-center py-3 px-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-foreground">Temp. Inversor</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{detalhes.temperaturaInversor}°C</span>
                </div>
                
                <div className="flex justify-between items-center py-3 px-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium text-foreground">Energia Gerada (mês)</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{detalhes.energiaGerada.toLocaleString()} kWh</span>
                </div>
              </div>
            </div>
            
            {/* Informações Adicionais */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-foreground">Informações Adicionais</h4>
              
              {/* Localização */}
              <div className="bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-foreground">Localização</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Lat: {usina.lat.toFixed(4)}°, Lng: {usina.lng.toFixed(4)}°
                </div>
              </div>
              
              {/* Estatísticas */}
              <div className="bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-foreground">Estatísticas</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Horas de Operação:</span>
                    <span className="text-foreground font-medium">{detalhes.horasOperacao.toLocaleString()}h</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Alarmes Ativos:</span>
                    <span className="text-foreground font-medium">{detalhes.alarmes}</span>
                  </div>
                </div>
              </div>
              
              {/* Manutenção */}
              <div className="bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-foreground">Manutenção</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Última:</span>
                    <span className="text-foreground font-medium">{detalhes.ultimaManutencao}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Próxima:</span>
                    <span className="text-foreground font-medium">{detalhes.proximaManutencao}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer com Ações */}
          <div className="p-6 border-t border-border bg-muted/30">
            <div className="space-y-3">
              <Button 
                className="w-full" 
                disabled={usina.status === 'falha'}
              >
                <Settings className="h-4 w-4 mr-2" />
                Controlar Usina
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">
                  Ver Histórico
                </Button>
                <Button variant="outline" size="sm">
                  Relatório
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}