import { useState, useEffect } from 'react';
import { api } from '@/config/api';

export interface RankingFvItem {
  unidade_id: string;
  nome: string;
  kwh_realizado: number;
  kwh_previsto: number;
  pct: number | null;
  origem: string;
}

export interface ResumoFv {
  data: string;
  hoje: { realizado: number; previsto: number; eficiencia: number | null; usinas: number };
  ranking: RankingFvItem[];
  serie: Array<{ data: string; realizado: number; previsto: number }>;
}

/**
 * Resumo do parque fotovoltaico (BDO) pro painel do COA: KPIs de hoje + ranking de
 * usinas + série diária realizado × meta. Best-effort (falha → null, não quebra o COA).
 */
export function useResumoFv(dias = 30) {
  const [resumo, setResumo] = useState<ResumoFv | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    api
      .get(`/monitoramento-fv/resumo?dias=${dias}`)
      .then((r: any) => {
        const payload = r?.data?.data ?? r?.data ?? null;
        if (vivo) setResumo(payload && payload.hoje ? (payload as ResumoFv) : null);
      })
      .catch(() => {
        if (vivo) setResumo(null);
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [dias]);

  return { resumo, loading };
}
