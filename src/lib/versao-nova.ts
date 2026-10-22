// NEXON-41: depois de um deploy, a aba que já estava aberta ainda tem o index.html
// antigo e pede chunks (assets/*-HASH.js) que não existem mais. O import dinâmico
// falha com "Failed to fetch dynamically imported module" e a tela quebrava até o F5.
// Aqui a gente detecta esse erro e recarrega a página uma vez, já na versão nova.

const CHAVE = "nexon:recarregou-versao-nova";
// Se o erro voltar logo depois do reload, não é versão velha: não entra em loop.
const JANELA_MS = 30_000;

const PADROES = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  "Unable to preload CSS",
  "ChunkLoadError",
];

export function ehErroDeVersaoAntiga(erro: unknown): boolean {
  if (!erro) return false;
  const msg =
    erro instanceof Error
      ? `${erro.name} ${erro.message}`
      : typeof erro === "string"
        ? erro
        : String((erro as { message?: unknown }).message ?? "");
  return PADROES.some((p) => msg.includes(p));
}

/** Recarrega a página uma vez. Devolve false se já recarregou há pouco (não adianta repetir). */
export function recarregarParaVersaoNova(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
    if (Date.now() - ultima < JANELA_MS) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // sessionStorage bloqueado: recarrega mesmo assim (no pior caso, uma vez por erro).
  }
  window.location.reload();
  return true;
}

/** Vite dispara `vite:preloadError` quando um import dinâmico (ou o CSS dele) não carrega. */
export function instalarRecargaDeVersaoNova() {
  window.addEventListener("vite:preloadError", () => {
    recarregarParaVersaoNova();
  });
}
