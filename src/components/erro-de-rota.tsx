import { useEffect, useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ehErroDeVersaoAntiga, recarregarParaVersaoNova } from "@/lib/versao-nova";

// NEXON-41: errorElement das rotas. Antes, qualquer erro de render caía na tela
// padrão do React Router ("Unexpected Application Error!"). Versão antiga depois de
// deploy recarrega sozinha; o resto mostra uma mensagem com como sair dela.
export function ErroDeRota() {
  const erro = useRouteError();
  const versaoAntiga = ehErroDeVersaoAntiga(erro);
  const [recarregando, setRecarregando] = useState(versaoAntiga);

  useEffect(() => {
    if (versaoAntiga && !recarregarParaVersaoNova()) setRecarregando(false);
  }, [versaoAntiga]);

  if (!versaoAntiga) console.error(erro);

  const detalhe = isRouteErrorResponse(erro)
    ? `${erro.status} ${erro.statusText}`
    : erro instanceof Error
      ? erro.message
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center">
        {recarregando ? (
          <>
            <h1 className="text-lg font-semibold">Atualizando o NexON…</h1>
            <p className="text-sm text-muted-foreground">
              Saiu uma versão nova. A página vai recarregar sozinha.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Não foi possível abrir esta página</h1>
            <p className="text-sm text-muted-foreground">
              {versaoAntiga
                ? "O NexON foi atualizado e esta aba ainda está na versão anterior."
                : "Aconteceu um erro inesperado."}{" "}
              Recarregue para tentar de novo.
            </p>
            {detalhe && !versaoAntiga && (
              <p className="break-words font-mono text-xs text-muted-foreground">{detalhe}</p>
            )}
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => window.location.reload()}>Recarregar</Button>
              <Button variant="outline" onClick={() => window.location.assign("/")}>
                Ir para o início
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
