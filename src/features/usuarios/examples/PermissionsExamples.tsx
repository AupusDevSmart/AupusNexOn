// src/features/usuarios/examples/PermissionsExamples.tsx
// ⚠️ ARQUIVO DE EXEMPLO - NÃO USAR EM PRODUÇÃO
// Este arquivo demonstra como usar o sistema de permissões

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Imports do sistema de permissões
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { PermissionGuard, MultiplePermissionGuard, PagePermissionGuard } from '@/components/guards/PermissionGuard';
import { PermissionManager } from '../components/PermissionManager';
import { PermissionSummaryCard } from '../components/PermissionSummaryCard';
import { useCurrentUserPermission, CurrentUserPermissionGuard } from '@/contexts/AuthPermissionsContext';

// Mock de usuário para exemplo
const mockUsuario = {
  id: '123',
  nome: 'João Silva',
  email: 'joao@email.com'
} as any;

// ==========================================
// 📘 EXEMPLO 1: USO BÁSICO DE HOOKS
// ==========================================

export function BasicHookExample() {
  const {
    permissions,
    summary,
    loading,
    error,
    hasPermission,
    checkPermission,
    assignRole,
    syncPermissions
  } = useUserPermissions({
    userId: '123',
    autoLoad: true
  });

  const handleCheckPermission = async () => {
    const result = await checkPermission('Dashboard');
    console.log('Usuário tem permissão Dashboard:', result);
  };

  const handleAssignRole = async () => {
    try {
      await assignRole(2); // ID do role de vendedor
      console.log('Role atribuída com sucesso!');
    } catch (error) {
      console.error('Erro ao atribuir role:', error);
    }
  };

  if (loading) return <div>Carregando permissões...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exemplo: Hook básico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Exibir resumo */}
        <div>
          <strong>Total de permissões:</strong> {summary?.totalPermissions || 0}
        </div>
        
        {/* Verificação síncrona */}
        <div>
          <strong>Tem Dashboard:</strong> {hasPermission('Dashboard') ? '✅' : '❌'}
        </div>
        
        {/* Ações */}
        <div className="flex gap-2">
          <Button onClick={handleCheckPermission}>
            Verificar Dashboard (async)
          </Button>
          <Button onClick={handleAssignRole}>
            Atribuir Role Vendedor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// 🛡️ EXEMPLO 2: GUARDS DE COMPONENTE
// ==========================================

export function ComponentGuardExample() {
  return (
    <div className="space-y-4">
      {/* Guard para uma permissão */}
      <PermissionGuard userId="123" permission="Dashboard">
        <Card>
          <CardContent className="pt-6">
            <h3>🎯 Conteúdo protegido por Dashboard</h3>
            <p>Só aparece se usuário tem permissão "Dashboard"</p>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* Guard para múltiplas permissões */}
      <MultiplePermissionGuard 
        userId="123" 
        permissions={['Usuarios', 'Configuracoes']} 
        mode="any"
      >
        <Card>
          <CardContent className="pt-6">
            <h3>👥 Conteúdo de Administração</h3>
            <p>Aparece se tem "Usuarios" OU "Configuracoes"</p>
          </CardContent>
        </Card>
      </MultiplePermissionGuard>

      {/* Guard com fallback customizado */}
      <PermissionGuard 
        userId="123" 
        permission="SuperAdmin"
        fallback={
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <h3>🚫 Acesso Restrito</h3>
              <p>Você precisa ser Super Admin para ver este conteúdo</p>
            </CardContent>
          </Card>
        }
      >
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <h3>👑 Área Super Admin</h3>
            <p>Conteúdo exclusivo para super admins</p>
          </CardContent>
        </Card>
      </PermissionGuard>
    </div>
  );
}

// ==========================================
// 🔐 EXEMPLO 3: CONTEXTO DE USUÁRIO ATUAL
// ==========================================

