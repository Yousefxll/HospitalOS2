'use client';

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export function usePlatform() {
  const { data, error, isLoading, mutate } = useSWR('/api/platform/get', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 60000,
  });

  return { platform: data, error, isLoading, mutate };
}

