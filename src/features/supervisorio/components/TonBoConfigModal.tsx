// src/features/supervisorio/components/TonBoConfigModal.tsx
// Modal de configuracao de BOs (Binary Outputs) de uma TON.
//
// Cada BO mapeia para um ponto de tipo='comando' de um equipamento da
// mesma unidade da TON. Salvo em ton_bo via REST. Backend ja retorna 6
// entradas (BO01..BO06) — placeholders (id='') sao POST ao primeiro save,
// existentes sao PATCH.
//
// Layout: minimalista, dark/light, sem emojis, profissional, responsivo.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { equipamentosApi } from '@/services/equipamentos.services';
import {
  equipamentoPontosApi,
  type EquipamentoPonto,
} from '@/services/equipamento-pontos.services';
import {
  PULSO_MS_DEFAULT,
  PULSO_MS_MIN,
  PULSO_MS_MAX,
  tonBoApi,
  type TonBo,
} from '@/services/ton-bo.services';

interface TonBoConfigModalProps {
  open: boolean;
  onClose: () => void;
  /** id do equipamento TON (alvo dos BOs). */
  tonId: string | null;
  /** id da unidade da TON — pra filtrar equipamentos disponiveis. */
  unidadeId: string | null;
  tonNome?: string;
}

interface EquipamentoOption {
  id: string;
  nome: string;
}

const SENTINEL_UNMAPPED = '__unmapped__';

