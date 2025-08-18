// src/features/usinas/components/detalhe-usina.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Zap, MapPin, Activity, Clock } from 'lucide-react';

interface Usina {
  id: number;
  nome: string;
  lat: number;
  lng: number;
  status: 'operacao' | 'alerta' | 'falha';
  potencia: number;
}

interface DetalheUsinaProps {
  usina: Usina;
  onClose: () => void;
}

export function DetalheUsina({ usina, onClose }: DetalheUsinaProps) {
  const getStatusInfo = (status: Usina['status']) => {
    switch (status) {
      case 'operacao':
        return {
          label: 'Em Operação',
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
        };
      case 'alerta':
        return {
          label: 'Em Alerta',
          variant: 'outline' as const,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
        };
      case 'falha':
        return {
          label: 'Com Falha',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        };
      default:
        return {
          label: 'Desconhecido',
          variant: 'outline' as const,
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
    proximaManutencao: '15/06/2025'
  };

  return (
    <Card className="p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Detalhes da Usina
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Nome e Status */}
      <div className="mb-6">
        <h4 className="font-semibold text-foreground mb-2">
          {usina.nome}
        </h4>
        <Badge variant="outline" className={statusInfo.className}>
          <Activity className="h-3 w-3 mr-1" />
          {statusInfo.label}
        </Badge>
      </div>
      
      {/* Informações Principais */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Potência</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {usina.potencia} kW
            </div>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Eficiência</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {detalhes.eficiencia}%
            </div>
          </div>
        </div>
        
        {/* Métricas Detalhadas */}
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Tensão Atual</span>
            <span className="text-sm font-medium text-foreground">{detalhes.tensaoAtual}V</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Corrente</span>
            <span className="text-sm font-medium text-foreground">{detalhes.corrente}A</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Temp. Inversor</span>
            <span className="text-sm font-medium text-foreground">{detalhes.temperaturaInversor}°C</span>
          </div>
        </div>
        
        {/* Localização */}
        <div className="bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-foreground">Localização</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Lat: {usina.lat.toFixed(2)}°, Lng: {usina.lng.toFixed(2)}°
          </div>
        </div>
        
        {/* Manutenção */}
        <div className="bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-foreground">Manutenção</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Última:</span>
              <span className="text-foreground">{detalhes.ultimaManutencao}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Próxima:</span>
              <span className="text-foreground">{detalhes.proximaManutencao}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Ações */}
      <div className="mt-6 space-y-2">
        <Button 
          className="w-full" 
          size="sm"
          disabled={usina.status === 'falha'}
        >
          Controlar Usina
        </Button>
        <Button 
          variant="outline" 
          className="w-full" 
          size="sm"
        >
          Ver Histórico
        </Button>
      </div>
    </Card>
  );
}