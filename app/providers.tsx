'use client';

import { SWRConfig } from 'swr';
import { PlatformProvider } from '@/contexts/PlatformContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
        dedupingInterval: 60000,
      }}
    >
      <PlatformProvider>
        {children}
      </PlatformProvider>
    </SWRConfig>
  );
}

