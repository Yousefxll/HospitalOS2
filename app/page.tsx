import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { getLastSessionState } from '@/lib/core/auth/sessionRestore';

/**
 * Root route handler
 * 
 * - If NOT authenticated → redirect to /login or /welcome
 * - If authenticated → redirect to lastRoute if exists, otherwise /platforms
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  // If not authenticated, redirect to login
  if (!token) {
    redirect('/login');
  }
  
  // Verify token (must work across all routes)
  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.userId) {
    // Token invalid - clear and redirect
    redirect('/login');
  }
  
  // If authenticated, try to restore last session state (BEFORE any redirects)
  try {
    const lastState = await getLastSessionState(payload.userId);
    
    // Restore to lastRoute if available and autoRestore is enabled
    if (lastState?.lastRoute && lastState.autoRestore) {
      redirect(lastState.lastRoute);
      return; // Exit early
    }
    
    // If we have a last platform but no specific route, redirect to platform
    if (lastState?.lastPlatformKey && !lastState.lastRoute) {
      redirect(`/platforms/${lastState.lastPlatformKey}`);
      return; // Exit early
    }
  } catch (error) {
    // If restore fails, continue to platforms
    console.error('[HomePage] Failed to restore session state:', error);
  }
  
  // Default: redirect to platforms hub (auth persists via cookie)
  redirect('/platforms');
}
