// src/features/usuarios/components/usuario-modal.tsx
import { useState } from 'react';
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
  CheckCircle
} from 'lucide-react';
import { Usuario, ModalMode, UsuarioFormData } from '../types';
import { usuariosFormFields } from '../config/form-config';
import { useUsuarios } from '../hooks/useUsuarios';
import { PermissionManager } from './PermissionManager';
import { PermissionSummaryCard } from './PermissionSummaryCard';

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
    usuarioToFormData,
    error,
    clearError
  } = useUsuarios();

  // Estado local para feedback
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const handleSubmit = async (data: any) => {
    console.log('🚀 Iniciando handleSubmit do modal');
    console.log('📝 Dados do usuário para salvar:', data);
    console.log('🔧 Mode:', mode);
    console.log('👤 Usuário atual:', usuario);
    
    // Limpar erros anteriores
    setSubmitError(null);
    setSubmitSuccess(null);
    clearError();
    
    try {
      let resultado;
      
      if (isCreateMode) {
        console.log('✨ Criando novo usuário...');
        resultado = await createUsuario(data as UsuarioFormData);
        console.log('✅ Usuário criado com sucesso:', resultado);
        setSubmitSuccess(`Usuário ${resultado.nome} criado com sucesso! Senha padrão: ${resultado.senhaTemporaria || 'Aupus123!'}`);
      } else if (isEditMode && usuario) {
        console.log('📝 Atualizando usuário existente...');
        resultado = await updateUsuario(usuario.id, data as Partial<UsuarioFormData>);
        console.log('✅ Usuário atualizado com sucesso:', resultado);
        setSubmitSuccess(`Usuário ${resultado.nome} atualizado com sucesso!`);
      }
      
      // Aguardar um momento para mostrar a mensagem
      setTimeout(() => {
        console.log('🎉 Chamando onSuccess');
        onSuccess();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erro no handleSubmit:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao salvar usuário';
      setSubmitError(errorMessage);
      throw error; // Re-throw para o BaseModal tratar
    }
  };

  const handleGerenciarPlantas = () => {
    if (usuario && onGerenciarPlantas) {
      console.log('Abrindo gerenciamento de plantas para:', usuario.nome);
      onGerenciarPlantas(usuario);
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
      fields: ['cep', 'estadoId', 'cidadeId', 'endereco', 'bairro', 'complemento']
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
    },
    {
      key: 'organizacional',
      title: 'Informações Organizacionais',
      fields: ['managerId', 'concessionariaAtualId', 'organizacaoAtualId']
    }
  ];

  // ✅ MAPEAR DADOS DO USUÁRIO PARA FORM DATA QUANDO NECESSÁRIO
  const entityForModal = usuario && (isViewMode || isEditMode) 
    ? usuarioToFormData(usuario)
    : usuario;

  // console.log('👤 Usuário original:', usuario);
  // console.log('📝 Dados mapeados para o modal:', entityForModal);

  return (
    <BaseModal
      isOpen={isOpen}
      mode={mode}
      entity={entityForModal as any} // ✅ CORREÇÃO: Cast necessário para compatibilidade
      title={getModalTitle()}
      icon={getModalIcon()}
      formFields={usuariosFormFields}
      groups={formGroups}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {/* ✅ FEEDBACK DE ERRO */}
      {(submitError || error) && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900 dark:text-red-100">
                Erro ao salvar usuário
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {submitError || error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ FEEDBACK DE SUCESSO */}
      {submitSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-900 dark:text-green-100">
                Sucesso!
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {submitSuccess}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NOVO: Informações sobre senha padrão para novos usuários */}
      {isCreateMode && (
        <div className="mt-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2 border-b pb-2">
            <Shield className="h-4 w-4" />
            Informações de Acesso
          </h3>
          
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  Senha Padrão
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  O usuário será criado com a senha padrão: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded font-mono">Aupus123!</code>
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  No primeiro acesso, o usuário será obrigatoriamente solicitado a alterar sua senha.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ SEÇÃO DE PERMISSÕES - HABILITADA COM DADOS ATUAIS DO USUÁRIO */}
      {(isViewMode || isEditMode) && usuario && (
        <div className="mt-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2 border-b pb-2">
            <Shield className="h-4 w-4" />
            Permissões e Acesso
          </h3>
          
          {/* ✅ EXIBIÇÃO SIMPLES DE PERMISSÕES BASEADA NOS DADOS ATUAIS */}
          <div className="space-y-4">
            {/* Role atual */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Role Atual</h4>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <p><strong>Principal:</strong> {usuario.role_details?.name || usuario.roles?.[0] || usuario.tipo || 'Não definido'}</p>
                  <p><strong>Exibição:</strong> {usuario.tipo || usuario.perfil || 'Não mapeado'}</p>
                  {usuario.roles && usuario.roles.length > 1 && (
                    <p><strong>Outros:</strong> {usuario.roles.slice(1).join(', ')}</p>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {usuario.roles?.length || 0} role(s)
              </Badge>
            </div>

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500">Debug: Dados do usuário</summary>
                <div className="mt-2 space-y-2">
                  <div className="p-2 bg-gray-100 rounded text-xs">
                    <strong>Frontend Data:</strong>
                    <pre className="mt-1 overflow-auto">
                      {JSON.stringify({
                        role_details: usuario.role_details,
                        roles: usuario.roles,
                        tipo: usuario.tipo,
                        perfil: usuario.perfil,
                        all_permissions_count: usuario.all_permissions?.length,
                        permissao_count: usuario.permissao?.length,
                        all_permissions_preview: usuario.all_permissions?.slice(0, 3)
                      }, null, 2)}
                    </pre>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Testar busca com debug
                      import('../hooks/useUsuarios').then(({ useUsuarios }) => {
                        console.log('🧪 [DEBUG BUTTON] Testando busca com debug para usuário:', usuario.id);
                        // Note: This is just for debugging, proper implementation would need access to the hook
                      });
                    }}
                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  >
                    🧪 Test Debug API
                  </button>
                </div>
              </details>
            )}

            {/* Permissões atuais */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">
                Permissões Atuais 
                <span className="ml-2">
                  (all_permissions: {usuario.all_permissions?.length || 0}, permissao: {usuario.permissao?.length || 0})
                </span>
              </h4>
              
              {/* Tentar exibir permissões de várias fontes */}
              {(() => {
                const permissions = usuario.all_permissions || usuario.permissao || [];
                return permissions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                  {permissions.map((permission, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border dark:bg-gray-800">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs font-mono">{permission}</span>
                    </div>
                  ))}
                </div>
                ) : (
                <div className="text-center p-8 border border-dashed rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Nenhuma permissão específica atribuída
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    As permissões podem vir do role atribuído
                  </div>
                </div>
                );
              })()}
            </div>

            {/* Edição de permissões - apenas no modo de edição */}
            {isEditMode && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Editar Permissões
                </h4>
                
                <div className="text-sm text-muted-foreground mb-3">
                  Use o campo "Permissões" na seção correspondente do formulário para modificar as permissões deste usuário.
                </div>
                
                <div className="p-3 bg-orange-50 rounded border border-orange-200 dark:bg-orange-950 dark:border-orange-800">
                  <div className="text-xs text-orange-700 dark:text-orange-300">
                    <strong>Aviso:</strong> As permissões modificadas no formulário serão aplicadas quando o usuário for salvo. 
                    Para gerenciamento avançado de permissões, implemente os endpoints de permissões no backend.
                  </div>
                </div>
              </div>
            )}

            {/* Informações adicionais */}
            <div className="text-xs text-muted-foreground p-3 bg-yellow-50 rounded border border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-3 w-3" />
                <span className="font-medium">Nota sobre permissões:</span>
              </div>
              <p>As permissões listadas são as atualmente armazenadas no banco de dados. Para gerenciar permissões completo, os endpoints de permissões devem estar implementados no backend.</p>
            </div>
          </div>
        </div>
      )}

      {/* Seção de plantas - apenas para proprietários no modo visualização/edição */}
      {(isViewMode || isEditMode) && 
       usuario && 
       (usuario.tipo === 'Proprietário' || usuario.perfil === 'Proprietário') && (
        <div className="mt-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2 border-b pb-2">
            <Leaf className="h-4 w-4" />
            Plantas
          </h3>
          
          <div className="bg-muted/30 rounded-lg p-4 border border-dashed border-muted-foreground/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-lg px-2 py-1 font-bold">
                  {usuario.plantas || 0}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {(usuario.plantas || 0) === 1 ? 'planta' : 'plantas'}
                </span>
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGerenciarPlantas}
              className="w-full flex items-center gap-2"
              disabled={!onGerenciarPlantas}
            >
              <Settings className="h-4 w-4" />
              Gerenciar Plantas de {usuario.nome}
            </Button>
          </div>
        </div>
      )}
    </BaseModal>
  );
}