import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '@/services/auth.service';
import { formatApiError } from '@/utils/api-error';
import { toast } from 'sonner';

interface RedefinirSenhaPayload {
  email: string;
  token: string;
  novaSenha: string;
  confirmarSenha: string;
}

/**
 * Hook para concluir a redefinição de senha com o token recebido por email.
 * Em caso de sucesso, redireciona para o login.
 */
export function useRedefinirSenha() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const redefinir = async (payload: RedefinirSenhaPayload) => {
    setIsLoading(true);
    setError(null);

    try {
      await AuthService.resetPassword(payload);

      toast.success('Senha redefinida com sucesso!', {
        description: 'Faça login com a sua nova senha.',
      });

      navigate('/login', { replace: true });
    } catch (err) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);

      toast.error('Erro ao redefinir senha', {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { redefinir, isLoading, error };
}
