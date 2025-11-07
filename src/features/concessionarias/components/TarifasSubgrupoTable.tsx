// src/features/concessionarias/components/TarifasSubgrupoTable.tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Check, Info } from 'lucide-react';
import { SubgrupoInfo } from '../types';

interface TarifasSubgrupoTableProps {
  subgrupo: SubgrupoInfo;
  valores: Record<string, number | undefined>;
  onChange: (valores: Record<string, number | undefined>) => void;
  disabled?: boolean;
}

export function TarifasSubgrupoTable({
  subgrupo,
  valores,
  onChange,
  disabled = false
}: TarifasSubgrupoTableProps) {
  const [tempValores, setTempValores] = useState<Record<string, string>>(
    Object.fromEntries(
      subgrupo.campos.map(campo => [
        campo.key,
        valores[campo.key]?.toString() || ''
      ])
    )
  );

  const handleInputChange = (key: string, value: string) => {
    // Permitir apenas números e ponto decimal
    const sanitized = value.replace(/[^0-9.]/g, '');

    // Garantir apenas um ponto decimal
    const parts = sanitized.split('.');
    const formattedValue = parts.length > 2
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : sanitized;

    setTempValores(prev => ({
      ...prev,
      [key]: formattedValue
    }));
  };

  const handleBlur = (key: string) => {
    const value = tempValores[key];
    const numericValue = value ? parseFloat(value) : undefined;

    onChange({
      ...valores,
      [key]: numericValue
    });
  };

  const handleClear = () => {
    const emptyValues = Object.fromEntries(
      subgrupo.campos.map(campo => [campo.key, ''])
    );
    setTempValores(emptyValues);
    onChange(
      Object.fromEntries(
        subgrupo.campos.map(campo => [campo.key, undefined])
      )
    );
  };

  const hasAnyValue = Object.values(tempValores).some(v => v !== '');

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            {subgrupo.label}
            <span className="text-xs font-normal text-muted-foreground">
              (Grupo {subgrupo.grupo})
            </span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Preencha os valores das tarifas em R$/kWh
          </p>
        </div>
        {hasAnyValue && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subgrupo.campos.map((campo) => (
          <div key={campo.key} className="space-y-2">
            <Label htmlFor={`${subgrupo.id}_${campo.key}`} className="text-sm font-medium">
              {campo.label}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id={`${subgrupo.id}_${campo.key}`}
                type="text"
                value={tempValores[campo.key] || ''}
                onChange={(e) => handleInputChange(campo.key, e.target.value)}
                onBlur={() => handleBlur(campo.key)}
                placeholder={campo.placeholder}
                disabled={disabled}
                className="pl-10 font-mono text-sm"
              />
              {tempValores[campo.key] && !disabled && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      {subgrupo.id !== 'B' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950 dark:border-blue-800">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Legendas:</p>
              <ul className="space-y-0.5">
                <li><strong>TUSD:</strong> Tarifa de Uso do Sistema de Distribuição</li>
                <li><strong>TE:</strong> Tarifa de Energia</li>
                <li><strong>D:</strong> Demanda | <strong>P:</strong> Ponta | <strong>FP:</strong> Fora Ponta</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
