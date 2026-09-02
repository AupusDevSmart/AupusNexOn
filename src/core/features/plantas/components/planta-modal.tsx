// src/features/plantas/components/planta-modal.tsx
import React, { useRef, useState } from 'react';
import { BaseModal } from '@/core/components/common/base-modal/BaseModal';
import { Button } from '@/core/components/ui/button';
import {
  Factory,
  AlertCircle,
  CheckCircle,
  Trash2,
  MapPin,
  Clock,
  Building2
} from 'lucide-react';
import { ModalMode, PlantaFormData } from '../types';
import { plantasFormFields } from '../config/form-config';
import { useHttpClient } from '@/core/context/hooks';
import { CNPJUtils } from '@/core/components/ui/cnpj-input';
import { PlantaOperadoresTab, type PlantaOperadoresTabHandle } from './PlantaOperadoresTab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';

interface PlantaModalProps {
  isOpen: boolean;
  mode: ModalMode;
  planta: any | null;
  onClose: () => void;
  onSuccess: () => void;
  proprietarioIdDefault?: string;
}

// Helper: Transformar dados do formulário para API
const transformFormDataToAPI = (data: any) => {

  // Validar CNPJ
  const cnpjFormatted = CNPJUtils.mask(data.cnpj || '');
  const cnpjClean = CNPJUtils.unmask(data.cnpj || '');

  // Validar endereço
  const endereco = data.endereco || {};

  const transformedData: any = {
    nome: (data.nome || '').trim(),
    cnpj: cnpjFormatted, // Enviar formatado como a API espera
    proprietarioId: data.proprietarioId,
    horarioFuncionamento: (data.horarioFuncionamento || '').trim(),
    localizacao: (data.localizacao || '').trim(),
    endereco: {
      logradouro: (endereco.logradouro || '').trim(),
      bairro: (endereco.bairro || '').trim(),
      cidade: (endereco.cidade || '').trim(),
      uf: (endereco.uf || '').trim(),
      cep: (endereco.cep || '').trim(),
    }
  };

  // Adicionar numero_uc se houver valor
  if (data.numeroUc && data.numeroUc.trim() !== '') {
    transformedData.numero_uc = data.numeroUc.trim();
  }

  return transformedData;
};

