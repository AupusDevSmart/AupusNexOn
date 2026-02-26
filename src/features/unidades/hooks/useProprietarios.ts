// src/features/unidades/hooks/useProprietarios.ts

import { useState, useEffect } from 'react';
import { api } from '@/config/api';

export interface ProprietarioOption {
  id: string;
  nome: string;
}

interface UseProprietariosReturn {
  proprietarios: ProprietarioOption[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook para buscar TODOS os usuários que podem ser proprietários
 * (roles: proprietario, admin, super_admin)
 * Busca sem paginação para garantir que todos sejam carregados
 */
export function useProprietarios(): UseProprietariosReturn {
  const [proprietarios, setProprietarios] = useState<ProprietarioOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProprietarios = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 [useProprietarios] Buscando TODOS os usuários...');

        // Buscar TODOS os usuários ativos sem paginação (limit alto)
        const response = await api.get('/usuarios', {
          params: {
            limit: 1000, // Buscar até 1000 usuários
            includeInactive: false, // Apenas ativos
          },
        });

        console.log('📨 [useProprietarios] Resposta da API:', response.data);

        // Extrair dados da resposta
        const data = response.data?.data?.data || response.data?.data || response.data || [];

        console.log('🔍 [useProprietarios] Total de usuários retornados:', Array.isArray(data) ? data.length : 0);

        // Filtrar usuários com roles: proprietario, admin, super_admin
        const proprietariosFiltrados = data.filter((usuario: any) => {
          const roles = usuario.roles || [];

          const hasRole = roles.some((role: any) => {
            const roleName = typeof role === 'string' ? role : role?.name || '';
            return ['proprietario', 'admin', 'super_admin'].includes(roleName.toLowerCase());
          });

          return hasRole;
        });

        console.log('✅ [useProprietarios] Proprietários filtrados:', proprietariosFiltrados.length);

        // Mapear para formato esperado
        const proprietariosFormatados: ProprietarioOption[] = proprietariosFiltrados.map((usuario: any) => ({
          id: usuario.id,
          nome: usuario.nome,
        }));

        setProprietarios(proprietariosFormatados);
      } catch (err: any) {
        console.error('❌ [useProprietarios] Erro ao buscar proprietários:', err);
        setError(err.response?.data?.message || 'Erro ao carregar proprietários');
        setProprietarios([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProprietarios();
  }, []);

  return { proprietarios, loading, error };
}
