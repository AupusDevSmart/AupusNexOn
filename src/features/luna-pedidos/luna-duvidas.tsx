import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CircleHelp, Loader2, MessageCirclePlus, SendHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LUNA_KEY,
  lunaDuvidaEnviar,
  lunaDuvidaLer,
  type LunaDuvidaMsg,
  type LunaDuvidaResposta,
  type LunaSuporte,
} from "./luna-api";

const CHAVE_CONVERSA = `luna-widget:duvida:${LUNA_KEY}`;
const INTERVALO = 1500; // ms entre releituras enquanto a resposta não chega (regra da receita)
const LIMITES_DO_DIA = ["visitor_day_limit", "visitor_conversations_limit", "project_day_limit"];
const NOVA_CONVERSA = ["conversation_limit", "closed"];

function lerConversa(): string | null {
  try {
    return localStorage.getItem(CHAVE_CONVERSA);
  } catch {
    return null;
  }
}

function gravarConversa(id: string | null) {
  try {
    if (id) localStorage.setItem(CHAVE_CONVERSA, id);
    else localStorage.removeItem(CHAVE_CONVERSA);
  } catch {
    /* sem storage: a conversa vale enquanto o painel estiver aberto */
  }
}

/** Recusa do Luna é texto para a pessoa, não erro técnico: mostra `message` como veio. */
function recusa(status: number, body: LunaDuvidaResposta): { codigo: string; texto: string } {
  const codigo = String(body.error || body.code || "");
  const texto =
    typeof body.message === "string" && body.message
      ? body.message
      : status === 503
        ? "A equipe está offline agora. Tente de novo mais tarde ou abra um pedido."
        : status === 429
          ? "Limite de perguntas atingido por agora. Tente de novo mais tarde."
          : "Não deu para perguntar agora. Tente de novo em instantes.";
  return { codigo, texto };
}

type Props = {
  token: string;
  suporte: LunaSuporte;
  /** Texto que veio do formulário de pedido ("Dúvida") para já perguntar aqui. */
  rascunho?: string;
  onRascunhoUsado?: () => void;
  onSessaoVencida: () => void;
  onAbrirPedido: (texto: string) => void;
};

/**
 * NEXON-34 (port do NEXUS-183): aba "Dúvidas" do painel do Luna — conversa com a IA do quadro, sem virar card.
 * A conversa fica guardada no navegador para continuar de onde parou; "Nova conversa" zera.
 * Se a IA não resolver, "Virar pedido" leva a última pergunta para o formulário.
 */
