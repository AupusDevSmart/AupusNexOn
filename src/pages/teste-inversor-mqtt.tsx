import { useState } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InversorMqttDataModal } from '@/features/equipamentos/components/InversorMqttDataModal';
import { Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TesteInversorMQTT() {
  const [inversorModalOpen, setInversorModalOpen] = useState(false);
  const [equipamentoId, setEquipamentoId] = useState('');
  const [showInstructions, setShowInstructions] = useState(true);

  const handleTestar = () => {
    if (equipamentoId.trim()) {
      setInversorModalOpen(true);
      setShowInstructions(false);
    } else {
      alert('Por favor, digite um ID de equipamento!');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTestar();
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <TitleCard
          title="Teste - Modal de Inversor MQTT"
          subtitle="Visualize dados em tempo real de inversores conectados via MQTT"
          icon={<Zap className="h-6 w-6 text-yellow-500" />}
        />

        {/* Alerta de Status */}
        <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            <strong>Backend Online:</strong> API de equipamentos-dados funcionando em http://localhost:3000/api/v1/equipamentos-dados
          </AlertDescription>
        </Alert>

        {/* Formulário de Teste */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                ID do Equipamento Inversor:
              </label>
              <div className="flex gap-2">
                <Input
                  value={equipamentoId}
                  onChange={(e) => setEquipamentoId(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ex: cmxxx... (Cole o ID do inversor aqui)"
                  className="flex-1 font-mono"
                />
                <Button onClick={handleTestar} className="shrink-0">
                  <Zap className="h-4 w-4 mr-2" />
                  Visualizar Dados
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Cole o ID de um equipamento inversor que tenha MQTT habilitado e dados salvos
              </p>
            </div>
          </div>
        </Card>

        {/* Instruções Passo a Passo */}
        {showInstructions && (
          <>
            <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      📋 Como preparar um inversor para teste:
                    </h3>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border">
                    <p className="font-semibold mb-2">1️⃣ Configurar Inversor no Banco de Dados</p>
                    <p className="text-muted-foreground mb-2">Execute este SQL no banco PostgreSQL:</p>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
{`UPDATE equipamentos
SET mqtt_habilitado = true,
    topico_mqtt = 'inversor/01/dados'
WHERE tipo_equipamento_id IN (
  SELECT id FROM tipos_equipamentos
  WHERE codigo = 'INVERSOR'
)
LIMIT 1;

-- Ver o ID do equipamento:
SELECT id, nome, mqtt_habilitado, topico_mqtt
FROM equipamentos
WHERE mqtt_habilitado = true;`}
                    </pre>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border">
                    <p className="font-semibold mb-2">2️⃣ Inserir Dados Mock</p>
                    <p className="text-muted-foreground mb-2">No terminal, execute:</p>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs">
{`cd aupus-service-api
node scripts/insert-mock-inversor-data.js`}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      ✅ O script vai imprimir os IDs dos equipamentos com dados inseridos
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border">
                    <p className="font-semibold mb-2">3️⃣ Testar o Endpoint (Opcional)</p>
                    <p className="text-muted-foreground mb-2">Valide se o backend está retornando dados:</p>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
{`curl http://localhost:3000/api/v1/equipamentos-dados/SEU_ID_AQUI/latest`}
                    </pre>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border">
                    <p className="font-semibold mb-2">4️⃣ Visualizar no Modal</p>
                    <p className="text-muted-foreground">
                      Cole o ID do equipamento no campo acima e clique em "Visualizar Dados"
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-purple-50 dark:bg-purple-950/20 border-purple-200">
              <div>
                <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">
                  🎯 O que o modal mostra:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <strong>Status Operacional:</strong> Estado, temperatura, potência
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <strong>Energia:</strong> Geração diária/total, tempo de operação
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <strong>Potência:</strong> Ativa, reativa, aparente, fator de potência
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <strong>Tensão/Corrente AC:</strong> Trifásico completo
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <strong>12 MPPTs:</strong> Tensões dos trackers DC
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <strong>24 Strings:</strong> Correntes das strings DC
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <strong>Proteção:</strong> Isolamento e tensão de barramento
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <strong>Atualização:</strong> Automática a cada 30 segundos
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Modal de Dados do Inversor */}
      <InversorMqttDataModal
        equipamentoId={equipamentoId}
        open={inversorModalOpen}
        onOpenChange={setInversorModalOpen}
      />
    </Layout>
  );
}
