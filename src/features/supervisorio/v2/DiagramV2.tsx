/**
 * DIAGRAM V2 - Componente Principal (Refatorado)
 *
 * Novo diagrama unifilar com arquitetura modular:
 * - Canvas fixo (1920x1080) com zoom/pan
 * - Conexões ortogonais (L-shape)
 * - Barramentos detectados algoritmicamente
 * - Tema claro/escuro (monocromático)
 * - Zustand para gerenciamento de estado
 * - Salvamento atômico (PUT /layout)
 */

import React, { useEffect, useState } from 'react';
import { useDiagramStore } from './hooks/useDiagramStore';
import { DiagramViewport } from './components/DiagramViewer/DiagramViewport';
import { DiagramConnections } from './components/DiagramViewer/DiagramConnections';
import { EquipmentNode } from './components/Equipment/EquipmentNode';
import { EditorSidebar } from './components/EditorSidebar';
import { EquipmentEditModal } from './components/EquipmentEditModal';
import { ModalCriarEquipamentoRapido } from '../components/ModalCriarEquipamentoRapido';
import type { EquipamentoApiResponse } from '@/services/equipamentos.services';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
import { useUserStore } from '@/store/useUserStore';
import type { Equipment, Theme } from './types/diagram.types';

interface AvailableEquipment {
  id: string;
  nome: string;
  tag?: string;
  fabricante?: string;
  tipo_equipamento?: string;
  tipoEquipamento?: { codigo?: string };
}

interface DiagramV2Props {
  diagramaId: string;
  mode?: 'view' | 'edit';
  availableEquipments?: AvailableEquipment[]; // Lista de equipamentos da unidade disponíveis
  onBackgroundClick?: () => void; // Callback quando clica no background
  onEquipmentClick?: (equipment: Equipment) => void; // Callback quando clica em equipamento
}

