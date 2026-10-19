import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, X } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { temPapelLuna, useLunaPedidos } from "./luna-store";
import { LUNA_KEY, gravarSessao, lerSessao, lunaMeus } from "./luna-api";

// NEXUS-141: mantém o resumo dos pedidos da pessoa em dia e chama ela de volta ao Luna sem
// incomodar: avisa uma vez quando um pedido fica pronto e, enquanto houver pronto sem conferir,
// lembra de novo no máximo a cada LEMBRETE_MS. Só confere com a aba visível.
const INTERVALO_MS = 3 * 60_000;
const LEMBRETE_MS = 2 * 3600_000;
const SOME_EM_MS = 15_000;
const CHAVE_VISTOS = `luna-widget:prontos-vistos:${LUNA_KEY}`;
const CHAVE_LEMBRETE = `luna-widget:ultimo-lembrete:${LUNA_KEY}`;

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : (JSON.parse(v) as T);
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem storage: avisa de novo na próxima carga, sem prejuízo */
  }
}

export function LunaVigia() {
  const veLuna = useUserStore((s) => temPapelLuna(s.user));
  const { tick, aberto, aviso, setMeus, setAviso, abrir } = useLunaPedidos();
  const ultima = useRef(0);
  const semRota = useRef(false);
  const rodando = useRef(false);

  useEffect(() => {
    if (!veLuna) return;

    const conferir = async () => {
      if (semRota.current || rodando.current || document.visibilityState !== "visible") return;
      const s = lerSessao();
      if (!s) return setMeus(null);
      rodando.current = true;
      ultima.current = Date.now();
      try {
        const { status, meus } = await lunaMeus(s.token);
        if (status === 401) {
          gravarSessao(null); // sessão vencida: esquece, como manda a receita
          return setMeus(null);
        }
        if (status === 404) semRota.current = true;
        if (!meus) return;
        setMeus(meus);

        const prontos = meus.ready.map((p) => p.ref);
        const vistos = ler<string[] | null>(CHAVE_VISTOS, null);
        gravar(CHAVE_VISTOS, prontos);
        if (useLunaPedidos.getState().aberto) return;

        // Primeira vez neste navegador: não trata o que já estava pronto como novidade.
        const novos = vistos ? meus.ready.filter((p) => !vistos.includes(p.ref)) : [];
        const agora = Date.now();
        if (novos.length) {
          gravar(CHAVE_LEMBRETE, agora);
          setAviso(
            novos.length === 1
              ? { titulo: "Seu pedido ficou pronto", texto: `${novos[0].ref} · ${novos[0].title}` }
              : { titulo: `${novos.length} pedidos ficaram prontos`, texto: "Confira se ficaram como você pediu." },
          );
        } else if (meus.counts.ready > 0 && agora - ler<number>(CHAVE_LEMBRETE, 0) > LEMBRETE_MS) {
          gravar(CHAVE_LEMBRETE, agora);
          setAviso({
            titulo: meus.counts.ready === 1 ? "1 pedido esperando sua conferência" : `${meus.counts.ready} pedidos esperando sua conferência`,
            texto: "Leva um minuto e ajuda a equipe a fechar o que foi feito.",
          });
        }
      } catch {
        /* sem rede: tenta na próxima volta */
      } finally {
        rodando.current = false;
      }
    };

    const primeira = window.setTimeout(conferir, 4000);
    const volta = window.setInterval(conferir, INTERVALO_MS);
    const aoVoltar = () => document.visibilityState === "visible" && Date.now() - ultima.current > 60_000 && conferir();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearTimeout(primeira);
      window.clearInterval(volta);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [veLuna, setMeus, setAviso]);

  // Pedido de conferência fora de hora (entrou, enviou, trocou de conta).
  useEffect(() => {
    if (!veLuna || !tick || semRota.current) return;
    const s = lerSessao();
    if (!s) return setMeus(null);
    lunaMeus(s.token)
      .then(({ status, meus }) => {
        if (status === 404) semRota.current = true;
        if (meus) {
          setMeus(meus);
          gravar(CHAVE_VISTOS, meus.ready.map((p) => p.ref));
        }
      })
      .catch(() => undefined);
  }, [tick, veLuna, setMeus]);

  // O aviso some sozinho; com o painel aberto ele não aparece.
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), SOME_EM_MS);
    return () => window.clearTimeout(t);
  }, [aviso, setAviso]);

  if (!veLuna || !aviso || aberto) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-[55] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[340px] animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-[color:color-mix(in_srgb,var(--background)_95%,transparent)] p-3 pr-1.5 text-foreground shadow-xl backdrop-blur">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#70C04B]/15 text-[#177A3C] dark:text-[#70C04B]">
          <CircleCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{aviso.titulo}</p>
          <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">{aviso.texto}</p>
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => abrir(null, "meus")}
              className="min-h-9 rounded-lg bg-[#70C04B] px-3 text-sm font-semibold text-[#161633] transition hover:brightness-105 active:scale-[0.97]"
            >
              Conferir
            </button>
            <button
              type="button"
              onClick={() => setAviso(null)}
              className="min-h-9 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Depois
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => setAviso(null)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
