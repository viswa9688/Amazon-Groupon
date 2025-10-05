import {
  users,
  products,
  categories,
  discountTiers,
  orders,
  orderItems,
  userAddresses,
  cartItems,
  userGroups,
  userGroupItems,
  userGroupParticipants,
  groupPayments,
  serviceProviders,
  serviceProviderStaff,
  petProviders,
  petProviderStaff,
  groceryProducts,
  adminCredentials,
  sellerNotifications,
  sessions,
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
  type OrderItem,
  type InsertOrderItem,
  type CartItem,
  type InsertCartItem,
  type UserGroup,
  type InsertUserGroup,
  type UserGroupItem,
  type InsertUserGroupItem,
  type UserGroupParticipant,
  type InsertUserGroupParticipant,
  type GroupPayment,
  type InsertGroupPayment,
  type ProductWithDetails,
  type UserGroupWithDetails,
  type ServiceProvider,
  type InsertServiceProvider,
  type ServiceProviderStaff,
  type InsertServiceProviderStaff,
  type PetProvider,
  type InsertPetProvider,
  type PetProviderStaff,
  type InsertPetProviderStaff,
  type GroceryProduct,
  type InsertGroceryProduct,
  type AdminCredentials,
  type SellerNotification,
  type InsertSellerNotification,
} from "@shared/schema";
import { db, queryWithRetry } from "./db";
import { eq, desc, and, or, sql, gte, not, exists, inArray, isNotNull } from "drizzle-orm";
import bcrypt from "bcrypt";

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
  
  // Admin credentials operations
  getAdminCredentials(userId: string): Promise<AdminCredentials | undefined>;
  validateAdminCredentials(userId: string, password: string): Promise<boolean>;
  
  // Session management operations
  invalidateUserSessions(userId: string): Promise<void>;
  updateUserSessions(userId: string, updates: Partial<User>): Promise<void>;

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

  // Pet Provider operations
  createPetProvider(petProvider: InsertPetProvider): Promise<PetProvider>;
  updatePetProvider(id: number, petProvider: Partial<InsertPetProvider>): Promise<PetProvider>;
  getPetProviderByProductId(productId: number): Promise<PetProvider | undefined>;
  deletePetProviderByProductId(productId: number): Promise<void>;
  
  // Pet Provider Staff operations
  createPetProviderStaff(staff: InsertPetProviderStaff): Promise<PetProviderStaff>;
  getPetProviderStaff(petProviderId: number): Promise<PetProviderStaff[]>;
  deletePetProviderStaff(petProviderId: number): Promise<void>;

  // Grocery Product operations
  createGroceryProduct(groceryProduct: InsertGroceryProduct): Promise<GroceryProduct>;
  getGroceryProductByProductId(productId: number): Promise<GroceryProduct | undefined>;
  updateGroceryProduct(productId: number, groceryProduct: Partial<InsertGroceryProduct>): Promise<GroceryProduct>;
  deleteGroceryProductByProductId(productId: number): Promise<void>;

  // Discount tier operations
  createDiscountTier(tier: InsertDiscountTier): Promise<DiscountTier>;
  getDiscountTiersByProduct(productId: number): Promise<DiscountTier[]>;


  // User address operations
  getUserAddresses(userId: string): Promise<UserAddress[]>;
  createUserAddress(address: InsertUserAddress): Promise<UserAddress>;
  updateUserAddress(addressId: number, address: Partial<InsertUserAddress>): Promise<UserAddress>;
  deleteUserAddress(addressId: number): Promise<boolean>;
  setDefaultAddress(userId: string, addressId: number): Promise<boolean>;
  countGroupsUsingAddress(addressId: number): Promise<number>;

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderWithItems(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  getOrder(orderId: number): Promise<Order | undefined>;
  getOrderWithItems(orderId: number): Promise<(Order & { items: (OrderItem & { product: ProductWithDetails })[] }) | undefined>;
  getUserOrders(userId: string): Promise<Order[]>;
  getUserOrdersWithItems(userId: string): Promise<(Order & { items: (OrderItem & { product: ProductWithDetails })[] })[]>;
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
  getUserJoinedGroups(userId: string): Promise<UserGroupWithDetails[]>;
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
  isUserGroupLocked(userGroupId: number): Promise<boolean>;
  
  // Group payment operations
  createGroupPayment(payment: InsertGroupPayment): Promise<GroupPayment>;
  getGroupPayment(paymentId: number): Promise<GroupPayment | undefined>;
  getGroupPaymentsByUser(userId: string): Promise<GroupPayment[]>;
  getGroupPaymentsByGroup(userGroupId: number): Promise<GroupPayment[]>;
  getGroupPaymentsByProduct(userGroupId: number, productId: number): Promise<GroupPayment[]>;
  getGroupPaymentByStripeIntent(stripePaymentIntentId: string): Promise<GroupPayment | undefined>;
  updateGroupPaymentStatus(paymentId: number, status: string): Promise<GroupPayment>;
  updateGroupPaymentStripeIntent(paymentId: number, stripePaymentIntentId: string): Promise<GroupPayment>;
  hasUserPaidForProduct(userId: string, userGroupId: number, productId: number): Promise<boolean>;
  
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
  
  // Seller notification operations
  createSellerNotification(notification: InsertSellerNotification): Promise<SellerNotification>;
  getSellerNotifications(sellerId: string, limit?: number): Promise<SellerNotification[]>;
  getUnreadSellerNotificationCount(sellerId: string): Promise<number>;
  markNotificationAsRead(notificationId: number): Promise<SellerNotification>;
  markAllNotificationsAsRead(sellerId: string): Promise<void>;
  deleteNotification(notificationId: number): Promise<boolean>;
  
  // Group participant operations
  hasParticipantRequest(userGroupId: number, userId: string): Promise<boolean>;
  getParticipantStatus(userGroupId: number, userId: string): Promise<string | null>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return queryWithRetry(
      async () => {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
      },
      `getUser(${id})`
    );
  }

  async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    return queryWithRetry(
      async () => {
        const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
        return user;
      },
      `getUserByPhone(${phoneNumber})`
    );
  }

  async createUserWithPhone(userData: CreateUserWithPhone): Promise<User> {
    return queryWithRetry(
      async () => {
        const [user] = await db.insert(users).values({
          ...userData,
          id: sql`gen_random_uuid()`,
        }).returning();
        return user;
      },
      `createUserWithPhone(${userData.phoneNumber})`
    );
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    return queryWithRetry(
      async () => {
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
      },
      `upsertUser(${userData.id})`
    );
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
    try {
      const [user] = await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      if (!user) {
        throw new Error(`User with id ${id} not found`);
      }
      
      return user;
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === '23505') { // PostgreSQL unique violation error code
        if (error.constraint?.includes('phone_number')) {
          throw new Error('Phone number already exists');
        } else if (error.constraint?.includes('email')) {
          throw new Error('Email already exists');
        } else if (error.constraint?.includes('store_id')) {
          throw new Error('Store ID already exists');
        } else {
          throw new Error('A field with this value already exists');
        }
      }
      
      // Handle foreign key constraint violations
      if (error.code === '23503') {
        throw new Error('Referenced record does not exist');
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      // Use a transaction to ensure atomic deletion
      await db.transaction(async (tx) => {
        // First, get all products for this seller
        const sellerProducts = await tx.select().from(products).where(eq(products.sellerId, id));
        
        // Delete all products and their related data in correct order
        for (const product of sellerProducts) {
          // First, handle service provider and staff deletion (handles serviceProviderStaff → serviceProviders FK)
          const provider = await tx.select().from(serviceProviders).where(eq(serviceProviders.productId, product.id));
          if (provider.length > 0) {
            // Delete service provider staff first
            await tx.delete(serviceProviderStaff).where(eq(serviceProviderStaff.serviceProviderId, provider[0].id));
            // Then delete the service provider
            await tx.delete(serviceProviders).where(eq(serviceProviders.productId, product.id));
          }
          
          // Delete related discount tiers
          await tx.delete(discountTiers).where(eq(discountTiers.productId, product.id));
          
          // Delete the product itself
          await tx.delete(products).where(eq(products.id, product.id));
        }
        
        // Delete admin credentials if they exist (handles adminCredentials → users FK)
        await tx.delete(adminCredentials).where(eq(adminCredentials.userId, id));
        
        // Finally delete the user
        await tx.delete(users).where(eq(users.id, id));
      });
      
      // Invalidate user sessions after successful deletion
      await this.invalidateUserSessions(id);
      
    } catch (error) {
      console.error(`Error deleting user:`, error);
      throw error;
    }
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    try {
      // Get all sessions from the sessions table
      const allSessions = await db.select().from(sessions);
      
      let invalidatedCount = 0;
      
      for (const sessionRecord of allSessions) {
        try {
          // Parse the session data
          const sessionData = sessionRecord.sess as any;
          
          // Check if this session belongs to the user we want to invalidate
          if (sessionData && sessionData.user && sessionData.user.id === userId) {
            // Delete the session
            await db.delete(sessions).where(eq(sessions.sid, sessionRecord.sid));
            invalidatedCount++;
            console.log(`Invalidated session ${sessionRecord.sid} for user ${userId}`);
          }
        } catch (parseError) {
          // If we can't parse a session, skip it
          console.warn(`Could not parse session ${sessionRecord.sid}:`, parseError);
          continue;
        }
      }
      
      console.log(`Invalidated ${invalidatedCount} sessions for user ${userId}`);
    } catch (error) {
      console.error(`Error invalidating sessions for user ${userId}:`, error);
      throw error;
    }
  }

  async updateUserSessions(userId: string, updates: Partial<User>): Promise<void> {
    try {
      // Get all sessions from the sessions table
      const allSessions = await db.select().from(sessions);
      
      let updatedCount = 0;
      
      for (const sessionRecord of allSessions) {
        try {
          // Parse the session data
          const sessionData = sessionRecord.sess as any;
          
          // Check if this session belongs to the user we want to update
          if (sessionData && sessionData.user && sessionData.user.id === userId) {
            // Update the user data in the session
            const updatedSessionData = {
              ...sessionData,
              user: {
                ...sessionData.user,
                ...updates
              }
            };
            
            // Update the session in the database
            await db.update(sessions)
              .set({ sess: updatedSessionData })
              .where(eq(sessions.sid, sessionRecord.sid));
            
            updatedCount++;
            console.log(`Updated session ${sessionRecord.sid} for user ${userId} with:`, updates);
          }
        } catch (parseError) {
          // If we can't parse a session, skip it
          console.warn(`Could not parse session ${sessionRecord.sid}:`, parseError);
          continue;
        }
      }
      
      console.log(`Updated ${updatedCount} sessions for user ${userId}`);
    } catch (error) {
      console.error(`Error updating sessions for user ${userId}:`, error);
      throw error;
    }
  }

  // Admin credentials operations
  async getAdminCredentials(userId: string): Promise<AdminCredentials | undefined> {
    const result = await db.query.adminCredentials.findFirst({
      where: eq(adminCredentials.userId, userId),
    });
    return result;
  }

  async validateAdminCredentials(userId: string, password: string): Promise<boolean> {
    const credentials = await this.getAdminCredentials(userId);
    if (!credentials || !credentials.isActive) {
      return false;
    }
    
    return bcrypt.compareSync(password, credentials.passwordHash);
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // Product operations - optimized for performance
  async getProducts(): Promise<ProductWithDetails[]> {
    // Use simpler query for better performance
    const productList = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt))
      .limit(100); // Limit to 100 products for better performance
    
    if (productList.length === 0) return [];
    
    // Get unique seller and category IDs
    const sellerIds = Array.from(new Set(productList.map(p => p.sellerId).filter(Boolean)));
    const categoryIds = Array.from(new Set(productList.map(p => p.categoryId).filter(Boolean)));
    const productIds = productList.map(p => p.id);
    
    // Fetch related data in parallel
    const [sellers, categoriesData, allDiscountTiers] = await Promise.all([
      db.select().from(users).where(inArray(users.id, sellerIds)),
      db.select().from(categories).where(inArray(categories.id, categoryIds)),
      db.select().from(discountTiers).where(inArray(discountTiers.productId, productIds))
    ]);
    
    // Create lookup maps
    const sellerMap = new Map(sellers.map(s => [s.id, s]));
    const categoryMap = new Map(categoriesData.map(c => [c.id, c]));
    const discountTiersMap = new Map<string, any[]>();
    
    allDiscountTiers.forEach(dt => {
      const key = dt.productId.toString();
      if (!discountTiersMap.has(key)) {
        discountTiersMap.set(key, []);
      }
      discountTiersMap.get(key)!.push(dt);
    });
    
    // Combine data
    return productList.map(product => ({
      ...product,
      seller: sellerMap.get(product.sellerId) || undefined,
      category: categoryMap.get(product.categoryId) || undefined,
      discountTiers: discountTiersMap.get(product.id.toString()) || [],
      serviceProvider: undefined, // Skip for now to improve performance
      petProvider: undefined, // Skip for now to improve performance
    })) as ProductWithDetails[];
  }

  async getProduct(id: number): Promise<ProductWithDetails | undefined> {
    // Use simpler query for better performance
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    
    if (!product) return undefined;
    
    // Fetch related data separately for better performance
    const [seller, category, discountTiersData] = await Promise.all([
      db.select().from(users).where(eq(users.id, product.sellerId)).limit(1),
      db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1),
      db.select().from(discountTiers).where(eq(discountTiers.productId, product.id))
    ]);
    
    return {
      ...product,
      seller: seller[0] || undefined,
      category: category[0] || undefined,
      discountTiers: discountTiersData || [],
      serviceProvider: undefined, // Skip for now to improve performance
      petProvider: undefined, // Skip for now to improve performance
    } as ProductWithDetails;
  }

  async getProductById(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getSellerShops(): Promise<User[]> {
    // First, check for sellers without storeId but with displayName or legalName
    const shopsWithoutStoreId = await db
      .select()
      .from(users)
      .where(and(
        eq(users.isSeller, true),
        or(
          isNotNull(users.displayName),
          isNotNull(users.legalName)
        )
      ))
      .orderBy(users.displayName);
    
    // Update these shops to have storeId set to displayName or legalName if missing
    for (const shop of shopsWithoutStoreId) {
      if (!shop.storeId) {
        const storeId = shop.displayName || shop.legalName;
        if (storeId) {
          try {
            await db
              .update(users)
              .set({ storeId, updatedAt: new Date() })
              .where(eq(users.id, shop.id));
            console.log(`Updated shop ${shop.id} with storeId: ${storeId}`);
          } catch (error) {
            console.error(`Failed to update storeId for shop ${shop.id}:`, error);
          }
        }
      }
    }
    
    // Now get all shops with storeId
    const shops = await db
      .select()
      .from(users)
      .where(and(
        eq(users.isSeller, true),
        isNotNull(users.storeId)
      ))
      .orderBy(users.displayName);
    
    console.log("getSellerShops - Found shops:", shops.length);
    console.log("Shop details:", shops.map(s => ({ 
      id: s.id, 
      displayName: s.displayName, 
      legalName: s.legalName, 
      storeId: s.storeId, 
      isSeller: s.isSeller,
      firstName: s.firstName,
      lastName: s.lastName
    })));
    
    return shops;
  }

  async getSellerShopsBySeller(sellerId: string): Promise<User[]> {
    console.log("=== getSellerShopsBySeller called ===");
    console.log("Looking for sellerId:", sellerId);
    
    // First, let's check if the user exists and what their data looks like
    const user = await db.select().from(users).where(eq(users.id, sellerId));
    console.log("User found:", user.length > 0 ? user[0] : "No user found");
    
    if (user.length > 0) {
      console.log("User details:", {
        id: user[0].id,
        isSeller: user[0].isSeller,
        storeId: user[0].storeId,
        displayName: user[0].displayName,
        legalName: user[0].legalName,
        firstName: user[0].firstName,
        lastName: user[0].lastName
      });
      
      // If user is a seller but doesn't have storeId, set it
      if (user[0].isSeller && !user[0].storeId) {
        const storeId = user[0].displayName || user[0].legalName || `${user[0].firstName} ${user[0].lastName}`.trim();
        if (storeId) {
          try {
            await db
              .update(users)
              .set({ storeId, updatedAt: new Date() })
              .where(eq(users.id, sellerId));
            console.log(`Updated user ${sellerId} with storeId: ${storeId}`);
          } catch (error) {
            console.error(`Failed to update storeId for user ${sellerId}:`, error);
          }
        }
      }
    }
    
    const shops = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, sellerId),
        eq(users.isSeller, true),
        isNotNull(users.storeId)
      ))
      .orderBy(users.displayName);
    
    console.log("Shops found for seller:", shops.length);
    console.log("Shop details:", shops.map(s => ({ 
      id: s.id, 
      displayName: s.displayName, 
      legalName: s.legalName, 
      storeId: s.storeId, 
      isSeller: s.isSeller 
    })));
    
    return shops;
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
        petProvider: {
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
    // Delete pet provider first if exists
    await this.deletePetProviderByProductId(productId);
    // Delete grocery product details if exists
    await db.delete(groceryProducts).where(eq(groceryProducts.productId, productId));
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

  // Pet Provider implementations
  async createPetProvider(petProvider: InsertPetProvider): Promise<PetProvider> {
    const [newPetProvider] = await db.insert(petProviders).values(petProvider).returning();
    return newPetProvider;
  }
  
  async updatePetProvider(id: number, petProvider: Partial<InsertPetProvider>): Promise<PetProvider> {
    const [updatedPetProvider] = await db
      .update(petProviders)
      .set({ ...petProvider, updatedAt: new Date() })
      .where(eq(petProviders.id, id))
      .returning();
    return updatedPetProvider;
  }
  
  async getPetProviderByProductId(productId: number): Promise<PetProvider | undefined> {
    const [provider] = await db
      .select()
      .from(petProviders)
      .where(eq(petProviders.productId, productId));
    return provider;
  }
  
  async deletePetProviderByProductId(productId: number): Promise<void> {
    const [provider] = await db
      .select()
      .from(petProviders)
      .where(eq(petProviders.productId, productId));
    
    if (provider) {
      await db.delete(petProviderStaff).where(eq(petProviderStaff.petProviderId, provider.id));
      await db.delete(petProviders).where(eq(petProviders.productId, productId));
    }
  }
  
  // Pet Provider Staff implementations
  async createPetProviderStaff(staff: InsertPetProviderStaff): Promise<PetProviderStaff> {
    const [newStaff] = await db.insert(petProviderStaff).values(staff).returning();
    return newStaff;
  }
  
  async getPetProviderStaff(petProviderId: number): Promise<PetProviderStaff[]> {
    return await db
      .select()
      .from(petProviderStaff)
      .where(eq(petProviderStaff.petProviderId, petProviderId));
  }
  
  async deletePetProviderStaff(petProviderId: number): Promise<void> {
    await db.delete(petProviderStaff).where(eq(petProviderStaff.petProviderId, petProviderId));
  }

  // Grocery Product operations
  async createGroceryProduct(groceryProduct: InsertGroceryProduct): Promise<GroceryProduct> {
    const [newGroceryProduct] = await db.insert(groceryProducts).values(groceryProduct).returning();
    return newGroceryProduct;
  }

  async getGroceryProductByProductId(productId: number): Promise<GroceryProduct | undefined> {
    const [groceryProduct] = await db.select()
      .from(groceryProducts)
      .where(eq(groceryProducts.productId, productId));
    return groceryProduct;
  }

  async updateGroceryProduct(productId: number, groceryProduct: Partial<InsertGroceryProduct>): Promise<GroceryProduct> {
    const [updatedGroceryProduct] = await db.update(groceryProducts)
      .set(groceryProduct)
      .where(eq(groceryProducts.productId, productId))
      .returning();
    return updatedGroceryProduct;
  }

  async deleteGroceryProductByProductId(productId: number): Promise<void> {
    await db.delete(groceryProducts).where(eq(groceryProducts.productId, productId));
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

  async countGroupsUsingAddress(addressId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userGroups)
      .where(eq(userGroups.pickupAddressId, addressId));
    
    return result[0]?.count || 0;
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async createOrderWithItems(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    // Create the order first
    const [newOrder] = await db.insert(orders).values(order).returning();
    
    // Create order items
    const orderItemsToInsert = items.map(item => ({
      ...item,
      orderId: newOrder.id
    }));
    
    await db.insert(orderItems).values(orderItemsToInsert);
    
    return newOrder;
  }

  async getOrder(orderId: number): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    return order;
  }

  async getOrderWithItems(orderId: number): Promise<(Order & { items: (OrderItem & { product: ProductWithDetails })[] }) | undefined> {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
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
      },
    });
    return order;
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async getUserOrdersWithItems(userId: string): Promise<(Order & { items: (OrderItem & { product: ProductWithDetails })[] })[]> {
    return await db.query.orders.findMany({
      where: or(
        eq(orders.userId, userId), // Orders where user is the beneficiary
        eq(orders.payerId, userId) // Orders where user is the payer
      ),
      with: {
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
      },
      orderBy: [desc(orders.createdAt)],
    });
  }

  async getSellerOrders(sellerId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(orderItems.productId, products.id))
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
    isAlreadyMember: boolean;
    isFull: boolean;
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
        
        const isAlreadyMember = await this.isUserInUserGroup(userGroup.id, userId);
        const isFull = (userGroup.participantCount || 0) >= (userGroup.maxMembers || 5);
        
        similarities.push({
          userGroup,
          similarityScore: Math.round(optimizedScore),
          matchingProducts: matchingProductIds.length,
          totalCartProducts: cartProductIds.length,
          potentialSavings: totalPotentialSavings,
          matchingItems,
          isAlreadyMember,
          isFull,
        });
      }
    }
    
    // Sort by optimized similarity score descending, then by potential savings
    return similarities.sort((a, b) => {
      if (b.similarityScore === a.similarityScore) {
        return b.potentialSavings - a.potentialSavings;
      }
      return b.similarityScore - a.similarityScore;
    });
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
        recommendationType: 'single_best' as const,
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
          recommendationType: 'multi_group' as const,
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
          recommendationType: 'complete_coverage' as const,
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
  async getSellerAnalytics(sellerId: string, dateRange?: { startDate?: string; endDate?: string }): Promise<{
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
  }> {
    try {
      const now = new Date();
      // Default to a wider date range to capture all historical data
      const startDate = dateRange?.startDate ? new Date(dateRange.startDate) : new Date(now.getFullYear() - 1, 0, 1);
      const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : now;
      
      console.log(`Analytics for seller ${sellerId} from ${startDate} to ${endDate}`);

      // Skip debug query for better performance
      // const allOrdersResult = await db...

      // Revenue Analytics - Remove date restriction to get all historical data
      const revenueResult = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.finalPrice} as DECIMAL)), 0)`,
          totalOrders: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(products, eq(orderItems.productId, products.id))
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
        .leftJoin(orderItems, eq(products.id, orderItems.productId))
        .leftJoin(orders, and(
          eq(orders.id, orderItems.orderId),
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
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(products, eq(orderItems.productId, products.id))
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
          INNER JOIN ${orderItems} ON ${orders.id} = ${orderItems.orderId}
          INNER JOIN ${products} ON ${orderItems.productId} = ${products.id}
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
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(products, eq(orderItems.productId, products.id))
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
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(products, eq(orderItems.productId, products.id))
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
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(and(
          eq(products.sellerId, sellerId),
          sql`${orders.status} NOT IN ('completed', 'delivered', 'cancelled')`
        ));

      const { potentialRevenue } = potentialRevenueResult[0] || { potentialRevenue: 0 };

      // Get potential revenue from active groups (group purchases that haven't been ordered yet)
      const activeGroupsRevenueResult = await db
        .select({
          groupRevenue: sql<number>`COALESCE(SUM(CAST(${userGroupItems.quantity} * ${products.originalPrice} as DECIMAL)), 0)`,
        })
        .from(userGroups)
        .innerJoin(userGroupItems, eq(userGroups.id, userGroupItems.userGroupId))
        .innerJoin(products, eq(userGroupItems.productId, products.id))
        .where(and(
          eq(products.sellerId, sellerId),
          eq(userGroups.isPublic, true),
          sql`${userGroups.createdAt} > NOW() - INTERVAL '30 days'`
        ));

      const { groupRevenue } = activeGroupsRevenueResult[0] || { groupRevenue: 0 };
      const totalPotentialRevenue = Number(potentialRevenue) + Number(groupRevenue);

      // Get previous month revenue for growth calculation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const previousRevenueResult = await db
        .select({
          previousRevenue: sql<number>`COALESCE(SUM(CAST(${orders.finalPrice} as DECIMAL)), 0)`,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(products, eq(orderItems.productId, products.id))
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

      const finalMetrics = {
        totalRevenue: Number(totalRevenue) || 0,
        totalOrders: Number(totalOrders) || 0,
        potentialRevenue: Number(totalPotentialRevenue) || 0,
        activeGroups: Number(activeGroups) || 0,
        totalProducts: Number(totalProducts) || 0,
        growthPercentage: Number(growthPercentage.toFixed(1)) || 0,
      };
      
      return finalMetrics;
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
    // Get only groups where user is the owner
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

    // Sort by updatedAt desc
    ownedGroups.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Add participant count to each group (only approved participants)
    return ownedGroups.map(group => ({
      ...group,
      participantCount: group.participants?.filter(p => p.status === 'approved').length || 0,
    }));
  }

  async getUserJoinedGroups(userId: string): Promise<UserGroupWithDetails[]> {
    // Get groups where user is an approved participant (but not the owner)
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
      )
      .where(not(eq(userGroups.userId, userId))); // Exclude groups where user is the owner

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

    // Sort by updatedAt desc
    participantGroupsWithDetails.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Add participant count to each group (only approved participants)
    return participantGroupsWithDetails.map(group => ({
      ...group,
      participantCount: group.participants?.filter(p => p.status === 'approved').length || 0,
    }));
  }

  async getUserGroup(groupId: number): Promise<UserGroupWithDetails | undefined> {
    try {
      console.log("Getting user group with ID:", groupId);
      const group = await db.query.userGroups.findFirst({
        where: eq(userGroups.id, groupId),
        with: {
          user: true,
          pickupAddress: true,
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

      console.log("User group query result:", group ? "Found" : "Not found");
      if (group) {
        console.log("Group participants:", group.participants?.length || 0);
      }

      if (!group) return undefined;

      return {
        ...group,
        participantCount: group.participants?.filter(p => p.status === 'approved').length || 0,
      };
    } catch (error) {
      console.error("Error in getUserGroup:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  async getUserGroupByShareToken(shareToken: string): Promise<UserGroupWithDetails | undefined> {
    const group = await db.query.userGroups.findFirst({
      where: eq(userGroups.shareToken, shareToken),
      with: {
        user: true,
        pickupAddress: true,
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
    try {
      // Use a transaction to ensure atomic deletion
      const result = await db.transaction(async (tx) => {
        // First delete all group participants (members)
        await tx.delete(userGroupParticipants).where(eq(userGroupParticipants.userGroupId, groupId));
        
        // Then delete all items in the group
        await tx.delete(userGroupItems).where(eq(userGroupItems.userGroupId, groupId));
        
        // Finally delete the group itself
        return await tx.delete(userGroups).where(eq(userGroups.id, groupId)).returning();
      });
      
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting group ${groupId}:`, error);
      throw error;
    }
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
      // First check if user is the owner of the group
      const [userGroup] = await db
        .select()
        .from(userGroups)
        .where(and(
          eq(userGroups.id, userGroupId),
          eq(userGroups.userId, userId)
        ));

      if (userGroup) {
        return true; // User is the owner
      }

      // Then check if user is approved in the participants table
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

  async isUserGroupLocked(userGroupId: number): Promise<boolean> {
    try {
      // Get the group to check its maxMembers
      const [group] = await db
        .select({ maxMembers: userGroups.maxMembers })
        .from(userGroups)
        .where(eq(userGroups.id, userGroupId));

      if (!group) {
        return false; // Group doesn't exist, not locked
      }

      // Get current participant count (approved members only)
      const participantCount = await this.getUserGroupParticipantCount(userGroupId);

      // Group is locked if participant count reaches or exceeds maxMembers
      return participantCount >= group.maxMembers;
    } catch (error) {
      console.error("Error checking if user group is locked:", error);
      return false; // Assume not locked on error
    }
  }

  // Group payment operations
  async createGroupPayment(payment: InsertGroupPayment): Promise<GroupPayment> {
    const [newPayment] = await db.insert(groupPayments).values(payment).returning();
    return newPayment;
  }

  async getGroupPayment(paymentId: number): Promise<GroupPayment | undefined> {
    const [payment] = await db
      .select()
      .from(groupPayments)
      .where(eq(groupPayments.id, paymentId));
    return payment;
  }

  async getGroupPaymentsByUser(userId: string): Promise<GroupPayment[]> {
    return await db
      .select()
      .from(groupPayments)
      .where(eq(groupPayments.userId, userId))
      .orderBy(desc(groupPayments.createdAt));
  }

  async getGroupPaymentsByGroup(userGroupId: number): Promise<GroupPayment[]> {
    try {
      console.log("Getting group payments for group ID:", userGroupId);
      const payments = await db
        .select()
        .from(groupPayments)
        .where(eq(groupPayments.userGroupId, userGroupId))
        .orderBy(desc(groupPayments.createdAt));
      
      console.log("Group payments found:", payments.length);
      return payments;
    } catch (error) {
      console.error("Error in getGroupPaymentsByGroup:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  async getGroupPaymentsByProduct(userGroupId: number, productId: number): Promise<GroupPayment[]> {
    return await db
      .select()
      .from(groupPayments)
      .where(and(
        eq(groupPayments.userGroupId, userGroupId),
        eq(groupPayments.productId, productId)
      ))
      .orderBy(desc(groupPayments.createdAt));
  }

  async getGroupPaymentByStripeIntent(stripePaymentIntentId: string): Promise<GroupPayment | undefined> {
    const [payment] = await db
      .select()
      .from(groupPayments)
      .where(eq(groupPayments.stripePaymentIntentId, stripePaymentIntentId));
    return payment;
  }

  async updateGroupPaymentStatus(paymentId: number, status: string): Promise<GroupPayment> {
    const [updatedPayment] = await db
      .update(groupPayments)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(groupPayments.id, paymentId))
      .returning();
    return updatedPayment;
  }

  async updateGroupPaymentStripeIntent(paymentId: number, stripePaymentIntentId: string): Promise<GroupPayment> {
    const [updatedPayment] = await db
      .update(groupPayments)
      .set({ 
        stripePaymentIntentId,
        updatedAt: new Date()
      })
      .where(eq(groupPayments.id, paymentId))
      .returning();
    return updatedPayment;
  }

  async hasUserPaidForProduct(userId: string, userGroupId: number, productId: number): Promise<boolean> {
    const [payment] = await db
      .select({ id: groupPayments.id })
      .from(groupPayments)
      .where(and(
        eq(groupPayments.userId, userId),
        eq(groupPayments.userGroupId, userGroupId),
        eq(groupPayments.productId, productId),
        eq(groupPayments.status, "succeeded")
      ))
      .limit(1);
    return !!payment;
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

  // Seller notification operations
  async createSellerNotification(notification: InsertSellerNotification): Promise<SellerNotification> {
    const [newNotification] = await db
      .insert(sellerNotifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getSellerNotifications(sellerId: string, limit: number = 50): Promise<SellerNotification[]> {
    return await db
      .select()
      .from(sellerNotifications)
      .where(eq(sellerNotifications.sellerId, sellerId))
      .orderBy(desc(sellerNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadSellerNotificationCount(sellerId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sellerNotifications)
      .where(and(
        eq(sellerNotifications.sellerId, sellerId),
        eq(sellerNotifications.isRead, false)
      ));
    return result.count;
  }

  async markNotificationAsRead(notificationId: number): Promise<SellerNotification> {
    const [updatedNotification] = await db
      .update(sellerNotifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(eq(sellerNotifications.id, notificationId))
      .returning();
    return updatedNotification;
  }

  async markAllNotificationsAsRead(sellerId: string): Promise<void> {
    await db
      .update(sellerNotifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(and(
        eq(sellerNotifications.sellerId, sellerId),
        eq(sellerNotifications.isRead, false)
      ));
  }

  async deleteNotification(notificationId: number): Promise<boolean> {
    const result = await db
      .delete(sellerNotifications)
      .where(eq(sellerNotifications.id, notificationId));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