export function CurrentUserExample() {
  // Hook para usuário autenticado atual
  const { hasPermission, checkPermission } = useCurrentUserPermission('Dashboard');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exemplo: Usuário Atual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Guard para usuário atual */}
        <CurrentUserPermissionGuard permission="Dashboard">
          <div className="p-4 bg-green-50 rounded">
            ✅ Você tem acesso ao Dashboard!
          </div>
        </CurrentUserPermissionGuard>
        
        <CurrentUserPermissionGuard 
          permission="SuperAdmin"
          fallback={
            <div className="p-4 bg-red-50 rounded">
              ❌ Você não é Super Admin
            </div>
          }
        >
          <div className="p-4 bg-blue-50 rounded">
            👑 Área Super Admin
          </div>
        </CurrentUserPermissionGuard>
      </CardContent>
    </Card>
  );
}

// ==========================================
// 📊 EXEMPLO 4: COMPONENTES DE GESTÃO
// ==========================================

export function ManagementComponentsExample() {
  return (
    <div className="space-y-6">
      {/* Card de resumo */}
      <PermissionSummaryCard 
        usuario={mockUsuario}
        showDetails={true}
        onClick={() => console.log('Clicou no card de permissões')}
      />

      {/* Manager completo */}
      <PermissionManager 
        usuario={mockUsuario}
        onUpdate={() => console.log('Permissões atualizadas!')}
        readonly={false}
        compact={false}
      />
    </div>
  );
}

// ==========================================
// 🚪 EXEMPLO 5: GUARD DE PÁGINA
// ==========================================

export function PageGuardExample() {
  return (
    <PagePermissionGuard userId="123" permission="Configuracoes">
      <div className="min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-6">Configurações do Sistema</h1>
        <p>Esta página inteira está protegida pela permissão "Configuracoes"</p>
        
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4">Configurações Avançadas</h2>
            <p>Conteúdo sensível que apenas usuários com permissão podem ver.</p>
          </CardContent>
        </Card>
      </div>
    </PagePermissionGuard>
  );
}

// ==========================================
// 🎯 EXEMPLO 6: USO EM MENU DINÂMICO
// ==========================================

interface MenuItem {
  title: string;
  permission: string;
  component: React.ReactNode;
}

const menuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    permission: 'Dashboard',
    component: <div>Conteúdo do Dashboard</div>
  },
  {
    title: 'Usuários',
    permission: 'Usuarios',
    component: <div>Gestão de Usuários</div>
  },
  {
    title: 'Configurações',
    permission: 'Configuracoes',
    component: <div>Configurações do Sistema</div>
  }
];

export function DynamicMenuExample() {
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Menu Dinâmico Baseado em Permissões</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tabs - só mostra se usuário tem permissão */}
        <div className="flex gap-2 mb-4">
          {menuItems.map((item, index) => (
            <PermissionGuard key={item.title} userId="123" permission={item.permission}>
              <Button
                variant={activeTab === index ? 'default' : 'outline'}
                onClick={() => setActiveTab(index)}
              >
                {item.title}
              </Button>
            </PermissionGuard>
          ))}
        </div>

        {/* Conteúdo da aba ativa */}
        <div className="border rounded p-4">
          <PermissionGuard userId="123" permission={menuItems[activeTab].permission}>
            {menuItems[activeTab].component}
          </PermissionGuard>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// 📱 COMPONENTE PRINCIPAL COM TODOS OS EXEMPLOS
// ==========================================

export function PermissionsExamplesPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🔐 Sistema de Permissões</h1>
        <p className="text-muted-foreground">
          Exemplos de uso do sistema integrado de roles e permissions
        </p>
      </div>

      <div className="grid gap-6">
        <BasicHookExample />
        <ComponentGuardExample />
        <CurrentUserExample />
        <ManagementComponentsExample />
        <DynamicMenuExample />
      </div>

      <div className="mt-12 p-6 bg-blue-50 rounded-lg border-blue-200">
        <h2 className="text-lg font-semibold mb-2 text-blue-900">
          🚀 Próximos Passos
        </h2>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>1. Configure o AuthPermissionsProvider no App.tsx</li>
          <li>2. Use os guards em suas rotas e componentes</li>
          <li>3. Teste o PermissionManager nos modais de usuário</li>
          <li>4. Implemente verificações de permissão em ações sensíveis</li>
        </ul>
      </div>
    </div>
  );
}