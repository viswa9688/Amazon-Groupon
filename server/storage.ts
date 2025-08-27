import {
  users,
  products,
  categories,
  discountTiers,
  groupPurchases,
  groupParticipants,
  orders,
  type User,
  type UpsertUser,
  type CreateUserWithPhone,
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
import { eq, desc, and, sql, gte } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  createUserWithPhone(userData: CreateUserWithPhone): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;

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

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(orderId: number): Promise<Order | undefined>;
  getUserOrders(userId: string): Promise<Order[]>;
  getSellerOrders(sellerId: string): Promise<Order[]>;
  updateOrderStatus(orderId: number, status: string): Promise<Order>;
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

  // Discount tier operations
  async createDiscountTier(tier: InsertDiscountTier): Promise<DiscountTier> {
    const [newTier] = await db.insert(discountTiers).values(tier).returning();
    return newTier;
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

    // Check if participants dropped below minimum and handle refund policy
    const wasAboveMinimum = (groupPurchase.group_purchases.currentParticipants || 0) >= groupPurchase.products.minimumParticipants;
    const isNowBelowMinimum = count < groupPurchase.products.minimumParticipants;

    let currentPrice = groupPurchase.group_purchases.currentPrice;

    // If we dropped below minimum, revert to original price
    if (wasAboveMinimum && isNowBelowMinimum) {
      currentPrice = groupPurchase.products.originalPrice;
      console.log(`Group purchase ${groupPurchaseId} dropped below minimum. Participants can choose refund or pay full price.`);
    } else if (!wasAboveMinimum && count >= groupPurchase.products.minimumParticipants) {
      // If we reached minimum, apply discount
      const tiers = await db
        .select()
        .from(discountTiers)
        .where(eq(discountTiers.productId, groupPurchase.products.id))
        .orderBy(desc(discountTiers.participantCount));

      // Find applicable discount tier
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

  // Discount tier operations
  async createDiscountTier(tier: InsertDiscountTier): Promise<DiscountTier> {
    const [newTier] = await db.insert(discountTiers).values(tier).returning();
    return newTier;
  }

  async getDiscountTiersByProduct(productId: number): Promise<DiscountTier[]> {
    return await db
      .select()
      .from(discountTiers)
      .where(eq(discountTiers.productId, productId))
      .orderBy(desc(discountTiers.participantCount));
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
}

export const storage = new DatabaseStorage();
