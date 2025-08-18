import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { ImagePlus, User, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: 'Nome deve ter pelo menos 2 caracteres.',
    })
    .max(30, {
      message: 'Nome não deve ter mais que 30 caracteres.',
    }),
  cpf: z
    .string()
    .min(11, {
      message: 'CPF inválido.',
    })
    .max(14, {
      message: 'CPF inválido.',
    }),
  email: z
    .string()
    .email({
      message: 'Email inválido.',
    }),
  phone: z
    .string()
    .min(10, {
      message: 'Telefone inválido.',
    })
    .max(15, {
      message: 'Telefone inválido.',
    }),
  password: z
    .string()
    .min(8, {
      message: 'Senha deve ter pelo menos 8 caracteres.',
    })
    .optional(),
  newPassword: z
    .string()
    .min(8, {
      message: 'Nova senha deve ter pelo menos 8 caracteres.',
    })
    .optional(),
  confirmPassword: z
    .string()
    .optional(),
  image: z
    .instanceof(FileList)
    .refine(files => files.length === 0 || files.length === 1, {
      message: 'Por favor, selecione uma imagem.',
    })
    .transform(files => files.length > 0 ? files[0] : null)
    .optional(),
}).refine((data) => {
  if (data.newPassword && !data.password) {
    return false;
  }
  return true;
}, {
  message: "Senha atual é obrigatória para alterar a senha",
  path: ["password"],
}).refine((data) => {
  if (data.newPassword && data.confirmPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "As senhas não correspondem",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>

// Dados iniciais (podem vir do banco de dados ou API)
const defaultValues: Partial<ProfileFormValues> = {
  name: 'João Silva',
  cpf: '123.456.789-00',
  email: 'joao.silva@email.com',
  phone: '(11) 98765-4321',
}

export function AccountForm() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
  })

  function onSubmit(data: ProfileFormValues) {
    // Ação mockada
    toast({
      title: 'Você enviou os seguintes valores:',
      description: (
        <pre className='mt-2 w-[340px] rounded-md bg-slate-950 p-4'>
          <code className='text-white'>
            {JSON.stringify({
              name: data.name,
              cpf: data.cpf,
              email: data.email,
              phone: data.phone,
              passwordChanged: !!data.newPassword,
              image: data.image ? data.image.name : null
            }, null, 2)}
          </code>
        </pre>
      ),
    })
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      //@ts-ignore
      form.setValue('image', e.target.files as FileList)
    }
  }

  const togglePasswordVisibility = (field: 'password' | 'newPassword' | 'confirmPassword') => {
    if (field === 'password') {
      setShowPassword(!showPassword)
    } else if (field === 'newPassword') {
      setShowNewPassword(!showNewPassword)
    } else {
      setShowConfirmPassword(!showConfirmPassword)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
        <div className="flex flex-col gap-6">
          <div className="w-full">
            <Card>
              <CardHeader>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>
                  Gerencie suas informações de perfil.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name='image'
                  render={() => (
                    <FormItem>
                      <FormLabel>Imagem de Perfil</FormLabel>
                      <FormControl>
                        <div className='flex flex-col items-center gap-4'>
                          <div className='relative w-32 h-32 rounded-full overflow-hidden bg-muted'>
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt="Preview"
                                className='w-full h-full object-cover'
                              />
                            ) : (
                              <div className='w-full h-full flex items-center justify-center'>
                                <User className='h-16 w-16 text-muted-foreground' />
                              </div>
                            )}
                          </div>
                          <div className='flex items-center'>
                            <label htmlFor='image-upload' className='cursor-pointer'>
                              <div className='flex items-center gap-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90'>
                                <ImagePlus className='h-4 w-4' />
                                <span className='text-sm'>Alterar imagem</span>
                              </div>
                              <input
                                id='image-upload'
                                type='file'
                                accept='image/*'
                                className='hidden'
                                onChange={handleImageChange}
                              />
                            </label>
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        A imagem deve ser no formato JPG, PNG ou GIF com tamanho máximo de 2MB.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-1/2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Informações Pessoais</CardTitle>
                  <CardDescription>
                    Atualize suas informações pessoais.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder='Seu nome' {...field} />
                        </FormControl>
                        <FormDescription>
                          Este é o nome que será exibido no seu perfil.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='cpf'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input placeholder='123.456.789-00' {...field} />
                        </FormControl>
                        <FormDescription>
                          Seu CPF será usado apenas para fins de identificação.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="w-full lg:w-1/2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Contato</CardTitle>
                  <CardDescription>
                    Atualize suas informações de contato.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name='email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder='seu.email@exemplo.com' {...field} />
                        </FormControl>
                        <FormDescription>
                          Este email será usado para comunicações importantes.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='phone'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder='(11) 98765-4321' {...field} />
                        </FormControl>
                        <FormDescription>
                          Seu telefone para contato.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="w-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>
                  Altere sua senha para manter sua conta segura.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha Atual</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder='••••••••'
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                            onClick={() => togglePasswordVisibility('password')}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Digite sua senha atual para confirmar alterações.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='newPassword'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            placeholder='••••••••'
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                            onClick={() => togglePasswordVisibility('newPassword')}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        A nova senha deve ter pelo menos 8 caracteres.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='confirmPassword'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nova Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder='••••••••'
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                            onClick={() => togglePasswordVisibility('confirmPassword')}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Confirme sua nova senha.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>


          <Button type='submit' className="w-auto rounded-sm bg-card-foreground text-card">Atualizar perfil</Button>
        </div>
      </form>
    </Form>
  )
}