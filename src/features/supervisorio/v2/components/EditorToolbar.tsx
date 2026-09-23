/**
 * EDITOR TOOLBAR — segunda linha da barra do unifilar, só no modo edição.
 *
 * Espelha a barra de edição do Diagrama IoT (iot-diagram.tsx): "Modo" (Mover/Selecionar),
 * "Adicionar" (select agrupado), ações da seleção atual, contadores e atalhos.
 * Substitui o painel lateral (EditorSidebar), que listava todos os equipamentos do
 * diagrama — no unifilar isso é redundante: quem quer editar dá duplo-clique no
 * símbolo, quem quer apagar seleciona e aperta Del (ou usa "Excluir" aqui).
 *
 * Particularidade do unifilar: criar equipamento pede TAG e configuração (medição/SCS),
 * então escolher um tipo no "Adicionar" abre o cadastro já com o tipo preenchido; o
 * IoT, que não tem cadastro, adiciona direto no canvas.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Move, MousePointer2, Pencil, Trash2, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { equipamentosApi } from '@/services/equipamentos.services';
import { useDiagramStore } from '../hooks/useDiagramStore';
import type { Equipment } from '../types/diagram.types';

export interface AvailableEquipment {
  id: string;
  nome: string;
  tag?: string;
  fabricante?: string;
  tipo_equipamento?: string;
}

type TipoUnifilar = { id: string; codigo: string; nome: string; sigla: string | null };

interface EditorToolbarProps {
  /** Equipamentos já cadastrados na unidade (os que não estão no diagrama viram opção em "Adicionar"). */
  availableEquipments?: AvailableEquipment[];
  /** Abre o cadastro de equipamento novo com o tipo escolhido. */
  onCreateEquipment: (tipoId: string) => void;
  /** Coloca no diagrama um equipamento já cadastrado na unidade. */
  onAddEquipmentToDiagram?: (equipmentId: string) => void;
  onEditEquipment: (equipment: Equipment) => void;
  onDeleteSelected: (equipmentIds: string[]) => void;
}

const ATALHOS: Array<[string, string]> = [
  ['V / S', 'Ferramenta Mover / Selecionar'],
  ['Shift+clique', 'Selecionar vários'],
  ['Arraste (Selecionar)', 'Caixa de seleção'],
  ['Duplo-clique', 'Editar equipamento'],
  ['Del', 'Apagar seleção'],
  ['Ctrl+C / Ctrl+V', 'Copiar / colar (cria novos)'],
  ['Ctrl+Z', 'Desfazer última ação'],
  ['Ctrl+S', 'Salvar layout'],
  ['Scroll', 'Zoom'],
  ['Arraste (Mover)', 'Deslocar a tela'],
  ['Duplo-clique na linha', 'Apagar conexão'],
  ['Esc', 'Limpar seleção'],
];

