import { LoginForm } from '@/features/login/components/LoginForm/LoginForm';
import { LoginBanner } from '@/features/login/components/LoginBanner/LoginBanner';
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';

/**
 * Página de Login
 * Layout responsivo com banner lateral (desktop) e formulário centralizado
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
    <div className="h-screen w-screen bg-card text-card-foreground flex flex-col lg:flex-row overflow-hidden">
      {/* Banner lateral - visível apenas em desktop */}
      <LoginBanner
        bannerSrc="/aupussmart.png"
        subtitle="Interligando você com o futuro. Energize-se."
      />

      {/* Área do formulário - centralizada */}
      <div className="flex flex-col justify-center items-center flex-1 p-4 overflow-y-auto">
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