export const TonBoConfigModal: React.FC<TonBoConfigModalProps> = ({
  open,
  onClose,
  tonId,
  unidadeId,
  tonNome,
}) => {
  const [loading, setLoading] = useState(false);
  const [savingBo, setSavingBo] = useState<number | null>(null);
  const [bos, setBos] = useState<TonBo[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [pontosByEquip, setPontosByEquip] = useState<
    Record<string, EquipamentoPonto[]>
  >({});
  // Selecao local de equipamento por BO (chave: bo_numero). Necessario porque o
  // backend so retorna `bo.ponto.equipamento_id` quando ja ha ponto mapeado — entre
  // "escolheu equipamento" e "escolheu ponto" precisamos lembrar a selecao localmente.
  const [equipSelecionadoPorBo, setEquipSelecionadoPorBo] = useState<
    Record<number, string>
  >({});

  // Carregamento inicial: BOs + equipamentos com automacao=true da unidade
  const carregar = useCallback(async () => {
    if (!tonId || !unidadeId) return;
    setLoading(true);
    try {
      const [bosResp, equipsResp] = await Promise.all([
        tonBoApi.list(tonId),
        // Backend limita `limit` a 100. Se a unidade tiver mais equipamentos
        // automatizados que isso, virar paginacao no futuro.
        equipamentosApi.findByUnidade(unidadeId, { limit: 100 }),
      ]);
      setBos(bosResp);
      // Reseta selecao local com base no estado vindo do backend (so BOs ja mapeados
      // tem equipamento_id no objeto ponto incluido)
      const inicial: Record<number, string> = {};
      for (const bo of bosResp) {
        const eid = bo.ponto?.equipamento_id?.trim();
        if (eid) inicial[bo.bo_numero] = eid;
      }
      setEquipSelecionadoPorBo(inicial);

      // Filtra so equipamentos com automacao=true (filtro client-side por simplicidade)
      const lista = (equipsResp.data ?? []).filter(
        (e: any) => e.automacao === true && !e.deleted_at,
      );
      setEquipamentos(
        lista.map((e: any) => ({
          id: (e.id || '').trim(),
          nome: e.nome,
        })),
      );

      // Pre-carrega pontos de cada equipamento ja mapeado
      const equipsJaMapeados = bosResp
        .map((b) => b.ponto?.equipamento_id?.trim())
        .filter((id): id is string => !!id);
      await Promise.all(
        Array.from(new Set(equipsJaMapeados)).map((eid) =>
          carregarPontos(eid).catch(() => undefined),
        ),
      );
    } catch (err) {
      toast.error('Falha ao carregar BOs/equipamentos', {
        description: extractMsg(err),
      });
    } finally {
      setLoading(false);
    }
  }, [tonId, unidadeId]);

  const carregarPontos = useCallback(async (equipamentoId: string) => {
    if (pontosByEquip[equipamentoId]) return;
    const pontos = await equipamentoPontosApi.list(equipamentoId);
    setPontosByEquip((prev) => ({
      ...prev,
      [equipamentoId]: pontos.filter((p) => p.tipo === 'comando' && p.ativo),
    }));
  }, [pontosByEquip]);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  // ---------------------------------------------------------------------
  // Salvar uma alteracao de um BO especifico
  // ---------------------------------------------------------------------
  const persistirBo = useCallback(
    async (
      bo: TonBo,
      patch: { equipamento_ponto_id?: string | null; pulso_ms?: number; ativo?: boolean },
    ): Promise<TonBo | null> => {
      if (!tonId) return null;
      setSavingBo(bo.bo_numero);
      try {
        const isPlaceholder = !bo.id;
        const atualizado = isPlaceholder
          ? await tonBoApi.create(tonId, {
              bo_numero: bo.bo_numero,
              pulso_ms: bo.pulso_ms,
              ativo: bo.ativo,
              ...patch,
            })
          : await tonBoApi.update(tonId, bo.id, patch);

        setBos((prev) =>
          prev.map((b) => (b.bo_numero === bo.bo_numero ? atualizado : b)),
        );
        return atualizado;
      } catch (err) {
        toast.error(`Falha ao salvar BO${bo.bo_numero}`, {
          description: extractMsg(err),
        });
        return null;
      } finally {
        setSavingBo(null);
      }
    },
    [tonId],
  );

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handleEquipamentoChange = useCallback(
    async (bo: TonBo, equipamentoId: string | null) => {
      // Atualiza selecao local imediatamente — sem isso o select "esquece"
      // a escolha entre o trigger e a chegada da resposta do backend.
      setEquipSelecionadoPorBo((prev) => {
        const next = { ...prev };
        if (equipamentoId) next[bo.bo_numero] = equipamentoId;
        else delete next[bo.bo_numero];
        return next;
      });

      if (equipamentoId) {
        try {
          await carregarPontos(equipamentoId);
        } catch (err) {
          toast.error('Falha ao carregar pontos do equipamento', {
            description: extractMsg(err),
          });
          return;
        }
      }

      // Se BO ja tinha ponto mapeado, desvincula (user precisa escolher novo ponto
      // do equipamento atual). Se nao tinha, nada a persistir ainda — espera ponto.
      if (bo.ponto) {
        await persistirBo(bo, { equipamento_ponto_id: null });
      }
    },
    [carregarPontos, persistirBo],
  );

  const handlePontoChange = useCallback(
    async (bo: TonBo, pontoId: string | null) => {
      await persistirBo(bo, { equipamento_ponto_id: pontoId });
    },
    [persistirBo],
  );

  const handlePulsoChange = useCallback(
    async (bo: TonBo, pulso: number) => {
      if (!Number.isFinite(pulso)) return;
      const sanitized = Math.max(PULSO_MS_MIN, Math.min(PULSO_MS_MAX, Math.round(pulso)));
      await persistirBo(bo, { pulso_ms: sanitized });
    },
    [persistirBo],
  );

  const handleAtivoToggle = useCallback(
    async (bo: TonBo) => {
      await persistirBo(bo, { ativo: !bo.ativo });
    },
    [persistirBo],
  );

  const handleClear = useCallback(
    async (bo: TonBo) => {
      if (!bo.id) return; // placeholder, nada a remover
      await persistirBo(bo, { equipamento_ponto_id: null });
    },
    [persistirBo],
  );

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tonNome ?? 'TON'} · Configuracao de BOs</DialogTitle>
          <DialogDescription className="text-xs">
            Mapeie cada Binary Output (relé) a um ponto de comando de
            equipamentos com automacao habilitada na unidade. O pulso eh
            executado pelo backend ({PULSO_MS_DEFAULT}ms padrao).
          </DialogDescription>
        </DialogHeader>

        {loading && bos.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : (
          <div className="space-y-2">
            {bos.map((bo) => (
              <BoCard
                key={bo.bo_numero}
                bo={bo}
                equipamentoSelecionado={equipSelecionadoPorBo[bo.bo_numero] ?? null}
                saving={savingBo === bo.bo_numero}
                equipamentos={equipamentos}
                pontosByEquip={pontosByEquip}
                onEquipamentoChange={(eid) => handleEquipamentoChange(bo, eid)}
                onPontoChange={(pid) => handlePontoChange(bo, pid)}
                onPulsoChange={(ms) => handlePulsoChange(bo, ms)}
                onAtivoToggle={() => handleAtivoToggle(bo)}
                onClear={() => handleClear(bo)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// BoCard — uma linha do grid (1 BO)
// ============================================================================

interface BoCardProps {
  bo: TonBo;
  /** Equipamento selecionado localmente (sobrevive entre escolher equipamento e escolher ponto). */
  equipamentoSelecionado: string | null;
  saving: boolean;
  equipamentos: EquipamentoOption[];
  pontosByEquip: Record<string, EquipamentoPonto[]>;
  onEquipamentoChange: (equipamentoId: string | null) => void;
  onPontoChange: (pontoId: string | null) => void;
  onPulsoChange: (ms: number) => void;
  onAtivoToggle: () => void;
  onClear: () => void;
}

const BoCard: React.FC<BoCardProps> = ({
  bo,
  equipamentoSelecionado,
  saving,
  equipamentos,
  pontosByEquip,
  onEquipamentoChange,
  onPontoChange,
  onPulsoChange,
  onAtivoToggle,
  onClear,
}) => {
  // Prioridade: selecao local (durante edicao) > equipamento do ponto persistido.
  const equipAtual = (equipamentoSelecionado ?? bo.ponto?.equipamento_id ?? '').trim();
  const pontoAtual = bo.equipamento_ponto_id ?? '';
  const pontosOpcoes = useMemo(
    () => (equipAtual ? pontosByEquip[equipAtual] ?? [] : []),
    [equipAtual, pontosByEquip],
  );
  const [pulsoLocal, setPulsoLocal] = useState<string>(String(bo.pulso_ms));

  // Sincroniza input local quando backend retorna novo valor
  useEffect(() => {
    setPulsoLocal(String(bo.pulso_ms));
  }, [bo.pulso_ms]);

  const isMapped = !!bo.ponto;

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* Label BO */}
        <div className="col-span-12 sm:col-span-1 flex sm:flex-col items-center sm:items-start gap-1">
          <span className="text-xs font-mono text-muted-foreground">
            BO{String(bo.bo_numero).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-muted-foreground">
            (R{bo.bo_numero})
          </span>
        </div>

        {/* Equipamento */}
        <div className="col-span-12 sm:col-span-4">
          <Select
            value={equipAtual || SENTINEL_UNMAPPED}
            onValueChange={(v) =>
              onEquipamentoChange(v === SENTINEL_UNMAPPED ? null : v)
            }
            disabled={saving}
          >
            <SelectTrigger className="h-8 text-xs rounded dark:bg-black">
              <SelectValue placeholder="Equipamento..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL_UNMAPPED} className="text-xs italic">
                Sem mapeamento
              </SelectItem>
              {equipamentos.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-xs">
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ponto */}
        <div className="col-span-12 sm:col-span-4">
          <Select
            value={pontoAtual || SENTINEL_UNMAPPED}
            onValueChange={(v) =>
              onPontoChange(v === SENTINEL_UNMAPPED ? null : v)
            }
            disabled={saving || !equipAtual}
          >
            <SelectTrigger className="h-8 text-xs rounded dark:bg-black">
              <SelectValue
                placeholder={
                  equipAtual ? 'Ponto...' : 'Escolha o equipamento'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL_UNMAPPED} className="text-xs italic">
                Sem ponto
              </SelectItem>
              {pontosOpcoes.length === 0 && equipAtual && (
                <SelectItem value="__none__" disabled className="text-xs italic">
                  Nenhum ponto de comando disponivel
                </SelectItem>
              )}
              {pontosOpcoes.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pulso (ms) */}
        <div className="col-span-6 sm:col-span-2">
          <input
            type="number"
            min={PULSO_MS_MIN}
            max={PULSO_MS_MAX}
            step={50}
            value={pulsoLocal}
            onChange={(e) => setPulsoLocal(e.target.value)}
            onBlur={() => {
              const n = parseInt(pulsoLocal, 10);
              if (Number.isFinite(n) && n !== bo.pulso_ms) onPulsoChange(n);
              else setPulsoLocal(String(bo.pulso_ms));
            }}
            disabled={saving}
            className="h-8 w-full rounded border border-input bg-background dark:bg-black px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            placeholder="ms"
            title="Duracao do pulso em milissegundos"
          />
        </div>

        {/* Toggle Ativo + Estado */}
        <div className="col-span-6 sm:col-span-1 flex items-center justify-end gap-1">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <button
              type="button"
              onClick={onAtivoToggle}
              disabled={!isMapped}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                bo.ativo && isMapped
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {bo.ativo ? 'Ativo' : 'Inativo'}
            </button>
          )}
        </div>
      </div>

      {/* Hint quando ha mapeamento */}
      {isMapped && bo.ponto && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground pl-0 sm:pl-[8.333%]">
          <span>
            Acao: <span className="font-mono">r{bo.bo_numero} on</span>
            {' → '}wait {bo.pulso_ms}ms{' → '}
            <span className="font-mono">r{bo.bo_numero} off</span>
          </span>
          {bo.id && (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
              disabled={saving}
            >
              Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

function extractMsg(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as {
      response?: { data?: { message?: string; error?: { message?: string } } };
      message?: string;
    };
    return (
      e.response?.data?.error?.message ??
      e.response?.data?.message ??
      e.message ??
      'Erro desconhecido'
    );
  }
  return 'Erro desconhecido';
}
