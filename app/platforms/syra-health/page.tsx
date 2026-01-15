/**
 * SYRA Health Platform Landing Page
 * 
 * Route: /platforms/syra-health
 * This is the entry point for SYRA Health platform
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyTokenEdge } from '@/lib/auth/edge';

export default async function SYRAHealthPlatformPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) {
    redirect('/login?redirect=/platforms/syra-health');
  }
  
  const payload = await verifyTokenEdge(token);
  if (!payload) {
    redirect('/login?redirect=/platforms/syra-health');
  }
  
  // CRITICAL: Block owner from accessing tenant platforms without approved access OR owner tenant
  if (payload.role === 'syra-owner') {
    const approvedAccessToken = cookieStore.get('approved_access_token')?.value;
    
    // Get activeTenantId from JWT token (included at login for Edge Runtime compatibility)
    const isOwnerTenant = payload.activeTenantId === 'syra-owner-dev';
    
    if (!approvedAccessToken && !isOwnerTenant) {
      redirect('/owner');
    }
  }
  
  // Check platform entitlements
  if (!payload.entitlements?.health) {
    // For owner, redirect to /owner instead of /platforms
    if (payload.role === 'syra-owner') {
      redirect('/owner');
    }
    redirect('/platforms?reason=not_entitled');
  }
  
  // Redirect to SYRA Health welcome/dashboard
  redirect('/welcome');
}
