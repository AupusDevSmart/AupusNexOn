// src/features/supervisorio/components/TonAiConfigModal.tsx
// Modal de configuracao de AIs (Analog Inputs) de uma TON.
//
// Cada AI (canal analogico) mapeia para um ponto de tipo='medicao' de um
// equipamento da unidade (ex.: Nivel do tanque da bomba) + escala mV->%.
// Salvo em ton_ai via REST. Backend retorna N entradas (AI01..AI0N) —
// placeholders (id='') sao POST ao primeiro save, existentes sao PATCH.
//
// Espelha o TonBoConfigModal; difere em: ponto tipo="medicao", campos de
// escala (mv_0/mv_100) em vez de pulso, sem estado ao vivo.

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { equipamentosApi } from '@/services/equipamentos.services';
import { equipamentoPontosApi } from '@/services/equipamento-pontos.services';
import {
  MV_0_DEFAULT,
  MV_100_DEFAULT,
  tonAiApi,
  type TonAi,
} from '@/services/ton-ai.services';

interface TonAiConfigModalProps {
  open: boolean;
  onClose: () => void;
  /** id do equipamento TON (dono dos AIs). */
  tonId: string | null;
  /** id da unidade da TON — pra filtrar equipamentos disponiveis. */
  unidadeId: string | null;
  tonNome?: string;
}

interface EquipamentoOption {
  id: string;
  nome: string;
}

interface PontoOpt {
  id: string;
  nome: string;
}

const SENTINEL_UNMAPPED = '__unmapped__';

