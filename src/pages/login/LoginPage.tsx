import { LoginForm } from '@/features/login/components/LoginForm/LoginForm';
import { LoginLayout } from '@/features/login/components/LoginBanner/LoginBanner';
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';

/**
 * Página de Login, no mesmo layout do Smart Nexus: painel da marca à
 * esquerda (desktop) e formulário sobre o azul NexON.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const navigate = useNavigate();
  const { user } = useUserStore();

  // Se já estiver autenticado, redireciona automaticamente
  useEffect(() => {
    if (user?.id) {
      console.log('✅ [LOGIN PAGE] Usuário já autenticado, redirecionando...');
      navigate(redirectTo, { replace: true });
    }
  }, [user, redirectTo, navigate]);

  return (
    <LoginLayout>
      <LoginForm redirectTo={redirectTo} />
    </LoginLayout>
  );
}
