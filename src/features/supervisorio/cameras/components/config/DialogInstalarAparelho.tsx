import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, Laptop, Loader2, Usb } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CamerasService } from '../../services/cameras.service';
import { mensagemErro } from '../../utils/erros';

type Jeito = 'pc' | 'pendrive';

/**
 * Instalar o NexON num Raspberry novo (NEXON-108). Dois jeitos, a mesma imagem:
 * - pelo computador: cabo USB-C do PC no Raspberry; um comando no Terminal grava direto no SD de dentro dele;
 * - pelo pendrive: grava a imagem no pendrive, liga no Raspberry com SD; ele copia tudo para o SD e desliga.
 * Depois dos dois: Adicionar aparelho › Vincular.
 */
export function DialogInstalarAparelho({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [jeito, setJeito] = useState<Jeito>('pc');
  const [copiado, setCopiado] = useState(false);
  const info = useQuery({
    queryKey: ['cameras', 'instalador'],
    queryFn: () => CamerasService.instalador(),
    enabled: aberto,
    staleTime: 30 * 60_000,
  });

  const copiar = async () => {
    if (!info.data) return;
    try {
      await navigator.clipboard.writeText(info.data.comando);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o comando continua visível para selecionar */
    }
  };

  const gb = info.data ? (info.data.tamanho / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '';

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[min(640px,calc(100vw-2rem))] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Instalar o NexON num Raspberry novo</DialogTitle>
          <DialogDescription>
            Uma vez só por aparelho. Depois tudo é pela web: vincular, câmeras e atualizações.
            {info.data && ` Versão ${info.data.versao}.`}
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Como instalar" className="grid grid-cols-2 gap-2">
          <Opcao ativo={jeito === 'pc'} onClick={() => setJeito('pc')} icone={<Laptop className="h-5 w-5" aria-hidden />} titulo="Pelo computador" dica="Cabo USB-C, grava no SD de dentro" />
          <Opcao ativo={jeito === 'pendrive'} onClick={() => setJeito('pendrive')} icone={<Usb className="h-5 w-5" aria-hidden />} titulo="Pelo pendrive" dica="Ele copia sozinho para o SD" />
        </div>

        {info.isPending ? (
          <div role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Preparando o instalador…
          </div>
        ) : info.isError ? (
          <p role="alert" className="py-4 text-sm text-red-500">
            {mensagemErro(info.error, 'Não foi possível preparar o instalador.')}
          </p>
        ) : jeito === 'pc' ? (
          <ol className="flex flex-col gap-3 text-sm">
            <Passo n={1}>Raspberry desligado da fonte, com o cartão SD dentro.</Passo>
            <Passo n={2}>
              No Mac (ou Linux), abra o <strong>Terminal</strong>, cole este comando e aperte Enter:
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-black p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-zinc-200">{info.data?.comando}</code>
                <Button type="button" size="sm" variant="outline" className="h-9 shrink-0 gap-1.5" onClick={() => void copiar()}>
                  {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">
                O comando vale por 2 horas. Na primeira vez ele baixa a imagem (~{gb} GB) e o programa da Raspberry (no Mac precisa do Homebrew).
              </span>
            </Passo>
            <Passo n={3}>
              Quando ele pedir: <strong>segure o botão de ligar</strong> do Raspberry, ligue o <strong>cabo USB-C do computador</strong> nele e solte o botão.
            </Passo>
            <Passo n={4}>Confirme com SIM. A gravação leva de 5 a 15 minutos (pode pedir a senha do computador).</Passo>
            <Passo n={5}>Tire do computador, ligue na fonte e no cabo de rede das câmeras.</Passo>
          </ol>
        ) : (
          <ol className="flex flex-col gap-3 text-sm">
            <Passo n={1}>
              Baixe a imagem do NexON (~{gb} GB):
              <div className="mt-2">
                <Button asChild size="sm" className="h-10 gap-1.5">
                  <a href={info.data?.url_imagem} download>
                    <Download className="h-4 w-4" aria-hidden />
                    Baixar imagem
                  </a>
                </Button>
              </div>
            </Passo>
            <Passo n={2}>
              Grave no pendrive com o <strong>Raspberry Pi Imager</strong>: Sistema › <em>Usar personalizado</em> › a imagem baixada. Quando ele perguntar se quer
              personalizar, responda <strong>Não</strong>.
            </Passo>
            <Passo n={3}>Pendrive no Raspberry (com o SD dentro), cabo de rede e fonte. Precisa de internet.</Passo>
            <Passo n={4}>
              Ele copia tudo para o SD e <strong>desliga sozinho</strong> (cerca de 10 minutos; a luz verde para de piscar).
            </Passo>
            <Passo n={5}>Tire o pendrive e ligue de novo. Sem SD dentro, ele roda direto do pendrive.</Passo>
          </ol>
        )}

        <p className="rounded-lg border border-[color-mix(in_srgb,var(--nx-verde)_45%,transparent)] bg-[color-mix(in_srgb,var(--nx-verde)_10%,transparent)] p-3 text-sm">
          Depois de ligado (~15 min na primeira vez): <strong>Adicionar aparelho</strong> › <strong>Vincular</strong>. As câmeras da rede entram sozinhas.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Opcao({ ativo, onClick, icone, titulo, dica }: { ativo: boolean; onClick: () => void; icone: ReactNode; titulo: string; dica: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors touch:min-h-16',
        ativo
          ? 'border-nexon-verde bg-[color-mix(in_srgb,var(--nx-verde)_14%,transparent)]'
          : 'border-border mouse:hover:bg-muted',
      )}
    >
      <span className={cn('mt-0.5', ativo ? 'text-nexon-verde' : 'text-muted-foreground')}>{icone}</span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="text-xs text-muted-foreground">{dica}</span>
      </span>
    </button>
  );
}

function Passo({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{n}</span>
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </li>
  );
}
