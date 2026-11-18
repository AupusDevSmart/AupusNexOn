import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { chavesCameras } from '../../hooks/chaves';
import { CamerasService } from '../../services/cameras.service';
import type { Agente, Camera, CameraDescoberta } from '../../types';
import { mensagemErro } from '../../utils/erros';
import { rotuloFabricante } from '../../utils/sensibilidade';
import { CAIXA_VERDE } from './EtapasAssistente';

/**
 * NEXON-108: gravador (NVR Intelbras/Dahua) encontrado na rede. Um IP com vários canais: cada canal escolhido
 * vira uma câmera (mesmo IP, usuário e senha do NVR, campo `canal`). Os canais já cadastrados vêm marcados e
 * travados. Cada cadastro passa pela mesma rota (e auditoria) da câmera comum.
 */
export function DialogCanaisNvr({
  unidadeId,
  agente,
  descoberta: d,
  cameras,
  onFechar,
}: {
  unidadeId: string;
  agente: Agente;
  descoberta: CameraDescoberta;
  cameras: Camera[];
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const jaTem = useMemo(() => new Set(cameras.filter((c) => c.ip === d.ip).map((c) => c.canal)), [cameras, d.ip]);
  const [total, setTotal] = useState(String(Math.max(d.canais_sugeridos ?? 4, ...[...jaTem])));
  const [usuario, setUsuario] = useState('admin');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('Câmera');
  const n = Math.min(64, Math.max(1, Number(total) || 1));
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set());
  const [salvando, setSalvando] = useState(false);
  const canais = Array.from({ length: n }, (_, i) => i + 1);
  const livres = canais.filter((c) => !jaTem.has(c));
  const escolhidos = livres.filter((c) => marcados.has(c));
  const titulo = [rotuloFabricante(d.fabricante) ?? 'Gravador', d.modelo].filter(Boolean).join(' ');

  const alternar = (c: number) =>
    setMarcados((m) => {
      const x = new Set(m);
      if (x.has(c)) x.delete(c);
      else x.add(c);
      return x;
    });

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!escolhidos.length || !senha) return;
    setSalvando(true);
    let ok = 0;
    const falhas: string[] = [];
    for (const canal of escolhidos) {
      try {
        await CamerasService.criar({
          unidade_id: unidadeId,
          nome: `${nome.trim() || 'Câmera'} ${canal}`,
          ip: d.ip,
          usuario: usuario.trim() || 'admin',
          senha,
          canal,
          porta_rtsp: d.porta_rtsp ?? undefined,
          porta_http: d.porta_http ?? undefined,
          fabricante: d.fabricante,
          modelo: d.modelo,
          agente_id: agente.id,
        });
        ok++;
      } catch (err) {
        falhas.push(`canal ${canal}: ${mensagemErro(err, 'não entrou')}`);
      }
    }
    setSalvando(false);
    void queryClient.invalidateQueries({ queryKey: chavesCameras.tudo });
    if (ok) toast.success(`${ok} ${ok === 1 ? 'canal adicionado' : 'canais adicionados'} do ${titulo}`);
    if (falhas.length) toast.error(falhas.join(' · '));
    else onFechar();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[min(560px,calc(100vw-2rem))] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar canais do gravador</DialogTitle>
          <DialogDescription>
            {titulo} · {d.ip}. Cada canal escolhido vira uma câmera no NexON; o gravador continua gravando como antes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nvr-usuario">Usuário do gravador</Label>
              <Input id="nvr-usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="off" className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nvr-senha">Senha do gravador</Label>
              <Input id="nvr-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nvr-total">Quantos canais ele tem</Label>
              <Input id="nvr-total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, '').slice(0, 2))} className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nvr-nome">Nome das câmeras</Label>
              <Input id="nvr-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="h-11" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Canais</p>
              <button
                type="button"
                className="min-h-10 text-sm font-medium underline-offset-4 mouse:hover:underline"
                onClick={() => setMarcados(new Set(escolhidos.length === livres.length ? [] : livres))}
              >
                {escolhidos.length === livres.length && livres.length ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <div role="group" aria-label="Canais do gravador" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {canais.map((c) => {
                const tem = jaTem.has(c);
                const sel = tem || marcados.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    role="checkbox"
                    aria-checked={sel}
                    aria-label={tem ? `Canal ${c} (já adicionado)` : `Canal ${c}`}
                    disabled={tem}
                    onClick={() => alternar(c)}
                    className={cn(
                      'flex h-11 items-center justify-center gap-1 rounded-lg border text-sm font-semibold tabular-nums transition-colors disabled:cursor-not-allowed',
                      sel ? cn('border-nexon-verde', CAIXA_VERDE) : 'border-border mouse:hover:border-muted-foreground',
                      tem && 'opacity-60',
                    )}
                  >
                    {sel && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                    {c}
                  </button>
                );
              })}
            </div>
            {jaTem.size > 0 && <p className="text-xs text-muted-foreground">Os canais apagados já estão no NexON.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="h-11" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="h-11 gap-1.5" disabled={!escolhidos.length || !senha || salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Adicionar {escolhidos.length || ''} {escolhidos.length === 1 ? 'canal' : 'canais'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
