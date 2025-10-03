import { useState, useEffect } from 'react';

interface MqttLog {
  timestamp: string;
  topic: string;
  payload: any;
  qos: number;
  retained: boolean;
}

export default function MqttLogsPage() {
  const [logs, setLogs] = useState<MqttLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const response = await fetch('http://localhost:3000/mqtt/logs?limit=100');
      const data = await response.json();
      setLogs(data.logs.reverse()); // Mais recentes primeiro
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 2000); // Atualiza a cada 2 segundos
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        Carregando logs...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#1e1e1e', color: '#d4d4d4', minHeight: '100vh' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#4ec9b0' }}>📨 MQTT Logs</h1>
        <div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '8px 16px',
              marginRight: '10px',
              backgroundColor: autoRefresh ? '#4ec9b0' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {autoRefresh ? '⏸️ Pausar' : '▶️ Auto Refresh'}
          </button>
          <button
            onClick={fetchLogs}
            style={{
              padding: '8px 16px',
              backgroundColor: '#569cd6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🔄 Atualizar
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '10px', color: '#858585' }}>
        Total: {logs.length} mensagens
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#858585' }}>
            Nenhum log encontrado
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                backgroundColor: '#2d2d30',
                border: '1px solid #3e3e42',
                borderRadius: '6px',
                padding: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#4ec9b0', fontWeight: 'bold' }}>
                  {log.topic}
                </span>
                <span style={{ color: '#858585', fontSize: '12px' }}>
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </span>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <pre style={{
                  margin: 0,
                  padding: '8px',
                  backgroundColor: '#1e1e1e',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '13px',
                  color: '#ce9178',
                }}>
                  {typeof log.payload === 'object'
                    ? JSON.stringify(log.payload, null, 2)
                    : log.payload}
                </pre>
              </div>

              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#858585' }}>
                <span>QoS: {log.qos}</span>
                <span>Retained: {log.retained ? 'Sim' : 'Não'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
