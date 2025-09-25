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

// Admin credentials table
export const adminCredentials = pgTable("admin_credentials", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table for Phone Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number").unique(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isSeller: boolean("is_seller").default(false),
  
  // Shop/Store Details
  storeId: varchar("store_id", { length: 50 }).unique(),
  legalName: varchar("legal_name", { length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  shopType: varchar("shop_type", { length: 20 }).default("groceries"), // groceries or services
  status: varchar("status", { length: 20 }).default("active"),
  timezone: varchar("timezone", { length: 50 }),
  currency: varchar("currency", { length: 10 }),
  languages: text("languages"), // Comma-separated list
  
  // Address
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  locality: varchar("locality", { length: 100 }),
  region: varchar("region", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  serviceAreaPolygon: jsonb("service_area_polygon"),
  
  // Operating Hours
  operatingHours: varchar("operating_hours", { length: 255 }),
  pickupHours: varchar("pickup_hours", { length: 255 }),
  deliveryHours: varchar("delivery_hours", { length: 255 }),
  
  // Policies
  ageCheckEnabled: boolean("age_check_enabled").default(false),
  substitutionPolicy: varchar("substitution_policy", { length: 50 }),
  refundPolicyUrl: varchar("refund_policy_url", { length: 500 }),
  
  // Delivery Settings
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0.00"),
  freeDeliveryThreshold: decimal("free_delivery_threshold", { precision: 10, scale: 2 }).default("0.00"),
  minimumOrderValue: decimal("minimum_order_value", { precision: 10, scale: 2 }).default("0.00"),
  deliveryRadiusKm: integer("delivery_radius_km").default(10),
  
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

// Grocery Product Details (for Groceries category)
export const groceryProducts = pgTable("grocery_products", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().unique().references(() => products.id),
  
  // Basic Product Information
  productTitle: varchar("product_title", { length: 255 }),
  productDescription: text("product_description"),
  brand: varchar("brand", { length: 100 }),
  
  // Product Identification
  skuId: varchar("sku_id", { length: 50 }),
  skuCode: varchar("sku_code", { length: 50 }),
  gtin: varchar("gtin", { length: 20 }),
  barcodeSymbology: varchar("barcode_symbology", { length: 20 }),
  
  // Product Specifications
  uom: varchar("uom", { length: 20 }), // Unit of measure (kg, g, lb, oz, etc.)
  netContentValue: decimal("net_content_value", { precision: 10, scale: 3 }),
  netContentUom: varchar("net_content_uom", { length: 20 }),
  isVariableWeight: boolean("is_variable_weight").default(false),
  pluCode: varchar("plu_code", { length: 20 }),
  
  // Product Attributes
  dietaryTags: text("dietary_tags"), // JSON array of dietary tags
  allergens: text("allergens"), // JSON array of allergens
  countryOfOrigin: varchar("country_of_origin", { length: 100 }),
  temperatureZone: varchar("temperature_zone", { length: 20 }), // ambient, refrigerated, frozen
  shelfLifeDays: integer("shelf_life_days"),
  storageInstructions: text("storage_instructions"),
  substitutable: boolean("substitutable").default(true),
  
  // Physical Properties
  grossWeightG: decimal("gross_weight_g", { precision: 10, scale: 2 }),
  
  // Pricing Information
  listPriceCents: integer("list_price_cents"),
  salePriceCents: integer("sale_price_cents"),
  effectiveFrom: timestamp("effective_from"),
  effectiveTo: timestamp("effective_to"),
  taxClass: varchar("tax_class", { length: 50 }),
  
  // Inventory Management
  inventoryOnHand: integer("inventory_on_hand").default(0),
  inventoryReserved: integer("inventory_reserved").default(0),
  inventoryStatus: varchar("inventory_status", { length: 20 }).default("in_stock"), // in_stock, out_of_stock, discontinued
  
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
  maxMembers: integer("max_members").notNull().default(5),
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
  userId: varchar("user_id").notNull().references(() => users.id), // Beneficiary (who receives the order)
  payerId: varchar("payer_id").references(() => users.id), // Payer (who made the payment)
  productId: integer("product_id").references(() => products.id), // For backward compatibility
  addressId: integer("address_id").references(() => userAddresses.id), // Reference to user address
  quantity: integer("quantity").default(1), // For backward compatibility
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }), // For backward compatibility
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: text("shipping_address"), // Fallback for legacy orders
  status: varchar("status", { length: 20 }).default("pending"), // pending, processing, shipped, delivered, completed
  type: varchar("type", { length: 20 }).default("group"), // group, individual
  deliveryMethod: varchar("delivery_method", { length: 20 }).default("delivery"), // pickup, delivery
  expectedDeliveryDate: timestamp("expected_delivery_date"), // Expected delivery date based on order time
  actualDeliveryDate: timestamp("actual_delivery_date"), // Actual delivery date when delivered
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items - individual products within an order
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Group payments - tracks individual user payments within groups  
export const groupPayments = pgTable("group_payments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id), // Beneficiary (who the payment is for)
  payerId: varchar("payer_id").references(() => users.id), // Payer (who made the payment)
  userGroupId: integer("user_group_id").notNull().references(() => userGroups.id),
  productId: integer("product_id").notNull().references(() => products.id),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }).unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("usd"),
  status: varchar("status", { length: 20 }).notNull(), // pending, succeeded, failed, canceled
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Seller notifications table
export const sellerNotifications = pgTable("seller_notifications", {
  id: serial("id").primaryKey(),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(), // new_order, order_status_change, payment_received, low_stock, etc.
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  data: jsonb("data"), // Additional data like orderId, productId, etc.
  isRead: boolean("is_read").default(false),
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  products: many(products),
  orders: many(orders),
  addresses: many(userAddresses),
  cartItems: many(cartItems),
  userGroups: many(userGroups),
  groupPayments: many(groupPayments),
  sellerNotifications: many(sellerNotifications),
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
  groceryProduct: one(groceryProducts, { fields: [products.id], references: [groceryProducts.productId] }),
  groupPayments: many(groupPayments),
}));

export const serviceProvidersRelations = relations(serviceProviders, ({ one, many }) => ({
  product: one(products, { fields: [serviceProviders.productId], references: [products.id] }),
  staff: many(serviceProviderStaff),
}));

export const serviceProviderStaffRelations = relations(serviceProviderStaff, ({ one }) => ({
  serviceProvider: one(serviceProviders, { fields: [serviceProviderStaff.serviceProviderId], references: [serviceProviders.id] }),
}));

export const groceryProductsRelations = relations(groceryProducts, ({ one }) => ({
  product: one(products, { fields: [groceryProducts.productId], references: [products.id] }),
}));



export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }), // Beneficiary
  payer: one(users, { fields: [orders.payerId], references: [users.id] }), // Payer
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  address: one(userAddresses, { fields: [orders.addressId], references: [userAddresses.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
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
  groupPayments: many(groupPayments),
}));