export function LunaDuvidas({ token, suporte, rascunho, onRascunhoUsado, onSessaoVencida, onAbrirPedido }: Props) {
  const [conversa, setConversa] = useState<string | null>(() => lerConversa());
  const [mensagens, setMensagens] = useState<LunaDuvidaMsg[]>([]);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(() => !!lerConversa());
  const [aviso, setAviso] = useState<{ texto: string; fechado: boolean; nova: boolean } | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  const max = suporte.message_chars || 1000;
  const pendente = mensagens.some((m) => m.status === "pending");
  const encerrada = !!aviso?.fechado || !!aviso?.nova;

  const aplicar = useCallback((body: LunaDuvidaResposta) => {
    if (body.conversation?.remaining !== undefined) setRestantes(body.conversation.remaining ?? null);
    if (Array.isArray(body.messages)) setMensagens(body.messages);
    if (body.conversation?.status === "closed")
      setAviso({ texto: "Esta conversa chegou ao limite de mensagens. Se ainda precisar, comece uma nova conversa.", fechado: false, nova: true });
  }, []);

  const ler = useCallback(
    async (id: string) => {
      try {
        const r = await lunaDuvidaLer(token, id);
        if (r.status === 401) return onSessaoVencida();
        if (r.status === 404) {
          // Conversa que o Luna não conhece mais (apagada ou de outra conta): começa do zero.
          gravarConversa(null);
          setConversa(null);
          setMensagens([]);
          return;
        }
        if (r.ok) aplicar(r.body);
      } catch {
        /* sem rede: tenta de novo na próxima volta */
      } finally {
        setCarregando(false);
      }
    },
    [token, aplicar, onSessaoVencida],
  );

  // Conversa guardada: carrega o histórico ao abrir a aba.
  useEffect(() => {
    if (conversa) ler(conversa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resposta pendente: relê a cada 1,5 s, só com a aba do navegador visível.
  useEffect(() => {
    if (!conversa || !pendente) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") ler(conversa);
    }, INTERVALO);
    return () => window.clearInterval(t);
  }, [conversa, pendente, ler]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [mensagens.length, pendente]);

  // Dúvida escrita no formulário de pedido: chega pronta no campo.
  useEffect(() => {
    if (!rascunho) return;
    setTexto(rascunho.slice(0, max));
    onRascunhoUsado?.();
    campo.current?.focus();
  }, [rascunho, max, onRascunhoUsado]);

  const perguntar = async (e?: FormEvent) => {
    e?.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || enviando || pendente || encerrada || pergunta.length > max) return;
    setEnviando(true);
    setAviso(null);
    try {
      const r = await lunaDuvidaEnviar(token, pergunta, conversa || undefined);
      if (r.status === 401) return onSessaoVencida();
      if (r.ok && r.body.conversation?.id) {
        const id = String(r.body.conversation.id);
        gravarConversa(id);
        setConversa(id);
        setTexto("");
        const msg = typeof r.body.message === "object" ? r.body.message : null;
        setMensagens((ms) => [...ms, { id: msg?.id ?? `local-${Date.now()}`, question: pergunta, answer: null, status: "pending" }]);
        aplicar(r.body);
        return;
      }
      const { codigo, texto: t } = recusa(r.status, r.body);
      if (codigo === "wait") {
        // Ainda tem resposta a caminho: relê e mostra o que já chegou.
        if (conversa) ler(conversa);
        return setAviso({ texto: t, fechado: false, nova: false });
      }
      setAviso({ texto: t, fechado: LIMITES_DO_DIA.includes(codigo), nova: NOVA_CONVERSA.includes(codigo) });
    } catch {
      setAviso({ texto: "Sem conexão com o Luna. Confira a internet e tente de novo.", fechado: false, nova: false });
    } finally {
      setEnviando(false);
    }
  };

  const novaConversa = () => {
    gravarConversa(null);
    setConversa(null);
    setMensagens([]);
    setRestantes(null);
    setAviso(null);
    setTexto("");
    campo.current?.focus();
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter quebra linha (no celular o teclado não tem Shift: lá vale o botão).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) {
      e.preventDefault();
      perguntar();
    }
  };

  const ultimaPergunta = [...mensagens].reverse().find((m) => m.question)?.question || "";
  const qtd = texto.trim().length;

  return (
    <div className="flex min-h-full flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-1 flex-col gap-3 p-4" aria-live="polite">
        {carregando && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando a conversa...
          </div>
        )}

        {!carregando && !mensagens.length && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-sky-500/15 text-sky-500">
              <CircleHelp className="size-6" />
            </span>
            <p className="text-sm font-medium">{suporte.title || "Tire sua dúvida"}</p>
            <p className="max-w-[300px] whitespace-pre-line text-xs text-muted-foreground">
              {suporte.welcome || "Olá! Posso ajudar com dúvidas sobre como usar o sistema. O que você precisa?"}
            </p>
          </div>
        )}

        {mensagens.map((m) => (
          <div key={m.id} className="flex flex-col gap-2">
            <div className="ml-8 self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#70C04B]/15 px-3 py-2 text-sm text-foreground ring-1 ring-[#70C04B]/30">
              {m.question}
            </div>
            {m.status === "pending" ? (
              <div className="mr-8 inline-flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 animate-pulse text-sky-500" /> Pensando...
              </div>
            ) : (
              <div
                className={cn(
                  "mr-8 self-start whitespace-pre-wrap break-words rounded-2xl rounded-bl-md px-3 py-2 text-sm",
                  m.status === "done" ? "bg-muted text-foreground" : "border border-amber-500/40 bg-amber-500/10 text-foreground",
                )}
              >
                {m.answer || "Não consegui responder esta. Abra um pedido para a equipe."}
              </div>
            )}
          </div>
        ))}

        {aviso && (
          <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm animate-in fade-in duration-200">
            {aviso.texto}
          </p>
        )}
        <div ref={fim} />
      </div>

      <form onSubmit={perguntar} className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background p-4" noValidate>
        {encerrada ? (
          aviso?.nova ? (
            <button type="button" onClick={novaConversa} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#70C04B] px-4 text-base font-semibold text-[#161633] transition hover:brightness-105 sm:text-sm">
              <MessageCirclePlus className="size-5" /> Nova conversa
            </button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Perguntas encerradas por hoje. Se precisar, abra um pedido.</p>
          )
        ) : (
          <>
            <div className="flex items-end gap-2">
              <textarea
                ref={campo}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={aoTeclar}
                rows={2}
                maxLength={max + 50}
                placeholder="Escreva sua dúvida..."
                aria-label="Sua dúvida"
                disabled={enviando}
                className="max-h-40 min-h-11 w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-[#70C04B] focus:ring-4 focus:ring-[#70C04B]/20 sm:text-sm"
              />
              <button
                type="submit"
                aria-label="Perguntar"
                disabled={!qtd || qtd > max || enviando || pendente}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#70C04B] text-[#161633] shadow-[0_8px_20px_-8px_rgba(112,192,75,0.7)] transition hover:brightness-105 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
              >
                {enviando ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className={cn("tabular-nums", qtd > max && "font-semibold text-destructive")}>
                {qtd}/{max}
                {restantes != null && ` · ${restantes} ${restantes === 1 ? "pergunta restante" : "perguntas restantes"}`}
              </span>
              <span className="flex items-center gap-3">
                {mensagens.length > 0 && (
                  <button type="button" onClick={novaConversa} className="min-h-8 font-medium text-foreground/80 hover:text-foreground">
                    Nova conversa
                  </button>
                )}
              </span>
            </div>
          </>
        )}
        {mensagens.some((m) => m.status !== "pending") && (
          <button
            type="button"
            onClick={() => onAbrirPedido(ultimaPergunta)}
            className="min-h-9 text-xs font-medium text-[#2E7424] underline-offset-2 hover:underline dark:text-[#70C04B]"
          >
            Não resolveu? Abrir um pedido para a equipe
          </button>
        )}
      </form>
    </div>
  );
}
