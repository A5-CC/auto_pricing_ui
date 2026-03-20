'use client';

import { apiCache } from '@/lib/api/cache';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Hook to clear API cache when navigating between pages
 * This ensures fresh data is fetched when switching routes
 */
export function useCacheClearOnNavigation() {
  const pathname = usePathname();

  useEffect(() => {
    // Log cache stats before clearing
    const stats = apiCache.getStats();
    if (stats.size > 0) {
      console.log(`[Cache] Clearing ${stats.size} entries on navigation to ${pathname}`);
      
      // Clear all cache on route change
      // This ensures fresh data when switching between pages
      apiCache.clear();
    }
  }, [pathname]);
}
