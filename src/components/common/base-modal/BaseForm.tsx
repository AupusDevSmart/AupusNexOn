// src/components/common/base-modal/BaseForm.tsx - VERSÃO CORRIGIDA
import React, { useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { FormField, ModalMode, BaseEntity, ModalEntity } from '@/types/base';

interface FormFieldProps {
  value: any;
  onChange: (value: any) => void;
  onMultipleChange?: (updates: Record<string, unknown>) => void;
  disabled: boolean;
  error?: string;
  mode?: ModalMode;
  entity?: ModalEntity<BaseEntity>;
  [key: string]: any;
}

interface BaseFormProps {
  fields: FormField[];
  data: Record<string, unknown>;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (data: Record<string, unknown>) => void;
  mode?: ModalMode;
  entity?: ModalEntity<BaseEntity>;
  groups?: { key: string; title: string; fields?: string[]; conditional?: any }[];
}

export function BaseForm({
  fields,
  data,
  errors,
  disabled,
  onChange,
  mode,
  entity,
  groups
}: BaseFormProps) {
  // ✅ CORREÇÃO: Ref para sempre ter o estado mais atual
  const latestDataRef = useRef(data);
  
  // Sempre atualizar o ref quando data muda
  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  // ✅ handleOrigemChange corrigido - atualiza ref imediatamente
  const handleOrigemChange = useCallback((newValue: any) => {
    // console.log('🔄 BaseForm: handleOrigemChange chamado:', newValue);
    // console.log('🔍 BaseForm: Data atual:', latestDataRef.current);
    
    const newData: Record<string, unknown> = {
      ...latestDataRef.current, // ✅ Usa ref que sempre tem estado atual
      origem: { ...newValue } // Clone profundo para evitar mutação
    };
    
    // ✅ CORREÇÃO CRÍTICA: Atualizar ref IMEDIATAMENTE antes de chamar onChange
    latestDataRef.current = newData;
    
    // console.log('📤 BaseForm: Enviando newData para onChange (origem):', newData);
    // console.log('🔍 BaseForm: Ref atualizada imediatamente com:', newData.origem);
    onChange(newData);
  }, [onChange]); // ✅ Só onChange como dependência

  // ✅ handleLocalAtivoChange corrigido - agora usa ref sempre atualizada
  const handleLocalAtivoChange = useCallback((local: string, ativo: string) => {
    // console.log('🏠 BaseForm: Recebeu local/ativo:', { local, ativo });
    // console.log('🔍 BaseForm: Data mais atual (ref):', latestDataRef.current);
    // console.log('🔍 BaseForm: Origem no ref:', latestDataRef.current?.origem);
    
    const newData = {
      ...latestDataRef.current, // ✅ Agora sempre tem a origem atualizada
      local,
      ativo
    };
    
    // console.log('📤 BaseForm: Enviando newData para onChange (local/ativo):', newData);
    // console.log('🔍 BaseForm: Origem preservada:', newData.origem);
    onChange(newData);
  }, [onChange]); // ✅ Só onChange como dependência

  const handleFieldChange = (key: string, value: unknown) => {
    // console.log('🔄 BaseForm: handleFieldChange:', { key, value, valueType: typeof value });
    // console.log('🔄 BaseForm: Estado atual do data:', data);

    let newData: Record<string, unknown>;

    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      newData = {
        ...data,
        [parent]: {
          ...(data[parent] as Record<string, unknown>),
          [child]: value
        }
      };
    } else {
      newData = {
        ...data,
        [key]: value
      };
    }

    // console.log('📤 BaseForm: Enviando newData para onChange:', newData);
    onChange(newData);
    // console.log('✅ BaseForm: onChange chamado com sucesso');
  };

  const handleMultipleFieldsChange = (updates: Record<string, unknown>) => {
    const preservedFields = ['status', 'criticidade', 'categoria', 'tipo_manutencao'];
    const preserved: Record<string, unknown> = {};

    preservedFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        preserved[field] = data[field];
      }
    });

    const newData = {
      ...data,
      ...updates,
      ...preserved
    };

    onChange(newData);
  };

  const getValue = (key: string, field?: FormField): unknown => {
    let value: unknown;

    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      value = (data[parent] as Record<string, unknown>)?.[child];
    } else {
      value = data[key];
    }

    if ((value === undefined || value === null) && field?.defaultValue !== undefined) {
      return field.defaultValue;
    }

    if (typeof value === 'string') {
      return value;
    }

    return value !== undefined && value !== null ? value : '';
  };

  const visibleFields = fields.filter((field) => {
    if ((field as any).showOnlyOnMode && mode) {
      const showOnlyOnMode = Array.isArray((field as any).showOnlyOnMode)
        ? (field as any).showOnlyOnMode
        : [(field as any).showOnlyOnMode];
      return showOnlyOnMode.includes(mode);
    }

    if ((field as any).hideOnMode && mode) {
      const hideOnMode = Array.isArray((field as any).hideOnMode)
        ? (field as any).hideOnMode
        : [(field as any).hideOnMode];
      return !hideOnMode.includes(mode);
    }

    if ((field as any).showOnlyWhen) {
      const condition = (field as any).showOnlyWhen;
      const dependentFieldValue = data[condition.field];
      return dependentFieldValue === condition.value;
    }

    if ((field as any).condition) {
      const conditionFn = (field as any).condition;
      try {
        return conditionFn(entity, data);
      } catch (error) {
        // console.warn('Erro ao avaliar condição do campo:', field.key, error);
        return true;
      }
    }

    return true;
  });

  const shouldShowGroup = (group: any): boolean => {
    if (!group.conditional) return true;

    const { field, value } = group.conditional;

    if (field === 'mode') {
      return mode === value;
    }

    // Se value é uma função, executá-la com a entity
    if (typeof value === 'function') {
      try {
        return value(entity);
      } catch (error) {
        console.warn('Erro ao avaliar condição do grupo:', group.key, error);
        return false;
      }
    }

    const currentValue = getValue(field);
    return currentValue === value;
  };

  const groupedFields = (() => {
    if (groups && groups.length > 0) {
      const result: Record<string, FormField[]> = {};

      groups.forEach(group => {
        if (!shouldShowGroup(group)) {
          // console.log(`🚫 Grupo '${group.key}' oculto pela condição:`, group.conditional);
          return;
        }

        // console.log(`✅ Grupo '${group.key}' visível`);
        result[group.key] = [];
        
        if (group.fields) {
          group.fields.forEach(fieldKey => {
            const field = visibleFields.find(f => f.key === fieldKey);
            if (field) {
              result[group.key].push(field);
            }
          });
        }
      });

      return result;
    } else {
      const grouped = visibleFields.reduce((acc, field) => {
        const group = field.group || 'main';
        if (!acc[group]) acc[group] = [];
        acc[group].push(field);
        return acc;
      }, {} as Record<string, FormField[]>);

      return grouped;
    }
  })();

  const renderField = (field: FormField) => {
    const value = getValue(field.key, field);
    const error = errors[field.key];

    let fieldDisabled = disabled || field.disabled;
    if ((field as any).computeDisabled) {
      fieldDisabled = fieldDisabled || (field as any).computeDisabled(entity, data);
    }

    const fieldProps: FormFieldProps = {
      value,
      onChange: (newValue) => handleFieldChange(field.key, newValue),
      onMultipleChange: handleMultipleFieldsChange,
      disabled: fieldDisabled,
      error,
      mode,
      entity,
      geral: getValue('geral'),
      recorrente: getValue('recorrente'),
      ...((field as any).dependencies && {
        ...(field as any).dependencies.reduce((acc: Record<string, unknown>, dep: string) => {
          acc[dep] = getValue(dep);
          return acc;
        }, {} as Record<string, unknown>)
      })
    };

    if (field.render) {
      try {
        return React.createElement(field.render as any, fieldProps);
      } catch (error) {
        // console.error(`❌ Erro ao renderizar campo customizado ${field.key}:`, error);
        return (
          <div className="p-2 border border-dashed border-red-300 rounded text-sm text-red-600 bg-red-50">
            Erro ao renderizar "{field.label}": {(error as Error).message}
          </div>
        );
      }
    }

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <Input
            type={field.type === 'email' ? 'email' : 'text'}
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={fieldDisabled}
            placeholder={field.placeholder}
            className={error ? 'border-red-500' : ''}
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={fieldDisabled}
            placeholder={field.placeholder}
            className={error ? 'border-red-500' : ''}
            min={field.min}
            max={field.max}
          />
        );
      
      case 'password':
        return (
          <Input
            type="password"
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={fieldDisabled}
            placeholder={field.placeholder}
            className={error ? 'border-red-500' : ''}
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={fieldDisabled}
            placeholder={field.placeholder}
            className={error ? 'border-red-500' : ''}
            rows={3}
          />
        );
      
      case 'select':
        return (
          <Select
            key={`${field.key}-${entity?.id || 'new'}-${value}`}
            value={String(value || '')}
            onValueChange={(newValue) => {
              handleFieldChange(field.key, newValue);
            }}
            disabled={fieldDisabled}
          >
            <SelectTrigger className={error ? 'border-red-500' : ''}>
              <SelectValue placeholder={field.placeholder || `Selecione ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.key}
              checked={value as boolean}
              onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
              disabled={fieldDisabled}
              className={error ? 'border-red-500' : ''}
            />
            <Label htmlFor={field.key} className="text-sm font-normal">
              {field.placeholder || field.label}
            </Label>
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            id={field.key}
            value={String(value || '')}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={fieldDisabled}
            className={cn(
              "w-full px-3 py-2 border rounded-md transition-colors",
              "bg-background text-foreground",
              "border-input hover:border-ring",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-destructive focus:ring-destructive"
            )}
            required={field.required}
          />
        );

      case 'time':
        return (
          <input
            type="time"
            id={field.key}
            value={String(value || '')}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={fieldDisabled}
            className={cn(
              "w-full px-3 py-2 border rounded-md transition-colors",
              "bg-background text-foreground",
              "border-input hover:border-ring",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-destructive focus:ring-destructive"
            )}
            required={field.required}
            placeholder={field.placeholder}
          />
        );

      case 'datetime-local':
        return (
          <input
            type="datetime-local"
            id={field.key}
            value={String(value || '')}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={fieldDisabled}
            className={cn(
              "w-full px-3 py-2 border rounded-md transition-colors",
              "bg-background text-foreground",
              "border-input hover:border-ring",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-destructive focus:ring-destructive"
            )}
            required={field.required}
            min={field.min ? String(field.min) : undefined}
            max={field.max ? String(field.max) : undefined}
            placeholder={field.placeholder}
          />
        );

      case 'custom':
        if (field.component) {
          const CustomComponent = field.component;

          // ✅ Props especiais para OrigemOSSelector corrigidas
          let specialProps = {};
          if (field.key === 'origem') {
            specialProps = {
              onLocalAtivoChange: handleLocalAtivoChange // ✅ Usa a função corrigida
            };
            // console.log('🎯 BaseForm: Renderizando OrigemOSSelector com valor:', value);
            // console.log('🔍 BaseForm: Data.origem atual:', data.origem);
          }

          return (
            <CustomComponent
              value={value}
              onChange={field.key === 'origem' ? handleOrigemChange : (newValue: any) => {
                // console.log('🔄 BaseForm: CustomComponent onChange chamado:', { field: field.key, newValue });
                handleFieldChange(field.key, newValue);
              }}
              disabled={fieldDisabled}
              {...field.componentProps}
              {...specialProps}
            />
          );
        }
        // console.warn(`Campo customizado '${field.key}' não tem componente definido`);
        return (
          <div className="p-2 border border-dashed border-orange-300 rounded text-sm text-orange-600 bg-orange-50">
            Campo customizado "{field.label}" sem componente
          </div>
        );
      
      default:
        // console.warn(`Tipo de campo não suportado: ${field.type}`);
        return (
          <div className="p-2 border border-dashed border-gray-300 rounded text-sm text-gray-500">
            Campo tipo "{field.type}" não implementado
          </div>
        );
    }
  };

  // ✅ ADICIONADO: Log de debug para rastrear mudanças na origem
  useEffect(() => {
    // console.log('🎯 BaseForm: data.origem mudou para:', data.origem);
  }, [data.origem]);

  return (
    <div className="space-y-6">
      {Object.entries(groupedFields).map(([groupName, groupFields], groupIndex) => {
        if (groupFields.length === 0) {
          // console.log(`⚠️ Grupo '${groupName}' está vazio`);
          return null;
        }

        return (
          <div key={groupName}>
            {groupIndex > 0 && <Separator className="my-6" />}
            
            {groupName !== 'main' && (
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground border-b pb-2 capitalize">
                  {groups?.find(g => g.key === groupName)?.title || groupName.replace(/_/g, ' ')}
                </h3>
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-4">
              {groupFields.map((field) => {
                const colSpan = (field as any).colSpan || 1;
                
                return (
                  <div 
                    key={field.key} 
                    className={colSpan > 1 ? `col-span-${colSpan}` : ''}
                  >
                    {field.type !== 'checkbox' && (
                      <Label htmlFor={field.key} className="text-sm font-medium">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                    )}
                    
                    <div className={field.type !== 'checkbox' ? 'mt-1' : ''}>
                      {renderField(field)}
                    </div>
                    
                    {errors[field.key] && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors[field.key]}
                      </p>
                    )}
                    
                    {(field as any).helpText && !errors[field.key] && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {(field as any).helpText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-8 p-4 bg-muted rounded-lg">
          <summary className="text-xs text-muted-foreground cursor-pointer">
            🐛 Debug Info (dev only)
          </summary>
          <pre className="text-xs mt-2 text-muted-foreground">
            Mode: {mode || 'undefined'}{'\n'}
            Data.origem: {JSON.stringify(data.origem, null, 2)}{'\n'}
            Fields: {fields.length}{'\n'}
            Visible: {visibleFields.length}{'\n'}
            Groups: {Object.keys(groupedFields).join(', ')}{'\n'}
            GroupsWithFields: {Object.entries(groupedFields).map(([k, v]) => `${k}(${v.length})`).join(', ')}{'\n'}
            Errors: {Object.keys(errors).length}{'\n'}
            Data keys: {Object.keys(data).join(', ')}
          </pre>
        </details>
      )}
    </div>
  );
}