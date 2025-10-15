// src/hooks/useUserPermissions.ts

import { useState, useEffect, useCallback } from 'react';
import { userPermissionsService, UserPermissionsResponse, UserPermissionsSummary } from '@/services/user-permissions.service';

export interface Role {
  id: number;
  name: string;
  display_name?: string;
  description?: string;
}

export interface UserPermission {
  id: number;
  name: string;
  display_name?: string;
  description?: string;
  guard_name?: string;
  source?: 'role' | 'direct';
}

/**
 * Hook to check a single permission for a user
 */
export function usePermissionCheck(userId: string, permission: string, autoCheck: boolean = true) {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkPermission = useCallback(async () => {
    if (!userId || !permission) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await userPermissionsService.checkUserPermission(userId, permission);
      setHasPermission(result.hasPermission);
    } catch (err: any) {
      console.error('Error checking permission:', err);
      setError(err.message || 'Failed to check permission');
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  }, [userId, permission]);

  useEffect(() => {
    if (autoCheck) {
      checkPermission();
    }
  }, [autoCheck, checkPermission]);

  return {
    hasPermission,
    loading,
    error,
    recheck: checkPermission,
  };
}

/**
 * Hook to check multiple permissions for a user
 */
export function useMultiplePermissionCheck(
  userId: string,
  permissions: string[],
  mode: 'any' | 'all' = 'any',
  autoCheck: boolean = true
) {
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [details, setDetails] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkPermissions = useCallback(async () => {
    if (!userId || !permissions || permissions.length === 0) {
      setHasPermissions(false);
      setDetails({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check each permission
      const results = await Promise.all(
        permissions.map(async (permission) => {
          const result = await userPermissionsService.checkUserPermission(userId, permission);
          return { permission, hasPermission: result.hasPermission };
        })
      );

      // Build details object
      const detailsObj: Record<string, boolean> = {};
      results.forEach(({ permission, hasPermission }) => {
        detailsObj[permission] = hasPermission;
      });
      setDetails(detailsObj);

      // Determine overall result based on mode
      if (mode === 'all') {
        setHasPermissions(results.every(r => r.hasPermission));
      } else {
        setHasPermissions(results.some(r => r.hasPermission));
      }
    } catch (err: any) {
      console.error('Error checking permissions:', err);
      setError(err.message || 'Failed to check permissions');
      setHasPermissions(false);
      setDetails({});
    } finally {
      setLoading(false);
    }
  }, [userId, permissions, mode]);

  useEffect(() => {
    if (autoCheck) {
      checkPermissions();
    }
  }, [autoCheck, checkPermissions]);

  return {
    hasPermissions,
    details,
    loading,
    error,
    recheck: checkPermissions,
  };
}

/**
 * Hook to get user's permissions
 */
export function useUserPermissions(userId: string, autoFetch: boolean = true) {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!userId) {
      setPermissions([]);
      setRoles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await userPermissionsService.getUserPermissions(userId);
      setPermissions(result.allPermissions as UserPermission[]);
      setRoles(result.roles as Role[]);
    } catch (err: any) {
      console.error('Error fetching user permissions:', err);
      setError(err.message || 'Failed to fetch permissions');
      setPermissions([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (autoFetch) {
      fetchPermissions();
    }
  }, [autoFetch, fetchPermissions]);

  return {
    permissions,
    roles,
    loading,
    error,
    refetch: fetchPermissions,
  };
}

/**
 * Hook to get available roles and permissions in the system
 */
export function useAvailableRolesAndPermissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch roles and permissions from API
        // This is a placeholder - adjust based on your actual API
        const [rolesResponse, permissionsResponse] = await Promise.allSettled([
          fetch('/api/roles').then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/permissions').then(r => r.json()).catch(() => ({ data: [] }))
        ]);

        if (rolesResponse.status === 'fulfilled') {
          setRoles(rolesResponse.value.data || []);
        }

        if (permissionsResponse.status === 'fulfilled') {
          setPermissions(permissionsResponse.value.data || []);
        }
      } catch (err: any) {
        console.error('Error fetching roles and permissions:', err);
        setError(err.message || 'Failed to fetch roles and permissions');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return {
    roles,
    permissions,
    loading,
    error,
  };
}
