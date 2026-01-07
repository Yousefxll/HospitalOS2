/**
 * Hook to check route permissions and redirect if unauthorized
 * 
 * This hook should be used in all pages to ensure users can only access
 * pages they have permission for.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from './useMe';
import { hasRoutePermission } from '@/lib/permissions';

/**
 * Hook to check if user has permission for current route
 * Redirects to /welcome if user doesn't have permission
 * 
 * @param route - Route path to check (e.g., '/policies', '/ai/policy-assistant')
 * @returns { hasPermission: boolean, isLoading: boolean }
 */
export function useRoutePermission(route: string) {
  const router = useRouter();
  const { me, isLoading: meLoading } = useMe();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (meLoading || !me) {
      setIsLoading(meLoading);
      return;
    }

    const userPermissions = me.user?.permissions || [];
    const hasAccess = hasRoutePermission(userPermissions, route);
    setHasPermission(hasAccess);
    setIsLoading(false);

    // If user doesn't have permission, redirect to welcome page
    if (!hasAccess) {
      router.push('/welcome');
      return;
    }
  }, [me, meLoading, route, router]);

  return { hasPermission, isLoading };
}

