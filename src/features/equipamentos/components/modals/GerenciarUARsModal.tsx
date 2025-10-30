// src/features/equipamentos/components/modals/GerenciarUARsModal.tsx - TOTALMENTE CORRIGIDO
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Component, 
  Wrench, 
  Save, 
  X, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Calendar,
  MapPin,
  Settings,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Equipamento } from '../../types';
import { ComponenteUARModal } from './ComponenteUARModal';
import { useEquipamentos } from '../../hooks/useEquipamentos';

// Tipos específicos para componentes UAR
const TIPOS_COMPONENTES_UAR = [
  { value: 'sensor_temperatura', label: 'Sensor de Temperatura' },
  { value: 'sensor_vibracao', label: 'Sensor de Vibração' },
  { value: 'sensor_pressao', label: 'Sensor de Pressão' },
  { value: 'bomba_oleo', label: 'Bomba de Óleo' },
  { value: 'filtro_ar', label: 'Filtro de Ar' },
  { value: 'filtro_oleo', label: 'Filtro de Óleo' },
  { value: 'valvula_seguranca', label: 'Válvula de Segurança' },
  { value: 'valvula_controle', label: 'Válvula de Controle' },
  { value: 'rele_protecao', label: 'Relé de Proteção' },
  { value: 'contatora', label: 'Contatora' },
  { value: 'fusivel', label: 'Fusível' },
  { value: 'disjuntor_auxiliar', label: 'Disjuntor Auxiliar' },
  { value: 'transformador_corrente', label: 'Transformador de Corrente' },
  { value: 'transformador_potencial', label: 'Transformador de Potencial' },
  { value: 'capacitor', label: 'Capacitor' },
  { value: 'resistor_aquecimento', label: 'Resistor de Aquecimento' },
  { value: 'ventilador', label: 'Ventilador' },
  { value: 'cooler', label: 'Cooler' },
  { value: 'encoder', label: 'Encoder' },
  { value: 'tacometro', label: 'Tacômetro' }
];

interface GerenciarUARsModalProps {
  isOpen: boolean;
  equipamentoUC: Equipamento | null;
  onClose: () => void;
  onSave: (uars: Equipamento[]) => Promise<void>;
}

interface UARFormData {
  id?: string; // CORRIGIDO: string em vez de number
  nome: string;
  tipo: string;
  modelo: string;
  fabricante: string;
  dataInstalacao: string;
  localizacaoEspecifica: string;
  planoManutencao: string;
  criticidade: '1' | '2' | '3' | '4' | '5';
  observacoes: string;
}

