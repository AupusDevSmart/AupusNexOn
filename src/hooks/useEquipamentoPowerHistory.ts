import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import equipamentosDadosService from '@/services/equipamentos-dados.service';

interface PowerDataPoint {
  timestamp: string;
  dados: {
    power?: {
      active_total?: number;
    };
  };
}

const MAX_DATA_POINTS = 288; // 24 hours * 12 points per hour (5 min intervals)

export function useEquipamentoPowerHistory(equipamentoId: string | null) {
  const [data, setData] = useState<PowerDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const fetchHistoricalData = useCallback(async () => {
    if (!equipamentoId) {
      setData([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Buscar dados das últimas 24 horas
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      console.log(`📊 [useEquipamentoPowerHistory] Buscando histórico para equipamento ${equipamentoId}`);

      // Calcular parâmetros de data
      const params = new URLSearchParams({
        inicio: startDate.toISOString(),
        fim: endDate.toISOString(),
        limite: MAX_DATA_POINTS.toString(),
      });

      console.log('📊 Parâmetros da requisição:', params.toString());

      const response = await equipamentosDadosService.getHistory(equipamentoId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: MAX_DATA_POINTS,
      });

      console.log('✅ [useEquipamentoPowerHistory] Resposta recebida:', response);
      console.log('✅ [useEquipamentoPowerHistory] Tipo da resposta:', typeof response);
      console.log('✅ [useEquipamentoPowerHistory] Keys da resposta:', Object.keys(response));

      // A resposta pode vir com wrapper { success: true, data: { data: [...], pagination: {...} } }
      // ou diretamente { data: [...], pagination: {...} }
      let historicalData;
      if (response.success && response.data?.data) {
        // Resposta com wrapper global
        historicalData = response.data.data;
      } else if (response.data && Array.isArray(response.data)) {
        // Resposta direta com data array
        historicalData = response.data;
      } else if (Array.isArray(response)) {
        // Resposta é array direto
        historicalData = response;
      } else {
        console.error('❌ [useEquipamentoPowerHistory] Formato de resposta inesperado:', response);
        historicalData = [];
      }

      console.log('✅ [useEquipamentoPowerHistory] Dados históricos recebidos:', historicalData.length);

      setData(
        historicalData.map((item: any) => ({
          timestamp: item.timestamp_dados,
          dados: item.dados,
        }))
      );
    } catch (err: any) {
      console.error('❌ [useEquipamentoPowerHistory] Erro ao buscar histórico:', err);
      setError(err.message || 'Erro ao buscar dados históricos');
    } finally {
      setLoading(false);
    }
  }, [equipamentoId]);

  useEffect(() => {
    fetchHistoricalData();

    if (!equipamentoId) return;

    // Conectar ao WebSocket para receber atualizações em tempo real
    const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';
    const socket = io(`${WS_URL}/ws/diagramas`, {
      path: '/socket.io', // Path padrão do Socket.IO (NestJS usa este)
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 [PowerHistory WebSocket] Conectado');
      socket.emit('subscribe_equipamento', { equipamentoId });
    });

    socket.on('equipamento_dados', (event: any) => {
      console.log('📡 [PowerHistory WebSocket] Novo dado recebido:', event);

      if (event.equipamentoId === equipamentoId) {
        // Adicionar novo ponto ao gráfico
        setData((prevData) => {
          const newPoint: PowerDataPoint = {
            timestamp: event.timestamp,
            dados: event.dados,
          };

          // Manter apenas os últimos MAX_DATA_POINTS pontos (24 horas)
          const updatedData = [...prevData, newPoint];

          // Remover pontos mais antigos que 24 horas
          const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const filteredData = updatedData.filter(
            (point) => new Date(point.timestamp) > cutoffTime
          );

          // Limitar ao número máximo de pontos
          if (filteredData.length > MAX_DATA_POINTS) {
            return filteredData.slice(filteredData.length - MAX_DATA_POINTS);
          }

          return filteredData;
        });
        console.log('✅ [PowerHistory WebSocket] Gráfico atualizado em tempo real!');
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 [PowerHistory WebSocket] Desconectado');
    });

    socket.on('error', (err: Error) => {
      console.error('❌ [PowerHistory WebSocket] Erro:', err);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe_equipamento', { equipamentoId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [equipamentoId, fetchHistoricalData]);

  return {
    data,
    loading,
    error,
    refetch: fetchHistoricalData,
  };
}
