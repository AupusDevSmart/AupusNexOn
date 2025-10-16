// src/features/usuarios/components/PermissionManager.tsx
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  ShieldCheck, 
  Users, 
  AlertCircle, 
  CheckCircle2,
  Info,
  Settings,
  Eye,
  EyeOff,
  Save,
  RefreshCw
} from 'lucide-react';

import { useUserPermissions, useAvailableRolesAndPermissions } from '@/hooks/useUserPermissions';
import { UserRole, UserPermission } from '@/services/user-permissions.service';
import { Usuario } from '../types';

interface PermissionManagerProps {
  usuario: Usuario;
  onUpdate?: () => void;
  readonly?: boolean;
  compact?: boolean;
}

export function PermissionManager({ 
  usuario, 
  onUpdate, 
  readonly = false, 
  compact = false 
}: PermissionManagerProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(!compact);

  // Hooks para dados do usuário
  const {
    permissions,
    summary,
    categorized,
    loading: permissionsLoading,
    error: permissionsError,
    loadPermissions,
    loadCategorized,
    assignRole,
    syncPermissions
  } = useUserPermissions({ 
    userId: usuario.id,
    autoLoad: true 
  });

  // Hook para dados auxiliares
  const {
    roles,
    groupedPermissions,
    loading: auxiliarLoading,
    error: auxiliarError
  } = useAvailableRolesAndPermissions();

  // Inicializar estado quando dados carregarem
  useEffect(() => {
    if (permissions?.role) {
      setSelectedRoleId(permissions.role.id);
    }
    
    if (permissions?.permissions) {
      // Pegar apenas permissões diretas (source = 'direct')
      const directPermissions = permissions.permissions
        .filter(p => p.source === 'direct')
        .map(p => p.id);
      setSelectedPermissions(directPermissions);
    }
    
    setHasChanges(false);
  }, [permissions]);

  // Detectar mudanças
  useEffect(() => {
    const roleChanged = selectedRoleId !== permissions?.role?.id;
    const currentDirectPermissions = permissions?.permissions
      .filter(p => p.source === 'direct')
      .map(p => p.id) || [];
    const permissionsChanged = !arrayEquals(selectedPermissions, currentDirectPermissions);
    
    setHasChanges(roleChanged || permissionsChanged);
  }, [selectedRoleId, selectedPermissions, permissions]);

  // Utilitário para comparar arrays
  const arrayEquals = (a: number[], b: number[]): boolean => {
    return a.length === b.length && a.sort().every((val, i) => val === b.sort()[i]);
  };

  // Handler para mudança de role
  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(parseInt(roleId));
  };

  // Handler para mudança de permissão
  const handlePermissionToggle = (permissionId: number) => {
    if (readonly) return;
    
    setSelectedPermissions(prev => {
      const isSelected = prev.includes(permissionId);
      return isSelected 
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId];
    });
  };

  // Salvar mudanças
  const handleSave = async () => {
    if (!hasChanges) return;

    try {
      setSaving(true);

      // 1. Atribuir role se mudou
      if (selectedRoleId && selectedRoleId !== permissions?.role?.id) {
        await assignRole(selectedRoleId);
      }

      // 2. Sincronizar permissões diretas
      await syncPermissions(selectedPermissions);

      setHasChanges(false);
      onUpdate?.();
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
    } finally {
      setSaving(false);
    }
  };

  // Resetar mudanças
  const handleReset = () => {
    setSelectedRoleId(permissions?.role?.id || null);
    setSelectedPermissions(
      permissions?.permissions
        .filter(p => p.source === 'direct')
        .map(p => p.id) || []
    );
    setHasChanges(false);
  };

  // Verificar se permissão está ativa (via role ou direta)
  const isPermissionActive = (permissionId: number): boolean => {
    return permissions?.permissions?.some(p => p.id === permissionId) ?? false;
  };

  // Verificar se permissão vem do role
  const isFromRole = (permissionId: number): boolean => {
    return permissions?.permissions?.some(p => p.id === permissionId && p.source === 'role') ?? false;
  };

  if (permissionsLoading || auxiliarLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando permissões...</span>
      </div>
    );
  }

  if (permissionsError || auxiliarError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar permissões: {permissionsError || auxiliarError}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com resumo */}
      {summary && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Permissões do Usuário</CardTitle>
              </div>
              {!compact && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showDetails ? 'Ocultar' : 'Mostrar'} Detalhes
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Badge variant="secondary">
                  {summary.totalPermissions} permissões
                </Badge>
              </div>
              <div>
                <span className="font-medium text-blue-600">{summary.rolePermissions}</span> do role
              </div>
              <div>
                <span className="font-medium text-green-600">{summary.directPermissions}</span> diretas
              </div>
              {summary.role && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>Role: <strong>{summary.role}</strong></span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showDetails && (
        <Tabs defaultValue="role" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="role">Role Principal</TabsTrigger>
            <TabsTrigger value="permissions">Permissões Extras</TabsTrigger>
          </TabsList>

          {/* Tab: Role */}
          <TabsContent value="role">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Role do Usuário
                </CardTitle>
                <CardDescription>
                  O role define o conjunto base de permissões. Mudanças afetam todas as permissões automáticas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!readonly && (
                  <Select
                    value={selectedRoleId?.toString() || ''}
                    onValueChange={handleRoleChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          <div className="flex items-center justify-between w-full">
                            <span>{role.name}</span>
                            <Badge variant="outline" className="ml-2">
                              {role.permissions?.length || 0} permissões
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Mostrar permissões do role selecionado */}
                {selectedRoleId && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      Permissões do Role
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {roles
                        .find(r => r.id === selectedRoleId)
                        ?.permissions?.map(permission => (
                          <Badge key={permission.id} variant="secondary" className="text-xs">
                            {permission.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Permissões */}
          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Permissões Extras
                </CardTitle>
                <CardDescription>
                  Permissões adicionais que complementam ou sobrescrevem as do role.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {groupedPermissions && Object.entries(groupedPermissions).map(([category, permissions]) => (
                  <div key={category} className="space-y-3 mb-6">
                    <h4 className="font-medium text-sm border-b pb-1">
                      {category}
                    </h4>
                    <div className="grid gap-2">
                      {permissions.map(permission => {
                        const isActive = isPermissionActive(permission.id);
                        const fromRole = isFromRole(permission.id);
                        const isDirect = selectedPermissions.includes(permission.id);

                        return (
                          <div
                            key={permission.id}
                            className="flex items-center justify-between p-2 rounded border"
                          >
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={permission.id.toString()}
                                checked={isDirect}
                                onCheckedChange={() => handlePermissionToggle(permission.id)}
                                disabled={readonly}
                              />
                              <label
                                htmlFor={permission.id.toString()}
                                className="text-sm cursor-pointer"
                              >
                                {permission.name}
                              </label>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {fromRole && (
                                <Badge variant="outline" className="text-xs">
                                  Role
                                </Badge>
                              )}
                              {isDirect && (
                                <Badge variant="default" className="text-xs">
                                  Extra
                                </Badge>
                              )}
                              {isActive && (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Actions */}
      {!readonly && hasChanges && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4" />
                <span className="text-sm font-medium">Há alterações não salvas</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReset}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
                  <Save className="h-3 w-3 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}