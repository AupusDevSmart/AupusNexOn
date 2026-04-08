import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, Settings2 } from 'lucide-react';
import type { ConfiguracaoCustoDto, TarifaAplicadaDto } from '@/types/dtos/custos-energia-dto';

interface EditorTarifasProps {
  config: ConfiguracaoCustoDto | null;
  tarifasConcessionaria: TarifaAplicadaDto[];
  grupo: string;
  tarifaFonte: 'CONCESSIONARIA' | 'PERSONALIZADA';
  onSave: (data: Partial<ConfiguracaoCustoDto>) => Promise<boolean>;
  saving?: boolean;
  className?: string;
}

interface TarifaField {
  label: string;
  tusdKey: string;
  teKey: string;
  tusdConcessionaria: number;
  teConcessionaria: number;
}

export function EditorTarifas({
  config,
  tarifasConcessionaria,
  grupo,
  tarifaFonte,
  onSave,
  saving = false,
  className = '',
}: EditorTarifasProps) {
  const [editando, setEditando] = useState(false);
  const [usaPersonalizada, setUsaPersonalizada] = useState(config?.usa_tarifa_personalizada || false);
  const [form, setForm] = useState<Record<string, string>>({});

  const isGrupoA = grupo === 'A';

  const campos: TarifaField[] = isGrupoA
    ? [
        {
          label: 'Ponta',
          tusdKey: 'tusd_p',
          teKey: 'te_p',
          tusdConcessionaria: tarifasConcessionaria.find((t) => t.tipo_horario === 'PONTA')?.tarifa_tusd || 0,
          teConcessionaria: tarifasConcessionaria.find((t) => t.tipo_horario === 'PONTA')?.tarifa_te || 0,
        },
        {
          label: 'Fora Ponta',
          tusdKey: 'tusd_fp',
          teKey: 'te_fp',
          tusdConcessionaria: tarifasConcessionaria.find((t) => t.tipo_horario === 'FORA_PONTA')?.tarifa_tusd || 0,
          teConcessionaria: tarifasConcessionaria.find((t) => t.tipo_horario === 'FORA_PONTA')?.tarifa_te || 0,
        },
        {
          label: 'Demanda',
          tusdKey: 'tusd_d',
          teKey: 'te_d',
          tusdConcessionaria: tarifasConcessionaria.find((t) => t.tipo_horario === 'DEMANDA')?.tarifa_tusd || 0,
          teConcessionaria: tarifasConcessionaria.find((t) => t.tipo_horario === 'DEMANDA')?.tarifa_te || 0,
        },
      ]
    : [
        {
          label: 'Grupo B',
          tusdKey: 'tusd_b',
          teKey: 'te_b',
          tusdConcessionaria: tarifasConcessionaria.find((t) => t.tipo_horario === 'FORA_PONTA')?.tarifa_tusd || 0,
          teConcessionaria: tarifasConcessionaria.find((t) => t.tipo_horario === 'FORA_PONTA')?.tarifa_te || 0,
        },
      ];

  useEffect(() => {
    if (!editando && config) {
      setUsaPersonalizada(config.usa_tarifa_personalizada);
      const newForm: Record<string, string> = {};
      for (const campo of campos) {
        const tusdVal = (config as any)[campo.tusdKey];
        const teVal = (config as any)[campo.teKey];
        newForm[campo.tusdKey] = tusdVal != null ? String(tusdVal) : '';
        newForm[campo.teKey] = teVal != null ? String(teVal) : '';
      }
      setForm(newForm);
    }
  }, [config, editando]);

  // Toggle salva imediatamente (sem precisar do lapis)
  const handleToggle = async (checked: boolean) => {
    setUsaPersonalizada(checked);
    if (!editando) {
      await onSave({ usa_tarifa_personalizada: checked });
    }
  };

  const handleSave = async () => {
    const data: Record<string, any> = {
      usa_tarifa_personalizada: usaPersonalizada,
    };

    for (const campo of campos) {
      const tusdStr = form[campo.tusdKey];
      const teStr = form[campo.teKey];
      data[campo.tusdKey] = tusdStr ? parseFloat(tusdStr) : null;
      data[campo.teKey] = teStr ? parseFloat(teStr) : null;
    }

    const ok = await onSave(data);
    if (ok) setEditando(false);
  };

  const handleCancel = () => {
    setEditando(false);
    setUsaPersonalizada(config?.usa_tarifa_personalizada || false);
  };

  return (
    <Card className={`p-3 border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Tarifas</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {tarifaFonte === 'PERSONALIZADA' ? 'Personalizada' : 'Concessionaria'}
          </Badge>
        </div>
        {/* Lapis so aparece quando personalizada esta ativa */}
        {usaPersonalizada && !editando && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setEditando(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {editando && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCancel} disabled={saving}>
              <X className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSave} disabled={saving}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Toggle personalizada - sempre visivel e funcional */}
      <div className="flex items-center justify-between mb-3">
        <Label className="text-xs text-muted-foreground">Tarifa personalizada</Label>
        <Switch
          checked={usaPersonalizada}
          onCheckedChange={handleToggle}
          disabled={saving || editando}
        />
      </div>

      {/* Tabela de tarifas */}
      <div className="space-y-2">
        {/* Header da tabela */}
        <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground font-medium">
          <span />
          <span className="text-center">TUSD</span>
          <span className="text-center">TE</span>
        </div>

        {campos.map((campo) => (
          <div key={campo.tusdKey} className="grid grid-cols-3 gap-2 items-center">
            <span className="text-xs font-medium">{campo.label}</span>

            {editando ? (
              <>
                <Input
                  type="text"
                  value={form[campo.tusdKey] || ''}
                  onChange={(e) => setForm({ ...form, [campo.tusdKey]: e.target.value })}
                  className="h-6 text-xs text-center"
                  placeholder={campo.tusdConcessionaria.toFixed(6)}
                />
                <Input
                  type="text"
                  value={form[campo.teKey] || ''}
                  onChange={(e) => setForm({ ...form, [campo.teKey]: e.target.value })}
                  className="h-6 text-xs text-center"
                  placeholder={campo.teConcessionaria.toFixed(6)}
                />
              </>
            ) : (
              <>
                <span className="text-xs text-center">
                  {usaPersonalizada && (config as any)?.[campo.tusdKey] != null
                    ? Number((config as any)[campo.tusdKey]).toFixed(6)
                    : campo.tusdConcessionaria.toFixed(6)}
                </span>
                <span className="text-xs text-center">
                  {usaPersonalizada && (config as any)?.[campo.teKey] != null
                    ? Number((config as any)[campo.teKey]).toFixed(6)
                    : campo.teConcessionaria.toFixed(6)}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Rodape */}
      <div className="mt-2 pt-2 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground text-center">
          {usaPersonalizada
            ? 'Campos vazios usam valor da concessionaria'
            : 'Valores da concessionaria (R$/kWh)'}
        </p>
      </div>
    </Card>
  );
}
