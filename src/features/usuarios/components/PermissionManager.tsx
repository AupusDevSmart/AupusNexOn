// src/features/usuarios/components/PermissionManager.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Users,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

import { useUserPermissions, useAvailableRolesAndPermissions } from '@/hooks/useUserPermissions';
import { Usuario } from '../types';

interface PermissionManagerProps {
  usuario: Usuario;
  onUpdate?: () => void;
  readonly?: boolean;
  compact?: boolean;
}

/**
 * Componente simplificado para exibição de Roles e Permissões
 * Versão read-only focada em visualização
 */
export function PermissionManager({
  usuario,
  compact = false
}: PermissionManagerProps) {
  // Buscar permissões e roles do usuário
  const {
    permissions,
    roles,
    loading: permissionsLoading,
    error: permissionsError,
  } = useUserPermissions(usuario.id, true);

  // Buscar roles e permissões disponíveis no sistema
  const {
    loading: auxiliarLoading,
    error: auxiliarError
  } = useAvailableRolesAndPermissions();

  if (permissionsLoading || auxiliarLoading) {
    return (
      <div className="flex items-center justify-center p-4 md:p-8">
        <RefreshCw className="h-4 w-4 md:h-6 md:w-6 animate-spin mr-2" />
        <span className="text-sm md:text-base">Carregando permissões...</span>
      </div>
    );
  }

  if (permissionsError || auxiliarError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
        <AlertDescription className="text-xs md:text-sm">
          Erro ao carregar permissões: {permissionsError || auxiliarError}
        </AlertDescription>
      </Alert>
    );
  }

  // Agrupar permissões por source
  const rolePermissions = permissions.filter(p => p.source === 'role');
  const directPermissions = permissions.filter(p => p.source === 'direct');
  const totalPermissions = permissions.length;

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Card de Resumo - Responsivo */}
      <Card>
        <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
            <CardTitle className="text-base md:text-lg">Permissões do Usuário</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs md:text-sm">
                {totalPermissions} permissões totais
              </Badge>
            </div>
            <div>
              <span className="font-medium text-blue-600">{rolePermissions.length}</span> do role
            </div>
            <div>
              <span className="font-medium text-green-600">{directPermissions.length}</span> diretas
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles do Usuário - Responsivo */}
      {roles && roles.length > 0 && (
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              Roles Atribuídos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {roles.map((role) => (
                <Badge key={role.id} variant="default" className="text-xs md:text-sm">
                  {role.display_name || role.name}
                </Badge>
              ))}
            </div>
            {roles[0]?.description && (
              <p className="text-xs md:text-sm text-muted-foreground mt-2 md:mt-3">
                {roles[0].description}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Permissões do Role - Responsivo */}
      {!compact && rolePermissions.length > 0 && (
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 md:pb-6">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Shield className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />
              Permissões do Role ({rolePermissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 md:gap-2">
              {rolePermissions.map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-center gap-1.5 md:gap-2 p-1.5 md:p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800"
                >
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full shrink-0"></div>
                  <span className="text-[10px] md:text-xs font-mono truncate">
                    {permission.display_name || permission.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissões Diretas - Responsivo */}
      {!compact && directPermissions.length > 0 && (
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 md:pb-6">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Shield className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
              Permissões Extras ({directPermissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 md:gap-2">
              {directPermissions.map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-center gap-1.5 md:gap-2 p-1.5 md:p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800"
                >
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full shrink-0"></div>
                  <span className="text-[10px] md:text-xs font-mono truncate">
                    {permission.display_name || permission.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caso não tenha permissões - Responsivo */}
      {totalPermissions === 0 && (
        <Card>
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="text-center p-4 md:p-8 text-muted-foreground">
              <AlertCircle className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2" />
              <p className="text-xs md:text-sm">Nenhuma permissão atribuída a este usuário</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
