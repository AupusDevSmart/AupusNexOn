// src/features/equipamentos/components/modals/GerenciarUARsModal.tsx - REFATORADO PARA USAR COMPONENTEUARMODAL
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Component,
  Save,
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Equipamento } from '../../types';
import { ComponenteUARModal } from './ComponenteUARModal';
import { useEquipamentos } from '../../hooks/useEquipamentos';

interface GerenciarUARsModalProps {
  isOpen: boolean;
  equipamentoUC: Equipamento | null;
  onClose: () => void;
  onSave: (uars: Equipamento[]) => Promise<void>;
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
  const [loadingData, setLoadingData] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // DEBUG: Monitorar mudanças no uarsLista
  useEffect(() => {
    console.log('🔄 [GERENCIAR] uarsLista mudou. Novo tamanho:', uarsLista.length, '- Lista:', uarsLista);
  }, [uarsLista]);

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

    // Reset error
    setErrorLocal(null);
  }, [equipamentoUC, isOpen]);

  const loadComponentes = async () => {
    if (!equipamentoUC) return;

    try {
      setLoadingData(true);
      setErrorLocal(null);

      const ucId = equipamentoUC.id; // USA ID STRING DIRETAMENTE
      console.log('📂 [GERENCIAR] Carregando componentes para UC:', ucId);
      const result = await fetchComponentesParaGerenciar(ucId);

      console.log('📂 [GERENCIAR] Resultado do fetch:', result);
      console.log('📂 [GERENCIAR] result.componentes:', result.componentes);
      console.log('📂 [GERENCIAR] SETANDO uarsLista com:', result.componentes.length, 'componentes');

      setUarsLista(result.componentes);

      console.log('✅ [GERENCIAR] uarsLista atualizada');

    } catch (err) {
      setErrorLocal('Erro ao carregar componentes');
      console.error('❌ [GERENCIAR] Erro ao carregar componentes:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleAdicionarUAR = () => {
    setModalUARDetalhes({
      isOpen: true,
      mode: 'create',
      entity: null
    });
  };

  const handleEditarUAR = (uar: Equipamento) => {
    setModalUARDetalhes({
      isOpen: true,
      mode: 'edit',
      entity: uar
    });
  };

  const handleVisualizarUAR = (uar: Equipamento) => {
    setModalUARDetalhes({
      isOpen: true,
      mode: 'view',
      entity: uar
    });
  };

  const handleSubmitUARModal = async (data: any) => {
    console.log('📝 [GERENCIAR UAR] Recebendo dados do modal:', data);

    if (modalUARDetalhes.mode === 'create') {
      // Adicionar novo UAR à lista local
      const novoUAR: Equipamento = {
        id: `temp_${Date.now()}`, // ID temporário
        nome: data.nome,
        classificacao: 'UAR',
        tipo: data.tipo_equipamento || data.tipoEquipamento,
        tipoEquipamento: data.tipo_equipamento || data.tipoEquipamento,
        modelo: data.modelo,
        fabricante: data.fabricante,
        numeroSerie: data.numero_serie,
        criticidade: data.criticidade,
        dataInstalacao: data.data_instalacao,
        localizacaoEspecifica: data.localizacao_especifica,
        fornecedor: data.fornecedor,
        valorImobilizado: data.valor_imobilizado,
        valorDepreciacao: data.valor_depreciacao,
        valorContabil: data.valor_contabil,
        observacoes: data.observacoes,
        dadosTecnicos: data.dados_tecnicos,
        equipamentoPaiId: equipamentoUC!.id,
        equipamentoPai: {
          id: equipamentoUC!.id,
          nome: equipamentoUC!.nome,
          classificacao: 'UC',
          criticidade: equipamentoUC!.criticidade,
          criadoEm: equipamentoUC!.criadoEm || new Date().toISOString()
        },
        unidade: equipamentoUC!.unidade,
        proprietarioId: equipamentoUC!.proprietarioId,
        planta: equipamentoUC!.planta,
        proprietario: equipamentoUC!.proprietario,
        criadoEm: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalComponentes: 0
      };

      setUarsLista(prev => [...prev, novoUAR]);
      console.log('✅ [GERENCIAR UAR] Novo UAR adicionado à lista');
    } else if (modalUARDetalhes.mode === 'edit') {
      // Atualizar UAR existente na lista local
      setUarsLista(prev => prev.map(uar =>
        uar.id === modalUARDetalhes.entity?.id
          ? {
              ...uar,
              nome: data.nome,
              tipo: data.tipo_equipamento || data.tipoEquipamento,
              tipoEquipamento: data.tipo_equipamento || data.tipoEquipamento,
              modelo: data.modelo,
              fabricante: data.fabricante,
              numeroSerie: data.numero_serie,
              criticidade: data.criticidade,
              dataInstalacao: data.data_instalacao,
              localizacaoEspecifica: data.localizacao_especifica,
              fornecedor: data.fornecedor,
              valorImobilizado: data.valor_imobilizado,
              valorDepreciacao: data.valor_depreciacao,
              valorContabil: data.valor_contabil,
              observacoes: data.observacoes,
              dadosTecnicos: data.dados_tecnicos,
              updatedAt: new Date().toISOString()
            }
          : uar
      ));
      console.log('✅ [GERENCIAR UAR] UAR atualizado na lista');
    }

    // Fechar modal
    setModalUARDetalhes({ isOpen: false, mode: 'view', entity: null });
  };

  const handleRemoverUAR = (uarId: string) => {
    if (confirm('Tem certeza que deseja remover este componente UAR?')) {
      setUarsLista(prev => prev.filter(uar => uar.id !== uarId));
    }
  };

  const handleSalvarTodos = async () => {
    try {
      console.log('💾 [GERENCIAR] Salvando lista completa de UARs:', uarsLista);
      console.log('💾 [GERENCIAR] Total de UARs na lista:', uarsLista.length);
      console.log('💾 [GERENCIAR] IDs dos UARs:', uarsLista.map(u => ({ id: u.id, nome: u.nome })));

      await onSave(uarsLista);
      onClose();
    } catch (err) {
      console.error('❌ [GERENCIAR] Erro ao salvar componentes:', err);
    }
  };

  const getCriticidadeConfig = (criticidade: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      '5': { color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600', label: 'Muito Alta' },
      '4': { color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600', label: 'Alta' },
      '3': { color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600', label: 'Média' },
      '2': { color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600', label: 'Baixa' },
      '1': { color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600', label: 'Muito Baixa' }
    };
    return configs[criticidade] || configs['3'];
  };

  const renderListaUARs = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          Componentes UAR ({uarsLista.length})
        </h3>
        <button
          onClick={handleAdicionarUAR}
          className="btn-minimal-outline h-9 gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar UAR
        </button>
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
        <div className="text-center py-16 rounded-lg border border-dashed border-muted-foreground/20">
          <Component className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40 stroke-1" />
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Nenhum componente UAR</h4>
          <p className="text-xs text-muted-foreground/70 mb-6">
            Este equipamento ainda não possui componentes UAR cadastrados
          </p>
          <button onClick={handleAdicionarUAR} className="btn-minimal-outline h-9">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Primeiro UAR
          </button>
        </div>
      )}

      {!loadingData && !errorLocal && uarsLista.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {uarsLista.map((uar) => {
            const criticidadeConfig = getCriticidadeConfig(uar.criticidade);

            return (
              <div key={uar.id} className="group border border-border/40 rounded-lg p-4 bg-card hover:border-border transition-all hover:shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-medium text-sm text-foreground truncate">{uar.nome}</h4>
                      <Badge variant="outline" className={`${criticidadeConfig.color} text-xs shrink-0`}>
                        Crit. {uar.criticidade}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs text-muted-foreground">
                      {(uar.tipo || uar.tipoEquipamento) && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground/60">Tipo:</span>
                          <span className="font-medium">{uar.tipo || uar.tipoEquipamento}</span>
                        </div>
                      )}

                      {uar.fabricante && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground/60">Fabricante:</span>
                          <span className="font-medium">{uar.fabricante}{uar.modelo && ` - ${uar.modelo}`}</span>
                        </div>
                      )}

                      {uar.dataInstalacao && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground/60">Instalação:</span>
                          <span className="font-medium">{new Date(uar.dataInstalacao).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}

                      {uar.localizacaoEspecifica && (
                        <div className="flex items-center gap-1.5 col-span-full">
                          <span className="text-muted-foreground/60">Local:</span>
                          <span className="font-medium">{uar.localizacaoEspecifica}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleVisualizarUAR(uar)}
                      className="btn-minimal-ghost h-8 w-8 p-0"
                      title="Visualizar detalhes"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleEditarUAR(uar)}
                      className="btn-minimal-ghost h-8 w-8 p-0"
                      title="Editar"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoverUAR(uar.id)}
                      className="btn-minimal-ghost h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-4xl overflow-hidden flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4 space-y-2">
            <SheetTitle className="text-base font-semibold flex items-center gap-2">
              <Component className="h-4 w-4 text-muted-foreground" />
              Gerenciar Componentes UAR
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{equipamentoUC.nome}</span>
              {equipamentoUC.fabricante && <span className="text-muted-foreground/70"> • {equipamentoUC.fabricante}</span>}
              {equipamentoUC.modelo && <span className="text-muted-foreground/70"> • {equipamentoUC.modelo}</span>}
            </SheetDescription>
          </SheetHeader>

          {/* Alerta de erro global */}
          {error && (
            <Alert variant="destructive" className="mx-6 mt-4 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {renderListaUARs()}
          </div>

          <div className="border-t px-6 py-3 flex justify-between items-center bg-muted/20">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{uarsLista.length}</span> {uarsLista.length === 1 ? 'componente' : 'componentes'}
            </div>

            <div className="flex gap-2">
              <button className="btn-minimal-outline h-9" onClick={onClose}>
                Cancelar
              </button>
              <button
                onClick={handleSalvarTodos}
                className="btn-minimal-primary h-9"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Alterações
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal detalhado para criar/editar/visualizar UAR */}
      <ComponenteUARModal
        isOpen={modalUARDetalhes.isOpen}
        mode={modalUARDetalhes.mode}
        entity={modalUARDetalhes.entity}
        equipamentoPai={equipamentoUC}
        onClose={() => setModalUARDetalhes({ isOpen: false, mode: 'view', entity: null })}
        onSubmit={handleSubmitUARModal}
      />
    </>
  );
};
