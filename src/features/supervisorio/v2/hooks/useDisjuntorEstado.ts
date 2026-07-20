import { useEffect, useState } from 'react';
import { api } from '@/config/api';
import { useEquipamentoMqttData } from '@/hooks/useEquipamentoMqttData';

export type DisjuntorEstado = 'aberto' | 'fechado' | 'indeterminado' | 'sem_fonte';

interface FonteStatus {
  rele_equipamento_id: string;
  rele_nome: string | null;
  campo_aberto: string | null;
  campo_fechado: string | null;
}

/**
 * Estado ABERTO/FECHADO de um disjuntor do unifilar.
 *
 * Quem lê os contatos auxiliares (52a/52b) do DJ é o RELÉ — domínio IoT, vive só
 * no diagrama IoT. Ele publica os sinais do catálogo (`dj_aberto`/`dj_fechado`)
 * na PRÓPRIA telemetria. O vínculo relé→disjuntor está no `io_config.bi`; o
 * endpoint abaixo inverte esse mapa e diz de quem assinar e quais campos ler.
 *
 * `indeterminado` quando os dois sinais vêm iguais (0/0 ou 1/1): fiação/config
 * errada, ou disjuntor em trânsito. Melhor mostrar dúvida do que mentir posição
 * de disjuntor.
 */
export function useDisjuntorEstado(disjuntorEquipamentoId?: string | null) {
  const [fonte, setFonte] = useState<FonteStatus | null>(null);
  const [semFonte, setSemFonte] = useState(true);

  useEffect(() => {
    const id = (disjuntorEquipamentoId ?? '').trim();
    if (!id) {
      setFonte(null);
      setSemFonte(true);
      return;
    }
    let vivo = true;
    api
      .get(`/iot/disjuntor-status-fonte/${id}`)
      .then((r: any) => {
        if (!vivo) return;
        const f = (r?.data?.data ?? r?.data ?? null) as FonteStatus | null;
        const ok = !!f?.rele_equipamento_id;
        setFonte(ok ? f : null);
        setSemFonte(!ok);
      })
      .catch(() => {
        if (!vivo) return;
        setFonte(null);
        setSemFonte(true);
      });
    return () => {
      vivo = false;
    };
  }, [disjuntorEquipamentoId]);

  // Só abre socket se houver relé resolvido.
  const { data } = useEquipamentoMqttData(fonte?.rele_equipamento_id ?? null);
  const dados = (data as any)?.dado?.dados ?? null;

  let estado: DisjuntorEstado = semFonte ? 'sem_fonte' : 'indeterminado';
  if (fonte && dados) {
    const bit = (campo?: string | null): number | null => {
      if (!campo) return null;
      const v = dados[campo];
      if (v === null || v === undefined) return null;
      return Number(v) ? 1 : 0;
    };
    const a = bit(fonte.campo_aberto);
    const f = bit(fonte.campo_fechado);
    if (a === 1 && f === 0) estado = 'aberto';
    else if (f === 1 && a === 0) estado = 'fechado';
    else estado = 'indeterminado';
  }

  return { estado, fonte };
}
