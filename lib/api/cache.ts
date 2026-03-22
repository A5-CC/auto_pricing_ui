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

/**
 * Wrapper function to cache API calls
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { skipCache?: boolean; ttl?: number }
): Promise<T> {
  // Skip cache if requested
  if (options?.skipCache) {
    const data = await fetcher();
    apiCache.set(key, data);
    return data;
  }

  // Check cache first
  const cached = apiCache.get<T>(key);
  if (cached !== null) {
    console.log(`[Cache HIT] ${key}`);
    return cached;
  }

  // Fetch and cache
  console.log(`[Cache MISS] ${key}`);
  const data = await fetcher();
  apiCache.set(key, data);
  return data;
}
