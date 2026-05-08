import { useState, useEffect, useCallback, useRef } from 'react';
import { env } from '@/config/env';
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

    // Limpar espaços em branco do ID e remover prefixo "eq-" duplicado se existir
    let cleanId = equipamentoId.trim();
    // Se o ID começa com "eq-eq-", remover o primeiro "eq-"
    if (cleanId.startsWith('eq-eq-')) {
      cleanId = cleanId.substring(3);
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🔄 [useEquipamentoMqttData] Buscando dados para equipamento ${cleanId}`);
      const response = await equipamentosDadosService.getLatest(cleanId);
      console.log('✅ [useEquipamentoMqttData] Resposta completa:', response);
      console.log('✅ [useEquipamentoMqttData] Dados extraídos:', (response as any).data);
      const responseData = (response as any).data || response;
      setData(responseData);
      const timestampDados = responseData?.dado?.timestamp_dados;
      setLastUpdate(timestampDados ? new Date(timestampDados) : null);
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

    // Limpar espaços em branco do ID e remover prefixo "eq-" duplicado se existir
    let cleanId = equipamentoId.trim();
    // Se o ID começa com "eq-eq-", remover o primeiro "eq-"
    if (cleanId.startsWith('eq-eq-')) {
      cleanId = cleanId.substring(3);
    }

    // Conectar ao WebSocket
    // IMPORTANTE: NestJS usa Socket.IO com path padrão `/socket.io` e namespace `/ws/diagramas`
    // Então conectamos ao servidor base e especificamos o namespace na URL
    const WS_URL = env.VITE_WEBSOCKET_URL;
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
      console.log('📤 [WebSocket] Enviando subscribe_equipamento para:', cleanId);

      // Se inscrever para receber atualizações deste equipamento
      socket.emit('subscribe_equipamento', { equipamentoId: cleanId });
      console.log('✅ [WebSocket] subscribe_equipamento enviado');
    });

    socket.on('subscribed', (response: any) => {
      console.log('✅ [WebSocket] Confirmação de inscrição recebida:', response);
    });

    socket.on('equipamento_dados', (event: any) => {
      console.log('📡 [WebSocket] Evento recebido:', event);
      console.log('📡 [WebSocket] EquipamentoId do evento:', event.equipamentoId);
      console.log('📡 [WebSocket] EquipamentoId esperado:', cleanId);
      console.log('📡 [WebSocket] Match?', event.equipamentoId === cleanId);

      if (event.equipamentoId === cleanId) {
        const timestampEvento = event.timestamp ? new Date(event.timestamp) : null;
        console.log('✅ [WebSocket] Match confirmado! Atualizando dados...');
        console.log('✅ [WebSocket] Timestamp do evento:', event.timestamp);
        console.log('✅ [WebSocket] Timestamp convertido:', timestampEvento?.toISOString() ?? null);

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

        setLastUpdate(timestampEvento);
        console.log('✅ [WebSocket] Dados atualizados em tempo real! LastUpdate:', timestampEvento?.toLocaleTimeString() ?? null);
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
        socketRef.current.emit('unsubscribe_equipamento', { equipamentoId: cleanId });
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
