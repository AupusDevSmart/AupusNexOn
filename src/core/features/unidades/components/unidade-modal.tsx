// src/features/unidades/components/unidade-modal.tsx
import { useCallback, useRef, useState } from 'react';
import { BaseModal } from '@/core/components/common/base-modal/BaseModal';
import { Button } from '@/core/components/ui/button';
import {
  Factory,
  AlertCircle,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { ModalMode } from '@/core/types/base';
import { UnidadeFormData, Unidade } from '../types';
import { unidadesFormFields } from '../config/form-config';
import { AnexosUnidadeField } from './AnexosUnidadeField';
import { toast } from '@/core/hooks/use-toast';
import { formDataToDto, unidadeToFormData } from '../types';
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

interface UnidadeModalProps {
  isOpen: boolean;
  mode: ModalMode;
  unidade: Unidade | null;
  onClose: () => void;
  onSuccess: () => void;
  createUnidade: (data: any) => Promise<any>;
  updateUnidade: (params: { id: string; data: any }) => Promise<any>;
  deleteUnidade: (id: string) => Promise<void>;
  /**
   * Mostra subgrupo tarifario, demandas e os checkboxes de perfil. Sao detalhe
   * de faturamento: interessam ao supervisorio, nao a quem cadastra instalacao
   * para manutencao. Todos opcionais no backend.
   */
  mostrarTarifacao?: boolean;
}

export function UnidadeModal({
  isOpen,
  mode,
  unidade,
  onClose,
  onSuccess,
  createUnidade,
  updateUnidade,
  deleteUnidade,
  mostrarTarifacao = false,
}: UnidadeModalProps) {
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';

  // Estado local para feedback
  // Sucesso e erro vao por toast, e nao em bloco dentro do sheet: o bloco
  // empurrava o formulario para baixo, ficava na tela ate alguem fechar o
  // modal, e no caso do sucesso competia com o proprio fechamento.
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * O que o campo de anexos pediu para acontecer assim que a instalacao nascer.
   *
   * Ref e nao estado: e lido uma vez no submit e nao deve provocar render. Sem
   * isso, quem cadastra com o contrato em maos teria que salvar, reabrir o
   * sheet e so entao anexar.
   */
  const acoesPosCriacaoRef = useRef<Map<string, (unidadeId: string) => Promise<void>>>(
    new Map(),
  );

  const registrarAcaoPosCriacao = useCallback(
    (chave: string, acao: (unidadeId: string) => Promise<void>) => {
      acoesPosCriacaoRef.current.set(chave, acao);
    },
    [],
  );

  const handleSubmit = async (data: any) => {

    setIsSubmitting(true);

    try {
      let resultado;

      // Converter formData para DTO
      const dto = formDataToDto(data);

      if (isCreateMode) {
        resultado = await createUnidade(dto);

        // Com o id em maos, sobem os arquivos escolhidos antes de a instalacao
        // existir. Falha aqui nao invalida a instalacao, que ja foi criada —
        // por isso o erro e avisado sem desfazer nada.
        const novoId = resultado?.id?.trim?.() || resultado?.id;
        if (novoId) {
          const pendencias: string[] = [];

          for (const [chave, acao] of acoesPosCriacaoRef.current) {
            try {
              await acao(novoId);
            } catch (erro: any) {
              // Guarda o motivo, e nao so o nome da acao: "os anexos" sozinho
              // nao diz se foi tamanho, tipo, rede ou permissao.
              const motivo =
                erro?.response?.data?.error?.message ||
                erro?.response?.data?.message ||
                erro?.message ||
                'erro desconhecido';
              pendencias.push(`${chave}: ${motivo}`);
            }
          }

          if (pendencias.length > 0) {
            // A instalacao existe: nao adianta segurar o sheet aberto. O aviso
            // diz o que faltou e o motivo, que e o que permite agir.
            toast({
              title: 'Instalação criada, mas os anexos não subiram',
              description: pendencias.join(' | '),
              variant: 'destructive',
              duration: 8000,
            });
          }
        }

        toast({ title: `Instalação ${resultado.nome} criada!` });
      } else if (isEditMode && unidade) {
        resultado = await updateUnidade({ id: unidade.id, data: dto });
        toast({ title: `Instalação ${resultado.nome} atualizada!` });
      }

      // Fecha na hora: o toast vive fora do sheet e continua visivel depois.
      // Os 2s de espera existiam so para dar tempo de ler a mensagem interna.
      onSuccess();
      onClose();

    } catch (error: any) {
      console.error('❌ Erro no handleSubmit:', error);
      // Pegar a mensagem de erro da resposta da API se disponível
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro desconhecido ao salvar instalação';
      toast({
        title: 'Erro ao salvar instalação',
        description: errorMessage,
        variant: 'destructive',
        duration: 8000,
      });
      // Não re-lançar o erro - já tratamos mostrando a mensagem
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!unidade) return;

    setIsDeleting(true);

    try {
      await deleteUnidade(unidade.id);
      toast({ title: `Instalação ${unidade.nome} removida!` });
      setShowDeleteDialog(false);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('❌ Erro ao deletar unidade:', error);
      // Pegar a mensagem de erro da resposta da API se disponível
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro ao deletar instalação';
      toast({
        title: 'Erro ao remover instalação',
        description: errorMessage,
        variant: 'destructive',
        duration: 8000,
      });
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

  /**
   * Subgrupo, demandas e os checkboxes de perfil so aparecem com
   * `mostrarTarifacao` — sao detalhe de faturamento, que interessa ao
   * supervisorio e nao a quem cadastra instalacao para manutencao. Todos sao
   * opcionais no backend, entao esconder nao impede o cadastro.
   */
  const formGroups = [
    {
      key: 'informacoes_basicas',
      title: 'Informações Gerais',
      // Tres colunas: sao campos curtos que se leem juntos — de quem e, onde
      // fica, como se chama; depois o que e, em que tensao e em que grupo;
      // por fim o numero da UC ao lado do status.
      columns: 3 as const,
      fields: [
        'proprietarioId',
        'plantaId',
        'nome',
        'tipo',
        'tensaoNominal',
        'grupo',
        'numeroUc',
        'status',
      ],
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
      fields: mostrarTarifacao
        ? ['demandaCarga', 'demandaGeracao', 'concessionariaId']
        : ['concessionariaId'],
      layout: 'grid'
    },
    ...(mostrarTarifacao
      ? [
          {
            key: 'perfil',
            title: 'Perfil',
            fields: ['perfil', 'subgrupo'],
            layout: 'grid'
          },
        ]
      : []),
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
      {/* Anexos: contrato de fornecimento, diagrama, laudo, ART.
          Fica fora do BaseForm de proposito — nao e um campo do formulario, e
          sim uma lista com vida propria, que fala direto com a API. */}
      <div className="mb-4 pt-4 border-t">
        <AnexosUnidadeField
          unidadeId={unidade?.id?.trim() || null}
          somenteLeitura={isViewMode}
          registrarAcaoPosCriacao={isCreateMode ? registrarAcaoPosCriacao : undefined}
        />
      </div>

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