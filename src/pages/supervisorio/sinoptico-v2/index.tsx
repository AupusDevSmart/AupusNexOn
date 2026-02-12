/**
 * SINÓPTICO ATIVO V2 - Página Refatorada
 *
 * Refatoração completa da página de diagrama unifilar:
 * - Arquitetura modular (componentes pequenos e focados)
 * - 100 linhas vs 4.911 linhas do legado (-98%)
 * - UI minimalista
 * - Modals centralizados
 *
 * @author Claude Code
 * @version 2.0.0
 * @date 2026-02-02
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DiagramV2Wrapper } from '@/features/supervisorio/v2/DiagramV2Wrapper';
import { useDiagramStore } from '@/features/supervisorio/v2/hooks/useDiagramStore';
import { DiagramHeader } from './components/DiagramHeader';
import { EquipmentModals } from './components/EquipmentModals';
import { ModalSelecionarUnidade } from '@/components/supervisorio/ModalSelecionarUnidade';

/**
 * Página principal do Sinóptico V2
 *
 * Responsabilidades:
 * - Gerenciar roteamento (ativoId da URL)
 * - Gerenciar modal de equipamentos
 * - Fornecer handlers de salvar/voltar
 */
export function SinopticoAtivoV2Page() {
  const { ativoId: ativoIdRaw } = useParams<{ ativoId: string }>();
  const navigate = useNavigate();

  // Limpar espaços em branco do ID da URL (exatamente como no legado)
  const ativoId = ativoIdRaw?.trim();

  console.log('[SinopticoV2] Montou com ativoId:', ativoId);

  // Estado global do diagrama (Zustand)
  const diagrama = useDiagramStore(state => state.diagrama);
  const isDirty = useDiagramStore(state => state.isDirty);
  const saveLayout = useDiagramStore(state => state.saveLayout);

  // Estado local para modal de equipamento
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);

  // Estado para modal de seleção de unidade
  const [showUnitSelector, setShowUnitSelector] = useState(!ativoId);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  /**
   * Voltar para lista de diagramas
   * Confirma se houver alterações não salvas
   */
  const handleBack = () => {
    if (isDirty) {
      const confirm = window.confirm(
        'Há alterações não salvas. Deseja sair mesmo assim?'
      );
      if (!confirm) return;
    }

    navigate('/supervisorio');
  };

  /**
   * Salvar layout do diagrama
   */
  const handleSave = async () => {
    try {
      await saveLayout();
      alert('✅ Diagrama salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar diagrama:', error);
      alert('❌ Erro ao salvar diagrama');
    }
  };

  /**
   * Handler quando uma unidade é selecionada no modal
   */
  const handleSelectUnidade = (unidadeId: string, planta: any, unidade: any) => {
    console.log('[SinopticoV2] Unidade selecionada:', { unidadeId, planta, unidade });
    setShowUnitSelector(false);
    const targetPath = `/supervisorio/sinoptico-v2/${unidadeId}`;
    console.log('[SinopticoV2] Navegando para:', targetPath);
    navigate(targetPath);
  };

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  // Se não houver ativoId, mostrar modal de seleção
  if (!ativoId || showUnitSelector) {
    return (
      <>
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Diagrama Unifilar V2</h1>
            <p className="text-muted-foreground mb-4">
              Selecione uma unidade para visualizar o diagrama
            </p>
          </div>
        </div>

        <ModalSelecionarUnidade
          isOpen={showUnitSelector}
          onClose={() => navigate('/supervisorio')}
          onSelect={handleSelectUnidade}
        />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header Minimalista */}
      <DiagramHeader
        title={diagrama?.nome || 'Diagrama Unifilar'}
        subtitle={diagrama?.descricao}
        isDirty={isDirty}
        onBack={handleBack}
        onSave={handleSave}
      />

      {/* Canvas do Diagrama (Tela Cheia) */}
      <div className="flex-1 relative">
        <DiagramV2Wrapper
          diagramaId={ativoId}
          unidadeIdFromUrl={ativoId}
          modoEdicao={true}
          onComponenteClick={(componente) => setSelectedEquipmentId(componente.id)}
        />
      </div>

      {/* Modals de Equipamentos */}
      <EquipmentModals
        selectedEquipmentId={selectedEquipmentId}
        onClose={() => setSelectedEquipmentId(null)}
      />
    </div>
  );
}
