import React from 'react';
import { HardDrive } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getUploadUrl } from '../../../lib/uploads';
import { useSharedPages } from '../../../context/SharedPagesContext';

export interface EquipamentoAvatarProps {
  /** Path relativo (`/uploads/equipamentos/...`) ou URL completa. */
  fotoUrl?: string | null;
  /** SVG inline do tipo do equipamento (campo `tipo_equipamento_rel.icone_svg`). */
  iconeSvg?: string | null;
  /** Lado em px do container quadrado. Default 32. */
  size?: number;
  alt?: string;
  className?: string;
}

/**
 * Avatar do equipamento com fallback em cascata:
 *   1. foto cadastrada (img)
 *   2. SVG do tipo de equipamento (inline)
 *   3. icone generico Lucide (HardDrive)
 * Usa cores muted pra combinar com o resto da UI.
 */
export function EquipamentoAvatar({
  fotoUrl,
  iconeSvg,
  size = 32,
  alt = 'Foto do equipamento',
  className,
}: EquipamentoAvatarProps) {
  const { httpClient } = useSharedPages();
  const resolvedUrl = getUploadUrl(fotoUrl, httpClient.defaults.baseURL);
  const dimension = { width: size, height: size };

  const base = cn(
    'inline-flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground shrink-0',
    className,
  );

  if (resolvedUrl) {
    return (
      <span className={base} style={dimension}>
        <img
          src={resolvedUrl}
          alt={alt}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={(e) => {
            // Se a imagem falhar, esconde o <img> e deixa o container mostrar o fundo muted
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </span>
    );
  }

  if (iconeSvg) {
    return (
      <span
        className={base}
        style={dimension}
        // SVG do banco ja vem sanitizado pelo backend (campo do cadastro de tipos)
        dangerouslySetInnerHTML={{ __html: iconeSvg }}
      />
    );
  }

  // Lucide icon dimensionado a 60% do container
  const iconSize = Math.max(12, Math.round(size * 0.6));
  return (
    <span className={base} style={dimension}>
      <HardDrive size={iconSize} aria-label={alt} />
    </span>
  );
}
