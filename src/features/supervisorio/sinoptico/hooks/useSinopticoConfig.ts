import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DiagramasService } from "@/services/diagramas.services";

/**
 * Le e salva a config do sinoptico, persistida em Diagrama.configuracoes.
 * Por enquanto expoe grandezasPmIds (R2/R3); pode crescer (grafico, diagramaPontos).
 */
export function useSinopticoConfig(unidadeId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sinoptico-config", unidadeId?.trim()],
    queryFn: () => DiagramasService.getActiveDiagrama(unidadeId!.trim()),
    enabled: !!unidadeId,
    staleTime: 60_000,
  });

  const diagrama = query.data as { id?: string; configuracoes?: Record<string, any> } | null | undefined;
  const configuracoes = diagrama?.configuracoes ?? {};
  const rawPmIds = configuracoes.grandezasPmIds;
  // Memo: rawPmIds e estavel enquanto os dados da query nao mudam; sem isto o
  // array novo a cada render dispara loops em useEffect que dependem dele.
  const grandezasPmIds = useMemo<string[]>(
    () => (Array.isArray(rawPmIds) ? rawPmIds.map((s: string) => String(s).trim()) : []),
    [rawPmIds],
  );

  // Mapa de pontos das caixas de dados por equipamento do diagrama (R8).
  const rawPontos = configuracoes.diagramaPontos;
  const diagramaPontos = useMemo<Record<string, any>>(
    () => (rawPontos && typeof rawPontos === "object" ? rawPontos : {}),
    [rawPontos],
  );

  const salvar = useMutation({
    mutationFn: (pmIds: string[]) => {
      if (!diagrama?.id) throw new Error("Diagrama não carregado");
      // Merge shallow no backend preserva as demais chaves de configuracoes.
      return DiagramasService.updateDiagrama(diagrama.id, {
        configuracoes: { grandezasPmIds: pmIds },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinoptico-config", unidadeId?.trim()] });
      qc.invalidateQueries({ queryKey: ["sinoptico-grandezas"] });
    },
  });

  /** Salva os pontos (caixas de dados) de UM equipamento do diagrama (R8). */
  const salvarPontos = async (
    equipamentoId: string,
    pontos: Record<string, { equipamentoFonteId: string; campoJson: string }> | null,
  ) => {
    if (!diagrama?.id) throw new Error("Diagrama não carregado");
    const id = equipamentoId.trim();
    const novo: Record<string, any> = { ...diagramaPontos };
    if (pontos && Object.keys(pontos).length) novo[id] = pontos;
    else delete novo[id];
    // Merge shallow no backend preserva grandezasPmIds e demais chaves.
    await DiagramasService.updateDiagrama(diagrama.id, { configuracoes: { diagramaPontos: novo } });
    qc.invalidateQueries({ queryKey: ["sinoptico-config", unidadeId?.trim()] });
  };

  return {
    grandezasPmIds,
    diagramaPontos,
    diagramaId: diagrama?.id,
    salvar,
    salvarPontos,
    loading: query.isLoading,
  };
}
