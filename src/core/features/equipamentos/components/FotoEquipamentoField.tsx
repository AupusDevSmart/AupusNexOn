// src/features/equipamentos/components/FotoEquipamentoField.tsx
import { Loader2, Plus, X } from 'lucide-react';
import { EquipamentoAvatar } from './EquipamentoAvatar';

interface FotoEquipamentoFieldProps {
  /** URL ja salva, ou o preview local de uma foto ainda nao enviada. */
  fotoUrl?: string | null;
  /** Desenho do tipo, usado quando nao ha foto. */
  iconeSvg?: string | null;
  alt?: string;
  somenteLeitura?: boolean;
  enviando?: boolean;
  onEscolher: (arquivo: File | null) => void;
  onRemover: () => void;
}

/**
 * O retrato do equipamento, com os dois botoes que ficam sobre ele.
 *
 * Vive fora dos sheets porque UC e UAR mostram exatamente a mesma coisa. Ficou
 * duplicado por um tempo e as duas copias comecaram a divergir — o limite de
 * tamanho aparecia so numa das dicas, por exemplo.
 *
 * O componente nao sabe fazer upload: quem chama decide se a foto sobe agora
 * (o equipamento ja existe) ou se fica em memoria ate o id nascer. Sao regras
 * diferentes em create e em edit, e nao cabem aqui.
 */
export function FotoEquipamentoField({
  fotoUrl,
  iconeSvg,
  alt,
  somenteLeitura = false,
  enviando = false,
  onEscolher,
  onRemover,
}: FotoEquipamentoFieldProps) {
  const temFoto = Boolean(fotoUrl);

  return (
    <div className="relative shrink-0">
      <EquipamentoAvatar
        fotoUrl={fotoUrl}
        iconeSvg={iconeSvg}
        alt={alt || 'Equipamento'}
        size={72}
        className="rounded-md"
      />

      {!somenteLeitura && (
        <>
          <label
            className={`absolute -bottom-2 -right-2 h-7 w-7 rounded-full border border-border bg-background flex items-center justify-center shadow-sm cursor-pointer hover:bg-muted transition-colors ${
              enviando ? 'opacity-50 pointer-events-none' : ''
            }`}
            title={
              temFoto
                ? 'Trocar foto (JPG, PNG ou WEBP, até 2MB)'
                : 'Enviar foto (JPG, PNG ou WEBP, até 2MB)'
            }
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => onEscolher(e.target.files?.[0] || null)}
              disabled={enviando}
            />
          </label>

          {temFoto && (
            <button
              type="button"
              onClick={onRemover}
              disabled={enviando}
              title="Remover foto"
              aria-label="Remover foto"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full border border-border bg-background flex items-center justify-center shadow-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
