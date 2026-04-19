'use client';

import { apiCache } from '@/lib/api/cache';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Keep API cache warm across route navigation.
 *
 * We intentionally do NOT clear cache on route changes so previously loaded
 * pages can paint instantly from memory/localStorage and then revalidate.
 */
export function useCacheClearOnNavigation() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const stats = apiCache.getStats();
      if (stats.size > 0) {
        console.log(`[Cache] Retaining ${stats.size} entries on navigation to ${pathname}`);
      }
    }
  }, [pathname]);
}
