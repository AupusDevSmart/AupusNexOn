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
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { BOTAO_PRINCIPAL, CAMPO, LINK_DISCRETO, ROTULO } from '../estilo';

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
      <div className="flex w-full max-w-sm flex-col space-y-6">
        <div className="space-y-3 items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <MailCheck className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white">
            Verifique seu email
          </h2>
          <p className="text-sm text-white/60">
            Se <span className="font-medium text-white">{getValues('email')}</span> estiver
            cadastrado, enviamos um link para redefinir sua senha. O link expira em 60 minutos.
          </p>
        </div>
        <div className="mt-4">
          <Button asChild variant="outline" className="h-11 w-full rounded-xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao login
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white text-center">
          Esqueceu a senha?
        </h2>
        <p className="text-sm text-white/60 text-center">
          Informe seu email e enviaremos um link para redefinir sua senha
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className={ROTULO}>Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@exemplo.com"
              autoComplete="email"
              disabled={isLoading}
              {...register('email')}
              className={`${CAMPO} ${errors.email ? 'border-destructive' : ''}`}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
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
                Enviando...
              </>
            ) : (
              'Enviar link de redefinição'
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
