/**
 * EDITOR SIDEBAR - Barra lateral com ferramentas de edição
 *
 * Funcionalidades:
 * - Botão criar equipamento rápido (abre modal com categoria/modelo)
 * - Lista de equipamentos com ações (editar/deletar)
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { useDiagramStore } from '../hooks/useDiagramStore';
import type { Equipment } from '../types/diagram.types';

interface AvailableEquipment {
  id: string;
  nome: string;
  tag?: string;
  fabricante?: string;
  tipo_equipamento?: string;
}

interface EditorSidebarProps {
  onCreateEquipment: () => void; // Abre modal de criar rápido
  onEditEquipment: (equipment: Equipment) => void;
  onDeleteEquipment: (equipmentId: string) => void;
  availableEquipments?: AvailableEquipment[]; // Equipamentos da unidade disponíveis para adicionar
  onAddEquipmentToDiagram?: (equipmentId: string) => void; // Callback para adicionar equipamento ao diagrama
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  onCreateEquipment,
  onEditEquipment,
  onDeleteEquipment,
  availableEquipments = [],
  onAddEquipmentToDiagram,
}) => {
  const equipamentos = useDiagramStore(state => state.equipamentos);
  const selectedIds = useDiagramStore(state => state.editor.selectedEquipmentIds);

  // Filtrar equipamentos da unidade que NÃO estão no diagrama
  const equipamentosDisponiveis = React.useMemo(() => {
    // Criar Set com IDs normalizados (trim) dos equipamentos no diagrama
    const idsNoDiagrama = new Set(equipamentos.map(eq => eq.id.trim()));

    // Filtrar disponíveis que NÃO estão no diagrama
    const filtered = availableEquipments.filter(
      available => !idsNoDiagrama.has(available.id.trim())
    );

    return filtered;
  }, [availableEquipments, equipamentos]);

  return (
    <div className="w-60 border-l bg-background flex-shrink-0 flex flex-col overflow-hidden">
      {/* Seção: Adicionar Equipamento */}
      <div className="px-4 py-3 border-b">
        <h3 className="text-xs font-semibold text-foreground mb-2">Adicionar Equipamento</h3>

        <Button
          onClick={onCreateEquipment}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9"
          size="sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Novo Equipamento
        </Button>

        <p className="text-xs text-muted-foreground mt-2">
          Cria um equipamento com categoria e modelo.
        </p>
      </div>

      {/* NOVA SEÇÃO: Equipamentos disponíveis para adicionar */}
      {equipamentosDisponiveis.length > 0 && (
        <div className="px-4 py-3 border-b">
          <h3 className="text-xs font-semibold text-foreground mb-1">
            Equipamentos da Unidade ({equipamentosDisponiveis.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Clique para adicionar ao diagrama
          </p>

          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {equipamentosDisponiveis.map(eq => (
              <div
                key={eq.id}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors"
                onClick={() => onAddEquipmentToDiagram?.(eq.id)}
                title={`Clique para adicionar ${eq.nome} ao diagrama`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground truncate">{eq.nome}</span>
                  {eq.tag && <span className="text-xs text-muted-foreground truncate">[{eq.tag}]</span>}
                  {eq.fabricante && (
                    <span className="text-xs text-muted-foreground truncate">{eq.fabricante}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Adicionar ao diagrama"
                  className="h-7 w-7 p-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEquipmentToDiagram?.(eq.id);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção: No Diagrama */}
      <div className="px-4 py-3 border-b flex-1 overflow-hidden flex flex-col">
        <h3 className="text-xs font-semibold text-foreground mb-2">
          No Diagrama ({equipamentos.length})
        </h3>

        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
          {equipamentos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum equipamento adicionado
            </p>
          ) : (
            equipamentos.map(eq => (
              <div
                key={eq.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded transition-colors ${
                  selectedIds.includes(eq.id) ? 'bg-accent border border-primary' : 'hover:bg-accent/50'
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground truncate">{eq.nome}</span>
                  <span className="text-xs text-muted-foreground truncate">{eq.tag}</span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditEquipment(eq)}
                    title="Editar"
                    className="h-7 w-7 p-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEquipment(eq.id)}
                    title="Deletar"
                    className="h-7 w-7 p-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="m19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Seção: Atalhos */}
      <div className="px-4 py-3 border-t">
        <h3 className="text-xs font-semibold text-foreground mb-2">Atalhos</h3>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Del</kbd>
            <span className="text-muted-foreground ml-2">Deletar selecionado</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-[10px]">Duplo-click</kbd>
            <span className="text-muted-foreground ml-2">Deletar conexão</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+S</kbd>
            <span className="text-muted-foreground ml-2">Salvar layout</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Scroll</kbd>
            <span className="text-muted-foreground ml-2">Zoom in/out</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Arraste</kbd>
            <span className="text-muted-foreground ml-2">Mover viewport</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-[10px]">Duplo-click</kbd>
            <span className="text-muted-foreground ml-2">Editar equipamento</span>
          </div>
        </div>
      </div>
    </div>
  );
};
