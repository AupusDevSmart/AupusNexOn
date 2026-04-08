import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X, Receipt } from 'lucide-react';
import { formatarAliquota } from '@/utils/custos-energia';

interface TributosValues {
  icms: number;
  pis: number;
  cofins: number;
  perdas: number;
}

interface CardTributosProps {
  tributos: TributosValues;
  fatorMultiplicador: number;
  onSave: (tributos: TributosValues) => Promise<boolean>;
  saving?: boolean;
  className?: string;
}

export function CardTributos({
  tributos,
  fatorMultiplicador,
  onSave,
  saving = false,
  className = '',
}: CardTributosProps) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    icms: (tributos.icms * 100).toFixed(2),
    pis: (tributos.pis * 100).toFixed(2),
    cofins: (tributos.cofins * 100).toFixed(2),
    perdas: (tributos.perdas).toFixed(2),
  });

  useEffect(() => {
    if (!editando) {
      setForm({
        icms: (tributos.icms * 100).toFixed(2),
        pis: (tributos.pis * 100).toFixed(2),
        cofins: (tributos.cofins * 100).toFixed(2),
        perdas: (tributos.perdas).toFixed(2),
      });
    }
  }, [tributos, editando]);

  const handleSave = async () => {
    const icms = parseFloat(form.icms.replace(',', '.')) / 100;
    const pis = parseFloat(form.pis.replace(',', '.')) / 100;
    const cofins = parseFloat(form.cofins.replace(',', '.')) / 100;
    const perdas = parseFloat(form.perdas.replace(',', '.'));

    if (isNaN(icms) || isNaN(pis) || isNaN(cofins) || isNaN(perdas)) return;
    if (icms < 0 || icms > 1 || pis < 0 || pis > 1 || cofins < 0 || cofins > 1) return;
    if (perdas < 0 || perdas > 100) return;

    const ok = await onSave({ icms, pis, cofins, perdas });
    if (ok) setEditando(false);
  };

  const handleCancel = () => {
    setEditando(false);
    setForm({
      icms: (tributos.icms * 100).toFixed(2),
      pis: (tributos.pis * 100).toFixed(2),
      cofins: (tributos.cofins * 100).toFixed(2),
      perdas: (tributos.perdas).toFixed(2),
    });
  };

  const temTributos = tributos.icms > 0 || tributos.pis > 0 || tributos.cofins > 0;

  return (
    <Card className={`p-3 border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Tributos e Perdas</h3>
        </div>
        {!editando ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setEditando(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCancel}
              disabled={saving}
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleSave}
              disabled={saving}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Conteudo */}
      {editando ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ICMS (%)</Label>
            <Input
              type="text"
              value={form.icms}
              onChange={(e) => setForm({ ...form, icms: e.target.value })}
              className="h-7 text-xs"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">PIS (%)</Label>
            <Input
              type="text"
              value={form.pis}
              onChange={(e) => setForm({ ...form, pis: e.target.value })}
              className="h-7 text-xs"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">COFINS (%)</Label>
            <Input
              type="text"
              value={form.cofins}
              onChange={(e) => setForm({ ...form, cofins: e.target.value })}
              className="h-7 text-xs"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Perdas (%)</Label>
            <Input
              type="text"
              value={form.perdas}
              onChange={(e) => setForm({ ...form, perdas: e.target.value })}
              className="h-7 text-xs"
              placeholder="0.00"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">ICMS:</span>
            <span className="text-sm font-medium">{formatarAliquota(tributos.icms)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">PIS:</span>
            <span className="text-sm font-medium">{formatarAliquota(tributos.pis)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">COFINS:</span>
            <span className="text-sm font-medium">{formatarAliquota(tributos.cofins)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Perdas:</span>
            <span className="text-sm font-medium">{tributos.perdas.toFixed(2)}%</span>
          </div>

          {/* Fator multiplicador */}
          <div className="pt-1 border-t border-border/30 mt-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-medium">Fator:</span>
              <span className="text-base font-semibold">{fatorMultiplicador.toFixed(4)}x</span>
            </div>
          </div>

          {!temTributos && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              Sem tributos configurados
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
