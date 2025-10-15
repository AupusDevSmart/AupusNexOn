// src/hooks/usePermissoes.ts

import { useState, useEffect } from 'react';
import { api } from '@/config/api';

export interface Permissao {
  value: string;
  label: string;
  description?: string;
  category?: string;
}

export interface PermissoesPorCategoria {
  [categoria: string]: Permissao[];
}

interface UsePermissoesReturn {
  permissoes: Permissao[];
  permissoesPorCategoria: PermissoesPorCategoria;
  loading: boolean;
  error: string | null;
}

interface UsePermissoesGroupedReturn {
  permissoesPorCategoria: PermissoesPorCategoria;
  loading: boolean;
  error: string | null;
}

/**
 * Hook para buscar todas as permissões disponíveis
 */
export function usePermissoes(): UsePermissoesReturn {
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [permissoesPorCategoria, setPermissoesPorCategoria] = useState<PermissoesPorCategoria>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissoes = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get('/permissions');

        const data = response.data?.data || response.data || [];

        // Transform backend data to expected format
        const formattedPermissoes: Permissao[] = data.map((perm: any) => ({
          value: perm.name || perm.value || perm.id,
          label: perm.label || perm.display_name || perm.name || perm.value,
          description: perm.description,
          category: perm.category || categorizePermission(perm.name || perm.value),
        }));

        setPermissoes(formattedPermissoes);

        // Group by category
        const grouped = groupPermissionsByCategory(formattedPermissoes);
        setPermissoesPorCategoria(grouped);
      } catch (err: any) {
        console.error('Erro ao buscar permissões:', err);
        setError(err.response?.data?.message || 'Erro ao carregar permissões');

        // Set default empty state
        setPermissoes([]);
        setPermissoesPorCategoria({});
      } finally {
        setLoading(false);
      }
    };

    fetchPermissoes();
  }, []);

  return { permissoes, permissoesPorCategoria, loading, error };
}

/**
 * Hook otimizado para buscar permissões já agrupadas por categoria do backend
 */
export function usePermissoesGrouped(): UsePermissoesGroupedReturn {
  const [permissoesPorCategoria, setPermissoesPorCategoria] = useState<PermissoesPorCategoria>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissoesGrouped = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch grouped permissions from optimized endpoint
        let response;
        try {
          response = await api.get('/permissions/grouped');
        } catch {
          // Fallback to regular endpoint if grouped endpoint doesn't exist
          response = await api.get('/permissions');
        }

        const data = response.data?.data || response.data || [];

        // If data is already grouped (object with categories)
        if (!Array.isArray(data) && typeof data === 'object') {
          // Transform each category's permissions
          const grouped: PermissoesPorCategoria = {};
          for (const [category, perms] of Object.entries(data)) {
            grouped[category] = (perms as any[]).map((perm: any) => ({
              value: perm.name || perm.value || perm.id,
              label: perm.label || perm.display_name || perm.name || perm.value,
              description: perm.description,
              category,
            }));
          }
          setPermissoesPorCategoria(grouped);
        } else {
          // If data is flat array, group it client-side
          const formattedPermissoes: Permissao[] = data.map((perm: any) => ({
            value: perm.name || perm.value || perm.id,
            label: perm.label || perm.display_name || perm.name || perm.value,
            description: perm.description,
            category: perm.category || categorizePermission(perm.name || perm.value),
          }));

          const grouped = groupPermissionsByCategory(formattedPermissoes);
          setPermissoesPorCategoria(grouped);
        }
      } catch (err: any) {
        console.error('Erro ao buscar permissões agrupadas:', err);
        setError(err.response?.data?.message || 'Erro ao carregar permissões');
        setPermissoesPorCategoria({});
      } finally {
        setLoading(false);
      }
    };

    fetchPermissoesGrouped();
  }, []);

  return { permissoesPorCategoria, loading, error };
}

/**
 * Helper function to categorize a permission based on its name
 */
function categorizePermission(permissionName: string): string {
  const name = permissionName.toLowerCase();

  // Define category patterns
  const categories: Record<string, string[]> = {
    'Painel Geral': ['painelgeral', 'dashboard', 'painel'],
    'Usuários': ['usuario', 'user', 'gerenciar_usuarios'],
    'Organizações': ['organizacao', 'organization', 'empresas'],
    'Plantas': ['planta', 'plant', 'usina'],
    'Unidades': ['unidade', 'unit', 'consumidora'],
    'Concessionárias': ['concessionaria', 'utility'],
    'Supervisório': ['supervisorio', 'supervisory', 'sinoptico', 'mapa_de_calor'],
    'Análises': ['analise', 'analysis', 'relatorio', 'report'],
    'Configurações': ['configuracao', 'config', 'settings'],
    'Sistema': ['sistema', 'system', 'admin'],
  };

  // Find matching category
  for (const [category, patterns] of Object.entries(categories)) {
    if (patterns.some((pattern) => name.includes(pattern))) {
      return category;
    }
  }

  return 'Outros';
}

/**
 * Helper function to group permissions by category
 */
function groupPermissionsByCategory(permissoes: Permissao[]): PermissoesPorCategoria {
  const grouped: PermissoesPorCategoria = {};

  permissoes.forEach((permissao) => {
    const category = permissao.category || 'Outros';

    if (!grouped[category]) {
      grouped[category] = [];
    }

    grouped[category].push(permissao);
  });

  // Sort categories alphabetically, but keep "Outros" at the end
  const sortedGrouped: PermissoesPorCategoria = {};
  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === 'Outros') return 1;
    if (b === 'Outros') return -1;
    return a.localeCompare(b);
  });

  categories.forEach((category) => {
    sortedGrouped[category] = grouped[category];
  });

  return sortedGrouped;
}
