// src/pages/financeiro/cadastrar-despesa.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

// Componentes compartilhados
import { LancamentoFormSection } from '@/features/financeiro/components/lancamento-form-section';
import { DateInput } from '@/features/financeiro/components/date-input';
import { MoneyInput } from '@/features/financeiro/components/money-input';
import { FieldLabel } from '@/features/financeiro/components/field-label';
import { ToggleSwitch } from '@/features/financeiro/components/toggle-switch';
import { FormTabs } from '@/features/financeiro/components/form-tabs';
import { FormActions } from '@/features/financeiro/components/form-actions';
import { SearchableCombobox, SearchableComboboxWithManual } from '@/features/financeiro/components/searchable-combobox';
import { RecorrenciaSection } from '@/features/financeiro/components/recorrencia-section';

// Interface para anexos
interface Anexo {
  id: string;
  nome: string;
  tamanho: string;
  tipo: string;
  arquivo?: File;
}

// Interface para opções do combobox
interface ComboboxOption {
  value: string;
  label: string;
}

// Interface para configuração de recorrência
interface RecorrenciaConfig {
  tipo: 'unica' | 'recorrente';
  intervaloEmDias: number;
  dataInicio: string;
  tipoFim: 'data' | 'parcelas';
  dataFim?: string;
  numeroParcelas?: number;
}

