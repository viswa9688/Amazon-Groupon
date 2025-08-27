import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table for Phone Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number").unique(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isSeller: boolean("is_seller").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  icon: varchar("icon", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: varchar("image_url", { length: 500 }),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  minimumParticipants: integer("minimum_participants").notNull().default(10),
  maximumParticipants: integer("maximum_participants").notNull().default(1000),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Discount tiers for group buying
export const discountTiers = pgTable("discount_tiers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  participantCount: integer("participant_count").notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }).notNull(),
});

// Group purchases
export const groupPurchases = pgTable("group_purchases", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  currentParticipants: integer("current_participants").default(0),
  targetParticipants: integer("target_participants").notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  endTime: timestamp("end_time").notNull(),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, expired
  createdAt: timestamp("created_at").defaultNow(),
});

// User participation in group purchases
export const groupParticipants = pgTable("group_participants", {
  id: serial("id").primaryKey(),
  groupPurchaseId: integer("group_purchase_id").notNull().references(() => groupPurchases.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  quantity: integer("quantity").default(1),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  groupPurchaseId: integer("group_purchase_id").references(() => groupPurchases.id), // Optional for individual orders
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: text("shipping_address"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, processing, shipped, delivered, completed
  type: varchar("type", { length: 20 }).default("group"), // group, individual
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  products: many(products),
  groupParticipants: many(groupParticipants),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(users, { fields: [products.sellerId], references: [users.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  discountTiers: many(discountTiers),
  groupPurchases: many(groupPurchases),
  orders: many(orders),
}));

export const groupPurchasesRelations = relations(groupPurchases, ({ one, many }) => ({
  product: one(products, { fields: [groupPurchases.productId], references: [products.id] }),
  participants: many(groupParticipants),
  orders: many(orders),
}));

export const groupParticipantsRelations = relations(groupParticipants, ({ one }) => ({
  groupPurchase: one(groupPurchases, { fields: [groupParticipants.groupPurchaseId], references: [groupPurchases.id] }),
  user: one(users, { fields: [groupParticipants.userId], references: [users.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  groupPurchase: one(groupPurchases, { fields: [orders.groupPurchaseId], references: [groupPurchases.id] }),
}));

export const discountTiersRelations = relations(discountTiers, ({ one }) => ({
  product: one(products, { fields: [discountTiers.productId], references: [products.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiscountTierSchema = createInsertSchema(discountTiers).omit({
  id: true,
});

export const insertGroupPurchaseSchema = createInsertSchema(groupPurchases).omit({
  id: true,
  createdAt: true,
});

export const insertGroupParticipantSchema = createInsertSchema(groupParticipants).omit({
  id: true,
  joinedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type CreateUserWithPhone = {
  phoneNumber: string;
  firstName: string;
  lastName: string;
};
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type DiscountTier = typeof discountTiers.$inferSelect;
export type InsertDiscountTier = z.infer<typeof insertDiscountTierSchema>;
export type GroupPurchase = typeof groupPurchases.$inferSelect;
export type InsertGroupPurchase = z.infer<typeof insertGroupPurchaseSchema>;
export type GroupParticipant = typeof groupParticipants.$inferSelect;
export type InsertGroupParticipant = z.infer<typeof insertGroupParticipantSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

// Product with relations type
export type ProductWithDetails = Product & {
  seller: User;
  category: Category | null;
  discountTiers: DiscountTier[];
  groupPurchases: (GroupPurchase & {
    participants: GroupParticipant[];
  })[];
};

// Group purchase with details
export type GroupPurchaseWithDetails = GroupPurchase & {
  product: ProductWithDetails;
  participants: (GroupParticipant & { user: User })[];
};
