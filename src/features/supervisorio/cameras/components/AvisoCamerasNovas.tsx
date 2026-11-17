import { Radar, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAgentesCameras, useDescobertasAgentes } from '../hooks/useConfigCameras';
import type { CameraDescoberta } from '../types';
import { rotuloFabricante } from '../utils/sensibilidade';

const CHAVE = 'nexon.cameras.ignoradas';
/** Aparelho visto há até 3 min conta como "em contato" (heartbeat a cada 30 s). */
const CONTATO_MS = 3 * 60_000;

function lerIgnoradas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

const idDescoberta = (d: CameraDescoberta) => (d.mac ?? d.ip).toLowerCase();

interface AvisoCamerasNovasProps {
  unidadeId: string;
  /** Abre a configuração na aba Câmeras (lá ficam as encontradas, com "Adicionar"). */
  onAdicionar: () => void;
}

/**
 * Faixa no topo da aba quando o aparelho acha câmera na rede que ainda não está no NexON: "Câmera nova na rede"
 * com Adicionar e Ignorar (lembrado neste navegador). Câmera de fábrica avisa que a senha é criada no cadastro.
 */
export function AvisoCamerasNovas({ unidadeId, onAdicionar }: AvisoCamerasNovasProps) {
  const agentes = useAgentesCameras(unidadeId);
  const emContato = useMemo(
    () =>
      (agentes.data ?? []).filter(
        (a) => a.ultimo_contato_em && Date.now() - Date.parse(a.ultimo_contato_em) < CONTATO_MS && (a.descobertas_pendentes ?? 0) > 0,
      ),
    [agentes.data],
  );
  const descobertas = useDescobertasAgentes(emContato);
  const [ignoradas, setIgnoradas] = useState(lerIgnoradas);

  const novas = descobertas.itens.filter((i) => !ignoradas.has(idDescoberta(i.descoberta)));
  if (novas.length === 0) return null;

  const ignorar = () => {
    const todas = new Set([...ignoradas, ...novas.map((i) => idDescoberta(i.descoberta))]);
    setIgnoradas(todas);
    try {
      localStorage.setItem(CHAVE, JSON.stringify([...todas]));
    } catch {
      /* navegador sem armazenamento: some só até recarregar */
    }
  };

  const primeira = novas[0].descoberta;
  const titulo =
    novas.length === 1
      ? `Câmera nova na rede: ${[rotuloFabricante(primeira.fabricante) ?? 'Câmera', primeira.modelo].filter(Boolean).join(' ')} · ${primeira.ip}`
      : `${novas.length} câmeras novas na rede`;
  const deFabrica = novas.some((i) => i.descoberta.inicializada === false);

  return (
    <div
      role="status"
      className="mx-3 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[color-mix(in_srgb,var(--nx-verde)_45%,transparent)] bg-[color-mix(in_srgb,var(--nx-verde)_10%,transparent)] px-3 py-2.5 sm:mx-4"
    >
      <Radar className="h-5 w-5 shrink-0 text-nexon-verde" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground">
          {deFabrica
            ? 'Nova de fábrica, sem senha: ao adicionar, você cria a senha e o aparelho grava nela.'
            : 'O aparelho achou na rede da usina. Adicione para ver ao vivo e receber alertas.'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" className="h-8 touch:h-10" onClick={onAdicionar}>
          {novas.length === 1 ? 'Adicionar' : 'Ver câmeras'}
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 touch:h-10 touch:w-10" aria-label="Ignorar câmeras novas" title="Ignorar" onClick={ignorar}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
