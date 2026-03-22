// APG Manager RMS - Query Provider (TanStack Query wrapper)
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Khởi tạo QueryClient một lần per component lifecycle
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Không fetch lại khi focus window (tránh spam API)
        refetchOnWindowFocus: false,
        // Cache 5 phút
        staleTime: 5 * 60 * 1000,
        // Retry 1 lần khi lỗi
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
