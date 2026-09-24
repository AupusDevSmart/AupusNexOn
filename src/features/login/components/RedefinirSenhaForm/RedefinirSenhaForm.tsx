import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import {
  redefinirSenhaSchema,
  RedefinirSenhaFormData,
} from '../../schemas/redefinir-senha.schema';
import { useRedefinirSenha } from '../../hooks/useRedefinirSenha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { BOTAO_PRINCIPAL, CAMPO, LINK_DISCRETO, ROTULO } from '../estilo';

/**
 * Formulário de redefinição de senha.
 * Lê token e email da query string e define a nova senha.
 */
export function RedefinirSenhaForm() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const email = (searchParams.get('email') || '').trim();

  const { redefinir, isLoading, error } = useRedefinirSenha();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RedefinirSenhaFormData>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { novaSenha: '', confirmarSenha: '' },
  });

  const onSubmit = async (data: RedefinirSenhaFormData) => {
    await redefinir({
      email,
      token,
      novaSenha: data.novaSenha,
      confirmarSenha: data.confirmarSenha,
    });
  };

  // Link inválido: faltam token ou email na URL.
  if (!token || !email) {
    return (
      <div className="flex w-full max-w-sm flex-col space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white text-center">
            Link inválido
          </h2>
          <p className="text-sm text-white/60 text-center">
            Este link de redefinição é inválido ou está incompleto. Solicite um novo.
          </p>
        </div>
        <div className="mt-4">
          <Button
            asChild
            className={BOTAO_PRINCIPAL}
          >
            <Link to="/esqueci-senha">Solicitar novo link</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white text-center">
          Redefinir senha
        </h2>
        <p className="text-sm text-white/60 text-center">
          Defina uma nova senha para <span className="font-medium text-white">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="novaSenha" className={ROTULO}>Nova senha</Label>
            <div className="relative">
              <Input
                id="novaSenha"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                {...register('novaSenha')}
                className={`${CAMPO} pr-10 ${errors.novaSenha ? 'border-destructive' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                tabIndex={-1}
                disabled={isLoading}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.novaSenha && (
              <p className="text-sm text-destructive">{errors.novaSenha.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmarSenha" className={ROTULO}>Confirmar nova senha</Label>
            <Input
              id="confirmarSenha"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isLoading}
              {...register('confirmarSenha')}
              className={`${CAMPO} ${errors.confirmarSenha ? 'border-destructive' : ''}`}
            />
            {errors.confirmarSenha && (
              <p className="text-sm text-destructive">{errors.confirmarSenha.message}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col space-y-4">
          <Button
            type="submit"
            className={BOTAO_PRINCIPAL}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redefinindo...
              </>
            ) : (
              'Redefinir senha'
            )}
          </Button>

          <Link
            to="/login"
            className={LINK_DISCRETO}
          >
            Voltar ao login
          </Link>
        </div>
      </form>
    </div>
  );
}
