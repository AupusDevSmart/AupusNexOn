// src/features/unidades/components/unidade-modal.tsx
import { useState } from 'react';
import { BaseModal } from '@/components/common/base-modal/BaseModal';
import { Button } from '@/components/ui/button';
import {
  Factory,
  AlertCircle,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { ModalMode, UnidadeFormData, Unidade } from '../types';
import { unidadesFormFields } from '../config/form-config';
import { formDataToDto, unidadeToFormData } from '../types';
import {
  createUnidade,
  updateUnidade,
  deleteUnidade,
} from '@/services/unidades.services';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UnidadeModalProps {
  isOpen: boolean;
  mode: ModalMode;
  unidade: Unidade | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UnidadeModal({
  isOpen,
  mode,
  unidade,
  onClose,
  onSuccess
}: UnidadeModalProps) {
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';

  // Estado local para feedback
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: any) => {
    console.log('🚀 Iniciando handleSubmit do modal de unidade');
    console.log('📝 Dados da unidade para salvar:', data);
    console.log('🔧 Mode:', mode);
    console.log('🏭 Unidade atual:', unidade);

    // Limpar erros anteriores
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    try {
      let resultado;

      // Converter formData para DTO
      const dto = formDataToDto(data);

      if (isCreateMode) {
        console.log('✨ Criando nova unidade...');
        resultado = await createUnidade(dto);
        console.log('✅ Unidade criada com sucesso:', resultado);
        setSubmitSuccess(`Instalação ${resultado.nome} criada com sucesso!`);
      } else if (isEditMode && unidade) {
        console.log('📝 Atualizando unidade existente...');
        resultado = await updateUnidade(unidade.id, dto);
        console.log('✅ Unidade atualizada com sucesso:', resultado);
        setSubmitSuccess(`Instalação ${resultado.nome} atualizada com sucesso!`);
      }

      // Aguardar um momento para mostrar a mensagem
      setTimeout(() => {
        console.log('🎉 Chamando onSuccess');
        onSuccess();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('❌ Erro no handleSubmit:', error);
      // Pegar a mensagem de erro da resposta da API se disponível
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro desconhecido ao salvar instalação';
      setSubmitError(errorMessage);
      // Não re-lançar o erro - já tratamos mostrando a mensagem
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!unidade) return;

    setIsDeleting(true);
    setSubmitError(null);

    try {
      console.log('🗑️ Deletando unidade:', unidade.id);
      await deleteUnidade(unidade.id);
      setSubmitSuccess(`Instalação ${unidade.nome} deletada com sucesso!`);
      setShowDeleteDialog(false);

      // Aguardar um momento para mostrar a mensagem antes de fechar
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('❌ Erro ao deletar unidade:', error);
      // Pegar a mensagem de erro da resposta da API se disponível
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro ao deletar instalação';
      setSubmitError(errorMessage);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getModalTitle = () => {
    const titles = {
      create: 'Nova Instalação',
      edit: 'Editar Instalação',
      view: 'Visualizar Instalação'
    };
    return titles[mode as keyof typeof titles];
  };

  const getModalIcon = () => {
    return <Factory className="h-5 w-5 text-blue-600" />;
  };

  const formGroups = [
    {
      key: 'informacoes_basicas',
      title: 'Informações Gerais',
      fields: ['proprietarioId', 'plantaId', 'nome', 'numeroUc', 'tipo', 'tensaoNominal', 'status'],
      layout: 'grid'
    },
    {
      key: 'localizacao',
      title: 'Localização',
      fields: ['latitude', 'longitude'],
      layout: 'grid'
    },
    {
      key: 'energia',
      title: 'Configurações de Energia',
      fields: ['demandaCarga', 'demandaGeracao', 'concessionariaId'],
      layout: 'grid'
    },
    {
      key: 'perfil',
      title: 'Perfil',
      fields: ['perfil', 'grupo', 'subgrupo'],
      layout: 'grid'
    }
  ];

  // Preparar entidade para o modal
  const entityForModal = unidade;

  return (
    <BaseModal
      isOpen={isOpen}
      mode={mode}
      entity={entityForModal as any}
      title={getModalTitle()}
      icon={getModalIcon()}
      formFields={unidadesFormFields}
      groups={formGroups}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="w-[95vw] sm:w-[600px] lg:w-[700px]"
      loading={isSubmitting}
      loadingText={isCreateMode ? "Cadastrando instalação..." : "Salvando alterações..."}
      closeOnBackdropClick={!isSubmitting && !isDeleting}
      closeOnEscape={!isDeleting}
      submitButtonText={isCreateMode ? "Cadastrar Instalação" : "Salvar Alterações"}
    >
      {/* FEEDBACK DE ERRO - Responsivo */}
      {submitError && (
        <div className="mb-3 md:mb-4 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
          <div className="flex items-start gap-2 md:gap-3">
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-red-900 dark:text-red-100 text-sm md:text-base">
                Erro ao salvar instalação
              </h4>
              <p className="text-xs md:text-sm text-red-700 dark:text-red-300 mt-1 break-words">
                {submitError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK DE SUCESSO - Responsivo */}
      {submitSuccess && (
        <div className="mb-3 md:mb-4 p-3 md:p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
          <div className="flex items-start gap-2 md:gap-3">
            <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-green-900 dark:text-green-100 text-sm md:text-base">
                Sucesso!
              </h4>
              <p className="text-xs md:text-sm text-green-700 dark:text-green-300 mt-1 break-words">
                {submitSuccess}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BOTÃO DE DELETAR - Apenas no modo de edição */}
      {isEditMode && unidade && (
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deletando...' : 'Excluir Instalação'}
          </Button>
        </div>
      )}


      {/* DIALOG DE CONFIRMAÇÃO DE DELETE */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Você está prestes a excluir permanentemente a instalação
                  <span className="font-semibold"> {unidade?.nome}</span>. Esta ação não pode ser revertida.
                </p>

                {/* Aviso sobre equipamentos */}
                {unidade && unidade.totalEquipamentos > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-amber-900 dark:text-amber-100 font-medium text-sm">
                          Esta instalação possui {unidade.totalEquipamentos} equipamento{unidade.totalEquipamentos > 1 ? 's' : ''} vinculado{unidade.totalEquipamentos > 1 ? 's' : ''}
                        </p>
                        <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                          Todos os equipamentos serão excluídos em cascata junto com seus dados históricos, registros de manutenção e anomalias.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!unidade?.totalEquipamentos && (
                  <p className="text-sm text-muted-foreground">
                    Todos os dados relacionados a esta instalação serão permanentemente removidos do sistema.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BaseModal>
  );
}