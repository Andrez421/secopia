/**
 * LRU (Least Recently Used) Cache with TTL expiration.
 *
 * Used by SocrataClient for in-memory caching of API responses.
 * This is especially important for the MCP standalone mode (npx)
 * where there's no Redis available.
 *
 * Uses a Map which maintains insertion order in JS, making
 * the oldest entry always the first key (for eviction).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface LruCacheOptions {
  /** Time-to-live in milliseconds. Default: 5 minutes. Set to 0 to disable. */
  ttlMs: number;
  /** Maximum number of entries. Default: 200. */
  maxEntries: number;
}

const DEFAULT_OPTIONS: LruCacheOptions = {
  ttlMs: 5 * 60 * 1000,
  maxEntries: 200,
};

export class LruCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly options: LruCacheOptions;

  constructor(options: Partial<LruCacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Check if caching is enabled */
  get enabled(): boolean {
    return this.options.ttlMs > 0;
  }

  /** Current number of entries (including potentially expired ones) */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Get a cached value by key.
   * Returns undefined if not found or expired.
   * Moves the entry to the "end" (most recently used) on hit.
   */
  get(key: string): T | undefined {
    if (!this.enabled) return undefined;

    const entry = this.entries.get(key);
    if (!entry) return undefined;

    // Check expiration
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Move to end (most recently used) by re-inserting
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.data;
  }

  /**
   * Set a value in the cache.
   * Evicts the least recently used entry if at capacity.
   */
  set(key: string, data: T): void {
    if (!this.enabled) return;

    // Delete existing entry to update position
    this.entries.delete(key);

    // Evict oldest if at capacity
    if (this.entries.size >= this.options.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, {
      data,
      expiresAt: Date.now() + this.options.ttlMs,
    });
  }

  /** Remove all entries */
  clear(): void {
    this.entries.clear();
  }
}
