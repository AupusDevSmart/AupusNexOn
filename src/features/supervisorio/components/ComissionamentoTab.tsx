import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { api } from "@/config/api";
import { equipamentosApi } from "@/services/equipamentos.services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, Circle, RefreshCw, ClipboardCheck, ChevronDown, ChevronRight } from "lucide-react";

/**
 * Aba COMISSIONAMENTO do sinóptico. NÚCLEO = conferência humana: o instalador compara os
 * principais dados que o NexON recebeu (do JSON de cada dispositivo) com o que o
 * equipamento mostra de verdade, e confirma. Depois de comissionado, o dado é confiável.
 * Abaixo, uma "sanidade automática" (checks de plausibilidade) como apoio. Backend
 * owner-scoped. Ver docs/IOT-NEXON-CONFIABILIDADE.md §3.2.
 */

type CheckStatus = "ok" | "alerta" | "falha" | "na";
interface CheckItem { chave: string; titulo: string; status: CheckStatus; detalhe: string; }
interface Grandeza { campo: string; label: string; valor: number | string | null; unidade: string; }
interface Preview { resumo: "ok" | "alerta" | "falha"; n_leituras: number; itens: CheckItem[]; grandezas?: Grandeza[]; equipamento?: any; }
interface PontoLista {
  equipamento_id: string; equipamento: string; tipo?: string; unidade?: string;
  status: string; comissionado_em?: string | null; comissionado_por_nome?: string | null;
}

const ICON: Record<CheckStatus, ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />,
  alerta: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
  falha: <XCircle className="h-4 w-4 text-red-600 shrink-0" />,
  na: <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
};

