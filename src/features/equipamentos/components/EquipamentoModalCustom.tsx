// src/features/equipamentos/components/EquipamentoModalCustom.tsx - MODAL CUSTOMIZADO
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wrench, Component, Save, X, Plus } from 'lucide-react';
import { Equipamento } from '../types';
import { CheckedState } from '@radix-ui/react-checkbox';
import { ProprietarioSelector } from '@/features/plantas/components/ProprietarioSelector';

// Tipos de equipamentos
const TIPOS_EQUIPAMENTOS = [
  { value: 'motor_inducao', label: 'Motor de Indução' },
  { value: 'banco_capacitor', label: 'Banco de Capacitor' },
  { value: 'transformador', label: 'Transformador' },
  { value: 'pde', label: 'PDE (Poste de Distribuição)' },
  { value: 'cabine_blindada', label: 'Cabine Blindada ao Tempo' },
  { value: 'cabine_alvenaria', label: 'Cabine de Alvenaria' },
  { value: 'qgbt', label: 'QGBT – Quadro Geral de Baixa Tensão' },
  { value: 'qd', label: 'QD – Quadro de Distribuição' },
  { value: 'iluminacao', label: 'Iluminação' },
  { value: 'cftv', label: 'CFTV – Circuito Fechado de TV' },
  { value: 'monitoramento', label: 'Monitoramento' },
  { value: 'aterramento_spda', label: 'Aterramento / SPDA' },
  { value: 'inversor_solar', label: 'Inversor Solar' },
  { value: 'placa_solar', label: 'Placa Solar' },
  { value: 'estrutura_fixa', label: 'Estrutura Fixa' },
  { value: 'estrutura_tracker', label: 'Estrutura Tracker' },
  { value: 'cercamento', label: 'Cercamento' }
];

const mockPlantas = [
  { id: 1, nome: 'Planta Industrial São Paulo' },
  { id: 2, nome: 'Centro de Distribuição Rio' },
  { id: 3, nome: 'Unidade Administrativa BH' },
  { id: 4, nome: 'Oficina João Silva' }
];

interface EquipamentoModalCustomProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  entity?: Equipamento | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isUAR?: boolean;
}

