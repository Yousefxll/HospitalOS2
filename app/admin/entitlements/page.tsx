'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useMe } from '@/lib/hooks/useMe';

/**
 * Tenant Entitlements Page (DISABLED)
 * 
 * This page has been moved to Owner Console.
 * Tenant admins cannot manage entitlements - only SYRA Owner can.
 * 
 * This page redirects to /owner if user is syra-owner,
 * or shows an access denied message if user is tenant-admin.
 */
export default function EntitlementsPage() {
  const router = useRouter();
  const { me } = useMe();

  useEffect(() => {
    if (!me) return;

    const userRole = me.user?.role;

    if (userRole === 'syra-owner') {
      // Redirect syra-owner to owner console
      router.push('/owner/tenants');
    }
  }, [me, router]);

  return (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Access Denied</strong>
          <br />
          Tenant entitlements can only be managed by SYRA Owner.
          <br />
          <br />
          If you are a SYRA Owner, you will be redirected to the Owner Console.
          <br />
          If you are a Tenant Admin, please contact your SYRA Owner to manage platform entitlements.
        </AlertDescription>
      </Alert>
    </div>
  );
}
