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

        // Try to fetch roles from the backend
        const response = await api.get('/roles');

        const data = response.data?.data || response.data || [];

        // Transform backend data to expected format
        const formattedRoles = data.map((role: any) => ({
          value: role.name || role.value || role.id,
          label: role.label || role.display_name || role.name || role.value,
          description: role.description,
        }));

        setRoles(formattedRoles);
      } catch (err: any) {
        console.error('Erro ao buscar roles:', err);

        // Fallback to default roles if API fails
        const defaultRoles: Role[] = [
          { value: 'admin', label: 'Administrador', description: 'Acesso total ao sistema' },
          { value: 'gerente', label: 'Gerente', description: 'Gerenciamento de equipes e projetos' },
          { value: 'vendedor', label: 'Vendedor', description: 'Acesso a vendas e clientes' },
          { value: 'consultor', label: 'Consultor', description: 'Acesso de consulta' },
        ];

        setRoles(defaultRoles);
        setError(err.response?.data?.message || 'Usando roles padrão');
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  return { roles, loading, error };
}
