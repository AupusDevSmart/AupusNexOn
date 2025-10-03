import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface MqttMessage {
  id: string;
  topic: string;
  payload: any;
  timestamp: string;
  qos: number;
  retained: boolean;
  receivedAt?: string;
  messageSize?: number;
}

interface UseMqttWebSocketReturn {
  data: MqttMessage | null;
  isConnected: boolean;
  socket: Socket | null;
  error: string | null;
}

/**
 * Hook para conectar ao WebSocket MQTT e receber dados em tempo real
 *
 * @param topic - Tópico MQTT para se inscrever (ex: 'OLI/GO/CHI/CAB/M160-1')
 * @returns Objeto com dados, status de conexão e socket
 *
 * @example
 * const { data, isConnected } = useMqttWebSocket('OLI/GO/CHI/CAB/M160-1');
 *
 * if (!isConnected) return <div>Conectando...</div>;
 * if (!data) return <div>Aguardando dados...</div>;
 *
 * return <div>{JSON.stringify(data.payload)}</div>;
 */
export const useMqttWebSocket = (topic: string): UseMqttWebSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [data, setData] = useState<MqttMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topic) {
      console.warn('⚠️ useMqttWebSocket: topic não fornecido');
      return;
    }

    // TODO: Pegar do env ou config
    const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';

    console.log(`🔌 Conectando ao WebSocket: ${WEBSOCKET_URL}/mqtt`);

    // Conectar ao WebSocket
    const newSocket = io(`${WEBSOCKET_URL}/mqtt`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Evento: Conexão estabelecida
    newSocket.on('connect', () => {
      console.log(`✅ WebSocket conectado (ID: ${newSocket.id})`);
      setIsConnected(true);
      setError(null);

      // Inscrever no tópico
      console.log(`📡 Inscrevendo no tópico: ${topic}`);
      newSocket.emit('subscribe-topic', topic);
    });

    // Evento: Desconexão
    newSocket.on('disconnect', (reason) => {
      console.log(`❌ WebSocket desconectado: ${reason}`);
      setIsConnected(false);
    });

    // Evento: Erro de conexão
    newSocket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão WebSocket:', err.message);
      setError(err.message);
      setIsConnected(false);
    });

    // Evento: Tentativa de reconexão
    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Tentativa de reconexão #${attemptNumber}`);
    });

    // Evento: Reconexão bem-sucedida
    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconectado após ${attemptNumber} tentativa(s)`);
      setIsConnected(true);
      setError(null);
      // Re-inscrever no tópico
      newSocket.emit('subscribe-topic', topic);
    });

    // Evento: Receber mensagens do tópico específico
    newSocket.on('mqtt-message', (message: MqttMessage) => {
      // Filtrar apenas mensagens do tópico inscrito
      if (message.topic === topic) {
        console.log(`📨 Nova mensagem do tópico ${topic}:`, message);
        setData(message);
      } else {
        console.log(`⏭️ Mensagem ignorada (tópico diferente). Esperado: ${topic}, Recebido: ${message.topic}`);
      }
    });

    setSocket(newSocket);

    // Cleanup ao desmontar componente
    return () => {
      console.log(`🔌 Desinscrevendo do tópico: ${topic}`);
      newSocket.emit('unsubscribe-topic', topic);
      newSocket.disconnect();
    };
  }, [topic]);

  return { data, isConnected, socket, error };
};

/**
 * Hook para receber TODAS as mensagens MQTT (broadcast)
 * Útil para monitoramento geral
 */
export const useMqttWebSocketAll = (): UseMqttWebSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [data, setData] = useState<MqttMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';

    const newSocket = io(`${WEBSOCKET_URL}/mqtt`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket conectado (modo broadcast)');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão:', err.message);
      setError(err.message);
    });

    // Receber TODAS as mensagens MQTT
    newSocket.on('mqtt-message-all', (message: MqttMessage) => {
      console.log('📨 Nova mensagem (broadcast):', message);
      setData(message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { data, isConnected, socket, error };
};
