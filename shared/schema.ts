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
  offerValidTill: timestamp("offer_valid_till"), // New field for offer validity
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Provider Details (for Services category)
export const serviceProviders = pgTable("service_providers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().unique().references(() => products.id),
  
  // Provider Profile
  legalName: varchar("legal_name", { length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  serviceCategory: varchar("service_category", { length: 100 }), // Salon, Tutoring, Cleaning, etc.
  status: varchar("status", { length: 20 }).default("active"), // active, inactive, draft
  licenseNumber: varchar("license_number", { length: 100 }),
  insuranceValidTill: timestamp("insurance_valid_till"),
  yearsInBusiness: integer("years_in_business"),
  
  // Location & Coverage
  serviceMode: varchar("service_mode", { length: 20 }).default("in_person"), // in_person, online, hybrid
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  locality: varchar("locality", { length: 100 }),
  region: varchar("region", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("India"),
  serviceAreaPolygon: jsonb("service_area_polygon"), // GeoJSON for coverage area
  
  // Service Details
  serviceName: varchar("service_name", { length: 255 }), // e.g., "Deep Cleaning – 2 BHK"
  durationMinutes: integer("duration_minutes"),
  pricingModel: varchar("pricing_model", { length: 50 }), // flat_fee, hourly, per_session, subscription
  materialsIncluded: boolean("materials_included").default(false),
  taxClass: varchar("tax_class", { length: 50 }), // services_basic, personal_training, etc.
  ageRestriction: integer("age_restriction"),
  
  // Availability
  availabilityType: varchar("availability_type", { length: 30 }), // fixed_hours, by_appointment
  operatingHours: jsonb("operating_hours"), // Store as JSON with day-wise timings
  advanceBookingDays: integer("advance_booking_days").default(7),
  cancellationPolicyUrl: varchar("cancellation_policy_url", { length: 500 }),
  rescheduleAllowed: boolean("reschedule_allowed").default(true),
  
  // Reviews & Compliance
  avgRating: decimal("avg_rating", { precision: 2, scale: 1 }).default('0'),
  reviewCount: integer("review_count").default(0),
  highlightedTestimonials: jsonb("highlighted_testimonials"),
  insurancePolicyNumber: varchar("insurance_policy_number", { length: 100 }),
  liabilityWaiverRequired: boolean("liability_waiver_required").default(false),
  healthSafetyCert: varchar("health_safety_cert", { length: 500 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Provider Staff (optional)
export const serviceProviderStaff = pgTable("service_provider_staff", {
  id: serial("id").primaryKey(),
  serviceProviderId: integer("service_provider_id").notNull().references(() => serviceProviders.id),
  name: varchar("name", { length: 255 }).notNull(),
  skills: jsonb("skills"), // Array of skills
  availability: jsonb("availability"), // Availability schedule
  rating: decimal("rating", { precision: 2, scale: 1 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Discount tiers for group buying
export const discountTiers = pgTable("discount_tiers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  participantCount: integer("participant_count").notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }).notNull(),
});



// User addresses table
export const userAddresses = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  nickname: varchar("nickname", { length: 100 }).notNull(), // e.g., "Home", "Office", "Mom's House"
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  addressLine: text("address_line").notNull(), // Street address
  city: varchar("city", { length: 100 }).notNull(),
  pincode: varchar("pincode", { length: 20 }).notNull(),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("India"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cart items
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  addedAt: timestamp("added_at").defaultNow(),
});

// User-created groups for custom collections
export const userGroups = pgTable("user_groups", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  shareToken: varchar("share_token", { length: 32 }).notNull().unique(),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Items within user-created groups
export const userGroupItems = pgTable("user_group_items", {
  id: serial("id").primaryKey(),
  userGroupId: integer("user_group_id").notNull().references(() => userGroups.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  addedAt: timestamp("added_at").defaultNow(),
});

// Collection participants - tracks who joined each collection
export const userGroupParticipants = pgTable("user_group_participants", {
  id: serial("id").primaryKey(),
  userGroupId: integer("user_group_id").notNull().references(() => userGroups.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, rejected
  joinedAt: timestamp("joined_at").defaultNow(),
});


// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  addressId: integer("address_id").references(() => userAddresses.id), // Reference to user address
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: text("shipping_address"), // Fallback for legacy orders
  status: varchar("status", { length: 20 }).default("pending"), // pending, processing, shipped, delivered, completed
  type: varchar("type", { length: 20 }).default("group"), // group, individual
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  products: many(products),
  orders: many(orders),
  addresses: many(userAddresses),
  cartItems: many(cartItems),
  userGroups: many(userGroups),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, { fields: [userAddresses.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(users, { fields: [products.sellerId], references: [users.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  discountTiers: many(discountTiers),
  orders: many(orders),
  serviceProvider: one(serviceProviders, { fields: [products.id], references: [serviceProviders.productId] }),
}));

export const serviceProvidersRelations = relations(serviceProviders, ({ one, many }) => ({
  product: one(products, { fields: [serviceProviders.productId], references: [products.id] }),
  staff: many(serviceProviderStaff),
}));

export const serviceProviderStaffRelations = relations(serviceProviderStaff, ({ one }) => ({
  serviceProvider: one(serviceProviders, { fields: [serviceProviderStaff.serviceProviderId], references: [serviceProviders.id] }),
}));



export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  address: one(userAddresses, { fields: [orders.addressId], references: [userAddresses.id] }),
}));

export const discountTiersRelations = relations(discountTiers, ({ one }) => ({
  product: one(products, { fields: [discountTiers.productId], references: [products.id] }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, { fields: [cartItems.userId], references: [users.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));


export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const userGroupsRelations = relations(userGroups, ({ one, many }) => ({
  user: one(users, { fields: [userGroups.userId], references: [users.id] }),
  items: many(userGroupItems),
  participants: many(userGroupParticipants),
}));

export const userGroupItemsRelations = relations(userGroupItems, ({ one }) => ({
  userGroup: one(userGroups, { fields: [userGroupItems.userGroupId], references: [userGroups.id] }),
  product: one(products, { fields: [userGroupItems.productId], references: [products.id] }),
}));

export const userGroupParticipantsRelations = relations(userGroupParticipants, ({ one }) => ({
  userGroup: one(userGroups, { fields: [userGroupParticipants.userGroupId], references: [userGroups.id] }),
  user: one(users, { fields: [userGroupParticipants.userId], references: [users.id] }),
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

export const insertServiceProviderSchema = createInsertSchema(serviceProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceProviderStaffSchema = createInsertSchema(serviceProviderStaff).omit({
  id: true,
  createdAt: true,
});

export const insertDiscountTierSchema = createInsertSchema(discountTiers).omit({
  id: true,
});



export const insertUserAddressSchema = createInsertSchema(userAddresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  addedAt: true,
});


export const insertUserGroupSchema = createInsertSchema(userGroups).omit({
  id: true,
  shareToken: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserGroupItemSchema = createInsertSchema(userGroupItems).omit({
  id: true,
  addedAt: true,
});

export const insertUserGroupParticipantSchema = createInsertSchema(userGroupParticipants).omit({
  id: true,
  joinedAt: true,
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
export type ServiceProvider = typeof serviceProviders.$inferSelect;
export type InsertServiceProvider = z.infer<typeof insertServiceProviderSchema>;
export type ServiceProviderStaff = typeof serviceProviderStaff.$inferSelect;
export type InsertServiceProviderStaff = z.infer<typeof insertServiceProviderStaffSchema>;
export type DiscountTier = typeof discountTiers.$inferSelect;
export type InsertDiscountTier = z.infer<typeof insertDiscountTierSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = z.infer<typeof insertUserAddressSchema>;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type UserGroup = typeof userGroups.$inferSelect;
export type InsertUserGroup = z.infer<typeof insertUserGroupSchema>;
export type UserGroupItem = typeof userGroupItems.$inferSelect;
export type InsertUserGroupItem = z.infer<typeof insertUserGroupItemSchema>;
export type UserGroupParticipant = typeof userGroupParticipants.$inferSelect;
export type InsertUserGroupParticipant = z.infer<typeof insertUserGroupParticipantSchema>;

// Product with relations type
export type ProductWithDetails = Product & {
  seller: User;
  category: Category | null;
  discountTiers: DiscountTier[];
  serviceProvider?: ServiceProvider & { staff?: ServiceProviderStaff[] };
};


// User group with details
export type UserGroupWithDetails = UserGroup & {
  user: User;
  items: (UserGroupItem & { product: ProductWithDetails })[];
  participants?: (UserGroupParticipant & { user: User })[];
  participantCount?: number;
};
