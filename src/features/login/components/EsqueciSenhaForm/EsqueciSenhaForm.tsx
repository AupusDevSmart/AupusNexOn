import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import {
  esqueciSenhaSchema,
  EsqueciSenhaFormData,
} from '../../schemas/esqueci-senha.schema';
import { useEsqueciSenha } from '../../hooks/useEsqueciSenha';
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
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';

/**
 * Formulário de "esqueci minha senha".
 * Solicita o email e, após o envio, exibe um estado de confirmação genérico.
 */
export function EsqueciSenhaForm() {
  const { solicitar, isLoading, enviado } = useEsqueciSenha();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<EsqueciSenhaFormData>({
    resolver: zodResolver(esqueciSenhaSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: EsqueciSenhaFormData) => {
    await solicitar(data.email);
  };

  if (enviado) {
    return (
      <Card className="w-full max-w-md mx-4 shadow-lg border-border bg-card">
        <CardHeader className="space-y-3 pb-6 items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MailCheck className="h-6 w-6 text-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold text-foreground">
            Verifique seu email
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Se <span className="font-medium text-foreground">{getValues('email')}</span> estiver
            cadastrado, enviamos um link para redefinir sua senha. O link expira em 60 minutos.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-4 shadow-lg border-border bg-card">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-2xl font-semibold text-center text-foreground">
          Esqueceu a senha?
        </CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Informe seu email e enviaremos um link para redefinir sua senha
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@exemplo.com"
              autoComplete="email"
              disabled={isLoading}
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
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
                Enviando...
              </>
            ) : (
              'Enviar link de redefinição'
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
