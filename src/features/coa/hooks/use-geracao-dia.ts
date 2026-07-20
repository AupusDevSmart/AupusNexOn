import { useState, useEffect } from 'react';
import { api } from '@/config/api';

export interface GeracaoDiaItem {
  unidade_id: string;
  nome: string;
  kwh_realizado: number;
  kwh_previsto: number;
  pct: number | null;
  origem: string; // 'nuvem' | 'iot' | 'manual'
}

/**
 * Geração consolidada do dia (realizado × meta × %) por unidade, do módulo
 * monitoramento-fv (BDO). Alimenta a tabela de UFVs do COA com a coluna Meta e as
 * usinas só-nuvem (sem telemetria IoT). Best-effort: falha → mapa vazio (não quebra o COA).
 */
export function useGeracaoDia() {
  const [porUnidade, setPorUnidade] = useState<Record<string, GeracaoDiaItem>>({});
  const [lista, setLista] = useState<GeracaoDiaItem[]>([]);

  useEffect(() => {
    let vivo = true;
    api
      .get('/monitoramento-fv/geracao-dia')
      .then((response: any) => {
        const rd = response?.data;
        const payload = rd?.data ?? rd; // desembrulha { success, data }
        const dados: GeracaoDiaItem[] = payload?.dados ?? payload?.data?.dados ?? [];
        if (!vivo) return;
        setLista(dados);
        const map: Record<string, GeracaoDiaItem> = {};
        for (const d of dados) map[String(d.unidade_id).trim()] = d;
        setPorUnidade(map);
      })
      .catch(() => {
        if (!vivo) return;
        setLista([]);
        setPorUnidade({});
      });
    return () => {
      vivo = false;
    };
  }, []);

  return { porUnidade, lista };
}
