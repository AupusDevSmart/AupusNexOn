// NEXON-8 (port do NEXUS-139): cliente da API do widget de pedidos do Luna (kanban da equipe).
// Receita: https://luna.lgatec.com.br/widget-receita.md — implementação de referência em /widget.js.
// A chave é pública por desenho: só vale nos domínios liberados no quadro NexON
// (Configurações › Widget no Luna). VITE_LUNA_WIDGET_KEY sobrescreve.
//
// Toda chamada é FormData sem cabeçalho próprio (requisição simples, sem preflight de CORS)
// e sem o axios do sistema: o token do NexON nunca vai para o Luna.

export const LUNA_KEY: string =
  import.meta.env.VITE_LUNA_WIDGET_KEY || "lw_2nMZh7NSgeQTmGkhhgJ5nuq9AY6UkZt4";
const LUNA_API = "https://luna.lgatec.com.br/api";
const SESSION_KEY = `luna-widget:session:${LUNA_KEY}`;

export type LunaUser = { name?: string; email?: string; role?: "team" | "requester" | string };
export type LunaSession = { token: string; user: LunaUser };

export type LunaConfig = {
  form: {
    title?: string;
    subtitle?: string;
    min_length?: number;
    files?: { max?: number; total_mb?: number; file_mb?: number; image_mb?: number };
    forgot_url?: string;
    login?: "required" | "optional";
    connect_url?: string;
    kinds?: string[];
  };
  project?: { name?: string };
  /** NEXON-34 (port do NEXUS-183): aba "Dúvidas" (conversa com a IA do Luna), ligada no quadro em Configurações › Widget. */
  support?: LunaSuporte;
};

export type LunaSuporte = {
  enabled?: boolean;
  title?: string;
  welcome?: string;
  message_chars?: number;
  conversation_messages?: number;
};

export type LunaResposta<T = Record<string, unknown>> = { ok: boolean; status: number; body: T };

export async function lunaConfig(): Promise<LunaConfig> {
  const r = await fetch(`${LUNA_API}/widget/${encodeURIComponent(LUNA_KEY)}`, { credentials: "omit" });
  if (!r.ok) throw new Error(`luna ${r.status}`);
  return r.json();
}

export async function lunaPost<T = Record<string, unknown>>(path: string, fd: FormData): Promise<LunaResposta<T>> {
  const r = await fetch(`${LUNA_API}/widget/${encodeURIComponent(LUNA_KEY)}${path}`, {
    method: "POST",
    body: fd,
    credentials: "omit",
  });
  const body = (await r.json().catch(() => ({}))) as T;
  return { ok: r.ok, status: r.status, body };
}

export const LUNA_WEB = "https://luna.lgatec.com.br";

export type LunaPedidoResumo = {
  ref: string;
  title: string;
  url?: string;
  completed_at?: string;
  updated_at?: string;
  status?: { key?: string; label?: string };
  progress?: number | null;
};

/** Resumo dos pedidos da pessoa no quadro (POST /widget/{key}/mine, LUNA-645). */
export type LunaMeus = {
  portal_url?: string;
  counts: { ready: number; open: number };
  validation?: { pending: number; limit: number; locked: boolean };
  ready: LunaPedidoResumo[];
  open: LunaPedidoResumo[];
};

/** Pedidos da pessoa. `null` com status 404 = o Luna ainda não tem a rota (não insiste). */
export async function lunaMeus(token: string): Promise<{ status: number; meus: LunaMeus | null }> {
  const fd = new FormData();
  fd.append("session", token);
  const r = await lunaPost<Partial<LunaMeus>>("/mine", fd);
  if (!r.ok || !r.body.counts) return { status: r.status, meus: null };
  return {
    status: r.status,
    meus: {
      portal_url: r.body.portal_url,
      counts: { ready: Number(r.body.counts.ready) || 0, open: Number(r.body.counts.open) || 0 },
      validation: r.body.validation,
      ready: Array.isArray(r.body.ready) ? r.body.ready : [],
      open: Array.isArray(r.body.open) ? r.body.open : [],
    },
  };
}

// NEXON-34 (port do NEXUS-183): dúvidas com a IA do Luna (receita, "Dúvidas e suporte por IA", LUNA-773).
// A resposta não vem na hora: a mensagem nasce `pending` e a conversa é relida até virar
// `done`, `blocked` ou `failed` (nos três `answer` já é o texto para mostrar).
export type LunaDuvidaMsg = { id: string | number; question: string; answer?: string | null; status: string };
export type LunaDuvidaConversa = { id: string; status?: string; remaining?: number | null };
export type LunaDuvidaResposta = {
  conversation?: LunaDuvidaConversa;
  messages?: LunaDuvidaMsg[];
  message?: LunaDuvidaMsg | string;
  error?: string;
  code?: string;
};

export function lunaDuvidaEnviar(token: string, texto: string, conversa?: string) {
  const fd = new FormData();
  fd.append("session", token);
  fd.append("message", texto);
  if (conversa) fd.append("conversation", conversa);
  return lunaPost<LunaDuvidaResposta>("/support/messages", fd);
}

export function lunaDuvidaLer(token: string, conversa: string) {
  const fd = new FormData();
  fd.append("session", token);
  fd.append("conversation", conversa);
  return lunaPost<LunaDuvidaResposta>("/support/conversation", fd);
}

/** "há 3 dias", "há 2 horas": o resumo fala como gente. */
export function haQuanto(iso?: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  const s = Math.round((t - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const passos: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  const abs = Math.abs(s);
  if (abs < 60) return "agora";
  for (let i = 1; i < passos.length; i++) {
    if (abs < passos[i][0]) return rtf.format(Math.round(s / passos[i - 1][0]), passos[i][1]);
  }
  return rtf.format(Math.round(s / 31557600), "year");
}

/** Só a sessão fica guardada (nunca a senha). Navegação privada: vale enquanto a página estiver aberta. */
export function lerSessao(): LunaSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return s && s.token && s.user ? s : null;
  } catch {
    return null;
  }
}

export function gravarSessao(s: LunaSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* sem storage: segue só em memória */
  }
}

/** Logout do NexON também encerra a sessão do Luna (regra 6 da receita). */
export function lunaLogout() {
  const s = lerSessao();
  gravarSessao(null);
  if (!s) return;
  const fd = new FormData();
  fd.append("session", s.token);
  lunaPost("/logout", fd).catch(() => {
    /* a sessão já saiu deste navegador */
  });
}

/** Código da tentativa de "Continuar com o Luna": 24 bytes aleatórios em hexadecimal. */
export function sortearCodigo(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function iniciais(nome?: string): string {
  const p = String(nome || "").split(/[\s@._-]+/).filter(Boolean);
  return ((p[0] || "?").charAt(0) + (p[1] ? p[1].charAt(0) : "")).toUpperCase();
}

export function papelLuna(role?: string): string {
  return role === "team" ? "Equipe" : role === "requester" ? "Solicitante" : "";
}

export function tamanho(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace(".", ",")} MB`;
}

/** Chrome/Firefox gravam webm/opus; Safari (iOS e Mac) grava mp4, que vai como .m4a. */
export function mimeDoAudio(): string {
  const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return c.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) || "";
}

export function extensaoDoAudio(mime: string): string {
  if (/mp4|m4a|aac/.test(mime)) return "m4a";
  if (/ogg/.test(mime)) return "ogg";
  return "webm";
}