export function PlantaModal({
  isOpen,
  mode,
  planta,
  onClose,
  onSuccess,
  proprietarioIdDefault
}: PlantaModalProps) {
  const httpClient = useHttpClient();
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';

  // Estado local para feedback
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref pra aba de operadores: as mudancas ficam em buffer local e so vao
  // pro backend depois do save da planta via tabRef.current.flush(plantaId).
  const operadoresTabRef = useRef<PlantaOperadoresTabHandle>(null);

  const handleSubmit = async (data: any) => {

    // Limpar erros anteriores
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    try {
      let resultado;

      // Transformar dados antes de enviar
      const transformedData = transformFormDataToAPI(data);

      if (isCreateMode) {
        const response = await httpClient.post('/plantas', transformedData);
        resultado = response.data;
        setSubmitSuccess(`Planta ${resultado.nome} criada com sucesso!`);
      } else if (isEditMode && planta) {
        const response = await httpClient.put(`/plantas/${planta.id}`, transformedData);
        resultado = response.data;
        setSubmitSuccess(`Planta ${resultado.nome} atualizada com sucesso!`);
      }

      // Aplicar mudancas pendentes de operadores (se houver) usando o id da planta
      // (recem-criada em create, existente em edit).
      const plantaIdParaFlush = (resultado?.id || planta?.id || '').toString().trim();
      if (plantaIdParaFlush && operadoresTabRef.current?.hasPendingChanges()) {
        try {
          await operadoresTabRef.current.flush(plantaIdParaFlush);
        } catch (opErr: any) {
          console.error('⚠️ Erro ao sincronizar operadores:', opErr);
          // Mostrar warning mas nao bloquear o save da planta
          setSubmitError(
            `Planta salva, mas houve erro ao atualizar operadores: ${opErr?.response?.data?.message || opErr?.message || 'erro desconhecido'}`,
          );
        }
      }

      // Aguardar um momento para mostrar a mensagem
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('❌ Erro no handleSubmit:', error);
      // Pegar a mensagem de erro da resposta da API se disponível
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro desconhecido ao salvar planta';
      setSubmitError(errorMessage);
      // Não re-lançar o erro - já tratamos mostrando a mensagem
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!planta) return;

    setIsDeleting(true);
    setSubmitError(null);

    try {
      await httpClient.delete(`/plantas/${planta.id}`);
      setSubmitSuccess(`Planta ${planta.nome} deletada com sucesso!`);
      setShowDeleteDialog(false);

      // Aguardar um momento para mostrar a mensagem antes de fechar
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('❌ Erro ao deletar planta:', error);
      // Pegar a mensagem de erro da resposta da API se disponível
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro ao deletar planta';
      setSubmitError(errorMessage);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getModalTitle = () => {
    const titles = {
      create: 'Nova Planta',
      edit: 'Editar Planta',
      view: 'Visualizar Planta'
    };
    return titles[mode as keyof typeof titles];
  };

  const getModalIcon = () => {
    return <Factory className="h-5 w-5 text-blue-600" />;
  };

  const formGroups = [
    {
      key: 'informacoes_basicas',
      title: 'Informações Básicas',
      fields: ['nome', 'numeroUc', 'cnpj', 'proprietarioId']
    },
    {
      key: 'operacional',
      title: 'Informações Operacionais',
      fields: ['horarioFuncionamento', 'localizacao']
    },
    {
      key: 'endereco',
      title: 'Endereço',
      fields: ['endereco']
    }
    // {
    //   key: 'gestao',
    //   title: 'Gestão',
    //   fields: ['gestaoEquipamentos']
    // }
  ];

  // Preparar entidade para o modal
  const entityForModal = isCreateMode
    ? {
        id: null,
        proprietarioId: proprietarioIdDefault || null
      }
    : planta;

  return (
    <BaseModal
      isOpen={isOpen}
      mode={mode}
      entity={entityForModal as any}
      title={getModalTitle()}
      icon={getModalIcon()}
      formFields={plantasFormFields}
      groups={formGroups}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="w-[95vw] sm:w-[600px] lg:w-[700px]"
      loading={isSubmitting}
      loadingText={isCreateMode ? "Cadastrando planta..." : "Salvando alterações..."}
      closeOnBackdropClick={!isSubmitting && !isDeleting}
      closeOnEscape={!isDeleting}
      submitButtonText={isCreateMode ? "Cadastrar Planta" : "Salvar Alterações"}
    >
      {/* FEEDBACK DE ERRO - Responsivo */}
      {submitError && (
        <div className="mb-3 md:mb-4 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
          <div className="flex items-start gap-2 md:gap-3">
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-red-900 dark:text-red-100 text-sm md:text-base">
                Erro ao salvar planta
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

      {/* OPERADORES - aba inline: edit/view usam planta.id, create usa null
          (buffer local + flush apos POST /plantas). */}
      {!isViewMode || planta?.id ? (
        <div className="mt-6 pt-4 border-t border-border">
          <PlantaOperadoresTab
            ref={operadoresTabRef}
            plantaId={planta?.id ?? null}
            readOnly={isViewMode}
          />
        </div>
      ) : null}

      {/* BOTÃO DE DELETAR - Apenas no modo de edição */}
      {isEditMode && planta && (
        <div className="mt-6 pt-4 border-t border-border">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Excluindo...' : 'Excluir Planta'}
          </Button>
        </div>
      )}

      {/* DIALOG DE CONFIRMAÇÃO DE DELETE */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a planta <strong>{planta?.nome}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita e irá remover permanentemente a planta, suas unidades e equipamentos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BaseModal>
  );
}