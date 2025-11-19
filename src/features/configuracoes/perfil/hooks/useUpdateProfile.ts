// src/features/configuracoes/perfil/hooks/useUpdateProfile.ts
import { useState } from 'react';
import { toast } from 'sonner';
import { profileService } from '@/services/profile.service';
import { AuthService } from '@/services/auth.service';
import { useUserStore } from '@/store/useUserStore';
import type { UpdateUsuarioDto, ChangePasswordDto } from '@/types/dtos/usuarios-dto';

export function useUpdateProfile() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const { user, setUser } = useUserStore();

  /**
   * Atualiza os dados do perfil
   */
  const updateProfile = async (data: UpdateUsuarioDto) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return { success: false };
    }

    setIsUpdating(true);
    try {
      const updatedUser = await profileService.updateProfile(user.id, data);

      // Atualizar o store com os novos dados
      setUser(updatedUser);

      toast.success('Perfil atualizado com sucesso!');
      return { success: true, data: updatedUser };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Erro ao atualizar perfil';

      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Altera a senha do usuário
   */
  const changePassword = async (data: ChangePasswordDto) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return { success: false };
    }

    setIsChangingPassword(true);
    try {
      await profileService.changePassword(user.id, data);
      toast.success('Senha alterada com sucesso!');
      return { success: true };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Erro ao alterar senha';

      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsChangingPassword(false);
    }
  };

  /**
   * Faz upload da imagem de perfil
   */
  const uploadProfileImage = async (file: File) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return { success: false };
    }

    setIsUploadingImage(true);
    try {
      console.log('📸 Iniciando upload de imagem para usuário:', user.id);
      const result = await profileService.uploadProfileImage(user.id, file);
      console.log('✅ Resposta do backend:', result);

      // O backend retorna { imageUrl: '/uploads/avatars/filename.jpg' }
      const newAvatarUrl = result.imageUrl || result.avatar_url;
      console.log('🖼️ Nova URL do avatar:', newAvatarUrl);

      if (newAvatarUrl) {
        // Atualiza o usuário no store com a nova URL do avatar
        const updatedUser = {
          ...user,
          avatar_url: newAvatarUrl
        };

        setUser(updatedUser);

        // Opcionalmente, tenta buscar os dados atualizados do servidor
        try {
          const freshUserData = await AuthService.getCurrentUser();
          if (freshUserData) {
            setUser(freshUserData);
          }
        } catch (err) {
          // Se falhar, mantém os dados atualizados localmente
          console.log('Usando dados locais atualizados');
        }
      }

      toast.success('Foto de perfil atualizada com sucesso!');
      return { success: true, imageUrl: newAvatarUrl };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Erro ao fazer upload da foto';

      console.error('Erro no upload:', error.response?.data || error);

      // Mensagens específicas baseadas no erro
      if (error.response?.status === 404) {
        toast.error('Usuário não encontrado');
      } else if (error.response?.status === 413) {
        toast.error('Arquivo muito grande. Máximo permitido: 2MB');
      } else if (error.response?.status === 415) {
        toast.error('Tipo de arquivo não permitido. Use JPG, PNG ou GIF');
      } else {
        toast.error(errorMessage);
      }

      return { success: false, error: errorMessage };
    } finally {
      setIsUploadingImage(false);
    }
  };

  return {
    updateProfile,
    changePassword,
    uploadProfileImage,
    isUpdating,
    isChangingPassword,
    isUploadingImage,
  };
}
