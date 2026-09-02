// src/components/common/base-modal/BaseModal.tsx - VERSÃO CORRIGIDA
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/core/components/ui/button';
import { Save, X, AlertCircle } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { BaseEntity, ModalMode, FormField, ModalEntity } from '@/core/types/base';
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
  /**
   * Ação extra no rodapé, abaixo de salvar e cancelar — tipicamente excluir.
   *
   * Fica separada por uma linha e depois do cancelar de propósito: é o lugar
   * mais distante do "Salvar", que é onde o dedo vai por reflexo. Quem passa
   * `acaoDestrutiva` decide o texto, o ícone e a confirmação; o BaseModal só
   * reserva o espaço.
   */
  acaoDestrutiva?: React.ReactNode;
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
  acaoDestrutiva,
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
        initialData[parent][child] = '';
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

  // Semeadura do formulário a partir da entity.
  //
  // Roda DURANTE O RENDER, não num efeito. Efeito de filho roda antes do efeito
  // do pai: quando isto era um useEffect, qualquer campo que dispara onChange no
  // próprio mount (o ProprietarioSelector do sheet de instalação, por exemplo)
  // escrevia antes da semeadura existir. Semeando no render, os filhos já montam
  // com os dados na mão e a ordem deixa de importar.
  //
  // setState durante o render do próprio componente é o padrão suportado pelo
  // React para derivar estado de props; o ref abaixo garante que converge.
  const chaveAbertura = isOpen
    ? `${mode}::${
        (entity && typeof entity === 'object' && 'id' in entity
          ? String((entity as any).id ?? '').trim()
          : '') || 'novo'
      }`
    : null;
  const chaveSemeadaRef = useRef<string | null>(null);

  if (chaveSemeadaRef.current !== chaveAbertura) {
    chaveSemeadaRef.current = chaveAbertura;

    let semente: any = {};
    if (chaveAbertura) {
      if (entity && (isViewMode || isEditMode)) {
        semente = normalizeEntityData(entity);
      } else if (entity && isCreateMode) {
        semente = { ...createInitialData(), ...normalizeEntityData(entity) };
      } else if (isCreateMode) {
        semente = createInitialData();
      }
    }

    setFormData(semente);
    setErrors({});
    setHasUnsavedChanges(false);
    initialDataRef.current = semente;
    isInitializedRef.current = chaveAbertura !== null;
  }

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
      return;
    }


    const validationErrors = validateFields(formData);
    if (Object.keys(validationErrors).length > 0) {
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


      await onSubmit(filteredData);

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
    // MESCLA sobre o estado atual em vez de substituir.
    //
    // Um campo pode disparar onChange ainda no mount, antes de o efeito de
    // semeadura rodar — efeito de filho roda antes do efeito do pai. Nesse
    // instante o BaseForm monta o newData sobre um data vazio, e um
    // setFormData(newData) direto APAGAVA todos os outros campos.
    //
    // Era o caso do sheet de instalacao: o ProprietarioSelector sincroniza o
    // dono derivado da planta e acabava sendo o unico campo restante. Mesclar
    // torna a ordem irrelevante. Limpar campo continua funcionando: a chave
    // vem no newData com undefined e o spread a sobrescreve.
    setFormData((prev) => ({ ...prev, ...newData }));

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

                {acaoDestrutiva && (
                  <div className="mt-1 border-t pt-2">{acaoDestrutiva}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
