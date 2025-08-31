import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupPhoneAuth, isAuthenticated } from "./phoneAuth";
import { seedDatabase } from "./seed";
import Stripe from "stripe";
import {
  insertProductSchema,
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

// Admin authentication middleware for specific user
const isAdminAuthenticated = (req: any, res: any, next: any) => {
  const { userId, password } = req.body;
  
  // Allow viswa968 with any password
  if (userId === 'viswa968') {
    req.admin = { userId };
    return next();
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
  app.post('/api/admin/login', (req, res) => {
    const { userId, password } = req.body;
    
    if (userId === 'viswa968') {
      res.json({ success: true, message: "Admin logged in" });
    } else {
      res.status(403).json({ message: "Admin access denied" });
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

  app.get('/api/seller/products', isAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const products = await storage.getProductsBySeller(sellerId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post('/api/products', isAuthenticated, async (req: any, res) => {
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
      });
      const order = await storage.createOrder(orderData);
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
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:orderId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = parseInt(req.params.orderId);
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order belongs to user
      if (order.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

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

      // Check if user is already in the group
      const isAlreadyInGroup = await storage.isUserInUserGroup(userGroupId, userId);
      if (isAlreadyInGroup) {
        return res.status(400).json({ message: "Already joined this collection" });
      }

      const success = await storage.joinUserGroup(userGroupId, userId);
      if (success) {
        res.status(201).json({ message: "Successfully joined collection" });
      } else {
        res.status(400).json({ message: "Failed to join collection" });
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
      res.json({ isParticipating });
    } catch (error) {
      console.error("Error checking user group participation:", error);
      res.status(500).json({ message: "Failed to check participation status" });
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

  app.post('/api/seller/products', isAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const { discountPrice, ...productFields } = req.body;
      const productData = {
        ...productFields,
        sellerId,
        // Convert ISO string to Date object for validation
        offerValidTill: productFields.offerValidTill ? new Date(productFields.offerValidTill) : undefined,
      };
      
      const validatedProductData = insertProductSchema.parse(productData);
      const product = await storage.createProduct(validatedProductData);
      
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

  app.patch('/api/seller/products/:productId', isAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const productId = parseInt(req.params.productId);
      const { discountPrice, ...productFields } = req.body;
      
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

  app.get('/api/seller/orders', isAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const orders = await storage.getSellerOrders(sellerId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching seller orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/seller/metrics', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/seller/analytics', isAuthenticated, async (req: any, res) => {
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

  app.patch('/api/seller/orders/:orderId/status', isAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const orderId = parseInt(req.params.orderId);
      const { status } = req.body;
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      // Get the order to verify seller ownership
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if the order belongs to a product owned by this seller
      const product = await storage.getProduct(order.productId);
      if (!product || product.sellerId !== sellerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update the order status
      const updatedOrder = await storage.updateOrderStatus(orderId, status);
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Stripe payment routes
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
      event = req.body;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${err}`);
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        console.log("Payment succeeded:", paymentIntent.id);
        
        try {
          // Extract metadata
          const userId = paymentIntent.metadata.userId;
          const productId = parseInt(paymentIntent.metadata.productId);
          const type = paymentIntent.metadata.type || "individual";
          const amount = paymentIntent.amount / 100; // Convert from cents
          
          if (!userId || !productId) {
            console.error("Missing required metadata for order creation");
            break;
          }

          // Get product details for order
          const product = await storage.getProduct(productId);
          if (!product) {
            console.error("Product not found for order creation:", productId);
            break;
          }

          // Create order record
          const orderData = {
            userId,
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
          console.log("Order created successfully:", newOrder.id);

          // If it's a group purchase, also create group participant record
          if (type === "group") {
            // Note: In a real implementation, you'd want to find the existing group purchase
            // For now, we'll just create the order
            console.log("Group purchase order completed for user:", userId);
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

  app.delete('/api/seller/products/:productId', isAuthenticated, async (req: any, res) => {
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


  const httpServer = createServer(app);
  return httpServer;
}
