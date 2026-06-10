import { useState } from 'react';
import { AuthService } from '@/services/auth.service';
import { formatApiError } from '@/utils/api-error';
import { toast } from 'sonner';

/**
 * Hook para solicitar a redefinição de senha.
 * O backend sempre responde de forma genérica, então em caso de sucesso
 * apenas exibimos a mensagem de "verifique seu email".
 */
export function useEsqueciSenha() {
  const [isLoading, setIsLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const solicitar = async (email: string) => {
    setIsLoading(true);

    try {
      await AuthService.forgotPassword(email);
      setEnviado(true);
    } catch (err) {
      toast.error('Erro ao solicitar redefinição', {
        description: formatApiError(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { solicitar, isLoading, enviado };
}
