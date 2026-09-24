import { RedefinirSenhaForm } from '@/features/login/components/RedefinirSenhaForm/RedefinirSenhaForm';
import { LoginLayout } from '@/features/login/components/LoginBanner/LoginBanner';

/**
 * Página de redefinição de senha (acessada pelo link do email).
 * Reaproveita o layout da tela de login.
 */
export function RedefinirSenhaPage() {
  return (
    <LoginLayout>
      <RedefinirSenhaForm />
    </LoginLayout>
  );
}
