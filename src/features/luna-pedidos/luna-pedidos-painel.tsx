import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Bug,
  ChevronRight,
  Hourglass,
  Inbox,
  Check,
  CircleHelp,
  ClipboardPlus,
  CloudUpload,
  Copy,
  ExternalLink,
  FileAudio,
  FileText,
  FileVideo,
  Lightbulb,
  Loader2,
  Mail,
  Mic,
  Moon,
  Paperclip,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { useMediaQuery } from "@/hooks/use-media-query";
import { papeisDoUsuario, useLunaPedidos, type LunaAba } from "./luna-store";
import { LunaDuvidas } from "./luna-duvidas";
import {
  LUNA_KEY,
  LUNA_WEB,
  extensaoDoAudio,
  haQuanto,
  gravarSessao,
  iniciais,
  lerSessao,
  lunaConfig,
  lunaPost,
  mimeDoAudio,
  papelLuna,
  sortearCodigo,
  tamanho,
  type LunaConfig,
  type LunaMeus,
  type LunaSession,
} from "./luna-api";

type Tela = "entrar" | "email" | "pedido" | "enviado";
type Anexo = {
  id: number;
  arquivo: Blob;
  nome: string;
  tamanho: number;
  imagem: boolean;
  audio: boolean;
  duracao: number;
  previa?: string; // object URL da miniatura (só imagem)
};
type Enviado = { reference?: string; portal_url?: string };

const TIPOS = ["Algo deu erro", "Ideia ou melhoria", "Dúvida"];
const MAX_GRAVACAO = 600; // segundos, o mesmo teto do gravador do portal do Luna
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cada tipo tem cor, ícone e pergunta próprios: a pessoa vê na hora o que está pedindo.
const TIPO_UI: Record<string, { icone: typeof Bug; ativo: string; icn: string; pergunta: string; dica: string }> = {
  "Algo deu erro": {
    icone: Bug,
    ativo: "border-rose-500 bg-rose-500/10 text-foreground",
    icn: "text-rose-500",
    pergunta: "O que aconteceu?",
    dica: "O que você estava fazendo, o que esperava e o que apareceu na tela.",
  },
  "Ideia ou melhoria": {
    icone: Lightbulb,
    ativo: "border-amber-500 bg-amber-500/10 text-foreground",
    icn: "text-amber-500",
    pergunta: "Qual é a ideia?",
    dica: "O que você quer que mude e como isso ajuda no seu dia a dia.",
  },
  Dúvida: {
    icone: CircleHelp,
    ativo: "border-sky-500 bg-sky-500/10 text-foreground",
    icn: "text-sky-500",
    pergunta: "Qual é a sua dúvida?",
    dica: "Conte em que tela você está e o que quer saber.",
  },
};

// Cores da marca em hexadecimal: as do tema (var(--nx-*)) não aceitam opacidade no Tailwind 3
// (`bg-nexon-verde/15` não gera CSS nenhum). Alvo de 44 px e fonte de 16 px no celular (o iOS dá zoom abaixo disso).
const BOTAO_PRINCIPAL =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#70C04B] px-4 text-base font-semibold text-[#161633] shadow-[0_8px_20px_-8px_rgba(112,192,75,0.7)] transition hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 sm:text-sm";
const BOTAO_SECUNDARIO =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-base font-medium text-foreground transition hover:bg-muted active:scale-[0.98] disabled:opacity-60 sm:text-sm";
const CAMPO =
  "w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base text-foreground outline-none transition placeholder:text-[color:color-mix(in_srgb,var(--muted-foreground)_70%,transparent)] focus:border-[#70C04B] focus:ring-4 focus:ring-[#70C04B]/20 sm:text-sm";
const LINK = "font-medium text-[#177A3C] underline-offset-2 hover:underline dark:text-[#70C04B]";
const ENTRADA = "animate-in fade-in slide-in-from-bottom-2 duration-300";

