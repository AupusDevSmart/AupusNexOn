// src/pages/financeiro/contas-a-receber.tsx
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { ContasAReceberTable } from '@/features/financeiro/components/contas-a-receber-table';
import { ContasAReceberFilters } from '@/features/financeiro/components/contas-a-receber-filters';
import { ContasAReceberSummary } from '@/features/financeiro/components/contas-a-receber-summary';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Toast } from '@/components/ui/toast'; // Ajuste para o caminho do seu componente de Toast

// Tipos
interface Conta {
  id: number;
  vencimento: string;
  descricao: string;
  total: number;
  situacao: 'pendente' | 'atrasado' | 'recebido';
}

interface LocationState {
  fromCadastro?: boolean;
  message?: string;
}

// Dados simulados para contas a receber (normalmente viriam de uma API)
const allContas: Conta[] = [
  {
    id: '1',
    vencimento: '2025-04-08',
    descricao: 'Projeto desenvolvimento website - Cliente A',
    total: 5500.00,
    situacao: 'recebido',
    cliente: 'TechCorp Soluções Empresariais',
    dataEmissao: '2025-03-20',
    dataRecebimento: '2025-04-06',
    formaRecebimento: 'transferencia',
    contaBanco: 'Banco do Brasil - Conta Corrente (123456-7)',
    valorRecebido: 5500.00,
    observacoes: 'Desenvolvimento completo de website corporativo com sistema de gerenciamento de conteúdo. Entrega realizada conforme cronograma.'
  },
  {
    id: '2',
    vencimento: '2025-04-12',
    descricao: 'Consultoria em marketing digital - Cliente B',
    total: 2800.00,
    situacao: 'pendente',
    cliente: 'Inovação Marketing Ltda',
    dataEmissao: '2025-03-25',
    formaRecebimento: 'pix',
    contaBanco: 'Santander - Conta Empresarial (789012-3)',
    observacoes: 'Consultoria estratégica em marketing digital incluindo análise de mercado, definição de personas e estratégia de conteúdo para redes sociais.'
  },
  {
    id: '3',
    vencimento: '2025-04-15',
    descricao: 'Desenvolvimento de aplicativo mobile',
    total: 8200.00,
    situacao: 'pendente',
    cliente: 'StartupTech Innovations',
    dataEmissao: '2025-03-28',
    formaRecebimento: 'boleto',
    contaBanco: 'Itaú - Conta Corrente (456789-0)',
    observacoes: 'Desenvolvimento de aplicativo mobile nativo para Android e iOS com funcionalidades de geolocalização e pagamento integrado.'
  },
  {
    id: '4',
    vencimento: '2025-04-18',
    descricao: 'Manutenção sistemas - Trimestre Q2',
    total: 1850.00,
    situacao: 'atrasado',
    cliente: 'Empresa ABC Comércio',
    dataEmissao: '2025-03-15',
    formaRecebimento: 'transferencia',
    contaBanco: 'Bradesco - Conta Empresarial (321654-9)',
    observacoes: 'Contrato trimestral de manutenção dos sistemas ERP e CRM. Inclui suporte técnico, atualizações de segurança e backup automatizado.'
  },
  {
    id: '5',
    vencimento: '2025-04-22',
    descricao: 'Treinamento equipe desenvolvimento',
    total: 3200.00,
    situacao: 'recebido',
    cliente: 'João Silva Santos - MEI',
    dataEmissao: '2025-04-01',
    dataRecebimento: '2025-04-20',
    formaRecebimento: 'pix',
    contaBanco: 'Banco do Brasil - Conta Corrente (123456-7)',
    valorRecebido: 3200.00,
    observacoes: 'Treinamento intensivo para equipe de 8 desenvolvedores em React, Node.js e boas práticas de desenvolvimento. Realizado presencialmente.'
  },
  {
    id: '6',
    vencimento: '2025-04-25',
    descricao: 'Auditoria de segurança digital',
    total: 4500.00,
    situacao: 'pendente',
    cliente: 'SecureBank Regional',
    dataEmissao: '2025-04-05',
    formaRecebimento: 'transferencia',
    contaBanco: 'Santander - Conta Empresarial (789012-3)',
    observacoes: 'Auditoria completa da infraestrutura de TI incluindo testes de penetração, análise de vulnerabilidades e relatório executivo.'
  },
  {
    id: '7',
    vencimento: '2025-04-28',
    descricao: 'Implementação sistema ERP personalizado',
    total: 12500.00,
    situacao: 'atrasado',
    cliente: 'Indústria Metalúrgica XYZ',
    dataEmissao: '2025-03-18',
    formaRecebimento: 'boleto',
    contaBanco: 'Itaú - Conta Corrente (456789-0)',
    observacoes: 'Segunda parcela da implementação do sistema ERP customizado. Cliente solicitou ajustes adicionais nos módulos de produção e estoque.'
  },
  {
    id: '8',
    vencimento: '2025-04-30',
    descricao: 'Design de interface - E-commerce',
    total: 3600.00,
    situacao: 'pendente',
    cliente: 'ModaOnline Fashion Store',
    dataEmissao: '2025-04-10',
    formaRecebimento: 'cartao',
    contaBanco: 'Bradesco - Conta Empresarial (321654-9)',
    observacoes: 'Redesign completo da interface do e-commerce de moda incluindo experiência de usuário otimizada para conversão e checkout simplificado.'
  },
  {
    id: '9',
    vencimento: '2025-05-05',
    descricao: 'Consultoria em transformação digital',
    total: 7800.00,
    situacao: 'pendente',
    cliente: 'Tradicional Negócios Ltda',
    dataEmissao: '2025-04-12',
    formaRecebimento: 'transferencia',
    contaBanco: 'Banco do Brasil - Conta Corrente (123456-7)',
    observacoes: 'Consultoria estratégica para digitalização de processos empresariais incluindo migração para nuvem e automação de workflows.'
  },
  {
    id: '10',
    vencimento: '2025-05-08',
    descricao: 'Desenvolvimento API REST - Integração',
    total: 2950.00,
    situacao: 'recebido',
    cliente: 'FinTech Pagamentos Rápidos',
    dataEmissao: '2025-04-08',
    dataRecebimento: '2025-05-06',
    formaRecebimento: 'pix',
    contaBanco: 'Santander - Conta Empresarial (789012-3)',
    valorRecebido: 2950.00,
    observacoes: 'Desenvolvimento de API REST para integração com gateway de pagamentos. Incluiu documentação técnica e testes automatizados.'
  },
  {
    id: '11',
    vencimento: '2025-05-12',
    descricao: 'Licenças software - Renovação anual',
    total: 5200.00,
    situacao: 'atrasado',
    cliente: 'Escritório Advocacia & Associados',
    dataEmissao: '2025-04-02',
    formaRecebimento: 'boleto',
    contaBanco: 'Itaú - Conta Corrente (456789-0)',
    observacoes: 'Renovação das licenças de software jurídico para 25 usuários. Sistema inclui gestão de processos, controle de prazos e faturamento.'
  },
  {
    id: '12',
    vencimento: '2025-05-15',
    descricao: 'Análise de dados - Business Intelligence',
    total: 4100.00,
    situacao: 'pendente',
    cliente: 'RetailMax Supermercados',
    dataEmissao: '2025-04-15',
    formaRecebimento: 'transferencia',
    contaBanco: 'Bradesco - Conta Empresarial (321654-9)',
    observacoes: 'Implementação de dashboard de BI para análise de vendas, estoque e comportamento do consumidor com relatórios gerenciais automatizados.'
  }
];

