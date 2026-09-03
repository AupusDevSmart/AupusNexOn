import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Trash2,
  UserPlus,
  AlertCircle,
  Loader2,
  Search,
  Plus,
  Undo2,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { useHttpClient } from '@/core/context/hooks';

interface PlantaOperadoresTabProps {
  /** Em CREATE mode passar `null` — flush(plantaId) recebera o id criado depois. */
  plantaId: string | null;
  readOnly?: boolean;
}

interface VinculoOperador {
  id: string;
  planta_id: string;
  usuario_id: string;
  created_at: string;
  usuario: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    is_active: boolean;
    status: string | null;
  };
}

interface UsuarioBusca {
  id: string;
  nome: string;
  email: string | null;
}

export interface PlantaOperadoresTabHandle {
  /** Aplica as mudancas pendentes no backend. Chamar depois do save da planta.  */
  flush: (targetPlantaId: string) => Promise<void>;
  hasPendingChanges: () => boolean;
}

export const PlantaOperadoresTab = forwardRef<
  PlantaOperadoresTabHandle,
  PlantaOperadoresTabProps
>(function PlantaOperadoresTab({ plantaId, readOnly = false }, ref) {
  const httpClient = useHttpClient();

  // Vinculos vindos do backend (snapshot original quando o modal abriu).
  const [vinculosOriginais, setVinculosOriginais] = useState<VinculoOperador[]>([]);
  // Buffer de mudancas locais — soh persistem no backend via flush().
  const [pendingAdds, setPendingAdds] = useState<UsuarioBusca[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [todosOperadores, setTodosOperadores] = useState<UsuarioBusca[]>([]);
  const [loadingOperadores, setLoadingOperadores] = useState(true);

  const isCreate = plantaId == null;

  const carregarVinculos = async () => {
    if (isCreate) {
      // Planta nova ainda nao existe — comeca vazio.
      setVinculosOriginais([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await httpClient.get(`/plantas/${plantaId!.trim()}/operadores`);
      const data = Array.isArray(resp.data) ? resp.data : resp.data?.data ?? [];
      setVinculosOriginais(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Erro ao carregar operadores vinculados');
    } finally {
      setLoading(false);
    }
  };

  const carregarOperadores = async () => {
    setLoadingOperadores(true);
    try {
      // Backend tem cap de limit=100. role=operador filtra direto.
      const resp = await httpClient.get('/usuarios', {
        params: { role: 'operador', limit: 100 },
      });
      // Backend retorna em formato aninhado variavel:
      //   { data: [...] }                  ou
      //   { data: { data: [...], pagination } }  ou
      //   [...]                            (raro)
      // Extracao tolerante:
      const payload: any = resp.data;
      let lista: any[] = [];
      if (Array.isArray(payload)) lista = payload;
      else if (Array.isArray(payload?.data)) lista = payload.data;
      else if (Array.isArray(payload?.data?.data)) lista = payload.data.data;
      setTodosOperadores(lista);
    } catch (err: any) {
      setTodosOperadores([]);
    } finally {
      setLoadingOperadores(false);
    }
  };

  useEffect(() => {
    carregarVinculos();
    if (!readOnly) carregarOperadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantaId, readOnly]);

  // Vinculos visiveis = (originais - pendingRemoves) ∪ pendingAdds.
  const vinculadosEfetivos = useMemo(() => {
    const restantes = vinculosOriginais.filter(
      (v) => !pendingRemoves.has(v.usuario_id.trim()),
    );
    const novos: VinculoOperador[] = pendingAdds.map((u) => ({
      id: `pending-${u.id}`,
      planta_id: plantaId ?? '',
      usuario_id: u.id,
      created_at: new Date().toISOString(),
      usuario: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        telefone: null,
        is_active: true,
        status: null,
      },
    }));
    return [...restantes, ...novos];
  }, [vinculosOriginais, pendingRemoves, pendingAdds, plantaId]);

  const idsVinculadosEfetivos = useMemo(
    () => new Set(vinculadosEfetivos.map((v) => v.usuario_id.trim())),
    [vinculadosEfetivos],
  );

  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todosOperadores
      .filter((u) => !idsVinculadosEfetivos.has(u.id.trim()))
      .filter((u) => {
        if (!termo) return true;
        return (
          u.nome.toLowerCase().includes(termo) ||
          (u.email?.toLowerCase().includes(termo) ?? false)
        );
      });
  }, [todosOperadores, idsVinculadosEfetivos, busca]);

  const isPendingAdd = (usuarioId: string) =>
    pendingAdds.some((u) => u.id.trim() === usuarioId.trim());

  const isPendingRemove = (usuarioId: string) =>
    pendingRemoves.has(usuarioId.trim());

  const hasPendingChanges = () => pendingAdds.length > 0 || pendingRemoves.size > 0;

  const adicionarLocal = (usuario: UsuarioBusca) => {
    setBusca('');
    setPendingAdds((prev) => [...prev, usuario]);
  };

  const removerLocal = (usuarioId: string) => {
    const trimmed = usuarioId.trim();
    // Caso 1: estava nas pendingAdds — soh desfaz o add.
    if (isPendingAdd(trimmed)) {
      setPendingAdds((prev) => prev.filter((u) => u.id.trim() !== trimmed));
      return;
    }
    // Caso 2: vinculo original — marca pra remover no flush.
    setPendingRemoves((prev) => {
      const next = new Set(prev);
      next.add(trimmed);
      return next;
    });
  };

  const desfazerRemover = (usuarioId: string) => {
    setPendingRemoves((prev) => {
      const next = new Set(prev);
      next.delete(usuarioId.trim());
      return next;
    });
  };

  useImperativeHandle(ref, () => ({
    hasPendingChanges,
    flush: async (targetPlantaId: string) => {
      const targetId = targetPlantaId.trim();
      // Adicionar pendentes.
      for (const u of pendingAdds) {
        await httpClient.post(`/plantas/${targetId}/operadores`, { usuario_id: u.id });
      }
      // Remover pendentes.
      for (const uid of pendingRemoves) {
        await httpClient.delete(`/plantas/${targetId}/operadores/${uid}`);
      }
      // Limpa buffer e recarrega se a planta ja existir (em CREATE, modal vai fechar).
      setPendingAdds([]);
      setPendingRemoves(new Set());
    },
  }), [pendingAdds, pendingRemoves]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Operadores vinculados</h3>
        <p className="text-xs text-muted-foreground">
          Usuarios com role &quot;operador&quot; vinculados a esta planta. Apenas plantas vinculadas aparecem para o operador no app.
          {hasPendingChanges() && !readOnly && (
            <span className="ml-1 text-amber-700 dark:text-amber-400 font-medium">
              · alteracoes pendentes (salvas no &quot;Salvar Alteracoes&quot;)
            </span>
          )}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md dark:bg-red-950 dark:border-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* VINCULADOS */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">
          Vinculados ({vinculadosEfetivos.length})
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : vinculadosEfetivos.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-2">
            Nenhum operador vinculado.
          </div>
        ) : (
          <ul className="border rounded-md divide-y">
            {vinculadosEfetivos.map((v) => {
              const pendingAdd = isPendingAdd(v.usuario_id);
              return (
                <li
                  key={v.id}
                  className={`px-3 py-2 flex items-center justify-between ${
                    pendingAdd ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {v.usuario.nome}
                      {pendingAdd && (
                        <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                          a adicionar
                        </span>
                      )}
                    </div>
                    {v.usuario.email && (
                      <div className="text-xs text-muted-foreground truncate">
                        {v.usuario.email}
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removerLocal(v.usuario_id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Items que vao ser removidos (visualmente exibidos com opcao de desfazer) */}
        {pendingRemoves.size > 0 && !readOnly && (
          <div className="mt-2 space-y-1">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
              A remover ({pendingRemoves.size})
            </div>
            <ul className="border border-amber-200 dark:border-amber-800 rounded-md divide-y divide-amber-200 dark:divide-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
              {Array.from(pendingRemoves).map((uid) => {
                const original = vinculosOriginais.find(
                  (v) => v.usuario_id.trim() === uid,
                );
                if (!original) return null;
                return (
                  <li
                    key={uid}
                    className="px-3 py-2 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate line-through opacity-75">
                        {original.usuario.nome}
                      </div>
                      {original.usuario.email && (
                        <div className="text-xs text-muted-foreground truncate line-through opacity-75">
                          {original.usuario.email}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => desfazerRemover(uid)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      title="Desfazer remocao"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* DISPONIVEIS */}
      {!readOnly && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Disponiveis ({disponiveis.length})
            </label>
            {loadingOperadores && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nome ou email..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              disabled={loadingOperadores}
              className="pl-8"
            />
          </div>
          <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
            {loadingOperadores ? (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando operadores...
              </div>
            ) : disponiveis.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {todosOperadores.length === 0
                  ? 'Nenhum usuario com role "operador" encontrado.'
                  : busca.trim()
                  ? 'Nenhum operador bate com o filtro.'
                  : 'Todos os operadores ja estao vinculados a esta planta.'}
              </div>
            ) : (
              disponiveis.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between text-sm"
                  onClick={() => adicionarLocal(u)}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.nome}</div>
                    {u.email && (
                      <div className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </div>
                    )}
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});
