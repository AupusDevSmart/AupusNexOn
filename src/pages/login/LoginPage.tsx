import { LoginForm } from '@/features/login/components/LoginForm/LoginForm';
import { LoginBanner } from '@/features/login/components/LoginBanner/LoginBanner';
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useTheme } from '@/components/theme-provider';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Página de Login
 * Layout responsivo com banner lateral (desktop) e formulário centralizado
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { theme, setTheme } = useTheme();

  // Se já estiver autenticado, redireciona automaticamente
  useEffect(() => {
    if (user?.id) {
      console.log('✅ [LOGIN PAGE] Usuário já autenticado, redirecionando...');
      navigate(redirectTo, { replace: true });
    }
  }, [user, redirectTo, navigate]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col lg:flex-row overflow-hidden">
      {/* Botão de toggle de tema - canto superior direito */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 hover:bg-accent"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>

      {/* Banner lateral - visível apenas em desktop */}
      <LoginBanner
        bannerSrc="/logoaupus.svg"
        subtitle="Interligando você com o futuro. Energize-se."
      />

      {/* Área do formulário - centralizada */}
      <div className="flex flex-col justify-center items-center flex-1 p-4 overflow-y-auto">
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