export const userGroupItemsRelations = relations(userGroupItems, ({ one }) => ({
  userGroup: one(userGroups, { fields: [userGroupItems.userGroupId], references: [userGroups.id] }),
  product: one(products, { fields: [userGroupItems.productId], references: [products.id] }),
}));

export const userGroupParticipantsRelations = relations(userGroupParticipants, ({ one }) => ({
  userGroup: one(userGroups, { fields: [userGroupParticipants.userGroupId], references: [userGroups.id] }),
  user: one(users, { fields: [userGroupParticipants.userId], references: [users.id] }),
}));

export const groupPaymentsRelations = relations(groupPayments, ({ one }) => ({
  user: one(users, { fields: [groupPayments.userId], references: [users.id] }), // Beneficiary
  payer: one(users, { fields: [groupPayments.payerId], references: [users.id] }), // Payer
  userGroup: one(userGroups, { fields: [groupPayments.userGroupId], references: [userGroups.id] }),
  product: one(products, { fields: [groupPayments.productId], references: [products.id] }),
}));

export const sellerNotificationsRelations = relations(sellerNotifications, ({ one }) => ({
  seller: one(users, { fields: [sellerNotifications.sellerId], references: [users.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

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

export const insertGroceryProductSchema = createInsertSchema(groceryProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
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

export const insertGroupPaymentSchema = createInsertSchema(groupPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSellerNotificationSchema = createInsertSchema(sellerNotifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

// Admin credentials schema
export const insertAdminCredentialsSchema = createInsertSchema(adminCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreateUserWithPhone = {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  isSeller?: boolean;
};
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ServiceProvider = typeof serviceProviders.$inferSelect;
export type InsertServiceProvider = z.infer<typeof insertServiceProviderSchema>;
export type ServiceProviderStaff = typeof serviceProviderStaff.$inferSelect;
export type InsertServiceProviderStaff = z.infer<typeof insertServiceProviderStaffSchema>;
export type GroceryProduct = typeof groceryProducts.$inferSelect;
export type InsertGroceryProduct = z.infer<typeof insertGroceryProductSchema>;
export type DiscountTier = typeof discountTiers.$inferSelect;
export type InsertDiscountTier = z.infer<typeof insertDiscountTierSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
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
export type GroupPayment = typeof groupPayments.$inferSelect;
export type InsertGroupPayment = z.infer<typeof insertGroupPaymentSchema>;
export type SellerNotification = typeof sellerNotifications.$inferSelect;
export type InsertSellerNotification = z.infer<typeof insertSellerNotificationSchema>;
export type AdminCredentials = typeof adminCredentials.$inferSelect;
export type InsertAdminCredentials = z.infer<typeof insertAdminCredentialsSchema>;

// Product with relations type
export type ProductWithDetails = Product & {
  seller: User;
  category: Category | null;
  discountTiers: DiscountTier[];
  serviceProvider?: ServiceProvider & { staff?: ServiceProviderStaff[] };
  groceryProduct?: GroceryProduct;
};


// User group with details
export type UserGroupWithDetails = UserGroup & {
  user: User;
  items: (UserGroupItem & { product: ProductWithDetails })[];
  participants?: (UserGroupParticipant & { user: User })[];
  participantCount?: number;
};
