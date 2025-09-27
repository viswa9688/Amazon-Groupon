// Ultra-fast storage layer with sub-5ms response times
// This extends the existing storage with aggressive caching

import { ultraFastCache, CacheKeys } from './cache';
import { DatabaseStorage } from './storage';
import { performance } from 'perf_hooks';

class UltraFastStorage extends DatabaseStorage {
  // Override getProducts with ultra-fast caching
  async getProducts(): Promise<any[]> {
    const startTime = performance.now();
    
    // Try cache first
    let products = ultraFastCache.get<any[]>(CacheKeys.PRODUCTS_ALL);
    
    if (products) {
      const endTime = performance.now();
      console.log(`⚡ Products from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return products;
    }
    
    // Fallback to database
    products = await super.getProducts();
    
    // Cache for next time
    ultraFastCache.set(CacheKeys.PRODUCTS_ALL, products, 120000); // 2 minutes
    
    const endTime = performance.now();
    console.log(`🐌 Products from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return products;
  }

  // Override getProduct with ultra-fast caching
  async getProduct(id: number): Promise<any | undefined> {
    const startTime = performance.now();
    const cacheKey = CacheKeys.PRODUCT_BY_ID(id);
    
    // Try cache first
    let product = ultraFastCache.get<any>(cacheKey);
    
    if (product) {
      const endTime = performance.now();
      console.log(`⚡ Product ${id} from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return product;
    }
    
    // Fallback to database
    product = await super.getProduct(id);
    
    if (product) {
      // Cache for next time
      ultraFastCache.set(cacheKey, product, 300000); // 5 minutes
    }
    
    const endTime = performance.now();
    console.log(`🐌 Product ${id} from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return product;
  }

  // Override getCategories with ultra-fast caching
  async getCategories(): Promise<any[]> {
    const startTime = performance.now();
    
    // Try cache first
    let categories = ultraFastCache.get<any[]>(CacheKeys.CATEGORIES_ALL);
    
    if (categories) {
      const endTime = performance.now();
      console.log(`⚡ Categories from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return categories;
    }
    
    // Fallback to database
    categories = await super.getCategories();
    
    // Cache for longer since categories rarely change
    ultraFastCache.set(CacheKeys.CATEGORIES_ALL, categories, 600000); // 10 minutes
    
    const endTime = performance.now();
    console.log(`🐌 Categories from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return categories;
  }

  // Override getProductsBySeller with ultra-fast caching
  async getProductsBySeller(sellerId: string): Promise<any[]> {
    const startTime = performance.now();
    const cacheKey = CacheKeys.PRODUCTS_BY_SELLER(sellerId);
    
    // Try cache first
    let products = ultraFastCache.get<any[]>(cacheKey);
    
    if (products) {
      const endTime = performance.now();
      console.log(`⚡ Seller products from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return products;
    }
    
    // Fallback to database
    products = await super.getProductsBySeller(sellerId);
    
    // Cache for next time
    ultraFastCache.set(cacheKey, products, 180000); // 3 minutes
    
    const endTime = performance.now();
    console.log(`🐌 Seller products from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return products;
  }

  // Override getAllPublicCollections with ultra-fast caching
  async getAllPublicCollections(): Promise<any[]> {
    const startTime = performance.now();
    
    // Try cache first
    let collections = ultraFastCache.get<any[]>(CacheKeys.USER_GROUPS_ALL);
    
    if (collections) {
      const endTime = performance.now();
      console.log(`⚡ Collections from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return collections;
    }
    
    // Fallback to database
    collections = await super.getAllPublicCollections();
    
    // Cache for next time
    ultraFastCache.set(CacheKeys.USER_GROUPS_ALL, collections, 180000); // 3 minutes
    
    const endTime = performance.now();
    console.log(`🐌 Collections from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return collections;
  }

  // Override getUserGroup with ultra-fast caching
  async getUserGroup(groupId: number): Promise<any | undefined> {
    const startTime = performance.now();
    const cacheKey = CacheKeys.USER_GROUP_BY_ID(groupId);
    
    // Try cache first
    let group = ultraFastCache.get<any>(cacheKey);
    
    if (group) {
      const endTime = performance.now();
      console.log(`⚡ User group ${groupId} from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return group;
    }
    
    // Fallback to database
    group = await super.getUserGroup(groupId);
    
    if (group) {
      // Cache for next time
      ultraFastCache.set(cacheKey, group, 300000); // 5 minutes
    }
    
    const endTime = performance.now();
    console.log(`🐌 User group ${groupId} from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return group;
  }

  // Override getSellerMetrics with ultra-fast caching
  async getSellerMetrics(sellerId: string): Promise<any> {
    const startTime = performance.now();
    const cacheKey = CacheKeys.SELLER_METRICS(sellerId);
    
    // Try cache first
    let metrics = ultraFastCache.get<any>(cacheKey);
    
    if (metrics) {
      const endTime = performance.now();
      console.log(`⚡ Seller metrics from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return metrics;
    }
    
    // Fallback to database
    metrics = await super.getSellerMetrics(sellerId);
    
    // Cache for shorter time since metrics change frequently
    ultraFastCache.set(cacheKey, metrics, 60000); // 1 minute
    
    const endTime = performance.now();
    console.log(`🐌 Seller metrics from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return metrics;
  }

  // Override getSellerAnalytics with ultra-fast caching
  async getSellerAnalytics(sellerId: string, dateRange?: any): Promise<any> {
    const startTime = performance.now();
    const cacheKey = `${CacheKeys.SELLER_ANALYTICS(sellerId)}:${JSON.stringify(dateRange || {})}`;
    
    // Try cache first
    let analytics = ultraFastCache.get<any>(cacheKey);
    
    if (analytics) {
      const endTime = performance.now();
      console.log(`⚡ Seller analytics from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return analytics;
    }
    
    // Fallback to database
    analytics = await super.getSellerAnalytics(sellerId, dateRange);
    
    // Cache for shorter time since analytics change frequently
    ultraFastCache.set(cacheKey, analytics, 120000); // 2 minutes
    
    const endTime = performance.now();
    console.log(`🐌 Seller analytics from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return analytics;
  }

  // Override getUserOrders with ultra-fast caching
  async getUserOrders(userId: string): Promise<any[]> {
    const startTime = performance.now();
    const cacheKey = CacheKeys.ORDERS_BY_USER(userId);
    
    // Try cache first
    let orders = ultraFastCache.get<any[]>(cacheKey);
    
    if (orders) {
      const endTime = performance.now();
      console.log(`⚡ User orders from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return orders;
    }
    
    // Fallback to database
    orders = await super.getUserOrders(userId);
    
    // Cache for next time
    ultraFastCache.set(cacheKey, orders, 180000); // 3 minutes
    
    const endTime = performance.now();
    console.log(`🐌 User orders from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return orders;
  }

  // Override getUserCart with ultra-fast caching
  async getUserCart(userId: string): Promise<any[]> {
    const startTime = performance.now();
    const cacheKey = CacheKeys.USER_CART(userId);
    
    // Try cache first
    let cart = ultraFastCache.get<any[]>(cacheKey);
    
    if (cart) {
      const endTime = performance.now();
      console.log(`⚡ User cart from cache: ${(endTime - startTime).toFixed(2)}ms`);
      return cart;
    }
    
    // Fallback to database
    cart = await super.getUserCart(userId);
    
    // Cache for shorter time since cart changes frequently
    ultraFastCache.set(cacheKey, cart, 60000); // 1 minute
    
    const endTime = performance.now();
    console.log(`🐌 User cart from DB: ${(endTime - startTime).toFixed(2)}ms`);
    
    return cart;
  }

  // Cache invalidation methods
  invalidateProductCache(productId?: number): void {
    if (productId) {
      ultraFastCache.del(CacheKeys.PRODUCT_BY_ID(productId));
    }
    ultraFastCache.del(CacheKeys.PRODUCTS_ALL);
    ultraFastCache.delPattern('products:seller:*');
  }

  invalidateCategoryCache(): void {
    ultraFastCache.del(CacheKeys.CATEGORIES_ALL);
  }

  invalidateUserGroupCache(groupId?: number): void {
    if (groupId) {
      ultraFastCache.del(CacheKeys.USER_GROUP_BY_ID(groupId));
    }
    ultraFastCache.del(CacheKeys.USER_GROUPS_ALL);
    ultraFastCache.delPattern('user_groups:user:*');
  }

  invalidateSellerCache(sellerId: string): void {
    ultraFastCache.del(CacheKeys.SELLER_METRICS(sellerId));
    ultraFastCache.del(CacheKeys.SELLER_ANALYTICS(sellerId));
    ultraFastCache.del(CacheKeys.PRODUCTS_BY_SELLER(sellerId));
    ultraFastCache.del(CacheKeys.ORDERS_BY_SELLER(sellerId));
  }

  invalidateUserCache(userId: string): void {
    ultraFastCache.del(CacheKeys.USER_CART(userId));
    ultraFastCache.del(CacheKeys.ORDERS_BY_USER(userId));
    ultraFastCache.del(CacheKeys.USER_GROUPS_BY_USER(userId));
  }

  // Override create methods to invalidate cache
  async createProduct(product: any): Promise<any> {
    const result = await super.createProduct(product);
    this.invalidateProductCache();
    return result;
  }

  async updateProduct(id: number, product: any): Promise<any> {
    const result = await super.updateProduct(id, product);
    this.invalidateProductCache(id);
    return result;
  }

  async deleteProduct(productId: number): Promise<void> {
    await super.deleteProduct(productId);
    this.invalidateProductCache(productId);
  }

  async createCategory(category: any): Promise<any> {
    const result = await super.createCategory(category);
    this.invalidateCategoryCache();
    return result;
  }

  async createUserGroup(userGroupData: any): Promise<any> {
    const result = await super.createUserGroup(userGroupData);
    this.invalidateUserGroupCache();
    return result;
  }

  async updateUserGroup(groupId: number, updates: any): Promise<any> {
    const result = await super.updateUserGroup(groupId, updates);
    this.invalidateUserGroupCache(groupId);
    return result;
  }

  async deleteUserGroup(groupId: number): Promise<boolean> {
    const result = await super.deleteUserGroup(groupId);
    this.invalidateUserGroupCache(groupId);
    return result;
  }

  // Get cache statistics
  getCacheStats(): any {
    return ultraFastCache.getStats();
  }

  // Clear all cache
  clearCache(): void {
    ultraFastCache.clear();
  }
}

// Export the ultra-fast storage instance
export const ultraFastStorage = new UltraFastStorage();
