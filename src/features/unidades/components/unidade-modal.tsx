// src/features/unidades/components/unidade-modal.tsx
import { useState } from 'react';
import { BaseModal } from '@/components/common/base-modal/BaseModal';
import { Button } from '@/components/ui/button';
import {
  Factory,
  AlertCircle,
  CheckCircle,
  Trash2,
  MapPin,
  Home,
  Zap,
  Activity,
  Power
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
        setSubmitSuccess(`Unidade ${resultado.nome} criada com sucesso!`);
      } else if (isEditMode && unidade) {
        console.log('📝 Atualizando unidade existente...');
        resultado = await updateUnidade(unidade.id, dto);
        console.log('✅ Unidade atualizada com sucesso:', resultado);
        setSubmitSuccess(`Unidade ${resultado.nome} atualizada com sucesso!`);
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
                          'Erro desconhecido ao salvar unidade';
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
      setSubmitSuccess(`Unidade ${unidade.nome} deletada com sucesso!`);
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
                          'Erro ao deletar unidade';
      setSubmitError(errorMessage);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getModalTitle = () => {
    const titles = {
      create: 'Nova Unidade',
      edit: 'Editar Unidade',
      view: 'Visualizar Unidade'
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
      fields: ['nome', 'tipo', 'plantaId', 'status', 'potencia']
    },
    {
      key: 'endereco',
      title: 'Endereço',
      fields: ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado']
    },
    {
      key: 'localizacao',
      title: 'Localização',
      fields: ['latitude', 'longitude']
    },
    {
      key: 'medicao',
      title: 'Medição',
      fields: ['pontosMedicao']
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
      loadingText={isCreateMode ? "Cadastrando unidade..." : "Salvando alterações..."}
      closeOnBackdropClick={!isSubmitting && !isDeleting}
      closeOnEscape={!isDeleting}
      submitButtonText={isCreateMode ? "Cadastrar Unidade" : "Salvar Alterações"}
    >
      {/* FEEDBACK DE ERRO - Responsivo */}
      {submitError && (
        <div className="mb-3 md:mb-4 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
          <div className="flex items-start gap-2 md:gap-3">
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-red-900 dark:text-red-100 text-sm md:text-base">
                Erro ao salvar unidade
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
        <div className="mb-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              <h4 className="font-medium text-red-900 dark:text-red-100 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Zona de Perigo
              </h4>
              <p className="text-xs md:text-sm text-red-700 dark:text-red-300 mt-1">
                Deletar permanentemente esta unidade do sistema
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deletando...' : 'Deletar Unidade'}
            </Button>
          </div>
        </div>
      )}

      {/* Informações adicionais da unidade - Responsivo */}
      {(isViewMode || isEditMode) && unidade && (
        <div className="mt-4 md:mt-6 space-y-3 md:space-y-4">
          <h3 className="text-sm md:text-base font-semibold flex items-center gap-2 border-b pb-2">
            <Factory className="h-3 w-3 md:h-4 md:w-4" />
            Informações Adicionais
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {/* Status da Unidade */}
            <div className="bg-muted/30 rounded-lg p-3 border border-muted-foreground/20">
              <div className="flex items-start gap-2">
                <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Status</h4>
                  <div className="mt-1">
                    {unidade.status === 'ATIVO' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        ✅ Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        ❌ Inativo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tipo da Unidade */}
            <div className="bg-muted/30 rounded-lg p-3 border border-muted-foreground/20">
              <div className="flex items-start gap-2">
                <Home className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Tipo</h4>
                  <p className="text-sm mt-1 break-words">{unidade.tipo || 'Não informado'}</p>
                </div>
              </div>
            </div>

            {/* Potência */}
            <div className="bg-muted/30 rounded-lg p-3 border border-muted-foreground/20">
              <div className="flex items-start gap-2">
                <Power className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Potência</h4>
                  <p className="text-sm mt-1 break-words font-semibold">
                    {unidade.potencia ? `${unidade.potencia} kW` : 'Não informada'}
                  </p>
                </div>
              </div>
            </div>

            {/* Pontos de Medição */}
            <div className="bg-muted/30 rounded-lg p-3 border border-muted-foreground/20">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Pontos de Medição</h4>
                  <p className="text-sm mt-1 break-words">{unidade.pontosMedicao || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Localização Completa */}
          {(unidade.latitude && unidade.longitude) && (
            <div className="bg-muted/30 rounded-lg p-3 border border-muted-foreground/20">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Coordenadas</h4>
                  <p className="text-sm mt-1 break-words">
                    Latitude: {unidade.latitude}, Longitude: {unidade.longitude}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Endereço Completo */}
          {unidade.logradouro && (
            <div className="bg-muted/30 rounded-lg p-3 border border-muted-foreground/20">
              <div className="flex items-start gap-2">
                <Home className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Endereço Completo</h4>
                  <p className="text-sm mt-1 break-words">
                    {unidade.logradouro}
                    {unidade.numero && `, ${unidade.numero}`}
                    {unidade.complemento && ` - ${unidade.complemento}`}
                    {unidade.bairro && ` - ${unidade.bairro}`}
                    {unidade.cidade && ` - ${unidade.cidade}`}
                    {unidade.estado && `/${unidade.estado}`}
                    {unidade.cep && ` - CEP: ${unidade.cep}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DIALOG DE CONFIRMAÇÃO DE DELETE */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita. Isso irá permanentemente deletar a unidade
                  <span className="font-semibold"> {unidade?.nome}</span> e remover todos os seus dados do sistema.
                </p>

                {/* Aviso sobre equipamentos */}
                {unidade && unidade.totalEquipamentos > 0 && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 dark:text-red-400 text-lg">⚠️</span>
                      <div>
                        <p className="text-red-800 dark:text-red-200 font-semibold">
                          Atenção: Esta unidade possui {unidade.totalEquipamentos} equipamento{unidade.totalEquipamentos > 1 ? 's' : ''} vinculado{unidade.totalEquipamentos > 1 ? 's' : ''}.
                        </p>
                        <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                          Todos os equipamentos serão permanentemente deletados junto com a unidade. Esta ação não pode ser revertida.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-amber-600 dark:text-amber-400">
                  <p className="font-medium mb-1">⚠️ Consequências adicionais:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    <li>Todos os dados históricos dos equipamentos serão perdidos</li>
                    <li>Registros de manutenção e anomalias serão removidos</li>
                    <li>Diagramas vinculados serão afetados</li>
                  </ul>
                </div>
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
              {isDeleting ? 'Deletando...' : 'Sim, deletar unidade e equipamentos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BaseModal>
  );
}