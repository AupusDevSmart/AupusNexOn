// src/pages/financeiro/centros-de-custo.tsx
import React, { useState, useMemo } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { CentrosCustoTable } from '@/features/financeiro/components/centros-custo-table';
import { CentrosCustoFilters } from '@/features/financeiro/components/centros-custo-filters';
import { CentrosCustoSummary } from '@/features/financeiro/components/centros-custo-summary';
import { CentrosCustoModal } from '@/features/financeiro/components/centros-custo-modal';
import { CentrosCustoViewModal } from '@/features/financeiro/components/centros-custo-view-modal';
import { Button } from '@/components/ui/button';
import { Plus, Download, Upload, Settings } from 'lucide-react';
import { CentroCusto, CentroCustoFormData } from '@/types/dtos/financeiro';

// Dados simulados para centros de custo
const allCentrosCusto: CentroCusto[] = [
  {
    id: 1,
    codigo: 'CC001',
    nome: 'Administração Geral',
    tipo: 'administrativo',
    status: 'ativo',
    centroPai: null,
    responsavel: 'João Silva',
    email: 'joao.silva@empresa.com',
    orcamentoMensal: 50000.00,
    gastoAcumulado: 32500.00,
    descricao: 'Centro de custo para despesas administrativas gerais',
    dataCreacao: '2024-01-15',
    ultimaAtualizacao: '2025-03-20'
  },
  {
    id: 2,
    codigo: 'CC002',
    nome: 'Recursos Humanos',
    tipo: 'administrativo',
    status: 'ativo',
    centroPai: 1,
    responsavel: 'Maria Santos',
    email: 'maria.santos@empresa.com',
    orcamentoMensal: 25000.00,
    gastoAcumulado: 18750.00,
    descricao: 'Gestão de pessoas e benefícios',
    dataCreacao: '2024-01-20',
    ultimaAtualizacao: '2025-04-01'
  },
  {
    id: 3,
    codigo: 'CC003',
    nome: 'Tecnologia da Informação',
    tipo: 'operacional',
    status: 'ativo',
    centroPai: null,
    responsavel: 'Carlos Lima',
    email: 'carlos.lima@empresa.com',
    orcamentoMensal: 80000.00,
    gastoAcumulado: 65200.00,
    descricao: 'Infraestrutura, desenvolvimento e suporte técnico',
    dataCreacao: '2024-02-01',
    ultimaAtualizacao: '2025-04-05'
  },
  {
    id: 4,
    codigo: 'CC004',
    nome: 'Marketing Digital',
    tipo: 'comercial',
    status: 'ativo',
    centroPai: null,
    responsavel: 'Ana Costa',
    email: 'ana.costa@empresa.com',
    orcamentoMensal: 35000.00,
    gastoAcumulado: 28900.00,
    descricao: 'Campanhas digitais e gestão de redes sociais',
    dataCreacao: '2024-02-10',
    ultimaAtualizacao: '2025-04-03'
  },
  {
    id: 5,
    codigo: 'CC005',
    nome: 'Vendas Região Sul',
    tipo: 'comercial',
    status: 'ativo',
    centroPai: null,
    responsavel: 'Pedro Oliveira',
    email: 'pedro.oliveira@empresa.com',
    orcamentoMensal: 45000.00,
    gastoAcumulado: 39800.00,
    descricao: 'Equipe comercial da região sul',
    dataCreacao: '2024-02-15',
    ultimaAtualizacao: '2025-03-28'
  },
  {
    id: 6,
    codigo: 'CC006',
    nome: 'Desenvolvimento Mobile',
    tipo: 'operacional',
    status: 'ativo',
    centroPai: 3,
    responsavel: 'Julia Ferreira',
    email: 'julia.ferreira@empresa.com',
    orcamentoMensal: 30000.00,
    gastoAcumulado: 22100.00,
    descricao: 'Desenvolvimento de aplicativos móveis',
    dataCreacao: '2024-03-01',
    ultimaAtualizacao: '2025-04-02'
  },
  {
    id: 7,
    codigo: 'CC007',
    nome: 'Logística e Distribuição',
    tipo: 'operacional',
    status: 'ativo',
    centroPai: null,
    responsavel: 'Roberto Mendes',
    email: 'roberto.mendes@empresa.com',
    orcamentoMensal: 60000.00,
    gastoAcumulado: 51300.00,
    descricao: 'Gestão de estoque e distribuição',
    dataCreacao: '2024-03-05',
    ultimaAtualizacao: '2025-04-01'
  },
  {
    id: 8,
    codigo: 'CC008',
    nome: 'Financeiro',
    tipo: 'administrativo',
    status: 'ativo',
    centroPai: 1,
    responsavel: 'Fernanda Rocha',
    email: 'fernanda.rocha@empresa.com',
    orcamentoMensal: 20000.00,
    gastoAcumulado: 15800.00,
    descricao: 'Controladoria e gestão financeira',
    dataCreacao: '2024-03-10',
    ultimaAtualizacao: '2025-03-30'
  },
  {
    id: 9,
    codigo: 'CC009',
    nome: 'Projeto Especial Alpha',
    tipo: 'projeto',
    status: 'inativo',
    centroPai: null,
    responsavel: 'Ricardo Alves',
    email: 'ricardo.alves@empresa.com',
    orcamentoMensal: 75000.00,
    gastoAcumulado: 42000.00,
    descricao: 'Projeto de expansão internacional - finalizado',
    dataCreacao: '2024-01-05',
    ultimaAtualizacao: '2025-02-15'
  },
  {
    id: 10,
    codigo: 'CC010',
    nome: 'Atendimento ao Cliente',
    tipo: 'operacional',
    status: 'ativo',
    centroPai: null,
    responsavel: 'Luciana Gomes',
    email: 'luciana.gomes@empresa.com',
    orcamentoMensal: 28000.00,
    gastoAcumulado: 23500.00,
    descricao: 'SAC e suporte aos clientes',
    dataCreacao: '2024-03-20',
    ultimaAtualizacao: '2025-04-04'
  }
];

