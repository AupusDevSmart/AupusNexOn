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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

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
      <Card className="w-full max-w-md mx-4 shadow-lg border-border bg-card">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl font-semibold text-center text-foreground">
            Link inválido
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Este link de redefinição é inválido ou está incompleto. Solicite um novo.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            asChild
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            <Link to="/esqueci-senha">Solicitar novo link</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-4 shadow-lg border-border bg-card">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-2xl font-semibold text-center text-foreground">
          Redefinir senha
        </CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Defina uma nova senha para <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="novaSenha">Nova senha</Label>
            <div className="relative">
              <Input
                id="novaSenha"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                {...register('novaSenha')}
                className={errors.novaSenha ? 'border-destructive pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
            <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
            <Input
              id="confirmarSenha"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isLoading}
              {...register('confirmarSenha')}
              className={errors.confirmarSenha ? 'border-destructive' : ''}
            />
            {errors.confirmarSenha && (
              <p className="text-sm text-destructive">{errors.confirmarSenha.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-foreground text-background hover:bg-foreground/90"
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
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Voltar ao login
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
