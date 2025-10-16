// src/components/common/cards/FerramentasCardManager.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus,
  Wrench,
  Edit3,
  Trash2,
  AlertTriangle,
  Settings,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FerramentaItem {
  id?: string;
  descricao: string;
  quantidade: number;
  utilizada?: boolean;
  condicao_antes?: string;
  condicao_depois?: string;
  codigo_patrimonial?: string;
  necessita_calibracao?: boolean;
  proxima_data_calibracao?: string;
}

interface FerramentasCardManagerProps {
  value: FerramentaItem[];
  onChange: (ferramentas: FerramentaItem[]) => void;
  disabled?: boolean;
  mode?: 'planejamento' | 'execucao' | 'view';
  showCondicao?: boolean;
  showCalibracao?: boolean;
  title?: string;
}

const FerramentasCardManager: React.FC<FerramentasCardManagerProps> = ({
  value = [],
  onChange,
  disabled = false,
  mode = 'planejamento',
  showCondicao = false,
  showCalibracao = true,
  title = "Ferramentas"
}) => {
  const [ferramentas, setFerramentas] = useState<FerramentaItem[]>(value);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sincronizar com prop externa
  useEffect(() => {
    setFerramentas(value);
  }, [value]);

  // Propagar mudanças para o componente pai
  const updateFerramentas = (newFerramentas: FerramentaItem[]) => {
    setFerramentas(newFerramentas);
    onChange(newFerramentas);
  };

  const adicionarFerramenta = () => {
    const novaFerramenta: FerramentaItem = {
      id: `temp_${Date.now()}`,
      descricao: '',
      quantidade: 1,
      utilizada: false
    };

    const novasFerramentas = [...ferramentas, novaFerramenta];
    updateFerramentas(novasFerramentas);
    setEditingId(novaFerramenta.id!);
  };

  const removerFerramenta = (index: number) => {
    const novasFerramentas = ferramentas.filter((_, i) => i !== index);
    updateFerramentas(novasFerramentas);
    setEditingId(null);
  };

  const atualizarFerramenta = (index: number, campo: keyof FerramentaItem, valor: any) => {
    const novasFerramentas = [...ferramentas];
    novasFerramentas[index] = { ...novasFerramentas[index], [campo]: valor };
    updateFerramentas(novasFerramentas);
  };

  // Removido getStatusColor e getStatusLabel pois campos confirmada/disponivel foram removidos

  const getCondicaoColor = (condicao?: string) => {
    if (!condicao) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    
    switch (condicao.toLowerCase()) {
      case 'excelente':
      case 'boa':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
      case 'regular':
      case 'aceitável':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'ruim':
      case 'danificada':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const verificarCalibracaoVencida = (dataString?: string) => {
    if (!dataString) return false;
    const hoje = new Date();
    const dataCalibracao = new Date(dataString);
    return dataCalibracao < hoje;
  };

  if (disabled && ferramentas.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Wrench className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
        <p className="text-sm">Nenhuma ferramenta cadastrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</Label>
          {ferramentas.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {ferramentas.length} {ferramentas.length === 1 ? 'item' : 'itens'}
            </Badge>
          )}
        </div>

        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarFerramenta}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar Ferramenta</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>

      {/* Cards de Ferramentas */}
      <div className="grid gap-3">
        {ferramentas.map((ferramenta, index) => {
          const isEditing = editingId === ferramenta.id;
          const calibracaoVencida = verificarCalibracaoVencida(ferramenta.proxima_data_calibracao);
          
          return (
            <Card 
              key={ferramenta.id || index} 
              className={cn(
                "transition-all duration-200 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700",
                isEditing && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20 dark:ring-blue-400",
                calibracaoVencida && "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
              )}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Ferramenta #{index + 1}</span>
                      
                      {/* Badge de Utilizada */}
                      {ferramenta.utilizada && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                          Utilizada
                        </Badge>
                      )}
                      
                      {/* Badge de Calibração */}
                      {showCalibracao && ferramenta.necessita_calibracao && (
                        <Badge 
                          variant={calibracaoVencida ? "destructive" : "secondary"} 
                          className="text-xs"
                        >
                          {calibracaoVencida ? "Calibração Vencida" : "Requer Calibração"}
                        </Badge>
                      )}
                      
                      {/* Código Patrimonial */}
                      {ferramenta.codigo_patrimonial && (
                        <Badge variant="outline" className="text-xs">
                          {ferramenta.codigo_patrimonial}
                        </Badge>
                      )}
                    </div>
                    
                    {!disabled && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(isEditing ? null : ferramenta.id!)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerFerramenta(index)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Campos da Ferramenta */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Descrição */}
                    <div className="md:col-span-2">
                      <Label htmlFor={`ferramenta-descricao-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        Descrição *
                      </Label>
                      <Input
                        id={`ferramenta-descricao-${index}`}
                        value={ferramenta.descricao}
                        onChange={(e) => atualizarFerramenta(index, 'descricao', e.target.value)}
                        placeholder="Ex: Chave inglesa 12mm, Multímetro digital"
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>

                    {/* Quantidade */}
                    <div>
                      <Label htmlFor={`ferramenta-quantidade-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        Quantidade *
                      </Label>
                      <Input
                        id={`ferramenta-quantidade-${index}`}
                        type="number"
                        min="1"
                        value={ferramenta.quantidade}
                        onChange={(e) => atualizarFerramenta(index, 'quantidade', parseInt(e.target.value) || 1)}
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>

                    {/* Código Patrimonial 

                    <div>
                      <Label htmlFor={`ferramenta-codigo-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        Código Patrimonial
                      </Label>
                      <Input
                        id={`ferramenta-codigo-${index}`}
                        value={ferramenta.codigo_patrimonial || ''}
                        onChange={(e) => atualizarFerramenta(index, 'codigo_patrimonial', e.target.value)}
                        placeholder="Ex: FER-001"
                        disabled={disabled || !isEditing}
                        className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    */}

                    {/* Calibração 
                    {showCalibracao && (
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ferramenta.necessita_calibracao || false}
                            onChange={(e) => atualizarFerramenta(index, 'necessita_calibracao', e.target.checked)}
                            disabled={disabled || !isEditing}
                            className="rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-xs text-gray-900 dark:text-gray-100">Necessita Calibração</span>
                          <Settings className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </label>

                        {ferramenta.necessita_calibracao && (
                          <div>
                            <Label htmlFor={`ferramenta-calibracao-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              Próxima Calibração
                            </Label>
                            <Input
                              id={`ferramenta-calibracao-${index}`}
                              type="date"
                              value={ferramenta.proxima_data_calibracao || ''}
                              onChange={(e) => atualizarFerramenta(index, 'proxima_data_calibracao', e.target.value)}
                              disabled={disabled || !isEditing}
                              className="text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    */}

                    {/* Condição da Ferramenta (antes e depois) 
                    {showCondicao && (
                      <>
                        <div>
                          <Label htmlFor={`ferramenta-condicao-antes-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            Condição Antes
                          </Label>
                          <select
                            id={`ferramenta-condicao-antes-${index}`}
                            value={ferramenta.condicao_antes || ''}
                            onChange={(e) => atualizarFerramenta(index, 'condicao_antes', e.target.value)}
                            disabled={disabled || !isEditing}
                            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Selecionar...</option>
                            <option value="excelente">Excelente</option>
                            <option value="boa">Boa</option>
                            <option value="regular">Regular</option>
                            <option value="ruim">Ruim</option>
                            <option value="danificada">Danificada</option>
                          </select>
                        </div>

                        <div>
                          <Label htmlFor={`ferramenta-condicao-depois-${index}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            Condição Depois
                          </Label>
                          <select
                            id={`ferramenta-condicao-depois-${index}`}
                            value={ferramenta.condicao_depois || ''}
                            onChange={(e) => atualizarFerramenta(index, 'condicao_depois', e.target.value)}
                            disabled={disabled || !isEditing}
                            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Selecionar...</option>
                            <option value="excelente">Excelente</option>
                            <option value="boa">Boa</option>
                            <option value="regular">Regular</option>
                            <option value="ruim">Ruim</option>
                            <option value="danificada">Danificada</option>
                          </select>
                        </div>
                      </>
                    )}
                    */}

                    {/* Status toggle utilizada (apenas no modo execução) */}
                    {mode === 'execucao' && (
                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ferramenta.utilizada}
                            onChange={(e) => atualizarFerramenta(index, 'utilizada', e.target.checked)}
                            disabled={disabled || !isEditing}
                            className="rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-xs text-gray-900 dark:text-gray-100">Utilizada</span>
                        </label>
                      </div>
                    )}

                  </div>

                  {/* Alertas importantes */}
                  <div className="space-y-2">
                    {/* Calibração vencida */}
                    {calibracaoVencida && (
                      <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Calibração vencida! Ferramenta pode estar imprecisa.</span>
                      </div>
                    )}

                    {/* Campos obrigatórios */}
                    {isEditing && (!ferramenta.descricao || !ferramenta.quantidade) && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Preencha todos os campos obrigatórios (*)</span>
                      </div>
                    )}

                    {/* Condição ruim */}
                    {(ferramenta.condicao_antes === 'ruim' || ferramenta.condicao_antes === 'danificada' ||
                      ferramenta.condicao_depois === 'ruim' || ferramenta.condicao_depois === 'danificada') && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Ferramenta em condição inadequada - verificar antes do uso!</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Estado vazio */}
      {ferramentas.length === 0 && !disabled && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Wrench className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Nenhuma ferramenta adicionada</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarFerramenta}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Adicionar Primeira Ferramenta
          </Button>
        </div>
      )}
    </div>
  );
};

export { FerramentasCardManager };