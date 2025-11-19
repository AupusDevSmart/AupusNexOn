import { z } from 'zod';

/**
 * Schema de validação para o formulário de login
 * Utiliza Zod para validação robusta e type-safe
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  senha: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

/**
 * Type inferido do schema Zod
 * Usado pelo React Hook Form
 */
export type LoginFormData = z.infer<typeof loginSchema>;
