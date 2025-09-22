import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupPhoneAuth, isAuthenticated, isSellerAuthenticated } from "./phoneAuth";
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { orders } from "@shared/schema";
import { seedDatabase } from "./seed";
import Stripe from "stripe";
import { notificationService } from "./notificationService";
import { notificationBroadcaster } from "./notificationBroadcaster";
import {
  insertProductSchema,
  insertServiceProviderSchema,
  insertGroceryProductSchema,
  insertCategorySchema,
  insertDiscountTierSchema,
  insertOrderSchema,
  insertUserAddressSchema,
  insertCartItemSchema,
  insertUserGroupSchema,
  insertUserGroupItemSchema,
} from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

// Simple in-memory cache for group pricing to prevent amount fluctuation
const groupPricingCache = new Map<string, { amount: number; originalAmount: number; potentialSavings: number; totalMembers: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Admin authentication middleware using database
const isAdminAuthenticated = async (req: any, res: any, next: any) => {
  const { userId, password } = req.body;
  
  try {
    const isValid = await storage.validateAdminCredentials(userId, password);
    if (isValid) {
      req.admin = { userId };
      return next();
    }
  } catch (error) {
    console.error("Admin authentication error:", error);
  }
  
  return res.status(403).json({ message: "Admin access denied" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupPhoneAuth(app);

  // Seed database route (for development)
  app.post('/api/seed-database', async (req, res) => {
    try {
      await seedDatabase();
      res.json({ message: "Database seeded successfully!" });
    } catch (error) {
      console.error("Seeding error:", error);
      res.status(500).json({ message: "Failed to seed database" });
    }
  });

  // Auth routes are now handled in phoneAuth.ts
  
  // Admin authentication route
  app.post('/api/admin/login', async (req, res) => {
    const { userId, password } = req.body;
    
    try {
      const isValid = await storage.validateAdminCredentials(userId, password);
      if (isValid) {
        res.json({ success: true, message: "Admin logged in" });
      } else {
        res.status(403).json({ message: "Admin access denied" });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Admin routes
  app.post('/api/admin/users', isAdminAuthenticated, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const sellers = [];
      const buyers = [];
      
      for (const user of allUsers) {
        // Check if user has any products (seller) or has isSeller flag
        const userProducts = await storage.getProductsBySeller(user.id);
        if (user.isSeller || userProducts.length > 0) {
          sellers.push({ ...user, productCount: userProducts.length });
        } else {
          buyers.push(user);
        }
      }
      
      res.json({ sellers, buyers });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  app.put('/api/admin/users/:id', isAdminAuthenticated, async (req, res) => {
    try {
      const userId = req.params.id;
      const userData = req.body;
      const updatedUser = await storage.updateUserAdmin(userId, userData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Update existing orders where payer_id is null (one-time migration)
  app.post('/api/admin/update-existing-orders', async (req: any, res) => {
    try {
      // One-time migration to update existing orders
      console.log(`Running one-time migration to update existing orders`);
      
      // Use the storage layer to update orders
      // First, get all orders where payer_id is null
      const ordersToUpdate = await db.select().from(orders).where(sql`payer_id IS NULL`);
      
      console.log(`Found ${ordersToUpdate.length} orders to update`);

      // Update each order
      let updatedCount = 0;
      for (const order of ordersToUpdate) {
        await db.update(orders)
          .set({ payerId: order.userId })
          .where(sql`id = ${order.id}`);
        updatedCount++;
      }

      console.log(`Updated ${updatedCount} orders`);

      // Get sample of updated orders for verification
      const updatedOrders = await db.select({
        id: orders.id,
        userId: orders.userId,
        payerId: orders.payerId,
        status: orders.status,
        type: orders.type,
        createdAt: orders.createdAt
      })
      .from(orders)
      .where(sql`payer_id IS NOT NULL`)
      .orderBy(sql`created_at DESC`)
      .limit(10);

      res.json({
        message: `Successfully updated ${updatedCount} orders`,
        updatedOrders: updatedOrders
      });
    } catch (error) {
      console.error('Error updating existing orders:', error);
      res.status(500).json({ message: 'Failed to update orders', error: error.message });
    }
  });
  
  app.delete('/api/admin/users/:id', isAdminAuthenticated, async (req, res) => {
    try {
      const userId = req.params.id;
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Create new shop
  app.post('/api/admin/create-shop', isAdminAuthenticated, async (req, res) => {
    try {
      const shopData = req.body;
      
      // Create user with shop details
      const newUser = await storage.createUserWithPhone({
        firstName: shopData.firstName || '',
        lastName: shopData.lastName || '',
        phoneNumber: shopData.phoneNumber || '',
      });
      
      // Update with all shop details
      const updatedUser = await storage.updateUserAdmin(newUser.id, {
        ...shopData,
        isSeller: true,
      });
      
      res.status(201).json(updatedUser);
    } catch (error) {
      console.error("Error creating shop:", error);
      res.status(500).json({ message: "Failed to create shop" });
    }
  });

  // Admin impersonation routes
  app.post('/api/admin/impersonate/:userId', isAdminAuthenticated, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId;
      const targetUser = await storage.getUser(targetUserId);
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Set impersonation in session
      req.session.adminImpersonation = {
        adminUserId: req.admin.userId,
        impersonatedUserId: targetUserId
      };
      
      res.json({ 
        message: "Impersonation started", 
        impersonatedUser: targetUser 
      });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(500).json({ message: "Failed to start impersonation" });
    }
  });

  app.post('/api/admin/stop-impersonation', isAdminAuthenticated, async (req: any, res) => {
    try {
      delete req.session.adminImpersonation;
      res.json({ message: "Impersonation stopped" });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // Product routes
  app.get('/api/products', async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.get('/api/seller/products', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const products = await storage.getProductsBySeller(sellerId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get current seller's shops only
  app.get('/api/seller/shops', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const shops = await storage.getSellerShopsBySeller(sellerId);
      res.json(shops);
    } catch (error) {
      console.error("Error fetching shops:", error);
      res.status(500).json({ message: "Failed to fetch shops" });
    }
  });

  app.post('/api/products', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const productData = insertProductSchema.parse({
        ...req.body,
        sellerId,
      });
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: "Failed to create product" });
    }
  });

  // Discount tier routes
  app.post('/api/products/:id/discount-tiers', isAuthenticated, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const tierData = insertDiscountTierSchema.parse({
        ...req.body,
        productId,
      });
      const tier = await storage.createDiscountTier(tierData);
      res.status(201).json(tier);
    } catch (error) {
      console.error("Error creating discount tier:", error);
      res.status(400).json({ message: "Failed to create discount tier" });
    }
  });

  app.get('/api/products/:id/discount-tiers', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const tiers = await storage.getDiscountTiersByProduct(productId);
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching discount tiers:", error);
      res.status(500).json({ message: "Failed to fetch discount tiers" });
    }
  });

  // Group purchase routes






  // Get all groups user is participating in

  // Order routes
  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderData = insertOrderSchema.parse({
        ...req.body,
        userId,
        payerId: userId, // For direct orders, user pays for themselves
      });
      const order = await storage.createOrder(orderData);
      
      // Create notification for seller about new order
      if (order.productId) {
        const product = await storage.getProduct(order.productId);
        if (product && product.sellerId) {
          await storage.createSellerNotification({
            sellerId: product.sellerId,
            type: "new_order",
            title: "New Order Received",
            message: `You have received a new order for "${product.name}" (Order #${order.id})`,
            data: { orderId: order.id, productId: order.productId },
            priority: "normal"
          });
        }
      }
      
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(400).json({ message: "Failed to create order" });
    }
  });

  // Individual purchase route
  app.post('/api/orders/individual', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productId, quantity = 1 } = req.body;
      
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      // Get product details to calculate total price
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Create individual order at original price
      const totalPrice = parseFloat(product.originalPrice.toString()) * quantity;
      
      const orderData = insertOrderSchema.parse({
        userId,
        productId,
        quantity,
        unitPrice: product.originalPrice,
        totalPrice: totalPrice.toString(),
        status: "completed", // Individual orders are immediately confirmed
        type: "individual",
      });
      
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating individual order:", error);
      res.status(400).json({ message: "Failed to create individual order" });
    }
  });

  // Group purchase route - creates single order with multiple items
  app.post('/api/orders/group', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { totalPrice, finalPrice, status, type, addressId, items, payerId, beneficiaryId, userGroupId } = req.body;
      
      console.log("Creating group order with data:", {
        userId,
        totalPrice,
        finalPrice,
        status,
        type,
        addressId,
        payerId,
        beneficiaryId,
        userGroupId,
        itemsCount: items?.length
      });
      
      // Validate payer and beneficiary IDs
      if (!payerId) {
        return res.status(400).json({ message: "Payer ID is required" });
      }
      
      if (!beneficiaryId) {
        return res.status(400).json({ message: "Beneficiary ID is required" });
      }
      
      // Log if payer and beneficiary are the same
      if (payerId === beneficiaryId) {
        console.log("Self-payment detected: payer and beneficiary are the same");
      } else {
        console.log("Cross-payment detected: payer and beneficiary are different");
      }
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        console.log("Missing or invalid items:", items);
        return res.status(400).json({ message: "Order items are required" });
      }
      
      // Get address details if addressId is provided
      let shippingAddress = "International Shipping Address";
      if (addressId) {
        const addresses = await storage.getUserAddresses(userId);
        const address = addresses.find(addr => addr.id === addressId);
        if (address) {
          shippingAddress = `${address.fullName}, ${address.addressLine}, ${address.city}, ${address.state || ''} ${address.pincode}, ${address.country || 'US'}`;
        }
      }
      
      // Use beneficiaryId as userId (who receives the order) and payerId as payerId (who made the payment)
      const finalUserId = beneficiaryId || userId; // Who receives the order
      const finalPayerId = payerId || userId; // Who made the payment
      
      const orderData = {
        userId: finalUserId,
        payerId: finalPayerId,
        addressId: addressId || null,
        totalPrice,
        finalPrice,
        shippingAddress,
        status: status || "completed",
        type: type || "group"
      };
      
      console.log("Order data:", orderData);
      console.log("Items data:", items);
      
      // Create single order with multiple items
      const order = await storage.createOrderWithItems(orderData, items);
      console.log("Group order with items created successfully:", order.id);
      
      // Create group payment record for payment status tracking
      if (userGroupId) {
        for (const item of items) {
          const groupPaymentData = {
            userId: finalUserId, // Who receives the order (beneficiary)
            payerId: finalPayerId, // Who made the payment
            userGroupId: userGroupId,
            productId: item.productId,
            amount: item.totalPrice,
            currency: "usd",
            status: "succeeded",
            quantity: item.quantity,
            unitPrice: item.unitPrice
          };
          
          const groupPayment = await storage.createGroupPayment(groupPaymentData);
          console.log("Group payment record created:", groupPayment.id, "for user:", finalUserId, "paid by:", finalPayerId);
        }
      }

      // Scenario 3: Notify all group members when order is created
      if (userGroupId) {
        await notificationService.notifyOrderCreatedForGroupMembers(order.id, userGroupId);
      }

      // Scenario 5: Notify sellers about new order
      await notificationService.notifySellerOrderCreated(order.id);
      
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating group order:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      res.status(400).json({ message: "Failed to create group order", error: error.message });
    }
  });

  // Test endpoint to check database connection
  app.get('/api/test-db', async (req: any, res) => {
    try {
      console.log("Testing database connection...");
      const result = await db.select().from(userGroups).limit(1);
      console.log("Database test successful:", result.length > 0 ? "Connected" : "No data");
      res.json({ status: "connected", data: result.length > 0 });
    } catch (error) {
      console.error("Database test failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get payment status for all members in a group
  app.get('/api/user-groups/:id/payment-status', isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      console.log("Fetching payment status for group:", groupId);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Get all group payments for this group
      console.log("Getting group payments for group:", groupId);
      const groupPayments = await storage.getGroupPaymentsByGroup(groupId);
      console.log("Group payments found:", groupPayments.length);
      
      // Get group details to get all members
      console.log("Getting user group details for group:", groupId);
      const userGroup = await storage.getUserGroup(groupId);
      if (!userGroup) {
        console.log("User group not found for ID:", groupId);
        return res.status(404).json({ message: "User group not found" });
      }
      console.log("User group found:", userGroup.id, "Owner:", userGroup.userId, "Participants:", userGroup.participants?.length || 0);

      // Create a map of user payment status
      const paymentStatus = new Map();
      
      // Initialize all members as not paid
      const allMembers = [
        { userId: userGroup.userId, isOwner: true },
        ...(userGroup.participants || []).filter(p => p.status === 'approved').map(p => ({ userId: p.userId, isOwner: false }))
      ];
      
      console.log("All members in group:", allMembers.length, allMembers.map(m => ({ userId: m.userId, isOwner: m.isOwner })));
      
      allMembers.forEach(member => {
        paymentStatus.set(member.userId, {
          hasPaid: false,
          isOwner: member.isOwner,
          paymentDetails: null
        });
      });

      // Update payment status for users who have paid
      console.log("Processing group payments:", groupPayments.length);
      groupPayments.forEach(payment => {
        console.log("Payment:", { 
          userId: payment.userId, 
          payerId: payment.payerId,
          status: payment.status, 
          amount: payment.amount 
        });
        if (payment.status === 'succeeded') {
          // The beneficiary (userId) should show as paid, regardless of who made the payment
          paymentStatus.set(payment.userId, {
            hasPaid: true,
            isOwner: payment.userId === userGroup.userId,
            paymentDetails: {
              amount: payment.amount,
              status: payment.status,
              createdAt: payment.createdAt,
              paidBy: payment.payerId, // Track who actually made the payment
              paidFor: payment.userId  // Track who the payment was for
            }
          });
          console.log("Marked user as paid:", payment.userId, "paid by:", payment.payerId);
        }
      });

      // Convert to array format
      const result = Array.from(paymentStatus.entries()).map(([userId, status]) => ({
        userId,
        ...status
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching group payment status:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      res.status(500).json({ message: "Failed to fetch payment status", error: error.message });
    }
  });


  // Create group payment record
  app.post('/api/group-payments', isAuthenticated, async (req: any, res) => {
    try {
      
      const { userGroupId, productId, amount, currency, status, quantity, unitPrice, payerId, beneficiaryId } = req.body;
      
      console.log("Creating group payment with data:", {
        payerId,
        beneficiaryId,
        userGroupId,
        productId,
        amount,
        currency,
        status,
        quantity,
        unitPrice
      });
      
      if (!userGroupId || !productId || !amount || !payerId || !beneficiaryId) {
        console.log("Missing required fields:", { userGroupId, productId, amount, payerId, beneficiaryId });
        return res.status(400).json({ 
          message: "userGroupId, productId, amount, payerId, and beneficiaryId are all required" 
        });
      }

      // Convert userGroupId to number if it's a string
      const groupId = typeof userGroupId === 'string' ? parseInt(userGroupId) : userGroupId;
      if (isNaN(groupId)) {
        console.log("Invalid userGroupId:", userGroupId);
        return res.status(400).json({ message: "Invalid userGroupId format" });
      }

      // Validate that the authenticated user is the payer
      const authenticatedUserId = req.user.claims.sub;
      if (authenticatedUserId !== payerId) {
        return res.status(403).json({ 
          message: "You can only create payments for yourself. Use your own user ID as payerId." 
        });
      }

      // Check if payer is part of this group
      const isPayerInGroup = await storage.isUserInUserGroup(groupId, payerId);
      console.log("Payer in group check:", { payerId, groupId, isPayerInGroup });
      if (!isPayerInGroup) {
        return res.status(403).json({ message: "Payer must be a participant in this group" });
      }

      // Check if beneficiary is part of this group
      const isBeneficiaryInGroup = await storage.isUserInUserGroup(groupId, beneficiaryId);
      console.log("Beneficiary in group check:", { beneficiaryId, groupId, isBeneficiaryInGroup });
      if (!isBeneficiaryInGroup) {
        return res.status(403).json({ message: "Beneficiary must be a participant in this group" });
      }
      
      const groupPaymentData = {
        userId: beneficiaryId, // Who the payment is for (beneficiary)
        payerId: payerId, // Who made the payment
        userGroupId: groupId,
        productId,
        amount,
        currency: currency || "usd",
        status: status || "succeeded",
        quantity: quantity || 1,
        unitPrice: unitPrice || amount
      };
      
      const groupPayment = await storage.createGroupPayment(groupPaymentData);
      res.status(201).json(groupPayment);
    } catch (error) {
      console.error("Error creating group payment:", error);
      res.status(400).json({ message: "Failed to create group payment" });
    }
  });

  // User Address Management
  app.get('/api/addresses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const addresses = await storage.getUserAddresses(userId);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching user addresses:", error);
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  app.post('/api/addresses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const addressData = insertUserAddressSchema.parse({ ...req.body, userId });
      const address = await storage.createUserAddress(addressData);
      res.status(201).json(address);
    } catch (error) {
      console.error("Error creating address:", error);
      res.status(400).json({ message: "Failed to create address" });
    }
  });

  app.put('/api/addresses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const addressId = parseInt(req.params.id);
      
      if (isNaN(addressId)) {
        return res.status(400).json({ message: "Invalid address ID" });
      }

      const addressData = insertUserAddressSchema.partial().parse(req.body);
      const updatedAddress = await storage.updateUserAddress(addressId, addressData);
      res.json(updatedAddress);
    } catch (error) {
      console.error("Error updating address:", error);
      res.status(400).json({ message: "Failed to update address" });
    }
  });

  app.delete('/api/addresses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const addressId = parseInt(req.params.id);
      
      if (isNaN(addressId)) {
        return res.status(400).json({ message: "Invalid address ID" });
      }

      const deleted = await storage.deleteUserAddress(addressId);
      if (deleted) {
        res.json({ message: "Address deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete address" });
      }
    } catch (error) {
      console.error("Error deleting address:", error);
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  app.post('/api/addresses/:id/set-default', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const addressId = parseInt(req.params.id);
      
      if (isNaN(addressId)) {
        return res.status(400).json({ message: "Invalid address ID" });
      }

      const success = await storage.setDefaultAddress(userId, addressId);
      if (success) {
        res.json({ message: "Default address updated" });
      } else {
        res.status(404).json({ message: "Address not found or doesn't belong to user" });
      }
    } catch (error) {
      console.error("Error setting default address:", error);
      res.status(500).json({ message: "Failed to set default address" });
    }
  });

  // User profile update routes
  app.put('/api/auth/update-profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, phoneNumber, email } = req.body;
      
      const updatedUser = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        phoneNumber,
        email,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post('/api/auth/send-otp', isAuthenticated, async (req: any, res) => {
    try {
      const { field, value } = req.body;
      
      // For now, just simulate sending OTP and return success
      console.log(`Sending OTP to ${field}: ${value}`);
      
      // In a real implementation, you would send actual OTP here
      // For now, we'll just return success since user requested any OTP to work
      
      res.json({ message: "OTP sent successfully", field, value });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Fetching orders for user:", userId);
      
      // Use the new method to get orders with items
      const orders = await storage.getUserOrdersWithItems(userId);
      console.log("Orders fetched successfully:", orders.length);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      res.status(500).json({ message: "Failed to fetch orders", error: error.message });
    }
  });

  app.get('/api/orders/:orderId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = parseInt(req.params.orderId);
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      console.log("Fetching order with items for order ID:", orderId);
      const order = await storage.getOrderWithItems(orderId);
      
      if (!order) {
        console.log("Order not found for ID:", orderId);
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order belongs to user
      if (order.userId !== userId) {
        console.log("Access denied for user:", userId, "order belongs to:", order.userId);
        return res.status(403).json({ message: "Access denied" });
      }

      console.log("Order found with items:", order.items?.length || 0);
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderData = {
        ...req.body,
        userId,
      };
      
      const validatedOrderData = insertOrderSchema.parse(orderData);
      const order = await storage.createOrder(validatedOrderData);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(400).json({ message: "Failed to create order" });
    }
  });

  // Cart routes
  app.get('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cart = await storage.getUserCart(userId);
      res.json(cart);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productId } = req.body;
      
      // Get product details to check category
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Get existing cart items to check for category mixing
      const existingCart = await storage.getUserCart(userId);
      if (existingCart.length > 0) {
        // Check if any existing cart item has a different category
        const hasGroceries = existingCart.some(item => item.product.categoryId === 1);
        const hasServices = existingCart.some(item => item.product.categoryId === 2);
        
        // Check if trying to mix categories
        if ((hasGroceries && product.categoryId === 2) || (hasServices && product.categoryId === 1)) {
          const currentCategory = hasGroceries ? "Groceries" : "Services";
          return res.status(400).json({ 
            message: "Cannot mix categories",
            error: "We can't club services and groceries together. Please add them separately to cart.",
            categoryConflict: true,
            currentCategory: currentCategory
          });
        }
      }
      
      const cartData = insertCartItemSchema.parse({
        ...req.body,
        userId,
      });
      const cartItem = await storage.addToCart(cartData);
      res.status(201).json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(400).json({ message: "Failed to add item to cart" });
    }
  });

  app.patch('/api/cart/:cartItemId', isAuthenticated, async (req: any, res) => {
    try {
      const cartItemId = parseInt(req.params.cartItemId);
      const { quantity } = req.body;
      
      if (isNaN(cartItemId) || !quantity || quantity < 1) {
        return res.status(400).json({ message: "Invalid cart item ID or quantity" });
      }

      const updatedItem = await storage.updateCartItemQuantity(cartItemId, quantity);
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(400).json({ message: "Failed to update cart item" });
    }
  });

  app.delete('/api/cart/:cartItemId', isAuthenticated, async (req: any, res) => {
    try {
      const cartItemId = parseInt(req.params.cartItemId);
      
      if (isNaN(cartItemId)) {
        return res.status(400).json({ message: "Invalid cart item ID" });
      }

      const success = await storage.removeFromCart(cartItemId);
      if (success) {
        res.json({ message: "Item removed from cart" });
      } else {
        res.status(404).json({ message: "Cart item not found" });
      }
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove item from cart" });
    }
  });

  app.delete('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await storage.clearUserCart(userId);
      if (success) {
        res.json({ message: "Cart cleared" });
      } else {
        res.json({ message: "Cart was already empty" });
      }
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // User Groups routes
  app.get('/api/user-groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userGroups = await storage.getUserGroups(userId);
      res.json(userGroups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ message: "Failed to fetch user groups" });
    }
  });

  // Get all public collections for browsing
  app.get('/api/collections', async (req, res) => {
    try {
      const collections = await storage.getAllPublicCollections();
      res.json(collections);
    } catch (error) {
      console.error("Error fetching public collections:", error);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  app.post('/api/user-groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Generate random share token
      const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const userGroupData = insertUserGroupSchema.parse({
        ...req.body,
        userId,
      });
      
      const userGroup = await storage.createUserGroup({ ...userGroupData, shareToken });
      res.status(201).json(userGroup);
    } catch (error) {
      console.error("Error creating user group:", error);
      res.status(400).json({ message: "Failed to create user group" });
    }
  });

  // Create user group from cart items
  app.post('/api/user-groups/from-cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Collection name is required" });
      }
      
      // Get user's cart items
      const cartItems = await storage.getUserCart(userId);
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }
      
      // Generate random share token
      const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Create user group
      const userGroupData = {
        name: name.trim(),
        description: `A curated collection of ${cartItems.length} items for group buying`,
        userId,
        isPublic: true,
        shareToken,
      };
      
      const userGroup = await storage.createUserGroupFromCart(userGroupData, cartItems);
      
      // Clear the cart after creating collection
      await storage.clearUserCart(userId);
      
      res.status(201).json(userGroup);
    } catch (error) {
      console.error("Error creating user group from cart:", error);
      res.status(400).json({ message: "Failed to create collection from cart" });
    }
  });

  app.get('/api/user-groups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      const userGroup = await storage.getUserGroup(groupId);
      if (!userGroup) {
        return res.status(404).json({ message: "User group not found" });
      }

      res.json(userGroup);
    } catch (error) {
      console.error("Error fetching user group:", error);
      res.status(500).json({ message: "Failed to fetch user group" });
    }
  });

  app.put('/api/user-groups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Verify ownership
      const existingGroup = await storage.getUserGroup(groupId);
      if (!existingGroup || existingGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if group is locked (at max capacity)
      const isLocked = await storage.isUserGroupLocked(groupId);
      if (isLocked) {
        return res.status(400).json({ 
          message: "Cannot edit group - group is locked because it has reached maximum member capacity",
          locked: true
        });
      }

      const updates = insertUserGroupSchema.partial().parse(req.body);
      const updatedGroup = await storage.updateUserGroup(groupId, updates);
      res.json(updatedGroup);
    } catch (error) {
      console.error("Error updating user group:", error);
      res.status(400).json({ message: "Failed to update user group" });
    }
  });

  app.delete('/api/user-groups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Verify ownership
      const existingGroup = await storage.getUserGroup(groupId);
      if (!existingGroup || existingGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if group is locked (at max capacity)
      const isLocked = await storage.isUserGroupLocked(groupId);
      if (isLocked) {
        return res.status(400).json({ 
          message: "Cannot delete group - group is locked because it has reached maximum member capacity",
          locked: true
        });
      }

      const success = await storage.deleteUserGroup(groupId);
      if (success) {
        res.json({ message: "User group deleted successfully" });
      } else {
        res.status(404).json({ message: "User group not found" });
      }
    } catch (error) {
      console.error("Error deleting user group:", error);
      res.status(500).json({ message: "Failed to delete user group" });
    }
  });

  app.post('/api/user-groups/:id/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Verify ownership
      const existingGroup = await storage.getUserGroup(groupId);
      if (!existingGroup || existingGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { productId, quantity = 1 } = req.body;
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      const item = await storage.addItemToUserGroup(groupId, productId, quantity);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding item to user group:", error);
      res.status(400).json({ message: "Failed to add item to user group" });
    }
  });

  app.delete('/api/user-groups/:id/items/:productId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = parseInt(req.params.id);
      const productId = parseInt(req.params.productId);
      
      if (isNaN(groupId) || isNaN(productId)) {
        return res.status(400).json({ message: "Invalid group ID or product ID" });
      }

      // Verify ownership
      const existingGroup = await storage.getUserGroup(groupId);
      if (!existingGroup || existingGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const success = await storage.removeItemFromUserGroup(groupId, productId);
      if (success) {
        res.json({ message: "Item removed from user group" });
      } else {
        res.status(404).json({ message: "Item not found in user group" });
      }
    } catch (error) {
      console.error("Error removing item from user group:", error);
      res.status(500).json({ message: "Failed to remove item from user group" });
    }
  });

  app.put('/api/user-groups/:id/items/:productId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = parseInt(req.params.id);
      const productId = parseInt(req.params.productId);
      
      if (isNaN(groupId) || isNaN(productId)) {
        return res.status(400).json({ message: "Invalid group ID or product ID" });
      }

      // Verify ownership
      const existingGroup = await storage.getUserGroup(groupId);
      if (!existingGroup || existingGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { quantity } = req.body;
      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: "Valid quantity is required" });
      }

      const updatedItem = await storage.updateUserGroupItemQuantity(groupId, productId, quantity);
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating user group item quantity:", error);
      res.status(400).json({ message: "Failed to update item quantity" });
    }
  });

  // User group join/leave routes
  app.post('/api/user-groups/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      // Check if the group exists and is public
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup) {
        return res.status(404).json({ message: "User group not found" });
      }

      if (!userGroup.isPublic) {
        return res.status(403).json({ message: "This group is private" });
      }

      // Check if user already has a request (any status)
      const hasRequest = await storage.hasParticipantRequest(userGroupId, userId);
      if (hasRequest) {
        return res.status(400).json({ message: "You already have a request for this collection" });
      }

      // Check if collection is already full (5 approved members max)
      const participantCount = await storage.getUserGroupParticipantCount(userGroupId);
      if (participantCount >= 5) {
        return res.status(400).json({ 
          message: "Collection is full - maximum 5 members allowed",
          details: "This collection already has 5 approved members. Collections are limited to 5 people to activate group discounts." 
        });
      }

      const success = await storage.joinUserGroup(userGroupId, userId);
      if (success) {
        // Send notification to group owner about the join request
        await notificationService.notifyGroupJoinRequest(userId, userGroupId);
        
        res.status(201).json({ message: "Request sent! The collection owner will review your request to join." });
      } else {
        res.status(400).json({ message: "Failed to send request" });
      }
    } catch (error) {
      console.error("Error joining user group:", error);
      res.status(500).json({ message: "Failed to join collection" });
    }
  });

  app.delete('/api/user-groups/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      // Check if user is in the group
      const isInGroup = await storage.isUserInUserGroup(userGroupId, userId);
      if (!isInGroup) {
        return res.status(400).json({ message: "Not a member of this collection" });
      }

      // Check if group is locked (at max capacity)
      const isLocked = await storage.isUserGroupLocked(userGroupId);
      if (isLocked) {
        return res.status(400).json({ 
          message: "Cannot leave group - group is locked because it has reached maximum member capacity",
          locked: true
        });
      }

      const success = await storage.leaveUserGroup(userGroupId, userId);
      if (success) {
        res.json({ message: "Successfully left collection" });
      } else {
        res.status(400).json({ message: "Failed to leave collection" });
      }
    } catch (error) {
      console.error("Error leaving user group:", error);
      res.status(500).json({ message: "Failed to leave collection" });
    }
  });

  // Check user group participation status
  app.get('/api/user-groups/:id/participation', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      const isParticipating = await storage.isUserInUserGroup(userGroupId, userId);
      const participantStatus = await storage.getParticipantStatus(userGroupId, userId);
      
      res.json({ 
        isParticipating,
        status: participantStatus,
        isPending: participantStatus === 'pending',
        isApproved: participantStatus === 'approved'
      });
    } catch (error) {
      console.error("Error checking user group participation:", error);
      res.status(500).json({ message: "Failed to check participation status" });
    }
  });

  // Check if user group is locked (at max capacity)
  app.get('/api/user-groups/:id/locked', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      const isLocked = await storage.isUserGroupLocked(userGroupId);
      
      res.json({ 
        isLocked
      });
    } catch (error) {
      console.error("Error checking user group locked status:", error);
      res.status(500).json({ message: "Failed to check locked status" });
    }
  });

  // Approval System API Endpoints
  
  // Get pending participants for owner to approve/reject
  app.get('/api/user-groups/:id/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      // Verify ownership
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup || userGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied - only collection owner can view pending requests" });
      }

      const pendingParticipants = await storage.getPendingParticipants(userGroupId);
      res.json(pendingParticipants);
    } catch (error) {
      console.error("Error getting pending participants:", error);
      res.status(500).json({ message: "Failed to get pending participants" });
    }
  });

  // Get approved participants
  app.get('/api/user-groups/:id/approved', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      // Verify ownership or approved participation
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Allow access if user is owner or an approved participant
      const isOwner = userGroup.userId === userId;
      if (!isOwner) {
        console.log(`Checking if user ${userId} is approved in group ${userGroupId}`);
        const isApproved = await storage.isUserInUserGroup(userGroupId, userId);
        console.log(`User ${userId} approved status: ${isApproved}`);
        if (!isApproved) {
          return res.status(403).json({ message: "Access denied - only group owner or approved participants can view member list" });
        }
      }

      const approvedParticipants = await storage.getApprovedParticipants(userGroupId);
      res.json(approvedParticipants);
    } catch (error) {
      console.error("Error getting approved participants:", error);
      res.status(500).json({ message: "Failed to get approved participants" });
    }
  });

  // Approve a participant
  app.post('/api/user-groups/:id/approve/:participantId', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const participantId = req.params.participantId;
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      // Verify ownership
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup || userGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied - only collection owner can approve participants" });
      }

      // Check if collection would exceed 5 members
      const approvedCount = await storage.getUserGroupParticipantCount(userGroupId);
      if (approvedCount >= 5) {
        return res.status(400).json({ 
          message: "Cannot approve - collection is already full with 5 members" 
        });
      }

      const success = await storage.approveParticipant(userGroupId, participantId);
      if (success) {
        // Send notification to the member that their request was accepted
        await notificationService.notifyMemberRequestAccepted(participantId, userGroupId);
        
        res.json({ message: "Participant approved successfully" });
      } else {
        res.status(400).json({ message: "Failed to approve participant" });
      }
    } catch (error) {
      console.error("Error approving participant:", error);
      res.status(500).json({ message: "Failed to approve participant" });
    }
  });

  // Reject a participant
  app.post('/api/user-groups/:id/reject/:participantId', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const participantId = req.params.participantId;
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      // Verify ownership
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup || userGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied - only collection owner can reject participants" });
      }

      const success = await storage.rejectParticipant(userGroupId, participantId);
      if (success) {
        res.json({ message: "Participant rejected successfully" });
      } else {
        res.status(400).json({ message: "Failed to reject participant" });
      }
    } catch (error) {
      console.error("Error rejecting participant:", error);
      res.status(500).json({ message: "Failed to reject participant" });
    }
  });

  // Add participant directly (owner action)
  app.post('/api/user-groups/:id/add-participant', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const { participantId } = req.body;
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId) || !participantId) {
        return res.status(400).json({ message: "Invalid user group ID or participant ID" });
      }

      // Verify ownership
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup || userGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied - only collection owner can add participants" });
      }

      // Check if collection would exceed 5 members
      const approvedCount = await storage.getUserGroupParticipantCount(userGroupId);
      if (approvedCount >= 5) {
        return res.status(400).json({ 
          message: "Cannot add participant - collection is already full with 5 members",
          warning: true
        });
      }

      const participant = await storage.addParticipantDirectly(userGroupId, participantId);
      if (participant) {
        res.json({ message: "Participant added successfully" });
      } else {
        res.status(400).json({ message: "Failed to add participant" });
      }
    } catch (error) {
      console.error("Error adding participant:", error);
      res.status(500).json({ message: "Failed to add participant" });
    }
  });

  // Remove participant (owner action) 
  app.delete('/api/user-groups/:id/remove/:participantId', isAuthenticated, async (req: any, res) => {
    try {
      const userGroupId = parseInt(req.params.id);
      const participantId = req.params.participantId;
      const userId = req.user.claims.sub;
      
      if (isNaN(userGroupId)) {
        return res.status(400).json({ message: "Invalid user group ID" });
      }

      // Verify ownership
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup || userGroup.userId !== userId) {
        return res.status(403).json({ message: "Access denied - only collection owner can remove participants" });
      }

      // Prevent owner from removing themselves
      if (participantId === userId) {
        return res.status(400).json({ message: "Collection owner cannot remove themselves" });
      }

      const success = await storage.removeUserGroupParticipant(userGroupId, participantId);
      if (success) {
        res.json({ message: "Participant removed successfully" });
      } else {
        res.status(400).json({ message: "Failed to remove participant" });
      }
    } catch (error) {
      console.error("Error removing participant:", error);
      res.status(500).json({ message: "Failed to remove participant" });
    }
  });

  // Public route to view shared groups
  app.get('/api/shared/:shareToken', async (req, res) => {
    try {
      const { shareToken } = req.params;
      const userGroup = await storage.getUserGroupByShareToken(shareToken);
      
      if (!userGroup) {
        return res.status(404).json({ message: "Shared group not found" });
      }
      
      if (!userGroup.isPublic) {
        return res.status(403).json({ message: "This group is private" });
      }

      res.json(userGroup);
    } catch (error) {
      console.error("Error fetching shared group:", error);
      res.status(500).json({ message: "Failed to fetch shared group" });
    }
  });

  // Group matching and optimization routes
  app.get('/api/cart/similar-groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const similarGroups = await storage.findSimilarGroups(userId);
      res.json(similarGroups);
    } catch (error) {
      console.error("Error finding similar groups:", error);
      res.status(500).json({ message: "Failed to find similar groups" });
    }
  });

  app.get('/api/cart/optimization-suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const suggestions = await storage.getOptimizationSuggestions(userId);
      res.json(suggestions);
    } catch (error) {
      console.error("Error getting optimization suggestions:", error);
      res.status(500).json({ message: "Failed to get optimization suggestions" });
    }
  });

  app.post('/api/seller/products', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.body.shopId || req.user.claims.sub; // Use shopId if provided, otherwise use user's ID
      const { discountPrice, serviceProvider, groceryProduct, shopId, ...productFields } = req.body;
      const productData = {
        ...productFields,
        sellerId,
        // Convert ISO string to Date object for validation
        offerValidTill: productFields.offerValidTill ? new Date(productFields.offerValidTill) : undefined,
      };
      
      const validatedProductData = insertProductSchema.parse(productData);
      const product = await storage.createProduct(validatedProductData);
      
      // Create service provider record if this is a service (category 2)
      if (productData.categoryId === 2 && serviceProvider) {
        // Parse date fields and JSON fields
        const serviceProviderData = {
          productId: product.id!,
          legalName: serviceProvider.legalName,
          displayName: serviceProvider.displayName,
          serviceCategory: serviceProvider.serviceCategory,
          licenseNumber: serviceProvider.licenseNumber,
          yearsInBusiness: serviceProvider.yearsInBusiness ? parseInt(serviceProvider.yearsInBusiness) : null,
          insuranceValidTill: serviceProvider.insuranceValidTill ? new Date(serviceProvider.insuranceValidTill) : null,
          serviceMode: serviceProvider.serviceMode,
          addressLine1: serviceProvider.addressLine1,
          addressLine2: serviceProvider.addressLine2,
          locality: serviceProvider.locality,
          region: serviceProvider.region,
          postalCode: serviceProvider.postalCode,
          serviceAreaPolygon: serviceProvider.serviceAreaPolygon || null,
          serviceName: serviceProvider.serviceName,
          durationMinutes: serviceProvider.durationMinutes ? parseInt(serviceProvider.durationMinutes) : null,
          pricingModel: serviceProvider.pricingModel,
          materialsIncluded: serviceProvider.materialsIncluded || false,
          ageRestriction: serviceProvider.ageRestriction ? parseInt(serviceProvider.ageRestriction) : null,
          taxClass: serviceProvider.taxClass,
          availabilityType: serviceProvider.availabilityType,
          operatingHours: serviceProvider.operatingHours || null,
          advanceBookingDays: serviceProvider.advanceBookingDays ? parseInt(serviceProvider.advanceBookingDays) : 7,
          cancellationPolicyUrl: serviceProvider.cancellationPolicyUrl,
          rescheduleAllowed: serviceProvider.rescheduleAllowed ?? true,
          insurancePolicyNumber: serviceProvider.insurancePolicyNumber,
          liabilityWaiverRequired: serviceProvider.liabilityWaiverRequired || false,
          healthSafetyCert: serviceProvider.healthSafetyCert,
        };
        
        // Validate service provider data
        const validatedServiceProviderData = insertServiceProviderSchema.parse(serviceProviderData);
        const createdServiceProvider = await storage.createServiceProvider(validatedServiceProviderData);
        
        // Handle staff members if provided
        if (serviceProvider.staff && Array.isArray(serviceProvider.staff) && serviceProvider.staff.length > 0) {
          for (const staffMember of serviceProvider.staff) {
            if (staffMember.name) {
              await storage.createServiceProviderStaff({
                serviceProviderId: createdServiceProvider.id!,
                name: staffMember.name,
                skills: staffMember.skills ? staffMember.skills.split(',').map((s: string) => s.trim()) : [],
                availability: staffMember.availability || null,
                rating: staffMember.rating ? staffMember.rating.toString() : null,
              });
            }
          }
        }
      }

      // Create grocery product record if this is a grocery product (category 1)
      if (productData.categoryId === 1 && groceryProduct) {
        const groceryProductData = {
          productId: product.id!,
          productTitle: groceryProduct.productTitle,
          productDescription: groceryProduct.productDescription,
          brand: groceryProduct.brand,
          skuId: groceryProduct.skuId,
          skuCode: groceryProduct.skuCode,
          gtin: groceryProduct.gtin,
          barcodeSymbology: groceryProduct.barcodeSymbology,
          uom: groceryProduct.uom,
          netContentValue: groceryProduct.netContentValue ? groceryProduct.netContentValue.toString() : null,
          netContentUom: groceryProduct.netContentUom,
          isVariableWeight: groceryProduct.isVariableWeight || false,
          pluCode: groceryProduct.pluCode,
          dietaryTags: groceryProduct.dietaryTags,
          allergens: groceryProduct.allergens,
          countryOfOrigin: groceryProduct.countryOfOrigin,
          temperatureZone: groceryProduct.temperatureZone,
          shelfLifeDays: groceryProduct.shelfLifeDays ? parseInt(groceryProduct.shelfLifeDays) : null,
          storageInstructions: groceryProduct.storageInstructions,
          substitutable: groceryProduct.substitutable ?? true,
          grossWeightG: groceryProduct.grossWeightG ? groceryProduct.grossWeightG.toString() : null,
          listPriceCents: groceryProduct.listPriceCents ? parseInt(groceryProduct.listPriceCents) : null,
          salePriceCents: groceryProduct.salePriceCents ? parseInt(groceryProduct.salePriceCents) : null,
          effectiveFrom: groceryProduct.effectiveFrom ? new Date(groceryProduct.effectiveFrom) : null,
          effectiveTo: groceryProduct.effectiveTo ? new Date(groceryProduct.effectiveTo) : null,
          taxClass: groceryProduct.taxClass,
          inventoryOnHand: groceryProduct.inventoryOnHand ? parseInt(groceryProduct.inventoryOnHand) : 0,
          inventoryReserved: groceryProduct.inventoryReserved ? parseInt(groceryProduct.inventoryReserved) : 0,
          inventoryStatus: groceryProduct.inventoryStatus || "in_stock",
        };
        
        // Validate grocery product data
        const validatedGroceryProductData = insertGroceryProductSchema.parse(groceryProductData);
        await storage.createGroceryProduct(validatedGroceryProductData);
      }
      
      // Always create discount tiers for group purchases
      if (discountPrice && parseFloat(discountPrice) < parseFloat(productData.originalPrice)) {
        // Use provided discount price
        await storage.createDiscountTier({
          productId: product.id!,
          participantCount: productData.minimumParticipants,
          discountPercentage: (((parseFloat(productData.originalPrice) - parseFloat(discountPrice)) / parseFloat(productData.originalPrice)) * 100).toString(),
          finalPrice: discountPrice.toString(),
        });
      } else {
        // Create default discount tier with 20% off when minimum participants are reached
        const originalPrice = parseFloat(productData.originalPrice);
        const defaultDiscountPrice = (originalPrice * 0.8).toFixed(2); // 20% off
        await storage.createDiscountTier({
          productId: product.id!,
          participantCount: productData.minimumParticipants,
          discountPercentage: "20",
          finalPrice: defaultDiscountPrice,
        });
      }
      
      // Automatically create a group purchase for this product
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 30); // 30 days from now
      
      res.status(201).json({ product });
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: "Failed to create product" });
    }
  });

  app.patch('/api/seller/products/:productId', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const productId = parseInt(req.params.productId);
      const { discountPrice, serviceProvider, ...productFields } = req.body;
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      // Check if the product belongs to this seller
      const existingProduct = await storage.getProduct(productId);
      if (!existingProduct || existingProduct.sellerId !== sellerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const productData = {
        ...productFields,
        sellerId,
        // Convert ISO string to Date object for validation
        offerValidTill: productFields.offerValidTill ? new Date(productFields.offerValidTill) : undefined,
      };
      
      const validatedProductData = insertProductSchema.parse(productData);
      const product = await storage.updateProduct(productId, validatedProductData);
      
      // Update or create service provider record if this is a service (category 2)
      if (productData.categoryId === 2 && serviceProvider) {
        // Parse date fields and JSON fields
        const serviceProviderData = {
          productId: product.id!,
          legalName: serviceProvider.legalName,
          displayName: serviceProvider.displayName,
          serviceCategory: serviceProvider.serviceCategory,
          licenseNumber: serviceProvider.licenseNumber,
          yearsInBusiness: serviceProvider.yearsInBusiness ? parseInt(serviceProvider.yearsInBusiness) : null,
          insuranceValidTill: serviceProvider.insuranceValidTill ? new Date(serviceProvider.insuranceValidTill) : null,
          serviceMode: serviceProvider.serviceMode,
          addressLine1: serviceProvider.addressLine1,
          addressLine2: serviceProvider.addressLine2,
          locality: serviceProvider.locality,
          region: serviceProvider.region,
          postalCode: serviceProvider.postalCode,
          serviceAreaPolygon: serviceProvider.serviceAreaPolygon || null,
          serviceName: serviceProvider.serviceName,
          durationMinutes: serviceProvider.durationMinutes ? parseInt(serviceProvider.durationMinutes) : null,
          pricingModel: serviceProvider.pricingModel,
          materialsIncluded: serviceProvider.materialsIncluded || false,
          ageRestriction: serviceProvider.ageRestriction ? parseInt(serviceProvider.ageRestriction) : null,
          taxClass: serviceProvider.taxClass,
          availabilityType: serviceProvider.availabilityType,
          operatingHours: serviceProvider.operatingHours || null,
          advanceBookingDays: serviceProvider.advanceBookingDays ? parseInt(serviceProvider.advanceBookingDays) : 7,
          cancellationPolicyUrl: serviceProvider.cancellationPolicyUrl,
          rescheduleAllowed: serviceProvider.rescheduleAllowed ?? true,
          insurancePolicyNumber: serviceProvider.insurancePolicyNumber,
          liabilityWaiverRequired: serviceProvider.liabilityWaiverRequired || false,
          healthSafetyCert: serviceProvider.healthSafetyCert,
        };
        
        // Validate service provider data
        const validatedServiceProviderData = insertServiceProviderSchema.parse(serviceProviderData);
        
        const existingServiceProvider = await storage.getServiceProviderByProductId(productId);
        if (existingServiceProvider) {
          await storage.updateServiceProvider(existingServiceProvider.id, validatedServiceProviderData);
          
          // Update staff members
          // First, remove existing staff
          await storage.deleteServiceProviderStaff(existingServiceProvider.id);
          
          // Then add new staff if provided
          if (serviceProvider.staff && Array.isArray(serviceProvider.staff) && serviceProvider.staff.length > 0) {
            for (const staffMember of serviceProvider.staff) {
              if (staffMember.name) {
                await storage.createServiceProviderStaff({
                  serviceProviderId: existingServiceProvider.id,
                  name: staffMember.name,
                  skills: staffMember.skills ? staffMember.skills.split(',').map((s: string) => s.trim()) : [],
                  availability: staffMember.availability || null,
                  rating: staffMember.rating ? staffMember.rating.toString() : null,
                });
              }
            }
          }
        } else {
          const createdServiceProvider = await storage.createServiceProvider(validatedServiceProviderData);
          
          // Handle staff members if provided
          if (serviceProvider.staff && Array.isArray(serviceProvider.staff) && serviceProvider.staff.length > 0) {
            for (const staffMember of serviceProvider.staff) {
              if (staffMember.name) {
                await storage.createServiceProviderStaff({
                  serviceProviderId: createdServiceProvider.id!,
                  name: staffMember.name,
                  skills: staffMember.skills ? staffMember.skills.split(',').map((s: string) => s.trim()) : [],
                  availability: staffMember.availability || null,
                  rating: staffMember.rating ? staffMember.rating.toString() : null,
                });
              }
            }
          }
        }
      } else if (productData.categoryId !== 2) {
        // If changing from service to non-service category, remove service provider data
        await storage.deleteServiceProviderByProductId(productId);
      }
      
      // Update discount tier if provided
      if (discountPrice && parseFloat(discountPrice) < parseFloat(productData.originalPrice)) {
        // Remove existing discount tiers first
        await storage.removeDiscountTiersForProduct(product.id!);
        
        // Create new discount tier
        await storage.createDiscountTier({
          productId: product.id!,
          participantCount: productData.minimumParticipants,
          discountPercentage: (((parseFloat(productData.originalPrice) - parseFloat(discountPrice)) / parseFloat(productData.originalPrice)) * 100).toString(),
          finalPrice: discountPrice.toString(),
        });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: "Failed to update product" });
    }
  });

  app.get('/api/seller/orders', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const orders = await storage.getSellerOrders(sellerId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching seller orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/seller/metrics', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const metrics = await storage.getSellerMetrics(sellerId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching seller metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Advanced seller analytics endpoint
  app.get('/api/seller/analytics', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const { startDate, endDate } = req.query;
      
      const analytics = await storage.getSellerAnalytics(sellerId, {
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching seller analytics:", error);
      res.status(500).json({ message: "Failed to fetch seller analytics" });
    }
  });

  // Seller notification routes (accessible to all authenticated users)
  app.get('/api/seller/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { limit } = req.query;
      
      const notifications = await storage.getSellerNotifications(userId, limit ? parseInt(limit) : 50);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get('/api/seller/notifications/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadSellerNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch('/api/seller/notifications/:notificationId/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notificationId = parseInt(req.params.notificationId);
      
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      // Verify the notification belongs to this user
      const notifications = await storage.getSellerNotifications(userId, 1000);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch('/api/seller/notifications/mark-all-read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete('/api/seller/notifications/:notificationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notificationId = parseInt(req.params.notificationId);
      
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      // Verify the notification belongs to this user
      const notifications = await storage.getSellerNotifications(userId, 1000);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      const deleted = await storage.deleteNotification(notificationId);
      if (deleted) {
        res.json({ message: "Notification deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete notification" });
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });


  // Process expired notifications (S5 & S6) - should be called periodically
  app.post('/api/notifications/process-expired', async (req: any, res) => {
    try {
      await notificationService.processExpiredNotifications();
      res.json({ message: "Expired notifications processed successfully" });
    } catch (error) {
      console.error("Error processing expired notifications:", error);
      res.status(500).json({ message: "Failed to process expired notifications" });
    }
  });

  // Send daily group owner reminder (cron job endpoint)
  app.post('/api/notifications/group-owner-reminder', async (req: any, res) => {
    try {
      console.log("Sending daily group owner reminder...");
      await notificationService.notifyGroupOwnersIncompleteGroups();
      res.json({ message: "Group owner reminder sent successfully" });
    } catch (error) {
      console.error("Error sending group owner reminder:", error);
      res.status(500).json({ message: "Failed to send group owner reminder" });
    }
  });

  // Real-time notifications via Server-Sent Events (SSE)
  app.get('/api/notifications/stream', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`Setting up real-time notifications for user: ${userId}`);
      
      // Add client to the broadcaster
      notificationBroadcaster.addClient(userId, req, res);
      
      // Keep the connection alive with periodic heartbeats
      const heartbeat = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
        } catch (error) {
          clearInterval(heartbeat);
        }
      }, 30000); // Send heartbeat every 30 seconds

      // Clean up on disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        console.log(`Real-time notifications disconnected for user: ${userId}`);
      });

    } catch (error) {
      console.error("Error setting up real-time notifications:", error);
      res.status(500).json({ message: "Failed to setup real-time notifications" });
    }
  });

  app.patch('/api/seller/orders/:orderId/status', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const orderId = parseInt(req.params.orderId);
      const { status } = req.body;
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      // Get the order with items to verify seller ownership
      console.log(`Fetching order ${orderId} for seller ${sellerId}`);
      const order = await storage.getOrderWithItems(orderId);
      if (!order) {
        console.log(`Order ${orderId} not found`);
        return res.status(404).json({ message: "Order not found" });
      }
      
      console.log(`Order ${orderId} found. Items:`, order.items?.length || 0, "Direct productId:", order.productId);

      // Check if any of the order items belong to this seller
      let hasSellerProduct = false;
      
      // Check if order has items (new structure)
      if (order.items && order.items.length > 0) {
        console.log(`Order ${orderId} has ${order.items.length} items. Checking seller ownership...`);
        order.items.forEach((item, index) => {
          console.log(`Item ${index}: productId=${item.productId}, sellerId=${item.product.sellerId}, requestedSellerId=${sellerId}`);
        });
        hasSellerProduct = order.items.some(item => item.product.sellerId === sellerId);
        console.log(`Has seller product (new structure): ${hasSellerProduct}`);
      } 
      // Fallback: check if order has direct productId (old structure)
      else if (order.productId) {
        console.log(`Order ${orderId} using old structure with productId: ${order.productId}`);
        const product = await storage.getProduct(order.productId);
        hasSellerProduct = product && product.sellerId === sellerId;
        console.log(`Product found: ${!!product}, sellerId: ${product?.sellerId}, requestedSellerId: ${sellerId}, hasSellerProduct: ${hasSellerProduct}`);
      } else {
        console.log(`Order ${orderId} has no items and no productId`);
      }

      if (!hasSellerProduct) {
        console.log(`Access denied for seller ${sellerId} on order ${orderId}. Order items:`, order.items?.map(i => ({ productId: i.productId, sellerId: i.product.sellerId })) || 'No items');
        return res.status(403).json({ message: "Access denied" });
      }

      // Update the order status
      const updatedOrder = await storage.updateOrderStatus(orderId, status);
      
      // Scenario 4: Notify the specific member when order status is changed
      if (updatedOrder.userId) {
        await notificationService.notifyOrderStatusChanged(updatedOrder.userId, orderId, status);
      }

      
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Stripe payment routes
  // Group-specific payment intent creation
  app.post("/api/create-group-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      
      const { userGroupId, productId, amount, currency = "usd", addressId, memberId, payerId, beneficiaryId } = req.body;
      
      if (!userGroupId || !productId || !amount || amount <= 0 || !addressId) {
        return res.status(400).json({ message: "userGroupId, productId, amount, and addressId are required" });
      }

      // Check if user is already part of this group
      const isInGroup = await storage.isUserInUserGroup(userGroupId, req.user.claims.sub);
      if (!isInGroup) {
        return res.status(403).json({ message: "User must be a participant in this group to make payments" });
      }

      // Use payerId and beneficiaryId from request body, with fallbacks
      const finalPayerId = payerId || req.user.claims.sub;
      const finalBeneficiaryId = beneficiaryId || memberId || req.user.claims.sub;
      
      // Check if this beneficiary has already paid for this product in this group
      const alreadyPaid = await storage.hasUserPaidForProduct(finalBeneficiaryId, userGroupId, productId);
      if (alreadyPaid) {
        return res.status(400).json({ message: "This user has already paid for this product in this group" });
      }

      // Get product details for description
      let productName = "Group Purchase Product";
      try {
        const product = await storage.getProduct(productId);
        productName = product?.name || "Group Purchase Product";
      } catch (e) {
        console.log("Could not fetch product details for group payment intent");
      }

      // Create customer with billing address
      const customer = await stripe.customers.create({
        name: "Group Purchase Customer",
        address: {
          line1: "Customer Address",
          city: "Customer City",
          state: "CA",
          postal_code: "90210",
          country: "US"
        }
      });

      // Create payment intent for group purchase
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customer.id,
        description: `Group Purchase: ${productName}`,
        shipping: {
          name: "Group Purchase Customer",
          address: {
            line1: "Shipping Address",
            city: "Shipping City", 
            state: "CA",
            postal_code: "90210",
            country: "US"
          }
        },
        metadata: {
          payerId: finalPayerId,
          beneficiaryId: finalBeneficiaryId,
          userGroupId: userGroupId.toString(),
          productId: productId.toString(),
          addressId: addressId.toString(),
          type: "group_member"
        }
      });

      // Create group payment record
      const groupPayment = await storage.createGroupPayment({
        userId: finalBeneficiaryId, // Who receives the order
        payerId: finalPayerId, // Who makes the payment
        userGroupId,
        productId,
        unitPrice: amount.toString(),
        amount: amount.toString(),
        status: "pending",
        stripePaymentIntentId: paymentIntent.id
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentId: groupPayment.id 
      });
    } catch (error: any) {
      console.error("Error creating group payment intent:", error);
      res.status(500).json({ message: "Error creating group payment intent: " + error.message });
    }
  });

  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { amount, currency = "usd", productId, type = "individual" } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      // Get product details for description
      let productName = "Consumer Electronics Product";
      if (productId) {
        try {
          const product = await storage.getProduct(productId);
          productName = product?.name || "Consumer Electronics Product";
        } catch (e) {
          console.log("Could not fetch product details for payment intent");
        }
      }

      // Step 1: Create customer with billing address (required for Indian export transactions)
      const customer = await stripe.customers.create({
        name: "International Customer",
        address: {
          line1: "Customer Address",
          city: "Customer City",
          state: "CA",
          postal_code: "90210",
          country: "US" // 2-letter ISO code required
        }
      });

      // Step 2: Create payment intent with shipping address (required for goods)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customer.id, // Link to customer with billing address
        description: productName, // Clear product description required
        shipping: {
          name: "International Customer",
          address: {
            line1: "Shipping Address",
            city: "Shipping City",
            state: "CA",
            postal_code: "90210",
            country: "US" // 2-letter ISO code required for goods
          }
        },
        metadata: {
          userId: req.user.claims.sub,
          productId: productId?.toString() || "",
          type,
        }
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Webhook for payment confirmation
  app.post("/api/stripe-webhook", async (req, res) => {
    let event;

    try {
      // In development, we might not have proper webhook signature verification
      // For now, we'll accept the raw body and add extensive logging
      event = req.body;
      console.log("Webhook received:", JSON.stringify(event, null, 2));
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${err}`);
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        console.log("Payment succeeded:", paymentIntent.id);
        console.log("Payment metadata:", paymentIntent.metadata);
        
        try {
          const type = paymentIntent.metadata.type || "individual";
          const amount = paymentIntent.amount / 100; // Convert from cents
          
          if (type === "group_member") {
            // Handle group member payments
            const payerId = paymentIntent.metadata.payerId;
            const beneficiaryId = paymentIntent.metadata.beneficiaryId;
            const userGroupId = parseInt(paymentIntent.metadata.userGroupId);
            const addressId = parseInt(paymentIntent.metadata.addressId);
            
            if (!payerId || !beneficiaryId || !userGroupId || !addressId) {
              console.error("Missing required group payment metadata:", { payerId, beneficiaryId, userGroupId, addressId });
              break;
            }

            // Get the user group to find product information
            const userGroup = await storage.getUserGroup(userGroupId);
            if (!userGroup || !userGroup.items || userGroup.items.length === 0) {
              console.error("User group or items not found:", userGroupId);
              break;
            }

            // Get the address for shipping information
            const addresses = await storage.getUserAddresses(payerId);
            const address = addresses.find(addr => addr.id === addressId);
            if (!address) {
              console.error("Address not found:", addressId);
              break;
            }

            // Create a single order with multiple items for the group purchase (for the beneficiary)
            let totalOrderPrice = 0;
            const orderItems = [];
            
            for (const item of userGroup.items) {
              // Calculate the discounted price for this specific item
              let discountedPrice = parseFloat(item.product.originalPrice);
              if (item.product.discountTiers && item.product.discountTiers.length > 0) {
                const totalMembers = parseInt(paymentIntent.metadata.totalMembers);
                const applicableTiers = item.product.discountTiers.filter(tier => totalMembers >= tier.participantCount);
                if (applicableTiers.length > 0) {
                  const bestTier = applicableTiers.sort((a, b) => b.participantCount - a.participantCount)[0];
                  discountedPrice = parseFloat(bestTier.finalPrice);
                }
              }
              
              const itemTotal = discountedPrice * item.quantity;
              totalOrderPrice += itemTotal;
              
              orderItems.push({
                productId: item.product.id,
                quantity: item.quantity,
                unitPrice: discountedPrice.toFixed(2),
                totalPrice: itemTotal.toFixed(2)
              });
            }
            
            const orderData = {
              userId: beneficiaryId, // Order belongs to the beneficiary
              payerId: payerId, // Who made the payment
              addressId: addressId,
              totalPrice: totalOrderPrice.toFixed(2),
              finalPrice: totalOrderPrice.toFixed(2),
                status: "completed" as const,
                type: "group" as const,
                shippingAddress: `${address.fullName}, ${address.addressLine}, ${address.city}, ${address.state || ''} ${address.pincode}, ${address.country || 'US'}`
            };
            
            console.log("Creating order with data:", JSON.stringify(orderData, null, 2));

            const newOrder = await storage.createOrderWithItems(orderData, orderItems);
            console.log(`Group order with ${orderItems.length} items created for beneficiary ${beneficiaryId}:`, newOrder.id);
            
            // Create notifications for sellers about payment received
            const sellerNotifications = new Map();
            for (const item of orderItems) {
              const product = await storage.getProduct(item.productId);
              if (product && product.sellerId) {
                const sellerId = product.sellerId;
                if (!sellerNotifications.has(sellerId)) {
                  sellerNotifications.set(sellerId, []);
                }
                sellerNotifications.get(sellerId).push({
                  name: product.name,
                  amount: item.totalPrice
                });
              }
            }
            
            // Create one notification per seller with payment details
            for (const [sellerId, products] of sellerNotifications) {
              const totalAmount = products.reduce((sum, product) => sum + parseFloat(product.amount), 0);
              await storage.createSellerNotification({
                sellerId,
                type: "payment_received",
                title: "Payment Received",
                message: `Payment of $${totalAmount.toFixed(2)} received for: ${products.map(p => p.name).join(", ")} (Order #${newOrder.id})`,
                data: { orderId: newOrder.id, amount: totalAmount, productIds: products.map(p => p.productId) },
                priority: "high"
              });
            }

            // Create group payment records for each item to track payment status
            for (const item of userGroup.items) {
              // Calculate the discounted price for this specific item
              let discountedPrice = parseFloat(item.product.originalPrice);
              if (item.product.discountTiers && item.product.discountTiers.length > 0) {
                const totalMembers = parseInt(paymentIntent.metadata.totalMembers);
                const applicableTiers = item.product.discountTiers.filter(tier => totalMembers >= tier.participantCount);
                if (applicableTiers.length > 0) {
                  const bestTier = applicableTiers.sort((a, b) => b.participantCount - a.participantCount)[0];
                  discountedPrice = parseFloat(bestTier.finalPrice);
                }
              }
              
              const groupPaymentData = {
                userId: beneficiaryId, // Who the payment is for
                payerId: payerId, // Who made the payment
                userGroupId: userGroupId,
                productId: item.product.id,
                stripePaymentIntentId: paymentIntent.id,
                amount: (discountedPrice * item.quantity).toFixed(2),
                currency: "usd",
                status: "succeeded",
                quantity: item.quantity,
                unitPrice: discountedPrice.toFixed(2)
              };
              
              const groupPayment = await storage.createGroupPayment(groupPaymentData);
              
              // Send payment notifications
              await notificationService.notifyPaymentMade(groupPayment.id);
            }
            
            console.log(`Group payment records created for beneficiary ${beneficiaryId}`);
            console.log(`Group purchase payment processed: ${payerId} paid for ${beneficiaryId}`);
            
          } else {
            // Handle individual payments (original logic)
            const userId = paymentIntent.metadata.userId;
            const productId = parseInt(paymentIntent.metadata.productId);
            
            if (!userId || !productId) {
              console.error("Missing required metadata for individual order creation");
              break;
            }

            // Get product details for order
            const product = await storage.getProduct(productId);
            if (!product) {
              console.error("Product not found for order creation:", productId);
              break;
            }

            // Create order record for individual purchase
            const orderData = {
              userId,
              payerId: userId, // For individual purchases, user pays for themselves
              productId,
              quantity: 1, // Default quantity
              unitPrice: amount.toString(),
              totalPrice: amount.toString(),
              finalPrice: amount.toString(),
              status: "completed" as const,
              type: type as "individual" | "group",
              shippingAddress: "International Shipping Address"
            };

            const newOrder = await storage.createOrder(orderData);
            console.log("Individual order created successfully:", newOrder.id);
          }

        } catch (error) {
          console.error("Error creating order from payment:", error);
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  app.delete('/api/seller/products/:productId', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const productId = parseInt(req.params.productId);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      // Check if the product belongs to this seller
      const existingProduct = await storage.getProduct(productId);
      if (!existingProduct || existingProduct.sellerId !== sellerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get participant count to show in warning
      const participantCount = await storage.getProductParticipantCount(productId);
      
      if (participantCount > 0) {
        return res.status(400).json({ 
          message: "Cannot delete product with active participants",
          participantCount,
          details: `This product has ${participantCount} people who have joined the group purchase. Deleting it will affect their orders.`
        });
      }

      // Delete the product (this should cascade to related records)
      await storage.deleteProduct(productId);
      
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // New group payment intent endpoint for member-specific payments
  app.post("/api/group-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { userGroupId, addressId, memberId } = req.body;
      const userId = req.user.claims.sub;
      
      if (!userGroupId || !addressId) {
        return res.status(400).json({ message: "userGroupId and addressId are required" });
      }

      // Verify access - user must be owner or approved participant
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const isOwner = userGroup.userId === userId;
      if (!isOwner) {
        const isApproved = await storage.isUserInUserGroup(userGroupId, userId);
        if (!isApproved) {
          return res.status(403).json({ message: "Access denied - only group owner or approved participants can create payments" });
        }
      }

      // Validate group is ready for payments (locked and has items)
      const isLocked = await storage.isUserGroupLocked(userGroupId);
      if (!isLocked) {
        return res.status(400).json({ message: `Group must be at full capacity before payments can be processed` });
      }

      const groupItems = userGroup.items || [];
      if (groupItems.length === 0) {
        return res.status(400).json({ message: "Group has no items to purchase" });
      }

      // Determine beneficiary and validate membership
      const payingForMember = memberId || userId;
      if (memberId && memberId !== userId) {
        // Validate that the specified member is actually in this group
        const isMemberInGroup = payingForMember === userGroup.userId || await storage.isUserInUserGroup(userGroupId, payingForMember);
        if (!isMemberInGroup) {
          return res.status(400).json({ message: "Specified member is not part of this group" });
        }
      }

      // Check cache first to prevent amount fluctuation
      const cacheKey = `group-${userGroupId}`;
      const cached = groupPricingCache.get(cacheKey);
      const now = Date.now();
      
      let popularGroupValue = 0;
      let totalDiscountedAmount = 0;
      let memberAmount = 0;
      let potentialSavings = 0;
      let totalMembers = 0;
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        // Use cached values
        popularGroupValue = cached.originalAmount;
        totalDiscountedAmount = cached.originalAmount - cached.potentialSavings;
        memberAmount = cached.amount;
        potentialSavings = cached.potentialSavings;
        totalMembers = cached.totalMembers || 5; // Default to 5 if not cached
        console.log(`Server - Using cached pricing for group ${userGroupId}: Amount: $${memberAmount.toFixed(2)}`);
      } else {
        // Calculate fresh pricing
      const approvedCount = await storage.getUserGroupParticipantCount(userGroupId);
        totalMembers = approvedCount + 1; // +1 for the owner
        
        // Ensure we have a minimum of 5 members for group pricing (as per the UI logic)
        const effectiveMemberCount = Math.max(totalMembers, 5);
        
        console.log(`Server - Group ${userGroupId}: Approved count: ${approvedCount}, Total members: ${totalMembers}, Effective count: ${effectiveMemberCount}`);

      // Calculate total amount with correct discount tiers
        console.log(`Server - Processing ${groupItems.length} items for group ${userGroupId}`);
        
      for (const item of groupItems) {
          console.log(`Server - Item: ${item.product.name}, Discount Tiers:`, item.product.discountTiers);
        const originalPrice = parseFloat(item.product.originalPrice.toString());
          popularGroupValue += originalPrice * item.quantity;
          
        let discountPrice = originalPrice;
        
          // Find correct discount tier based on effective member count - pick the highest applicable tier
        if (item.product.discountTiers && item.product.discountTiers.length > 0) {
            const applicableTiers = item.product.discountTiers.filter(tier => effectiveMemberCount >= tier.participantCount);
          if (applicableTiers.length > 0) {
            // Sort by participantCount descending and take the first (highest applicable tier)
            const bestTier = applicableTiers.sort((a, b) => b.participantCount - a.participantCount)[0];
            discountPrice = parseFloat(bestTier.finalPrice.toString());
              console.log(`Server - Item: ${item.product.name}, Original: $${originalPrice}, Discounted: $${discountPrice}, Tier: ${bestTier.participantCount} participants, Effective Members: ${effectiveMemberCount}`);
            } else {
              console.log(`Server - Item: ${item.product.name}, No applicable discount tiers for ${effectiveMemberCount} members`);
            }
          } else {
            console.log(`Server - Item: ${item.product.name}, No discount tiers available`);
          }
          
          totalDiscountedAmount += discountPrice * item.quantity;
        }

        // Calculate final amount using formula: Popular Group Value - Potential Savings
        potentialSavings = popularGroupValue - totalDiscountedAmount;
        memberAmount = popularGroupValue - potentialSavings; // This equals totalDiscountedAmount
        
        // Cache the calculated values
        groupPricingCache.set(cacheKey, {
          amount: memberAmount,
          originalAmount: popularGroupValue,
          potentialSavings: potentialSavings,
          totalMembers: totalMembers,
          timestamp: now
        });
        
        console.log(`Server - Final calculations: Popular Group Value: $${popularGroupValue.toFixed(2)}, Total Discounted: $${totalDiscountedAmount.toFixed(2)}, Potential Savings: $${potentialSavings.toFixed(2)}, Member Amount: $${memberAmount.toFixed(2)}`);
      }

      // Get address for shipping
      const addresses = await storage.getUserAddresses(userId);
      const address = addresses.find(addr => addr.id === addressId);
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }

      // Create payment description
      const isPayingForOther = memberId && memberId !== userId;
      const description = isPayingForOther 
        ? `Group Purchase Payment for Member (${memberAmount.toFixed(2)} - Popular Group Value minus Potential Savings)`
        : `Group Purchase Payment (${memberAmount.toFixed(2)} - Popular Group Value minus Potential Savings)`;

      // Create customer with billing address
      const customer = await stripe.customers.create({
        name: address.fullName,
        address: {
          line1: address.addressLine,
          city: address.city,
          state: address.state || undefined,
          postal_code: address.pincode,
          country: address.country || "US"
        }
      });

      // Create payment intent for member-specific amount
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(memberAmount * 100), // Convert to cents - ONLY the member's portion
        currency: "usd",
        customer: customer.id,
        description,
        shipping: {
          name: address.fullName,
          address: {
            line1: address.addressLine,
            city: address.city,
            state: address.state || undefined,
            postal_code: address.pincode,
            country: address.country || "US"
          }
        },
        metadata: {
          payerId: userId, // Who is making the payment
          beneficiaryId: payingForMember, // Who the payment is for
          userGroupId: userGroupId.toString(),
          addressId: addressId.toString(),
          totalMembers: totalMembers.toString(),
          memberAmount: memberAmount.toFixed(2), // Full discounted amount per member
          totalGroupValue: (memberAmount * totalMembers).toFixed(2), // Total value for all members
          type: "group_member"
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: memberAmount, // Return the full discounted amount per member
        paymentId: paymentIntent.id
      });
    } catch (error) {
      console.error("Error creating group payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
