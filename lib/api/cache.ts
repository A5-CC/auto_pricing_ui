/**
 * Simple in-memory cache for API calls
 * Prevents duplicate requests during the same navigation session
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class APICache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private ttl: number = 5 * 60 * 1000; // 5 minutes default TTL

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear specific key or all cache
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * Clear cache entries matching a pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key) && this.get(key) !== null;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const apiCache = new APICache();

const LS_PREFIX = '__apu_cache__'
const LS_TTL = 30 * 60 * 1000 // 30 minutes for localStorage tier

function lsGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number }
    if (Date.now() - ts > LS_TTL) return null
    return data
  } catch {
    return null
  }
}

function lsSet<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // quota exceeded or SSR – ignore
  }
}

/**
 * Read cached value synchronously (memory first, then localStorage when enabled).
 * Useful for instant UI hydration before an async fetch resolves.
 */
export function getCachedValue<T>(
  key: string,
  options?: { persist?: boolean }
): T | null {
  const memory = apiCache.get<T>(key)
  if (memory !== null) return memory

  if (options?.persist) {
    const persisted = lsGet<T>(key)
    if (persisted !== null) {
      apiCache.set(key, persisted)
      return persisted
    }
  }

  return null
}

/**
 * Wrapper function to cache API calls.
 * Options:
 *   persist   – also read/write localStorage so data survives page refreshes (stale-while-revalidate)
 *   skipCache – bypass both memory and localStorage caches
 *   ttl       – override in-memory TTL
 *   onStale   – called with fresh data after stale data was already returned (SWR callback)
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    skipCache?: boolean
    ttl?: number
    persist?: boolean
    onStale?: (data: T) => void
  }
): Promise<T> {
  if (options?.skipCache) {
    const data = await fetcher()
    apiCache.set(key, data)
    if (options.persist) lsSet(key, data)
    return data
  }

  // 1. In-memory hit (fast, unexpired)
  const cached = apiCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // 2. localStorage hit (stale-while-revalidate)
  if (options?.persist) {
    const stale = lsGet<T>(key)
    if (stale !== null) {
      apiCache.set(key, stale) // warm memory cache
      // Kick off background revalidation
      void fetcher().then((fresh) => {
        apiCache.set(key, fresh)
        lsSet(key, fresh)
        options.onStale?.(fresh)
      }).catch(() => { /* keep stale */ })
      return stale
    }
  }

  // 3. Cold fetch
  const data = await fetcher()
  apiCache.set(key, data)
  if (options?.persist) lsSet(key, data)
  return data
}
