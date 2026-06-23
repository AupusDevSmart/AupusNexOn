// src/features/supervisorio/components/TonBiConfigModal.tsx
// Modal de configuracao + estado ao vivo dos BIs (Boolean Inputs) de uma TON.
//
// Cada BI (entrada digital d1..d6) mapeia para um ponto de tipo='status' de um
// equipamento da mesma unidade da TON. Salvo em ton_bi via REST. Backend retorna
// 6 entradas (BI01..BI06) — placeholders (id='') sao POST ao primeiro save.
//
// Estado ao vivo: assina o WebSocket (/ws/diagramas, subscribe_equipamento) e
// recebe `equipamento_inputs` ({d1..d6}) on-change, exibindo o nivel fisico de
// cada entrada — util pra comissionamento (fechei o contato -> d3 sobe?).
//
// Layout espelha TonBoConfigModal: minimalista, dark/light, sem emojis.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
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
import { env } from '@/config/env';
import { equipamentosApi } from '@/services/equipamentos.services';
import {
  equipamentoPontosApi,
  type EquipamentoPonto,
} from '@/services/equipamento-pontos.services';
import { tonBiApi, type TonBi } from '@/services/ton-bi.services';

interface TonBiConfigModalProps {
  open: boolean;
  onClose: () => void;
  /** id do equipamento TON (dono dos BIs). */
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
const SENTINEL_CREATE = '__create__';

export const TonBiConfigModal: React.FC<TonBiConfigModalProps> = ({
  open,
  onClose,
  tonId,
  unidadeId,
  tonNome,
}) => {
  const [loading, setLoading] = useState(false);
  const [savingBi, setSavingBi] = useState<number | null>(null);
  const [bis, setBis] = useState<TonBi[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [pontosByEquip, setPontosByEquip] = useState<Record<string, EquipamentoPonto[]>>({});
  const [equipSelecionadoPorBi, setEquipSelecionadoPorBi] = useState<Record<number, string>>({});
  // Nivel fisico cru de cada entrada (bi_numero -> 0/1). Alimentado por WS + estado inicial.
  const [rawInputs, setRawInputs] = useState<Record<number, number>>({});

  const socketRef = useRef<Socket | null>(null);

  // ---------------------------------------------------------------------
  // Carregamento inicial: BIs + equipamentos automatizados + estado atual
  // ---------------------------------------------------------------------
  const carregarPontos = useCallback(
    async (equipamentoId: string) => {
      if (pontosByEquip[equipamentoId]) return;
      const pontos = await equipamentoPontosApi.list(equipamentoId);
      setPontosByEquip((prev) => ({
        ...prev,
        [equipamentoId]: pontos.filter((p) => p.tipo === 'status' && p.ativo),
      }));
    },
    [pontosByEquip],
  );

  const carregar = useCallback(async () => {
    if (!tonId || !unidadeId) return;
    setLoading(true);
    try {
      const [bisResp, equipsResp, estadoResp] = await Promise.all([
        tonBiApi.list(tonId),
        equipamentosApi.findByUnidade(unidadeId, { limit: 100 }),
        tonBiApi.estado(tonId).catch(() => []),
      ]);
      setBis(bisResp);

      const inicial: Record<number, string> = {};
      for (const bi of bisResp) {
        const eid = bi.ponto?.equipamento_id?.trim();
        if (eid) inicial[bi.bi_numero] = eid;
      }
      setEquipSelecionadoPorBi(inicial);

      // Semente do nivel fisico a partir do estado resolvido (valor_raw por BI ativo).
      const raw: Record<number, number> = {};
      for (const e of estadoResp) {
        if (e.valor_raw !== null && e.valor_raw !== undefined) raw[e.bi_numero] = e.valor_raw;
      }
      setRawInputs(raw);

      const lista = (equipsResp.data ?? []).filter(
        (e: any) => e.automacao === true && !e.deleted_at,
      );
      setEquipamentos(lista.map((e: any) => ({ id: (e.id || '').trim(), nome: e.nome })));

      const equipsJaMapeados = bisResp
        .map((b) => b.ponto?.equipamento_id?.trim())
        .filter((id): id is string => !!id);
      await Promise.all(
        Array.from(new Set(equipsJaMapeados)).map((eid) =>
          carregarPontos(eid).catch(() => undefined),
        ),
      );
    } catch (err) {
      toast.error('Falha ao carregar BIs/equipamentos', { description: extractMsg(err) });
    } finally {
      setLoading(false);
    }
    // carregarPontos intencionalmente fora das deps (estavel o suficiente; evita reload em loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonId, unidadeId]);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  // ---------------------------------------------------------------------
  // WebSocket: estado ao vivo das entradas (equipamento_inputs)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!open || !tonId) return;
    const cleanId = tonId.trim();
    const fullUrl = `${env.VITE_WEBSOCKET_URL}/ws/diagramas`;
    const socket = io(fullUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe_equipamento', { equipamentoId: cleanId });
    });
    socket.on('equipamento_inputs', (event: any) => {
      if (event?.equipamentoId !== cleanId || !event?.estado) return;
      setRawInputs((prev) => {
        const next = { ...prev };
        for (let n = 1; n <= 6; n++) {
          const v = event.estado[`d${n}`];
          if (v !== undefined && v !== null) next[n] = v ? 1 : 0;
        }
        return next;
      });
    });

    return () => {
      try {
        socket.emit('unsubscribe_equipamento', { equipamentoId: cleanId });
      } catch {
        /* noop */
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [open, tonId]);

  // ---------------------------------------------------------------------
  // Persistencia de um BI (placeholder -> create, existente -> update)
  // ---------------------------------------------------------------------
  const persistirBi = useCallback(
    async (
      bi: TonBi,
      patch: { equipamento_ponto_id?: string | null; invertido?: boolean; ativo?: boolean },
    ): Promise<TonBi | null> => {
      if (!tonId) return null;
      setSavingBi(bi.bi_numero);
      try {
        const isPlaceholder = !bi.id;
        const atualizado = isPlaceholder
          ? await tonBiApi.create(tonId, {
              bi_numero: bi.bi_numero,
              invertido: bi.invertido,
              ativo: bi.ativo,
              ...patch,
            })
          : await tonBiApi.update(tonId, bi.id, patch);
        setBis((prev) => prev.map((b) => (b.bi_numero === bi.bi_numero ? atualizado : b)));
        return atualizado;
      } catch (err) {
        toast.error(`Falha ao salvar BI${bi.bi_numero}`, { description: extractMsg(err) });
        return null;
      } finally {
        setSavingBi(null);
      }
    },
    [tonId],
  );

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handleEquipamentoChange = useCallback(
    async (bi: TonBi, equipamentoId: string | null) => {
      setEquipSelecionadoPorBi((prev) => {
        const next = { ...prev };
        if (equipamentoId) next[bi.bi_numero] = equipamentoId;
        else delete next[bi.bi_numero];
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
      if (bi.ponto) await persistirBi(bi, { equipamento_ponto_id: null });
    },
    [carregarPontos, persistirBi],
  );

  const handlePontoChange = useCallback(
    async (bi: TonBi, pontoId: string | null) => {
      await persistirBi(bi, { equipamento_ponto_id: pontoId });
    },
    [persistirBi],
  );

  const handleCriarPonto = useCallback(
    async (bi: TonBi, equipamentoId: string, nome: string) => {
      const nomeTrim = nome.trim();
      if (!equipamentoId || !nomeTrim) return;
      setSavingBi(bi.bi_numero);
      try {
        const ponto = await equipamentoPontosApi.create(equipamentoId, {
          tipo: 'status',
          nome: nomeTrim,
        });
        // Atualiza cache de pontos do equipamento
        setPontosByEquip((prev) => ({
          ...prev,
          [equipamentoId]: [...(prev[equipamentoId] ?? []), ponto],
        }));
        // Mapeia o BI ao ponto recem-criado
        await persistirBi(bi, { equipamento_ponto_id: ponto.id });
      } catch (err) {
        toast.error('Falha ao criar ponto status', { description: extractMsg(err) });
      } finally {
        setSavingBi(null);
      }
    },
    [persistirBi],
  );

  const handleInvertidoToggle = useCallback(
    async (bi: TonBi) => {
      await persistirBi(bi, { invertido: !bi.invertido });
    },
    [persistirBi],
  );

  const handleAtivoToggle = useCallback(
    async (bi: TonBi) => {
      await persistirBi(bi, { ativo: !bi.ativo });
    },
    [persistirBi],
  );

  const handleClear = useCallback(
    async (bi: TonBi) => {
      if (!bi.id) return;
      await persistirBi(bi, { equipamento_ponto_id: null });
    },
    [persistirBi],
  );

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tonNome ?? 'TON'} · Entradas (BIs)</DialogTitle>
          <DialogDescription className="text-xs">
            Mapeie cada entrada digital (d1..d6) a um ponto de status de um
            equipamento da unidade. O selo mostra o nivel fisico ao vivo. Contato
            Normalmente Fechado (NF): ative "Inverter".
          </DialogDescription>
        </DialogHeader>

        {loading && bis.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : (
          <div className="space-y-2">
            {bis.map((bi) => (
              <BiCard
                key={bi.bi_numero}
                bi={bi}
                rawInput={rawInputs[bi.bi_numero]}
                equipamentoSelecionado={equipSelecionadoPorBi[bi.bi_numero] ?? null}
                saving={savingBi === bi.bi_numero}
                equipamentos={equipamentos}
                pontosByEquip={pontosByEquip}
                onEquipamentoChange={(eid) => handleEquipamentoChange(bi, eid)}
                onPontoChange={(pid) => handlePontoChange(bi, pid)}
                onCriarPonto={(eid, nome) => handleCriarPonto(bi, eid, nome)}
                onInvertidoToggle={() => handleInvertidoToggle(bi)}
                onAtivoToggle={() => handleAtivoToggle(bi)}
                onClear={() => handleClear(bi)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// BiCard — uma linha do grid (1 BI)
// ============================================================================

interface BiCardProps {
  bi: TonBi;
  /** Nivel fisico cru da entrada (0/1) ou undefined se ainda sem leitura. */
  rawInput: number | undefined;
  equipamentoSelecionado: string | null;
  saving: boolean;
  equipamentos: EquipamentoOption[];
  pontosByEquip: Record<string, EquipamentoPonto[]>;
  onEquipamentoChange: (equipamentoId: string | null) => void;
  onPontoChange: (pontoId: string | null) => void;
  onCriarPonto: (equipamentoId: string, nome: string) => void;
  onInvertidoToggle: () => void;
  onAtivoToggle: () => void;
  onClear: () => void;
}

const BiCard: React.FC<BiCardProps> = ({
  bi,
  rawInput,
  equipamentoSelecionado,
  saving,
  equipamentos,
  pontosByEquip,
  onEquipamentoChange,
  onPontoChange,
  onCriarPonto,
  onInvertidoToggle,
  onAtivoToggle,
  onClear,
}) => {
  const equipAtual = (equipamentoSelecionado ?? bi.ponto?.equipamento_id ?? '').trim();
  const pontoAtual = bi.equipamento_ponto_id ?? '';
  const pontosOpcoes = useMemo(
    () => (equipAtual ? pontosByEquip[equipAtual] ?? [] : []),
    [equipAtual, pontosByEquip],
  );
  const isMapped = !!bi.ponto;

  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  // Nivel fisico -> selo. Mostra o cru; se mapeado+invertido, mostra o estado logico.
  const temLeitura = rawInput !== undefined;
  const logico = temLeitura ? (bi.invertido ? (rawInput ? 0 : 1) : rawInput) : undefined;

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* Label BI + selo de estado ao vivo */}
        <div className="col-span-12 sm:col-span-2 flex sm:flex-col items-center sm:items-start gap-1">
          <span className="text-xs font-mono text-muted-foreground">
            BI{String(bi.bi_numero).padStart(2, '0')} (d{bi.bi_numero})
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
              !temLeitura
                ? 'border-border bg-muted/30 text-muted-foreground'
                : rawInput
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'border-border bg-muted/40 text-muted-foreground'
            }`}
            title={
              temLeitura
                ? `Nivel fisico d${bi.bi_numero} = ${rawInput}` +
                  (bi.invertido ? ` (logico ${logico}, NF)` : '')
                : 'Sem leitura ainda'
            }
          >
            {!temLeitura ? '—' : rawInput ? 'ALTO' : 'BAIXO'}
          </span>
        </div>

        {/* Equipamento */}
        <div className="col-span-12 sm:col-span-3">
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

        {/* Ponto (status) */}
        <div className="col-span-12 sm:col-span-3">
          <Select
            value={pontoAtual || SENTINEL_UNMAPPED}
            onValueChange={(v) => {
              if (v === SENTINEL_CREATE) {
                setCriando(true);
                return;
              }
              onPontoChange(v === SENTINEL_UNMAPPED ? null : v);
            }}
            disabled={saving || !equipAtual}
          >
            <SelectTrigger className="h-8 text-xs rounded dark:bg-black">
              <SelectValue placeholder={equipAtual ? 'Ponto...' : 'Escolha o equipamento'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL_UNMAPPED} className="text-xs italic">
                Sem ponto
              </SelectItem>
              {pontosOpcoes.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.nome}
                </SelectItem>
              ))}
              {equipAtual && (
                <SelectItem value={SENTINEL_CREATE} className="text-xs italic">
                  + Criar ponto status...
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Inverter (NF) */}
        <div className="col-span-6 sm:col-span-2 flex items-center justify-start sm:justify-center">
          <button
            type="button"
            onClick={onInvertidoToggle}
            disabled={saving}
            title="Contato Normalmente Fechado: inverte o estado lido (0<->1)"
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              bi.invertido
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
            } disabled:opacity-40`}
          >
            {bi.invertido ? 'NF (invertido)' : 'NA'}
          </button>
        </div>

        {/* Toggle Ativo */}
        <div className="col-span-6 sm:col-span-2 flex items-center justify-end gap-1">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <button
              type="button"
              onClick={onAtivoToggle}
              disabled={!isMapped}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                bi.ativo && isMapped
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {bi.ativo ? 'Ativo' : 'Inativo'}
            </button>
          )}
        </div>
      </div>

      {/* Linha de criacao de ponto inline */}
      {criando && equipAtual && (
        <div className="mt-2 flex items-center gap-2 pl-0 sm:pl-[16.666%]">
          <input
            type="text"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome do ponto (ex.: Bomba Ligada)"
            className="h-8 flex-1 rounded border border-input bg-background dark:bg-black px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && novoNome.trim()) {
                onCriarPonto(equipAtual, novoNome);
                setCriando(false);
                setNovoNome('');
              } else if (e.key === 'Escape') {
                setCriando(false);
                setNovoNome('');
              }
            }}
          />
          <button
            type="button"
            disabled={saving || !novoNome.trim()}
            onClick={() => {
              onCriarPonto(equipAtual, novoNome);
              setCriando(false);
              setNovoNome('');
            }}
            className="text-[10px] px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-40"
          >
            Criar
          </button>
          <button
            type="button"
            onClick={() => {
              setCriando(false);
              setNovoNome('');
            }}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/50"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Hint quando ha mapeamento */}
      {isMapped && bi.ponto && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground pl-0 sm:pl-[16.666%]">
          <span>
            {bi.ponto.equipamento_nome} · {bi.ponto.nome}
            {temLeitura && (
              <>
                {' — '}
                <span className={logico ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                  {logico ? 'Ativo' : 'Inativo'}
                </span>
              </>
            )}
          </span>
          {bi.id && (
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
