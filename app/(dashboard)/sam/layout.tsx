import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { isPlatformEnabled } from '@/lib/core/subscription/engine';

/**
 * SAM Platform Layout Guard
 * 
 * Server-side guard that ensures only users with SAM entitlement can access /sam/** routes.
 * This is the source of truth for SAM platform access control.
 * 
 * This layout runs on every /sam/** route and checks:
 * 1. User is authenticated (has valid auth token)
 * 2. User's tenant has SAM platform enabled
 * 
 * If either check fails, redirects to appropriate page.
 */
export default async function SAMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  // Check authentication
  if (!token) {
    redirect('/login?redirect=/sam');
  }
  
  // Verify token
  const payload = await verifyTokenEdge(token);
  
  if (!payload || !payload.activeTenantId) {
    redirect('/login?redirect=/sam');
  }
  
  // Check SAM entitlement (server-side check - source of truth)
  const hasSAMAccess = await isPlatformEnabled(payload.activeTenantId, 'sam');
  
  if (!hasSAMAccess) {
    // User not entitled to SAM platform - redirect to platforms page
    redirect('/platforms?reason=not_entitled&platform=sam');
  }
  
  // User has SAM access - render children
  return <>{children}</>;
}
