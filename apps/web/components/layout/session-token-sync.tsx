'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { setAuthToken } from '@/lib/api';

export function SessionTokenSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    setAuthToken(session?.user?.accessToken ?? null);
  }, [session?.user?.accessToken, status]);

  return null;
}