export const TonAiConfigModal: React.FC<TonAiConfigModalProps> = ({
  open,
  onClose,
  tonId,
  unidadeId,
  tonNome,
}) => {
  const [loading, setLoading] = useState(false);
  const [savingAi, setSavingAi] = useState<number | null>(null);
  const [ais, setAis] = useState<TonAi[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [pontosByEquip, setPontosByEquip] = useState<Record<string, PontoOpt[]>>({});
  const [equipSelecionadoPorAi, setEquipSelecionadoPorAi] = useState<Record<number, string>>({});

  const carregarPontos = useCallback(async (equipamentoId: string) => {
    if (pontosByEquip[equipamentoId]) return;
    const pontos = await equipamentoPontosApi.list(equipamentoId);
    setPontosByEquip((prev) => ({
      ...prev,
      [equipamentoId]: pontos
        .filter((p) => p.tipo === 'medicao' && p.ativo)
        .map((p) => ({ id: p.id, nome: p.nome })),
    }));
  }, [pontosByEquip]);

  const carregar = useCallback(async () => {
    if (!tonId || !unidadeId) return;
    setLoading(true);
    try {
      const [aisResp, equipsResp] = await Promise.all([
        tonAiApi.list(tonId),
        equipamentosApi.findByUnidade(unidadeId, { limit: 100 }),
      ]);
      setAis(aisResp);

      const inicial: Record<number, string> = {};
      for (const ai of aisResp) {
        const eid = ai.ponto?.equipamento_id?.trim();
        if (eid) inicial[ai.ai_numero] = eid;
      }
      setEquipSelecionadoPorAi(inicial);

      // Filtra automacao=true e EXCLUI a propria TON e outras TONs (um AI da TON
      // le um equipamento EXTERNO, nunca uma TON).
      const ehTon = (e: any) => {
        const cat = String(
          e.tipo_equipamento_rel?.categoria?.nome ??
            e.tipoEquipamento?.categoria?.nome ??
            '',
        ).trim().toUpperCase();
        const tipo = String(
          e.tipo_equipamento ?? e.tipo_equipamento_rel?.codigo ?? '',
        ).trim().toUpperCase();
        return cat === 'TON' || tipo.startsWith('TON');
      };
      const lista = (equipsResp.data ?? []).filter(
        (e: any) =>
          e.automacao === true &&
          !e.deleted_at &&
          String(e.id || '').trim() !== String(tonId || '').trim() &&
          !ehTon(e),
      );
      setEquipamentos(lista.map((e: any) => ({ id: (e.id || '').trim(), nome: e.nome })));

      const equipsJaMapeados = aisResp
        .map((a) => a.ponto?.equipamento_id?.trim())
        .filter((id): id is string => !!id);
      await Promise.all(
        Array.from(new Set(equipsJaMapeados)).map((eid) =>
          carregarPontos(eid).catch(() => undefined),
        ),
      );
    } catch (err) {
      toast.error('Falha ao carregar AIs/equipamentos', {
        description: extractMsg(err),
      });
    } finally {
      setLoading(false);
    }
  }, [tonId, unidadeId, carregarPontos]);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  const persistirAi = useCallback(
    async (
      ai: TonAi,
      patch: { equipamento_ponto_id?: string | null; mv_0?: number; mv_100?: number; ativo?: boolean },
    ): Promise<TonAi | null> => {
      if (!tonId) return null;
      setSavingAi(ai.ai_numero);
      try {
        const isPlaceholder = !ai.id;
        const atualizado = isPlaceholder
          ? await tonAiApi.create(tonId, {
              ai_numero: ai.ai_numero,
              mv_0: ai.mv_0,
              mv_100: ai.mv_100,
              ativo: ai.ativo,
              ...patch,
            })
          : await tonAiApi.update(tonId, ai.id, patch);
        setAis((prev) => prev.map((a) => (a.ai_numero === ai.ai_numero ? atualizado : a)));
        return atualizado;
      } catch (err) {
        toast.error(`Falha ao salvar AI${ai.ai_numero}`, { description: extractMsg(err) });
        return null;
      } finally {
        setSavingAi(null);
      }
    },
    [tonId],
  );

  const handleEquipamentoChange = useCallback(
    async (ai: TonAi, equipamentoId: string | null) => {
      setEquipSelecionadoPorAi((prev) => {
        const next = { ...prev };
        if (equipamentoId) next[ai.ai_numero] = equipamentoId;
        else delete next[ai.ai_numero];
        return next;
      });
      if (equipamentoId) {
        try {
          await carregarPontos(equipamentoId);
        } catch (err) {
          toast.error('Falha ao carregar pontos do equipamento', { description: extractMsg(err) });
          return;
        }
      }
      if (ai.ponto) {
        await persistirAi(ai, { equipamento_ponto_id: null });
      }
    },
    [carregarPontos, persistirAi],
  );

  const handlePontoChange = useCallback(
    async (ai: TonAi, pontoId: string | null) => {
      await persistirAi(ai, { equipamento_ponto_id: pontoId });
    },
    [persistirAi],
  );

  const handleEscalaChange = useCallback(
    async (ai: TonAi, campo: 'mv_0' | 'mv_100', valor: number) => {
      if (!Number.isFinite(valor)) return;
      await persistirAi(ai, { [campo]: Math.round(valor) });
    },
    [persistirAi],
  );

  const handleAtivoToggle = useCallback(
    async (ai: TonAi) => {
      await persistirAi(ai, { ativo: !ai.ativo });
    },
    [persistirAi],
  );

  const handleClear = useCallback(
    async (ai: TonAi) => {
      if (!ai.id) return;
      await persistirAi(ai, { equipamento_ponto_id: null });
    },
    [persistirAi],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tonNome ?? 'TON'} · Configuracao de AIs</DialogTitle>
          <DialogDescription className="text-xs">
            Mapeie cada entrada analogica (AI) a um ponto de medicao de um
            equipamento (ex.: Nivel do tanque). A escala eh linear:
            pct = (mV - mV@0%) / (mV@100% - mV@0%) × 100.
          </DialogDescription>
        </DialogHeader>

        {loading && ais.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : (
          <div className="space-y-2">
            {ais.map((ai) => (
              <AiCard
                key={ai.ai_numero}
                ai={ai}
                equipamentoSelecionado={equipSelecionadoPorAi[ai.ai_numero] ?? null}
                saving={savingAi === ai.ai_numero}
                equipamentos={equipamentos}
                pontosByEquip={pontosByEquip}
                onEquipamentoChange={(eid) => handleEquipamentoChange(ai, eid)}
                onPontoChange={(pid) => handlePontoChange(ai, pid)}
                onEscalaChange={(campo, v) => handleEscalaChange(ai, campo, v)}
                onAtivoToggle={() => handleAtivoToggle(ai)}
                onClear={() => handleClear(ai)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// AiCard — uma linha do grid (1 AI)
// ============================================================================

interface AiCardProps {
  ai: TonAi;
  equipamentoSelecionado: string | null;
  saving: boolean;
  equipamentos: EquipamentoOption[];
  pontosByEquip: Record<string, PontoOpt[]>;
  onEquipamentoChange: (equipamentoId: string | null) => void;
  onPontoChange: (pontoId: string | null) => void;
  onEscalaChange: (campo: 'mv_0' | 'mv_100', valor: number) => void;
  onAtivoToggle: () => void;
  onClear: () => void;
}

const AiCard: React.FC<AiCardProps> = ({
  ai,
  equipamentoSelecionado,
  saving,
  equipamentos,
  pontosByEquip,
  onEquipamentoChange,
  onPontoChange,
  onEscalaChange,
  onAtivoToggle,
  onClear,
}) => {
  const equipAtual = (equipamentoSelecionado ?? ai.ponto?.equipamento_id ?? '').trim();
  const pontoAtual = ai.equipamento_ponto_id ?? '';
  const pontosOpcoes = useMemo(
    () => (equipAtual ? pontosByEquip[equipAtual] ?? [] : []),
    [equipAtual, pontosByEquip],
  );
  const [mv0Local, setMv0Local] = useState<string>(String(ai.mv_0));
  const [mv100Local, setMv100Local] = useState<string>(String(ai.mv_100));
  useEffect(() => { setMv0Local(String(ai.mv_0)); }, [ai.mv_0]);
  useEffect(() => { setMv100Local(String(ai.mv_100)); }, [ai.mv_100]);

  const isMapped = !!ai.ponto;

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* Label AI */}
        <div className="col-span-12 sm:col-span-1 flex sm:flex-col items-center sm:items-start gap-1">
          <span className="text-xs font-mono text-muted-foreground">
            AI{String(ai.ai_numero).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-muted-foreground">(AN{ai.ai_numero})</span>
        </div>

        {/* Equipamento */}
        <div className="col-span-12 sm:col-span-4">
          <Select
            value={equipAtual || SENTINEL_UNMAPPED}
            onValueChange={(v) => onEquipamentoChange(v === SENTINEL_UNMAPPED ? null : v)}
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

        {/* Ponto (medicao) */}
        <div className="col-span-12 sm:col-span-3">
          <Select
            value={pontoAtual || SENTINEL_UNMAPPED}
            onValueChange={(v) => onPontoChange(v === SENTINEL_UNMAPPED ? null : v)}
            disabled={saving || !equipAtual}
          >
            <SelectTrigger className="h-8 text-xs rounded dark:bg-black">
              <SelectValue placeholder={equipAtual ? 'Ponto...' : 'Escolha o equipamento'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL_UNMAPPED} className="text-xs italic">
                Sem ponto
              </SelectItem>
              {pontosOpcoes.length === 0 && equipAtual && (
                <SelectItem value="__none__" disabled className="text-xs italic">
                  Nenhum ponto de medicao disponivel
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

        {/* Escala mV@0% */}
        <div className="col-span-4 sm:col-span-2">
          <label className="block text-[9px] text-muted-foreground leading-tight">mV @ 0%</label>
          <input
            type="number"
            value={mv0Local}
            onChange={(e) => setMv0Local(e.target.value)}
            onBlur={() => {
              const n = parseInt(mv0Local, 10);
              if (Number.isFinite(n) && n !== ai.mv_0) onEscalaChange('mv_0', n);
              else setMv0Local(String(ai.mv_0));
            }}
            disabled={saving}
            className="h-8 w-full rounded border border-input bg-background dark:bg-black px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            title="mV que equivale a 0% (offset; 4-20mA usa o mV em 4mA)"
          />
        </div>

        {/* Escala mV@100% */}
        <div className="col-span-4 sm:col-span-1">
          <label className="block text-[9px] text-muted-foreground leading-tight">mV @ 100%</label>
          <input
            type="number"
            value={mv100Local}
            onChange={(e) => setMv100Local(e.target.value)}
            onBlur={() => {
              const n = parseInt(mv100Local, 10);
              if (Number.isFinite(n) && n !== ai.mv_100) onEscalaChange('mv_100', n);
              else setMv100Local(String(ai.mv_100));
            }}
            disabled={saving}
            className="h-8 w-full rounded border border-input bg-background dark:bg-black px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            title="mV que equivale a 100% (fundo de escala)"
          />
        </div>

        {/* Toggle Ativo */}
        <div className="col-span-4 sm:col-span-1 flex items-center justify-end gap-1">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <button
              type="button"
              onClick={onAtivoToggle}
              disabled={!isMapped}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                ai.ativo && isMapped
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {ai.ativo ? 'Ativo' : 'Inativo'}
            </button>
          )}
        </div>
      </div>

      {/* Hint quando ha mapeamento */}
      {isMapped && ai.ponto && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground pl-0 sm:pl-[8.333%]">
          <span>
            Escala: <span className="font-mono">{ai.mv_0}mV = 0%</span>{' · '}
            <span className="font-mono">{ai.mv_100}mV = 100%</span>
          </span>
          {ai.id && (
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
    const e = err as { response?: { data?: { message?: unknown } }; message?: unknown };
    const apiMsg = e.response?.data?.message;
    if (typeof apiMsg === 'string') return apiMsg;
    if (Array.isArray(apiMsg)) return apiMsg.join(', ');
    if (typeof e.message === 'string') return e.message;
  }
  return 'Erro desconhecido';
}
