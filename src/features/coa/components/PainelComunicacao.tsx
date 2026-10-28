import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Unplug, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Alerta de "Comunicação" do COA (equipe): ícone ao lado de "Atualizar" que pisca quando algo
 * caiu nos últimos 7 dias; o detalhe abre num diálogo. Tudo comunicando → não aparece.
 * O que está fora AGORA, separando a causa:
 *  - TON fora → internet/energia/a própria TON; os equipamentos dela caem junto (listados).
 *  - Equipamento sem dado com a TON viva → problema no equipamento/Modbus/cabo, não na internet.
 * Fonte: GET /alarmes-comunicacao/painel (mesma varredura dos alarmes, a cada 2 min).
 */
interface ItemBase {
  equipamento_id: string;
  nome: string;
  nome_completo: string;
  planta: string;
  unidade: string;
  unidade_id: string;
  desde: string;
}
interface TonFora extends ItemBase { afetados: string[] }
interface EqSemDado extends ItemBase {
  familia: string;
  ton: { nome: string; ultimo_sinal: string | null; online: boolean | null } | null;
}
interface Painel { tons: TonFora[]; equipamentos: EqSemDado[]; ignorados: number; atualizado_em: string }

const RECENTE_MS = 7 * 86_400_000;

function ha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} dias`;
}

const FAMILIA: Record<string, string> = { inversor: 'Inversor', medidor: 'Medidor', gateway: 'Gateway', rele: 'Relé', outro: 'Equipamento' };

export function PainelComunicacao() {
  const [dados, setDados] = useState<Painel | null>(null);
  const [aberto, setAberto] = useState(false);
  const [verAntigos, setVerAntigos] = useState(false);
  const [ignorando, setIgnorando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r: any = await api.get('/alarmes-comunicacao/painel');
      setDados((r?.data?.data ?? r?.data) as Painel);
    } catch {
      /* sem permissão ou fora do ar: o quadro simplesmente não aparece */
    }
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 120_000);
    return () => clearInterval(t);
  }, [carregar]);

  const ignorar = async (it: ItemBase) => {
    if (!confirm(`Ignorar a comunicação de "${it.nome_completo}" (${it.unidade})?\nEle sai deste quadro e dos alarmes até voltar a ser monitorado.`)) return;
    setIgnorando(it.equipamento_id);
    try {
      await api.put(`/alarmes-comunicacao/ignorar/${encodeURIComponent(it.equipamento_id)}`, { ignorar: true });
      toast.success(`${it.nome} ignorado`);
      await carregar();
    } catch {
      toast.error('Não foi possível ignorar');
    } finally {
      setIgnorando(null);
    }
  };

  if (!dados) return null;

  const recente = (i: ItemBase) => Date.now() - new Date(i.desde).getTime() < RECENTE_MS;
  const tonsR = dados.tons.filter(recente);
  const eqsR = dados.equipamentos.filter(recente);
  const antigos = [...dados.tons, ...dados.equipamentos].filter((i) => !recente(i));
  const semRecentes = tonsR.length === 0 && eqsR.length === 0;
  if (semRecentes && antigos.length === 0) return null;

  // Planta e unidade com o mesmo nome (UFV de uma unidade só) → mostra uma vez.
  const local = (it: ItemBase) => (it.planta === it.unidade ? it.planta : `${it.planta} · ${it.unidade}`);
  const resumo = semRecentes
    ? `${antigos.length} fora há mais de 7 dias`
    : `${tonsR.length} ${tonsR.length === 1 ? 'TON fora' : 'TONs fora'} · ${eqsR.length} ${eqsR.length === 1 ? 'equipamento sem dado' : 'equipamentos sem dado'}`;

  const linkUnidade = (it: ItemBase) => `/supervisorio/sinoptico-ativo/${encodeURIComponent(it.unidade_id)}`;
  const BtnIgnorar = ({ it }: { it: ItemBase }) => (
    <button type="button" onClick={() => void ignorar(it)} disabled={ignorando === it.equipamento_id}
      className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50">
      Ignorar
    </button>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)} aria-label={`Comunicação: ${resumo}`} title={`Comunicação: ${resumo}`}
        className={semRecentes ? 'text-muted-foreground' : 'border-red-500/50 text-red-600 dark:text-red-400'}>
        <AlertTriangle className={`h-4 w-4 ${semRecentes ? '' : 'motion-safe:animate-pulse'}`} />
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle className="text-base">Comunicação</DialogTitle>
            <DialogDescription className="text-xs">{resumo}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            {!semRecentes && (
              <div className="grid gap-px bg-border md:grid-cols-2">
                <div className="bg-card p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                    <WifiOff className="h-3.5 w-3.5" /> TON fora
                  </div>
                  {tonsR.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma.</p> : (
                    <ul className="space-y-2">
                      {tonsR.map((t) => (
                        <li key={t.equipamento_id} className="text-sm">
                          <div className="flex items-baseline gap-2">
                            <Link to={linkUnidade(t)} className="font-medium hover:underline">{t.nome}</Link>
                            <span className="text-xs text-muted-foreground">{local(t)}</span>
                            <span className="ml-auto text-xs tabular-nums text-red-700 dark:text-red-300">há {ha(t.desde)}</span>
                          </div>
                          {t.afetados.length > 0 && (
                            <div className="text-xs text-muted-foreground">derruba {t.afetados.length}: {t.afetados.join(', ')}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-card p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <Unplug className="h-3.5 w-3.5" /> Equipamento sem dado · TON online
                  </div>
                  {eqsR.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum.</p> : (
                    <ul className="space-y-2">
                      {eqsR.map((e) => (
                        <li key={e.equipamento_id} className="text-sm">
                          <div className="flex items-baseline gap-2">
                            <Link to={linkUnidade(e)} className="font-medium hover:underline">{e.nome}</Link>
                            <span className="text-xs text-muted-foreground">{FAMILIA[e.familia] ?? 'Equipamento'} · {local(e)}</span>
                            <span className="ml-auto text-xs tabular-nums text-amber-700 dark:text-amber-300">há {ha(e.desde)}</span>
                          </div>
                          {e.ton && (
                            <div className="text-xs text-muted-foreground">
                              TON {e.ton.nome}: último sinal há {ha(e.ton.ultimo_sinal)}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {antigos.length > 0 && (
              <div className="border-t px-4 py-2">
                <button type="button" aria-expanded={verAntigos} onClick={() => setVerAntigos((v) => !v)}
                  className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verAntigos ? 'rotate-180' : ''}`} />
                  Fora há mais de 7 dias ({antigos.length})
                  {dados.ignorados > 0 && <span className="ml-auto">{dados.ignorados} ignorados</span>}
                </button>
                {verAntigos && (
                  <ul className="mt-2 space-y-1.5 pb-1">
                    {antigos.map((a) => (
                      <li key={a.equipamento_id} className="flex items-baseline gap-2 text-sm">
                        <Link to={linkUnidade(a)} className="hover:underline">{a.nome}</Link>
                        <span className="text-xs text-muted-foreground">{local(a)}</span>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">há {ha(a.desde)}</span>
                        <BtnIgnorar it={a} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PainelComunicacao;