export function CentrosCustoPage(): JSX.Element {
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'inativo'>('all');
  const [tipoFilter, setTipoFilter] = useState<'all' | 'administrativo' | 'operacional' | 'comercial' | 'projeto'>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<CentroCusto | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [viewingItem, setViewingItem] = useState<CentroCusto | null>(null);

  // Filtrar centros de custo
  const centrosFiltrados = useMemo(() => {
    return allCentrosCusto.filter(centro => {
      // Filtrar por pesquisa
      if (searchTerm && 
          !centro.nome.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !centro.codigo.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !centro.responsavel.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filtrar por status
      if (statusFilter !== 'all' && centro.status !== statusFilter) {
        return false;
      }

      // Filtrar por tipo
      if (tipoFilter !== 'all' && centro.tipo !== tipoFilter) {
        return false;
      }
      
      return true;
    });
  }, [searchTerm, statusFilter, tipoFilter]);

  // Função para abrir modal de criação
  const handleNovoCentro = (): void => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  // Função para abrir modal de visualização
  const handleVisualizarCentro = (centro: CentroCusto): void => {
    setViewingItem(centro);
    setIsViewModalOpen(true);
  };

  // Função para abrir modal de edição
  const handleEditarCentro = (centro: CentroCusto): void => {
    setEditingItem(centro);
    setIsModalOpen(true);
  };

  // Função para fechar modal
  const handleCloseModal = (): void => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // Função para fechar modal de visualização
  const handleCloseViewModal = (): void => {
    setIsViewModalOpen(false);
    setViewingItem(null);
  };

  // Função para salvar centro (simulada)
  const handleSalvarCentro = (dadosCentro: CentroCustoFormData): void => {
    console.log('Salvando centro:', dadosCentro);
    // Aqui você implementaria a lógica de salvar no backend
    handleCloseModal();
  };

  // Funções de ações em lote
  const handleAtivarSelecionados = (): void => {
    console.log('Ativar centros:', selectedItems);
    setSelectedItems([]);
  };

  const handleDesativarSelecionados = (): void => {
    console.log('Desativar centros:', selectedItems);
    setSelectedItems([]);
  };

  const handleExportarDados = (): void => {
    console.log('Exportar dados dos centros de custo');
  };

  return (
    <Layout>
      <Layout.Main>
        <TitleCard
          title="Centros de Custo"
          description="Gerencie os centros de custo da organização e controle orçamentos"
        />
        
        {/* Resumo */}
        <div className="mb-6">
          <CentrosCustoSummary centros={centrosFiltrados} />
        </div>
        
        {/* Filtros */}
        <div className="mb-4">
          <CentrosCustoFilters 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            tipoFilter={tipoFilter}
            onTipoFilterChange={setTipoFilter}
          />
        </div>
        
        {/* Ações em lote */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {selectedItems.length} centro(s) selecionado(s)
          </span>
          
          {selectedItems.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleAtivarSelecionados}>
                Ativar Selecionados
              </Button>
              <Button variant="outline" size="sm" onClick={handleDesativarSelecionados}>
                Desativar Selecionados
              </Button>
            </>
          )}
          
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportarDados}>
              <Download className="mr-1 h-4 w-4" /> Exportar
            </Button>
            
            <Button variant="outline" size="sm">
              <Upload className="mr-1 h-4 w-4" /> Importar
            </Button>
            
            <Button variant="outline" size="sm">
              <Settings className="mr-1 h-4 w-4" /> Configurações
            </Button>
            
            <Button size="sm" className="bg-success hover:bg-success/90" onClick={handleNovoCentro}>
              <Plus className="mr-1 h-4 w-4" /> Novo Centro
            </Button>
          </div>
        </div>
        
        {/* Tabela de centros de custo */}
        <div className="w-full">
          <CentrosCustoTable 
            centros={centrosFiltrados}
            selectedItems={selectedItems}
            onSelectedItemsChange={setSelectedItems}
            onEditItem={handleEditarCentro}
            onViewItem={handleVisualizarCentro}
            allCentros={allCentrosCusto}
          />
        </div>

        {/* Modal de criação/edição */}
        <CentrosCustoModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSalvarCentro}
          editingItem={editingItem}
          centrosPai={allCentrosCusto.filter(c => c.status === 'ativo')}
        />

        {/* Modal de visualização */}
        <CentrosCustoViewModal
          isOpen={isViewModalOpen}
          onClose={handleCloseViewModal}
          centro={viewingItem}
          allCentros={allCentrosCusto}
        />
      </Layout.Main>
    </Layout>
  );
}