export function ContasAReceberPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Abril de 2025');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Função para navegar para a página de cadastro de receita
  const navegarParaCadastrarReceita = () => {
    navigate('/financeiro/cadastrar-receita');
  };

  // Verificar se há mensagem de sucesso no state (ao retornar da página de cadastro)
  useEffect(() => {
    if (locationState?.message) {
      // Exibir mensagem de sucesso usando o Toast
      Toast({
        title: "Sucesso!",
        description: locationState.message,
        variant: "success",
      });
      
      // Limpar o state para evitar que a mensagem apareça novamente em recarregamentos
      window.history.replaceState({}, document.title);
    }
  }, [locationState]);

  // Função para extrair mês/ano do período selecionado
  const getMonthYear = (period: string) => {
    const months: Record<string, string> = {
      'Janeiro': '01', 'Fevereiro': '02', 'Março': '03', 'Abril': '04',
      'Maio': '05', 'Junho': '06', 'Julho': '07', 'Agosto': '08',
      'Setembro': '09', 'Outubro': '10', 'Novembro': '11', 'Dezembro': '12'
    };
    
    const [month, , year] = period.split(' ');
    return { month: months[month], year };
  };

  // Filtrar contas com base no período selecionado, pesquisa e status
  const contasFiltradas = useMemo(() => {
    const { month, year } = getMonthYear(selectedPeriod);
    
    return allContas.filter(conta => {
      // Filtrar por período
      const contaDate = new Date(conta.vencimento);
      const contaMonth = String(contaDate.getMonth() + 1).padStart(2, '0');
      const contaYear = String(contaDate.getFullYear());
      
      if (contaMonth !== month || contaYear !== year) {
        return false;
      }
      
      // Filtrar por pesquisa
      if (searchTerm && !conta.descricao.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filtrar por status
      if (statusFilter !== 'all' && conta.situacao !== statusFilter) {
        return false;
      }
      
      return true;
    });
  }, [selectedPeriod, searchTerm, statusFilter]);

  return (
    <Layout>
      <Layout.Main>
        <TitleCard
          title="Contas a Receber"
          description="Acompanhe todos os seus recebimentos e valores pendentes"
        />
        
        {/* Resumo */}
        <div className="mb-6">
          <ContasAReceberSummary contas={contasFiltradas} />
        </div>
        
        {/* Filtros */}
        <div className="mb-4">
          <ContasAReceberFilters 
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </div>
        
        {/* Ações em lote */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedItems.length} registro(s) selecionado(s)
          </span>
          
          {selectedItems.length > 0 ? (
            <Button variant="outline" size="sm">
              Marcar como Recebido
            </Button>
          ) : null}
          
          <Button variant="outline" size="sm" className="ml-auto">
            Ações em lote <span className="ml-1">▼</span>
          </Button>
          
          {/* Botão de Nova Conta que usa useNavigate para redirecionar */}
          <Button 
            size="sm" 
            className="bg-success hover:bg-success/90"
            onClick={navegarParaCadastrarReceita}
          >
            <Plus className="mr-1 h-4 w-4" /> Nova Conta
          </Button>
        </div>
        
        {/* Tabela de contas a receber */}
        <div className="w-full">
          <ContasAReceberTable 
            contas={contasFiltradas}
            selectedItems={selectedItems}
            onSelectedItemsChange={setSelectedItems}
          />
        </div>
      </Layout.Main>
    </Layout>
  );
}