function statusBadge(status: string) {
  const map: Record<string, { txt: string; cls: string }> = {
    comissionado: { txt: "Comissionado", cls: "bg-green-500/15 text-green-600 border-green-500/30" },
    comissionado_com_ressalva: { txt: "Com ressalva", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    pendente: { txt: "Pendente", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] || map.pendente;
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${m.cls}`}>{m.txt}</span>;
}

/** Reduz a foto (canvas) antes de enviar — mantém o payload base64 leve. */
function fileParaDataUrl(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("img"));
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w = Math.round(w * r); h = Math.round(h * r); }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) { reject(new Error("ctx")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** URL absoluta da foto (o api roda em outro host que o app). */
function fotoSrc(url: string): string {
  try { return new URL((api.defaults.baseURL as string) || "").origin + url; } catch { return url; }
}

interface Conf { real: string; confere: boolean; }

export function ComissionamentoTab({
  unidadeId, unidadeNome, isAdmin = false,
}: { unidadeId: string; unidadeNome?: string; isAdmin?: boolean }) {
  const [lista, setLista] = useState<PontoLista[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [armazenado, setArmazenado] = useState<any>(null);
  const [carregandoDet, setCarregandoDet] = useState(false);
  const [obs, setObs] = useState("");
  const [conf, setConf] = useState<Record<string, Conf>>({});
  const [mostrarChecks, setMostrarChecks] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [orfaos, setOrfaos] = useState<Array<any>>([]);
  const [mostrarOrfaos, setMostrarOrfaos] = useState(false);
  const [removendoOrfao, setRemovendoOrfao] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<"environment" | "user">("environment");

  const carregarLista = useCallback(async () => {
    if (!unidadeId) return;
    setCarregandoLista(true); setErro(null);
    try {
      const resp = await api.get("/comissionamento", { params: { unidadeId } });
      setLista((resp.data?.data ?? resp.data ?? []) as PontoLista[]);
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Falha ao carregar pontos.");
    } finally { setCarregandoLista(false); }
  }, [unidadeId]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  const carregarOrfaos = useCallback(async () => {
    if (!unidadeId || !isAdmin) return;
    try { const resp = await api.get("/comissionamento/orfaos", { params: { unidadeId } }); setOrfaos(resp.data?.data ?? resp.data ?? []); } catch { /* silencioso */ }
  }, [unidadeId, isAdmin]);

  useEffect(() => { carregarOrfaos(); }, [carregarOrfaos]);

  const excluirOrfao = useCallback(async (id: string) => {
    setRemovendoOrfao(id); setErro(null);
    try { await equipamentosApi.remove(id); await carregarOrfaos(); await carregarLista(); }
    catch (e: any) { setErro(e?.response?.data?.message || "Falha ao excluir equipamento."); }
    finally { setRemovendoOrfao(null); }
  }, [carregarOrfaos, carregarLista]);

  const abrir = useCallback(async (equipamentoId: string) => {
    setSel(equipamentoId); setPreview(null); setArmazenado(null); setObs(""); setConf({}); setErro(null);
    setCarregandoDet(true);
    try {
      const resp = await api.get(`/comissionamento/${equipamentoId}`);
      const d = resp.data?.data ?? resp.data;
      setPreview(d?.preview ?? null);
      setArmazenado(d?.armazenado ?? null);
      // Semeia a conferência com as confirmações já registradas (se houver).
      const prev: any[] = d?.armazenado?.resultado?.confirmacoes ?? [];
      const seed: Record<string, Conf> = {};
      for (const c of prev) seed[c.campo] = { real: c.real != null ? String(c.real) : "", confere: !!c.confere };
      setConf(seed);
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Falha ao carregar dados do ponto.");
    } finally { setCarregandoDet(false); }
  }, []);

  // Refresh AO VIVO só do preview (grandezas + checks), sem mexer na conferência do usuário.
  const refreshPreview = useCallback(async (equipamentoId: string) => {
    try {
      const resp = await api.get(`/comissionamento/${equipamentoId}`);
      const d = resp.data?.data ?? resp.data;
      if (d?.preview) setPreview(d.preview);
    } catch { /* silencioso no refresh automático */ }
  }, []);

  // Enquanto um dispositivo está aberto, atualiza o valor do NexON a cada 15s → o
  // instalador varia a carga e vê o NexON acompanhar (confere se bate com a realidade).
  useEffect(() => {
    if (!sel) return;
    const t = setInterval(() => refreshPreview(sel), 15000);
    return () => clearInterval(t);
  }, [sel, refreshPreview]);

  const grandezas = preview?.grandezas ?? [];
  const liveness = preview?.itens.find((i) => i.chave === "liveness");
  const setCampo = (campo: string, patch: Partial<Conf>) =>
    setConf((c) => ({ ...c, [campo]: { real: c[campo]?.real ?? "", confere: c[campo]?.confere ?? false, ...patch } }));
  const marcarTudo = () => {
    const next: Record<string, Conf> = {};
    for (const g of grandezas) next[g.campo] = { real: conf[g.campo]?.real ?? "", confere: true };
    setConf(next);
  };
  const todosConferem = grandezas.length > 0 && grandezas.every((g) => conf[g.campo]?.confere);

  const comissionar = useCallback(async (forcar = false) => {
    if (!sel) return;
    setSalvando(true); setErro(null);
    try {
      const confirmacoes = grandezas.map((g) => ({
        campo: g.campo, label: g.label, nexon: g.valor,
        real: conf[g.campo]?.real ? conf[g.campo].real : null,
        confere: !!conf[g.campo]?.confere,
      }));
      await api.post(`/comissionamento/${sel}/comissionar`, { observacoes: obs || undefined, forcar, confirmacoes });
      await carregarLista();
      await abrir(sel);
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Falha ao comissionar.");
    } finally { setSalvando(false); }
  }, [sel, obs, grandezas, conf, carregarLista, abrir]);

  const fotos: Array<{ url: string; nome?: string | null; por?: string | null; em?: string }> =
    Array.isArray(armazenado?.fotos) ? armazenado.fotos : [];

  const recarregarStatus = useCallback(async (id: string) => {
    try { const resp = await api.get(`/comissionamento/${id}`); const d = resp.data?.data ?? resp.data; setArmazenado(d?.armazenado ?? null); } catch { /* silencioso */ }
  }, []);

  const onSelecionarFotos = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!sel || !files.length) return;
    setEnviandoFoto(true); setErro(null);
    try {
      for (const f of files) {
        const dataUrl = await fileParaDataUrl(f);
        await api.post(`/comissionamento/${sel}/foto`, { dataUrl, nome: f.name });
      }
      await recarregarStatus(sel);
    } catch (err: any) {
      setErro(err?.response?.data?.message || "Falha ao enviar foto.");
    } finally { setEnviandoFoto(false); }
  }, [sel, recarregarStatus]);

  const removerFoto = useCallback(async (url: string) => {
    if (!sel) return;
    setErro(null);
    try { await api.delete(`/comissionamento/${sel}/foto`, { data: { url } }); await recarregarStatus(sel); }
    catch (err: any) { setErro(err?.response?.data?.message || "Falha ao remover foto."); }
  }, [sel, recarregarStatus]);

  const fecharCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraAberta(false);
  }, []);

  const abrirCamera = useCallback(async () => {
    setErroCamera(null); setErro(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Câmera não disponível neste dispositivo/navegador — use 'Da galeria'.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingRef.current } }, audio: false });
      streamRef.current = stream;
      setCameraAberta(true);
    } catch {
      setErro("Não foi possível abrir a câmera (permissão negada?). Use 'Da galeria'.");
    }
  }, []);

  // Liga o stream ao <video> quando a câmera abre.
  useEffect(() => {
    if (cameraAberta && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraAberta]);

  // Para a câmera ao desmontar.
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const capturarCamera = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !sel || !v.videoWidth) return;
    const maxDim = 1280;
    let w = v.videoWidth, h = v.videoHeight;
    if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w = Math.round(w * r); h = Math.round(h * r); }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", 0.7);
    setEnviandoFoto(true); setErroCamera(null);
    try {
      await api.post(`/comissionamento/${sel}/foto`, { dataUrl, nome: "camera.jpg" });
      await recarregarStatus(sel);
      fecharCamera();
    } catch (err: any) {
      setErroCamera(err?.response?.data?.message || "Falha ao enviar foto.");
    } finally { setEnviandoFoto(false); }
  }, [sel, recarregarStatus, fecharCamera]);

  const trocarCamera = useCallback(async () => {
    facingRef.current = facingRef.current === "environment" ? "user" : "environment";
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingRef.current } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
    } catch { setErroCamera("Não foi possível trocar de câmera."); }
  }, []);

  const selPonto = lista.find((p) => p.equipamento_id === sel);
  const reprovado = preview?.resumo === "falha";
  const nChecksRuins = useMemo(() => (preview?.itens ?? []).filter((i) => i.status === "falha" || i.status === "alerta").length, [preview]);

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-semibold">Comissionamento — {unidadeNome || "unidade"}</h2>
        <Button variant="outline" size="sm" className="ml-auto" onClick={carregarLista} disabled={carregandoLista}>
          <RefreshCw className={`h-4 w-4 mr-1 ${carregandoLista ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {erro && <div className="mb-3 text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{erro}</div>}

      {isAdmin && orfaos.length > 0 && (
        <div className="mb-3 rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-2">
          <button onClick={() => setMostrarOrfaos((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-purple-700 dark:text-purple-300">
            {mostrarOrfaos ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            ⚑ {orfaos.length} equipamento(s) fantasma (fora do diagrama, sem dado)
          </button>
          {mostrarOrfaos && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Sobras de exclusão/migração que o unifilar não mostra. Excluir faz soft-delete + desinscreve do MQTT.
              </p>
              {orfaos.map((o) => (
                <div key={o.equipamento_id} className="flex items-center gap-2 text-sm bg-background/60 rounded px-2 py-1">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{o.equipamento}</span>
                    <span className="text-muted-foreground"> · {o.tipo || "—"} · <span className="text-xs break-all">{o.topico}</span></span>
                  </div>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-500/40 shrink-0"
                    disabled={removendoOrfao === o.equipamento_id}
                    onClick={() => excluirOrfao(o.equipamento_id)}>
                    {removendoOrfao === o.equipamento_id ? "Excluindo..." : "Excluir"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_1fr] gap-4">
        {/* Lista de dispositivos */}
        <Card className="h-fit">
          <CardHeader className="py-3"><CardTitle className="text-sm">Dispositivos ({lista.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {lista.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 py-6 text-center">
                {carregandoLista ? "Carregando..." : "Nenhum ponto monitorável nesta unidade."}
              </p>
            ) : (
              <div className="divide-y">
                {lista.map((p) => (
                  <button key={p.equipamento_id} onClick={() => abrir(p.equipamento_id)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-2 ${sel === p.equipamento_id ? "bg-muted" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.equipamento}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.tipo || "—"}</p>
                    </div>
                    {statusBadge(p.status)}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conferência do dispositivo */}
        <Card className="h-fit">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {selPonto ? selPonto.equipamento : "Selecione um dispositivo"}
              {selPonto && statusBadge(selPonto.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!sel ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Clique num dispositivo à esquerda pra conferir os dados que o NexON recebeu contra o equipamento real.
              </p>
            ) : carregandoDet ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Carregando dados...</p>
            ) : (
              <>
                {armazenado && (
                  <div className="mb-3 text-xs text-muted-foreground">
                    Último comissionamento: <strong>{statusBadge(armazenado.status)}</strong>
                    {armazenado.comissionado_em ? ` em ${new Date(armazenado.comissionado_em).toLocaleString("pt-BR")}` : ""}
                    {armazenado.comissionado_por_nome ? ` por ${armazenado.comissionado_por_nome}` : ""}
                  </div>
                )}

                {/* CONFERÊNCIA — núcleo */}
                <p className="text-sm font-medium mb-1">Conferência dos dados</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Compare cada valor com o que o equipamento mostra no display. Marque ✓ quando bater (o "Real" é opcional, pra registro).
                </p>
                {liveness && (
                  <div className={`text-xs mb-2 flex items-center gap-1.5 ${liveness.status === "ok" ? "text-green-600" : "text-amber-600"}`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${liveness.status === "ok" ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
                    {liveness.status === "ok" ? "Ao vivo" : "Sem dado recente"} — {liveness.detalhe} (atualiza a cada 15s)
                  </div>
                )}
                {grandezas.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
                    Sem leitura recente pra conferir — verifique a sanidade automática abaixo (provável equipamento offline).
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left py-1.5 pr-2 font-medium">Grandeza</th>
                            <th className="text-right py-1.5 px-2 font-medium">NexON (ao vivo)</th>
                            <th className="text-right py-1.5 px-2 font-medium">Real (equipamento)</th>
                            <th className="text-center py-1.5 pl-2 font-medium">Confere</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grandezas.map((g) => (
                            <tr key={g.campo} className="border-b last:border-0">
                              <td className="py-1.5 pr-2">{g.label}</td>
                              <td className="py-1.5 px-2 text-right font-medium tabular-nums whitespace-nowrap">
                                {g.valor ?? "—"} <span className="text-muted-foreground font-normal">{g.unidade}</span>
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <input type="text" inputMode="decimal" disabled={!isAdmin}
                                  value={conf[g.campo]?.real ?? ""}
                                  onChange={(e) => setCampo(g.campo, { real: e.target.value })}
                                  placeholder="—"
                                  className="w-24 text-right text-sm rounded border border-border bg-background px-1.5 py-0.5 disabled:opacity-50" />
                              </td>
                              <td className="py-1.5 pl-2 text-center">
                                <input type="checkbox" disabled={!isAdmin} className="h-4 w-4 accent-green-600"
                                  checked={!!conf[g.campo]?.confere}
                                  onChange={(e) => setCampo(g.campo, { confere: e.target.checked })} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {isAdmin && (
                      <button onClick={marcarTudo} className="mt-2 text-xs text-blue-600 hover:underline">Marcar tudo como confere</button>
                    )}
                  </>
                )}

                {/* SANIDADE AUTOMÁTICA — apoio, recolhível */}
                <button onClick={() => setMostrarChecks((v) => !v)}
                  className="mt-4 flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                  {mostrarChecks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Sanidade automática {preview && nChecksRuins > 0 ? <span className="text-amber-600">({nChecksRuins} a revisar)</span> : ""}
                </button>
                {mostrarChecks && preview && (
                  <ul className="mt-2 space-y-1.5 pl-1">
                    {preview.itens.map((it) => (
                      <li key={it.chave} className="flex items-start gap-2 text-sm">
                        {ICON[it.status]}
                        <div><span className="font-medium">{it.titulo}</span><span className="text-muted-foreground"> — {it.detalhe}</span></div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* FOTOS DE PROVA */}
                <div className="mt-4 border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Fotos de prova {fotos.length ? `(${fotos.length})` : ""}</span>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button onClick={abrirCamera} disabled={enviandoFoto}
                          className={`text-xs px-2 py-1 rounded border ${enviandoFoto ? "opacity-50" : "hover:bg-muted"}`}>
                          📷 Tirar foto
                        </button>
                        <label className={`text-xs px-2 py-1 rounded border cursor-pointer ${enviandoFoto ? "opacity-50 pointer-events-none" : "hover:bg-muted"}`}>
                          🖼️ Da galeria
                          <input type="file" accept="image/*" multiple className="hidden" onChange={onSelecionarFotos} disabled={enviandoFoto} />
                        </label>
                      </div>
                    )}
                  </div>
                  {fotos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma foto. Fotografe o display do equipamento ao lado do valor do NexON como prova.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {fotos.map((f) => (
                        <div key={f.url} className="relative group">
                          <a href={fotoSrc(f.url)} target="_blank" rel="noreferrer">
                            <img src={fotoSrc(f.url)} alt={f.nome || "foto"} className="w-full h-24 object-cover rounded border border-border" />
                          </a>
                          {isAdmin && (
                            <button onClick={() => removerFoto(f.url)} title="Remover"
                              className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs leading-none opacity-0 group-hover:opacity-100">×</button>
                          )}
                          {f.em && <span className="block text-[10px] text-muted-foreground truncate mt-0.5">{new Date(f.em).toLocaleString("pt-BR")}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AÇÃO */}
                {isAdmin ? (
                  <div className="mt-4 border-t pt-3">
                    <textarea value={obs} onChange={(e) => setObs(e.target.value)}
                      placeholder="Observações (opcional)"
                      className="w-full text-sm rounded-md border border-border bg-background px-2 py-1.5 mb-2" rows={2} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" onClick={() => comissionar(false)} disabled={salvando || (grandezas.length > 0 && !todosConferem && !reprovado)}>
                        {salvando ? "Salvando..." : "Comissionar"}
                      </Button>
                      {reprovado && (
                        <Button size="sm" variant="outline" onClick={() => comissionar(true)} disabled={salvando}
                          className="text-red-600 border-red-500/40">Forçar (com ressalva)</Button>
                      )}
                      {grandezas.length > 0 && !todosConferem && !reprovado && (
                        <span className="text-xs text-muted-foreground">Marque ✓ em todas as grandezas pra comissionar.</span>
                      )}
                      {reprovado && <span className="text-xs text-red-600">Sanidade reprovada — corrija ou force com justificativa.</span>}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground border-t pt-3">Apenas administradores registram o comissionamento.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {cameraAberta && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-4">
          <video ref={videoRef} autoPlay playsInline muted className="max-h-[72vh] max-w-full rounded-lg bg-black" />
          {erroCamera && <p className="text-red-400 text-sm mt-2">{erroCamera}</p>}
          <div className="mt-4 flex items-center gap-3">
            <Button variant="outline" onClick={fecharCamera} className="bg-background">Cancelar</Button>
            <Button onClick={capturarCamera} disabled={enviandoFoto}>{enviandoFoto ? "Enviando..." : "📷 Capturar"}</Button>
            <Button variant="outline" onClick={trocarCamera} className="bg-background" title="Alternar câmera">↺ Virar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
