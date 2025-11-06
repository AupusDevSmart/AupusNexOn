import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import equipamentosDadosService, {
  type EquipamentoDadoLatest,
} from '@/services/equipamentos-dados.service';

export function useEquipamentoMqttData(equipamentoId: string | null) {
  const [data, setData] = useState<EquipamentoDadoLatest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const fetchData = useCallback(async () => {
    if (!equipamentoId) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🔄 [useEquipamentoMqttData] Buscando dados para equipamento ${equipamentoId}`);
      const response = await equipamentosDadosService.getLatest(equipamentoId);
      console.log('✅ [useEquipamentoMqttData] Resposta completa:', response);
      console.log('✅ [useEquipamentoMqttData] Dados extraídos:', response.data);
      setData(response.data || response);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('❌ [useEquipamentoMqttData] Erro ao buscar dados:', err);
      setError(err.message || 'Erro ao buscar dados do equipamento');
    } finally {
      setLoading(false);
    }
  }, [equipamentoId]);

  useEffect(() => {
    console.log('🚀 [useEquipamentoMqttData] useEffect EXECUTANDO! equipamentoId:', equipamentoId);
    fetchData();

    // Se não tem equipamentoId, retorna cleanup vazio
    if (!equipamentoId) {
      console.log('⚠️ [useEquipamentoMqttData] Sem equipamentoId, não conectando WebSocket');
      return () => {
        console.log('🧹 [useEquipamentoMqttData] Cleanup (sem conexão)');
      };
    }

    // Conectar ao WebSocket
    // IMPORTANTE: NestJS usa Socket.IO com path padrão `/socket.io` e namespace `/ws/diagramas`
    // Então conectamos ao servidor base e especificamos o namespace na URL
    const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';
    const namespace = '/ws/diagramas';
    const fullUrl = `${WS_URL}${namespace}`;

    console.log('🌐 [WebSocket] Conectando ao servidor:', WS_URL);
    console.log('🌐 [WebSocket] Namespace:', namespace);
    console.log('🌐 [WebSocket] URL completa:', fullUrl);

    const socket = io(fullUrl, {
      path: '/socket.io', // Path padrão do Socket.IO (NestJS usa este)
      transports: ['websocket', 'polling'], // Tentar ambos os transportes
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    console.log('📌 [WebSocket] Socket criado e armazenado em socketRef');

    // Event: tentativa de conexão
    socket.on('connect_error', (error) => {
      console.error('❌ [WebSocket] Erro ao conectar:', error);
      console.error('❌ [WebSocket] Erro tipo:', error.message);
      console.error('❌ [WebSocket] Erro detalhes:', error);
    });

    socket.on('connect', () => {
      console.log('🔌 [WebSocket] Conectado com sucesso!');
      console.log('🔌 [WebSocket] Socket ID:', socket.id);
      console.log('🔌 [WebSocket] Connected:', socket.connected);
      console.log('📤 [WebSocket] Enviando subscribe_equipamento para:', equipamentoId);

      // Se inscrever para receber atualizações deste equipamento
      socket.emit('subscribe_equipamento', { equipamentoId });
      console.log('✅ [WebSocket] subscribe_equipamento enviado');
    });

    socket.on('subscribed', (response: any) => {
      console.log('✅ [WebSocket] Confirmação de inscrição recebida:', response);
    });

    socket.on('equipamento_dados', (event: any) => {
      console.log('📡 [WebSocket] Evento recebido:', event);
      console.log('📡 [WebSocket] EquipamentoId do evento:', event.equipamentoId);
      console.log('📡 [WebSocket] EquipamentoId esperado:', equipamentoId);
      console.log('📡 [WebSocket] Match?', event.equipamentoId === equipamentoId);

      if (event.equipamentoId === equipamentoId) {
        const now = new Date();
        console.log('✅ [WebSocket] Match confirmado! Atualizando dados...');
        console.log('✅ [WebSocket] Timestamp do evento:', event.timestamp);
        console.log('✅ [WebSocket] Hora atual:', now.toISOString());

        // Atualizar apenas o dado, mantendo as informações do equipamento
        setData((prevData) => {
          console.log('🔄 [WebSocket] Dados anteriores:', prevData);
          if (!prevData) {
            console.warn('⚠️ [WebSocket] prevData é null, não atualizando');
            return prevData;
          }

          const novosDados = {
            ...prevData,
            dado: {
              ...prevData.dado,
              dados: event.dados,
              timestamp_dados: event.timestamp,
              qualidade: event.qualidade,
            },
          };
          console.log('✅ [WebSocket] Novos dados:', novosDados);
          return novosDados;
        });

        setLastUpdate(now);
        console.log('✅ [WebSocket] Dados atualizados em tempo real! LastUpdate:', now.toLocaleTimeString());
      } else {
        console.log('⚠️ [WebSocket] ID não corresponde, ignorando evento');
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [WebSocket] Desconectado. Razão:', reason);
    });

    socket.on('error', (err: Error) => {
      console.error('❌ [WebSocket] Erro:', err);
    });

    console.log('✅ [WebSocket] Todos os event listeners configurados');

    // Cleanup function
    return () => {
      console.log('🧹 [useEquipamentoMqttData] Cleanup - desconectando WebSocket');
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe_equipamento', { equipamentoId });
        socketRef.current.disconnect();
        socketRef.current = null;
        console.log('✅ [WebSocket] Desconectado e cleanup completo');
      }
    };
  }, [equipamentoId, fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    refetch: fetchData,
  };
}
