// src/features/equipamentos/components/modals/ComponenteUARModal.tsx - CORRIGIDO PARA API
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Component, Save, Wrench, X, AlertCircle, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Equipamento } from '../../types';
import { tiposEquipamentosApi, type TipoEquipamentoModal } from '@/services/tipos-equipamentos.services';

interface ComponenteUARModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  entity?: Equipamento | null;
  equipamentoPai?: Equipamento | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const ComponenteUARModal: React.FC<ComponenteUARModalProps> = ({
  isOpen,
  mode,
  entity,
  equipamentoPai,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  // Estados para tipos de equipamentos da API
  const [tiposEquipamentos, setTiposEquipamentos] = useState<TipoEquipamentoModal[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);

  // Helper para buscar tipo de equipamento
  const getTipoEquipamento = (codigo: string): TipoEquipamentoModal | undefined => {
    return tiposEquipamentos.find(t => t.value === codigo);
  };

  // Carregar tipos de equipamentos da API
  useEffect(() => {
    const loadTiposEquipamentos = async () => {
      setLoadingTipos(true);
      try {
        const tipos = await tiposEquipamentosApi.getAll();
        const tiposFormatados = tipos.map(tipo => ({
          value: tipo.codigo,
          label: tipo.nome,
          categoria: tipo.categoria,
          camposTecnicos: (tipo.propriedades_schema?.campos || []).map(campo => ({
            campo: campo.nome,
            tipo: campo.tipo === 'boolean' ? ('select' as const) : campo.tipo,
            unidade: campo.unidade,
            opcoes: campo.opcoes || (campo.tipo === 'boolean' ? ['Sim', 'Não'] : undefined),
            obrigatorio: campo.obrigatorio,
          })),
        }));
        setTiposEquipamentos(tiposFormatados);
        console.log('✅ [MODAL UAR] Tipos de equipamentos carregados da API:', tiposFormatados.length);
      } catch (err) {
        console.error('❌ [MODAL UAR] Erro ao carregar tipos de equipamentos:', err);
        setError('Erro ao carregar tipos de equipamentos');
      } finally {
        setLoadingTipos(false);
      }
    };

    if (isOpen) {
      loadTiposEquipamentos();
    }
  }, [isOpen]);

  useEffect(() => {
    if (entity && mode !== 'create') {
      console.log('📋 [MODAL UAR] Dados completos do componente:', entity);

      setFormData({
        ...entity,
        tipoComponente: entity.tipoEquipamento || entity.tipo || ''
      });
    } else {
      setFormData({
        classificacao: 'UAR',
        criticidade: '3',
        equipamentoPaiId: equipamentoPai?.id,
        // Herdar dados do equipamento pai
        plantaId: equipamentoPai?.unidade?.plantaId,
        unidadeId: equipamentoPai?.unidadeId,
        proprietarioId: equipamentoPai?.proprietarioId
      });
    }
    setError(null);
  }, [entity, mode, equipamentoPai]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  // Filtrar apenas tipos apropriados para componentes UAR
  const tiposComponentesUAR = tiposEquipamentos.filter(tipo => 
    ['sensor_temperatura', 'sensor_vibracao', 'bomba_oleo', 'filtro_ar', 'valvula_seguranca', 
     'rele_protecao', 'disjuntor', 'seccionadora', 'inversor_frequencia', 'clp', 'sensor_pressao',
     'medidor_energia', 'analisador_qualidade', 'controlador_temperatura'].includes(tipo.value) ||
    ['eletronica', 'instrumentacao', 'protecao'].includes(tipo.categoria)
  );

  const renderCamposTecnicos = () => {
    if (!formData.tipoComponente) {
      return (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border text-center text-gray-500 dark:text-gray-400">
          Selecione um tipo de componente para ver os campos técnicos
        </div>
      );
    }

    // Usar configuração dos tipos de equipamentos
    const tipoEqp = getTipoEquipamento(formData.tipoComponente);
    if (!tipoEqp || !tipoEqp.camposTecnicos.length) {
      return (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border text-center text-gray-500 dark:text-gray-400">
          Nenhum campo técnico definido para este tipo
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
          Dados Técnicos - {tipoEqp.label}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tipoEqp.camposTecnicos.map((campo) => (
            <div key={campo.campo}>
              <label className="text-sm font-medium">
                {campo.campo}
                {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                {campo.unidade && <span className="text-muted-foreground"> ({campo.unidade})</span>}
              </label>
              {isReadOnly ? (
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                  {formData[campo.campo] || <span className="text-gray-400">Não informado</span>}
                </div>
              ) : campo.tipo === 'select' && campo.opcoes ? (
                <Select 
                  value={formData[campo.campo] || ''} 
                  onValueChange={(value) => handleFieldChange(campo.campo, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {campo.opcoes.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={campo.tipo === 'number' ? 'number' : 'text'}
                  placeholder={`${campo.campo}${campo.unidade ? ` (${campo.unidade})` : ''}`}
                  value={formData[campo.campo] || ''}
                  onChange={(e) => handleFieldChange(campo.campo, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.nome?.trim()) {
      errors.push('Nome é obrigatório');
    }

    if (!formData.tipoComponente) {
      errors.push('Tipo é obrigatório');
    }

    // Validar campos técnicos obrigatórios
    if (formData.tipoComponente) {
      const tipoEqp = getTipoEquipamento(formData.tipoComponente);
      if (tipoEqp && tipoEqp.camposTecnicos) {
        tipoEqp.camposTecnicos.forEach(campo => {
          if (campo.obrigatorio && !formData[campo.campo]) {
            errors.push(`${campo.campo} é obrigatório`);
          }
        });
      }
    }

    if (errors.length > 0) {
      setError(errors.join('; '));
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Buscar o ID do tipo de equipamento pelo código
    const tipoEqpSelecionado = formData.tipoComponente ?
      await tiposEquipamentosApi.findByCode(formData.tipoComponente) : null;

    const submitData = {
      // Dados básicos
      nome: formData.nome,
      classificacao: 'UAR',
      equipamento_pai_id: formData.equipamentoPaiId,
      fabricante: formData.fabricante,
      modelo: formData.modelo,
      numero_serie: formData.numeroSerie,
      criticidade: formData.criticidade,
      tipo_equipamento: formData.tipoComponente,  // Código (compatibilidade)
      tipo_equipamento_id: tipoEqpSelecionado?.id,  // ID do tipo (correto)
      data_instalacao: formData.dataInstalacao,
      localizacao_especifica: formData.localizacaoEspecifica,
      plano_manutencao: formData.planoManutencao,
      fornecedor: formData.fornecedor,
      valor_imobilizado: formData.valorImobilizado ? parseFloat(formData.valorImobilizado) : undefined,
      valor_depreciacao: formData.valorDepreciacao ? parseFloat(formData.valorDepreciacao) : undefined,
      valor_contabil: formData.valorContabil ? parseFloat(formData.valorContabil) : undefined,
      observacoes: formData.observacoes,
      // Herdar do equipamento pai
      planta_id: formData.plantaId,
      proprietario_id: formData.proprietarioId
    };

    console.log('📤 [MODAL UAR] Dados sendo enviados para API:', submitData);
    onSubmit(submitData);
  };

  const isReadOnly = mode === 'view';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="bg-blue-600 text-white px-6 py-4 -mx-6 -mt-6">
          <DialogTitle className="flex items-center gap-2">
            <Component className="h-5 w-5" />
            {mode === 'create' ? 'Novo Componente UAR' : 
             mode === 'edit' ? 'Editar Componente UAR' : 
             'Visualizar Componente UAR'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 p-1">
          {/* Erro de validação */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Informação do Equipamento Pai */}
          {equipamentoPai && (
            <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Equipamento Pai (UC):
                </span>
              </div>
              <div className="text-orange-700 dark:text-orange-300">
                <div className="font-medium">{equipamentoPai.nome}</div>
                <div className="text-xs flex gap-4">
                  {equipamentoPai.fabricante && <span>Fabricante: {equipamentoPai.fabricante}</span>}
                  {equipamentoPai.modelo && <span>Modelo: {equipamentoPai.modelo}</span>}
                </div>
                <div className="text-xs">Planta: {equipamentoPai.planta?.nome}</div>
              </div>
            </div>
          )}

          {/* ============================================================================ */}
          {/* DADOS BÁSICOS DO COMPONENTE UAR */}
          {/* ============================================================================ */}
          <div>
            <h3 className="font-medium mb-4 text-primary">Dados do Componente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Coluna 1 */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.nome || ''} 
                    onChange={(e) => handleFieldChange('nome', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Nome do componente"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo <span className="text-red-500">*</span></label>
                  <Select 
                    value={formData.tipoComponente || ''} 
                    onValueChange={(value) => handleFieldChange('tipoComponente', value)} 
                    disabled={isReadOnly || loadingTipos}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingTipos ? "Carregando..." : "Selecione o tipo"} />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingTipos ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        tiposComponentesUAR.map(tipo => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            <div>
                              <div>{tipo.label}</div>
                              <div className="text-xs text-muted-foreground capitalize">{tipo.categoria}</div>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Modelo</label>
                  <Input 
                    value={formData.modelo || ''} 
                    onChange={(e) => handleFieldChange('modelo', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Modelo do componente"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Fabricante</label>
                  <Input 
                    value={formData.fabricante || ''} 
                    onChange={(e) => handleFieldChange('fabricante', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Fabricante"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Número de Série</label>
                  <Input 
                    value={formData.numeroSerie || ''} 
                    onChange={(e) => handleFieldChange('numeroSerie', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Número de série"
                  />
                </div>
              </div>

              {/* Coluna 2 */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Data de Instalação</label>
                  <Input 
                    type="date"
                    value={formData.dataInstalacao || ''} 
                    onChange={(e) => handleFieldChange('dataInstalacao', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Criticidade</label>
                  <Select value={formData.criticidade || ''} onValueChange={(value) => handleFieldChange('criticidade', value)} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="1 a 5" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (Muito Baixa)</SelectItem>
                      <SelectItem value="2">2 (Baixa)</SelectItem>
                      <SelectItem value="3">3 (Média)</SelectItem>
                      <SelectItem value="4">4 (Alta)</SelectItem>
                      <SelectItem value="5">5 (Muito Alta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Localização Específica</label>
                  <Input 
                    value={formData.localizacaoEspecifica || ''} 
                    onChange={(e) => handleFieldChange('localizacaoEspecifica', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Ex: Lado direito, Entrada principal..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">PM (Plano de Manutenção)</label>
                  <Input 
                    value={formData.planoManutencao || ''} 
                    onChange={(e) => handleFieldChange('planoManutencao', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Código do plano de manutenção"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Fornecedor</label>
                  <Input 
                    value={formData.fornecedor || ''} 
                    onChange={(e) => handleFieldChange('fornecedor', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Fornecedor do componente"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================================ */}
          {/* DADOS TÉCNICOS DINÂMICOS DO COMPONENTE */}
          {/* ============================================================================ */}
          <div>
            <h3 className="font-medium mb-4 text-primary">Dados Técnicos</h3>
            {renderCamposTecnicos()}
          </div>

          {/* ============================================================================ */}
          {/* VALORES FINANCEIROS */}
          {/* ============================================================================ */}
          <div>
            <h3 className="font-medium mb-4 text-primary">Valores Financeiros</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Valor Imobilizado</label>
                <Input 
                  type="number"
                  value={formData.valorImobilizado || ''} 
                  onChange={(e) => handleFieldChange('valorImobilizado', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Valor de Depreciação</label>
                <Input 
                  type="number"
                  value={formData.valorDepreciacao || ''} 
                  onChange={(e) => handleFieldChange('valorDepreciacao', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Valor Contábil</label>
                <Input 
                  type="number"
                  value={formData.valorContabil || ''} 
                  onChange={(e) => handleFieldChange('valorContabil', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* ============================================================================ */}
          {/* OBSERVAÇÕES ADICIONAIS */}
          {/* ============================================================================ */}
          <div>
            <label className="text-sm font-medium">Observações</label>
            <Textarea 
              value={formData.observacoes || ''} 
              onChange={(e) => handleFieldChange('observacoes', e.target.value)}
              disabled={isReadOnly}
              placeholder="Observações adicionais sobre o componente"
              rows={3}
            />
          </div>
        </div>

        {/* Footer com botões */}
        <div className="border-t pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          {mode !== 'view' && (
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              Salvar Componente UAR
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};