import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { loginSchema, LoginFormData } from '../../schemas/login.schema';
import { useLogin } from '../../hooks/useLogin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { BOTAO_PRINCIPAL, CAMPO, LINK_DISCRETO, ROTULO } from '../estilo';

interface LoginFormProps {
  redirectTo?: string;
}

/**
 * Componente de formulário de login
 * Inclui validação com Zod, feedback de erros e toggle de senha
 */
export function LoginForm({ redirectTo = '/dashboard' }: LoginFormProps) {
  const { login, isLoading, error } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      senha: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    await login(data as any, redirectTo);
  };

  return (
    <div className="flex w-full max-w-sm flex-col space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Faça login na sua conta</h2>
        <p className="text-sm text-white/60">Entre com seu e-mail e senha para logar</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        {/* Alerta de erro global */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className={ROTULO}>E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="voce@empresa.com.br"
            autoComplete="email"
            disabled={isLoading}
            {...register('email')}
            className={`${CAMPO} ${errors.email ? 'border-destructive' : ''}`}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="senha" className={ROTULO}>Senha</Label>
          <div className="relative">
            <Input
              id="senha"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              {...register('senha')}
              className={`${CAMPO} pr-10 ${errors.senha ? 'border-destructive' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center text-white/50 hover:text-white"
              tabIndex={-1}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.senha && (
            <p className="text-sm text-destructive">{errors.senha.message}</p>
          )}
        </div>

        <Button type="submit" className={BOTAO_PRINCIPAL} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>

        <div className="text-center">
          <Link to="/esqueci-senha" className={LINK_DISCRETO}>
            Esqueceu sua senha?
          </Link>
        </div>
      </form>
    </div>
  );
}
