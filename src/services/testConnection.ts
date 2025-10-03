import api from './api';

export async function testAPIConnection() {
  try {
    console.log('🔍 Testando conexão com a API...');
    const response = await api.get('/');
    console.log('✅ API respondeu:', response.status, response.data);
    return true;
  } catch (error) {
    console.error('❌ API não está respondendo:', error);
    return false;
  }
}

// Função para testar endpoint específico
export async function testUnidadesEndpoint() {
  try {
    console.log('🔍 Testando endpoint /unidades...');
    const response = await api.get('/unidades', {
      timeout: 5000, // 5 segundos
    });
    console.log('✅ Endpoint /unidades funcionando:', response.status);
    return true;
  } catch (error: any) {
    console.error('❌ Endpoint /unidades com problema:', error.code, error.message);
    return false;
  }
}