// src/components/common/base-modal/BaseModal.tsx - VERSÃO CORRIGIDA
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Save, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BaseEntity, ModalMode, FormField, ModalEntity } from '@/types/base';
import { BaseForm } from './BaseForm';

interface BaseModalProps<T extends BaseEntity> {
  isOpen: boolean;
  mode: ModalMode;
  entity: ModalEntity<T>;
  title: string;
  icon?: React.ReactNode;
  formFields: FormField[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  width?: string;
  children?: React.ReactNode;
  groups?: { key: string; title: string; fields?: string[] }[];
  
  loading?: boolean;
  loadingText?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showFooter?: boolean;
  submitButtonText?: string;
  cancelButtonText?: string;
  onBeforeSubmit?: (data: any) => Promise<boolean> | boolean;
  onAfterSubmit?: (data: any) => void;
  onValidationError?: (errors: Record<string, string>) => void;
}

export function BaseModal<T extends BaseEntity>({
  isOpen,
  mode,
  entity,
  title,
  icon,
  formFields,
  onClose,
  onSubmit,
  width = "w-[500px]",
  children,
  groups,
  loading = false,
  loadingText = "Salvando...",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showFooter = true,
  submitButtonText,
  cancelButtonText,
  onBeforeSubmit,
  onAfterSubmit,
  onValidationError
}: BaseModalProps<T>) {
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';

  // Computar dados iniciais sincronamente para evitar flash de campos vazios
  const computeInitialData = useCallback((entityData: any, formFieldsList: FormField[], viewOrEdit: boolean, create: boolean) => {
    const normalize = (data: any): any => {
      const normalized: any = {};
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (value === '' || value === null) {
          normalized[key] = undefined;
        } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          normalized[key] = normalize(value);
        } else {
          normalized[key] = value;
        }
      });
      return normalized;
    };

