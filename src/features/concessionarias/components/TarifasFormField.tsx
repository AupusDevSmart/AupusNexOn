// src/features/concessionarias/components/TarifasFormField.tsx
import { useState, useEffect } from 'react';
import { ChevronDown, Check, Info } from 'lucide-react';
import { SUBGRUPOS, SubgrupoTipo } from '../types';
import { TarifasSubgrupoTable } from './TarifasSubgrupoTable';
import { cn } from '@/lib/utils';

interface TarifasFormFieldProps {
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
}

export function TarifasFormField({ value = {}, onChange, disabled = false }: TarifasFormFieldProps) {
  const [subgruposAbertos, setSubgruposAbertos] = useState<Set<SubgrupoTipo>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Extrair valores das tarifas do formato do formulário
  const tarifas = {
    a4_verde: value?.a4_verde || {},
    a3a_verde: value?.a3a_verde || {},
    b: value?.b || {}
  };

  const handleSubgrupoChange = (subgrupoId: SubgrupoTipo, valores: Record<string, number | undefined>) => {
    const key = subgrupoId === 'A4_VERDE' ? 'a4_verde' :
                subgrupoId === 'A3a_VERDE' ? 'a3a_verde' : 'b';

    const newTarifas = {
      ...tarifas,
      [key]: valores
    };

    onChange?.(newTarifas);
  };

  const hasValues = (subgrupoId: SubgrupoTipo): boolean => {
    const key = subgrupoId === 'A4_VERDE' ? 'a4_verde' :
                subgrupoId === 'A3a_VERDE' ? 'a3a_verde' : 'b';

    const valores = tarifas[key];
    return Object.values(valores || {}).some(v => v !== null && v !== undefined && v !== 0 && v !== '');
  };

  // Abrir automaticamente os subgrupos que têm valores quando o componente é montado ou value muda
  useEffect(() => {
    if (!initialized && value) {
      const subgruposComValores = new Set<SubgrupoTipo>();

      SUBGRUPOS.forEach(subgrupo => {
        if (hasValues(subgrupo.id)) {
          subgruposComValores.add(subgrupo.id);
        }
      });

      if (subgruposComValores.size > 0) {
        setSubgruposAbertos(subgruposComValores);
        setInitialized(true);
      }
    }
  }, [value, initialized]);

  const toggleSubgrupo = (subgrupoId: SubgrupoTipo) => {
    setSubgruposAbertos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subgrupoId)) {
        newSet.delete(subgrupoId);
      } else {
        newSet.add(subgrupoId);
      }
      return newSet;
    });
  };

  const totalPreenchidos = SUBGRUPOS.filter(s => hasValues(s.id)).length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho informativo */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-1">Você pode preencher tarifas de múltiplos subgrupos</p>
          <p>Clique em cada subgrupo abaixo para expandir e preencher suas tarifas. {totalPreenchidos > 0 && `(${totalPreenchidos} preenchido${totalPreenchidos > 1 ? 's' : ''})`}</p>
        </div>
      </div>

      {/* Accordion de Subgrupos */}
      <div className="space-y-3">
        {SUBGRUPOS.map((subgrupo) => {
          const temValores = hasValues(subgrupo.id);
          const estaAberto = subgruposAbertos.has(subgrupo.id);

          return (
            <div
              key={subgrupo.id}
              className={cn(
                'border rounded-lg overflow-hidden transition-colors',
                temValores ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800' : 'border-gray-200 dark:border-gray-700'
              )}
            >
              {/* Header do Accordion */}
              <button
                type="button"
                onClick={() => toggleSubgrupo(subgrupo.id)}
                disabled={disabled}
                className={cn(
                  'w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                  estaAberto && 'bg-gray-50 dark:bg-gray-800'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-foreground">{subgrupo.label}</span>
                    <span className="text-xs text-muted-foreground">
                      Grupo {subgrupo.grupo}
                    </span>
                  </div>
                  {temValores && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium dark:bg-green-900 dark:text-green-200">
                      <Check className="h-3 w-3" />
                      Preenchido
                    </div>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-muted-foreground transition-transform',
                    estaAberto && 'rotate-180'
                  )}
                />
              </button>

              {/* Conteúdo do Accordion */}
              {estaAberto && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                  <TarifasSubgrupoTable
                    subgrupo={subgrupo}
                    valores={
                      subgrupo.id === 'A4_VERDE' ? tarifas.a4_verde :
                      subgrupo.id === 'A3a_VERDE' ? tarifas.a3a_verde :
                      tarifas.b
                    }
                    onChange={(valores) => handleSubgrupoChange(subgrupo.id, valores)}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
