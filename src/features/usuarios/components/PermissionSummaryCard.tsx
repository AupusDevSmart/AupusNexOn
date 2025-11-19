// src/features/usuarios/components/PermissionSummaryCard.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  ShieldCheck,
  Users,
  AlertCircle,
  TrendingUp,
  Settings,
  Eye
} from 'lucide-react';

import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Usuario } from '../types';

interface PermissionSummaryCardProps {
  usuario: Usuario;
  onClick?: () => void;
  showDetails?: boolean;
}

export function PermissionSummaryCard({
  usuario,
  onClick,
  showDetails = false
}: PermissionSummaryCardProps) {
  const {
    permissions,
    roles,
    loading,
    error
  } = useUserPermissions(usuario.id, true);

  if (loading) {
    return (
      <Card className={onClick ? "cursor-pointer hover:bg-muted/50" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar permissões
        </AlertDescription>
      </Alert>
    );
  }

  // Calcular resumo
  const rolePermissions = permissions.filter(p => p.source === 'role');
  const directPermissions = permissions.filter(p => p.source === 'direct');
  const totalPermissions = permissions.length;
  const primaryRole = roles[0]?.name || null;

  const getStatusColor = (total: number) => {
    if (total >= 10) return 'text-green-600';
    if (total >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRoleIcon = (role: string | null) => {
    if (!role) return <AlertCircle className="h-4 w-4 text-gray-400" />;

    const icons: Record<string, React.ReactNode> = {
      'admin': <Shield className="h-4 w-4 text-red-600" />,
      'gerente': <Users className="h-4 w-4 text-blue-600" />,
      'vendedor': <TrendingUp className="h-4 w-4 text-green-600" />,
      'consultor': <Settings className="h-4 w-4 text-purple-600" />
    };

    return icons[role.toLowerCase()] || <ShieldCheck className="h-4 w-4 text-gray-600" />;
  };

  return (
    <Card
      className={onClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {getRoleIcon(primaryRole)}
            Permissões
            {onClick && <Eye className="h-3 w-3 text-muted-foreground" />}
          </CardTitle>
          <Badge
            variant="secondary"
            className={`text-sm font-bold ${getStatusColor(totalPermissions)}`}
          >
            {totalPermissions}
          </Badge>
        </div>
        {primaryRole && (
          <CardDescription className="text-xs">
            Role: <strong>{primaryRole}</strong>
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Breakdown das permissões */}
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-muted-foreground">
              {rolePermissions.length} do role
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-muted-foreground">
              {directPermissions.length} extras
            </span>
          </div>
        </div>

        {/* Roles (se disponível e habilitado) */}
        {showDetails && roles.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Roles:
            </div>
            <div className="flex flex-wrap gap-1">
              {roles.slice(0, 3).map((role) => (
                <Badge
                  key={role.id}
                  variant="outline"
                  className="text-xs px-1 py-0"
                >
                  {role.display_name || role.name}
                </Badge>
              ))}
              {roles.length > 3 && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  +{roles.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Status visual */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {totalPermissions > 0 ? (
              <div className="flex items-center gap-1 text-green-600">
                <ShieldCheck className="h-3 w-3" />
                <span>Configurado</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span>Sem permissões</span>
              </div>
            )}
          </div>

          {onClick && (
            <span className="text-muted-foreground">
              Clique para ver detalhes
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Versão compacta para uso em listas
interface CompactPermissionSummaryProps {
  usuario: Usuario;
  onClick?: () => void;
}

export function CompactPermissionSummary({ usuario, onClick }: CompactPermissionSummaryProps) {
  const {
    permissions,
    roles,
    loading,
    error
  } = useUserPermissions(usuario.id, true);

  if (loading) {
    return <Skeleton className="h-6 w-20" />;
  }

  if (error) {
    return (
      <Badge variant="outline" className="text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />
        Erro
      </Badge>
    );
  }

  const totalPermissions = permissions.length;
  const primaryRole = roles[0]?.name || null;

  const getStatusColor = (total: number) => {
    if (total >= 10) return 'bg-green-100 text-green-800 border-green-200';
    if (total >= 5) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div
      className={`flex items-center gap-2 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      <Badge
        variant="secondary"
        className={`text-xs ${getStatusColor(totalPermissions)}`}
      >
        {totalPermissions} permissões
      </Badge>

      {primaryRole && (
        <span className="text-xs text-muted-foreground">
          {primaryRole}
        </span>
      )}

      {totalPermissions === 0 && (
        <AlertCircle className="h-3 w-3 text-red-500" />
      )}
    </div>
  );
}
