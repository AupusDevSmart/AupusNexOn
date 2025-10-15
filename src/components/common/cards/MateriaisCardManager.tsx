// src/components/common/cards/MateriaisCardManager.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Package,
  Calculator,
  DollarSign,
  AlertTriangle,
  Edit3,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MaterialItem {
  id?: string;
  descricao: string;
  quantidade_planejada: number;
  quantidade_consumida?: number;
  unidade: string;
  custo_unitario?: number;
  custo_total?: number;
}

interface MateriaisCardManagerProps {
  value: MaterialItem[];
  onChange: (materiais: MaterialItem[]) => void;
  disabled?: boolean;
  mode?: 'planejamento' | 'execucao' | 'view';
  showCustos?: boolean;
  title?: string;
}

const MateriaisCardManager: React.FC<MateriaisCardManagerProps> = ({
  value = [],
  onChange,
  disabled = false,
  mode = 'planejamento',
  showCustos = false,
  title = "Materiais"
}) => {
  const [materiais, setMateriais] = useState<MaterialItem[]>(value);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sincronizar com prop externa
  useEffect(() => {
    setMateriais(value);
  }, [value]);

  // Propagar mudanças para o componente pai
  const updateMateriais = (newMateriais: MaterialItem[]) => {
    setMateriais(newMateriais);
    onChange(newMateriais);
  };

  const adicionarMaterial = () => {
    const novoMaterial: MaterialItem = {
      id: `temp_${Date.now()}`,
      descricao: '',
      quantidade_planejada: 1,
      unidade: 'UN',
      custo_unitario: 0,
      custo_total: 0 // ✅ ADICIONADO: Garantir cálculo inicial
    };

    const novosMateriais = [...materiais, novoMaterial];
    updateMateriais(novosMateriais);
    setEditingId(novoMaterial.id!);
  };

  const removerMaterial = (index: number) => {
    const novosMateriais = materiais.filter((_, i) => i !== index);
    updateMateriais(novosMateriais);
    setEditingId(null);
  };

  const atualizarMaterial = (index: number, campo: keyof MaterialItem, valor: any) => {
    const novosMateriais = [...materiais];
    novosMateriais[index] = { ...novosMateriais[index], [campo]: valor };

    // Calcular custo total automaticamente
    if (campo === 'quantidade_planejada' || campo === 'custo_unitario') {
      const material = novosMateriais[index];
      if (material.quantidade_planejada && material.custo_unitario) {
        material.custo_total = material.quantidade_planejada * material.custo_unitario;
      }
    }

    updateMateriais(novosMateriais);
  };

  const calcularCustoTotal = () => {
    return materiais.reduce((total, material) => total + (material.custo_total || 0), 0);
  };

  // Removido getStatusColor e getStatusLabel pois não há mais campos de status

  if (disabled && materiais.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Package className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
        <p className="text-sm">Nenhum material cadastrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</Label>
          {materiais.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {materiais.length} {materiais.length === 1 ? 'item' : 'itens'}
            </Badge>
          )}
        </div>

        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarMaterial}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar Material</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>

      {/* Cards de Materiais */}
      <div className="grid gap-3">
        {materiais.map((material, index) => {
          const isEditing = editingId === material.id;
          
          return (
            <Card 
              key={material.id || index} 
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
                      <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Material #{index + 1}</span>
                    </div>
                    
                    {!disabled && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(isEditing ? null : material.id!)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerMaterial(index)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Campos do Material */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Descrição */}
                    <div className="md:col-span-2">
                      <Label htmlFor={`material-descricao-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        Descrição *
                      </Label>
                      <Input
                        id={`material-descricao-${index}`}
                        value={material.descricao}
                        onChange={(e) => atualizarMaterial(index, 'descricao', e.target.value)}
                        placeholder="Ex: Parafuso M8 x 20mm"
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>

                    {/* Quantidade Planejada */}
                    <div>
                      <Label htmlFor={`material-qtd-planejada-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        Qtd. {mode === 'planejamento' ? 'Planejada' : 'Necessária'} *
                      </Label>
                      <Input
                        id={`material-qtd-planejada-${index}`}
                        type="number"
                        min="0"
                        step="0.001"
                        value={material.quantidade_planejada}
                        onChange={(e) => atualizarMaterial(index, 'quantidade_planejada', parseFloat(e.target.value) || 0)}
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>

                    {/* Quantidade Consumida (apenas no modo execução) */}
                    {mode === 'execucao' && (
                      <div>
                        <Label htmlFor={`material-qtd-consumida-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          Qtd. Consumida
                        </Label>
                        <Input
                          id={`material-qtd-consumida-${index}`}
                          type="number"
                          min="0"
                          step="0.001"
                          value={material.quantidade_consumida || ''}
                          onChange={(e) => atualizarMaterial(index, 'quantidade_consumida', parseFloat(e.target.value) || 0)}
                          disabled={disabled || !isEditing}
                          className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}

                    {/* Unidade */}
                    <div>
                      <Label htmlFor={`material-unidade-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        Unidade *
                      </Label>
                      <Input
                        id={`material-unidade-${index}`}
                        value={material.unidade}
                        onChange={(e) => atualizarMaterial(index, 'unidade', e.target.value)}
                        placeholder="UN, KG, M, L..."
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>

                    {/* Custos (se habilitado) */}
                    {showCustos && (
                      <>
                        <div>
                          <Label htmlFor={`material-custo-unitario-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            <DollarSign className="h-3 w-3 inline mr-1" />
                            Custo Unitário (R$)
                          </Label>
                          <Input
                            id={`material-custo-unitario-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={material.custo_unitario || ''}
                            onChange={(e) => atualizarMaterial(index, 'custo_unitario', parseFloat(e.target.value) || 0)}
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
                            R$ {(material.custo_total || 0).toFixed(2)}
                          </div>
                        </div>
                      </>
                    )}


                  </div>

                  {/* Alerta de campos obrigatórios */}
                  {isEditing && (!material.descricao || !material.quantidade_planejada || !material.unidade) && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Preencha todos os campos obrigatórios (*)</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumo de Custos */}
      {showCustos && materiais.length > 0 && (
        <Card className="bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Custo Total dos Materiais</span>
              </div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                R$ {calcularCustoTotal().toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vazio */}
      {materiais.length === 0 && !disabled && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Package className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Nenhum material adicionado</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarMaterial}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Adicionar Primeiro Material
          </Button>
        </div>
      )}
    </div>
  );
};

export { MateriaisCardManager };