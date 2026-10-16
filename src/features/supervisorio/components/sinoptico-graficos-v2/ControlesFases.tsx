import type { Dispatch, SetStateAction } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COR_FASE, FASES, type Fase, type FasesAtivas } from './dados';

export interface MedidorOpcao {
  id: string;
  nome: string;
  tag?: string;
}

interface ControlesFasesProps {
  /** Sufixo dos ids dos inputs ("tensao", "fp-modal"…), para os labels. */
  sufixo: string;
  medidores: MedidorOpcao[];
  medidorSelecionado: string;
  onMedidor: (id: string) => void;
  fases: FasesAtivas;
  onFases: Dispatch<SetStateAction<FasesAtivas>>;
  /** Card compacto (uma linha) ou diálogo expandido (empilhado). */
  variante: 'card' | 'dialogo';
  className?: string;
}

const Bolinha = ({ fase }: { fase: Fase }) => (
  <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COR_FASE[fase] }} />
);

/** Seletor de medidor + fases A/B/C na cor de cada série (faz as vezes de legenda). */
export function ControlesFases({
  sufixo,
  medidores,
  medidorSelecionado,
  onMedidor,
  fases,
  onFases,
  variante,
  className,
}: ControlesFasesProps) {
  const idMedidor = `m160-${sufixo}`;
  const idFase = (f: Fase) => `fase-${f.toLowerCase()}-${sufixo}`;
  const alternar = (f: Fase) => (checked: boolean | 'indeterminate') =>
    onFases((prev) => ({ ...prev, [f]: !!checked }));

  if (variante === 'dialogo') {
    return (
      <div className={`flex-shrink-0 space-y-3 ${className ?? ''}`}>
        <div className="flex items-center gap-2">
          <Label htmlFor={idMedidor} className="min-w-[80px] text-sm">
            Medidor:
          </Label>
          <Select value={medidorSelecionado} onValueChange={onMedidor}>
            <SelectTrigger id={idMedidor} className="w-full sm:w-[250px]">
              <SelectValue placeholder="Selecione um M160" />
            </SelectTrigger>
            <SelectContent>
              {medidores.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  {eq.tag || eq.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Label className="min-w-[80px] text-sm">Fases:</Label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {FASES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Checkbox id={idFase(f)} checked={fases[f]} onCheckedChange={alternar(f)} />
                <Label htmlFor={idFase(f)} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <Bolinha fase={f} />
                  Fase {f}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className ?? ''}`}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={idMedidor} className="text-xs text-muted-foreground">
          Medidor
        </Label>
        <Select value={medidorSelecionado} onValueChange={onMedidor}>
          <SelectTrigger id={idMedidor} className="h-7 w-[150px] text-xs">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {medidores.map((eq) => (
              <SelectItem key={eq.id} value={eq.id}>
                {eq.tag || eq.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-muted-foreground">Fases:</span>
        {FASES.map((f) => (
          <label key={f} htmlFor={idFase(f)} className="flex cursor-pointer items-center gap-1 text-xs">
            <Checkbox id={idFase(f)} className="h-3.5 w-3.5" checked={fases[f]} onCheckedChange={alternar(f)} />
            <Bolinha fase={f} />
            {f}
          </label>
        ))}
      </div>
    </div>
  );
}
