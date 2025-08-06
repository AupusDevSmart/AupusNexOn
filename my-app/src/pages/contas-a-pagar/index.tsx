// src/pages/financeiro/contas-a-pagar.tsx
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { ContasAPagarFilters } from "@/features/financeiro/components/contas-a-pagar-filters";
import { ContasAPagarSummary } from "@/features/financeiro/components/contas-a-pagar-summary";
import { ContasAPagarTable } from "@/features/financeiro/components/contas-a-pagar-table";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Tipos compatíveis com a interface do modal de Conta
interface Conta {
  id: string;
  vencimento: string;
  descricao: string;
  total: number;
  situacao: "pendente" | "atrasado" | "pago" | "cancelado";
  fornecedor?: string;
  dataEmissao?: string;
  dataPagamento?: string;
  formaPagamento?: string;
  contaBanco?: string;
  valorPago?: number;
  observacoes?: string;
}

interface LocationState {
  fromCadastro?: boolean;
  message?: string;
}

// Dados simulados com informações completas para o modal
const allContas: Conta[] = [
  {
    id: "1",
    vencimento: "2025-04-10",
    descricao: "Aluguel do escritório - Abril 2025",
    total: 2500.0,
    situacao: "pendente",
    fornecedor: "Imobiliária Central Ltda",
    dataEmissao: "2025-03-25",
    formaPagamento: "boleto",
    contaBanco: "Banco do Brasil - Conta Corrente (123456-7)",
    observacoes:
      "Aluguel mensal do escritório na Rua das Flores, 123. Vencimento todo dia 10.",
  },
  {
    id: "2",
    vencimento: "2025-04-15",
    descricao: "Internet e telefonia empresarial",
    total: 350.0,
    situacao: "pendente",
    fornecedor: "TelecomPro Serviços",
    dataEmissao: "2025-04-01",
    formaPagamento: "pix",
    contaBanco: "Santander - Conta Empresarial (789012-3)",
    observacoes:
      "Pacote empresarial com 500MB de internet + telefonia fixa e móvel.",
  },
  {
    id: "3",
    vencimento: "2025-04-20",
    descricao: "Licenças de software - Microsoft 365",
    total: 1200.0,
    situacao: "atrasado",
    fornecedor: "Microsoft Brasil",
    dataEmissao: "2025-03-15",
    formaPagamento: "cartao",
    contaBanco: "Itaú - Conta Corrente (456789-0)",
    observacoes:
      "Renovação anual das licenças Microsoft 365 para 50 usuários. Venceu há 3 dias.",
  },
  {
    id: "4",
    vencimento: "2025-04-05",
    descricao: "Energia elétrica - Março 2025",
    total: 480.75,
    situacao: "pago",
    fornecedor: "Companhia Elétrica do Estado",
    dataEmissao: "2025-03-20",
    dataPagamento: "2025-04-03",
    formaPagamento: "debito_automatico",
    contaBanco: "Banco do Brasil - Conta Corrente (123456-7)",
    valorPago: 480.75,
    observacoes:
      "Conta de energia do mês de março. Pago via débito automático conforme programado.",
  },
  {
    id: "5",
    vencimento: "2025-04-25",
    descricao: "Consultoria em TI - Projeto Sistema",
    total: 3500.0,
    situacao: "pendente",
    fornecedor: "TechSolutions Consultoria",
    dataEmissao: "2025-04-10",
    formaPagamento: "transferencia",
    contaBanco: "Bradesco - Conta Empresarial (321654-9)",
    observacoes:
      "Primeira parcela da consultoria para implementação do novo sistema de gestão. Projeto previsto para 3 meses.",
  },
  {
    id: "6",
    vencimento: "2025-04-30",
    descricao: "Material de escritório e limpeza",
    total: 245.8,
    situacao: "pendente",
    fornecedor: "Papelaria Moderna",
    dataEmissao: "2025-04-12",
    formaPagamento: "pix",
    contaBanco: "Santander - Conta Empresarial (789012-3)",
    observacoes:
      "Compra mensal de materiais: papel A4, canetas, produtos de limpeza e café para a copa.",
  },
  {
    id: "7",
    vencimento: "2025-04-08",
    descricao: "Seguro empresarial - Abril 2025",
    total: 890.0,
    situacao: "pago",
    fornecedor: "Seguradora Premium",
    dataEmissao: "2025-03-28",
    dataPagamento: "2025-04-07",
    formaPagamento: "boleto",
    contaBanco: "Itaú - Conta Corrente (456789-0)",
    valorPago: 890.0,
    observacoes:
      "Seguro empresarial cobrindo equipamentos, responsabilidade civil e incêndio. Pago antecipadamente.",
  },
  {
    id: "8",
    vencimento: "2025-04-18",
    descricao: "Manutenção de equipamentos",
    total: 650.0,
    situacao: "atrasado",
    fornecedor: "TechMaint Assistência",
    dataEmissao: "2025-04-01",
    formaPagamento: "pix",
    contaBanco: "Banco do Brasil - Conta Corrente (123456-7)",
    observacoes:
      "Manutenção preventiva dos computadores e impressoras. Atrasado há 2 dias - entrar em contato.",
  },
];