export const GerenciarUARsModal: React.FC<GerenciarUARsModalProps> = ({
  isOpen,
  equipamentoUC,
  onClose,
  onSave
}) => {
  const { 
    loading, 
    error,
    fetchComponentesParaGerenciar 
  } = useEquipamentos();

  const [uarsLista, setUarsLista] = useState<Equipamento[]>([]);
  const [modoFormulario, setModoFormulario] = useState<'lista' | 'novo' | 'editar'>('lista');
  const [uarEditando, setUarEditando] = useState<Equipamento | null>(null);
  const [novoUARData, setNovoUARData] = useState<UARFormData>({
    nome: '',
    tipo: '',
    modelo: '',
    fabricante: '',
    dataInstalacao: '',
    localizacaoEspecifica: '',
    planoManutencao: '',
    criticidade: '3',
    observacoes: ''
  });
  const [loadingData, setLoadingData] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Modal detalhado para UAR
  const [modalUARDetalhes, setModalUARDetalhes] = useState({
    isOpen: false,
    mode: 'view' as 'create' | 'edit' | 'view',
    entity: null as Equipamento | null
  });

  // Carregar componentes quando o modal abre
  useEffect(() => {
    if (equipamentoUC && isOpen) {
      loadComponentes();
    }
    
    // Reset estados
    setModoFormulario('lista');
    setUarEditando(null);
    resetFormulario();
    setErrorLocal(null);
  }, [equipamentoUC, isOpen]);

  const loadComponentes = async () => {
    if (!equipamentoUC) return;

    try {
      setLoadingData(true);
      setErrorLocal(null);
      
      const ucId = equipamentoUC.id; // USA ID STRING DIRETAMENTE
      const result = await fetchComponentesParaGerenciar(ucId);
      
      setUarsLista(result.componentes);
      
    } catch (err) {
      setErrorLocal('Erro ao carregar componentes');
      console.error('Erro ao carregar componentes:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const resetFormulario = () => {
    setNovoUARData({
      nome: '',
      tipo: '',
      modelo: '',
      fabricante: '',
      dataInstalacao: '',
      localizacaoEspecifica: '',
      planoManutencao: '',
      criticidade: '3',
      observacoes: ''
    });
  };

  const handleFieldChange = (field: keyof UARFormData, value: string) => {
    setNovoUARData(prev => ({ ...prev, [field]: value }));
  };

  const handleAdicionarUAR = () => {
    setModoFormulario('novo');
    resetFormulario();
  };

  const handleEditarUAR = (uar: Equipamento) => {
    setUarEditando(uar);
    setNovoUARData({
      id: uar.id, // ID JÁ É STRING
      nome: uar.nome,
      tipo: uar.tipo || '',
      modelo: uar.modelo || '',
      fabricante: uar.fabricante || '',
      dataInstalacao: uar.dataInstalacao || '',
      localizacaoEspecifica: uar.localizacaoEspecifica || '',
      planoManutencao: uar.planoManutencao || '',
      criticidade: uar.criticidade,
      observacoes: uar.observacoes || ''
    });
    setModoFormulario('editar');
  };

  const handleVisualizarUAR = (uar: Equipamento) => {
    setModalUARDetalhes({
      isOpen: true,
      mode: 'view',
      entity: uar
    });
  };

  const handleRemoverUAR = (uarId: string) => { // CORRIGIDO: string em vez de number
    if (confirm('Tem certeza que deseja remover este componente UAR?')) {
      setUarsLista(prev => prev.filter(uar => uar.id !== uarId));
    }
  };

  const handleSalvarUAR = () => {
    if (!novoUARData.nome.trim()) {
      alert('Nome do componente é obrigatório');
      return;
    }

    if (!novoUARData.tipo) {
      alert('Tipo do componente é obrigatório');
      return;
    }

    if (modoFormulario === 'novo') {
      const novoUAR: Equipamento = {
        id: `temp_${Date.now()}`, // GERAR ID TEMPORÁRIO COMO STRING
        nome: novoUARData.nome.trim(),
        classificacao: 'UAR',
        tipo: novoUARData.tipo,
        modelo: novoUARData.modelo?.trim(),
        fabricante: novoUARData.fabricante?.trim(),
        criticidade: novoUARData.criticidade,
        dataInstalacao: novoUARData.dataInstalacao,
        localizacaoEspecifica: novoUARData.localizacaoEspecifica?.trim(),
        planoManutencao: novoUARData.planoManutencao?.trim(),
        observacoes: novoUARData.observacoes?.trim(),
        equipamentoPaiId: equipamentoUC!.id,
        equipamentoPai: {
          id: equipamentoUC!.id,
          nome: equipamentoUC!.nome,
          classificacao: 'UC',
          criticidade: equipamentoUC!.criticidade,
          criadoEm: equipamentoUC!.criadoEm || new Date().toISOString()
        },
        // Herdar dados do UC pai (para referência)
        unidade: equipamentoUC!.unidade,
        proprietarioId: equipamentoUC!.proprietarioId,
        planta: equipamentoUC!.planta,
        proprietario: equipamentoUC!.proprietario,
        criadoEm: new Date().toISOString(),
        totalComponentes: 0
      };

      setUarsLista(prev => [...prev, novoUAR]);
    } else if (modoFormulario === 'editar' && uarEditando) {
      const uarAtualizado: Equipamento = {
        ...uarEditando,
        nome: novoUARData.nome.trim(),
        tipo: novoUARData.tipo,
        modelo: novoUARData.modelo?.trim(),
        fabricante: novoUARData.fabricante?.trim(),
        criticidade: novoUARData.criticidade,
        dataInstalacao: novoUARData.dataInstalacao,
        localizacaoEspecifica: novoUARData.localizacaoEspecifica?.trim(),
        planoManutencao: novoUARData.planoManutencao?.trim(),
        observacoes: novoUARData.observacoes?.trim(),
        atualizadoEm: new Date().toISOString()
      };

      setUarsLista(prev => prev.map(uar => 
        uar.id === uarEditando.id ? uarAtualizado : uar
      ));
    }

    // Voltar para a lista
    setModoFormulario('lista');
    resetFormulario();
    setUarEditando(null);
  };

  const handleCancelar = () => {
    setModoFormulario('lista');
    resetFormulario();
    setUarEditando(null);
  };

  const handleSalvarTodos = async () => {
    try {
      await onSave(uarsLista);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar componentes:', err);
    }
  };

  const getCriticidadeConfig = (criticidade: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      '5': { color: 'bg-red-100 text-red-800 border-red-200', label: 'Muito Alta' },
      '4': { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Alta' },
      '3': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Média' },
      '2': { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Baixa' },
      '1': { color: 'bg-green-100 text-green-800 border-green-200', label: 'Muito Baixa' }
    };
    return configs[criticidade] || configs['3'];
  };

  const renderFormularioUAR = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {modoFormulario === 'novo' ? 'Adicionar Novo Componente UAR' : 'Editar Componente UAR'}
        </h3>
        <Button variant="ghost" size="sm" onClick={handleCancelar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Nome <span className="text-red-500">*</span></label>
          <Input
            value={novoUARData.nome}
            onChange={(e) => handleFieldChange('nome', e.target.value)}
            placeholder="Nome do componente"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Tipo <span className="text-red-500">*</span></label>
          <Select value={novoUARData.tipo} onValueChange={(value) => handleFieldChange('tipo', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_COMPONENTES_UAR.map(tipo => (
                <SelectItem key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Modelo</label>
          <Input
            value={novoUARData.modelo}
            onChange={(e) => handleFieldChange('modelo', e.target.value)}
            placeholder="Modelo"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Fabricante</label>
          <Input
            value={novoUARData.fabricante}
            onChange={(e) => handleFieldChange('fabricante', e.target.value)}
            placeholder="Fabricante"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Data de Instalação</label>
          <Input
            type="date"
            value={novoUARData.dataInstalacao}
            onChange={(e) => handleFieldChange('dataInstalacao', e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Criticidade</label>
          <Select value={novoUARData.criticidade} onValueChange={(value) => handleFieldChange('criticidade', value as any)}>
            <SelectTrigger>
              <SelectValue />
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

        <div className="md:col-span-2">
          <label className="text-sm font-medium">Localização Específica</label>
          <Input
            value={novoUARData.localizacaoEspecifica}
            onChange={(e) => handleFieldChange('localizacaoEspecifica', e.target.value)}
            placeholder="Ex: Lado direito, Entrada principal, Mancal A..."
          />
        </div>

        <div>
          <label className="text-sm font-medium">Plano de Manutenção</label>
          <Input
            value={novoUARData.planoManutencao}
            onChange={(e) => handleFieldChange('planoManutencao', e.target.value)}
            placeholder="Ex: PM-001"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={handleCancelar}>
          Cancelar
        </Button>
        <Button onClick={handleSalvarUAR} className="bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4 mr-2" />
          {modoFormulario === 'novo' ? 'Adicionar' : 'Salvar'}
        </Button>
      </div>
    </div>
  );

  const renderListaUARs = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Componentes UAR ({uarsLista.length})
        </h3>
        <Button onClick={handleAdicionarUAR} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar UAR
        </Button>
      </div>

      {loadingData && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Carregando componentes...
        </div>
      )}

      {errorLocal && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errorLocal}
          </AlertDescription>
        </Alert>
      )}

      {!loadingData && !errorLocal && uarsLista.length === 0 && (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
          <Component className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h4 className="font-medium text-muted-foreground mb-2">Nenhum componente UAR</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Este equipamento ainda não possui componentes UAR cadastrados
          </p>
          <Button onClick={handleAdicionarUAR} variant="outline" className="border-blue-200 text-blue-600">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Primeiro UAR
          </Button>
        </div>
      )}

      {!loadingData && !errorLocal && uarsLista.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {uarsLista.map((uar) => {
            const criticidadeConfig = getCriticidadeConfig(uar.criticidade);
            
            return (
              <div key={uar.id} className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Component className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium">{uar.nome}</h4>
                      <Badge variant="outline" className={criticidadeConfig.color}>
                        {uar.criticidade} - {criticidadeConfig.label}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Settings className="h-3 w-3" />
                        <span>
                          <strong>Tipo:</strong> {TIPOS_COMPONENTES_UAR.find(t => t.value === uar.tipo)?.label || uar.tipo}
                        </span>
                      </div>
                      
                      {uar.fabricante && (
                        <div>
                          <strong>Fabricante:</strong> {uar.fabricante}
                          {uar.modelo && ` - ${uar.modelo}`}
                        </div>
                      )}
                      
                      {uar.dataInstalacao && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            <strong>Instalação:</strong> {new Date(uar.dataInstalacao).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                      
                      {uar.localizacaoEspecifica && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>
                            <strong>Local:</strong> {uar.localizacaoEspecifica}
                          </span>
                        </div>
                      )}
                      
                      {uar.planoManutencao && (
                        <div>
                          <strong>PM:</strong> {uar.planoManutencao}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVisualizarUAR(uar)}
                      className="h-8 w-8 p-0"
                      title="Visualizar detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditarUAR(uar)}
                      className="h-8 w-8 p-0"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoverUAR(uar.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!equipamentoUC) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="bg-blue-600 text-white px-6 py-4 -mx-6 -mt-6">
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Gerenciar Componentes UAR
              <Component className="h-5 w-5" />
            </DialogTitle>
            <DialogDescription className="text-orange-100 text-sm">
              Equipamento: <span className="font-medium">{equipamentoUC.nome}</span>
              {equipamentoUC.fabricante && ` • ${equipamentoUC.fabricante}`}
              {equipamentoUC.modelo && ` - ${equipamentoUC.modelo}`}
            </DialogDescription>
          </DialogHeader>

          {/* Alerta de erro global */}
          {error && (
            <Alert variant="destructive" className="mx-6 mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex-1 overflow-y-auto p-6">
            {modoFormulario === 'lista' ? renderListaUARs() : renderFormularioUAR()}
          </div>

          <div className="border-t px-6 py-4 flex justify-between items-center bg-muted/30">
            <div className="text-sm text-muted-foreground">
              Total de componentes: <span className="font-medium">{uarsLista.length}</span>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSalvarTodos} 
                className="bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Todos ({uarsLista.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalhado para visualização de UAR */}
      <ComponenteUARModal
        isOpen={modalUARDetalhes.isOpen}
        mode={modalUARDetalhes.mode}
        entity={modalUARDetalhes.entity}
        equipamentoPai={equipamentoUC}
        onClose={() => setModalUARDetalhes({ isOpen: false, mode: 'view', entity: null })}
        onSubmit={() => {}}
      />
    </>
  );
};