export function CadastrarDespesaPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fornecedor: '',
    centroCusto: '',
    contrato: '',
    contaBanco: '',
    valor: '',
    valorPago: '',
    dataEmissao: new Date().toISOString().split('T')[0],
    vencimento: new Date().toISOString().split('T')[0],
    dataPagamento: '',
    status: 'pendente',
    formaPagamento: '',
    linkBoleto: '',
    pago: false,
    observacoes: ''
  });

  const [recorrenciaConfig, setRecorrenciaConfig] = useState<RecorrenciaConfig>({
    tipo: 'unica',
    intervaloEmDias: 30,
    dataInicio: new Date().toISOString().split('T')[0],
    tipoFim: 'parcelas',
    numeroParcelas: 12
  });

  const [activeTab, setActiveTab] = useState<string>('observacoes');
  const [anexos, setAnexos] = useState<Anexo[]>([]);

  // Dados das opções para os combobox
  const fornecedoresOptions: ComboboxOption[] = [
    { value: 'fornecedor1', label: 'Imobiliária Central' },
    { value: 'fornecedor2', label: 'Companhia Elétrica' },
    { value: 'fornecedor3', label: 'SoftTech Inc' },
    { value: 'fornecedor4', label: 'Papelaria Moderna' },
    { value: 'fornecedor5', label: 'Transportadora Express' },
    { value: 'fornecedor6', label: 'Consultoria Empresarial' },
  ];

  const centrosCustoOptions: ComboboxOption[] = [
    { value: 'administrativo', label: 'Administrativo' },
    { value: 'ti', label: 'Tecnologia da Informação' },
    { value: 'marketing', label: 'Marketing e Vendas' },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'operacional', label: 'Operacional' },
    { value: 'rh', label: 'Recursos Humanos' },
  ];

  const contratosOptions: ComboboxOption[] = [
    { value: 'contrato1', label: 'Contrato 001/2024 - Aluguel Sede' },
    { value: 'contrato2', label: 'Contrato 002/2024 - Licenças Software' },
    { value: 'contrato3', label: 'Contrato 003/2024 - Serviços Consultoria' },
    { value: 'contrato4', label: 'Contrato 004/2024 - Manutenção Equipamentos' },
  ];

  const contasBancoOptions: ComboboxOption[] = [
    { value: 'conta1', label: 'Banco do Brasil - Conta Corrente (123456-7)' },
    { value: 'conta2', label: 'Santander - Conta Empresarial (789012-3)' },
    { value: 'conta3', label: 'Itaú - Conta Corrente (456789-0)' },
    { value: 'conta4', label: 'Bradesco - Conta Empresarial (321654-9)' },
  ];

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Função para gerar datas de recorrência
  const gerarDatasRecorrencia = (config: RecorrenciaConfig): Date[] => {
    const datas: Date[] = [];
    const dataInicio = new Date(config.dataInicio);
    
    if (config.tipo === 'unica') return [dataInicio];
    
    if (config.tipoFim === 'parcelas' && config.numeroParcelas) {
      for (let i = 0; i < config.numeroParcelas; i++) {
        const novaData = new Date(dataInicio);
        novaData.setDate(dataInicio.getDate() + (i * config.intervaloEmDias));
        datas.push(novaData);
      }
    } else if (config.tipoFim === 'data' && config.dataFim) {
      const dataFim = new Date(config.dataFim);
      let dataAtual = new Date(dataInicio);
      
      while (dataAtual <= dataFim) {
        datas.push(new Date(dataAtual));
        dataAtual.setDate(dataAtual.getDate() + config.intervaloEmDias);
      }
    }
    
    return datas;
  };

  // Função para processar anexos para envio
  const prepararAnexosParaEnvio = () => {
    const formDataParaAPI = new FormData();
    
    // Adicionar dados do formulário
    Object.entries(formData).forEach(([key, value]) => {
      formDataParaAPI.append(key, value.toString());
    });
    
    // Adicionar anexos
    anexos.forEach((anexo, index) => {
      if (anexo.arquivo) {
        formDataParaAPI.append(`anexo_${index}`, anexo.arquivo, anexo.nome);
      }
    });
    
    return formDataParaAPI;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Gerar as datas baseadas na configuração de recorrência
    const datasGeradas = gerarDatasRecorrencia(recorrenciaConfig);
    
    // Preparar os dados com recorrência
    const despesasParaCriar = datasGeradas.map((data, index) => ({
      ...formData,
      vencimento: data.toISOString().split('T')[0],
      // Se for recorrente, adicionar sufixo no ID/descrição
      ...(recorrenciaConfig.tipo === 'recorrente' && {
        descricao: `${formData.descricao || 'Despesa'} - Parcela ${index + 1}/${datasGeradas.length}`,
        numeroParcelaAtual: index + 1,
        totalParcelas: datasGeradas.length,
        recorrenciaId: `recorrencia_${Date.now()}` // ID para agrupar as parcelas
      }),
      anexos: anexos.map(anexo => ({
        nome: anexo.nome,
        tamanho: anexo.tamanho,
        tipo: anexo.tipo
      }))
    }));
    
    console.log('Despesas a serem criadas:', despesasParaCriar);
    console.log('Configuração de recorrência:', recorrenciaConfig);
    
    // Aqui você faria a chamada para a API
    // await api.post('/despesas/bulk', { despesas: despesasParaCriar });
    
    const mensagem = recorrenciaConfig.tipo === 'recorrente' 
      ? `${despesasParaCriar.length} despesas recorrentes cadastradas com sucesso!`
      : 'Despesa cadastrada com sucesso!';
    
    // Redirecionar para a página de contas a pagar após salvar
    navigate('/financeiro/contas-a-pagar', {
      state: { 
        message: mensagem,
        fromCadastro: true
      }
    });
  };

  const handleCancel = () => {
    navigate('/financeiro/contas-a-pagar');
  };

  return (
    <Layout>
      <Layout.Main>
        <TitleCard
          title="Nova despesa"
          description="Registre uma nova despesa no sistema"
        />
        
        <div className="mt-6 w-full">
          <form onSubmit={handleSubmit} encType="multipart/form-data">
            <div className="space-y-6">
              {/* Informações básicas */}
              <LancamentoFormSection title="Informações básicas">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FieldLabel required>Fornecedor</FieldLabel>
                    <SearchableComboboxWithManual
                      placeholder="Buscar ou digitar fornecedor..."
                      searchPlaceholder="Buscar fornecedor ou digitar novo..."
                      options={fornecedoresOptions}
                      value={formData.fornecedor}
                      onValueChange={(value) => handleChange('fornecedor', value)}
                      allowManualInput={true}
                      manualInputText="Usar fornecedor"
                      emptyText="Nenhum fornecedor encontrado. Digite o nome para adicionar manualmente."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <FieldLabel required>Data de emissão</FieldLabel>
                    <DateInput 
                      value={formData.dataEmissao}
                      onChange={(value) => handleChange('dataEmissao', value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FieldLabel>Centro de custo</FieldLabel>
                    <SearchableCombobox
                      placeholder="Buscar centro de custo..."
                      options={centrosCustoOptions}
                      value={formData.centroCusto}
                      onValueChange={(value) => handleChange('centroCusto', value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <FieldLabel>Contrato</FieldLabel>
                    <SearchableCombobox
                      placeholder="Buscar contrato..."
                      options={contratosOptions}
                      value={formData.contrato}
                      onValueChange={(value) => handleChange('contrato', value)}
                    />
                  </div>
                </div>
              </LancamentoFormSection>
              
              {/* Dados financeiros */}
              <LancamentoFormSection title="Dados financeiros">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FieldLabel required>Valor</FieldLabel>
                    <MoneyInput 
                      value={formData.valor}
                      onChange={(value) => handleChange('valor', value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <FieldLabel required>Status</FieldLabel>
                    <Select 
                      onValueChange={(value) => handleChange('status', value)}
                      value={formData.status}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Vencimento - só mostra se não for recorrente */}
                {recorrenciaConfig.tipo === 'unica' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FieldLabel required>Vencimento</FieldLabel>
                      <DateInput 
                        value={formData.vencimento}
                        onChange={(value) => handleChange('vencimento', value)}
                        required
                      />
                    </div>
                    
                    {formData.status === 'pago' && (
                      <div className="space-y-2">
                        <FieldLabel required>Data de pagamento</FieldLabel>
                        <DateInput 
                          value={formData.dataPagamento}
                          onChange={(value) => handleChange('dataPagamento', value)}
                          required
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {formData.status === 'pago' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FieldLabel required>Valor pago</FieldLabel>
                      <MoneyInput 
                        value={formData.valorPago}
                        onChange={(value) => handleChange('valorPago', value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </LancamentoFormSection>

              {/* Seção de Recorrência */}
              <RecorrenciaSection
                config={recorrenciaConfig}
                onChange={setRecorrenciaConfig}
                tipo="despesa"
              />
              
              {/* Condições de pagamento */}
              <LancamentoFormSection title="Condições de pagamento">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FieldLabel>Forma de pagamento</FieldLabel>
                    <Select 
                      onValueChange={(value) => handleChange('formaPagamento', value)}
                      value={formData.formaPagamento}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a forma de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <FieldLabel>Conta bancária</FieldLabel>
                    <SearchableCombobox
                      placeholder="Buscar conta bancária..."
                      options={contasBancoOptions}
                      value={formData.contaBanco}
                      onValueChange={(value) => handleChange('contaBanco', value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <FieldLabel>Link do boleto</FieldLabel>
                  <Input 
                    type="url"
                    placeholder="https://exemplo.com/boleto/123456" 
                    value={formData.linkBoleto}
                    onChange={(e) => handleChange('linkBoleto', e.target.value)}
                  />
                </div>
              </LancamentoFormSection>
              
              {/* Observações e Anexos */}
              <LancamentoFormSection>
                <div id="anexos-container">
                  <FormTabs 
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    observacoes={formData.observacoes}
                    onObservacoesChange={(value) => handleChange('observacoes', value)}
                    anexos={anexos}
                    onAnexosChange={setAnexos}
                  />
                </div>
              </LancamentoFormSection>
              
              {/* Botões de ação */}
              <FormActions onCancel={handleCancel} />
            </div>
          </form>
        </div>
      </Layout.Main>
    </Layout>
  );
}

export default CadastrarDespesaPage;