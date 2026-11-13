import { useCallback, useEffect, useMemo } from 'react';
import { paramOpcao, useEscreverParamsUrl, useParamUrl, type Historico } from '@/hooks/useParamUrl';

export const ABAS_SINOPTICO = ['visao', 'unifilar', 'alarmes', 'iot', 'comissionamento', 'cameras'] as const;
export type AbaSinoptico = (typeof ABAS_SINOPTICO)[number];

interface Opcoes {
  /** Aba de quem entra sem `?aba=` (Aupus: unifilar; demais: visão geral). Fica fora da URL. */
  abaInicial: AbaSinoptico;
  podeVerIot: boolean;
  podeVerUnifilar: boolean;
  podeVerAlarmes: boolean;
}

/**
 * Aba do Sinóptico na URL (`?aba=cameras`, NEXON-108): F5, voltar/avançar e link
 * abrem na mesma aba. Trocar de aba cria entrada no histórico e limpa os parâmetros
 * da aba anterior (câmera, evento, período…). Aba desconhecida = aba inicial; aba sem
 * permissão volta sem nova entrada no histórico.
 */
export function useAbaSinoptico({ abaInicial, podeVerIot, podeVerUnifilar, podeVerAlarmes }: Opcoes) {
  const tipoAba = useMemo(() => paramOpcao<AbaSinoptico>(ABAS_SINOPTICO, abaInicial), [abaInicial]);
  const [aba] = useParamUrl('aba', tipoAba);
  const escreverUrl = useEscreverParamsUrl();

  const definirAba = useCallback(
    (nova: AbaSinoptico, historico: Historico = 'push') => {
      if (nova === aba) return;
      escreverUrl({ aba: tipoAba.escrever(nova) }, historico, { limpar: true });
    },
    [escreverUrl, aba, tipoAba],
  );

  // Defensivo (também para link): IoT/comissionamento sem permissão volta para a inicial;
  // unifilar/alarmes sem permissão, para a Visão Geral. Câmeras: todo usuário que vê a unidade.
  useEffect(() => {
    if ((aba === 'iot' || aba === 'comissionamento') && !podeVerIot) {
      definirAba(abaInicial, 'replace');
    } else if ((aba === 'unifilar' && !podeVerUnifilar) || (aba === 'alarmes' && !podeVerAlarmes)) {
      definirAba('visao', 'replace');
    }
  }, [aba, podeVerIot, podeVerUnifilar, podeVerAlarmes, abaInicial, definirAba]);

  /** `?aba=` para levar junto numa navegação (troca de unidade); vazio na aba inicial. */
  const buscaDaAba = useMemo(() => {
    const v = tipoAba.escrever(aba);
    return v ? `?aba=${v}` : '';
  }, [aba, tipoAba]);

  return { aba, definirAba, buscaDaAba };
}
