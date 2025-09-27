// Ultra-fast in-memory cache system for sub-5ms API responses
// This replaces Redis with optimized JavaScript data structures

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  hitRate: number;
}

class UltraFastCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>(); // For LRU tracking
  private maxSize: number;
  private currentSize = 0;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    hitRate: 0
  };

  constructor(maxSize: number = 200000) { // 20x larger cache for serverless
    this.maxSize = maxSize;
    
    // ULTRA-FAST cleanup every 10 seconds
    setInterval(() => this.cleanup(), 10000);
    
    // Update stats every 3 seconds
    setInterval(() => this.updateStats(), 3000);
  }

  // Ultra-fast get operation - optimized for speed
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.accessOrder.set(key, Date.now());
    this.stats.hits++;
    
    return entry.data;
  }

  // Ultra-fast set operation
  set<T>(key: string, data: T, ttl: number = 120000): void { // 2 min default for faster refresh
    const now = Date.now();
    
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      hits: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, now);
  }

  // Batch operations for multiple keys
  mget<T>(keys: string[]): (T | null)[] {
    return keys.map(key => this.get<T>(key));
  }

  mset<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  // Delete operations
  del(key: string): boolean {
    const existed = this.cache.delete(key);
    this.accessOrder.delete(key);
    return existed;
  }

  mdel(keys: string[]): number {
    let deleted = 0;
    keys.forEach(key => {
      if (this.del(key)) deleted++;
    });
    return deleted;
  }

  // Pattern-based deletion
  delPattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    return this.mdel(keysToDelete);
  }

  // Cache warming - pre-populate frequently accessed data
  async warmCache<T>(
    keyGenerator: () => string,
    dataFetcher: () => Promise<T>,
    ttl: number = 300000
  ): Promise<void> {
    try {
      const key = keyGenerator();
      const data = await dataFetcher();
      this.set(key, data, ttl);
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }

  // Background refresh - keep data fresh
  async backgroundRefresh<T>(
    key: string,
    dataFetcher: () => Promise<T>,
    ttl: number = 300000,
    refreshInterval: number = 60000 // 1 minute
  ): Promise<void> {
    const refresh = async () => {
      try {
        const data = await dataFetcher();
        this.set(key, data, ttl);
      } catch (error) {
        console.error(`Background refresh failed for key ${key}:`, error);
      }
    };

    // Initial fetch
    await refresh();
    
    // Set up interval
    setInterval(refresh, refreshInterval);
  }

  // LRU eviction
  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }
    
    this.mdel(expiredKeys);
  }

  // Update statistics
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    this.stats.totalSize = this.cache.size;
  }

  // Get cache statistics
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      hitRate: 0
    };
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }

  // Check if key exists
  exists(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }
    
    return true;
  }

  // Get TTL for a key
  ttl(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return -1;
    
    const remaining = entry.ttl - (Date.now() - entry.timestamp);
    return Math.max(0, remaining);
  }

  // Increment a numeric value
  incr(key: string, amount: number = 1): number {
    const current = this.get<number>(key) || 0;
    const newValue = current + amount;
    this.set(key, newValue, 300000); // 5 min TTL
    return newValue;
  }

  // Decrement a numeric value
  decr(key: string, amount: number = 1): number {
    return this.incr(key, -amount);
  }
}

// ULTRA-SCALED cache instance for 1000+ concurrent users (serverless optimized)
export const ultraFastCache = new UltraFastCache(200000); // 200k entries max

// Cache key generators for consistent naming
export const CacheKeys = {
  // Products
  PRODUCTS_ALL: 'products:all',
  PRODUCT_BY_ID: (id: number) => `product:${id}`,
  PRODUCTS_BY_SELLER: (sellerId: string) => `products:seller:${sellerId}`,
  
  // Categories
  CATEGORIES_ALL: 'categories:all',
  CATEGORY_BY_ID: (id: number) => `category:${id}`,
  
  // User groups
  USER_GROUPS_ALL: 'user_groups:all',
  USER_GROUP_BY_ID: (id: number) => `user_group:${id}`,
  USER_GROUPS_BY_USER: (userId: string) => `user_groups:user:${userId}`,
  
  // Orders
  ORDERS_BY_USER: (userId: string) => `orders:user:${userId}`,
  ORDERS_BY_SELLER: (sellerId: string) => `orders:seller:${sellerId}`,
  
  // Metrics
  SELLER_METRICS: (sellerId: string) => `metrics:seller:${sellerId}`,
  SELLER_ANALYTICS: (sellerId: string) => `analytics:seller:${sellerId}`,
  
  // Session data
  USER_SESSION: (userId: string) => `session:user:${userId}`,
  USER_CART: (userId: string) => `cart:user:${userId}`,

  // Users
  USERS_ALL: 'users:all',
  USER_BY_ID: (userId: string) => `user:${userId}`,
} as const;