export const DiagramV2: React.FC<DiagramV2Props> = ({
  diagramaId,
  mode: initialMode = 'view',
  availableEquipments = [],
  onBackgroundClick,
  onEquipmentClick,
}) => {
  const loadDiagrama = useDiagramStore(state => state.loadDiagrama);
  const createDiagrama = useDiagramStore(state => state.createDiagrama);
  const saveLayout = useDiagramStore(state => state.saveLayout);
  const setEditorMode = useDiagramStore(state => state.setEditorMode);
  const setTheme = useDiagramStore(state => state.setTheme);
  const addEquipamento = useDiagramStore(state => state.addEquipamento);
  const removeEquipamento = useDiagramStore(state => state.removeEquipamento);
  const clearSelection = useDiagramStore(state => state.clearSelection);
  const fitToContent = useDiagramStore(state => state.fitToContent);

  const diagrama = useDiagramStore(state => state.diagrama);
  const equipamentos = useDiagramStore(state => state.equipamentos);
  const visualConnections = useDiagramStore(state => state.visualConnections);
  const barramentos = useDiagramStore(state => state.barramentos);
  const isLoading = useDiagramStore(state => state.isLoading);
  const error = useDiagramStore(state => state.error);
  const errorType = useDiagramStore(state => state.errorType);
  const isDirty = useDiagramStore(state => state.isDirty);
  const selectedIds = useDiagramStore(state => state.editor.selectedEquipmentIds);
  const selectedConnectionIds = useDiagramStore(state => state.editor.selectedConnectionIds);
  const removeConexao = useDiagramStore(state => state.removeConexao);

  // Verificação de permissões
  const { isAdmin } = useUserStore();

  // Tema global da aplicação
  const { theme: appTheme } = useTheme();
  const effectiveTheme = appTheme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : appTheme;

  // Estado local para controlar mode (permite toggle)
  const [currentMode, setCurrentMode] = useState<'view' | 'edit'>(initialMode);

  // Modal de criação
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formNome, setFormNome] = useState('Diagrama Unifilar');
  const [formDescricao, setFormDescricao] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal de edição
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Modal de criar equipamento rápido
  const [showCreateEquipmentModal, setShowCreateEquipmentModal] = useState(false);

  const { toast } = useToast();

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  useEffect(() => {
    // Carregar diagrama ao montar
    loadDiagrama(diagramaId);
  }, [diagramaId, loadDiagrama]);

  useEffect(() => {
    // Sincronizar modo inicial com currentMode
    setCurrentMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    // Sincronizar modo atual com store
    setEditorMode(currentMode);
  }, [currentMode, setEditorMode]);

  useEffect(() => {
    // Sincronizar tema global com diagrama store
    setTheme(effectiveTheme as Theme);
  }, [effectiveTheme, setTheme]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleSave = async () => {
    try {
      await saveLayout();
      toast({
        title: 'Sucesso',
        description: 'Layout salvo com sucesso!',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar layout',
        variant: 'destructive',
      });
      console.error(err);
    }
  };

  const handleCreateDiagrama = async () => {
    if (!formNome.trim()) {
      toast({
        title: 'Atenção',
        description: 'Por favor, informe um nome para o diagrama',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      await createDiagrama(diagramaId, formNome.trim(), formDescricao.trim() || undefined);
      toast({
        title: 'Sucesso',
        description: 'Diagrama criado com sucesso! Agora você pode adicionar equipamentos.',
      });
      setShowCreateModal(false);
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro ao criar diagrama',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEquipamentoCriado = (equipamento: EquipamentoApiResponse) => {
    if (!diagrama) return;

    // Converter equipamento do backend para formato do diagrama
    const newEquipment: Equipment = {
      id: equipamento.id,
      nome: equipamento.nome,
      tag: equipamento.numero_serie || equipamento.nome, // Usar numero_serie como tag
      tipo: equipamento.tipo_equipamento || 'EQUIPAMENTO',
      unidadeId: diagrama.unidadeId,
      diagramaId: diagrama.id,
      posicaoX: 0, // Centro do viewBox (0,0)
      posicaoY: 0, // Centro do viewBox (0,0)
      rotacao: 0,
      labelPosition: 'top',
      status: 'normal',
      createdAt: new Date(equipamento.created_at || new Date()),
      updatedAt: new Date(equipamento.updated_at || new Date()),
      deletedAt: null,
    };

    addEquipamento(newEquipment);
    toast({
      title: 'Equipamento adicionado',
      description: `${equipamento.nome} foi criado e adicionado ao diagrama`,
    });
  };

  const handleEditEquipment = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setShowEditModal(true);
  };

  const handleSaveEquipmentEdit = async (updates: Partial<Equipment>) => {
    if (!editingEquipment) return;

    try {
      // Salvar no backend primeiro
      const { equipamentosApi } = await import('@/services/equipamentos.services');

      await equipamentosApi.update(editingEquipment.id, {
        nome: updates.nome,
        tag: updates.tag,
        mqtt_habilitado: updates.mqttHabilitado,
        topico_mqtt: updates.topicoMqtt,
      });

      // Atualizar equipamento no store
      const updatedEquipment = { ...editingEquipment, ...updates };
      const equipamentosAtualizados = equipamentos.map(eq =>
        eq.id === editingEquipment.id ? updatedEquipment : eq
      );

      // Usar método updateEquipamento do store se existir, senão fazer manualmente
      useDiagramStore.setState({ equipamentos: equipamentosAtualizados, isDirty: true });
      useDiagramStore.getState().recalcularRotas();

      toast({
        title: 'Equipamento atualizado',
        description: 'As alterações foram salvas com sucesso',
      });

      setEditingEquipment(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Erro ao salvar equipamento:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações do equipamento',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEquipment = (equipmentId: string) => {
    const equipment = equipamentos.find(eq => eq.id === equipmentId);
    if (!equipment) return;

    removeEquipamento(equipmentId);
    toast({
      title: 'Equipamento removido',
      description: `${equipment.nome} foi removido do diagrama`,
    });
  };

  // Handler para adicionar equipamento da unidade ao diagrama
  const handleAddEquipmentToDiagram = (equipmentId: string) => {
    const equipamento = availableEquipments.find(eq => eq.id === equipmentId);
    if (!equipamento || !diagrama) return;

    console.log('➕ [DiagramV2] Adicionando equipamento ao diagrama:', equipamento);

    // Extrair tipo do equipamento
    const tipoEquipamento = equipamento.tipo_equipamento || equipamento.tipoEquipamento?.codigo || 'EQUIPAMENTO';

    // Converter equipamento para formato Equipment
    const newEquipment: Equipment = {
      id: equipamento.id.trim(),
      nome: equipamento.nome,
      tag: equipamento.tag || '',
      tipo: tipoEquipamento,
      unidadeId: diagrama.unidadeId,
      diagramaId: diagrama.id,
      posicaoX: 0, // Centro do viewBox (0,0)
      posicaoY: 0, // Centro do viewBox (0,0)
      rotacao: 0,
      labelPosition: 'top',
      status: 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    addEquipamento(newEquipment);
    toast({
      title: 'Equipamento adicionado',
      description: `${equipamento.nome} foi adicionado ao diagrama`,
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+S para salvar
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }

    // Del para deletar selecionado (equipamentos ou conexões)
    if (e.key === 'Delete' || e.key === 'Del') {
      e.preventDefault();

      // Deletar equipamentos selecionados
      if (selectedIds.length > 0) {
        selectedIds.forEach(id => handleDeleteEquipment(id));
      }

      // Deletar conexões selecionadas
      if (selectedConnectionIds.length > 0) {
        selectedConnectionIds.forEach(id => removeConexao(id));
        toast({
          title: 'Conexão removida',
          description: `${selectedConnectionIds.length} conexão(ões) removida(s)`,
        });
      }

      clearSelection();
    }

    // Esc para limpar seleção
    if (e.key === 'Escape') {
      clearSelection();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Carregando diagrama...</p>
        </div>
      </div>
    );
  }

  // Estado vazio / erro 404 - permitir criar diagrama
  if (error && errorType === 'not_found') {
    return (
      <>
        <div className="w-full h-full flex items-center justify-center bg-white dark:bg-black">
          <div className="flex flex-col items-center text-center max-w-md px-4">
            <div className="mb-4 text-muted-foreground">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-40"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Diagrama não encontrado</h3>
            <p className="text-muted-foreground mb-1">Esta unidade ainda não possui um diagrama unifilar.</p>
            {isAdmin() ? (
              <p className="text-sm text-muted-foreground mb-6">Crie um novo diagrama para começar a adicionar equipamentos e conexões.</p>
            ) : (
              <p className="text-sm text-muted-foreground mb-6">Entre em contato com um administrador para criar o diagrama.</p>
            )}

            {isAdmin() && (
              <Button
                onClick={() => setShowCreateModal(true)}
                size="lg"
                className="mt-6"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Criar Novo Diagrama
              </Button>
            )}
          </div>
        </div>

        {/* Modal de criação */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Diagrama</DialogTitle>
              <DialogDescription>
                Preencha as informações abaixo para criar um novo diagrama unifilar para esta unidade.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome do Diagrama *</Label>
                <Input
                  id="nome"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Diagrama Unifilar"
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Textarea
                  id="descricao"
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder="Descreva o propósito ou detalhes deste diagrama..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateDiagrama}
                disabled={isCreating || !formNome.trim()}
              >
                {isCreating ? 'Criando...' : 'Criar Diagrama'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Erro genérico
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-black">
        <div className="flex flex-col items-center text-center max-w-md px-4">
          <div className="mb-4 text-destructive">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar diagrama</h3>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => loadDiagrama(diagramaId)} variant="outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!diagrama) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-black">
        <p className="text-muted-foreground">Nenhum diagrama carregado</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Toolbar superior */}
      <div className="flex justify-between items-center px-5 py-2 bg-muted/30 border-b min-h-[56px]">
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-foreground tracking-tight">{diagrama.nome}</h2>
          {diagrama.descricao && (
            <p className="text-xs text-muted-foreground mt-0.5">{diagrama.descricao}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de ajustar zoom */}
          <Button
            onClick={fitToContent}
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            title="Ajustar zoom para mostrar todo o diagrama"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
              <path d="M11 8v6"></path>
              <path d="M8 11h6"></path>
            </svg>
            <span>Ajustar Zoom</span>
          </Button>

          {/* Toggle Edit/View Mode - Apenas para admin ou super_admin */}
          {isAdmin() && (
            <Button
              onClick={() => setCurrentMode(currentMode === 'edit' ? 'view' : 'edit')}
              variant={currentMode === 'edit' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-2"
              title={currentMode === 'view' ? 'Ativar modo de edição' : 'Sair do modo de edição'}
            >
              {currentMode === 'view' ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  <span>Editar</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l-6 6v3h3l6-6m0 0l3-3m-3 3l3-3m2-5l-3 3m0 0l-3-3"></path>
                    <line x1="18" y1="13" x2="6" y2="1"></line>
                  </svg>
                  <span>Sair da Edição</span>
                </>
              )}
            </Button>
          )}

          {/* Indicador de alterações não salvas */}
          {isDirty && (
            <div className="w-2 h-2 rounded-full bg-orange-500" title="Alterações não salvas" />
          )}

          {/* Botão de salvar */}
          {currentMode === 'edit' && (
            <Button
              onClick={handleSave}
              variant="default"
              size="sm"
              className="h-8 gap-2"
              disabled={!isDirty}
              title="Salvar layout (Ctrl+S)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              <span>Salvar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Container principal com sidebar (se modo edição) */}
      <div className="flex-1 flex relative" style={{ overflow: 'visible' }}>
        {/* Viewport com diagrama */}
        <DiagramViewport onBackgroundClick={onBackgroundClick}>
          {/* Camada 1: Conexões (atrás dos equipamentos) */}
          <DiagramConnections
            visualConnections={visualConnections}
            barramentos={barramentos}
          />

          {/* Camada 2: Equipamentos */}
          <g className="equipment-layer">
            {equipamentos.map(equipment => (
              <EquipmentNode
                key={equipment.id}
                equipment={equipment}
                onClick={currentMode === 'view' && onEquipmentClick ? () => onEquipmentClick(equipment) : undefined}
                onDoubleClick={currentMode === 'edit' ? () => handleEditEquipment(equipment) : undefined}
              />
            ))}
          </g>
        </DiagramViewport>

        {/* Sidebar de edição (apenas em modo edit) */}
        {currentMode === 'edit' && (
          <EditorSidebar
            onCreateEquipment={() => {
              if (!diagrama?.unidadeId) {
                toast({
                  title: 'Erro',
                  description: 'Diagrama não carregado corretamente. Tente recarregar a página.',
                  variant: 'destructive',
                });
                return;
              }
              setShowCreateEquipmentModal(true);
            }}
            onEditEquipment={handleEditEquipment}
            onDeleteEquipment={handleDeleteEquipment}
            availableEquipments={availableEquipments}
            onAddEquipmentToDiagram={handleAddEquipmentToDiagram}
          />
        )}
      </div>

      {/* Modal de criar equipamento rápido */}
      {diagrama?.unidadeId && (
        <ModalCriarEquipamentoRapido
          open={showCreateEquipmentModal}
          onClose={() => setShowCreateEquipmentModal(false)}
          onEquipamentoCriado={handleEquipamentoCriado}
          unidadeId={diagrama.unidadeId}
        />
      )}

      {/* Modal de edição de equipamento */}
      <EquipmentEditModal
        equipment={editingEquipment}
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingEquipment(null);
        }}
        onSave={handleSaveEquipmentEdit}
      />
    </div>
  );
};
