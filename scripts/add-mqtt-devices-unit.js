// Script para adicionar unidade MQTT ao localStorage
// Execute este código no console do navegador (F12) na página do sinóptico-ativo

const mqttDevicesData = {
  ativoId: "mqtt-devices",
  componentes: [
    {
      id: "m160-1",
      tipo: "M160",
      nome: "M160 Multimedidor",
      posicao: { x: 20, y: 50 },
      status: "NORMAL",
      tag: "OLI/GO/CHI/CAB/M160-1",
      dados: {}
    },
    {
      id: "a966-1",
      tipo: "A966",
      nome: "A966 Gateway IoT",
      posicao: { x: 50, y: 50 },
      status: "NORMAL",
      tag: "IMS/a966/state",
      dados: {}
    },
    {
      id: "landis-1",
      tipo: "LANDIS_E750",
      nome: "Landis+Gyr E750",
      posicao: { x: 80, y: 50 },
      status: "NORMAL",
      tag: "IMS/a966/LANDIS/state",
      dados: {}
    }
  ],
  connections: [],
  ultimaAtualizacao: new Date().toISOString(),
  versao: "1.0"
};

// Salvar no localStorage
const key = "diagrama_mqtt-devices";
localStorage.setItem(key, JSON.stringify(mqttDevicesData));

console.log("✅ Unidade MQTT criada com sucesso!");
console.log("📊 Componentes salvos:", mqttDevicesData.componentes.length);
console.log("🔑 Chave:", key);

// Verificar se foi salvo
const verificacao = localStorage.getItem(key);
if (verificacao) {
  console.log("✅ Verificação OK - Dados salvos no localStorage");
  console.log(JSON.parse(verificacao));
} else {
  console.error("❌ Erro ao salvar no localStorage");
}
