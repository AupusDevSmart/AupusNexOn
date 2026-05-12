/**
 * DIAGRAM V2 WRAPPER - Camada de Compatibilidade
 *
 * Este componente serve como ponte entre as páginas legadas e o novo DiagramV2.
 * Permite usar o DiagramV2 em páginas que ainda usam o formato antigo de props.
 *
 * Funcionalidades:
 * 1. Aceita props no formato legado (componentes[], onComponenteClick, etc)
 * 2. Converte para o formato V2 do store
 * 3. Permite carregar diagrama por ID (modo backend) ou por props (modo estático)
 *
 * Uso:
 * ```tsx
 * // Modo 1: Carregar do backend
 * <DiagramV2Wrapper diagramaId="cm123abc" modoEdicao={true} />
 *
 * // Modo 2: Dados estáticos (ex: MQTT)
 * <DiagramV2Wrapper
 *   componentes={componentesMQTT}
 *   onComponenteClick={handleClick}
 *   modoEdicao={false}
 * />
 * ```
 *
 * @author Claude Code
 * @version 2.0.0
 * @date 2026-02-02
 */

import React, { useEffect, useState } from 'react';
import { DiagramV2 } from './DiagramV2';
import { useDiagramStore } from './hooks/useDiagramStore';
import type { Equipment } from './types/diagram.types';
import { SinopticoGraficosV2 } from '../components/sinoptico-graficos-v2';
import { EquipamentoCommandModal } from './components/EquipamentoCommandModal';
import { EquipamentoAcionarModal } from './components/EquipamentoAcionarModal';
import { getCommandsForCategoria } from './utils/commandRegistry';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/config/api';

// ============================================================================
// TIPOS LEGADOS (Compatibilidade)
// ============================================================================

/**
 * Formato legado de componente usado nas páginas antigas
 */
interface LegacyComponente {
  id: string;
  tipo: string;
  nome: string;
  tag?: string;
  posicao: { x: number; y: number };
  status?: string;
  dados?: any;
  rotacao?: number;
  label_position?: string;
}

// ============================================================================
// PROPS DO WRAPPER
// ============================================================================

interface AvailableEquipment {
  id: string;
  nome: string;
  tag?: string;
  fabricante?: string;
  tipo_equipamento?: string;
  tipoEquipamento?: { codigo?: string };
}

interface DiagramV2WrapperProps {
  // ===== MODO 1: Carregar do Backend =====
  /**
   * ID do diagrama no banco (se fornecido, ignora `componentes`)
   * Carrega automaticamente via API
   */
  diagramaId?: string;

  /**
   * ID da unidade vindo da URL (fallback para gráficos quando diagrama não tem unidade_id)
   */
  unidadeIdFromUrl?: string;

  // ===== MODO 2: Dados Estáticos (Legado) =====
  /**
   * Componentes no formato legado (usado em páginas MQTT)
   * Apenas usado se `diagramaId` não for fornecido
   */
  componentes?: LegacyComponente[];

  // ===== PROPS COMUNS =====
  /**
   * Callback quando usuário clica em componente
   * (Compatibilidade com páginas legadas)
   */
  onComponenteClick?: (componente: any) => void;

  /**
   * Callback quando usuário clica no background (fora dos equipamentos)
   * Usado para desselecionar equipamentos
   */
  onBackgroundClick?: () => void;

  /**
   * Mostrar grid de fundo (padrão: true)
   */
  mostrarGrid?: boolean;

  /**
   * Habilitar modo de edição (padrão: false)
   */
  modoEdicao?: boolean;

  /**
   * Lista de equipamentos da unidade disponíveis para adicionar ao diagrama
   */
  availableEquipments?: AvailableEquipment[];
}

// ============================================================================
// COMPONENTE WRAPPER
// ============================================================================

