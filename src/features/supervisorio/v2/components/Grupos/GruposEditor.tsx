/**
 * Barra de edição do unifilar — agrupamentos (NEXON-31).
 *
 * - AgruparSelecao: com 2+ equipamentos selecionados, dá nome e cria o grupo
 *   (ou põe num grupo existente); tira do grupo quem já está em um.
 * - GruposLista: todos os grupos do diagrama — renomear, ver os membros, desfazer.
 */

import React, { useMemo, useState } from 'react';
import { Group, Layers, Trash2, Ungroup, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useDiagramStore } from '../../hooks/useDiagramStore';
import { COR_GRUPO_PADRAO } from './GrupoNode';

export const AgruparSelecao: React.FC<{ selecionadosIds: string[] }> = ({ selecionadosIds }) => {
  const grupos = useDiagramStore(st => st.grupos);
  const equipamentos = useDiagramStore(st => st.equipamentos);
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');

  // JP não entra em grupo (some sozinho junto com o grupo)
  const ids = useMemo(() => {
    const jp = new Set(equipamentos.filter(e => e.tipo === 'JUNCTION_POINT').map(e => e.id));
    return selecionadosIds.filter(id => !jp.has(id));
  }, [selecionadosIds, equipamentos]);

  const emGrupo = useMemo(
    () => ids.filter(id => grupos.some(g => g.equipamentoIds.includes(id))),
    [ids, grupos],
  );

  if (ids.length === 0) return null;

  const criar = () => {
    const st = useDiagramStore.getState();
    const nomeFinal = nome.trim() || `Grupo ${grupos.length + 1}`;
    const id = st.criarGrupo(nomeFinal, ids);
    if (!id) return;
    st.clearSelection();
    setAberto(false);
    setNome('');
    toast({ title: 'Grupo criado', description: `"${nomeFinal}" com ${ids.length} equipamento(s). Salve para manter.` });
  };

  const colocarEm = (grupoId: string, grupoNome: string) => {
    useDiagramStore.getState().adicionarAoGrupo(grupoId, ids);
    useDiagramStore.getState().clearSelection();
    setAberto(false);
    toast({ title: 'Adicionado ao grupo', description: `${ids.length} equipamento(s) em "${grupoNome}". Salve para manter.` });
  };

  return (
    <>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            title="Juntar a seleção num grupo com nome (Ctrl+G)"
            disabled={ids.length < 1}
          >
            <Group className="h-4 w-4" />Agrupar
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="text-xs font-semibold text-foreground mb-2">Novo grupo com {ids.length} equipamento(s)</div>
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              criar();
            }}
          >
            <Input
              autoFocus
              value={nome}
              maxLength={80}
              onChange={e => setNome(e.target.value)}
              placeholder={`Grupo ${grupos.length + 1}`}
              className="h-8"
            />
            <Button type="submit" size="sm" className="h-8">Criar</Button>
          </form>
          {grupos.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mt-3 mb-1.5">ou colocar num grupo que já existe</div>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {grupos.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => colocarEm(g.id, g.nome)}
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.cor || COR_GRUPO_PADRAO }} />
                      <span className="truncate">{g.nome}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{g.equipamentoIds.length}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
      {emGrupo.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          title="Tirar a seleção do grupo (continua no diagrama)"
          onClick={() => {
            useDiagramStore.getState().tirarDoGrupo(emGrupo);
            toast({ title: 'Fora do grupo', description: `${emGrupo.length} equipamento(s) saíram do grupo. Salve para manter.` });
          }}
        >
          <Ungroup className="h-4 w-4" />Tirar do grupo
        </Button>
      )}
    </>
  );
};

export const GruposLista: React.FC = () => {
  const grupos = useDiagramStore(st => st.grupos);
  const abertos = useDiagramStore(st => st.gruposAbertos);
  const { toast } = useToast();
  const [editando, setEditando] = useState<Record<string, string>>({});

  if (grupos.length === 0) return null;

  const salvarNome = (id: string) => {
    const novo = editando[id];
    if (novo === undefined) return;
    useDiagramStore.getState().renomearGrupo(id, novo);
    setEditando(({ [id]: _, ...resto }) => resto);
  };

  const verMembros = (id: string) => {
    const st = useDiagramStore.getState();
    const g = st.grupos.find(x => x.id === id);
    if (!g) return;
    if (!st.gruposAbertos.includes(id)) st.alternarGrupo(id);
    useDiagramStore.setState(s => ({
      editor: { ...s.editor, selectedEquipmentIds: [...g.equipamentoIds], selectedConnectionIds: [] },
    }));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-1" title="Grupos do diagrama">
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Grupos ({grupos.length})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="text-xs font-semibold text-foreground mb-1">Grupos</div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Recolhido vira um bloco só; arraste o bloco para organizar. Clique no bloco para abrir.
        </p>
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {grupos.map(g => (
            <div key={g.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.cor || COR_GRUPO_PADRAO }} />
              <Input
                value={editando[g.id] ?? g.nome}
                maxLength={80}
                onChange={e => setEditando(s => ({ ...s, [g.id]: e.target.value }))}
                onBlur={() => salvarNome(g.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="h-7 text-sm"
                title="Renomear"
              />
              <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{g.equipamentoIds.length}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={abertos.includes(g.id) ? 'Ver membros (já aberto)' : 'Abrir e selecionar os membros'}
                onClick={() => verMembros(g.id)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                title="Desfazer o grupo (os equipamentos continuam no diagrama)"
                onClick={() => {
                  useDiagramStore.getState().desfazerGrupo(g.id);
                  toast({ title: 'Grupo desfeito', description: `"${g.nome}" desfeito. Salve para manter.` });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
