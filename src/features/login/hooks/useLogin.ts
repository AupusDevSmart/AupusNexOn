import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '@/services/auth.service';
import { useUserStore } from '@/store/useUserStore';
import { LoginDto } from '@/types/dtos/auth-dto';
import { toast } from 'sonner';

/**
 * Hook para gerenciar o processo de login
 * Encapsula a lógica de autenticação, navegação e atualização do store
 */
export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setUser } = useUserStore();

  /**
   * Realiza login
   * @param credentials Credenciais de login (email e senha)
   * @param redirectTo URL para redirecionar após login (padrão: /dashboard)
   */
  const login = async (credentials: LoginDto, redirectTo: string = '/dashboard') => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔐 [USE LOGIN] Iniciando login...');

      // Chama o serviço de autenticação
      const response = await AuthService.login(credentials);

      console.log('✅ [USE LOGIN] Login bem-sucedido');
      console.log('📦 [USE LOGIN] Resposta:', response);

      // Verifica se recebeu os dados do usuário
      if (!response.user) {
        throw new Error('Dados do usuário não foram retornados pelo servidor');
      }

      // Extrai permissões (all_permissions pode ser array ou undefined)
      const permissoes = Array.isArray(response.user.all_permissions)
        ? response.user.all_permissions.map((p) => p.name)
        : [];

      // Atualiza o store com dados do usuário e permissões
      setUser({
        ...response.user,
        acessivel: permissoes,
      } as any);

      // Exibe mensagem de sucesso
      toast.success('Login realizado com sucesso!', {
        description: `Bem-vindo(a), ${response.user.nome || 'Usuário'}!`,
      });

      // Redireciona para a página desejada
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      console.error('❌ [USE LOGIN] Erro ao fazer login:', err);

      // Extrai mensagem de erro da resposta do backend
      const errorMessage =
        err.response?.data?.error?.message ||  // Formato padrão do backend
        err.response?.data?.message ||          // Formato alternativo
        err.message ||                          // Mensagem do erro
        'Erro ao fazer login. Tente novamente.';

      setError(errorMessage);

      // Exibe toast de erro com a mensagem
      toast.error('Erro ao fazer login', {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login,
    isLoading,
    error,
  };
}