export const EquipamentoModalCustom: React.FC<EquipamentoModalCustomProps> = ({
  isOpen,
  mode,
  entity,
  onClose,
  onSubmit,
  isUAR = false
}) => {
  const [formData, setFormData] = useState<any>({});
  const [temTUC, setTemTUC] = useState(false);

  useEffect(() => {
    if (entity && mode !== 'create') {
      setFormData({
        ...entity,
        plantaId: entity.unidade?.plantaId ? String(entity.unidade.plantaId) : '',
        unidadeId: entity.unidadeId ? String(entity.unidadeId) : '',
        proprietarioId: entity.proprietarioId ? String(entity.proprietarioId) : '',
        criticidade: entity.criticidade || '3'
      });
      setTemTUC(!!entity.tuc);
    } else {
      setFormData({
        classificacao: isUAR ? 'UAR' : 'UC',
        criticidade: '3'
      });
      setTemTUC(false);
    }
  }, [entity, mode, isUAR]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (checked: CheckedState) => {
    setTemTUC(checked === true);
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const isReadOnly = mode === 'view';

  const getModalTitle = () => {
    if (isUAR) {
      return mode === 'create' ? 'Novo Componente UAR' : 
             mode === 'edit' ? 'Editar Componente UAR' : 
             'Visualizar Componente UAR';
    }
    return mode === 'create' ? 'Novo Equipamento UC' : 
           mode === 'edit' ? 'Editar Equipamento UC' : 
           'Visualizar Equipamento UC';
  };

  const renderCamposEspecificosPorTipo = () => {
    const tipoEquipamento = formData.tipoEquipamento;
    
    if (!tipoEquipamento) return null;

    switch (tipoEquipamento) {
      case 'motor_inducao':
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
              MG – Módulo Geral (parte civil e comum à área)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo de fundação ✅</label>
                <Select value={formData?.tipoFundacao || ''} onValueChange={(value) => handleFieldChange('tipoFundacao', value)} disabled={isReadOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concreto">Concreto</SelectItem>
                    <SelectItem value="metalica">Metálica</SelectItem>
                    <SelectItem value="mista">Mista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Potência (kW)</label>
                <Input 
                  type="number" 
                  placeholder="Ex: 15"
                  value={formData?.potencia || ''}
                  onChange={(e) => handleFieldChange('potencia', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tensão nominal</label>
                <Input 
                  type="text" 
                  placeholder="Ex: 380V"
                  value={formData?.tensaoNominal || ''}
                  onChange={(e) => handleFieldChange('tensaoNominal', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Corrente nominal</label>
                <Input 
                  type="text" 
                  placeholder="Ex: 28A"
                  value={formData?.correnteNominal || ''}
                  onChange={(e) => handleFieldChange('correnteNominal', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Fator de serviço</label>
                <Input 
                  type="text" 
                  placeholder="Ex: 1.15"
                  value={formData?.fatorServico || ''}
                  onChange={(e) => handleFieldChange('fatorServico', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Número de polos</label>
                <Input 
                  type="text" 
                  placeholder="Ex: 4"
                  value={formData?.numeroPolos || ''}
                  onChange={(e) => handleFieldChange('numeroPolos', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Grau de proteção (IP)</label>
                <Input 
                  type="text" 
                  placeholder="Ex: IP55"
                  value={formData?.grauProtecao || ''}
                  onChange={(e) => handleFieldChange('grauProtecao', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Classe de isolamento</label>
                <Input 
                  type="text" 
                  placeholder="Ex: F"
                  value={formData?.classeIsolamento || ''}
                  onChange={(e) => handleFieldChange('classeIsolamento', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo de partida ✅</label>
                <Select value={formData?.tipoPartida || ''} onValueChange={(value) => handleFieldChange('tipoPartida', value)} disabled={isReadOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direta">Direta</SelectItem>
                    <SelectItem value="estrela_triangulo">Estrela-Triângulo</SelectItem>
                    <SelectItem value="soft_starter">Soft Starter</SelectItem>
                    <SelectItem value="inversor">Inversor de Frequência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Campos específicos para <strong>{TIPOS_EQUIPAMENTOS.find(t => t.value === tipoEquipamento)?.label}</strong> serão implementados.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Vai depender do tipo de equipamento. Permitir o Analista adicionar campos adicionais técnicos na aba "Tipo de Ativo"
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="bg-primary text-primary-foreground px-6 py-4 -mx-6 -mt-6">
          <DialogTitle className="flex items-center gap-2 text-white">
            {isUAR ? (
              <Component className="h-5 w-5" />
            ) : (
              <Wrench className="h-5 w-5" />
            )}
            {getModalTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 p-1">
          {/* Dados Gerais - Layout 3 colunas */}
          <div>
            <h3 className="font-medium mb-4 text-primary">Dados Gerais:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Coluna 1 */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome: <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.nome || ''} 
                    onChange={(e) => handleFieldChange('nome', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Nome do equipamento"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Classificação:</label>
                  <Select value={formData.classificacao || ''} onValueChange={(value) => handleFieldChange('classificacao', value)} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="novo/usado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="usado">Usado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">número série</label>
                  <Input 
                    value={formData.numeroSerie || ''} 
                    onChange={(e) => handleFieldChange('numeroSerie', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Em operação:</label>
                  <Select value={formData.emOperacao || ''} onValueChange={(value) => handleFieldChange('emOperacao', value)} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sim/Não" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo de depreciação:</label>
                  <Select value={formData.tipoDepreciacao || ''} onValueChange={(value) => handleFieldChange('tipoDepreciacao', value)} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="Linear/Uso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="uso">Uso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Valor Imobilizado:</label>
                  <Input 
                    value={formData.valorImobilizado || ''} 
                    onChange={(e) => handleFieldChange('valorImobilizado', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Coluna 2 */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Planta:</label>
                  <Select value={formData.plantaId || ''} onValueChange={(value) => handleFieldChange('plantaId', value)} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma planta" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockPlantas.map(planta => (
                        <SelectItem key={planta.id} value={String(planta.id)}>
                          {planta.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Fabricante:</label>
                  <Input 
                    value={formData.fabricante || ''} 
                    onChange={(e) => handleFieldChange('fabricante', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Criticidade:</label>
                  <Select value={formData.criticidade || ''} onValueChange={(value) => handleFieldChange('criticidade', value)} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="1 a 5" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Fornecedor:</label>
                  <Input 
                    value={formData.fornecedor || ''} 
                    onChange={(e) => handleFieldChange('fornecedor', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Data Imobilização</label>
                  <Input 
                    type="date"
                    value={formData.dataImobilizacao || ''} 
                    onChange={(e) => handleFieldChange('dataImobilizacao', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Valor da depreciação:</label>
                  <Input 
                    value={formData.valorDepreciacao || ''} 
                    onChange={(e) => handleFieldChange('valorDepreciacao', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Coluna 3 */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Proprietário</label>
                  <ProprietarioSelector
                    value={formData.proprietarioId || null}
                    onChange={(value) => handleFieldChange('proprietarioId', value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">modelo:</label>
                  <Input 
                    value={formData.modelo || ''} 
                    onChange={(e) => handleFieldChange('modelo', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo:</label>
                  <Select value={formData.tipoEquipamento || ''} onValueChange={(value) => handleFieldChange('tipoEquipamento', value)} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_EQUIPAMENTOS.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Centro de custo</label>
                  <Input 
                    value={formData.centroCusto || ''} 
                    onChange={(e) => handleFieldChange('centroCusto', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Vida útil:</label>
                  <Input 
                    value={formData.vidaUtil || ''} 
                    onChange={(e) => handleFieldChange('vidaUtil', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Anos"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Valor contábil:</label>
                  <Input 
                    value={formData.valorContabil || ''} 
                    onChange={(e) => handleFieldChange('valorContabil', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Campos TUC e A1-A6 */}
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 items-end">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="temTUC" 
                  checked={temTUC}
                  onCheckedChange={handleCheckboxChange}
                  disabled={isReadOnly}
                />
                <label htmlFor="temTUC" className="text-sm font-medium">
                  se for "sim" aparece a linha de TUC e A1 a A6
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">MCPSE</label>
                <Input disabled={isReadOnly} placeholder="sim/não" />
              </div>
              {temTUC && (
                <div>
                  <label className="text-sm font-medium">TUC</label>
                  <Input 
                    value={formData.tuc || ''} 
                    onChange={(e) => handleFieldChange('tuc', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              )}
              {temTUC && (
                <div>
                  <label className="text-sm font-medium">A1</label>
                  <Input 
                    value={formData.a1 || ''} 
                    onChange={(e) => handleFieldChange('a1', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">A2:</label>
                <Input 
                  value={formData.a2 || ''} 
                  onChange={(e) => handleFieldChange('a2', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">A3</label>
                <Input 
                  value={formData.a3 || ''} 
                  onChange={(e) => handleFieldChange('a3', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">A4:</label>
                <Input 
                  value={formData.a4 || ''} 
                  onChange={(e) => handleFieldChange('a4', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">A5:</label>
                <Input 
                  value={formData.a5 || ''} 
                  onChange={(e) => handleFieldChange('a5', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="text-sm font-medium">A6:</label>
                <Input 
                  value={formData.a6 || ''} 
                  onChange={(e) => handleFieldChange('a6', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          {/* Plano de manutenção */}
          <div>
            <div>
              <label className="text-sm font-medium">Plano de manutenção:</label>
              <Input 
                value={formData.planoManutencao || ''} 
                onChange={(e) => handleFieldChange('planoManutencao', e.target.value)}
                disabled={isReadOnly}
                placeholder="inserir"
              />
            </div>
          </div>

          {/* Dados Técnicos */}
          <div>
            <h3 className="font-medium mb-4 text-primary">Dados Técnicos</h3>
            {renderCamposEspecificosPorTipo()}
          </div>

          {/* UARs/Componentes - apenas para UC */}
          {!isUAR && (
            <div>
              <h3 className="font-medium mb-4 text-primary">UARs/Componentes</h3>
              <div className="p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Plus className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">Adicionar UAR/componente</span>
                </div>
                
                <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground mb-2">
                  <div>Nome</div>
                  <div>Tipo</div>
                  <div>Modelo</div>
                  <div>Fabricante</div>
                  <div>data instalação</div>
                  <div>PM</div>
                </div>
                
                <div className="text-center py-8 text-muted-foreground">
                  <Component className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum componente UAR cadastrado</p>
                  <p className="text-xs mt-1">Use o botão "Gerenciar" na tabela para adicionar componentes</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer com botões */}
        <div className="border-t pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          {mode !== 'view' && (
            <Button onClick={handleSubmit} className="bg-primary">
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};