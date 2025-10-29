// src/hooks/useRoles.ts

import { useState, useEffect } from 'react';
import { api } from '@/config/api';

export interface Role {
  value: string;
  label: string;
  description?: string;
}

interface UseRolesReturn {
  roles: Role[];
  loading: boolean;
  error: string | null;
}

export function useRoles(): UseRolesReturn {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 [useRoles] Iniciando busca de roles...');

        // Try to fetch roles from the backend
        const response = await api.get('/roles');

        console.log('📨 [useRoles] Resposta raw da API:', {
          status: response.status,
          dataType: typeof response.data,
          dataKeys: response.data ? Object.keys(response.data) : [],
          hasSuccess: !!response.data.success,
          hasData: !!response.data.data,
          dataPreview: response.data
        });

        const data = response.data?.data || response.data || [];

        console.log('🔍 [useRoles] Dados extraídos:', {
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : 0,
          firstItem: Array.isArray(data) ? data[0] : data
        });

        // Mapeamento de nomes técnicos para labels amigáveis
        const labelMapping: Record<string, string> = {
          'super_admin': 'Super Administrador',
          'admin': 'Administrador',
          'gerente': 'Gerente',
          'vendedor': 'Vendedor',
          'consultor': 'Consultor',
          'proprietario': 'Proprietário',
          'corretor': 'Corretor',
          'cativo': 'Cativo',
          'associado': 'Associado',
        };

        // Transform backend data to expected format
        const formattedRoles = data.map((role: any) => ({
          value: role.name || role.value || role.id,
          label: role.label || role.display_name || labelMapping[role.name] || role.name || role.value,
          description: role.description || `Role ${role.name}`,
        }));

        console.log('✅ [useRoles] Roles formatados:', formattedRoles);

        setRoles(formattedRoles);
      } catch (err: any) {
        console.error('❌ [useRoles] Erro ao buscar roles:', err);
        console.error('❌ [useRoles] Detalhes do erro:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });

        // Fallback to default roles if API fails
        const defaultRoles: Role[] = [
          { value: 'admin', label: 'Administrador', description: 'Acesso total ao sistema' },
          { value: 'gerente', label: 'Gerente', description: 'Gerenciamento de equipes e projetos' },
          { value: 'vendedor', label: 'Vendedor', description: 'Acesso a vendas e clientes' },
          { value: 'consultor', label: 'Consultor', description: 'Acesso de consulta' },
        ];

        setRoles(defaultRoles);
        setError(err.response?.data?.message || 'Usando roles padrão');

        console.warn('⚠️ [useRoles] Usando roles padrão como fallback');
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  return { roles, loading, error };
}