function relogio(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * NEXUS-139/141: painel de pedidos ao Luna com a cara do NexON, falando direto com a API do widget.
 * Sem sessão abre em "Entrar" (o quadro exige conta); com sessão mostra quem pede no topo.
 * Com o painel aberto, arquivo solto em qualquer ponto e print colado viram anexo (não há área
 * de soltar separada). Celular (< 640 px): folha pelo rodapé que sobe com o teclado.
 * Tablet/computador: painel ao lado do botão.
 */
export function LunaPedidosPainel() {
  const { aberto, ancora, fechar, aba, setAba, meus, setMeus, atualizarMeus } = useLunaPedidos();
  const usuario = useUserStore((s) => s.user);
  const location = useLocation();
  const celular = !useMediaQuery("(min-width: 640px)");
  const toque = useMediaQuery("(pointer: coarse)");

  const [config, setConfig] = useState<LunaConfig | null>(null);
  const [sessao, setSessao] = useState<LunaSession | null>(() => lerSessao());
  const [tela, setTela] = useState<Tela>(() => (lerSessao() ? "pedido" : "entrar"));
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; url?: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [conectando, setConectando] = useState<string | null>(null);

  const [tipo, setTipo] = useState(TIPOS[0]);
  const [descricao, setDescricao] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviado, setEnviado] = useState<Enviado>({});
  const [copiado, setCopiado] = useState(false);
  const [gravando, setGravando] = useState(0); // segundos; 0 = parado
  const [arrastando, setArrastando] = useState(false);
  const [teclado, setTeclado] = useState(0);
  const [rascunhoDuvida, setRascunhoDuvida] = useState("");
  const [alturaVisivel, setAlturaVisivel] = useState(0); // px do viewport visual (encolhe com o teclado)

  const abertoEm = useRef(Date.now());
  const seq = useRef(0);
  const profundidade = useRef(0);
  const gravacao = useRef<{ mr: MediaRecorder; stream: MediaStream; inicio: number; partes: Blob[]; cancelar: boolean; timer: number } | null>(null);
  const isca = useRef<HTMLInputElement>(null);
  const seletor = useRef<HTMLInputElement>(null);

  const trocarSessao = useCallback((s: LunaSession | null) => {
    gravarSessao(s);
    setSessao(s);
  }, []);

  // Aparência e regras vêm sempre do Luna; a sessão guardada é conferida uma vez por carga.
  useEffect(() => {
    lunaConfig().then(setConfig).catch(() => setConfig(null));
    const s = lerSessao();
    if (!s) return;
    const fd = new FormData();
    fd.append("session", s.token);
    lunaPost<{ user?: LunaSession["user"] }>("/session", fd)
      .then((r) => {
        if (r.status === 401) {
          trocarSessao(null);
          setTela("entrar");
        } else if (r.ok && r.body.user) trocarSessao({ token: s.token, user: r.body.user });
      })
      .catch(() => {
        /* sem rede: confere de novo no envio */
      });
  }, [trocarSessao]);

  // Ao abrir: zera o relógio do anti-robô e volta para a tela certa.
  useEffect(() => {
    if (!aberto) return;
    abertoEm.current = Date.now();
    setErro("");
    setAviso(null);
    setArrastando(false);
    profundidade.current = 0;
    if (lerSessao()) atualizarMeus(); // resumo fresco a cada abertura
    setTela((t) => (t === "enviado" ? (lerSessao() ? "pedido" : "entrar") : lerSessao() ? (t === "entrar" || t === "email" ? "pedido" : t) : t === "pedido" ? "entrar" : t));
  }, [aberto, atualizarMeus]);

  // "Continuar com o Luna": só vale mensagem do Luna, desta chave e com o código sorteado.
  useEffect(() => {
    if (!conectando) return;
    let origem = "";
    try {
      origem = new URL(config?.form.connect_url || "").origin;
    } catch {
      return;
    }
    const ouvir = (e: MessageEvent) => {
      const m = e.data;
      if (e.origin !== origem || !m || m.type !== "luna-widget:session") return;
      if (m.key !== LUNA_KEY || m.nonce !== conectando || typeof m.token !== "string" || !m.user) return;
      setConectando(null);
      trocarSessao({ token: m.token, user: m.user });
      atualizarMeus();
      setErro("");
      setTela("pedido");
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [conectando, config, trocarSessao, atualizarMeus]);

  // Teclado do celular: no iOS ele só encolhe o viewport visual; a folha sobe o que sumiu embaixo.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !aberto) return;
    const medir = () => {
      const escondido = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setTeclado(escondido > 80 ? escondido : 0);
      setAlturaVisivel(vv.height);
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto, fechar]);

  // Fechou no meio de uma gravação: descarta.
  useEffect(() => {
    if (!aberto) pararGravacao(true);
  }, [aberto]);

  const limites = () => {
    const f = config?.form.files || {};
    return {
      max: f.max || 10,
      total: (f.total_mb || 38) * 1048576,
      arquivo: (f.file_mb || 25) * 1048576,
      imagem: (f.image_mb || 10) * 1048576,
    };
  };

  // ---------- entrar ----------

  const continuarComLuna = () => {
    const url = config?.form.connect_url;
    if (!url) return setErro("Não deu para abrir o Luna agora. Entre com e-mail e senha.");
    const codigo = sortearCodigo();
    const destino = `${url}?key=${encodeURIComponent(LUNA_KEY)}&origin=${encodeURIComponent(window.location.origin)}&nonce=${codigo}`;
    const esq = Math.max(0, (window.screenX || 0) + ((window.outerWidth || 1024) - 460) / 2);
    const topo = Math.max(0, (window.screenY || 0) + ((window.outerHeight || 768) - 700) / 2);
    // Sem `noopener`: a janela do Luna precisa do `opener` para devolver a sessão.
    const janela = toque
      ? window.open(destino, "_blank")
      : window.open(destino, "luna-widget-entrar", `width=460,height=700,left=${esq},top=${topo}`);
    if (!janela) {
      setConectando(null);
      return setErro("O navegador bloqueou a janela do Luna. Libere janelas deste site ou entre com e-mail e senha.");
    }
    setErro("");
    setConectando(codigo);
  };

  const entrarComEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ocupado) return;
    const dados = new FormData(e.currentTarget);
    const email = String(dados.get("email") || "").trim();
    const senha = String(dados.get("password") || "");
    if (!EMAIL_OK.test(email)) return setErro("Informe um e-mail válido.");
    if (!senha) return setErro("Informe sua senha.");
    const fd = new FormData();
    fd.append("email", email);
    fd.append("password", senha);
    setOcupado(true);
    setErro("");
    try {
      const r = await lunaPost<{ token?: string; user?: LunaSession["user"]; message?: string }>("/login", fd);
      if (!r.ok || !r.body.token || !r.body.user) {
        return setErro(
          r.status === 403
            ? r.body.message || "Esta conta não tem acesso ao quadro do NexON no Luna."
            : r.body.message || "Não deu para entrar agora. Tente de novo em instantes.",
        );
      }
      trocarSessao({ token: r.body.token, user: r.body.user });
      atualizarMeus();
      setTela("pedido");
    } catch {
      setErro("Sem conexão com o Luna. Confira a internet e tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  const trocarConta = () => {
    const s = sessao;
    trocarSessao(null);
    if (s) {
      const fd = new FormData();
      fd.append("session", s.token);
      lunaPost("/logout", fd).catch(() => undefined);
    }
    pararGravacao(true);
    setMeus(null);
    setErro("");
    setAviso(null);
    setTela("entrar");
  };

  // ---------- anexos e áudio ----------

  // A lista vive num ref também: o fim da gravação roda num closure antigo e precisa da lista atual.
  const anexosRef = useRef<Anexo[]>([]);
  const mudarAnexos = (lista: Anexo[]) => {
    anexosRef.current
      .filter((a) => a.previa && !lista.some((b) => b.id === a.id))
      .forEach((a) => URL.revokeObjectURL(a.previa!));
    anexosRef.current = lista;
    setAnexos(lista);
  };

  // Miniaturas soltas ao desmontar.
  useEffect(() => () => anexosRef.current.forEach((a) => a.previa && URL.revokeObjectURL(a.previa)), []);

  const incluir = (arquivo: Blob, nome: string, extra: Partial<Anexo> = {}): string => {
    const l = limites();
    const atuais = anexosRef.current;
    const imagem = /^image\//.test(arquivo.type);
    if (atuais.length >= l.max) return `No máximo ${l.max} arquivos por pedido.`;
    const teto = imagem ? l.imagem : l.arquivo;
    if (arquivo.size > teto) return `"${nome}" passa de ${tamanho(teto)}. Envie um arquivo menor.`;
    const total = atuais.reduce((t, a) => t + a.tamanho, 0) + arquivo.size;
    if (total > l.total) return `Os anexos somam mais de ${tamanho(l.total)}. Tire algum para incluir este.`;
    seq.current += 1;
    const previa = imagem ? URL.createObjectURL(arquivo) : undefined;
    mudarAnexos([...atuais, { id: seq.current, arquivo, nome, tamanho: arquivo.size, imagem, audio: false, duracao: 0, previa, ...extra }]);
    return "";
  };

  // Qualquer tipo de arquivo: quem decide o que aceita é o Luna, pela extensão. Aqui só os tetos de tamanho.
  const anexar = (lista: FileList | File[] | null | undefined) => {
    const arquivos = Array.from(lista || []);
    if (!arquivos.length) return;
    const erros = arquivos
      .map((f, i) => {
        // Print colado ou arrastado do navegador chega sem nome que preste.
        const semNome = !f.name || f.name === "image.png";
        const nome = semNome ? `print-${anexosRef.current.length + i + 1}.${f.type.split("/")[1] || "png"}` : f.name;
        return incluir(f, nome);
      })
      .filter(Boolean);
    setErro(erros[0] || "");
  };

  // Arrastar e soltar: a tela toda, com o painel aberto, é a área. O contador evita o pisca-pisca
  // do dragleave ao passar por cima dos filhos; soltar fora do painel nunca abre o arquivo no navegador.
  const temArquivo = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");
  const arraste = {
    onDragEnter: (e: DragEvent) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      profundidade.current += 1;
      setArrastando(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent) => {
      if (!temArquivo(e)) return;
      profundidade.current = Math.max(0, profundidade.current - 1);
      if (!profundidade.current) setArrastando(false);
    },
    onDrop: (e: DragEvent) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      profundidade.current = 0;
      setArrastando(false);
      if (tela !== "pedido" || !sessao) return setErro("Entre no Luna primeiro; depois é só soltar os arquivos de novo.");
      anexar(e.dataTransfer.files);
    },
  };

  // Print copiado (Ctrl+V / Cmd+V) vira anexo; texto colado segue normal.
  const aoColar = (e: ClipboardEvent) => {
    const arquivos = e.clipboardData?.files;
    if (!arquivos?.length || tela !== "pedido" || !sessao) return;
    e.preventDefault();
    anexar(arquivos);
  };

  const podeGravar = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const gravar = async () => {
    if (gravacao.current) return;
    if (anexosRef.current.length >= limites().max) return setErro(`No máximo ${limites().max} arquivos por pedido.`);
    setErro("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = mimeDoAudio();
      let mr: MediaRecorder;
      try {
        mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch {
        mr = new MediaRecorder(stream);
      }
      const g = { mr, stream, inicio: Date.now(), partes: [] as Blob[], cancelar: false, timer: 0 };
      gravacao.current = g;
      mr.ondataavailable = (e) => e.data?.size && g.partes.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(g.timer);
        if (gravacao.current === g) gravacao.current = null;
        setGravando(0);
        if (g.cancelar || !g.partes.length) return;
        const tipoAudio = mr.mimeType || mime || "audio/webm";
        const n = anexosRef.current.filter((a) => a.audio).length + 1;
        const segundos = Math.round((Date.now() - g.inicio) / 1000);
        setErro(incluir(new Blob(g.partes, { type: tipoAudio }), `audio-${n}.${extensaoDoAudio(tipoAudio)}`, { audio: true, duracao: segundos }));
      };
      // Fatias de 1 s: fechar a aba no meio não perde tudo o que foi gravado.
      mr.start(1000);
      setGravando(1);
      g.timer = window.setInterval(() => {
        const s = (Date.now() - g.inicio) / 1000;
        setGravando(Math.max(1, Math.round(s)));
        if (s >= MAX_GRAVACAO) pararGravacao(false);
      }, 500);
    } catch (err) {
      const nome = (err as DOMException)?.name;
      setErro(
        nome === "NotAllowedError" || nome === "SecurityError"
          ? "O navegador não deixou usar o microfone. Libere o acesso nas permissões do site e tente de novo."
          : nome === "NotFoundError"
            ? "Nenhum microfone encontrado neste aparelho."
            : "Não deu para gravar agora. Tente de novo.",
      );
    }
  };

  function pararGravacao(cancelar: boolean) {
    const g = gravacao.current;
    if (!g) return;
    g.cancelar = cancelar;
    try {
      g.mr.stop();
    } catch {
      g.stream.getTracks().forEach((t) => t.stop());
    }
  }

  // ---------- envio ----------

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (ocupado || !sessao) return;
    if (gravacao.current) return setErro("Conclua a gravação antes de enviar.");
    const texto = descricao.trim();
    const minimo = config?.form.min_length || 10;
    const temAudio = anexos.some((a) => a.audio);
    if (!temAudio && texto.length < minimo) return setErro(`Conte um pouco mais (pelo menos ${minimo} caracteres) ou grave um áudio.`);
    if (temAudio && texto.length > 0 && texto.length < minimo)
      return setErro(`Conte um pouco mais (pelo menos ${minimo} caracteres) ou deixe só o áudio.`);

    const fd = new FormData();
    fd.append("session", sessao.token);
    fd.append("description", texto);
    fd.append("kind", tipo);
    fd.append("page_url", window.location.href.slice(0, 2000));
    fd.append("page_title", (document.title || "").slice(0, 300));
    fd.append("user_agent", navigator.userAgent.slice(0, 500));
    fd.append("language", navigator.language || "");
    fd.append("viewport", `${window.innerWidth}x${window.innerHeight}`);
    fd.append("screen", window.screen ? `${window.screen.width}x${window.screen.height}` : "");
    fd.append("elapsed", String(Date.now() - abertoEm.current));
    fd.append("website", isca.current?.value || "");
    // Dados do NexON que poupam a equipe de perguntar: quem é a pessoa aqui e em que tela estava.
    fd.append(
      "metadata",
      JSON.stringify({
        sistema: "NexON",
        tela: location.pathname + location.search,
        usuario_nexon_id: usuario?.id,
        usuario_nexon_nome: usuario?.nome,
        usuario_nexon_email: usuario?.email,
        papeis: papeisDoUsuario(usuario).join(", "),
      }).slice(0, 4000),
    );
    anexos.forEach((a) => {
      fd.append("files[]", a.arquivo, a.nome);
      fd.append("durations[]", String(a.audio ? a.duracao : 0));
    });

    setOcupado(true);
    setErro("");
    setAviso(null);
    try {
      const r = await lunaPost<{
        reference?: string;
        portal_url?: string;
        message?: string;
        session?: string;
        errors?: Record<string, string[]>;
      }>("/requests", fd);
      if (r.ok) {
        setEnviado({ reference: r.body.reference, portal_url: r.body.portal_url });
        setCopiado(false);
        setDescricao("");
        mudarAnexos([]);
        setTipo(TIPOS[0]);
        setTela("enviado");
        atualizarMeus();
        return;
      }
      if (r.status === 401) {
        trocarSessao(null);
        setTela("entrar");
        return setErro(r.body.message || "Sua sessão no Luna venceu. Entre de novo para enviar.");
      }
      if (r.status === 423) {
        if (meus) setAba("meus");
        // Pedidos esperando a conferência dele: leva ao portal para conferir antes de abrir outro.
        return setAviso({
          texto: r.body.message || "Você tem pedidos esperando sua conferência no Luna. Confira antes de abrir outro.",
          url: r.body.portal_url,
        });
      }
      const primeiro = r.body.errors ? Object.values(r.body.errors).flat()[0] : "";
      setErro(
        r.status === 429
          ? "Muitos envios em pouco tempo. Tente de novo em alguns minutos."
          : r.status === 413
            ? "Os anexos ficaram grandes demais para enviar juntos. Tire algum e tente de novo."
            : r.body.message || primeiro || "Não deu para enviar agora. Tente de novo em instantes.",
      );
    } catch {
      setErro("Sem conexão com o Luna. Confira a internet e tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  const copiarNumero = () => {
    if (!enviado.reference) return;
    navigator.clipboard
      ?.writeText(enviado.reference)
      .then(() => {
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 1800);
      })
      .catch(() => undefined);
  };

  if (!aberto) return null;

  // Computador/tablet: painel ao lado do botão do sidebar, alinhado pela base dele.
  const estiloPainel = celular
    ? {
        bottom: teclado,
        paddingBottom: teclado ? 0 : "env(safe-area-inset-bottom)",
        maxHeight: alturaVisivel ? Math.round(alturaVisivel * 0.92) : undefined,
      }
    : (() => {
        // Ancorado pela base: a altura tem que caber entre o topo (16 px) e essa base, senão o
        // cabeçalho sai pela parte de cima da tela (NEXUS-144) e o miolo é que rola.
        const bottom = Math.max(16, window.innerHeight - (ancora?.bottom ?? window.innerHeight - 16));
        return {
          left: Math.max(16, Math.min((ancora?.right ?? 16) + 12, window.innerWidth - 436)),
          bottom,
          maxHeight: Math.max(320, window.innerHeight - bottom - 16),
        };
      })();

  const nomeProjeto = config?.project?.name || "NexON";
  const user = sessao?.user;
  const minimo = config?.form.min_length || 10;
  const l = limites();
  const ui = TIPO_UI[tipo] || TIPO_UI[TIPOS[0]];
  const temAudio = anexos.some((a) => a.audio);
  const qtd = descricao.trim().length;
  const pronto = qtd >= minimo || (temAudio && qtd === 0);
  const podeAnexar = tela === "pedido" && !!sessao;
  const portal = meus?.portal_url || `${LUNA_WEB}/portal`;
  // NEXON-34 (port do NEXUS-183): "Dúvidas" só aparece com o suporte por IA ligado no quadro (Configurações › Widget).
  const suporte = config?.support?.enabled ? config.support : null;
  const abaAtual: LunaAba = aba === "meus" && meus ? "meus" : aba === "duvidas" && suporte ? "duvidas" : "novo";
  const abas: [LunaAba, string, number][] = [["novo", "Novo pedido", 0]];
  if (meus) abas.push(["meus", "Meus pedidos", meus.counts.ready]);
  if (suporte) abas.push(["duvidas", "Dúvidas", 0]);
  const sessaoVencida = () => {
    trocarSessao(null);
    setTela("entrar");
    setErro("Sua sessão no Luna venceu. Entre de novo para continuar.");
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation" {...arraste} onPaste={aoColar}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200 sm:bg-black/25" onClick={fechar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="luna-pedidos-titulo"
        style={estiloPainel}
        className={cn(
          "absolute flex flex-col overflow-hidden border border-border bg-background text-foreground shadow-2xl",
          celular
            ? "inset-x-0 max-h-[92dvh] rounded-t-3xl border-b-0 animate-in slide-in-from-bottom duration-300"
            : "max-h-[calc(100dvh-32px)] w-[420px] max-w-[calc(100vw-32px)] rounded-2xl animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-200",
        )}
      >
        {/* Cabeçalho com a cor da marca; com sessão, quem pede fica logo abaixo do título. */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#161633] via-[#1d2350] to-[#2F4DA0] px-4 pb-4 pt-3 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-[#70C04B]/20 blur-2xl" aria-hidden />
          {celular && <div className="relative mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/30" aria-hidden />}
          <div className="relative flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#70C04B] text-[#161633] shadow-lg shadow-[#70C04B]/30">
              <ClipboardPlus className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="luna-pedidos-titulo" className="text-base font-semibold leading-snug">
                {tela === "email" ? "Entrar no Luna" : config?.form.title || `Pedido para o time do ${nomeProjeto}`}
              </h2>
              <p className="text-sm leading-snug text-white/70">{config?.form.subtitle || "Seu pedido chega direto para a equipe"}</p>
            </div>
            {sessao && (
              <a
                href={portal}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir o Luna"
                aria-label="Abrir o Luna"
                className="-mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="size-[18px]" />
              </a>
            )}
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>

          {(tela === "pedido" || tela === "enviado") && user && (
            <div className="relative mt-3 flex items-center gap-3 rounded-xl bg-white/10 p-2 pl-2.5 ring-1 ring-white/15 animate-in fade-in duration-300">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#70C04B] text-sm font-bold text-[#161633]">
                {iniciais(user.name || user.email)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold">{user.name || user.email}</p>
                  {papelLuna(user.role) && (
                    <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium leading-none text-white/90">
                      {papelLuna(user.role)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-white/60">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={trocarConta}
                className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-white/90 transition hover:bg-white/10 sm:min-h-9"
              >
                Trocar
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {erro && (
            <p
              role="alert"
              className="mx-4 mt-4 rounded-xl border border-[color:color-mix(in_srgb,var(--destructive)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {erro}
            </p>
          )}
          {aviso && (
            <div
              role="alert"
              className="mx-4 mt-4 flex flex-col gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <span>{aviso.texto}</span>
              {aviso.url && (
                <a href={aviso.url} target="_blank" rel="noopener noreferrer" className={cn(LINK, "inline-flex min-h-11 items-center gap-1 sm:min-h-0")}>
                  Conferir meus pedidos <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          )}

          {tela === "entrar" && (
            <div key="entrar" className={cn("flex flex-col gap-3 p-5", ENTRADA)}>
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <span className="relative inline-flex size-16 items-center justify-center">
                  <span className={cn("absolute inset-0 rounded-full bg-[#70C04B]/20", conectando && "animate-ping")} aria-hidden />
                  <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-[#70C04B]/15 text-[#177A3C] ring-1 ring-[#70C04B]/40 dark:text-[#70C04B]">
                    {conectando ? <Loader2 className="size-7 animate-spin" /> : <Moon className="size-7" />}
                  </span>
                </span>
                {conectando ? (
                  <div aria-live="polite">
                    <p className="text-base font-semibold">Confirme na janela do Luna</p>
                    <p className="mt-1 text-sm text-muted-foreground">Assim que você tocar em "Continuar" lá, o pedido abre aqui.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-base font-semibold">Entre para enviar seu pedido</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Com a sua conta do Luna o pedido sai no seu nome e você acompanha a resposta da equipe do {nomeProjeto}.
                    </p>
                  </div>
                )}
              </div>

              {conectando ? (
                <>
                  <button type="button" className={BOTAO_PRINCIPAL} onClick={continuarComLuna}>
                    Abrir de novo
                  </button>
                  <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setConectando(null)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={BOTAO_PRINCIPAL} onClick={continuarComLuna} disabled={!config}>
                    {config ? <Moon className="size-5" /> : <Loader2 className="size-5 animate-spin" />} Continuar com o Luna
                  </button>
                  <p className="text-center text-xs text-muted-foreground">Já entrou no Luna neste navegador? É só confirmar.</p>
                  <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
                  </div>
                  <button type="button" className={BOTAO_SECUNDARIO} onClick={() => (setErro(""), setTela("email"))}>
                    <Mail className="size-5" /> Entrar com e-mail e senha
                  </button>
                </>
              )}
            </div>
          )}

          {tela === "email" && (
            <form key="email" className={cn("flex flex-col gap-4 p-5", ENTRADA)} onSubmit={entrarComEmail} noValidate>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                E-mail
                <input
                  className={CAMPO}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  maxLength={190}
                  defaultValue={usuario?.email || ""}
                  placeholder="voce@empresa.com"
                  autoFocus={!toque}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span className="flex items-center justify-between gap-2">
                  Senha
                  {config?.form.forgot_url && (
                    <a href={config.form.forgot_url} target="_blank" rel="noopener noreferrer" className={cn(LINK, "text-xs")}>
                      Esqueci minha senha
                    </a>
                  )}
                </span>
                <input className={CAMPO} name="password" type="password" autoComplete="current-password" maxLength={500} />
              </label>
              <button type="submit" className={BOTAO_PRINCIPAL} disabled={ocupado}>
                {ocupado && <Loader2 className="size-5 animate-spin" />}
                {ocupado ? "Entrando..." : "Entrar"}
              </button>
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => (setErro(""), setTela("entrar"))}>
                <ArrowLeft className="size-4" /> Voltar
              </button>
              <p className="text-center text-xs text-muted-foreground">Ainda não tem conta? Peça acesso à equipe do NexON.</p>
            </form>
          )}

          {tela === "pedido" && user && abas.length > 1 && (
            <div
              className={cn("mx-4 mt-4 grid gap-1 rounded-xl bg-muted p-1", abas.length === 3 ? "grid-cols-3" : "grid-cols-2")}
              role="tablist"
              aria-label="Pedidos"
            >
              {abas.map(([id, rotulo, n]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={abaAtual === id}
                  onClick={() => setAba(id)}
                  className={cn(
                    "inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition",
                    abaAtual === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="truncate">{rotulo}</span>
                  {n > 0 && (
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold leading-none text-white">
                      {n > 9 ? "9+" : n}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {tela === "pedido" && user && meus && abaAtual === "meus" && <MeusPedidos meus={meus} portal={portal} />}

          {tela === "pedido" && sessao && suporte && abaAtual === "duvidas" && (
            <LunaDuvidas
              token={sessao.token}
              suporte={suporte}
              rascunho={rascunhoDuvida}
              onRascunhoUsado={() => setRascunhoDuvida("")}
              onSessaoVencida={sessaoVencida}
              onAbrirPedido={(texto) => {
                setTipo("Dúvida");
                if (texto && !descricao.trim()) setDescricao(texto);
                setAba("novo");
              }}
            />
          )}

          {tela === "pedido" && user && abaAtual === "novo" && (
            <form key="pedido" id="luna-pedido-form" className={cn("flex flex-col gap-5 p-4", ENTRADA)} onSubmit={enviar} noValidate>
              {!!meus?.counts.ready && (
                <button
                  type="button"
                  onClick={() => setAba("meus")}
                  className="-mb-1 flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-sm transition hover:bg-amber-500/15"
                >
                  <Hourglass className="size-4 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1">
                    {meus.counts.ready === 1 ? "1 pedido seu está pronto" : `${meus.counts.ready} pedidos seus estão prontos`} esperando sua conferência
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )}

              {/* Tipo em cartões: grade de 3, o texto quebra em duas linhas em vez de cortar ou sobrepor. */}
              <fieldset className="flex flex-col">
                <legend className="mb-2 text-sm font-medium">Sobre o que é?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(config?.form.kinds?.length ? config.form.kinds : TIPOS).map((k) => {
                    const t = TIPO_UI[k];
                    const Icone = t?.icone || CircleHelp;
                    const ativo = tipo === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setTipo(k)}
                        className={cn(
                          "relative flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1.5 py-2 text-center text-xs font-medium leading-tight transition duration-200 active:scale-[0.97]",
                          ativo
                            ? cn(t?.ativo || "border-[#70C04B] bg-[#70C04B]/10", "shadow-sm")
                            : "border-border text-muted-foreground hover:border-[color:color-mix(in_srgb,var(--foreground)_25%,transparent)] hover:text-foreground",
                        )}
                      >
                        <Icone className={cn("size-5 shrink-0 transition-transform duration-200", ativo && cn("scale-110", t?.icn))} />
                        <span className="break-words">{k}</span>
                        {ativo && (
                          <span className="absolute right-1 top-1 inline-flex size-4 items-center justify-center rounded-full bg-foreground text-background animate-in zoom-in-50 duration-200">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="luna-descricao" className="text-sm font-medium">
                  {ui.pergunta}
                </label>
                <textarea
                  id="luna-descricao"
                  className={cn(CAMPO, "min-h-[128px] resize-y leading-relaxed")}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={ui.dica}
                  maxLength={10000}
                  autoFocus={!celular}
                  onFocus={(e) => {
                    // Celular: espera o teclado subir e traz o campo para a parte visível da folha.
                    if (!celular) return;
                    const campo = e.currentTarget;
                    window.setTimeout(() => campo.scrollIntoView({ block: "nearest" }), 350);
                  }}
                />
                {tipo === "Dúvida" && suporte && (
                  <button
                    type="button"
                    onClick={() => {
                      setRascunhoDuvida(descricao.trim());
                      setAba("duvidas");
                    }}
                    className="flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-left text-sm transition hover:bg-sky-500/15"
                  >
                    <CircleHelp className="size-4 shrink-0 text-sky-500" />
                    <span className="min-w-0 flex-1">Dúvida de como usar? Pergunte na aba Dúvidas e receba a resposta na hora.</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
                {/* Medidor do mínimo: a pessoa sabe quanto falta sem tentar enviar. */}
                <div className="flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all duration-300", pronto ? "bg-[#70C04B]" : "bg-[color:color-mix(in_srgb,var(--muted-foreground)_40%,transparent)]")}
                      style={{ width: `${(pronto ? 1 : Math.min(1, qtd / minimo)) * 100}%` }}
                    />
                  </div>
                  <span className={cn("shrink-0 text-xs tabular-nums", pronto ? "text-[#177A3C] dark:text-[#70C04B]" : "text-muted-foreground")}>
                    {temAudio && qtd === 0 ? "Com áudio, texto opcional" : pronto ? "Pronto para enviar" : `Faltam ${minimo - qtd} caracteres`}
                  </span>
                </div>
              </div>

              {/* Isca para robô: escondida de gente e de leitor de tela, sempre vazia. */}
              <input ref={isca} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">Anexos</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {anexos.length} de {l.max}
                  </span>
                </div>

                {anexos.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {anexos.map((a) => {
                      const Icone = a.audio ? FileAudio : /^video\//.test(a.arquivo.type) ? FileVideo : FileText;
                      return (
                        <li
                          key={a.id}
                          className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-[color:color-mix(in_srgb,var(--muted)_30%,transparent)] p-1.5 pr-1 animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                          {a.previa ? (
                            <img src={a.previa} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-border" />
                          ) : (
                            <span
                              className={cn(
                                "inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
                                a.audio ? "bg-[#70C04B]/15 text-[#177A3C] dark:text-[#70C04B]" : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Icone className="size-5" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{a.audio ? `Áudio ${a.nome.match(/\d+/)?.[0] || ""}`.trim() : a.nome}</p>
                            <p className="text-xs text-muted-foreground">{a.audio ? relogio(a.duracao) : tamanho(a.tamanho)}</p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Tirar ${a.nome}`}
                            onClick={() => mudarAnexos(anexosRef.current.filter((x) => x.id !== a.id))}
                            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-[color:color-mix(in_srgb,var(--destructive)_10%,transparent)] hover:text-destructive sm:size-9"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {gravando ? (
                  <div
                    className="flex min-w-0 items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-1.5 pl-3 animate-in fade-in zoom-in-95 duration-200"
                    aria-live="polite"
                  >
                    <span className="relative inline-flex size-3 shrink-0">
                      <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/70" />
                      <span className="relative size-3 rounded-full bg-rose-500" />
                    </span>
                    <span className="flex h-5 shrink-0 items-end gap-0.5" aria-hidden>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className="w-1 animate-pulse rounded-full bg-rose-500"
                          style={{ height: `${[45, 90, 60, 100, 50][i]}%`, animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums">{relogio(gravando)}</span>
                    <button
                      type="button"
                      onClick={() => pararGravacao(true)}
                      className="min-h-11 shrink-0 rounded-lg px-2.5 text-sm text-muted-foreground transition hover:bg-[color:color-mix(in_srgb,var(--background)_60%,transparent)] hover:text-foreground sm:min-h-9"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => pararGravacao(false)}
                      className="min-h-11 shrink-0 rounded-lg bg-rose-500 px-3 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-[0.97] sm:min-h-9"
                    >
                      Concluir
                    </button>
                  </div>
                ) : (
                  <div className={cn("grid gap-2", podeGravar ? "grid-cols-2" : "grid-cols-1")}>
                    <button
                      type="button"
                      onClick={() => seletor.current?.click()}
                      className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition hover:border-[#70C04B] hover:bg-[#70C04B]/5 active:scale-[0.98]"
                    >
                      <Paperclip className="size-4 shrink-0" /> Anexar
                    </button>
                    {podeGravar && (
                      <button
                        type="button"
                        onClick={gravar}
                        className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition hover:border-rose-500 hover:bg-rose-500/5 active:scale-[0.98]"
                      >
                        <Mic className="size-4 shrink-0" /> Gravar áudio
                      </button>
                    )}
                  </div>
                )}
                {/* Sem `accept`: qualquer tipo de arquivo. */}
                <input
                  ref={seletor}
                  type="file"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    anexar(e.target.files);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {toque
                    ? "Fotos, prints, vídeos, documentos ou áudio. Com áudio, o texto fica opcional."
                    : "Dá para arrastar arquivos para qualquer parte desta janela ou colar um print com Ctrl+V. Com áudio, o texto fica opcional."}
                </p>
              </div>
            </form>
          )}

          {tela === "enviado" && (
            <div key="enviado" className={cn("flex flex-col items-center gap-3 px-6 py-8 text-center", ENTRADA)}>
              <span className="relative inline-flex size-16 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-[#70C04B]/30 animate-ping [animation-iteration-count:2]" aria-hidden />
                <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-[#70C04B] text-[#161633] animate-in zoom-in-50 duration-500">
                  <Check className="size-8" strokeWidth={3} />
                </span>
              </span>
              <div>
                <h3 className="text-lg font-semibold">Pedido enviado</h3>
                {user && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Em nome de <strong className="text-foreground">{user.name || user.email}</strong>. A equipe já recebeu.
                  </p>
                )}
              </div>
              {enviado.reference && (
                <button
                  type="button"
                  onClick={copiarNumero}
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-border bg-[color:color-mix(in_srgb,var(--muted)_40%,transparent)] px-3 text-sm transition hover:bg-muted sm:min-h-9"
                  title="Copiar número"
                >
                  <span className="text-muted-foreground">Número</span>
                  <span className="truncate font-mono font-semibold">{enviado.reference}</span>
                  {copiado ? <Check className="size-4 shrink-0 text-[#177A3C] dark:text-[#70C04B]" /> : <Copy className="size-4 shrink-0 text-muted-foreground" />}
                </button>
              )}
            </div>
          )}
        </div>

        {tela === "pedido" && user && meus && abaAtual === "meus" && (
          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border p-4">
            <a href={portal} target="_blank" rel="noopener noreferrer" className={BOTAO_SECUNDARIO}>
              Abrir o Luna <ExternalLink className="size-4" />
            </a>
            <button type="button" className={BOTAO_PRINCIPAL} onClick={() => setAba("novo")}>
              Novo pedido
            </button>
          </div>
        )}
        {tela === "pedido" && user && abaAtual === "novo" && (
          <div className="shrink-0 border-t border-border p-4">
            <button type="submit" form="luna-pedido-form" className={BOTAO_PRINCIPAL} disabled={ocupado || !!gravando}>
              {ocupado ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
              {ocupado ? "Enviando..." : anexos.length ? `Enviar com ${anexos.length} ${anexos.length === 1 ? "anexo" : "anexos"}` : "Enviar pedido"}
            </button>
          </div>
        )}
        {tela === "enviado" && (
          <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4">
            {enviado.portal_url && (
              <a href={enviado.portal_url} target="_blank" rel="noopener noreferrer" className={BOTAO_PRINCIPAL}>
                Acompanhar pedido <ExternalLink className="size-4" />
              </a>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => (setAba("novo"), setTela("pedido"))}>
                Outro pedido
              </button>
              {meus ? (
                <button type="button" className={BOTAO_SECUNDARIO} onClick={() => (setAba("meus"), setTela("pedido"))}>
                  Meus pedidos
                </button>
              ) : (
                <a href={portal} target="_blank" rel="noopener noreferrer" className={BOTAO_SECUNDARIO}>
                  Abrir o Luna
                </a>
              )}
            </div>
          </div>
        )}

        {/* Arrastando arquivo: a janela toda vira a área de soltar, sem caixa separada. */}
        {arrastando && (
          <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#70C04B] bg-[color:color-mix(in_srgb,var(--background)_90%,transparent)] p-6 text-center backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150">
            <span className="inline-flex size-14 items-center justify-center rounded-full bg-[#70C04B]/15 text-[#177A3C] dark:text-[#70C04B]">
              <CloudUpload className={cn("size-7", podeAnexar && "animate-bounce")} />
            </span>
            {podeAnexar ? (
              <>
                <p className="text-base font-semibold">Solte para anexar</p>
                <p className="text-sm text-muted-foreground">
                  Qualquer tipo de arquivo, até {l.max} por pedido e {tamanho(l.arquivo)} cada
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">Entre no Luna primeiro</p>
                <p className="text-sm text-muted-foreground">Depois de entrar, é só arrastar os arquivos de novo.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Aba "Meus pedidos": o que está pronto para conferir primeiro, depois o que anda. */
function MeusPedidos({ meus, portal }: { meus: LunaMeus; portal: string }) {
  const vazio = !meus.ready.length && !meus.open.length;
  return (
    <div className={cn("flex flex-col gap-5 p-4", ENTRADA)}>
      <div className="grid grid-cols-2 gap-2">
        <div className={cn("rounded-xl border p-3", meus.counts.ready ? "border-amber-500/40 bg-amber-500/10" : "border-border")}>
          <p className="text-2xl font-bold tabular-nums leading-none">{meus.counts.ready}</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{meus.counts.ready === 1 ? "pronto para conferir" : "prontos para conferir"}</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-2xl font-bold tabular-nums leading-none">{meus.counts.open}</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">em andamento</p>
        </div>
      </div>

      {meus.validation?.locked && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Confira os pedidos prontos para liberar novos pedidos.
        </p>
      )}

      {vazio && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </span>
          <p className="text-sm font-medium">Nada pendente por aqui</p>
          <p className="max-w-[260px] text-xs text-muted-foreground">Quando a equipe concluir um pedido seu, ele aparece aqui para você conferir.</p>
        </div>
      )}

      {meus.ready.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Prontos para você conferir</h3>
          <ul className="flex flex-col gap-2">
            {meus.ready.map((p) => (
              <li key={p.ref} className="animate-in fade-in slide-in-from-top-1 duration-200">
                <a
                  href={p.url || portal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-11 min-w-0 items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 transition hover:border-amber-500/60 hover:bg-amber-500/10"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{p.ref}</span>
                      {p.completed_at && ` · pronto ${haQuanto(p.completed_at)}`}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Conferir <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {meus.open.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Em andamento</h3>
          <ul className="flex flex-col gap-2">
            {meus.open.map((p) => (
              <li key={p.ref}>
                <a
                  href={p.url || portal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-11 min-w-0 flex-col gap-1.5 rounded-xl border border-border p-2.5 transition hover:border-[color:color-mix(in_srgb,var(--foreground)_25%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--muted)_40%,transparent)]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</p>
                    {p.status?.label && (
                      <span className="max-w-[45%] shrink-0 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {p.status.label}
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 font-mono">{p.ref}</span>
                    {typeof p.progress === "number" && (
                      <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-[#70C04B] transition-all" style={{ width: `${Math.max(4, Math.min(100, p.progress))}%` }} />
                      </span>
                    )}
                    {p.updated_at && <span className="shrink-0">{haQuanto(p.updated_at)}</span>}
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {meus.counts.open > meus.open.length && (
            <a href={portal} target="_blank" rel="noopener noreferrer" className={cn(LINK, "self-start text-sm")}>
              Ver todos os {meus.counts.open} no Luna
            </a>
          )}
        </section>
      )}
    </div>
  );
}
