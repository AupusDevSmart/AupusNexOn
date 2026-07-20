import { useState, useEffect } from 'react';
import { api } from '@/config/api';

export interface RegistroFv {
  unidade_id: string;
  nome: string;
  data: string; // YYYY-MM-DD
  kwh_realizado: number;
  kwh_previsto: number;
}

/**
 * Registros diários crus de geração (últimos `meses`) do módulo monitoramento-fv (BDO).
 * O painel do COA filtra e agrega client-side (usina/ano/mês), como o dashboard do BDO.
 * Best-effort (falha → lista vazia, não quebra o COA).
 */
export function useRegistrosFv(meses = 12) {
  const [registros, setRegistros] = useState<RegistroFv[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    api
      .get(`/monitoramento-fv/registros?meses=${meses}`)
      .then((r: any) => {
        const p = r?.data?.data ?? r?.data ?? [];
        if (vivo) setRegistros(Array.isArray(p) ? (p as RegistroFv[]) : []);
      })
      .catch(() => {
        if (vivo) setRegistros([]);
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [meses]);

  return { registros, loading };
}
