import { z } from 'zod';

/**
 * Schema de validação do formulário de redefinição de senha.
 * Exige nova senha (mínimo 6) e confirmação igual.
 */
export const redefinirSenhaSchema = z
  .object({
    novaSenha: z
      .string()
      .min(1, 'Senha é obrigatória')
      .min(6, 'A senha deve ter no mínimo 6 caracteres'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: 'As senhas não conferem',
    path: ['confirmarSenha'],
  });

export type RedefinirSenhaFormData = z.infer<typeof redefinirSenhaSchema>;
