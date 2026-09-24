import { EsqueciSenhaForm } from '@/features/login/components/EsqueciSenhaForm/EsqueciSenhaForm';
import { LoginLayout } from '@/features/login/components/LoginBanner/LoginBanner';

/**
 * Página "Esqueci minha senha".
 * Reaproveita o layout da tela de login.
 */
export function EsqueciSenhaPage() {
  return (
    <LoginLayout>
      <EsqueciSenhaForm />
    </LoginLayout>
  );
}
