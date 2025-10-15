// src/components/common/cards/TecnicosCardManager.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus,
  Users,
  Edit3,
  Trash2,
  AlertTriangle,
  Clock,
  DollarSign,
  Calculator,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TecnicoItem {
  id?: string;
  nome: string;
  especialidade: string;
  horas_estimadas: number;
  horas_trabalhadas?: number;
  custo_hora?: number;
  custo_total?: number;
  presente?: boolean;
  tecnico_id?: string; // ID do técnico no sistema
  observacoes?: string;
}

interface TecnicosCardManagerProps {
  value: TecnicoItem[];
  onChange: (tecnicos: TecnicoItem[]) => void;
  disabled?: boolean;
  mode?: 'planejamento' | 'execucao' | 'view';
  showCustos?: boolean;
  showStatus?: boolean;
  showHorasReais?: boolean;
  title?: string;
}

const TecnicosCardManager: React.FC<TecnicosCardManagerProps> = ({
  value = [],
  onChange,
  disabled = false,
  mode = 'planejamento',
  showCustos = false,
  showStatus = false,
  showHorasReais = false,
  title = "Técnicos"
}) => {
  const [tecnicos, setTecnicos] = useState<TecnicoItem[]>(value);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sincronizar com prop externa
  useEffect(() => {
    setTecnicos(value);
  }, [value]);

  // Propagar mudanças para o componente pai
  const updateTecnicos = (newTecnicos: TecnicoItem[]) => {
    setTecnicos(newTecnicos);
    onChange(newTecnicos);
  };

  const adicionarTecnico = () => {
    const novoTecnico: TecnicoItem = {
      id: `temp_${Date.now()}`,
      nome: '',
      especialidade: '',
      horas_estimadas: 8,
      custo_hora: 0,
      custo_total: 0, // ✅ ADICIONADO: Garantir cálculo inicial
      presente: false
    };

    const novosTecnicos = [...tecnicos, novoTecnico];
    updateTecnicos(novosTecnicos);
    setEditingId(novoTecnico.id!);
  };

  const removerTecnico = (index: number) => {
    const novosTecnicos = tecnicos.filter((_, i) => i !== index);
    updateTecnicos(novosTecnicos);
    setEditingId(null);
  };

  const atualizarTecnico = (index: number, campo: keyof TecnicoItem, valor: any) => {
    const novosTecnicos = [...tecnicos];
    novosTecnicos[index] = { ...novosTecnicos[index], [campo]: valor };

    // Calcular custo total automaticamente
    if (campo === 'horas_estimadas' || campo === 'horas_trabalhadas' || campo === 'custo_hora') {
      const tecnico = novosTecnicos[index];
      const horas = mode === 'execucao' && tecnico.horas_trabalhadas !== undefined 
        ? tecnico.horas_trabalhadas 
        : tecnico.horas_estimadas;
        
      if (horas && tecnico.custo_hora) {
        tecnico.custo_total = horas * tecnico.custo_hora;
      }
    }

    updateTecnicos(novosTecnicos);
  };

  const calcularCustoTotal = () => {
    return tecnicos.reduce((total, tecnico) => total + (tecnico.custo_total || 0), 0);
  };

  const calcularHorasTotal = () => {
    if (mode === 'execucao' && showHorasReais) {
      return tecnicos.reduce((total, tecnico) => total + (tecnico.horas_trabalhadas || 0), 0);
    }
    return tecnicos.reduce((total, tecnico) => total + (tecnico.horas_estimadas || 0), 0);
  };

  const getStatusColor = (tecnico: TecnicoItem) => {
    if (tecnico.presente) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800';
  };

  const getStatusLabel = (tecnico: TecnicoItem) => {
    if (tecnico.presente) return 'Presente';
    return 'Ausente';
  };

  const especialidadesComuns = [
    'Técnico Mecânico',
    'Técnico Elétrico',
    'Técnico Eletrônico',
    'Soldador',
    'Operador de Guindastes',
    'Técnico em Instrumentação',
    'Técnico em Segurança',
    'Engenheiro',
    'Auxiliar',
    'Outros'
  ];

  if (disabled && tecnicos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Users className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
        <p className="text-sm">Nenhum técnico cadastrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</Label>
          {tecnicos.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {tecnicos.length} {tecnicos.length === 1 ? 'técnico' : 'técnicos'}
            </Badge>
          )}
        </div>

        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarTecnico}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar Técnico</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>

      {/* Cards de Técnicos */}
      <div className="grid gap-3">
        {tecnicos.map((tecnico, index) => {
          const isEditing = editingId === tecnico.id;
          
          return (
            <Card 
              key={tecnico.id || index} 
              className={cn(
                "transition-all duration-200 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700",
                isEditing && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20 dark:ring-blue-400"
              )}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Técnico #{index + 1}</span>
                      
                      {/* Badge de Status */}
                      {showStatus && (
                        <Badge className={`text-xs ${getStatusColor(tecnico)}`}>
                          {getStatusLabel(tecnico)}
                        </Badge>
                      )}
                      
                      {/* Badge de Especialidade */}
                      {tecnico.especialidade && (
                        <Badge variant="outline" className="text-xs">
                          {tecnico.especialidade}
                        </Badge>
                      )}
                    </div>
                    
                    {!disabled && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(isEditing ? null : tecnico.id!)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerTecnico(index)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Campos do Técnico */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Nome */}
                    <div>
                      <Label htmlFor={`tecnico-nome-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        Nome *
                      </Label>
                      <Input
                        id={`tecnico-nome-${index}`}
                        value={tecnico.nome}
                        onChange={(e) => atualizarTecnico(index, 'nome', e.target.value)}
                        placeholder="Nome do técnico"
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>

                    {/* Especialidade */}
                    <div>
                      <Label htmlFor={`tecnico-especialidade-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        Especialidade *
                      </Label>
                      <select
                        id={`tecnico-especialidade-${index}`}
                        value={tecnico.especialidade}
                        onChange={(e) => atualizarTecnico(index, 'especialidade', e.target.value)}
                        disabled={disabled || !isEditing}
                        className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        required
                      >
                        <option value="">Selecionar especialidade...</option>
                        {especialidadesComuns.map(esp => (
                          <option key={esp} value={esp}>{esp}</option>
                        ))}
                      </select>
                    </div>

                    {/* Horas Estimadas */}
                    <div>
                      <Label htmlFor={`tecnico-horas-estimadas-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Horas Estimadas *
                      </Label>
                      <Input
                        id={`tecnico-horas-estimadas-${index}`}
                        type="number"
                        min="0"
                        step="0.5"
                        value={tecnico.horas_estimadas}
                        onChange={(e) => atualizarTecnico(index, 'horas_estimadas', parseFloat(e.target.value) || 0)}
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>

                    {/* Horas Trabalhadas (apenas no modo execução) */}
                    {showHorasReais && mode === 'execucao' && (
                      <div>
                        <Label htmlFor={`tecnico-horas-trabalhadas-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          <Clock className="h-3 w-3 inline mr-1" />
                          Horas Trabalhadas
                        </Label>
                        <Input
                          id={`tecnico-horas-trabalhadas-${index}`}
                          type="number"
                          min="0"
                          step="0.5"
                          value={tecnico.horas_trabalhadas || ''}
                          onChange={(e) => atualizarTecnico(index, 'horas_trabalhadas', parseFloat(e.target.value) || 0)}
                          disabled={disabled || !isEditing}
                          className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}

                    {/* Custos (se habilitado) */}
                    {showCustos && (
                      <>
                        <div>
                          <Label htmlFor={`tecnico-custo-hora-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            <DollarSign className="h-3 w-3 inline mr-1" />
                            Custo/Hora (R$)
                          </Label>
                          <Input
                            id={`tecnico-custo-hora-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={tecnico.custo_hora || ''}
                            onChange={(e) => atualizarTecnico(index, 'custo_hora', parseFloat(e.target.value) || 0)}
                            disabled={disabled || !isEditing}
                            className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            <Calculator className="h-3 w-3 inline mr-1" />
                            Custo Total (R$)
                          </Label>
                          <div className="text-sm font-medium text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400 rounded px-3 py-2 border border-green-200 dark:border-green-800">
                            R$ {(tecnico.custo_total || 0).toFixed(2)}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ID do Técnico no Sistema */}
                    <div>
                      <Label htmlFor={`tecnico-id-sistema-${index}`} className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        ID Sistema
                      </Label>
                      <Input
                        id={`tecnico-id-sistema-${index}`}
                        value={tecnico.tecnico_id || ''}
                        onChange={(e) => atualizarTecnico(index, 'tecnico_id', e.target.value)}
                        placeholder="ID no sistema..."
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    {/* Status toggle presente (apenas no modo execução) */}
                    {mode === 'execucao' && showStatus && (
                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tecnico.presente}
                            onChange={(e) => atualizarTecnico(index, 'presente', e.target.checked)}
                            disabled={disabled || !isEditing}
                            className="rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-xs text-gray-900 dark:text-gray-100">Presente</span>
                          <UserCheck className="h-3 w-3 text-blue-500" />
                        </label>
                      </div>
                    )}

                    {/* Observações 
                    <div className="md:col-span-2">
                      <Label htmlFor={`tecnico-observacoes-${index}`} className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Observações
                      </Label>
                      <Input
                        id={`tecnico-observacoes-${index}`}
                        value={tecnico.observacoes || ''}
                        onChange={(e) => atualizarTecnico(index, 'observacoes', e.target.value)}
                        placeholder="Observações sobre disponibilidade, competências..."
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    */}
                  </div>

                  {/* Alertas importantes */}
                  <div className="space-y-2">

                    {/* Campos obrigatórios */}
                    {isEditing && (!tecnico.nome || !tecnico.especialidade || !tecnico.horas_estimadas) && (
                      <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Preencha todos os campos obrigatórios (*)</span>
                      </div>
                    )}

                    {/* Horas trabalhadas maior que estimadas */}
                    {showHorasReais && tecnico.horas_trabalhadas && tecnico.horas_trabalhadas > tecnico.horas_estimadas && (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-400">
                        <Clock className="h-3 w-3" />
                        <span>Horas trabalhadas excedem o estimado (+{(tecnico.horas_trabalhadas - tecnico.horas_estimadas).toFixed(1)}h)</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumos */}
      {tecnicos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Resumo de Horas */}
          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    Total de Horas {showHorasReais && mode === 'execucao' ? 'Trabalhadas' : 'Estimadas'}
                  </span>
                </div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {calcularHorasTotal().toFixed(1)}h
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo de Custos */}
          {showCustos && (
            <Card className="bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">Custo Total da Equipe</span>
                  </div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    R$ {calcularCustoTotal().toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Estado vazio */}
      {tecnicos.length === 0 && !disabled && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Users className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Nenhum técnico adicionado</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarTecnico}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Adicionar Primeiro Técnico
          </Button>
        </div>
      )}
    </div>
  );
};

export { TecnicosCardManager };