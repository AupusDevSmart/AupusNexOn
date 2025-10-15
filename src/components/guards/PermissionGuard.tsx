// src/components/guards/PermissionGuard.tsx
import React, { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  ShieldOff, 
  AlertCircle, 
  Lock, 
  RefreshCw,
  Home
} from 'lucide-react';

import { usePermissionCheck, useMultiplePermissionCheck } from '@/hooks/useUserPermissions';
import { useNavigate } from 'react-router-dom';

// ==========================================
// 🛡️ GUARD PARA UMA PERMISSÃO
// ==========================================

interface PermissionGuardProps {
  userId: string;
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  showError?: boolean;
  onUnauthorized?: () => void;
}

export function PermissionGuard({
  userId,
  permission,
  children,
  fallback,
  loadingComponent,
  errorComponent,
  showError = true,
  onUnauthorized
}: PermissionGuardProps) {
  const { hasPermission, loading, error, recheck } = usePermissionCheck(
    userId, 
    permission, 
    true
  );

  // Loading state
  if (loading) {
    if (loadingComponent) return <>{loadingComponent}</>;
    
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Verificando permissões...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    if (errorComponent) return <>{errorComponent}</>;
    
    if (showError) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Erro ao verificar permissão: {error}</span>
            <Button variant="outline" size="sm" onClick={recheck}>
              Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    
    return null;
  }

  // Permission denied
  if (!hasPermission) {
    onUnauthorized?.();
    
    if (fallback) return <>{fallback}</>;
    
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <ShieldOff className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-100">
                Acesso Negado
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                Você não tem permissão para acessar este recurso.
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Permissão necessária: <code>{permission}</code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Permission granted
  return <>{children}</>;
}

// ==========================================
// 🛡️ GUARD PARA MÚLTIPLAS PERMISSÕES
// ==========================================

interface MultiplePermissionGuardProps {
  userId: string;
  permissions: string[];
  mode?: 'any' | 'all';
  children: ReactNode;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  showError?: boolean;
  onUnauthorized?: () => void;
}

export function MultiplePermissionGuard({
  userId,
  permissions,
  mode = 'any',
  children,
  fallback,
  loadingComponent,
  errorComponent,
  showError = true,
  onUnauthorized
}: MultiplePermissionGuardProps) {
  const { hasPermissions, details, loading, error, recheck } = useMultiplePermissionCheck(
    userId, 
    permissions, 
    mode,
    true
  );

  // Loading state
  if (loading) {
    if (loadingComponent) return <>{loadingComponent}</>;
    
    return (
      <div className="flex items-center justify-center p-8">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    if (errorComponent) return <>{errorComponent}</>;
    
    if (showError) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Erro ao verificar permissões: {error}</span>
            <Button variant="outline" size="sm" onClick={recheck}>
              Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    
    return null;
  }

  // Permission denied
  if (!hasPermissions) {
    onUnauthorized?.();
    
    if (fallback) return <>{fallback}</>;
    
    const grantedPermissions = Object.entries(details).filter(([, granted]) => granted);
    const deniedPermissions = Object.entries(details).filter(([, granted]) => !granted);
    
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Lock className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-100">
                Permissões Insuficientes
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                Você precisa de {mode === 'all' ? 'todas' : 'ao menos uma'} das seguintes permissões:
              </p>
            </div>
          </div>
          
          <div className="grid gap-2">
            {permissions.map(permission => {
              const isGranted = details[permission];
              return (
                <div key={permission} className="flex items-center gap-2 text-sm">
                  {isGranted ? (
                    <Shield className="h-4 w-4 text-green-600" />
                  ) : (
                    <ShieldOff className="h-4 w-4 text-red-600" />
                  )}
                  <code className={isGranted ? 'text-green-700' : 'text-red-700'}>
                    {permission}
                  </code>
                  <span className={`text-xs ${isGranted ? 'text-green-600' : 'text-red-600'}`}>
                    {isGranted ? '✓' : '✗'}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Permissions granted
  return <>{children}</>;
}

// ==========================================
// 🛡️ GUARD PARA PÁGINAS INTEIRAS
// ==========================================

interface PagePermissionGuardProps {
  userId: string;
  permission: string;
  children: ReactNode;
  redirectTo?: string;
  showBackButton?: boolean;
}

export function PagePermissionGuard({
  userId,
  permission,
  children,
  redirectTo = '/',
  showBackButton = true
}: PagePermissionGuardProps) {
  const navigate = useNavigate();
  const { hasPermission, loading, error } = usePermissionCheck(userId, permission);

  const handleGoBack = () => {
    navigate(redirectTo);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  // Loading state - página inteira
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-600" />
          <div>
            <h2 className="text-lg font-medium">Verificando Acesso</h2>
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto verificamos suas permissões...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state - página inteira
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-red-600" />
            <div>
              <h2 className="text-lg font-medium">Erro de Verificação</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Não foi possível verificar suas permissões.
              </p>
              <p className="text-xs text-red-600 mt-2">{error}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              {showBackButton && (
                <Button variant="outline" onClick={handleGoHome}>
                  <Home className="h-4 w-4 mr-2" />
                  Ir para Início
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Permission denied - página inteira
  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="space-y-2">
              <Lock className="h-16 w-16 mx-auto text-red-600" />
              <h1 className="text-2xl font-bold text-red-900 dark:text-red-100">
                Acesso Negado
              </h1>
              <p className="text-muted-foreground">
                Você não tem permissão para acessar esta página.
              </p>
            </div>
            
            <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>Permissão necessária:</strong>
              </p>
              <code className="text-xs bg-red-100 dark:bg-red-900 px-2 py-1 rounded mt-1 block">
                {permission}
              </code>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              {showBackButton && (
                <Button variant="outline" onClick={handleGoBack} className="flex-1">
                  Voltar
                </Button>
              )}
              <Button onClick={handleGoHome} className="flex-1">
                <Home className="h-4 w-4 mr-2" />
                Ir para Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Permission granted - renderizar página
  return <>{children}</>;
}

// ==========================================
// 🛡️ HOC PARA COMPONENTES
// ==========================================

export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string,
  getUserId: (props: P) => string
) {
  return function PermissionWrappedComponent(props: P) {
    const userId = getUserId(props);
    
    return (
      <PermissionGuard userId={userId} permission={permission}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}