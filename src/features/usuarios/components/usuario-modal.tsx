// src/features/usuarios/components/usuario-modal.tsx
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { BaseModal } from '@/components/common/base-modal/BaseModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Building2,
  BarChart3,
  Wrench,
  Shield,
  UserCheck,
  Leaf,
  Settings,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Usuario, ModalMode, UsuarioFormData } from '../types';
import { usuariosFormFields } from '../config/form-config';
import { useUsuarios } from '../hooks/useUsuarios';
import { PermissionManager } from './PermissionManager';
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

interface UsuarioModalProps {
  isOpen: boolean;
  mode: ModalMode;
  usuario: Usuario | null;
  onClose: () => void;
  onSuccess: () => void;
  onGerenciarPlantas?: (usuario: Usuario) => void;
}

export function UsuarioModal({ 
  isOpen, 
  mode, 
  usuario, 
  onClose, 
  onSuccess,
  onGerenciarPlantas
}: UsuarioModalProps) {
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';

  // Hook para operações CRUD
  const {
    createUsuario,
    updateUsuario,
    deleteUsuario,
    usuarioToFormData,
    usuarioToFormDataAsync,
    error,
    clearError
  } = useUsuarios();

  // Estado local
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ✅ Estado para armazenar dados do usuário com IDs do IBGE
  const [entityWithIds, setEntityWithIds] = useState<UsuarioFormData | Usuario | null>(null);
  const [loadingIds, setLoadingIds] = useState(false);

  const handleSubmit = async (data: any) => {
    // Limpar erros anteriores
    clearError();

    try {
      let resultado;

      if (isCreateMode) {
        resultado = await createUsuario(data as UsuarioFormData);

        // ✅ Toast de sucesso
        toast.success('Usuário criado com sucesso!', {
          description: `${resultado.nome} foi criado. Senha padrão: ${resultado.senhaTemporaria || 'Aupus123!'}`,
          duration: 5000,
        });
      } else if (isEditMode && usuario) {
        resultado = await updateUsuario(usuario.id, data as Partial<UsuarioFormData>);

        // ✅ Toast de sucesso
        toast.success('Usuário atualizado!', {
          description: `${resultado.nome} foi atualizado com sucesso.`,
          duration: 4000,
        });
      }

      // Fechar modal e recarregar dados
      onSuccess();

    } catch (error: any) {

      // Pegar a mensagem de erro da resposta da API se disponível
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro desconhecido ao salvar usuário';

      // ✅ Toast de erro
      toast.error('Erro ao salvar usuário', {
        description: errorMessage,
        duration: 6000,
      });
    }
  };

  const handleGerenciarPlantas = () => {
    if (usuario && onGerenciarPlantas) {
      onGerenciarPlantas(usuario);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!usuario) return;

    setIsDeleting(true);

    try {
      await deleteUsuario(usuario.id);

      // ✅ Toast de sucesso
      toast.success('Usuário deletado!', {
        description: `${usuario.nome} foi removido do sistema.`,
        duration: 4000,
      });

      setShowDeleteDialog(false);
      onSuccess();
      onClose();
    } catch (error: any) {
      // Pegar a mensagem de erro da resposta da API se disponível
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro ao deletar usuário';

      // ✅ Toast de erro
      toast.error('Erro ao deletar usuário', {
        description: errorMessage,
        duration: 6000,
      });

      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getModalTitle = () => {
    const titles = {
      create: 'Novo Usuário',
      edit: 'Editar Usuário', 
      view: 'Visualizar Usuário'
    };
    return titles[mode as keyof typeof titles];
  };

  const getModalIcon = () => {
    if (!usuario) return <Users className="h-5 w-5" />;
    
    const icons = {
      'Proprietário': <Building2 className="h-5 w-5 text-blue-600" />,
      'Administrador': <Shield className="h-5 w-5 text-purple-600" />,
      'Analista': <BarChart3 className="h-5 w-5 text-green-600" />,
      'Técnico': <Wrench className="h-5 w-5 text-orange-600" />,
      'Técnico externo': <UserCheck className="h-5 w-5 text-gray-600" />
    };
    
    return icons[usuario.perfil as keyof typeof icons] || <Users className="h-5 w-5" />;
  };

  const formGroups = [
    {
      key: 'informacoes_basicas',
      title: 'Informações Básicas',
      fields: ['nome', 'email', 'telefone', 'instagram', 'cpfCnpj']
    },
    {
      key: 'localizacao',
      title: 'Localização',
      fields: ['cep', 'estadoId', 'cidadeId', 'endereco']
    },
    {
      key: 'configuracoes',
      title: 'Configurações do Sistema',
      fields: ['roleNames', 'status']
    },
    {
      key: 'permissoes',
      title: 'Permissões',
      fields: ['permissions']
    }
  ];

  // ✅ BUSCAR IDs DO IBGE QUANDO CARREGAR USUÁRIO PARA EDIÇÃO/VISUALIZAÇÃO
  useEffect(() => {
    const loadUserDataWithIds = async () => {
      if (usuario && (isViewMode || isEditMode)) {
        setLoadingIds(true);
        try {
          // Usar versão assíncrona para buscar IDs do IBGE se necessário
          const formData = await usuarioToFormDataAsync(usuario);
          setEntityWithIds(formData);
        } catch (error) {
          // Fallback para versão síncrona
          setEntityWithIds(usuarioToFormData(usuario));
        } finally {
          setLoadingIds(false);
        }
      } else {
        setEntityWithIds(usuario);
      }
    };

    loadUserDataWithIds();
  }, [usuario, isViewMode, isEditMode, usuarioToFormDataAsync, usuarioToFormData]);

  return (
    <BaseModal
      isOpen={isOpen}
      mode={mode}
      entity={entityWithIds as any}
      title={getModalTitle()}
      icon={getModalIcon()}
      formFields={usuariosFormFields}
      groups={formGroups}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="w-[95vw] sm:w-[600px] lg:w-[700px] xl:w-[800px]"
    >
      {/* BOTÃO DE DELETAR - Apenas no modo de edição */}
      {isEditMode && usuario && (
        <div className="mb-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              <h4 className="font-medium text-red-900 dark:text-red-100 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Zona de Perigo
              </h4>
              <p className="text-xs md:text-sm text-red-700 dark:text-red-300 mt-1">
                Deletar permanentemente este usuário do sistema
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
              {isDeleting ? 'Deletando...' : 'Deletar Usuário'}
            </Button>
          </div>
        </div>
      )}

      {/* Informações sobre senha padrão - Responsivo */}
      {isCreateMode && (
        <div className="mt-4 md:mt-6 space-y-3 md:space-y-4">
          <h3 className="text-sm md:text-base font-semibold flex items-center gap-2 border-b pb-2">
            <Shield className="h-3 w-3 md:h-4 md:w-4" />
            Informações de Acesso
          </h3>

          <div className="p-3 md:p-4">
            <div className="text-xs md:text-sm text-muted-foreground space-y-1">
              <p>
                O usuário será criado com a senha padrão: <code className="font-mono">Aupus123!</code>
              </p>
              <p>
                No primeiro acesso, o usuário será obrigatoriamente solicitado a alterar sua senha.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO DE PERMISSÕES - Responsivo */}
      {(isViewMode || isEditMode) && usuario && (
        <div className="mt-4 md:mt-6 space-y-3 md:space-y-4">
          <h3 className="text-sm md:text-base font-semibold flex items-center gap-2 border-b pb-2">
            <Shield className="h-3 w-3 md:h-4 md:w-4" />
            Permissões e Acesso
          </h3>

          <PermissionManager
            usuario={usuario}
            readonly={isViewMode}
            compact={false}
          />
        </div>
      )}

      {/* Seção de plantas - Responsivo */}
      {(isViewMode || isEditMode) &&
       usuario &&
       (usuario.tipo === 'Proprietário' || usuario.perfil === 'Proprietário') && (
        <div className="mt-4 md:mt-6 space-y-3 md:space-y-4">
          <h3 className="text-sm md:text-base font-semibold flex items-center gap-2 border-b pb-2">
            <Leaf className="h-3 w-3 md:h-4 md:w-4" />
            Plantas
          </h3>

          <div className="bg-muted/30 rounded-lg p-3 md:p-4 border border-dashed border-muted-foreground/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-base md:text-lg px-2 py-1 font-bold">
                  {usuario.plantas || 0}
                </Badge>
                <span className="text-xs md:text-sm text-muted-foreground">
                  {(usuario.plantas || 0) === 1 ? 'planta' : 'plantas'}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGerenciarPlantas}
              className="w-full flex items-center justify-center gap-2 text-xs md:text-sm"
              disabled={!onGerenciarPlantas}
            >
              <Settings className="h-3 w-3 md:h-4 md:w-4" />
              <span className="truncate">Gerenciar Plantas de {usuario.nome}</span>
            </Button>
          </div>
        </div>
      )}

      {/* DIALOG DE CONFIRMAÇÃO DE DELETE */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Esta ação não pode ser desfeita. Isso irá permanentemente deletar o usuário
                <span className="font-semibold"> {usuario?.nome}</span> e remover todos os seus dados do sistema.
              </span>
              <span className="block text-red-600 dark:text-red-400 font-medium">
                ⚠️ Atenção: Todas as permissões, acessos e vínculos com plantas serão removidos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Deletando...' : 'Sim, deletar usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BaseModal>
  );
}