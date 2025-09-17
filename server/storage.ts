import {
  users,
  products,
  categories,
  discountTiers,
  orders,
  userAddresses,
  cartItems,
  userGroups,
  userGroupItems,
  userGroupParticipants,
  serviceProviders,
  serviceProviderStaff,
  type User,
  type UpsertUser,
  type CreateUserWithPhone,
  type UserAddress,
  type InsertUserAddress,
  type Product,
  type InsertProduct,
  type Category,
  type InsertCategory,
  type DiscountTier,
  type InsertDiscountTier,
  type Order,
  type InsertOrder,
  type CartItem,
  type InsertCartItem,
  type UserGroup,
  type InsertUserGroup,
  type UserGroupItem,
  type InsertUserGroupItem,
  type UserGroupParticipant,
  type InsertUserGroupParticipant,
  type ProductWithDetails,
  type UserGroupWithDetails,
  type ServiceProvider,
  type InsertServiceProvider,
  type ServiceProviderStaff,
  type InsertServiceProviderStaff,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, gte, not, exists, inArray, isNotNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  createUserWithPhone(userData: CreateUserWithPhone): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, updates: Partial<User>): Promise<User>;
  
  // Admin user operations
  getAllUsers(): Promise<User[]>;
  updateUserAdmin(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Product operations
  getProducts(): Promise<ProductWithDetails[]>;
  getProduct(id: number): Promise<ProductWithDetails | undefined>;
  getProductsBySeller(sellerId: string): Promise<ProductWithDetails[]>;
  getSellerShops(): Promise<User[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getProductParticipantCount(productId: number): Promise<number>;
  removeDiscountTiersForProduct(productId: number): Promise<void>;
  
  // Service Provider operations
  createServiceProvider(serviceProvider: InsertServiceProvider): Promise<ServiceProvider>;
  updateServiceProvider(id: number, serviceProvider: Partial<InsertServiceProvider>): Promise<ServiceProvider>;
  getServiceProviderByProductId(productId: number): Promise<ServiceProvider | undefined>;
  deleteServiceProviderByProductId(productId: number): Promise<void>;
  
  // Service Provider Staff operations
  createServiceProviderStaff(staff: InsertServiceProviderStaff): Promise<ServiceProviderStaff>;
  getServiceProviderStaff(serviceProviderId: number): Promise<ServiceProviderStaff[]>;
  deleteServiceProviderStaff(serviceProviderId: number): Promise<void>;

  // Discount tier operations
  createDiscountTier(tier: InsertDiscountTier): Promise<DiscountTier>;
  getDiscountTiersByProduct(productId: number): Promise<DiscountTier[]>;


  // User address operations
  getUserAddresses(userId: string): Promise<UserAddress[]>;
  createUserAddress(address: InsertUserAddress): Promise<UserAddress>;
  updateUserAddress(addressId: number, address: Partial<InsertUserAddress>): Promise<UserAddress>;
  deleteUserAddress(addressId: number): Promise<boolean>;
  setDefaultAddress(userId: string, addressId: number): Promise<boolean>;

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(orderId: number): Promise<Order | undefined>;
  getUserOrders(userId: string): Promise<Order[]>;
  getSellerOrders(sellerId: string): Promise<Order[]>;
  updateOrderStatus(orderId: number, status: string): Promise<Order>;
  
  // Cart operations
  getUserCart(userId: string): Promise<(CartItem & { product: ProductWithDetails })[]>;
  addToCart(cartItem: InsertCartItem): Promise<CartItem>;
  updateCartItemQuantity(cartItemId: number, quantity: number): Promise<CartItem>;
  removeFromCart(cartItemId: number): Promise<boolean>;
  clearUserCart(userId: string): Promise<boolean>;
  
  // User group operations
  getUserGroups(userId: string): Promise<UserGroupWithDetails[]>;
  getUserGroup(groupId: number): Promise<UserGroupWithDetails | undefined>;
  getUserGroupByShareToken(shareToken: string): Promise<UserGroupWithDetails | undefined>;
  createUserGroup(userGroup: InsertUserGroup & { shareToken: string }): Promise<UserGroup>;
  createUserGroupFromCart(userGroupData: InsertUserGroup & { shareToken: string }, cartItems: any[]): Promise<UserGroup>;
  updateUserGroup(groupId: number, updates: Partial<InsertUserGroup>): Promise<UserGroup>;
  deleteUserGroup(groupId: number): Promise<boolean>;
  addItemToUserGroup(groupId: number, productId: number, quantity: number): Promise<UserGroupItem>;
  removeItemFromUserGroup(groupId: number, productId: number): Promise<boolean>;
  updateUserGroupItemQuantity(groupId: number, productId: number, quantity: number): Promise<UserGroupItem>;
  joinUserGroup(userGroupId: number, userId: string): Promise<boolean>;
  leaveUserGroup(userGroupId: number, userId: string): Promise<boolean>;
  isUserInUserGroup(userGroupId: number, userId: string): Promise<boolean>;
  getUserGroupParticipantCount(userGroupId: number): Promise<number>;
  addUserGroupParticipant(userGroupId: number, userId: string): Promise<UserGroupParticipant>;
  removeUserGroupParticipant(userGroupId: number, userId: string): Promise<boolean>;
  
  // Group matching and optimization operations
  findSimilarGroups(userId: string): Promise<Array<{
    userGroup: UserGroupWithDetails;
    similarityScore: number;
    matchingProducts: number;
    totalCartProducts: number;
    potentialSavings: number;
    matchingItems: Array<{
      productId: number;
      productName: string;
      cartQuantity: number;
      groupQuantity: number;
      individualSavings: number;
    }>;
    isAlreadyMember: boolean;
    isFull: boolean;
  }>>;
  getOptimizationSuggestions(userId: string): Promise<Array<{
    userGroups: UserGroupWithDetails[];
    totalSavings: number;
    coverage: number;
    uncoveredProducts: ProductWithDetails[];
    recommendationType: 'single_best' | 'multi_group' | 'complete_coverage';
    description: string;
  }>>;
  
  // Seller metrics operations
  getSellerMetrics(sellerId: string): Promise<{
    totalRevenue: number;
    totalOrders: number;
    potentialRevenue: number;
    activeGroups: number;
    totalProducts: number;
    growthPercentage: number;
  }>;
  
  // Advanced seller analytics
  getSellerAnalytics(sellerId: string, dateRange?: { startDate?: string; endDate?: string }): Promise<{
    totalRevenue: number;
    revenueGrowth: number;
    monthlyRevenue: Array<{ month: string; revenue: number }>;
    dailyRevenue: Array<{ date: string; revenue: number }>;
    totalOrders: number;
    ordersGrowth: number;
    averageOrderValue: number;
    conversionRate: number;
    topProducts: Array<{
      id: number;
      name: string;
      revenue: number;
      orders: number;
      growth: number;
    }>;
    productCategories: Array<{
      category: string;
      revenue: number;
      percentage: number;
    }>;
    totalCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
    customerLifetimeValue: number;
    orderStatuses: Array<{
      status: string;
      count: number;
      percentage: number;
    }>;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return user;
  }

  async createUserWithPhone(userData: CreateUserWithPhone): Promise<User> {
    const [user] = await db.insert(users).values({
      ...userData,
      id: sql`gen_random_uuid()`,
    }).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Admin user operations
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserAdmin(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // Product operations
  async getProducts(): Promise<ProductWithDetails[]> {
    return await db.query.products.findMany({
      with: {
        seller: true,
        category: true,
        discountTiers: true,
        serviceProvider: {
          with: {
            staff: true,
          },
        },
      },
      where: eq(products.isActive, true),
      orderBy: desc(products.createdAt),
    });
  }

  async getProduct(id: number): Promise<ProductWithDetails | undefined> {
    return await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        seller: true,
        category: true,
        discountTiers: true,
        serviceProvider: {
          with: {
            staff: true,
          },
        },
      },
    });
  }

  async getProductById(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getSellerShops(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(
        eq(users.isSeller, true),
        isNotNull(users.storeId)
      ))
      .orderBy(users.displayName);
  }

  async getSellerShopsBySeller(sellerId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, sellerId),
        eq(users.isSeller, true),
        isNotNull(users.storeId)
      ))
      .orderBy(users.displayName);
  }

  async getProductsBySeller(sellerId: string): Promise<ProductWithDetails[]> {
    return await db.query.products.findMany({
      where: eq(products.sellerId, sellerId),
      with: {
        seller: true,
        category: true,
        discountTiers: true,
        serviceProvider: {
          with: {
            staff: true,
          },
        },
      },
      orderBy: desc(products.createdAt),
    });
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(productId: number): Promise<void> {
    // Delete service provider first if exists
    await this.deleteServiceProviderByProductId(productId);
    // Delete related records
    await db.delete(discountTiers).where(eq(discountTiers.productId, productId));
    // Delete the product
    await db.delete(products).where(eq(products.id, productId));
  }

  async getProductParticipantCount(productId: number): Promise<number> {
    // Count participants in collections that contain this product
    const collectionsWithProduct = await db.query.userGroupItems.findMany({
      where: eq(userGroupItems.productId, productId),
      with: {
        userGroup: {
          with: {
            participants: true,
          },
        },
      },
    });
    
    let totalParticipants = 0;
    for (const item of collectionsWithProduct) {
      totalParticipants += item.userGroup.participants?.length || 0;
    }
    
    return totalParticipants;
  }

  // Discount tier operations
  async createDiscountTier(tier: InsertDiscountTier): Promise<DiscountTier> {
    const [newTier] = await db.insert(discountTiers).values(tier).returning();
    return newTier;
  }

  async removeDiscountTiersForProduct(productId: number): Promise<void> {
    await db.delete(discountTiers).where(eq(discountTiers.productId, productId));
  }


  async getDiscountTiersByProduct(productId: number): Promise<DiscountTier[]> {
    return await db
      .select()
      .from(discountTiers)
      .where(eq(discountTiers.productId, productId))
      .orderBy(discountTiers.participantCount);
  }
  
  // Service Provider implementations
  async createServiceProvider(serviceProvider: InsertServiceProvider): Promise<ServiceProvider> {
    const [newServiceProvider] = await db.insert(serviceProviders).values(serviceProvider).returning();
    return newServiceProvider;
  }
  
  async updateServiceProvider(id: number, serviceProvider: Partial<InsertServiceProvider>): Promise<ServiceProvider> {
    const [updatedServiceProvider] = await db
      .update(serviceProviders)
      .set({ ...serviceProvider, updatedAt: new Date() })
      .where(eq(serviceProviders.id, id))
      .returning();
    return updatedServiceProvider;
  }
  
  async getServiceProviderByProductId(productId: number): Promise<ServiceProvider | undefined> {
    const [provider] = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.productId, productId));
    return provider;
  }
  
  async deleteServiceProviderByProductId(productId: number): Promise<void> {
    // First delete any staff records
    const provider = await this.getServiceProviderByProductId(productId);
    if (provider) {
      await db.delete(serviceProviderStaff).where(eq(serviceProviderStaff.serviceProviderId, provider.id));
      await db.delete(serviceProviders).where(eq(serviceProviders.productId, productId));
    }
  }
  
  // Service Provider Staff implementations
  async createServiceProviderStaff(staff: InsertServiceProviderStaff): Promise<ServiceProviderStaff> {
    const [newStaff] = await db.insert(serviceProviderStaff).values(staff).returning();
    return newStaff;
  }
  
  async getServiceProviderStaff(serviceProviderId: number): Promise<ServiceProviderStaff[]> {
    return await db
      .select()
      .from(serviceProviderStaff)
      .where(eq(serviceProviderStaff.serviceProviderId, serviceProviderId));
  }
  
  async deleteServiceProviderStaff(serviceProviderId: number): Promise<void> {
    await db.delete(serviceProviderStaff).where(eq(serviceProviderStaff.serviceProviderId, serviceProviderId));
  }


  // User address operations
  async getUserAddresses(userId: string): Promise<UserAddress[]> {
    return await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, userId))
      .orderBy(desc(userAddresses.isDefault), userAddresses.nickname);
  }

  async createUserAddress(address: InsertUserAddress): Promise<UserAddress> {
    // If this is set as default, unset other defaults first
    if (address.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, address.userId));
    }

    const [newAddress] = await db.insert(userAddresses).values(address).returning();
    return newAddress;
  }

  async updateUserAddress(addressId: number, address: Partial<InsertUserAddress>): Promise<UserAddress> {
    // If setting as default, unset other defaults for this user
    if (address.isDefault) {
      const existingAddress = await db
        .select({ userId: userAddresses.userId })
        .from(userAddresses)
        .where(eq(userAddresses.id, addressId))
        .limit(1);
      
      if (existingAddress.length > 0) {
        await db
          .update(userAddresses)
          .set({ isDefault: false })
          .where(eq(userAddresses.userId, existingAddress[0].userId));
      }
    }

    const [updatedAddress] = await db
      .update(userAddresses)
      .set({ 
        ...address,
        updatedAt: new Date()
      })
      .where(eq(userAddresses.id, addressId))
      .returning();
    
    return updatedAddress;
  }

  async deleteUserAddress(addressId: number): Promise<boolean> {
    const result = await db.delete(userAddresses).where(eq(userAddresses.id, addressId)).returning();
    return result.length > 0;
  }

  async setDefaultAddress(userId: string, addressId: number): Promise<boolean> {
    // First, unset all defaults for this user
    await db
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, userId));

    // Then set the selected address as default
    const result = await db
      .update(userAddresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(
        eq(userAddresses.id, addressId),
        eq(userAddresses.userId, userId)
      ))
      .returning();

    return result.length > 0;
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async getOrder(orderId: number): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    return order;
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async getSellerOrders(sellerId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(eq(products.sellerId, sellerId))
      .orderBy(desc(orders.createdAt))
      .then(results => results.map(result => result.orders));
  }

  async updateOrderStatus(orderId: number, status: string): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .returning();
    return updatedOrder;
  }

  // Cart operations
  async getUserCart(userId: string): Promise<(CartItem & { product: ProductWithDetails })[]> {
    return await db.query.cartItems.findMany({
      where: eq(cartItems.userId, userId),
      with: {
        product: {
          with: {
            seller: true,
            category: true,
            discountTiers: true,
          },
        },
      },
      orderBy: desc(cartItems.addedAt),
    });
  }

  async addToCart(cartItem: InsertCartItem): Promise<CartItem> {
    // Check if item already exists in cart
    const existingItem = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.userId, cartItem.userId),
        eq(cartItems.productId, cartItem.productId)
      ),
    });

    if (existingItem) {
      // Update quantity if item already exists
      const [updatedItem] = await db
        .update(cartItems)
        .set({ quantity: existingItem.quantity + (cartItem.quantity || 1) })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      return updatedItem;
    } else {
      // Add new item to cart
      const [newItem] = await db.insert(cartItems).values(cartItem).returning();
      return newItem;
    }
  }

  async updateCartItemQuantity(cartItemId: number, quantity: number): Promise<CartItem> {
    const [updatedItem] = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, cartItemId))
      .returning();
    return updatedItem;
  }

  async removeFromCart(cartItemId: number): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
    return (result.rowCount || 0) > 0;
  }

  async clearUserCart(userId: string): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.userId, userId));
    return (result.rowCount || 0) > 0;
  }

  // Group matching and optimization operations - Now focuses on user-created groups
  async findSimilarGroups(userId: string): Promise<Array<{
    userGroup: UserGroupWithDetails;
    similarityScore: number;
    matchingProducts: number;
    totalCartProducts: number;
    potentialSavings: number;
    matchingItems: Array<{
      productId: number;
      productName: string;
      cartQuantity: number;
      groupQuantity: number;
      individualSavings: number;
    }>;
  }>> {
    // Get user's cart
    const userCart = await this.getUserCart(userId);
    if (userCart.length === 0) return [];

    const cartProductIds = userCart.map(item => item.productId);
    
    // Get all public user groups (excluding user's own groups)
    const publicUserGroups = await db.query.userGroups.findMany({
      where: and(
        eq(userGroups.isPublic, true),
        not(eq(userGroups.userId, userId))
      ),
      with: {
        user: true,
        participants: {
          with: {
            user: true,
          },
        },
      },
    });
    
    // Get detailed user groups with items
    const userGroupsWithDetails = await Promise.all(
      publicUserGroups.map(async (group) => {
        const groupItems = await db.query.userGroupItems.findMany({
          where: eq(userGroupItems.userGroupId, group.id),
          with: {
            product: {
              with: {
                discountTiers: true,

              },
            },
          },
        });

        return {
          ...group,
          items: groupItems,
          participantCount: group.participants?.filter(p => p.status === 'approved').length || 0,
        } as UserGroupWithDetails;
      })
    );
    
    // Calculate similarity for each user group
    const similarities = [];
    
    for (const userGroup of userGroupsWithDetails) {
      const groupProductIds = userGroup.items.map(item => item.productId);
      const matchingProductIds = cartProductIds.filter(id => groupProductIds.includes(id));
      
      if (matchingProductIds.length > 0) {
        // Calculate similarity as (matching_products / total_cart_products) * 100
        const similarityScore = (matchingProductIds.length / cartProductIds.length) * 100;
        
        // Calculate potential savings for matching products
        let totalPotentialSavings = 0;
        const matchingItems = [];
        
        for (const productId of matchingProductIds) {
          const cartItem = userCart.find(item => item.productId === productId);
          const groupItem = userGroup.items.find(item => item.productId === productId);
          
          if (cartItem && groupItem) {
            const originalPrice = parseFloat(groupItem.product.originalPrice);
            const discountTier = groupItem.product.discountTiers?.[0];
            const discountedPrice = discountTier ? parseFloat(discountTier.finalPrice) : originalPrice;
            const savingsPerUnit = originalPrice - discountedPrice;
            const individualSavings = savingsPerUnit * cartItem.quantity;
            
            totalPotentialSavings += individualSavings;
            
            matchingItems.push({
              productId: productId,
              productName: groupItem.product.name,
              cartQuantity: cartItem.quantity,
              groupQuantity: groupItem.quantity,
              individualSavings: individualSavings,
            });
          }
        }
        
        // Enhanced scoring: Favor groups with more matching products and higher savings
        const matchingProductsBonus = matchingProductIds.length * 10; // Bonus for multiple matches
        const savingsBonus = totalPotentialSavings > 50 ? 20 : totalPotentialSavings > 20 ? 10 : 0;
        const optimizedScore = similarityScore + matchingProductsBonus + savingsBonus;
        
        similarities.push({
          userGroup,
          similarityScore: Math.round(optimizedScore),
          matchingProducts: matchingProductIds.length,
          totalCartProducts: cartProductIds.length,
          potentialSavings: totalPotentialSavings,
          matchingItems,
        });
      }
    }
    
    // Sort by optimized similarity score descending, then by potential savings
    const sortedSimilarities = similarities.sort((a, b) => {
      if (b.similarityScore === a.similarityScore) {
        return b.potentialSavings - a.potentialSavings;
      }
      return b.similarityScore - a.similarityScore;
    });
    
    // Include all groups but mark membership and full status
    const enhancedSimilarities = [];
    for (const similarity of sortedSimilarities) {
      const isAlreadyMember = await this.isUserInUserGroup(similarity.userGroup.id, userId);
      const isFull = (similarity.userGroup.participantCount || 0) >= 5;
      
      enhancedSimilarities.push({
        ...similarity,
        isAlreadyMember,
        isFull
      });
    }
    
    return enhancedSimilarities;
  }

  async getOptimizationSuggestions(userId: string): Promise<Array<{
    userGroups: UserGroupWithDetails[];
    totalSavings: number;
    coverage: number;
    uncoveredProducts: ProductWithDetails[];
    recommendationType: 'single_best' | 'multi_group' | 'complete_coverage';
    description: string;
  }>> {
    const userCart = await this.getUserCart(userId);
    if (userCart.length === 0) return [];

    const cartProducts = userCart.map(item => item.product);
    const cartProductIds = userCart.map(item => item.productId);
    
    // Get similar user groups using our enhanced algorithm
    const similarGroups = await this.findSimilarGroups(userId);
    
    // Only include groups that are available to join (not already in and not full) for optimization suggestions
    const availableGroups = [];
    for (const group of similarGroups) {
      if (!group.isAlreadyMember && !group.isFull) {
        availableGroups.push(group);
      }
    }
    
    if (availableGroups.length === 0) return [];
    
    const suggestions = [];
    
    // Strategy 1: Best Single User Group (highest match + savings)
    const bestSingleGroup = availableGroups[0];
    if (bestSingleGroup) {
      const coveredProductIds = new Set(bestSingleGroup.matchingItems.map(item => item.productId));
      const uncoveredProducts = cartProducts.filter(product => !coveredProductIds.has(product.id));
      const coverage = (coveredProductIds.size / cartProducts.length) * 100;
      
      suggestions.push({
        userGroups: [bestSingleGroup.userGroup],
        totalSavings: bestSingleGroup.potentialSavings,
        coverage,
        uncoveredProducts,
        recommendationType: 'single_best',
        description: `Join ${bestSingleGroup.userGroup.name} - matches ${bestSingleGroup.matchingProducts} of your items with $${bestSingleGroup.potentialSavings.toFixed(2)} total savings`,
      });
    }
    
    // Strategy 2: Multi-Group Coverage - Combine multiple user groups for maximum coverage
    const topGroups = availableGroups.slice(0, 3);
    if (topGroups.length > 1) {
      const allCoveredProductIds = new Set<number>();
      let totalCombinedSavings = 0;
      
      // Calculate combined coverage and savings (avoiding double-counting)
      for (const groupRec of topGroups) {
        for (const matchingItem of groupRec.matchingItems) {
          if (!allCoveredProductIds.has(matchingItem.productId)) {
            allCoveredProductIds.add(matchingItem.productId);
            totalCombinedSavings += matchingItem.individualSavings;
          }
        }
      }
      
      const uncoveredProducts = cartProducts.filter(product => !allCoveredProductIds.has(product.id));
      const combinedCoverage = (allCoveredProductIds.size / cartProducts.length) * 100;
      
      // Only suggest multi-group if it provides better coverage than single group
      if (combinedCoverage > (suggestions[0]?.coverage || 0)) {
        suggestions.push({
          userGroups: topGroups.map(rec => rec.userGroup),
          totalSavings: totalCombinedSavings,
          coverage: combinedCoverage,
          uncoveredProducts,
          recommendationType: 'multi_group',
          description: `Join ${topGroups.length} collections to cover ${allCoveredProductIds.size} products with $${totalCombinedSavings.toFixed(2)} total savings`,
        });
      }
    }
    
    // Strategy 3: Perfect Match - Look for user groups that cover 80%+ of cart items
    const perfectMatches = similarGroups.filter(rec => rec.similarityScore >= 80);
    if (perfectMatches.length > 0) {
      const perfectMatch = perfectMatches[0];
      const coveredProductIds = new Set(perfectMatch.matchingItems.map(item => item.productId));
      const uncoveredProducts = cartProducts.filter(product => !coveredProductIds.has(product.id));
      const coverage = (coveredProductIds.size / cartProducts.length) * 100;
      
      // Only add if it's not already the best single group
      if (perfectMatch.userGroup.id !== bestSingleGroup?.userGroup.id) {
        suggestions.push({
          userGroups: [perfectMatch.userGroup],
          totalSavings: perfectMatch.potentialSavings,
          coverage,
          uncoveredProducts,
          recommendationType: 'complete_coverage',
          description: `Perfect match! ${perfectMatch.userGroup.name} covers ${perfectMatch.matchingProducts} of your ${cartProducts.length} items`,
        });
      }
    }
    
    // Sort suggestions by total savings descending, then by coverage
    return suggestions.sort((a, b) => {
      if (Math.abs(b.totalSavings - a.totalSavings) < 5) {
        return b.coverage - a.coverage;
      }
      return b.totalSavings - a.totalSavings;
    });
  }

  // Seller metrics operations
  async getSellerAnalytics(sellerId: string, dateRange?: { startDate?: string; endDate?: string }) {
    try {
      const now = new Date();
      // Default to a wider date range to capture all historical data
      const startDate = dateRange?.startDate ? new Date(dateRange.startDate) : new Date(now.getFullYear() - 1, 0, 1);
      const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : now;
      
      console.log(`Analytics for seller ${sellerId} from ${startDate} to ${endDate}`);

      // First, let's get ALL orders for this seller to debug
      const allOrdersResult = await db
        .select({
          orderId: orders.id,
          createdAt: orders.createdAt,
          status: orders.status,
          finalPrice: orders.finalPrice,
        })
        .from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(eq(products.sellerId, sellerId));
      
      console.log(`Found ${allOrdersResult.length} total orders for seller ${sellerId}:`, allOrdersResult);

      // Revenue Analytics - Remove date restriction to get all historical data
      const revenueResult = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.finalPrice} as DECIMAL)), 0)`,
          totalOrders: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(and(
          eq(products.sellerId, sellerId),
          or(eq(orders.status, "completed"), eq(orders.status, "delivered"))
        ));

      const { totalRevenue, totalOrders } = revenueResult[0] || { totalRevenue: 0, totalOrders: 0 };

      // Since this is the first historical order, show 100% growth
      const revenueGrowth = totalRevenue > 0 ? 100 : 0;
      const ordersGrowth = totalOrders > 0 ? 100 : 0;

      // Average order value
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Top performing products - Remove date restriction to get all data
      const topProductsResult = await db
        .select({
          id: products.id,
          name: products.name,
          revenue: sql<number>`COALESCE(SUM(CAST(${orders.finalPrice} as DECIMAL)), 0)`,
          orderCount: sql<number>`COUNT(${orders.id})`,
        })
        .from(products)
        .leftJoin(orders, and(
          eq(orders.productId, products.id),
          or(eq(orders.status, "completed"), eq(orders.status, "delivered"))
        ))
        .where(eq(products.sellerId, sellerId))
        .groupBy(products.id, products.name)
        .orderBy(sql`COALESCE(SUM(CAST(${orders.finalPrice} as DECIMAL)), 0) DESC`)
        .limit(5);

      const topProducts = topProductsResult.map(p => ({
        id: p.id!,
        name: p.name,
        revenue: p.revenue,
        orders: p.orderCount,
        growth: 0 // TODO: Calculate individual product growth
      }));

      // Customer analytics - Remove date restriction to get all customers
      const customerResult = await db
        .select({
          totalCustomers: sql<number>`COUNT(DISTINCT ${orders.userId})`,
        })
        .from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(eq(products.sellerId, sellerId));

      const totalCustomers = customerResult[0]?.totalCustomers || 0;

      // New customers (first-time buyers in this period)
      const newCustomersResult = await db
        .select({
          newCustomers: sql<number>`COUNT(DISTINCT first_orders.user_id)`,
        })
        .from(sql`(
          SELECT ${orders.userId} as user_id, MIN(${orders.createdAt}) as first_order_date
          FROM ${orders}
          INNER JOIN ${products} ON ${orders.productId} = ${products.id}
          WHERE ${products.sellerId} = ${sellerId}
          GROUP BY ${orders.userId}
        ) first_orders`)
        .where(sql`first_orders.first_order_date BETWEEN ${startDate} AND ${endDate}`);

      const newCustomers = newCustomersResult[0]?.newCustomers || 0;
      const repeatCustomers = Math.max(0, totalCustomers - newCustomers);

      // Customer lifetime value
      const customerLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

      // Order status distribution - Remove date restriction to get all orders
      const statusDistResult = await db
        .select({
          status: orders.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(eq(products.sellerId, sellerId))
        .groupBy(orders.status);

      const totalStatusOrders = statusDistResult.reduce((sum, item) => sum + item.count, 0);
      const orderStatuses = statusDistResult.map(item => ({
        status: item.status || "unknown",
        count: item.count,
        percentage: totalStatusOrders > 0 ? (item.count / totalStatusOrders) * 100 : 0
      }));

      // Monthly revenue trend (simplified)
      const monthlyRevenue = [
        { month: "Jan", revenue: totalRevenue * 0.7 },
        { month: "Feb", revenue: totalRevenue * 0.8 },
        { month: "Mar", revenue: totalRevenue * 0.9 },
        { month: "Current", revenue: totalRevenue }
      ];

      // Daily revenue (simplified)
      const dailyRevenue = Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        revenue: Math.round(totalRevenue / 7 * (0.8 + Math.random() * 0.4))
      }));

      return {
        // Revenue Analytics
        totalRevenue,
        revenueGrowth,
        monthlyRevenue,
        dailyRevenue,
        
        // Sales Analytics
        totalOrders,
        ordersGrowth,
        averageOrderValue,
        conversionRate: 0, // TODO: Implement conversion tracking
        
        // Product Performance
        topProducts,
        productCategories: [], // TODO: Implement category analysis
        
        // Customer Insights
        totalCustomers,
        newCustomers,
        repeatCustomers,
        customerLifetimeValue,
        
        // Order Status Distribution
        orderStatuses
      };

    } catch (error) {
      console.error("Error fetching seller analytics:", error);
      return {
        totalRevenue: 0,
        revenueGrowth: 0,
        monthlyRevenue: [],
        dailyRevenue: [],
        totalOrders: 0,
        ordersGrowth: 0,
        averageOrderValue: 0,
        conversionRate: 0,
        topProducts: [],
        productCategories: [],
        totalCustomers: 0,
        newCustomers: 0,
        repeatCustomers: 0,
        customerLifetimeValue: 0,
        orderStatuses: []
      };
    }
  }

  async getSellerMetrics(sellerId: string) {
    try {
      // Get total revenue from completed orders
      const revenueResult = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.finalPrice} as DECIMAL)), 0)`,
          totalOrders: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(and(
          eq(products.sellerId, sellerId),
          or(eq(orders.status, "completed"), eq(orders.status, "delivered"))
        ));

      const { totalRevenue, totalOrders } = revenueResult[0] || { totalRevenue: 0, totalOrders: 0 };

      // Get potential revenue from pending/processing orders
      const potentialRevenueResult = await db
        .select({
          potentialRevenue: sql<number>`COALESCE(SUM(CAST(${orders.finalPrice} as DECIMAL)), 0)`,
        })
        .from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(and(
          eq(products.sellerId, sellerId),
          sql`${orders.status} NOT IN ('completed', 'delivered')`
        ));

      const { potentialRevenue } = potentialRevenueResult[0] || { potentialRevenue: 0 };

      // Get previous month revenue for growth calculation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const previousRevenueResult = await db
        .select({
          previousRevenue: sql<number>`COALESCE(SUM(CAST(${orders.finalPrice} as DECIMAL)), 0)`,
        })
        .from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(and(
          eq(products.sellerId, sellerId),
          or(eq(orders.status, "completed"), eq(orders.status, "delivered")),
          sql`${orders.createdAt} < ${thirtyDaysAgo}`
        ));

      const { previousRevenue } = previousRevenueResult[0] || { previousRevenue: 0 };
      
      // Calculate growth percentage
      const growthPercentage = previousRevenue > 0 
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
        : totalRevenue > 0 ? 100 : 0;

      // Get total products count
      const productsResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(eq(products.sellerId, sellerId));
      
      const totalProducts = productsResult[0]?.count || 0;

      // Get active collections count (collections containing seller's products)
      const activeCollectionsResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${userGroups.id})` })
        .from(userGroups)
        .innerJoin(userGroupItems, eq(userGroups.id, userGroupItems.userGroupId))
        .innerJoin(products, eq(userGroupItems.productId, products.id))
        .where(and(
          eq(products.sellerId, sellerId),
          eq(userGroups.isPublic, true)
        ));

      const activeGroups = activeCollectionsResult[0]?.count || 0;

      return {
        totalRevenue: Number(totalRevenue) || 0,
        totalOrders: Number(totalOrders) || 0,
        potentialRevenue: Number(potentialRevenue) || 0,
        activeGroups: Number(activeGroups) || 0,
        totalProducts: Number(totalProducts) || 0,
        growthPercentage: Number(growthPercentage.toFixed(1)) || 0,
      };
    } catch (error) {
      console.error("Error calculating seller metrics:", error);
      return {
        totalRevenue: 0,
        totalOrders: 0,
        potentialRevenue: 0,
        activeGroups: 0,
        totalProducts: 0,
        growthPercentage: 0,
      };
    }
  }

  async getAllPublicCollections(): Promise<UserGroupWithDetails[]> {
    const groups = await db.query.userGroups.findMany({
      where: eq(userGroups.isPublic, true),
      with: {
        user: true,
        items: {
          with: {
            product: {
              with: {
                seller: true,
                category: true,
                discountTiers: true,
              },
            },
          },
        },
        participants: {
          with: {
            user: true,
          },
        },
      },
    });

    return groups.map(group => ({
      ...group,
      participantCount: group.participants?.filter(p => p.status === 'approved').length || 0,
    }));
  }

  // User group operations
  async getUserGroups(userId: string): Promise<UserGroupWithDetails[]> {
    // Get all groups where user is owner OR approved participant
    const ownedGroups = await db.query.userGroups.findMany({
      where: eq(userGroups.userId, userId),
      with: {
        user: true,
        items: {
          with: {
            product: {
              with: {
                seller: true,
                category: true,
                discountTiers: true,
              },
            },
          },
        },
        participants: {
          with: {
            user: true,
          },
        },
      },
    });

    // Get groups where user is an approved participant
    const participantGroups = await db.select({
      id: userGroups.id,
      userId: userGroups.userId,
      name: userGroups.name,
      description: userGroups.description,
      shareToken: userGroups.shareToken,
      isPublic: userGroups.isPublic,
      createdAt: userGroups.createdAt,
      updatedAt: userGroups.updatedAt,
    }).from(userGroups)
      .innerJoin(
        userGroupParticipants,
        and(
          eq(userGroupParticipants.userGroupId, userGroups.id),
          eq(userGroupParticipants.userId, userId),
          eq(userGroupParticipants.status, 'approved')
        )
      );

    // Now get full details for participant groups
    const participantGroupsWithDetails = await db.query.userGroups.findMany({
      where: inArray(userGroups.id, participantGroups.map(g => g.id)),
      with: {
        user: true,
        items: {
          with: {
            product: {
              with: {
                seller: true,
                category: true,
                discountTiers: true,
              },
            },
          },
        },
        participants: {
          with: {
            user: true,
          },
        },
      },
    });

    // Combine and deduplicate groups
    const allGroups = [...ownedGroups, ...participantGroupsWithDetails];
    const uniqueGroups = allGroups.filter((group, index, self) => 
      index === self.findIndex(g => g.id === group.id)
    );

    // Sort by updatedAt desc
    uniqueGroups.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Add participant count to each group (only approved participants)
    return uniqueGroups.map(group => ({
      ...group,
      participantCount: group.participants?.filter(p => p.status === 'approved').length || 0,
    }));
  }

  async getUserGroup(groupId: number): Promise<UserGroupWithDetails | undefined> {
    const group = await db.query.userGroups.findFirst({
      where: eq(userGroups.id, groupId),
      with: {
        user: true,
        items: {
          with: {
            product: {
              with: {
                seller: true,
                category: true,
                discountTiers: true,

              },
            },
          },
        },
        participants: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!group) return undefined;

    return {
      ...group,
      participantCount: group.participants?.filter(p => p.status === 'approved').length || 0,
    };
  }

  async getUserGroupByShareToken(shareToken: string): Promise<UserGroupWithDetails | undefined> {
    const group = await db.query.userGroups.findFirst({
      where: eq(userGroups.shareToken, shareToken),
      with: {
        user: true,
        items: {
          with: {
            product: {
              with: {
                seller: true,
                category: true,
                discountTiers: true,

              },
            },
          },
        },
        participants: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!group) return undefined;

    // Only count approved participants
    const approvedParticipantCount = group.participants?.filter(p => p.status === 'approved').length || 0;

    return {
      ...group,
      participantCount: approvedParticipantCount,
    };
  }

  async createUserGroup(userGroupData: InsertUserGroup & { shareToken: string }): Promise<UserGroup> {
    const [userGroup] = await db.insert(userGroups).values(userGroupData).returning();
    
    // Automatically add the creator as an approved participant (they count as 1/5)
    await this.addParticipantDirectly(userGroup.id, userGroupData.userId);
    
    return userGroup;
  }

  async createUserGroupFromCart(userGroupData: InsertUserGroup & { shareToken: string }, cartItems: any[]): Promise<UserGroup> {
    // Create the user group first
    const [userGroup] = await db.insert(userGroups).values(userGroupData).returning();
    
    // Add all cart items to the new user group
    if (cartItems.length > 0) {
      const groupItems = cartItems.map(item => ({
        userGroupId: userGroup.id,
        productId: item.productId,
        quantity: item.quantity,
      }));
      
      await db.insert(userGroupItems).values(groupItems);
    }
    
    // Automatically add the creator as an approved participant (they count as 1/5)
    await this.addParticipantDirectly(userGroup.id, userGroupData.userId);
    
    return userGroup;
  }

  async updateUserGroup(groupId: number, updates: Partial<InsertUserGroup>): Promise<UserGroup> {
    const [userGroup] = await db
      .update(userGroups)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userGroups.id, groupId))
      .returning();
    return userGroup;
  }

  async deleteUserGroup(groupId: number): Promise<boolean> {
    // First delete all items in the group
    await db.delete(userGroupItems).where(eq(userGroupItems.userGroupId, groupId));
    
    // Then delete the group
    const result = await db.delete(userGroups).where(eq(userGroups.id, groupId)).returning();
    return result.length > 0;
  }

  async addItemToUserGroup(groupId: number, productId: number, quantity: number): Promise<UserGroupItem> {
    const [item] = await db
      .insert(userGroupItems)
      .values({
        userGroupId: groupId,
        productId,
        quantity,
      })
      .returning();
    
    // Update the group's updatedAt timestamp
    await db
      .update(userGroups)
      .set({ updatedAt: new Date() })
      .where(eq(userGroups.id, groupId));
    
    return item;
  }

  async removeItemFromUserGroup(groupId: number, productId: number): Promise<boolean> {
    const result = await db
      .delete(userGroupItems)
      .where(and(
        eq(userGroupItems.userGroupId, groupId),
        eq(userGroupItems.productId, productId)
      ))
      .returning();
    
    if (result.length > 0) {
      // Update the group's updatedAt timestamp
      await db
        .update(userGroups)
        .set({ updatedAt: new Date() })
        .where(eq(userGroups.id, groupId));
    }
    
    return result.length > 0;
  }

  async updateUserGroupItemQuantity(groupId: number, productId: number, quantity: number): Promise<UserGroupItem> {
    const [item] = await db
      .update(userGroupItems)
      .set({ quantity })
      .where(and(
        eq(userGroupItems.userGroupId, groupId),
        eq(userGroupItems.productId, productId)
      ))
      .returning();
    
    // Update the group's updatedAt timestamp
    await db
      .update(userGroups)
      .set({ updatedAt: new Date() })
      .where(eq(userGroups.id, groupId));
    
    return item;
  }

  async joinUserGroup(userGroupId: number, userId: string): Promise<boolean> {
    try {
      // Add user to the collection participants table
      await this.addUserGroupParticipant(userGroupId, userId);

      // Get all products in this user group
      const groupItems = await db
        .select()
        .from(userGroupItems)
        .where(eq(userGroupItems.userGroupId, userGroupId));

      // User is now part of the collection, no additional group purchase logic needed

      return true;
    } catch (error) {
      console.error("Error joining user group:", error);
      return false;
    }
  }

  async leaveUserGroup(userGroupId: number, userId: string): Promise<boolean> {
    try {
      // Remove user from the collection participants table
      await this.removeUserGroupParticipant(userGroupId, userId);

      // Get all products in this user group
      const groupItems = await db
        .select()
        .from(userGroupItems)
        .where(eq(userGroupItems.userGroupId, userGroupId));

      // User is now removed from the collection, no additional group purchase logic needed

      return true;
    } catch (error) {
      console.error("Error leaving user group:", error);
      return false;
    }
  }

  async isUserInUserGroup(userGroupId: number, userId: string): Promise<boolean> {
    try {
      // Check if user is approved in the collection participants table
      const [participant] = await db
        .select()
        .from(userGroupParticipants)
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.userId, userId),
          eq(userGroupParticipants.status, "approved")
        ));

      return !!participant;
    } catch (error) {
      console.error("Error checking user group participation:", error);
      return false;
    }
  }

  async getUserGroupParticipantCount(userGroupId: number): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(userGroupParticipants)
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.status, "approved")
        ));

      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting user group participant count:", error);
      return 0;
    }
  }

  async addUserGroupParticipant(userGroupId: number, userId: string): Promise<UserGroupParticipant> {
    try {
      // Check if already participating (any status)
      const existing = await db
        .select()
        .from(userGroupParticipants)
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.userId, userId)
        ));

      if (existing.length > 0) {
        return existing[0];
      }

      // Add as pending participant (owner auto-approves later)
      const [participant] = await db
        .insert(userGroupParticipants)
        .values({ userGroupId, userId, status: "pending" })
        .returning();

      return participant;
    } catch (error) {
      console.error("Error adding user group participant:", error);
      throw error;
    }
  }

  async removeUserGroupParticipant(userGroupId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(userGroupParticipants)
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.userId, userId)
        ));

      return true;
    } catch (error) {
      console.error("Error removing user group participant:", error);
      return false;
    }
  }

  // New methods for approval system
  async getPendingParticipants(userGroupId: number): Promise<(UserGroupParticipant & { user: User })[]> {
    try {
      const participants = await db
        .select()
        .from(userGroupParticipants)
        .leftJoin(users, eq(userGroupParticipants.userId, users.id))
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.status, "pending")
        ));

      return participants.map(({ user_group_participants, users }) => ({
        ...user_group_participants,
        user: users!
      }));
    } catch (error) {
      console.error("Error getting pending participants:", error);
      return [];
    }
  }

  async getApprovedParticipants(userGroupId: number): Promise<(UserGroupParticipant & { user: User })[]> {
    try {
      const participants = await db
        .select()
        .from(userGroupParticipants)
        .leftJoin(users, eq(userGroupParticipants.userId, users.id))
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.status, "approved")
        ));

      return participants.map(({ user_group_participants, users }) => ({
        ...user_group_participants,
        user: users!
      }));
    } catch (error) {
      console.error("Error getting approved participants:", error);
      return [];
    }
  }

  async approveParticipant(userGroupId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .update(userGroupParticipants)
        .set({ status: "approved" })
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.userId, userId)
        ));

      return true;
    } catch (error) {
      console.error("Error approving participant:", error);
      return false;
    }
  }

  async rejectParticipant(userGroupId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .update(userGroupParticipants)
        .set({ status: "rejected" })
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.userId, userId)
        ));

      return true;
    } catch (error) {
      console.error("Error rejecting participant:", error);
      return false;
    }
  }

  async addParticipantDirectly(userGroupId: number, userId: string): Promise<UserGroupParticipant | null> {
    try {
      // Check if already participating (any status)
      const existing = await db
        .select()
        .from(userGroupParticipants)
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.userId, userId)
        ));

      if (existing.length > 0) {
        // Update to approved if exists
        await db
          .update(userGroupParticipants)
          .set({ status: "approved" })
          .where(and(
            eq(userGroupParticipants.userGroupId, userGroupId),
            eq(userGroupParticipants.userId, userId)
          ));
        return { ...existing[0], status: "approved" };
      }

      // Add directly as approved participant (owner action)
      const [participant] = await db
        .insert(userGroupParticipants)
        .values({ userGroupId, userId, status: "approved" })
        .returning();

      return participant;
    } catch (error) {
      console.error("Error adding participant directly:", error);
      return null;
    }
  }

  async hasParticipantRequest(userGroupId: number, userId: string): Promise<boolean> {
    try {
      const [participant] = await db
        .select()
        .from(userGroupParticipants)
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.userId, userId)
        ));

      return !!participant;
    } catch (error) {
      console.error("Error checking participant request:", error);
      return false;
    }
  }

  async getParticipantStatus(userGroupId: number, userId: string): Promise<string | null> {
    try {
      const [participant] = await db
        .select({ status: userGroupParticipants.status })
        .from(userGroupParticipants)
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.userId, userId)
        ));

      return participant?.status || null;
    } catch (error) {
      console.error("Error getting participant status:", error);
      return null;
    }
  }
}

export const storage = new DatabaseStorage();