// Cache warming utilities
export class CacheWarmer {
  private static instance: CacheWarmer;
  
  static getInstance(): CacheWarmer {
    if (!CacheWarmer.instance) {
      CacheWarmer.instance = new CacheWarmer();
    }
    return CacheWarmer.instance;
  }

  // Warm frequently accessed data
  async warmFrequentData(): Promise<void> {
    console.log('🔥 Warming cache with frequent data...');
    
    // Import storage here to avoid circular dependencies
    const { storage } = await import('./storage');
    
    try {
      // Warm categories (rarely change) - ULTRA-FAST
      await ultraFastCache.warmCache(
        () => CacheKeys.CATEGORIES_ALL,
        () => storage.getCategories(),
        300000 // 5 minutes
      );

      // Warm all products - ULTRA-FAST (serverless optimized)
      await ultraFastCache.warmCache(
        () => CacheKeys.PRODUCTS_ALL,
        () => storage.getProducts(),
        300000 // 5 minutes for serverless (longer cache to reduce DB calls)
      );

          // Warm all public user groups - ULTRA-FAST
          await ultraFastCache.warmCache(
            () => CacheKeys.USER_GROUPS_ALL,
            () => storage.getAllPublicCollections(),
            120000 // 2 minutes
          );

          // Warm all users - ULTRA-FAST
          await ultraFastCache.warmCache(
            () => CacheKeys.USERS_ALL,
            () => storage.getAllUsers(),
            300000 // 5 minutes
          );

      console.log('✅ Cache warming completed');
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
    }
  }

  // Set up background refresh for dynamic data
  async setupBackgroundRefresh(): Promise<void> {
    console.log('🔄 Setting up background refresh...');
    
    const { storage } = await import('./storage');
    
    // ULTRA-FAST refresh products every 5 minutes (serverless optimized)
    await ultraFastCache.backgroundRefresh(
      CacheKeys.PRODUCTS_ALL,
      () => storage.getProducts(),
      300000, // 5 min TTL
      300000  // 5 min refresh
    );

        // ULTRA-FAST refresh user groups every 2 minutes
        await ultraFastCache.backgroundRefresh(
          CacheKeys.USER_GROUPS_ALL,
          () => storage.getAllPublicCollections(),
          120000, // 2 min TTL
          120000  // 2 min refresh
        );

        // ULTRA-FAST refresh users every 5 minutes
        await ultraFastCache.backgroundRefresh(
          CacheKeys.USERS_ALL,
          () => storage.getAllUsers(),
          300000, // 5 min TTL
          300000  // 5 min refresh
        );

    console.log('✅ Background refresh setup completed');
  }
}

// Performance monitoring for cache
export class CachePerformanceMonitor {
  private static instance: CachePerformanceMonitor;
  
  static getInstance(): CachePerformanceMonitor {
    if (!CachePerformanceMonitor.instance) {
      CachePerformanceMonitor.instance = new CachePerformanceMonitor();
    }
    return CachePerformanceMonitor.instance;
  }

  // Monitor cache performance
  monitorCachePerformance(): void {
    setInterval(() => {
      const stats = ultraFastCache.getStats();
      
      if (stats.hitRate < 80) {
        console.warn(`⚠️ Low cache hit rate: ${stats.hitRate.toFixed(2)}%`);
      }
      
      if (stats.totalSize > 12000) {
        console.warn(`⚠️ Cache size approaching limit: ${stats.totalSize}/15000`);
      }
      
      // Log performance metrics
      console.log(`📊 Cache Stats: ${stats.hitRate.toFixed(2)}% hit rate, ${stats.totalSize} entries, ${stats.evictions} evictions`);
    }, 30000); // Every 30 seconds
  }
}
