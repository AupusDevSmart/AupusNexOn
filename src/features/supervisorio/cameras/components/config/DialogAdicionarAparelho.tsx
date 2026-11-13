import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, Loader2, Wifi } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { chavesCameras } from '../../hooks/chaves';
import { usePareamentosProximos } from '../../hooks/useConfigCameras';
import { CamerasService } from '../../services/cameras.service';
import { mensagemErro } from '../../utils/erros';
import { Campo } from './Campo';

interface Props {
  unidadeId: string;
  aberto: boolean;
  onFechar: () => void;
}

/**
 * "Adicionar aparelho" (NEXON-108): lista os aparelhos pedindo pareamento nesta rede
 * (consulta a cada 5 s) e aceita o código de 6 dígitos da página do aparelho. Ninguém copia token.
 */
export function DialogAdicionarAparelho({ unidadeId, aberto, onFechar }: Props) {
  const proximos = usePareamentosProximos(aberto);
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (!aberto) {
      setCodigo('');
      setNome('');
    }
  }, [aberto]);

  const vincular = useMutation({
    mutationFn: (cod: string) =>
      CamerasService.vincularPareamento({ codigo: cod, unidade_id: unidadeId, ...(nome.trim() ? { nome: nome.trim() } : {}) }),
    onSuccess: (r) => {
      toast.success(r?.agente?.nome ? `Aparelho ${r.agente.nome} vinculado` : 'Aparelho vinculado', {
        description: 'Em alguns segundos ele fica online e começa a procurar as câmeras.',
      });
      void queryClient.invalidateQueries({ queryKey: chavesCameras.agentes(unidadeId) });
      void queryClient.invalidateQueries({ queryKey: chavesCameras.pareamentos });
      onFechar();
    },
    onError: (e) => toast.error(mensagemErro(e, 'Código não encontrado ou expirado')),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (codigo.length === 6) vincular.mutate(codigo);
  };

  const lista = proximos.data ?? [];

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !vincular.isPending && onFechar()}>
      <DialogContent className="gap-5 p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Adicionar aparelho</DialogTitle>
          <DialogDescription>
            Ligue o aparelho (Raspberry ou mini-PC com a imagem do NexON) na rede das câmeras. Com este computador na mesma
            rede, ele aparece aqui sozinho.
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby="aparelhos-proximos" className="flex flex-col gap-2">
          <h3 id="aparelhos-proximos" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Nesta rede
          </h3>
          {lista.length === 0 ? (
            <p role="status" className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              Procurando aparelhos nesta rede…
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.map((p) => (
                <li key={p.codigo} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Aparelho encontrado nesta rede: {p.host}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Código {p.codigo}
                      {p.ip_local ? ` · ${p.ip_local}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    aria-label={`Vincular ${p.host}`}
                    disabled={vincular.isPending}
                    onClick={() => vincular.mutate(p.codigo)}
                  >
                    {vincular.isPending && vincular.variables === p.codigo && <Loader2 className="animate-spin" aria-hidden />}
                    Vincular
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={enviar} className="flex flex-col gap-3 border-t border-border pt-4">
          <Campo rotulo="Ou digite o código de 6 dígitos" htmlFor="pareamento-codigo" dica="Aparece na página do aparelho: http://<ip-do-aparelho>:8080">
            <div className="flex gap-2">
              <Input
                id="pareamento-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="min-w-0 flex-1 font-mono text-base tracking-[0.3em]"
              />
              <Button type="submit" aria-label="Vincular pelo código" disabled={codigo.length !== 6 || vincular.isPending}>
                {vincular.isPending && vincular.variables === codigo && <Loader2 className="animate-spin" aria-hidden />}
                Vincular
              </Button>
            </div>
          </Campo>
          <Campo rotulo="Nome (opcional)" htmlFor="pareamento-nome" dica="Sem nome, usa o nome do aparelho na rede.">
            <Input id="pareamento-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Raspberry da cabine" />
          </Campo>
        </form>

        <p className="flex items-start gap-2 text-[11px] leading-snug text-muted-foreground">
          <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Não apareceu? Confira se o aparelho tem internet e se você está na mesma rede (ou use o código).
        </p>
      </DialogContent>
    </Dialog>
  );
}
