import {
  users,
  products,
  categories,
  discountTiers,
  groupPurchases,
  groupParticipants,
  orders,
  userAddresses,
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
  type GroupPurchase,
  type InsertGroupPurchase,
  type GroupParticipant,
  type InsertGroupParticipant,
  type Order,
  type InsertOrder,
  type ProductWithDetails,
  type GroupPurchaseWithDetails,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, gte } from "drizzle-orm";

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
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;

  // Discount tier operations
  createDiscountTier(tier: InsertDiscountTier): Promise<DiscountTier>;
  getDiscountTiersByProduct(productId: number): Promise<DiscountTier[]>;

  // Group purchase operations
  getActiveGroupPurchases(): Promise<GroupPurchaseWithDetails[]>;
  getGroupPurchase(id: number): Promise<GroupPurchaseWithDetails | undefined>;
  createGroupPurchase(groupPurchase: InsertGroupPurchase): Promise<GroupPurchase>;
  joinGroupPurchase(groupPurchaseId: number, userId: string, quantity?: number): Promise<GroupParticipant>;
  leaveGroupPurchase(groupPurchaseId: number, userId: string): Promise<boolean>;
  getUserGroupParticipation(groupPurchaseId: number, userId: string): Promise<GroupParticipant | undefined>;
  updateGroupPurchaseProgress(groupPurchaseId: number): Promise<GroupPurchase>;

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
  
  // Seller metrics operations
  getSellerMetrics(sellerId: string): Promise<{
    totalRevenue: number;
    totalOrders: number;
    activeGroups: number;
    totalProducts: number;
    growthPercentage: number;
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
        groupPurchases: {
          with: {
            participants: true,
          },
          where: eq(groupPurchases.status, "active"),
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
        groupPurchases: {
          with: {
            participants: true,
          },
        },
      },
    });
  }

  async getProductById(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductsBySeller(sellerId: string): Promise<ProductWithDetails[]> {
    return await db.query.products.findMany({
      where: eq(products.sellerId, sellerId),
      with: {
        seller: true,
        category: true,
        discountTiers: true,
        groupPurchases: {
          with: {
            participants: true,
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

  async deleteProduct(productId: number): Promise<boolean> {
    // Delete related records first
    await db.delete(discountTiers).where(eq(discountTiers.productId, productId));
    await db.delete(groupPurchases).where(eq(groupPurchases.productId, productId));
    
    // Delete the product
    const result = await db.delete(products).where(eq(products.id, productId)).returning();
    return result.length > 0;
  }

  async getProductParticipantCount(productId: number): Promise<number> {
    // Get all group purchases for this product
    const productGroupPurchases = await db
      .select()
      .from(groupPurchases)
      .where(eq(groupPurchases.productId, productId));
    
    let totalParticipants = 0;
    
    // Count participants across all group purchases for this product
    for (const gp of productGroupPurchases) {
      const participantCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(groupParticipants)
        .where(eq(groupParticipants.groupPurchaseId, gp.id));
      
      totalParticipants += participantCount[0]?.count || 0;
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

  async updateGroupPurchaseTargets(productId: number, newMinimumParticipants: number): Promise<void> {
    await db
      .update(groupPurchases)
      .set({ targetParticipants: newMinimumParticipants })
      .where(eq(groupPurchases.productId, productId));
  }

  async getDiscountTiersByProduct(productId: number): Promise<DiscountTier[]> {
    return await db
      .select()
      .from(discountTiers)
      .where(eq(discountTiers.productId, productId))
      .orderBy(discountTiers.participantCount);
  }

  // Group purchase operations
  async getActiveGroupPurchases(): Promise<GroupPurchaseWithDetails[]> {
    return await db.query.groupPurchases.findMany({
      where: and(
        eq(groupPurchases.status, "active"),
        gte(groupPurchases.endTime, new Date())
      ),
      with: {
        product: {
          with: {
            seller: true,
            category: true,
            discountTiers: true,
            groupPurchases: {
              with: {
                participants: true,
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
      orderBy: desc(groupPurchases.createdAt),
    });
  }

  async getGroupPurchase(id: number): Promise<GroupPurchaseWithDetails | undefined> {
    return await db.query.groupPurchases.findFirst({
      where: eq(groupPurchases.id, id),
      with: {
        product: {
          with: {
            seller: true,
            category: true,
            discountTiers: true,
            groupPurchases: {
              with: {
                participants: true,
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
  }

  async createGroupPurchase(groupPurchase: InsertGroupPurchase): Promise<GroupPurchase> {
    const [newGroupPurchase] = await db.insert(groupPurchases).values(groupPurchase).returning();
    return newGroupPurchase;
  }

  async joinGroupPurchase(groupPurchaseId: number, userId: string, quantity: number = 1): Promise<GroupParticipant> {
    const [participant] = await db
      .insert(groupParticipants)
      .values({
        groupPurchaseId,
        userId,
        quantity,
      })
      .returning();

    // Update participant count
    await this.updateGroupPurchaseProgress(groupPurchaseId);

    return participant;
  }

  async leaveGroupPurchase(groupPurchaseId: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(groupParticipants)
      .where(and(
        eq(groupParticipants.groupPurchaseId, groupPurchaseId),
        eq(groupParticipants.userId, userId)
      ))
      .returning();

    if (result.length > 0) {
      // Update participant count after someone leaves
      await this.updateGroupPurchaseProgress(groupPurchaseId);
      return true;
    }
    return false;
  }

  async getUserGroupParticipation(groupPurchaseId: number, userId: string): Promise<GroupParticipant | undefined> {
    const [participant] = await db
      .select()
      .from(groupParticipants)
      .where(and(
        eq(groupParticipants.groupPurchaseId, groupPurchaseId),
        eq(groupParticipants.userId, userId)
      ));
    
    return participant;
  }

  async getAllGroupPurchases(): Promise<GroupPurchase[]> {
    return await db.select().from(groupPurchases);
  }

  async updateGroupPurchaseProgress(groupPurchaseId: number): Promise<GroupPurchase> {
    // Get current participant count
    const participantCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(groupParticipants)
      .where(eq(groupParticipants.groupPurchaseId, groupPurchaseId));

    const count = participantCount[0]?.count || 0;

    // Get the group purchase to check minimum requirements
    const [groupPurchase] = await db
      .select()
      .from(groupPurchases)
      .innerJoin(products, eq(groupPurchases.productId, products.id))
      .where(eq(groupPurchases.id, groupPurchaseId));

    if (!groupPurchase) {
      throw new Error("Group purchase not found");
    }

    // Always calculate the correct current price based on participant count
    let currentPrice = groupPurchase.products.originalPrice;
    
    // Check if we have enough participants for discount
    if (count >= groupPurchase.products.minimumParticipants) {
      // Get discount tiers for this product
      const tiers = await db
        .select()
        .from(discountTiers)
        .where(eq(discountTiers.productId, groupPurchase.products.id))
        .orderBy(desc(discountTiers.participantCount));

      // Find the best applicable discount tier
      for (const tier of tiers) {
        if (count >= tier.participantCount) {
          currentPrice = tier.finalPrice;
          break;
        }
      }
    }

    // Update group purchase
    const [updatedGroupPurchase] = await db
      .update(groupPurchases)
      .set({ 
        currentParticipants: count,
        currentPrice: currentPrice
      })
      .where(eq(groupPurchases.id, groupPurchaseId))
      .returning();

    return updatedGroupPurchase;
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

  // Seller metrics operations
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

      // Get active group purchases count
      const activeGroupsResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(groupPurchases)
        .innerJoin(products, eq(groupPurchases.productId, products.id))
        .where(and(
          eq(products.sellerId, sellerId),
          eq(groupPurchases.status, "active")
        ));

      const activeGroups = activeGroupsResult[0]?.count || 0;

      return {
        totalRevenue: Number(totalRevenue) || 0,
        totalOrders: Number(totalOrders) || 0,
        activeGroups: Number(activeGroups) || 0,
        totalProducts: Number(totalProducts) || 0,
        growthPercentage: Number(growthPercentage.toFixed(1)) || 0,
      };
    } catch (error) {
      console.error("Error calculating seller metrics:", error);
      return {
        totalRevenue: 0,
        totalOrders: 0,
        activeGroups: 0,
        totalProducts: 0,
        growthPercentage: 0,
      };
    }
  }
}

export const storage = new DatabaseStorage();
