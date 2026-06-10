import { EsqueciSenhaForm } from '@/features/login/components/EsqueciSenhaForm/EsqueciSenhaForm';
import { LoginBanner } from '@/features/login/components/LoginBanner/LoginBanner';
import { useTheme } from '@/components/theme-provider';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Página "Esqueci minha senha".
 * Reaproveita o layout da tela de login (banner lateral + toggle de tema).
 */
export function EsqueciSenhaPage() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col lg:flex-row overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 hover:bg-accent"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <LoginBanner
        bannerSrc="/logoaupus.svg"
        subtitle="Interligando você com o futuro. Energize-se."
      />

      <div className="flex flex-col justify-center items-center flex-1 p-4 overflow-y-auto">
        <EsqueciSenhaForm />
      </div>
    </div>
  );
}