const SELECT_CLASS =
  'h-8 px-3 py-1 text-sm border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[220px]';

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  availableEquipments = [],
  onCreateEquipment,
  onAddEquipmentToDiagram,
  onEditEquipment,
  onDeleteSelected,
}) => {
  const equipamentos = useDiagramStore(state => state.equipamentos);
  const visualConnections = useDiagramStore(state => state.visualConnections);
  const selectedIds = useDiagramStore(state => state.editor.selectedEquipmentIds);
  const toolMode = useDiagramStore(state => state.editor.toolMode);
  const setToolMode = useDiagramStore(state => state.setToolMode);

  // Tipos do unifilar (mesma lista do cadastro), carregados uma vez ao entrar na edição.
  const [tipos, setTipos] = useState<TipoUnifilar[]>([]);
  useEffect(() => {
    let vivo = true;
    equipamentosApi
      .tiposUnifilar()
      .then(t => {
        if (!vivo) return;
        const lista = Array.isArray(t) ? [...t] : [];
        lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setTipos(lista);
      })
      .catch(() => { if (vivo) setTipos([]); });
    return () => { vivo = false; };
  }, []);

  // Cadastrados na unidade e ainda fora do diagrama.
  const daUnidade = useMemo(() => {
    const noDiagrama = new Set(equipamentos.map(eq => eq.id.trim()));
    return availableEquipments.filter(eq => !noDiagrama.has(eq.id.trim()));
  }, [availableEquipments, equipamentos]);

  const selecionados = useMemo(
    () => equipamentos.filter(eq => selectedIds.includes(eq.id)),
    [equipamentos, selectedIds],
  );

  const handleAdd = (value: string) => {
    const sep = value.indexOf(':');
    if (sep < 0) return;
    const kind = value.slice(0, sep);
    const id = value.slice(sep + 1);
    if (kind === 'novo') onCreateEquipment(id);
    else if (kind === 'unidade') onAddEquipmentToDiagram?.(id);
  };

  const rotuloSelecao =
    selecionados.length === 1
      ? selecionados[0].tag || selecionados[0].nome
      : `${selecionados.length} selecionados`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 sm:px-5 py-2 border-b bg-background">
      {/* Modo (mesmos ícones e rótulos do IoT) */}
      <div className="flex items-center gap-2 border-r pr-4">
        <span className="text-sm font-medium">Modo:</span>
        <div className="flex gap-1">
          <Button
            variant={toolMode === 'move' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setToolMode('move')}
            className="flex items-center gap-1"
            title="Mover / navegar — arraste a tela pra deslocar (atalho: V)"
          >
            <Move className="h-4 w-4" />Mover
          </Button>
          <Button
            variant={toolMode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setToolMode('select')}
            className="flex items-center gap-1"
            title="Selecionar — arraste uma caixa pra pegar vários (atalho: S)"
          >
            <MousePointer2 className="h-4 w-4" />Selecionar
          </Button>
        </div>
      </div>

      {/* Adicionar (select agrupado, como no IoT) */}
      <div className="flex items-center gap-2 border-r pr-4">
        <span className="text-sm font-medium">Adicionar:</span>
        <select
          className={SELECT_CLASS}
          value=""
          onChange={e => handleAdd(e.target.value)}
          title="Novo equipamento (abre o cadastro com o tipo já escolhido) ou um já cadastrado na unidade"
        >
          <option value="" disabled>Selecione um equipamento</option>
          <optgroup label="Novo equipamento">
            {tipos.length === 0 && <option value="" disabled>Carregando tipos…</option>}
            {tipos.map(t => (
              <option key={t.id} value={`novo:${t.id}`}>
                {t.nome}{t.sigla ? ` (${t.sigla})` : ''}
              </option>
            ))}
          </optgroup>
          {daUnidade.length > 0 && (
            <optgroup label={`Já cadastrados na unidade (${daUnidade.length})`}>
              {daUnidade.map(eq => (
                <option key={eq.id} value={`unidade:${eq.id}`}>
                  {eq.nome}{eq.tag ? ` [${eq.tag}]` : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Seleção atual: editar / excluir */}
      {selecionados.length > 0 && (
        <div className="flex items-center gap-2 border-r pr-4">
          <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={rotuloSelecao}>
            {rotuloSelecao}
          </span>
          {selecionados.length === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditEquipment(selecionados[0])}
              className="flex items-center gap-1"
              title="Editar cadastro (ou duplo-clique no símbolo)"
            >
              <Pencil className="h-4 w-4" />Editar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDeleteSelected(selecionados.map(eq => eq.id))}
            className="flex items-center gap-1 text-destructive hover:text-destructive"
            title="Apagar da unidade e do diagrama (Del). Ctrl+Z desfaz."
          >
            <Trash2 className="h-4 w-4" />Excluir
          </Button>
        </div>
      )}

      {/* Contadores + atalhos */}
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:flex text-xs text-muted-foreground items-center gap-3">
          <span>Equipamentos: {equipamentos.length}</span>
          <span>Conexões: {visualConnections.length}</span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-1" title="Atalhos do teclado">
              <Keyboard className="h-4 w-4" />
              <span className="hidden sm:inline">Atalhos</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <div className="text-xs font-semibold text-foreground mb-2">Atalhos</div>
            <div className="flex flex-col gap-1.5">
              {ATALHOS.map(([tecla, acao]) => (
                <div key={tecla} className="flex items-center justify-between gap-3 text-xs">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] whitespace-nowrap">{tecla}</kbd>
                  <span className="text-muted-foreground text-right">{acao}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