    if (entityData && viewOrEdit) {
      return normalize(entityData);
    } else if (entityData && create) {
      const base: any = {};
      formFieldsList.forEach(field => {
        if (field.key.includes('.')) {
          const [parent, child] = field.key.split('.');
          if (!base[parent]) base[parent] = {};
          base[parent][child] = (field as any).defaultValue ?? '';
        } else if (field.type === 'custom' && field.key === 'endereco') {
          base[field.key] = { uf: '', cidade: '', cep: '', logradouro: '', bairro: '' };
        } else {
          base[field.key] = (field as any).defaultValue ?? '';
        }
      });
      return { ...base, ...normalize(entityData) };
    } else if (create) {
      const base: any = {};
      formFieldsList.forEach(field => {
        if (field.key.includes('.')) {
          const [parent, child] = field.key.split('.');
          if (!base[parent]) base[parent] = {};
          base[parent][child] = (field as any).defaultValue ?? '';
        } else if (field.type === 'custom' && field.key === 'endereco') {
          base[field.key] = { uf: '', cidade: '', cep: '', logradouro: '', bairro: '' };
        } else {
          base[field.key] = (field as any).defaultValue ?? '';
        }
      });
      return base;
    }
    return {};
  }, []);

  const [formData, setFormData] = useState<any>(() =>
    computeInitialData(entity, formFields, isViewMode || isEditMode, isCreateMode)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ✅ CORREÇÃO: Refs para controle de inicialização
  const initialDataRef = useRef<any>(formData);
  const modalRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(Object.keys(formData).length > 0);
  const isLoading = loading || isSubmitting;

  const getSubmitButtonText = useCallback(() => {
    if (submitButtonText) return submitButtonText;
    return isCreateMode ? 'Cadastrar' : 'Salvar';
  }, [submitButtonText, isCreateMode]);

  const getCancelButtonText = useCallback(() => {
    if (cancelButtonText) return cancelButtonText;
    return isViewMode ? 'Fechar' : 'Cancelar';
  }, [cancelButtonText, isViewMode]);

  const createInitialData = useCallback(() => {
    const initialData: any = {};
    formFields.forEach(field => {
      if (field.key.includes('.')) {
        const [parent, child] = field.key.split('.');
        if (!initialData[parent]) initialData[parent] = {};
        initialData[parent][child] = (field as any).defaultValue ?? '';
      } else {
        // Para campos customizados (tipo 'custom'), inicializar com valor apropriado
        if (field.type === 'custom' && field.key === 'endereco') {
          initialData[field.key] = {
            uf: '',
            cidade: '',
            cep: '',
            logradouro: '',
            bairro: ''
          };
        } else {
          initialData[field.key] = (field as any).defaultValue ?? '';
        }
      }
    });
    return initialData;
  }, [formFields]);

  // Helper para normalizar dados da entity - converte strings vazias em undefined para Selects
  const normalizeEntityData = useCallback((data: any) => {
    const normalized: any = {};

    Object.keys(data).forEach(key => {
      const value = data[key];

      // Se é string vazia, converter para undefined
      if (value === '' || value === null) {
        normalized[key] = undefined;
      }
      // Se é objeto, normalizar recursivamente
      else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        normalized[key] = normalizeEntityData(value);
      }
      // Caso contrário, manter o valor
      else {
        normalized[key] = value;
      }
    });

    return normalized;
  }, []);

  // ✅ CORREÇÃO PRINCIPAL: useEffect simplificado que não reseta dados
  useEffect(() => {
    // console.log('🔄 BaseModal: useEffect triggered - isOpen:', isOpen, 'initialized:', isInitializedRef.current);
    // console.log('🔄 BaseModal: entity recebida:', entity);
    // console.log('🔄 BaseModal: mode:', mode);

    if (!isOpen) {
      // Modal fechado - limpar estado completamente
      // console.log('🧹 BaseModal: Modal fechado, limpando estado');
      setFormData({});
      initialDataRef.current = {};
      setErrors({});
      setHasUnsavedChanges(false);
      isInitializedRef.current = false; // ← RESET flag de inicialização
      return;
    }

    // ✅ CORREÇÃO: Só inicializar uma vez por abertura do modal OU quando entity mudar
    // Se estamos no modo edit/view e a entity mudou, precisamos reinicializar
    const currentEntityId = entity && typeof entity === 'object' && 'id' in entity ? entity.id : null;
    const shouldReinitialize = currentEntityId && initialDataRef.current.id !== currentEntityId;

    if (isInitializedRef.current && !shouldReinitialize) {
      // console.log('🔄 BaseModal: Já inicializado e entity não mudou, ignorando');
      return;
    }

    if (shouldReinitialize) {
      // console.log('🔄 BaseModal: Entity mudou, reinicializando dados');
    }

    // Modal aberto - processar dados APENAS uma vez
    let initialData: any = {};

    if (entity && (isViewMode || isEditMode)) {
      // console.log('📖 BaseModal: Modo view/edit, carregando entity:', entity);
      // console.log('🔑 BaseModal: entity.concessionariaId ANTES normalização:', (entity as any).concessionariaId);
      // ✅ CORREÇÃO: Normalizar entity para converter strings vazias em undefined
      initialData = normalizeEntityData(entity);
      // console.log('✨ BaseModal: Entity normalizada:', initialData);
      // console.log('🔑 BaseModal: initialData.concessionariaId APÓS normalização:', initialData.concessionariaId);
    } else if (entity && isCreateMode) {
      // console.log('🆕 BaseModal: Modo create com entity inicial:', entity);
      const baseData = createInitialData();
      // ✅ CORREÇÃO: Normalizar entity antes de mesclar
      const normalizedEntity = normalizeEntityData(entity);
      initialData = { ...baseData, ...normalizedEntity };
      // console.log('✨ BaseModal: Entity normalizada (create):', initialData);
    } else if (isCreateMode) {
      // console.log('🆕 BaseModal: Modo create vazio');
      initialData = createInitialData();
    }

    // console.log('📝 BaseModal: Definindo formData inicial para:', initialData);
    // console.log('🔑 BaseModal: formData.concessionariaId que será setado:', initialData.concessionariaId);
    setFormData(initialData);
    initialDataRef.current = initialData;
    setErrors({});
    setHasUnsavedChanges(false);
    isInitializedRef.current = true; // ← MARCAR como inicializado

  }, [isOpen, entity, mode, isViewMode, isEditMode, isCreateMode, createInitialData]); // ✅ CORREÇÃO: Incluir entity e mode nas dependências

  // ✅ CORREÇÃO: useEffect separado para detectar mudanças
  useEffect(() => {
    if (!isViewMode && isInitializedRef.current) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialDataRef.current);
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, isViewMode]);

  const isFieldVisible = useCallback((field: any, data: any): boolean => {
    let shouldShow = true;

    if (field.conditionalRender) {
      try { shouldShow = shouldShow && field.conditionalRender(data); }
      catch { return false; }
    }

    if (field.showOnlyOnMode && mode) {
      const modes = Array.isArray(field.showOnlyOnMode) ? field.showOnlyOnMode : [field.showOnlyOnMode];
      shouldShow = shouldShow && modes.includes(mode);
    }

    if (field.hideOnMode && mode) {
      const modes = Array.isArray(field.hideOnMode) ? field.hideOnMode : [field.hideOnMode];
      shouldShow = shouldShow && !modes.includes(mode);
    }

    if (field.showOnlyWhen) {
      const dependentValue = data[field.showOnlyWhen.field];
      shouldShow = shouldShow && (dependentValue === field.showOnlyWhen.value);
    }

    if (field.condition) {
      try { shouldShow = shouldShow && field.condition(entity, data); }
      catch { /* keep current shouldShow */ }
    }

    return shouldShow;
  }, [mode, entity]);

  const validateFields = useCallback((data: any): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    formFields.forEach(field => {
      // Only validate fields that are currently visible
      if (!isFieldVisible(field, data)) return;

      if (field.required) {
        const value = field.key.includes('.')
          ? data[field.key.split('.')[0]]?.[field.key.split('.')[1]]
          : data[field.key];

        if (!value || String(value).trim() === '') {
          newErrors[field.key] = `${field.label} é obrigatório`;
        }
      }

      if (field.validation) {
        const value = field.key.includes('.')
          ? data[field.key.split('.')[0]]?.[field.key.split('.')[1]]
          : data[field.key];

        const error = field.validation(value, data);
        if (error) {
          newErrors[field.key] = error;
        }
      }
    });

    return newErrors;
  }, [formFields, isFieldVisible]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (isLoading) {
      console.log('⏳ [BASE MODAL] Já está processando, ignorando submissão');
      return;
    }

    console.log('🚀 [BASE MODAL] Iniciando submissão:', formData);
    console.log('🚀 [BASE MODAL] Mode:', mode);

    const validationErrors = validateFields(formData);
    if (Object.keys(validationErrors).length > 0) {
      console.log('❌ [BASE MODAL] Erros de validação:', validationErrors);
      setErrors(validationErrors);
      onValidationError?.(validationErrors);

      // Mostrar toast com o primeiro erro
      const firstError = Object.values(validationErrors)[0];
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: "Erro de validação",
        description: firstError,
        variant: "destructive",
      });

      return;
    }

    if (onBeforeSubmit) {
      try {
        const canProceed = await onBeforeSubmit(formData);
        if (!canProceed) {
          console.log('🛑 [BASE MODAL] Submissão cancelada por onBeforeSubmit');
          return;
        }
      } catch (error) {
        console.error('❌ [BASE MODAL] Erro em onBeforeSubmit:', error);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const fieldsToExclude = formFields
        .filter(field => (field as any).excludeFromSubmit === true)
        .map(field => field.key);

      const filteredData = { ...formData };
      fieldsToExclude.forEach(fieldKey => {
        delete filteredData[fieldKey];
      });

      if (filteredData.frequencia !== 'PERSONALIZADA') {
        delete filteredData.frequencia_personalizada;
      }

      console.log('📤 [BASE MODAL] Dados filtrados para envio:', filteredData);
      console.log('🚫 [BASE MODAL] Campos excluídos:', fieldsToExclude);
      console.log('📞 [BASE MODAL] Chamando onSubmit...');

      await onSubmit(filteredData);
      console.log('✅ [BASE MODAL] Submissão concluída com sucesso');

      onAfterSubmit?.(formData);
      setHasUnsavedChanges(false);

    } catch (error) {
      console.error('❌ [BASE MODAL] Erro na submissão:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isLoading, validateFields, onBeforeSubmit, onSubmit, onAfterSubmit, onValidationError, formFields, mode]);

  const handleClose = useCallback(() => {
    if (isLoading) {
      // console.log('⏳ [BASE MODAL] Não é possível fechar durante loading');
      return;
    }

    if (hasUnsavedChanges && !isViewMode) {
      const confirmClose = window.confirm(
        'Você tem alterações não salvas. Tem certeza que deseja fechar?'
      );
      if (!confirmClose) return;
    }

    onClose();
  }, [isLoading, hasUnsavedChanges, isViewMode, onClose]);

  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, handleClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      handleClose();
    }
  }, [closeOnBackdropClick, handleClose]);

  // ✅ CORREÇÃO PRINCIPAL: handleFormDataChange sem dependência problemática
  const handleFormDataChange = useCallback((newData: any) => {
    // console.log('📝 BaseModal: FormData alterado:', newData);
    // console.log('🔍 BaseModal: Origem atual:', newData.origem);
    // console.log('🔄 BaseModal: handleFormDataChange chamado');
    // console.log('🔑 BaseModal: concessionariaId no newData:', newData.concessionariaId);
    // console.log('🔍 BaseModal: Tipo:', typeof newData.concessionariaId);

    setFormData(newData);

    // Limpar erros dos campos que foram alterados
    setErrors(prev => {
      const updatedErrors = { ...prev };
      // Comparar com formData atual via closure
      Object.keys(newData).forEach(key => {
        // Se o campo foi alterado, remover o erro
        delete updatedErrors[key];
      });
      return updatedErrors;
    });
  }, []); // ✅ CORREÇÃO: Sem dependências problemáticas

  // ✅ ADICIONADO: Debug para rastrear mudanças no formData
  useEffect(() => {
    // console.log('🎯 BaseModal: formData.origem mudou para:', formData.origem);
  }, [formData.origem]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />
      
      <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-end">
        <div
          ref={modalRef}
          className={cn(
            "bg-background shadow-2xl pointer-events-auto",
            "transform transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "translate-x-full",
            "overflow-hidden flex flex-col",
            // Mobile: fullscreen
            "w-full h-full",
            // Desktop: sidebar direita com 50vw
            "md:w-[50vw] md:h-full md:border-l md:border-border"
          )}
        >
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="hidden md:block shrink-0">{icon}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base md:text-lg font-semibold truncate">{title}</h2>
                  {hasUnsavedChanges && !isViewMode && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      <span className="hidden sm:inline">Alterações não salvas</span>
                      <span className="sm:hidden">Não salvo</span>
                    </p>
                  )}
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleClose}
                disabled={isLoading}
                className="h-8 w-8 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6">
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <BaseForm
                  fields={formFields}
                  data={formData}
                  errors={errors}
                  disabled={isViewMode || isLoading}
                  onChange={handleFormDataChange}
                  mode={mode}
                  entity={entity}
                  groups={groups}
                />
                
                {children}
              </form>
            </div>
          </div>

          {showFooter && (
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 md:px-6 md:py-4 shrink-0">
              <div className="flex flex-col gap-2">
                {!isViewMode && (
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full flex items-center gap-2"
                    onClick={() => handleSubmit()}
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {loadingText}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {getSubmitButtonText()}
                      </>
                    )}
                  </Button>
                )}
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={isLoading}
                  className={cn(
                    "w-full flex items-center gap-2",
                    hasUnsavedChanges && !isViewMode && "border-amber-200 text-amber-700 hover:bg-amber-50"
                  )}
                >
                  <X className="h-4 w-4" />
                  {getCancelButtonText()}
                  {hasUnsavedChanges && !isViewMode && " (não salvo)"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
