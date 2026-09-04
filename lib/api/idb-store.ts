/**
 * Minimal promise-based IndexedDB key/value store.
 *
 * This is the persistent tier of the API cache (see lib/api/cache.ts). It exists
 * because a full pricing-data snapshot (~1000 rows x 30-50 columns) routinely
 * exceeds the ~5MB localStorage quota, so the previous localStorage-only
 * stale-while-revalidate silently no-op'd for exactly the payload that most
 * needs caching. IndexedDB has no practical size limit here and is async.
 *
 * Zero dependencies on purpose. Every operation degrades to a no-op / null when
 * IndexedDB is unavailable (SSR prerender, private-mode quirks, blocked DBs).
 */

const DB_NAME = '__apu_api_cache__'
const STORE = 'kv'
const DB_VERSION = 1

export interface StoredEntry<T> {
  data: T
  ts: number
}

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (!idbAvailable()) return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function request<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const tx = db.transaction(STORE, mode)
          const req = run(tx.objectStore(STORE))
          req.onsuccess = () => resolve(req.result as T)
          req.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      })
  )
}

export function idbGet<T>(key: string): Promise<StoredEntry<T> | null> {
  return request<StoredEntry<T>>('readonly', (s) => s.get(key))
}

export function idbSet<T>(key: string, data: T): Promise<void> {
  const entry: StoredEntry<T> = { data, ts: Date.now() }
  return request('readwrite', (s) => s.put(entry, key)).then(() => undefined)
}

export function idbDelete(key: string): Promise<void> {
  return request('readwrite', (s) => s.delete(key)).then(() => undefined)
}

export function idbEntries<T = unknown>(): Promise<
  Array<{ key: string; entry: StoredEntry<T> }>
> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve([])
        try {
          const tx = db.transaction(STORE, 'readonly')
          const out: Array<{ key: string; entry: StoredEntry<T> }> = []
          const req = tx.objectStore(STORE).openCursor()
          req.onsuccess = () => {
            const cursor = req.result
            if (cursor) {
              out.push({
                key: String(cursor.key),
                entry: cursor.value as StoredEntry<T>,
              })
              cursor.continue()
            } else {
              resolve(out)
            }
          }
          req.onerror = () => resolve(out)
        } catch {
          resolve([])
        }
      })
  )
}
