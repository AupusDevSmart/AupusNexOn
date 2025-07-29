// src/features/financeiro/components/recorrencia-section.tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { LancamentoFormSection } from './lancamento-form-section';
import { DateInput } from './date-input';
import { FieldLabel } from './field-label';
import { ToggleSwitch } from './toggle-switch';

interface RecorrenciaConfig {
  tipo: 'unica' | 'recorrente';
  intervaloEmDias: number;
  dataInicio: string;
  tipoFim: 'data' | 'parcelas';
  dataFim?: string;
  numeroParcelas?: number;
}

interface RecorrenciaSectionProps {
  config: RecorrenciaConfig;
  onChange: (config: RecorrenciaConfig) => void;
  tipo: 'despesa' | 'receita';
}

// Função para gerar as datas de recorrência
function gerarDatasRecorrencia(config: RecorrenciaConfig): Date[] {
  const datas: Date[] = [];
  const dataInicio = new Date(config.dataInicio);
  
  if (!config.dataInicio || config.tipo === 'unica') return datas;
  
  if (config.tipoFim === 'parcelas' && config.numeroParcelas) {
    for (let i = 0; i < config.numeroParcelas; i++) {
      const novaData = new Date(dataInicio);
      novaData.setDate(dataInicio.getDate() + (i * config.intervaloEmDias));
      datas.push(novaData);
    }
  } else if (config.tipoFim === 'data' && config.dataFim) {
    const dataFim = new Date(config.dataFim);
    let dataAtual = new Date(dataInicio);
    
    while (dataAtual <= dataFim) {
      datas.push(new Date(dataAtual));
      dataAtual.setDate(dataAtual.getDate() + config.intervaloEmDias);
    }
  }
  
  return datas;
}

// Componente de preview das parcelas
function PreviewParcelas({ datas, tipo }: { datas: Date[]; tipo: 'despesa' | 'receita' }) {
  if (datas.length === 0) return null;

  return (
    <div className="space-y-3">
      <FieldLabel>Preview das {tipo === 'despesa' ? 'despesas' : 'receitas'} ({datas.length})</FieldLabel>
      <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
        <div className="grid grid-cols-2 gap-2">
          {datas.map((data, index) => (
            <Badge 
              key={index} 
              variant="outline" 
              className="bg-red-50 text-red-700 border-red-200 dark:bg-gray-700 dark:text-white dark:border-gray-600 justify-center"
            >
              <Calendar className="h-3 w-3 mr-1" />
              {data.toLocaleDateString('pt-BR')}
            </Badge>
          ))}
        </div>
        {datas.length > 20 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Mostrando primeiras 20 de {datas.length} parcelas
          </p>
        )}
      </div>
    </div>
  );
}

export function RecorrenciaSection({ config, onChange, tipo }: RecorrenciaSectionProps) {
  const isRecorrente = config.tipo === 'recorrente';

  const handleChange = (field: keyof RecorrenciaConfig, value: any) => {
    onChange({
      ...config,
      [field]: value
    });
  };

  const handleTipoChange = (checked: boolean) => {
    onChange({
      ...config,
      tipo: checked ? 'recorrente' : 'unica'
    });
  };

  const handlePresetSelect = (dias: string) => {
    handleChange('intervaloEmDias', Number(dias));
  };

  const datas = gerarDatasRecorrencia(config);

  return (
    <LancamentoFormSection title={`${tipo === 'despesa' ? 'Despesa' : 'Receita'} Recorrente`}>
      <div className="space-y-4">
        <ToggleSwitch
          id="recorrente"
          label={`${tipo === 'despesa' ? 'Despesa' : 'Receita'} recorrente`}
          checked={isRecorrente}
          onCheckedChange={handleTipoChange}
        />

        {isRecorrente && (
          <div className="space-y-4 border-l-2 border-blue-200 dark:border-blue-800 pl-4">
            {/* Frequência */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel required>Repetir a cada (dias)</FieldLabel>
                <Input
                  type="number"
                  value={config.intervaloEmDias}
                  onChange={(e) => handleChange('intervaloEmDias', Number(e.target.value) || 1)}
                  min="1"
                  max="365"
                  placeholder="30"
                />
              </div>
              
              <div className="space-y-2">
                <FieldLabel>Períodos pré-definidos</FieldLabel>
                <Select onValueChange={handlePresetSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Semanal (7 dias)</SelectItem>
                    <SelectItem value="15">Quinzenal (15 dias)</SelectItem>
                    <SelectItem value="30">Mensal (30 dias)</SelectItem>
                    <SelectItem value="60">Bimestral (60 dias)</SelectItem>
                    <SelectItem value="90">Trimestral (90 dias)</SelectItem>
                    <SelectItem value="180">Semestral (180 dias)</SelectItem>
                    <SelectItem value="365">Anual (365 dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Data de início */}
            <div className="space-y-2">
              <FieldLabel required>Data de início</FieldLabel>
              <DateInput
                value={config.dataInicio}
                onChange={(value) => handleChange('dataInicio', value)}
                required
              />
            </div>

            {/* Tipo de fim */}
            <div className="space-y-3">
              <FieldLabel required>Definir fim por:</FieldLabel>
              <RadioGroup
                value={config.tipoFim}
                onValueChange={(value) => handleChange('tipoFim', value)}
                className="grid grid-cols-1 gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="parcelas" id="parcelas" />
                  <label htmlFor="parcelas" className="text-sm font-medium cursor-pointer">
                    Número de parcelas
                  </label>
                </div>
                
                {config.tipoFim === 'parcelas' && (
                  <div className="ml-6 space-y-2">
                    <Input
                      type="number"
                      value={config.numeroParcelas || ''}
                      onChange={(e) => handleChange('numeroParcelas', Number(e.target.value) || undefined)}
                      min="1"
                      max="120"
                      placeholder="12"
                      className="w-32"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Máximo 120 parcelas
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="data" id="data-fim" />
                  <label htmlFor="data-fim" className="text-sm font-medium cursor-pointer">
                    Data final
                  </label>
                </div>
                
                {config.tipoFim === 'data' && (
                  <div className="ml-6 space-y-2">
                    <DateInput
                      value={config.dataFim || ''}
                      onChange={(value) => handleChange('dataFim', value)}
                      min={config.dataInicio}
                    />
                  </div>
                )}
              </RadioGroup>
            </div>

            {/* Preview das parcelas */}
            <PreviewParcelas datas={datas.slice(0, 20)} tipo={tipo} />

            {datas.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>{datas.length}</strong> {tipo === 'despesa' ? 'despesas' : 'receitas'} serão criadas
                  {datas.length > 1 && (
                    <>
                      {' '}de <strong>{datas[0].toLocaleDateString('pt-BR')}</strong> até{' '}
                      <strong>{datas[datas.length - 1].toLocaleDateString('pt-BR')}</strong>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </LancamentoFormSection>
  );
}