export const DiagramV2Wrapper: React.FC<DiagramV2WrapperProps> = ({
  diagramaId,
  unidadeIdFromUrl,
  componentes,
  onComponenteClick,
  onBackgroundClick,
  mostrarGrid = true,
  modoEdicao = false,
  availableEquipments = [],
}) => {
  // Zustand store actions and state
  const clearDiagrama = useDiagramStore(state => state.clearDiagrama);
  const diagrama = useDiagramStore(state => state.diagrama);
  const equipamentos = useDiagramStore(state => state.equipamentos);
  const editorMode = useDiagramStore(state => state.editor.mode); // Detectar modo atual do editor

  // Estado local para equipamentos disponíveis
  const [equipamentosDisponiveis, setEquipamentosDisponiveis] = useState<AvailableEquipment[]>(availableEquipments);

  // Estado para mostrar/ocultar gráficos - SEMPRE começa OCULTO
  const [showGraficos, setShowGraficos] = useState(false);

  // Estado do modal de comando MQTT — abre ao clicar em equipamento cuja
  // categoria tem comandos registrados (ex: TON com botoes de rele/transistor).
  const [commandModalEquipment, setCommandModalEquipment] = useState<Equipment | null>(null);
  // Modal de acionamento de pontos (Fase C-3): aberto ao clicar em equipamento com automacao=true
  // que NAO eh uma TON (TONs caem no fluxo de comandos diretos via commandRegistry).
  const [acionarModalEquipment, setAcionarModalEquipment] = useState<Equipment | null>(null);

  // Buscar demanda contratada da unidade
  const { data: unidadeData } = useQuery({
    queryKey: ['unidade-demanda', diagrama?.unidadeId],
    queryFn: async () => {
      if (!diagrama?.unidadeId) return null;
      console.log('🔍 [DiagramV2Wrapper] Buscando unidade:', diagrama.unidadeId);
      const response = await api.get(`/unidades/${diagrama.unidadeId}`);
      console.log('🔍 [DiagramV2Wrapper] Response completa:', response.data);
      console.log('🔍 [DiagramV2Wrapper] response.data.data:', response.data?.data);
      console.log('🔍 [DiagramV2Wrapper] demanda_geracao:', response.data?.data?.demanda_geracao || response.data?.demanda_geracao);
      return response.data?.data || response.data;
    },
    enabled: !!diagrama?.unidadeId,
    refetchInterval: false,
    staleTime: 0, // ✅ Sempre buscar dados frescos
    gcTime: 0, // ✅ Não manter cache (cacheTime foi renomeado para gcTime em TanStack v5)
  });

  // Extrair demanda contratada (demandaGeracao em camelCase da API)
  const unidadeTyped = unidadeData as { demandaGeracao?: number | string } | null | undefined;
  const demandaContratada = unidadeTyped?.demandaGeracao ? parseFloat(unidadeTyped.demandaGeracao.toString()) : 2500;
  console.log('📊 [DiagramV2Wrapper] unidadeData:', unidadeData);
  console.log('📊 [DiagramV2Wrapper] Demanda final:', demandaContratada, '(demandaGeracao:', unidadeTyped?.demandaGeracao, ')');

  const setEquipamentos = (equipamentos: Equipment[]) => {
    const store = useDiagramStore.getState();
    store.clearDiagrama();
    equipamentos.forEach(eq => store.addEquipamento(eq));
  };

  // =========================================================================
  // CARREGAR EQUIPAMENTOS DA UNIDADE (se não foram passados como prop)
  // =========================================================================

  useEffect(() => {
    if (diagramaId && availableEquipments.length === 0 && diagrama?.unidadeId) {
      console.log('[DiagramV2Wrapper] Loading equipamentos da unidade:', diagrama.unidadeId);

      const loadEquipments = async () => {
        try {
          const { equipamentosApi } = await import('@/services/equipamentos.services');
          const equipamentosResponse = await equipamentosApi.findByUnidade(diagrama.unidadeId, {
            limit: 1000,
          });

          const equipamentos = equipamentosResponse.data;

          console.log('[DiagramV2Wrapper] Equipamentos carregados:', equipamentos.length);

          setEquipamentosDisponiveis(equipamentos);
        } catch (error) {
          console.error('[DiagramV2Wrapper] Error loading equipamentos:', error);
        }
      };

      loadEquipments();
    } else if (availableEquipments.length > 0) {
      // Se foram passados como prop, usar eles
      setEquipamentosDisponiveis(availableEquipments);
    }
  }, [diagramaId, diagrama?.unidadeId, availableEquipments]);

  // =========================================================================
  // MODO 2: Dados Estáticos (Componentes Passados por Props)
  // =========================================================================

  useEffect(() => {
    // Se diagramaId foi fornecido, DiagramV2 carrega automaticamente
    // Então só precisamos processar componentes estáticos
    if (!diagramaId && componentes && componentes.length > 0) {
      console.log('[DiagramV2Wrapper] Loading static components:', componentes.length);

      // Limpar estado anterior
      clearDiagrama();

      // Converter formato legado para V2
      const equipamentos: Equipment[] = componentes.map(comp => ({
        id: comp.id,
        nome: comp.nome,
        tag: comp.tag || comp.nome,
        tipo: comp.tipo.toUpperCase(), // Normalizar tipo
        unidadeId: 'static', // Mock para modo estático
        diagramaId: 'static-diagram',
        posicaoX: comp.posicao.x,
        posicaoY: comp.posicao.y,
        rotacao: comp.rotacao || 0,
        labelPosition: (comp.label_position as any) || 'top',
        status: (comp.status?.toLowerCase() || 'normal') as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }));

      // Criar diagrama fake no store primeiro
      const diagramaFake = {
        id: 'static-diagram',
        unidadeId: 'static',
        nome: 'Diagrama Estático',
        descricao: 'Carregado de dados legados',
        equipamentos: equipamentos,
        conexoes: [],
        grupos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Setar diagrama e equipamentos no store
      useDiagramStore.setState({
        diagrama: diagramaFake,
        equipamentos: equipamentos,
        conexoes: [],
        grupos: [],
        visualConnections: [],
        barramentos: [],
        isLoading: false,
        error: null,
        errorType: null,
        isDirty: false,
      });

      // Auto-fit após carregar componentes estáticos
      setTimeout(() => {
        useDiagramStore.getState().fitToContent();
      }, 500);
    }
  }, [diagramaId, componentes, clearDiagrama]);

  // =========================================================================
  // CALLBACK: onComponenteClick (compatibilidade legado)
  // =========================================================================

  useEffect(() => {
    if (!onComponenteClick) return;

    let previousSelectedIds: string[] = [];

    // Assinar mudanças no store
    const unsubscribe = useDiagramStore.subscribe((state) => {
      const selectedIds = state.editor.selectedEquipmentIds;

      // Verificar se houve mudança na seleção
      if (JSON.stringify(selectedIds) !== JSON.stringify(previousSelectedIds)) {
        previousSelectedIds = [...selectedIds];

        // Quando um equipamento é selecionado em modo VIEW, chamar callback
        if (state.editor.mode === 'view' && selectedIds.length > 0) {
          const selectedId = selectedIds[0]; // Pegar primeiro selecionado
          const equipment = state.equipamentos.find(eq => eq.id === selectedId);

          if (equipment) {
            // Converter para formato legado
            const legacyComponente = {
              id: equipment.id,
              nome: equipment.nome,
              tag: equipment.tag,
              tipo: equipment.tipo,
              posicao: {
                x: equipment.posicaoX,
                y: equipment.posicaoY,
              },
              status: equipment.status,
            };

            onComponenteClick(legacyComponente);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [onComponenteClick]);

  // =========================================================================
  // LIMPAR AO DESMONTAR
  // =========================================================================

  useEffect(() => {
    return () => {
      // Limpar store ao desmontar componente
      clearDiagrama();
    };
  }, [clearDiagrama]);

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================

  // Se não tem diagramaId NEM componentes estáticos NEM unidadeId, mostrar loading
  // IMPORTANTE: Se tem unidadeIdFromUrl, deixar o DiagramV2 tentar carregar (pode detectar 404)
  if (!diagramaId && !unidadeIdFromUrl && (!componentes || componentes.length === 0)) {
    return (
      <div className="diagram-v2-wrapper" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <p>Carregando diagrama...</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Aguardando dados do diagrama</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LÓGICA DE VISIBILIDADE DOS GRÁFICOS (copiada do legado)
  // =========================================================================

  // Obter unidadeId dos equipamentos (todos devem ter o mesmo unidadeId)
  const unidadeIdDosEquipamentos = equipamentos.find(e => e.unidadeId)?.unidadeId;

  // Usar em ordem de prioridade: unidadeId do diagrama, dos equipamentos, da URL, ou diagramaId
  // IMPORTANTE: Remover espaços em branco com trim() para evitar erros 404
  const unidadeIdParaGraficos = (
    diagrama?.unidadeId ||
    unidadeIdDosEquipamentos ||
    unidadeIdFromUrl ||
    diagramaId
  )?.trim();

  // Verificar se há pelo menos um gráfico visível para adaptar layout
  // IMPORTANTE: Verificar equipamentos DA UNIDADE (equipamentosDisponiveis), não apenas os do diagrama
  // porque os gráficos mostram dados de TODA a unidade, não apenas do diagrama
  const temGraficosVisiveis = unidadeIdParaGraficos && (
    equipamentosDisponiveis.some((e: any) => e.mqtt_habilitado) || // Tem equipamentos para demanda
    equipamentosDisponiveis.some((e: any) => e.tipo_equipamento_rel?.codigo?.includes('M160') || e.tipoEquipamento?.codigo?.includes('M160') || e.tipo_equipamento?.includes('M160')) // Tem M160 para tensão/FP
  );

  // Log removido - poluição visual

  // Verificar se está em modo edição (prop OU estado interno do editor)
  const isEditMode = modoEdicao || editorMode === 'edit';

  return (
    <div className="diagram-v2-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Botão Toggle Gráficos - Posicionado no canto inferior direito, acima dos controles de zoom */}
      {/* NUNCA mostrar gráficos em modo de edição */}
      {temGraficosVisiveis && !isEditMode && (
        <div style={{ position: 'absolute', bottom: '5.5rem', right: '1.5rem', zIndex: 10 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGraficos(!showGraficos)}
            className="gap-2 bg-background/95 backdrop-blur-sm shadow-lg border-2"
          >
            <BarChart3 className="h-4 w-4" />
            {showGraficos ? 'Ocultar Gráficos' : 'Mostrar Gráficos'}
          </Button>
        </div>
      )}

      {/* Layout com Grid Responsivo - Removido overflow-hidden para permitir scroll */}
      <div className={`grid grid-cols-1 ${showGraficos && !isEditMode ? 'xl:grid-cols-3' : ''} gap-4 h-full`}>
        {/* Gráficos - Painel Lateral (1/3 da largura em telas grandes) - Com scroll próprio */}
        {/* NUNCA mostrar gráficos em modo de edição */}
        {showGraficos && !isEditMode && (
          <div className="xl:col-span-1 flex flex-col gap-4 overflow-y-auto overflow-x-hidden pr-2" style={{ maxHeight: '100%' }}>
            <SinopticoGraficosV2
              unidadeId={unidadeIdParaGraficos}
              valorContratado={demandaContratada}
              percentualAdicional={5}
            />
          </div>
        )}

        {/* Diagrama - Ocupa o restante do espaço */}
        <div className={`${showGraficos ? 'xl:col-span-2' : ''} flex`} style={{ minHeight: 0, position: 'relative' }}>
          <DiagramV2
            diagramaId={diagramaId || unidadeIdFromUrl || 'static-diagram'}
            mode={modoEdicao ? 'edit' : 'view'}
            availableEquipments={equipamentosDisponiveis}
            onBackgroundClick={onBackgroundClick}
            onEquipmentClick={(equipment) => {
              // Categorias com comandos registrados (ex: TON) abrem o modal
              // de comando MQTT em vez do callback legado. Isso evita
              // sobreposicao com o modal de detalhes/CRUD do equipamento.
              if (
                !modoEdicao &&
                getCommandsForCategoria(equipment.categoria, equipment.tipo) !== null
              ) {
                setCommandModalEquipment(equipment);
                return;
              }

              // Equipamentos com automacao=true (nao-TON) abrem modal de acionamento
              // de pontos. Resolve mapeamento ton_bo no backend pra executar pulso.
              if (!modoEdicao && equipment.automacao === true) {
                setAcionarModalEquipment(equipment);
                return;
              }

              // Caso contrario, segue o fluxo legado (callback opcional).
              if (!onComponenteClick) return;
              const legacyComponente = {
                id: equipment.id,
                nome: equipment.nome,
                tag: equipment.tag,
                tipo: equipment.tipo,
                posicao: { x: equipment.posicaoX, y: equipment.posicaoY },
                status: equipment.status,
                dados: (equipment as unknown as { dados?: Record<string, unknown> }).dados,
              };
              onComponenteClick(legacyComponente);
            }}
          />
        </div>
      </div>

      {commandModalEquipment && (
        <EquipamentoCommandModal
          open={true}
          onClose={() => setCommandModalEquipment(null)}
          equipamento={{
            id: commandModalEquipment.id,
            nome: commandModalEquipment.nome,
            topico_mqtt: commandModalEquipment.topicoMqtt ?? null,
            categoria: commandModalEquipment.categoria ?? null,
          }}
        />
      )}

      {acionarModalEquipment && (
        <EquipamentoAcionarModal
          open={true}
          onClose={() => setAcionarModalEquipment(null)}
          equipamento={{
            id: acionarModalEquipment.id,
            nome: acionarModalEquipment.nome,
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default DiagramV2Wrapper;
