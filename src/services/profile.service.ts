// src/services/profile.service.ts
import { api } from '@/config/api';
import type { UpdateUsuarioDto, ChangePasswordDto } from '@/types/dtos/usuarios-dto';

export class ProfileService {
  /**
   * Atualiza os dados do perfil do usuário
   */
  async updateProfile(userId: string, data: UpdateUsuarioDto): Promise<any> {
    try {
      const response = await api.patch(`/usuarios/${userId}`, data);
      // Backend retorna { success: true, data: {...}, meta: {...} }
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  }

  /**
   * Altera a senha do usuário
   */
  async changePassword(userId: string, data: ChangePasswordDto): Promise<void> {
    try {
      const response = await api.patch(`/usuarios/${userId}/change-password`, data);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      throw error;
    }
  }

  /**
   * Faz upload da foto de perfil
   */
  async uploadProfileImage(userId: string, file: File): Promise<{ imageUrl: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/usuarios/${userId}/upload-avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Erro ao fazer upload da imagem:', error);
      throw error;
    }
  }
}

export const profileService = new ProfileService();