export function ContasAPagarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;

  const [selectedPeriod, setSelectedPeriod] = useState<string>("Abril de 2025");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Função para navegar para a página de cadastro de despesa
  const navegarParaCadastrarDespesa = () => {
    navigate("/financeiro/cadastrar-despesa");
  };

  // Verificar se há mensagem de sucesso no state
  useEffect(() => {
    if (locationState?.message) {
      // Exibir mensagem de sucesso usando o Toast
      Toast({
        title: "Sucesso!",
        description: locationState.message,
        variant: "success",
      });

      // Limpar o state para evitar que a mensagem apareça novamente
      window.history.replaceState({}, document.title);
    }
  }, [locationState]);

  // Função para extrair mês/ano do período selecionado
  const getMonthYear = (period: string) => {
    const months: Record<string, string> = {
      Janeiro: "01",
      Fevereiro: "02",
      Março: "03",
      Abril: "04",
      Maio: "05",
      Junho: "06",
      Julho: "07",
      Agosto: "08",
      Setembro: "09",
      Outubro: "10",
      Novembro: "11",
      Dezembro: "12",
    };

    const [month, , year] = period.split(" ");
    return { month: months[month], year };
  };

  // Filtrar contas com base no período selecionado, pesquisa e status
  const contasFiltradas = useMemo(() => {
    const { month, year } = getMonthYear(selectedPeriod);

    return allContas.filter((conta) => {
      // Filtrar por período
      const contaDate = new Date(conta.vencimento);
      const contaMonth = String(contaDate.getMonth() + 1).padStart(2, "0");
      const contaYear = String(contaDate.getFullYear());

      if (contaMonth !== month || contaYear !== year) {
        return false;
      }

      // Filtrar por pesquisa
      if (
        searchTerm &&
        !conta.descricao.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Filtrar por status
      if (statusFilter !== "all" && conta.situacao !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [selectedPeriod, searchTerm, statusFilter]);

  return (
    <Layout>
      <Layout.Main>
        <TitleCard
          title="Contas a Pagar"
          description="Gerencie todas as suas contas e pagamentos pendentes"
        />

        {/* Resumo */}
        <div className="mb-6">
          <ContasAPagarSummary contas={contasFiltradas} />
        </div>

        {/* Filtros */}
        <div className="mb-4">
          <ContasAPagarFilters
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
              Pagar pelo CA de Bolso
            </Button>
          ) : null}

          <Button variant="outline" size="sm" className="ml-auto">
            Ações em lote <span className="ml-1">▼</span>
          </Button>

          {/* Botão de Nova Conta */}
          <Button
            size="sm"
            className="bg-success hover:bg-success/90"
            onClick={navegarParaCadastrarDespesa}
          >
            <Plus className="mr-1 h-4 w-4" /> Nova Conta
          </Button>
        </div>

        {/* Tabela de contas a pagar */}
        <div className="w-full">
          <ContasAPagarTable
            contas={contasFiltradas}
            selectedItems={selectedItems}
            onSelectedItemsChange={setSelectedItems}
          />
        </div>
      </Layout.Main>
    </Layout>
  );
}
