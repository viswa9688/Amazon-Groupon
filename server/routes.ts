import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { ultraFastStorage } from "./ultraFastStorage";
import { setupPhoneAuth, isAuthenticated, isSellerAuthenticated } from "./phoneAuth";
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { orders } from "@shared/schema";
import { seedDatabase } from "./seed";
import Stripe from "stripe";
import { notificationService } from "./notificationService";
import { websocketNotificationBroadcaster } from "./websocketNotificationBroadcaster";
import { deliveryService } from "./deliveryService";
import { calculateExpectedDeliveryDate } from "./utils/orderTimeManager";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { performance } from "perf_hooks";
import { CacheWarmer, CachePerformanceMonitor } from "./cache";
import { performanceMiddleware, performanceMonitor } from "./performance-monitor";
import { ExcelService } from "./excelService";
import multer from "multer";
import {
  insertProductSchema,
  insertServiceProviderSchema,
  insertPetProviderSchema,
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

// Enhanced caching system
const groupPricingCache = new Map<string, { amount: number; originalAmount: number; potentialSavings: number; totalMembers: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Multer configuration for file uploads (Excel import)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Security: Only allow Excel files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// General API response cache
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const DEFAULT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for general API responses
const LONG_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for static data like categories

// Cache utility functions
function getCachedData(key: string): any | null {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  apiCache.delete(key);
  return null;
}

function setCachedData(key: string, data: any, ttl: number = DEFAULT_CACHE_TTL): void {
  apiCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  apiCache.forEach((cached, key) => {
    if (now - cached.timestamp >= cached.ttl) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => apiCache.delete(key));
}, 5 * 60 * 1000); // Clean up every 5 minutes

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

// Session-based admin authentication middleware
const isAdminAuthenticatedSession = async (req: any, res: any, next: any) => {
  try {
    console.log("=== ADMIN AUTH SESSION CHECK ===");
    console.log("Session adminLogin:", (req.session as any).adminLogin);
    console.log("Request body:", req.body);
    
    // Check if admin is logged in via session
    if ((req.session as any).adminLogin && (req.session as any).adminLogin.userId) {
      console.log("Checking session credentials for:", (req.session as any).adminLogin.userId);
      const isValid = await storage.validateAdminCredentials(
        (req.session as any).adminLogin.userId, 
        (req.session as any).adminLogin.password
      );
      if (isValid) {
        console.log("Session credentials valid");
        req.admin = { userId: (req.session as any).adminLogin.userId };
        return next();
      } else {
        console.log("Session credentials invalid");
      }
    }
    
    // Fallback: check request body for credentials
    const { userId, password } = req.body;
    if (userId && password) {
      console.log("Checking body credentials for:", userId);
      const isValid = await storage.validateAdminCredentials(userId, password);
      if (isValid) {
        console.log("Body credentials valid");
        req.admin = { userId };
        return next();
      } else {
        console.log("Body credentials invalid");
      }
    }
    
    console.log("No valid admin credentials found");
  } catch (error: any) {
    console.error("Admin authentication error:", error);
    console.error("Error stack:", error.stack);
  }
  
  return res.status(403).json({ message: "Admin access denied" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Performance monitoring middleware
  app.use(performanceMiddleware);
  
  // ULTRA-FAST performance middleware
  app.use(compression({
    level: 6, // Balanced compression
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Don't compress if already compressed
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  // ULTRA-SCALED rate limiting for 1000+ concurrent users
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // 100x higher limit for 1000+ concurrent users
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: any) => {
      // Skip rate limiting for performance monitoring and testing
      return req.path === '/api/performance' || 
             req.path === '/api/test-db' ||
             req.path === '/api/test/google-api-status';
    }
  });
  app.use('/api/', limiter);

  // Initialize ultra-fast cache system
  console.log('🚀 Initializing ultra-fast cache system...');
  const cacheWarmer = CacheWarmer.getInstance();
  const performanceMonitor = CachePerformanceMonitor.getInstance();
  
  // Warm cache with frequent data
  await cacheWarmer.warmFrequentData();
  
  // Set up background refresh
  await cacheWarmer.setupBackgroundRefresh();
  
  // Start performance monitoring
  performanceMonitor.monitorCachePerformance();
  
  console.log('✅ Ultra-fast cache system initialized');

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

  // Performance monitoring endpoint
  app.get('/api/performance', async (req, res) => {
    try {
      const cacheStats = ultraFastStorage.getCacheStats();
      const dbStats = {
        totalConnections: db.$client?.totalCount || 0,
        idleConnections: db.$client?.idleCount || 0,
        waitingCount: db.$client?.waitingCount || 0
      };
      
      res.json({
        cache: cacheStats,
        database: dbStats,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch (error) {
      console.error("Error fetching performance stats:", error);
      res.status(500).json({ message: "Failed to fetch performance stats" });
    }
  });

  // Auth routes are now handled in phoneAuth.ts
  
  // Admin authentication route
  app.post('/api/admin/login', async (req, res) => {
    const { userId, password } = req.body;
    
    try {
      const isValid = await storage.validateAdminCredentials(userId, password);
      if (isValid) {
        // Store admin login in session
        (req.session as any).adminLogin = { userId, password };
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
    const startTime = performance.now();
    
    try {
      // ULTRA-FAST: Get all users and products in parallel
      const [allUsers, allProducts] = await Promise.all([
        storage.getAllUsers(),
        storage.getProducts()
      ]);
      
      // Create a map of seller product counts for O(1) lookup
      const sellerProductCounts = new Map();
      allProducts.forEach(product => {
        const count = sellerProductCounts.get(product.sellerId) || 0;
        sellerProductCounts.set(product.sellerId, count + 1);
      });
      
      const sellers = [];
      const buyers = [];
      
      // ULTRA-FAST: Single pass classification
      for (const user of allUsers) {
        const productCount = sellerProductCounts.get(user.id) || 0;
        if (user.isSeller || productCount > 0) {
          sellers.push({ ...user, productCount });
        } else {
          buyers.push(user);
        }
      }
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 5 ? 'HIT' : 'MISS');
      
      res.json({ sellers, buyers });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Address validation endpoint - supports both single address string and structured address
  app.post('/api/address/validate', async (req, res) => {
    try {
      const { address, addressLine1, addressLine2, city, state, postalCode, country, orderTotal } = req.body;
      
      // Handle both single address string and structured address formats
      let addressObj;
      if (address) {
        // Parse single address string (e.g., "123 Main St, Vancouver, BC V6C 1T4")
        const parts = address.split(',').map(part => part.trim());
        if (parts.length >= 3) {
          addressObj = {
            addressLine: parts[0],
            city: parts[1],
            state: parts[2].split(' ')[0], // Extract province/state
            pincode: parts[2].split(' ').slice(1).join(' '), // Extract postal code
            country: 'Canada'
          };
        } else {
          return res.status(400).json({ 
            isValid: false, 
            error: "Invalid address format. Please provide full address with city, province, and postal code." 
          });
        }
      } else if (addressLine1 && city && state && postalCode && country) {
        // Handle structured address format
        addressObj = {
          addressLine: addressLine1 + (addressLine2 ? `, ${addressLine2}` : ''),
          city,
          state,
          pincode: postalCode,
          country
        };
      } else {
        return res.status(400).json({ 
          isValid: false, 
          error: "Missing required address fields. Provide either 'address' string or structured address fields." 
        });
      }

      // Import services
      const { geocodingService } = await import('./geocodingService');
      const { DeliveryService } = await import('./deliveryService');
      
      // Validate address in BC
      const validationResult = await geocodingService.verifyBCAddress(addressObj);
      
      if (!validationResult.isInBC) {
        return res.json({
          isValid: false,
          formattedAddress: validationResult.formattedAddress,
          province: validationResult.province,
          confidence: validationResult.confidence,
          error: validationResult.error || "Address is not in British Columbia",
          deliveryInfo: null
        });
      }

      // Calculate delivery information if address is valid
      let deliveryInfo = null;
      if (validationResult.isInBC) {
        try {
          const deliveryService = new DeliveryService();
          
          // Create a mock order for delivery calculation
          const mockOrder = {
            items: [{
              sellerId: 'default-seller', // Use a default seller for calculation
              quantity: 1,
              price: orderTotal || 0
            }]
          };
          
          const deliveryResult = await deliveryService.calculateDeliveryCharges(
            addressObj,
            orderTotal || 0,
            'individual'
          );
          
          // Extract delivery info from the result
          deliveryInfo = {
            distance: Math.round(deliveryResult.distance * 10) / 10, // Round to 1 decimal
            estimatedTime: Math.round(deliveryResult.duration || 0),
            deliveryFee: deliveryResult.deliveryCharge,
            isFreeDelivery: deliveryResult.isFreeDelivery,
            reason: deliveryResult.reason,
            minimumOrderValue: 50.00, // $50 minimum for all orders as shown in UI
            deliveryRatePerKm: 5.99, // $5.99 per km beyond 10km
            freeDeliveryDistance: 10, // 10km free delivery
            orderTotal: orderTotal || 0,
            meetsMinimumOrder: deliveryResult.meetsMinimumOrder ?? ((orderTotal || 0) >= 50.00)
          };
        } catch (deliveryError) {
          console.warn('Delivery calculation failed:', deliveryError);
          // Still return valid address even if delivery calculation fails
        }
      }
      
      res.json({
        isValid: true,
        formattedAddress: validationResult.formattedAddress,
        province: validationResult.province,
        confidence: validationResult.confidence,
        error: null,
        deliveryInfo
      });
    } catch (error) {
      console.error("Error validating address:", error);
      res.status(500).json({ 
        isValid: false, 
        error: "Address validation failed" 
      });
    }
  });

  // Legacy address validation endpoint (for backward compatibility)
  app.post('/api/validate-address', async (req, res) => {
    try {
      const { addressLine1, addressLine2, city, state, postalCode, country } = req.body;
      
      if (!addressLine1 || !city || !state || !postalCode || !country) {
        return res.status(400).json({ 
          isValid: false, 
          error: "Missing required address fields" 
        });
      }

      const address = {
        addressLine: addressLine1 + (addressLine2 ? `, ${addressLine2}` : ''),
        city,
        state,
        pincode: postalCode,
        country
      };

      const { geocodingService } = await import('./geocodingService');
      const result = await geocodingService.verifyBCAddress(address);
      
      res.json({
        isValid: result.isInBC,
        formattedAddress: result.formattedAddress,
        province: result.province,
        confidence: result.confidence,
        error: result.error
      });
    } catch (error) {
      console.error("Error validating address:", error);
      res.status(500).json({ 
        isValid: false, 
        error: "Address validation failed" 
      });
    }
  });
  
  app.put('/api/admin/users/:id', isAdminAuthenticated, async (req, res) => {
    try {
      const userId = req.params.id;
      const userData = req.body;
      
      // Check if credentials-related fields or critical user status fields are being updated
      const credentialFields = ['phoneNumber', 'email', 'firstName', 'lastName'];
      const statusFields = ['isSeller', 'status', 'isSellerType'];
      const hasCredentialChanges = credentialFields.some(field => 
        userData.hasOwnProperty(field) && userData[field] !== undefined
      );
      const hasStatusChanges = statusFields.some(field => 
        userData.hasOwnProperty(field) && userData[field] !== undefined
      );
      
      const updatedUser = await storage.updateUserAdmin(userId, userData);
      
      // Handle session updates based on the type of changes
      if (hasCredentialChanges || hasStatusChanges) {
        try {
          if (hasCredentialChanges) {
            // For credential changes, invalidate all sessions (force re-login)
            await storage.invalidateUserSessions(userId);
            console.log(`Sessions invalidated for user ${userId} due to credential changes`);
          }
          
          if (hasStatusChanges) {
            // For status changes, update sessions in real-time (better UX)
            const statusUpdates = statusFields.reduce((acc, field) => {
              if (userData.hasOwnProperty(field) && userData[field] !== undefined) {
                acc[field] = userData[field];
              }
              return acc;
            }, {} as any);
            
            await storage.updateUserSessions(userId, statusUpdates);
            console.log(`Sessions updated for user ${userId} with status changes:`, statusUpdates);
          }
        } catch (sessionError) {
          console.error(`Failed to update sessions for user ${userId}:`, sessionError);
          // Don't fail the user update if session update fails
        }
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      
      // Handle specific error types
      if (error.message?.includes('already exists')) {
        return res.status(409).json({ 
          message: error.message,
          error: 'CONFLICT',
          details: 'The provided value conflicts with an existing record'
        });
      }
      
      if (error.message?.includes('not found')) {
        return res.status(404).json({ 
          message: error.message,
          error: 'NOT_FOUND'
        });
      }
      
      if (error.message?.includes('Referenced record does not exist')) {
        return res.status(400).json({ 
          message: error.message,
          error: 'INVALID_REFERENCE'
        });
      }
      
      // Generic error for other cases
      res.status(500).json({ 
        message: "Failed to update user",
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Admin route to update user credentials and force session invalidation
  app.put('/api/admin/users/:id/credentials', isAdminAuthenticated, async (req, res) => {
    try {
      const userId = req.params.id;
      const credentialData = req.body;
      
      // Update user credentials
      const updatedUser = await storage.updateUserAdmin(userId, credentialData);
      
      // Always invalidate sessions when credentials are explicitly updated
      try {
        await storage.invalidateUserSessions(userId);
        console.log(`Sessions invalidated for user ${userId} due to explicit credential update`);
      } catch (sessionError) {
        console.error(`Failed to invalidate sessions for user ${userId}:`, sessionError);
        // Don't fail the user update if session invalidation fails
      }
      
      res.json({
        ...updatedUser,
        message: "User credentials updated and all sessions invalidated"
      });
    } catch (error: any) {
      console.error("Error updating user credentials:", error);
      
      // Handle specific error types
      if (error.message?.includes('already exists')) {
        return res.status(409).json({ 
          message: error.message,
          error: 'CONFLICT',
          details: 'The provided value conflicts with an existing record'
        });
      }
      
      if (error.message?.includes('not found')) {
        return res.status(404).json({ 
          message: error.message,
          error: 'NOT_FOUND'
        });
      }
      
      res.status(500).json({ 
        message: "Failed to update user credentials",
        error: 'INTERNAL_ERROR'
      });
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
      const { assignmentType, selectedUserId } = shopData;
      
      let targetUserId;
      
      if (assignmentType === 'existing' && selectedUserId) {
        // Assign to existing user
        targetUserId = selectedUserId;
        
        // Verify user exists and is not already a seller
        const existingUser = await storage.getUser(selectedUserId);
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }
        if (existingUser.isSeller) {
          return res.status(400).json({ message: "User is already a seller" });
        }
      } else {
        // Create new user (current behavior)
        const newUser = await storage.createUserWithPhone({
          firstName: shopData.firstName || '',
          lastName: shopData.lastName || '',
          phoneNumber: shopData.phoneNumber || '',
        });
        targetUserId = newUser.id;
      }
      
      // Update user with shop details and mark as seller
      const updatedUser = await storage.updateUserAdmin(targetUserId, {
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
  app.post('/api/admin/impersonate/:userId', isAdminAuthenticatedSession, async (req: any, res) => {
    try {
      console.log("=== IMPERSONATION REQUEST ===");
      console.log("Target userId:", req.params.userId);
      console.log("Admin userId:", req.admin?.userId);
      console.log("Session:", req.session);
      
      const targetUserId = req.params.userId;
      const targetUser = await storage.getUser(targetUserId);
      
      if (!targetUser) {
        console.log("Target user not found:", targetUserId);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log("Target user found:", targetUser.firstName, targetUser.lastName);
      
      // Generate a temporary impersonation token
      const impersonationToken = crypto.randomBytes(32).toString('hex');
      console.log("Generated token:", impersonationToken.substring(0, 8) + "...");
      
      // Store impersonation data with token (expires in 1 hour)
      req.session.impersonationTokens = req.session.impersonationTokens || {};
      req.session.impersonationTokens[impersonationToken] = {
        adminUserId: req.admin.userId,
        impersonatedUserId: targetUserId,
        createdAt: Date.now(),
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
      };
      
      console.log("Token stored in session");
      
      res.json({ 
        message: "Impersonation token generated", 
        impersonatedUser: targetUser,
        impersonationToken: impersonationToken
      });
    } catch (error: any) {
      console.error("Error starting impersonation:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ message: "Failed to start impersonation", error: error.message });
    }
  });

  // Impersonation login endpoint
  app.post('/api/impersonation-login', async (req: any, res) => {
    try {
      const { token } = req.body;
      
      if (!token || !req.session.impersonationTokens || !req.session.impersonationTokens[token]) {
        return res.status(400).json({ message: "Invalid impersonation token" });
      }
      
      const impersonationData = req.session.impersonationTokens[token];
      
      // Check if token is expired
      if (Date.now() > impersonationData.expiresAt) {
        delete req.session.impersonationTokens[token];
        return res.status(400).json({ message: "Impersonation token expired" });
      }
      
      // Get the target user
      const targetUser = await storage.getUser(impersonationData.impersonatedUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }
      
      // Create a new session for the impersonated user
      req.session.user = {
        id: targetUser.id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        phoneNumber: targetUser.phoneNumber,
        email: targetUser.email,
        isSeller: targetUser.isSeller,
        storeId: targetUser.storeId
      };
      
      // Set impersonation flag
      req.session.adminImpersonation = {
        adminUserId: impersonationData.adminUserId,
        impersonatedUserId: targetUser.id,
        token: token
      };
      
      // Clean up the token
      delete req.session.impersonationTokens[token];
      
      res.json({ 
        message: "Impersonation login successful", 
        user: targetUser 
      });
    } catch (error) {
      console.error("Error in impersonation login:", error);
      res.status(500).json({ message: "Failed to login with impersonation" });
    }
  });

  app.post('/api/admin/stop-impersonation', isAdminAuthenticatedSession, async (req: any, res) => {
    try {
      delete req.session.adminImpersonation;
      res.json({ message: "Impersonation stopped" });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // Category routes - Ultra-fast with sub-5ms response
  app.get('/api/categories', async (req, res) => {
    const startTime = performance.now();
    
    try {
      const categories = await ultraFastStorage.getCategories();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 5 ? 'HIT' : 'MISS');
      
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
      
      // Invalidate categories cache
      apiCache.delete('categories');
      
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // Product routes - Ultra-fast with sub-5ms response
  app.get('/api/products', async (req, res) => {
    const startTime = performance.now();
    
    try {
      const products = await ultraFastStorage.getProducts();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 5 ? 'HIT' : 'MISS');
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    const startTime = performance.now();
    
    try {
      const productId = parseInt(req.params.id);
      const product = await ultraFastStorage.getProduct(productId);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 5 ? 'HIT' : 'MISS');
      
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
    const startTime = performance.now();
    try {
      const sellerId = req.user.claims.sub;
      const products = await ultraFastStorage.getProductsBySeller(sellerId);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 100 ? 'FAST' : 'SLOW');
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Debug endpoint to check all users and their shop status
  app.get('/api/debug/users', async (req, res) => {
    const startTime = performance.now();
    try {
      const allUsers = await ultraFastStorage.getAllUsers();
      const debugInfo = allUsers.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        isSeller: user.isSeller,
        storeId: user.storeId,
        displayName: user.displayName,
        legalName: user.legalName,
        shopType: user.shopType,
        status: user.status
      }));
      
      console.log("=== DEBUG: All Users ===");
      console.log(JSON.stringify(debugInfo, null, 2));
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 5 ? 'HIT' : 'MISS');
      res.json(debugInfo);
    } catch (error) {
      console.error("Error fetching debug users:", error);
      res.status(500).json({ message: "Failed to fetch debug users" });
    }
  });

  // Debug endpoint to check current user authentication status
  app.get('/api/debug/auth', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const sessionUser = (req.session as any).user;
      const adminImpersonation = (req.session as any).adminImpersonation;
      
      const debugInfo = {
        sessionUser,
        requestUser: user,
        adminImpersonation,
        isSeller: user?.isSeller,
        userId: user?.id
      };
      
      console.log("=== DEBUG: Auth Status ===");
      console.log(JSON.stringify(debugInfo, null, 2));
      
      res.json(debugInfo);
    } catch (error) {
      console.error("Error fetching auth debug:", error);
      res.status(500).json({ message: "Failed to fetch auth debug" });
    }
  });

  // Temporary fix endpoint to make current user a seller
  app.post('/api/debug/make-seller', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("Making user a seller:", userId);
      
      // Update user to be a seller
      const updatedUser = await storage.updateUserAdmin(userId, {
        isSeller: true,
        storeId: req.user.displayName || req.user.legalName || `${req.user.firstName} ${req.user.lastName}`.trim()
      });
      
      console.log("User updated to seller:", updatedUser);
      
      res.json({ 
        message: "User updated to seller", 
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error making user a seller:", error);
      res.status(500).json({ message: "Failed to make user a seller" });
    }
  });

  // Debug endpoint to test seller authentication specifically
  app.get('/api/debug/test-seller-auth', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("=== Testing seller auth for user:", userId);
      
      // Get fresh user data from database
      const freshUser = await storage.getUser(userId);
      console.log("Fresh user data from DB:", freshUser);
      
      // Check if user is seller
      const isSeller = freshUser?.isSeller;
      console.log("isSeller value:", isSeller, "type:", typeof isSeller);
      
      const result = {
        userId,
        requestUser: req.user,
        freshUserFromDB: freshUser,
        isSeller: isSeller,
        isSellerType: typeof isSeller,
        isSellerStrict: isSeller === true,
        isSellerTruthy: !!isSeller,
        canAccessSellerEndpoints: !!isSeller
      };
      
      console.log("Seller auth test result:", result);
      
      res.json(result);
    } catch (error) {
      console.error("Error testing seller auth:", error);
      res.status(500).json({ message: "Failed to test seller auth" });
    }
  });

  // Debug endpoint to test specific user ID
  app.get('/api/debug/test-user/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      console.log("=== Testing specific user ID:", userId);
      
      // Get fresh user data from database
      const freshUser = await storage.getUser(userId);
      console.log("Fresh user data from DB:", freshUser);
      
      if (!freshUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user is seller
      const isSeller = freshUser.isSeller;
      console.log("isSeller value:", isSeller, "type:", typeof isSeller);
      
      const result = {
        userId,
        freshUserFromDB: freshUser,
        isSeller: isSeller,
        isSellerType: typeof isSeller,
        isSellerStrict: isSeller === true,
        isSellerTruthy: !!isSeller,
        canAccessSellerEndpoints: !!isSeller
      };
      
      console.log("Specific user test result:", result);
      
      res.json(result);
    } catch (error) {
      console.error("Error testing specific user:", error);
      res.status(500).json({ message: "Failed to test specific user" });
    }
  });

  // Debug endpoint to refresh user session
  app.post('/api/debug/refresh-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("=== Refreshing session for user:", userId);
      
      // Get fresh user data from database
      const freshUser = await storage.getUser(userId);
      console.log("Fresh user data from DB:", freshUser);
      
      if (!freshUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the session with fresh data
      (req.session as any).user = {
        ...(req.session as any).user,
        isSeller: freshUser.isSeller,
        displayName: freshUser.displayName,
        legalName: freshUser.legalName,
        storeId: freshUser.storeId
      };
      
      // Update the request user object
      (req as any).user = {
        ...(req as any).user,
        isSeller: freshUser.isSeller,
        displayName: freshUser.displayName,
        legalName: freshUser.legalName,
        storeId: freshUser.storeId
      };
      
      const result = {
        message: "Session refreshed",
        userId,
        freshUserFromDB: freshUser,
        updatedSessionUser: (req.session as any).user,
        updatedRequestUser: (req as any).user
      };
      
      console.log("Session refresh result:", result);
      
      res.json(result);
    } catch (error) {
      console.error("Error refreshing session:", error);
      res.status(500).json({ message: "Failed to refresh session" });
    }
  });

  // Temporary bypass endpoint to test shops without seller authentication
  app.get('/api/debug/shops-bypass', isAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      console.log("=== DEBUG: Shops bypass called ===");
      console.log("Seller ID:", sellerId);
      console.log("User object:", req.user);
      
      // Get all shops regardless of seller status
      const shops = await storage.getSellerShops();
      console.log("All shops found:", shops.length);
      
      res.json({
        message: "Shops retrieved with bypass",
        sellerId,
        user: req.user,
        shops: shops
      });
    } catch (error) {
      console.error("Error in shops bypass:", error);
      res.status(500).json({ message: "Failed to fetch shops with bypass" });
    }
  });

  // Get current seller's shops only (or all shops if admin is impersonating)
  app.get('/api/seller/shops', isSellerAuthenticated, async (req: any, res) => {
    const startTime = performance.now();
    try {
      const sellerId = req.user.claims.sub;
      
      // Check if admin is impersonating this user
      const sessionUser = (req.session as any).user;
      const isAdminImpersonating = (req.session as any).adminImpersonation && 
        (req.session as any).adminImpersonation.adminUserId === 'viswa968' &&
        sessionUser.id === 'f3d84bd2-d98c-4a34-917d-c8e03a598b43';
      
      let shops;
      if (isAdminImpersonating) {
        // If admin is impersonating, return all shops
        shops = await storage.getSellerShops();
      } else {
        // Otherwise, return only the seller's own shops
        shops = await ultraFastStorage.getSellerShopsBySeller(sellerId);
      }
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 100 ? 'FAST' : 'SLOW');
      
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
      
      // Validate minimum order value of $50
      const totalPrice = parseFloat(req.body.totalPrice || req.body.finalPrice || "0");
      if (totalPrice < 50) {
        return res.status(400).json({ 
          message: "Minimum order value is $50.00. Your current order total is $" + totalPrice.toFixed(2) + "." 
        });
      }
      
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
      const { productId, quantity = 1, deliveryMethod = "delivery" } = req.body;
      
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
      
      // Validate minimum order value of $50
      if (totalPrice < 50) {
        return res.status(400).json({ 
          message: "Minimum order value is $50.00. Your current order total is $" + totalPrice.toFixed(2) + "." 
        });
      }
      
      // Calculate expected delivery date based on order time
      const deliveryInfo = calculateExpectedDeliveryDate();
      
      const orderData = insertOrderSchema.parse({
        userId,
        productId,
        quantity,
        unitPrice: product.originalPrice,
        totalPrice: totalPrice.toString(),
        finalPrice: totalPrice.toString(),
        status: "pending", // Orders start as pending and need seller approval
        type: "individual",
        deliveryMethod: deliveryMethod,
        expectedDeliveryDate: deliveryInfo.expectedDeliveryDate
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
      const { totalPrice, finalPrice, status, type, addressId, items, payerId, beneficiaryId, userGroupId, deliveryMethod } = req.body;
      
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
      
      // Validate minimum order value of $50
      if (!totalPrice || parseFloat(totalPrice) < 50) {
        return res.status(400).json({ 
          message: "Minimum order value is $50.00. Your current order total is $" + (totalPrice ? parseFloat(totalPrice).toFixed(2) : "0.00") + "." 
        });
      }
      
      // Get address details if addressId is provided
      let shippingAddress = "International Shipping Address";
      let buyerAddress = null;
      if (addressId) {
        const addresses = await storage.getUserAddresses(userId);
        const address = addresses.find(addr => addr.id === addressId);
        if (address) {
          shippingAddress = `${address.fullName}, ${address.addressLine}, ${address.city}, ${address.state || ''} ${address.pincode}, ${address.country || 'US'}`;
          buyerAddress = {
            addressLine: address.addressLine,
            city: address.city,
            state: address.state || undefined,
            country: address.country || 'US',
            pincode: address.pincode
          };
        }
      }
      
      // Calculate delivery charges if address is provided
      let totalDeliveryCharge = 0;
      let deliverySummary = null;
      if (buyerAddress && items && items.length > 0) {
        try {
          deliverySummary = await deliveryService.getDeliverySummary(buyerAddress);
          totalDeliveryCharge = deliverySummary.totalDeliveryCharge;
          console.log(`Delivery charges calculated: $${totalDeliveryCharge}`);
        } catch (error) {
          console.error("Error calculating delivery charges:", error);
          // Continue with order creation even if delivery calculation fails
        }
      }
      
      // Use beneficiaryId as userId (who receives the order) and payerId as payerId (who made the payment)
      const finalUserId = beneficiaryId || userId; // Who receives the order
      const finalPayerId = payerId || userId; // Who made the payment
      
      // Calculate final price including delivery charges
      const finalPriceWithDelivery = (finalPrice || totalPrice) + totalDeliveryCharge;
      
      // Calculate expected delivery date based on order time
      const deliveryInfo = calculateExpectedDeliveryDate();
      
      const orderData = {
        userId: finalUserId,
        payerId: finalPayerId,
        addressId: addressId || null,
        totalPrice,
        finalPrice: finalPriceWithDelivery,
        shippingAddress,
        status: status || "pending",
        type: type || "group",
        deliveryMethod: deliveryMethod || "delivery",
        expectedDeliveryDate: deliveryInfo.expectedDeliveryDate
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
      
      // Return order with delivery information
      const orderResponse = {
        ...order,
        deliveryCharges: {
          totalDeliveryCharge,
          deliverySummary,
          hasDeliveryCharges: totalDeliveryCharge > 0
        }
      };
      
      res.status(201).json(orderResponse);
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
      console.log("Order details:", orders.map(o => ({ id: o.id, type: o.type, userId: o.userId, payerId: o.payerId, createdAt: o.createdAt })));
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

      // Check if order belongs to user or if user is the payer
      // For group payments, both the beneficiary (order.userId) and payer (order.payerId) should have access
      if (order.userId !== userId && order.payerId !== userId) {
        console.log("Access denied for user:", userId, "order belongs to:", order.userId, "payer:", order.payerId);
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
      
      // Calculate expected delivery date based on order time
      const deliveryInfo = calculateExpectedDeliveryDate();
      
      const orderData = {
        ...req.body,
        userId,
        expectedDeliveryDate: deliveryInfo.expectedDeliveryDate
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
      
      // Get existing cart items to check for category mixing and shop conflicts
      const existingCart = await storage.getUserCart(userId);
      if (existingCart.length > 0) {
        // Check if any existing cart item has a different category
        const hasGroceries = existingCart.some(item => item.product.categoryId === 1);
        const hasServices = existingCart.some(item => item.product.categoryId === 2);
        const hasPetEssentials = existingCart.some(item => item.product.categoryId === 3);
        
        // Check if trying to mix categories
        if ((hasGroceries && (product.categoryId === 2 || product.categoryId === 3)) || 
            (hasServices && (product.categoryId === 1 || product.categoryId === 3)) ||
            (hasPetEssentials && (product.categoryId === 1 || product.categoryId === 2))) {
          const currentCategory = hasGroceries ? "Groceries" : hasServices ? "Services" : "Pet Essentials";
          const newCategory = product.categoryId === 1 ? "Groceries" : product.categoryId === 2 ? "Services" : "Pet Essentials";
          return res.status(400).json({ 
            message: "Cannot mix categories",
            error: `You have ${currentCategory.toLowerCase()} in your cart. Please clear your cart before adding ${newCategory.toLowerCase()} products.`,
            categoryConflict: true,
            currentCategory: currentCategory,
            newCategory: newCategory
          });
        }

        // Check if trying to add from a different shop (same category but different seller)
        const existingShopSeller = existingCart[0].product.seller;
        const newShopSeller = product.seller;
        
        if (existingShopSeller.id !== newShopSeller.id) {
          const existingShopName = existingShopSeller.displayName || `${existingShopSeller.firstName} ${existingShopSeller.lastName}`;
          const newShopName = newShopSeller.displayName || `${newShopSeller.firstName} ${newShopSeller.lastName}`;
          
          return res.status(400).json({ 
            message: "Different shop conflict",
            error: `You have products from "${existingShopName}" in your cart. Please clear your cart before adding products from "${newShopName}".`,
            shopConflict: true,
            existingShop: existingShopName,
            newShop: newShopName
          });
        }

        // Check if trying to add the same item from a different shop (additional validation)
        const sameItemFromDifferentShop = existingCart.find(item => 
          item.product.name.toLowerCase() === product.name.toLowerCase() && 
          item.product.sellerId !== product.sellerId
        );
        
        if (sameItemFromDifferentShop) {
          const existingSeller = sameItemFromDifferentShop.product.seller;
          const newSeller = product.seller;
          const existingShopName = existingSeller.displayName || `${existingSeller.firstName} ${existingSeller.lastName}`;
          const newShopName = newSeller.displayName || `${newSeller.firstName} ${newSeller.lastName}`;
          
          return res.status(400).json({ 
            message: "Same item from different shop",
            error: `You already have "${product.name}" from "${existingShopName}". Please clear your cart before adding the same item from "${newShopName}".`,
            sameItemConflict: true,
            existingSeller: existingShopName,
            newSeller: newShopName
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

  app.get('/api/user-groups/joined', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const joinedGroups = await storage.getUserJoinedGroups(userId);
      res.json(joinedGroups);
    } catch (error) {
      console.error("Error fetching joined groups:", error);
      res.status(500).json({ message: "Failed to fetch joined groups" });
    }
  });

  // Get all public collections for browsing
  app.get('/api/collections', async (req, res) => {
    const startTime = performance.now();
    try {
      const collections = await ultraFastStorage.getAllPublicCollections();
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 5 ? 'HIT' : 'MISS');
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
      
      // Parse the updates to check what fields are being updated
      const updates = insertUserGroupSchema.partial().parse(req.body);
      
      // If group is locked, only allow delivery method updates
      if (isLocked) {
        const allowedFields = ['deliveryMethod'];
        const updateFields = Object.keys(updates);
        const hasDisallowedFields = updateFields.some(field => !allowedFields.includes(field));
        
        if (hasDisallowedFields) {
          return res.status(400).json({ 
            message: "Cannot edit group - group is locked because it has reached maximum member capacity. Only delivery method can be changed.",
            locked: true
          });
        }
      }

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

      // Create grocery product record if this is pet essentials (category 3) - treat as products, not services
      if (productData.categoryId === 3 && groceryProduct) {
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
          grossWeightG: groceryProduct.grossWeightG ? parseFloat(groceryProduct.grossWeightG) : null,
          listPriceCents: groceryProduct.listPriceCents ? parseInt(groceryProduct.listPriceCents) : null,
          salePriceCents: groceryProduct.salePriceCents ? parseInt(groceryProduct.salePriceCents) : null,
          effectiveFrom: groceryProduct.effectiveFrom ? new Date(groceryProduct.effectiveFrom) : null,
          effectiveTo: groceryProduct.effectiveTo ? new Date(groceryProduct.effectiveTo) : null,
          taxClass: groceryProduct.taxClass,
          inventoryOnHand: groceryProduct.inventoryOnHand ? parseInt(groceryProduct.inventoryOnHand) : null,
          inventoryReserved: groceryProduct.inventoryReserved ? parseInt(groceryProduct.inventoryReserved) : null,
          inventoryStatus: groceryProduct.inventoryStatus || 'in_stock',
        };
        
        // Validate grocery product data
        const validatedGroceryProductData = insertGroceryProductSchema.parse(groceryProductData);
        await storage.createGroceryProduct(validatedGroceryProductData);
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
      
      // Invalidate all product-related caches so new products are immediately visible
      console.log('🔄 Invalidating caches after product creation...');
      
      // Clear API cache
      apiCache.delete('products');
      apiCache.delete('categories');
      apiCache.delete('browse');
      
      // Clear ultra-fast cache
      ultraFastStorage.clearCache();
      
      // Clear group pricing cache
      groupPricingCache.clear();
      
      console.log('✅ Caches invalidated - new product should be immediately visible');
      
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
      }

      // Update or create pet provider record if this is pet essentials (category 3)
      if (productData.categoryId === 3 && serviceProvider) {
        // Parse date fields and JSON fields
        const petProviderData = {
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
        
        // Validate pet provider data
        const validatedPetProviderData = insertPetProviderSchema.parse(petProviderData);
        
        // Check if pet provider already exists
        const existingPetProvider = await storage.getPetProviderByProductId(productId);
        if (existingPetProvider) {
          await storage.updatePetProvider(existingPetProvider.id, validatedPetProviderData);
          
          // Update staff members
          // First, remove existing staff
          await storage.deletePetProviderStaff(existingPetProvider.id);
          
          // Then add new staff if provided
          if (serviceProvider.staff && Array.isArray(serviceProvider.staff) && serviceProvider.staff.length > 0) {
            for (const staffMember of serviceProvider.staff) {
              if (staffMember.name) {
                await storage.createPetProviderStaff({
                  petProviderId: existingPetProvider.id,
                  name: staffMember.name,
                  skills: staffMember.skills ? staffMember.skills.split(',').map((s: string) => s.trim()) : [],
                  availability: staffMember.availability || null,
                  rating: staffMember.rating ? staffMember.rating.toString() : null,
                });
              }
            }
          }
        } else {
          const createdPetProvider = await storage.createPetProvider(validatedPetProviderData);
          
          // Handle staff members if provided
          if (serviceProvider.staff && Array.isArray(serviceProvider.staff) && serviceProvider.staff.length > 0) {
            for (const staffMember of serviceProvider.staff) {
              if (staffMember.name) {
                await storage.createPetProviderStaff({
                  petProviderId: createdPetProvider.id!,
                  name: staffMember.name,
                  skills: staffMember.skills ? staffMember.skills.split(',').map((s: string) => s.trim()) : [],
                  availability: staffMember.availability || null,
                  rating: staffMember.rating ? staffMember.rating.toString() : null,
                });
              }
            }
          }
        }
      } else if (productData.categoryId !== 2 && productData.categoryId !== 3) {
        // If changing from service to non-service category, remove service provider data
        await storage.deleteServiceProviderByProductId(productId);
        await storage.deletePetProviderByProductId(productId);
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
      
      // Invalidate caches after product update
      console.log('🔄 Invalidating caches after product update...');
      apiCache.delete('products');
      apiCache.delete('categories');
      apiCache.delete('browse');
      ultraFastStorage.clearCache();
      groupPricingCache.clear();
      console.log('✅ Caches invalidated - updated product should be immediately visible');
      
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
    const startTime = performance.now();
    try {
      const sellerId = req.user.claims.sub;
      const metrics = await storage.getSellerMetrics(sellerId);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Cache-Status', responseTime < 200 ? 'FAST' : 'SLOW');
      
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

  // Excel Import/Export routes for sellers
  app.get('/api/seller/excel/template', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      
      // Generate Excel template
      const buffer = await ExcelService.generateTemplate(sellerId);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.xlsx"');
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      console.error("Error generating Excel template:", error);
      res.status(500).json({ message: "Failed to generate Excel template" });
    }
  });

  app.post('/api/seller/excel/validate', isSellerAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const sellerId = req.user.claims.sub;
      const { shopId } = req.body;

      if (!shopId) {
        return res.status(400).json({ message: "Shop ID is required" });
      }

      // Validate that the shop belongs to the seller
      const shops = await storage.getSellerShopsBySeller(sellerId);
      const shop = shops.find(s => s.id === shopId);
      if (!shop) {
        return res.status(403).json({ message: "Shop not found or access denied" });
      }

      // Parse and validate Excel data
      const result = await ExcelService.parseExcelData(req.file, sellerId, shopId);
      
      res.json(result);
    } catch (error) {
      console.error("Error validating Excel file:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to validate Excel file" 
      });
    }
  });

  app.post('/api/seller/excel/import', isSellerAuthenticated, async (req: any, res) => {
    try {
      console.log('🚀 Excel import endpoint called');
      const sellerId = req.user.claims.sub;
      const { validatedData, shopId } = req.body;

      console.log('Request data:', { sellerId, shopId, validatedDataSuccess: validatedData?.success, productsCount: validatedData?.products?.length });

      if (!validatedData || !shopId) {
        return res.status(400).json({ message: "Validated data and shop ID are required" });
      }

      // Validate that the shop belongs to the seller
      const shops = await storage.getSellerShopsBySeller(sellerId);
      const shop = shops.find(s => s.id === shopId);
      if (!shop) {
        return res.status(403).json({ message: "Shop not found or access denied" });
      }

      console.log('Shop found:', shop.displayName, 'Type:', shop.shopType);

      // Import products
      console.log('Calling ExcelService.importProducts...');
      const result = await ExcelService.importProducts(validatedData, sellerId, shopId);
      console.log('Import result:', result);
      
      // Invalidate caches after import
      apiCache.delete('products');
      apiCache.delete('categories');
      ultraFastStorage.clearCache();
      groupPricingCache.clear();
      
      res.json(result);
    } catch (error) {
      console.error("Error importing products:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to import products" 
      });
    }
  });

  app.get('/api/seller/excel/export', isSellerAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const { shopId } = req.query;

      if (!shopId) {
        return res.status(400).json({ message: "Shop ID is required" });
      }

      // Validate that the shop belongs to the seller
      const shops = await storage.getSellerShopsBySeller(sellerId);
      const shop = shops.find(s => s.id === shopId);
      if (!shop) {
        return res.status(403).json({ message: "Shop not found or access denied" });
      }

      // Get products for the shop
      const products = await storage.getProductsBySeller(sellerId);
      const shopProducts = products.filter(p => p.sellerId === sellerId);

      if (shopProducts.length === 0) {
        return res.status(404).json({ message: "No products found for export" });
      }

      // Generate Excel export
      const buffer = await ExcelService.generateExport(shopProducts, shop);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="products-export-${shop.displayName || shop.legalName}-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      console.error("Error exporting products:", error);
      res.status(500).json({ message: "Failed to export products" });
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

  // Test endpoint to check Google API key status (for debugging)
  app.get('/api/test/google-api-status', async (req: any, res) => {
    try {
      const apiKey = process.env.GOOGLE_DISTANCE_MATRIX_API_KEY;
      const status = {
        apiKeyConfigured: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        message: apiKey ? 'Google Distance Matrix API key is configured' : 'Google Distance Matrix API key is not configured'
      };
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: 'Error checking API key status', error: error.message });
    }
  });

  // Test endpoint to test Google Distance Matrix API (for debugging)
  app.post('/api/test/google-distance', async (req: any, res) => {
    try {
      const { origin, destination } = req.body;
      
      if (!origin || !destination) {
        return res.status(400).json({ message: 'Origin and destination are required' });
      }

      const apiKey = process.env.GOOGLE_DISTANCE_MATRIX_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'Google Distance Matrix API key not configured' });
      }

      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.append('origins', origin);
      url.searchParams.append('destinations', destination);
      url.searchParams.append('units', 'metric');
      url.searchParams.append('mode', 'driving');
      url.searchParams.append('key', apiKey);

      console.log('Testing Google Distance Matrix API...');
      console.log('Origin:', origin);
      console.log('Destination:', destination);

      const response = await fetch(url.toString());
      const data = await response.json();

      console.log('Google API Response Status:', data.status);

      res.json({
        status: data.status,
        origin: origin,
        destination: destination,
        response: data,
        success: data.status === 'OK'
      });
    } catch (error) {
      console.error('Error testing Google Distance Matrix API:', error);
      res.status(500).json({ message: 'Error testing Google API', error: error.message });
    }
  });

  // Test endpoint to create a test notification
  app.post('/api/notifications/test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`🧪 Creating test notification for user: ${userId}`);
      
      // Create a test notification
      await notificationService.createTestNotification(
        userId, 
        "This is a test notification to verify the real-time system is working."
      );
      
      res.json({ message: 'Test notification created successfully' });
    } catch (error) {
      console.error("❌ Error creating test notification:", error);
      res.status(500).json({ message: "Failed to create test notification" });
    }
  });

  // WebSocket connection status endpoint
  app.get('/api/notifications/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isConnected = websocketNotificationBroadcaster.isUserConnected(userId);
      const clientCount = websocketNotificationBroadcaster.getClientCount(userId);
      
      res.json({
        connected: isConnected,
        clientCount: clientCount,
        userId: userId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("❌ Error getting notification status:", error);
      res.status(500).json({ message: "Failed to get notification status" });
    }
  });

  // Delivery calculation endpoints
  app.post('/api/delivery/calculate', isAuthenticated, async (req: any, res) => {
    try {
      const { sellerId, buyerAddress, orderTotal = 0 } = req.body;
      
      if (!sellerId || !buyerAddress) {
        return res.status(400).json({ 
          message: "Missing required fields: sellerId and buyerAddress" 
        });
      }

      const deliveryCalculation = await deliveryService.calculateDeliveryCharges(
        sellerId, 
        buyerAddress,
        orderTotal
      );

      res.json(deliveryCalculation);
    } catch (error) {
      console.error("Error calculating delivery charges:", error);
      res.status(500).json({ 
        message: "Failed to calculate delivery charges",
        error: error.message 
      });
    }
  });

  // Public delivery calculation endpoint (for address changes and order total updates)
  app.post('/api/delivery/calculate-public', async (req, res) => {
    try {
      const { address, orderTotal = 0, orderType = 'individual' } = req.body;
      
      if (!address) {
        return res.status(400).json({ 
          message: "Missing required field: address" 
        });
      }

      // Parse address if it's a string
      let addressObj;
      if (typeof address === 'string') {
        const parts = address.split(',').map(part => part.trim());
        if (parts.length >= 3) {
          addressObj = {
            addressLine: parts[0],
            city: parts[1],
            state: parts[2].split(' ')[0],
            pincode: parts[2].split(' ').slice(1).join(' '),
            country: 'Canada'
          };
        } else {
          return res.status(400).json({ 
            message: "Invalid address format. Please provide full address with city, province, and postal code." 
          });
        }
      } else {
        addressObj = address;
      }

      const { DeliveryService } = await import('./deliveryService');
      const deliveryService = new DeliveryService();
      
      // Create a mock order for delivery calculation
      const mockOrder = {
        items: [{
          sellerId: 'default-seller',
          quantity: 1,
          price: orderTotal
        }]
      };
      
      const deliveryResult = await deliveryService.calculateDeliveryCharges(
        addressObj,
        orderTotal,
        orderType
      );
      
      // Extract delivery info from the result
      const minimumOrderValue = 50.00; // $50 minimum for all orders
      
      res.json({
        distance: Math.round(deliveryResult.distance * 10) / 10,
        estimatedTime: Math.round(deliveryResult.duration || 0),
        deliveryFee: deliveryResult.deliveryCharge,
        isFreeDelivery: deliveryResult.isFreeDelivery,
        reason: deliveryResult.reason,
        minimumOrderValue,
        deliveryRatePerKm: 5.99,
        freeDeliveryDistance: 10,
        orderTotal,
        meetsMinimumOrder: deliveryResult.meetsMinimumOrder ?? (orderTotal >= minimumOrderValue),
        orderType,
        canDeliver: true // If we got here, the address is valid
      });
    } catch (error) {
      console.error("Error calculating delivery charges:", error);
      res.status(500).json({ 
        message: "Failed to calculate delivery charges",
        error: error.message 
      });
    }
  });

  // Calculate delivery charges for group orders (multiple sellers)
  app.post('/api/delivery/calculate-group', isAuthenticated, async (req: any, res) => {
    try {
      const { sellerIds, buyerAddress, orderTotal = 0 } = req.body;
      
      if (!sellerIds || !Array.isArray(sellerIds) || !buyerAddress) {
        return res.status(400).json({ 
          message: "Missing required fields: sellerIds (array) and buyerAddress" 
        });
      }

      const deliverySummary = await deliveryService.getDeliverySummary(
        sellerIds, 
        buyerAddress,
        orderTotal
      );

      res.json(deliverySummary);
    } catch (error) {
      console.error("Error calculating group delivery charges:", error);
      res.status(500).json({ 
        message: "Failed to calculate group delivery charges",
        error: error.message 
      });
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

      // Handle completion notifications based on delivery method
      if (status === "completed") {
        if (updatedOrder.deliveryMethod === "pickup") {
          // For pickup orders, notify all group members
          await notificationService.notifyPickupOrderCompleted(orderId);
        } else if (updatedOrder.deliveryMethod === "delivery") {
          // For delivery orders, notify only the member and group owner
          await notificationService.notifyDeliveryOrderCompleted(orderId);
        }
      }

      
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Stripe payment routes
  // Multi-item individual payment intent creation (for cart checkout)
  app.post("/api/create-multi-item-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { addressId } = req.body;
      const userId = req.user.claims.sub;

      if (!addressId) {
        return res.status(400).json({ message: "Address ID is required for individual payments" });
      }

      // Get user's cart items
      const cartItems = await storage.getUserCart(userId);
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      // Get user address
      const addresses = await storage.getUserAddresses(userId);
      const address = addresses.find(addr => addr.id === addressId);
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }

      const buyerAddress = {
        addressLine: address.addressLine,
        city: address.city,
        state: address.state || undefined,
        country: address.country || 'US',
        pincode: address.pincode
      };

      // Calculate total product price first
      const productPrice = cartItems.reduce((total, item) => {
        return total + (parseFloat(item.product.originalPrice) * item.quantity);
      }, 0);

      // Get seller ID from cart items (assuming all items are from the same seller due to cart validation)
      const sellerId = cartItems.length > 0 ? cartItems[0].product.sellerId : undefined;

      // Check shop minimum order value BEFORE calculating delivery
      const shopValidation = await deliveryService.checkShopMinimumOrderValue(productPrice, sellerId);
      if (!shopValidation.isValid) {
        return res.status(400).json({ 
          message: shopValidation.message,
          minimumRequired: shopValidation.minimumRequired,
          currentTotal: productPrice,
          type: 'minimum_order_value'
        });
      }

      // Calculate delivery charges for the entire cart with shop-specific settings
      const deliveryCalculation = await deliveryService.calculateDeliveryCharges(buyerAddress, productPrice, 'individual', sellerId);
      const deliveryFee = deliveryCalculation.deliveryCharge;

      const totalAmount = productPrice + deliveryFee;

      // Create Stripe customer
      const customer = await stripe.customers.create({
        name: address.fullName,
        address: {
          line1: address.addressLine,
          city: address.city,
          state: address.state || 'CA',
          postal_code: address.pincode,
          country: address.country || 'US'
        }
      });

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: "usd",
        customer: customer.id,
        description: `Multi-item purchase (${cartItems.length} items)${deliveryFee > 0 ? ` (includes $${deliveryFee.toFixed(2)} delivery fee)` : ''}`,
        shipping: {
          name: address.fullName,
          address: {
            line1: address.addressLine,
            city: address.city,
            state: address.state || 'CA',
            postal_code: address.pincode,
            country: address.country || 'US'
          }
        },
        metadata: {
          userId: userId,
          type: "multi_item_individual",
          addressId: addressId.toString(),
          deliveryFee: deliveryFee.toString(),
          originalAmount: productPrice.toString(),
          itemCount: cartItems.length.toString(),
          cartItemIds: cartItems.map(item => item.id).join(',')
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        deliveryFee,
        productPrice,
        totalAmount,
        deliveryInfo: deliveryCalculation,
        cartItems: cartItems.map(item => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          product: {
            id: item.product.id,
            name: item.product.name,
            originalPrice: item.product.originalPrice,
            imageUrl: item.product.imageUrl
          }
        }))
      });
    } catch (error: any) {
      console.error("Error creating multi-item payment intent:", error);
      res.status(500).json({ message: "Error creating multi-item payment intent: " + error.message });
    }
  });

  // Individual payment intent endpoint with address and delivery fee support
  app.post("/api/create-individual-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { productId, addressId, quantity = 1 } = req.body;
      const userId = req.user.claims.sub;
      
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      if (!addressId) {
        return res.status(400).json({ message: "Address ID is required for individual payments" });
      }

      // Get product details
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Get user address
      const addresses = await storage.getUserAddresses(userId);
      const address = addresses.find(addr => addr.id === addressId);
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }

      // Calculate delivery fee
      const buyerAddress = {
        addressLine: address.addressLine,
        city: address.city,
        state: address.state || undefined,
        country: address.country || 'US',
        pincode: address.pincode
      };

      // Calculate total amount (product price + delivery fee)
      const productPrice = parseFloat(product.originalPrice) * quantity;

      // Check shop minimum order value BEFORE calculating delivery
      const shopValidation = await deliveryService.checkShopMinimumOrderValue(productPrice, product.sellerId);
      if (!shopValidation.isValid) {
        return res.status(400).json({ 
          message: shopValidation.message,
          minimumRequired: shopValidation.minimumRequired,
          currentTotal: productPrice,
          type: 'minimum_order_value'
        });
      }

      const deliveryCalculation = await deliveryService.calculateDeliveryCharges(buyerAddress, productPrice, 'individual', product.sellerId);
      const deliveryFee = deliveryCalculation.deliveryCharge;

      const totalAmount = productPrice + deliveryFee;

      // Create customer with billing address
      const customer = await stripe.customers.create({
        name: address.fullName,
        address: {
          line1: address.addressLine,
          city: address.city,
          state: address.state || "CA",
          postal_code: address.pincode,
          country: address.country || "US"
        }
      });

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: "usd",
        customer: customer.id,
        description: `${product.name}${deliveryFee > 0 ? ` (includes $${deliveryFee.toFixed(2)} delivery fee)` : ''}`,
        shipping: {
          name: address.fullName,
          address: {
            line1: address.addressLine,
            city: address.city,
            state: address.state || "CA",
            postal_code: address.pincode,
            country: address.country || "US"
          }
        },
        metadata: {
          userId: userId,
          productId: productId.toString(),
          type: "individual",
          addressId: addressId.toString(),
          deliveryFee: deliveryFee.toString(),
          originalAmount: productPrice.toString(),
          quantity: quantity.toString()
        }
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        deliveryFee: deliveryFee,
        productPrice: productPrice,
        totalAmount: totalAmount,
        deliveryInfo: {
          distance: deliveryCalculation.distance,
          duration: deliveryCalculation.duration,
          isFreeDelivery: deliveryCalculation.isFreeDelivery,
          reason: deliveryCalculation.reason
        }
      });
    } catch (error: any) {
      console.error("Error creating individual payment intent:", error);
      res.status(500).json({ message: "Error creating individual payment intent: " + error.message });
    }
  });

  // Group-specific payment intent creation
  app.post("/api/create-group-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      console.log("Group payment intent request body:", req.body);
      
      const { userGroupId, productId, amount, currency = "usd", addressId, memberId, payerId, beneficiaryId } = req.body;
      
      // Validate required parameters
      if (!userGroupId) {
        return res.status(400).json({ message: "userGroupId is required" });
      }
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      if (!addressId) {
        return res.status(400).json({ message: "addressId is required" });
      }
      
      // For group purchases, productId is optional - we'll get it from the group if not provided
      let finalProductId = productId;
      if (!finalProductId) {
        const userGroup = await storage.getUserGroup(userGroupId);
        if (userGroup?.items?.length > 0) {
          finalProductId = userGroup.items[0].product.id;
        } else {
          return res.status(400).json({ message: "No products found in group" });
        }
      }

      // Check if user is already part of this group
      const isInGroup = await storage.isUserInUserGroup(userGroupId, req.user.claims.sub);
      if (!isInGroup) {
        return res.status(403).json({ message: "User must be a participant in this group to make payments" });
      }

      // Use payerId and beneficiaryId from request body, with fallbacks
      const finalPayerId = payerId || req.user.claims.sub;
      const finalBeneficiaryId = beneficiaryId || memberId || req.user.claims.sub;
      
      // For group purchases, we need to get the group details to calculate the total
      const userGroup = await storage.getUserGroup(userGroupId);
      if (!userGroup) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if this beneficiary has already paid for this product in this group
      // For group purchases, we check if they've paid for the first product (representative of the group)
      const alreadyPaid = await storage.hasUserPaidForProduct(finalBeneficiaryId, userGroupId, finalProductId);
      if (alreadyPaid) {
        return res.status(400).json({ message: "This user has already paid for this product in this group" });
      }

      // Get address for BC validation
      const addresses = await storage.getUserAddresses(finalBeneficiaryId);
      const address = addresses.find(addr => addr.id === addressId);
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }

      const buyerAddress = {
        addressLine: address.addressLine,
        city: address.city,
        state: address.state || undefined,
        country: address.country || 'US',
        pincode: address.pincode
      };

      // Check BC minimum order value for group orders
      const bcValidation = await deliveryService.checkBCMinimumOrderValue(amount, 'group');
      if (!bcValidation.isValid) {
        return res.status(400).json({ 
          message: bcValidation.message,
          minimumRequired: bcValidation.minimumRequired,
          currentTotal: amount,
          type: 'minimum_order_value'
        });
      }

      // Get product details for description (use first product or a generic name)
      let productName = "Group Purchase";
      try {
        const product = await storage.getProduct(finalProductId);
        productName = product?.name || "Group Purchase";
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
          productId: finalProductId.toString(),
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
      const { amount, currency = "usd", productId, type = "individual", addressId, deliveryFee = 0 } = req.body;
      
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

      // Get user address for individual payments
      let customerAddress = {
        line1: "Customer Address",
        city: "Customer City",
        state: "CA",
        postal_code: "90210",
        country: "US"
      };

      let shippingAddress = {
        name: "International Customer",
        address: {
          line1: "Shipping Address",
          city: "Shipping City",
          state: "CA",
          postal_code: "90210",
          country: "US"
        }
      };

      // For individual payments, use the provided address if available
      if (type === "individual" && addressId) {
        try {
          const addresses = await storage.getUserAddresses(req.user.claims.sub);
          const address = addresses.find(addr => addr.id === addressId);
          
          if (address) {
            customerAddress = {
              line1: address.addressLine,
              city: address.city,
              state: address.state || "CA",
              postal_code: address.pincode,
              country: address.country || "US"
            };

            shippingAddress = {
              name: address.fullName,
              address: {
                line1: address.addressLine,
                city: address.city,
                state: address.state || "CA",
                postal_code: address.pincode,
                country: address.country || "US"
              }
            };
          }
        } catch (e) {
          console.log("Could not fetch user address, using default address");
        }
      }

      // Step 1: Create customer with billing address (required for Indian export transactions)
      const customer = await stripe.customers.create({
        name: shippingAddress.name,
        address: customerAddress
      });

      // Calculate total amount including delivery fee for individual payments
      const totalAmount = type === "individual" ? amount + deliveryFee : amount;

      // Step 2: Create payment intent with shipping address (required for goods)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency,
        customer: customer.id, // Link to customer with billing address
        description: type === "individual" ? `${productName}${deliveryFee > 0 ? ` (includes $${deliveryFee.toFixed(2)} delivery fee)` : ''}` : productName,
        shipping: shippingAddress,
        metadata: {
          userId: req.user.claims.sub,
          productId: productId?.toString() || "",
          type,
          addressId: addressId?.toString() || "",
          deliveryFee: deliveryFee.toString(),
          originalAmount: amount.toString()
        }
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Endpoint to manually create order after successful payment (development only)
  app.post("/api/create-order-from-payment", isAuthenticated, async (req: any, res) => {
    if (process.env.NODE_ENV !== "development") {
      return res.status(404).json({ message: "Not found" });
    }
    
    const { paymentIntentId } = req.body;
    const userId = req.user.claims.sub;
    
    if (!paymentIntentId) {
      return res.status(400).json({ message: "paymentIntentId is required" });
    }
    
    try {
      // Fetch the payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log("Manual order creation - Retrieved payment intent:", paymentIntent.id);
      console.log("Manual order creation - Payment metadata:", paymentIntent.metadata);
      
      const type = paymentIntent.metadata.type || "individual";
      const amount = paymentIntent.amount / 100;
      
      if (type === "multi_item_individual") {
        console.log("Manual order creation - Processing multi-item individual payment...");
        const addressId = parseInt(paymentIntent.metadata.addressId);
        const deliveryFee = parseFloat(paymentIntent.metadata.deliveryFee || "0");
        const originalAmount = parseFloat(paymentIntent.metadata.originalAmount || amount.toString());
        const cartItemIds = paymentIntent.metadata.cartItemIds?.split(',').map(id => parseInt(id)) || [];
        
        console.log("Manual order creation - Multi-item payment metadata:", {
          userId,
          addressId,
          deliveryFee,
          originalAmount,
          cartItemIds
        });
        
        if (!userId || cartItemIds.length === 0) {
          console.error("Manual order creation - Missing required metadata for multi-item order creation");
          return res.status(400).json({ message: "Missing required metadata" });
        }

        // Get cart items
        const cartItems = await storage.getUserCart(userId);
        console.log("Manual order creation - All cart items for user:", cartItems.length);
        const relevantCartItems = cartItems.filter(item => cartItemIds.includes(item.id));
        console.log("Manual order creation - Relevant cart items found:", relevantCartItems.length);
        
        if (relevantCartItems.length === 0) {
          console.error("Manual order creation - No cart items found for multi-item order creation");
          return res.status(400).json({ message: "No cart items found" });
        }

        // Get user address for shipping information
        let shippingAddress = "International Shipping Address";
        if (addressId) {
          try {
            const addresses = await storage.getUserAddresses(userId);
            const address = addresses.find(addr => addr.id === addressId);
            if (address) {
              shippingAddress = `${address.fullName}, ${address.addressLine}, ${address.city}, ${address.state || ''} ${address.pincode}, ${address.country || 'US'}`;
            }
          } catch (e) {
            console.log("Manual order creation - Could not fetch address for shipping information");
          }
        }

        // Create order record for multi-item individual purchase
        const orderData = {
          userId,
          payerId: userId,
          addressId: addressId || null,
          totalPrice: (originalAmount + deliveryFee).toString(),
          finalPrice: (originalAmount + deliveryFee).toString(),
          status: "pending" as const,
          type: "individual" as const,
          shippingAddress
        };

        // Create order items array for multi-item purchase
        const orderItems = relevantCartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: parseFloat(item.product.originalPrice).toString(),
          totalPrice: (parseFloat(item.product.originalPrice) * item.quantity).toString()
        }));

        console.log("Manual order creation - Creating order with data:", orderData);
        console.log("Manual order creation - Creating order items:", orderItems);
        
        const newOrder = await storage.createOrderWithItems(orderData, orderItems);
        console.log("Manual order creation - Multi-item individual order created successfully:", newOrder.id, "Items:", relevantCartItems.length, "Total:", orderData.finalPrice);

        // Clear the cart items that were purchased
        for (const cartItem of relevantCartItems) {
          await storage.removeFromCart(cartItem.id);
        }

        // Create notifications for sellers about payment received
        const sellerNotifications = new Map();
        for (const item of relevantCartItems) {
          if (item.product.sellerId) {
            const sellerId = item.product.sellerId;
            if (!sellerNotifications.has(sellerId)) {
              sellerNotifications.set(sellerId, []);
            }
            sellerNotifications.get(sellerId).push({
              name: item.product.name,
              amount: (parseFloat(item.product.originalPrice) * item.quantity).toFixed(2)
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
        
        return res.json({ 
          success: true, 
          orderId: newOrder.id, 
          message: "Order created successfully" 
        });
      } else {
        return res.status(400).json({ message: "Only multi_item_individual type supported" });
      }
    } catch (error) {
      console.error("Manual order creation error:", error);
      return res.status(500).json({ message: "Order creation failed", error: error.message });
    }
  });

  // Test endpoint to manually trigger webhook processing (development only)
  app.post("/api/test-webhook", async (req, res) => {
    if (process.env.NODE_ENV !== "development") {
      return res.status(404).json({ message: "Not found" });
    }
    
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ message: "paymentIntentId is required" });
    }
    
    try {
      // Fetch the payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log("Test webhook - Retrieved payment intent:", paymentIntent.id);
      console.log("Test webhook - Payment metadata:", paymentIntent.metadata);
      
      // Create a mock webhook event
      const mockEvent = {
        type: "payment_intent.succeeded",
        data: {
          object: paymentIntent
        }
      };
      
      // Process the event (same logic as webhook)
      const type = paymentIntent.metadata.type || "individual";
      const amount = paymentIntent.amount / 100;
      
      if (type === "multi_item_individual") {
        console.log("Test webhook - Processing multi-item individual payment...");
        const userId = paymentIntent.metadata.userId;
        const addressId = parseInt(paymentIntent.metadata.addressId);
        const deliveryFee = parseFloat(paymentIntent.metadata.deliveryFee || "0");
        const originalAmount = parseFloat(paymentIntent.metadata.originalAmount || amount.toString());
        const cartItemIds = paymentIntent.metadata.cartItemIds?.split(',').map(id => parseInt(id)) || [];
        
        console.log("Test webhook - Multi-item payment metadata:", {
          userId,
          addressId,
          deliveryFee,
          originalAmount,
          cartItemIds
        });
        
        if (!userId || cartItemIds.length === 0) {
          console.error("Test webhook - Missing required metadata for multi-item order creation");
          return res.status(400).json({ message: "Missing required metadata" });
        }

        // Get cart items
        const cartItems = await storage.getUserCart(userId);
        console.log("Test webhook - All cart items for user:", cartItems.length);
        const relevantCartItems = cartItems.filter(item => cartItemIds.includes(item.id));
        console.log("Test webhook - Relevant cart items found:", relevantCartItems.length);
        
        if (relevantCartItems.length === 0) {
          console.error("Test webhook - No cart items found for multi-item order creation");
          return res.status(400).json({ message: "No cart items found" });
        }

        // Get user address for shipping information
        let shippingAddress = "International Shipping Address";
        if (addressId) {
          try {
            const addresses = await storage.getUserAddresses(userId);
            const address = addresses.find(addr => addr.id === addressId);
            if (address) {
              shippingAddress = `${address.fullName}, ${address.addressLine}, ${address.city}, ${address.state || ''} ${address.pincode}, ${address.country || 'US'}`;
            }
          } catch (e) {
            console.log("Test webhook - Could not fetch address for shipping information");
          }
        }

        // Create order record for multi-item individual purchase
        const orderData = {
          userId,
          payerId: userId,
          addressId: addressId || null,
          totalPrice: (originalAmount + deliveryFee).toString(),
          finalPrice: (originalAmount + deliveryFee).toString(),
          status: "pending" as const,
          type: "individual" as const,
          shippingAddress
        };

        // Create order items array for multi-item purchase
        const orderItems = relevantCartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: parseFloat(item.product.originalPrice).toString(),
          totalPrice: (parseFloat(item.product.originalPrice) * item.quantity).toString()
        }));

        console.log("Test webhook - Creating order with data:", orderData);
        console.log("Test webhook - Creating order items:", orderItems);
        
        const newOrder = await storage.createOrderWithItems(orderData, orderItems);
        console.log("Test webhook - Multi-item individual order created successfully:", newOrder.id, "Items:", relevantCartItems.length, "Total:", orderData.finalPrice);

        // Clear the cart items that were purchased
        for (const cartItem of relevantCartItems) {
          await storage.removeFromCart(cartItem.id);
        }

        // Create notifications for sellers about payment received
        const sellerNotifications = new Map();
        for (const item of relevantCartItems) {
          if (item.product.sellerId) {
            const sellerId = item.product.sellerId;
            if (!sellerNotifications.has(sellerId)) {
              sellerNotifications.set(sellerId, []);
            }
            sellerNotifications.get(sellerId).push({
              name: item.product.name,
              amount: (parseFloat(item.product.originalPrice) * item.quantity).toFixed(2)
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
        
        return res.json({ 
          success: true, 
          orderId: newOrder.id, 
          message: "Order created successfully via test webhook" 
        });
      } else {
        return res.status(400).json({ message: "Only multi_item_individual type supported in test webhook" });
      }
    } catch (error) {
      console.error("Test webhook error:", error);
      return res.status(500).json({ message: "Test webhook failed", error: error.message });
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
            
            // Check minimum order value requirement ($50 excluding delivery)
            const MINIMUM_ORDER_VALUE = 50.00;
            const orderValueExcludingDelivery = userGroup.items.reduce((sum, item) => {
              return sum + (parseFloat(item.product.originalPrice) * item.quantity);
            }, 0);
            
            for (const item of userGroup.items) {
              // Calculate the discounted price for this specific item
              let discountedPrice = parseFloat(item.product.originalPrice);
              
              // Only apply discounts if minimum order value is met
              if (orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE && item.product.discountTiers && item.product.discountTiers.length > 0) {
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
                status: "pending" as const,
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
              
              // Only apply discounts if minimum order value is met (reuse the same calculation from above)
              if (orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE && item.product.discountTiers && item.product.discountTiers.length > 0) {
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
            
          } else if (type === "multi_item_individual") {
            // Handle multi-item individual payments (cart checkout)
            console.log("Processing multi-item individual payment...");
            const userId = paymentIntent.metadata.userId;
            const addressId = parseInt(paymentIntent.metadata.addressId);
            const deliveryFee = parseFloat(paymentIntent.metadata.deliveryFee || "0");
            const originalAmount = parseFloat(paymentIntent.metadata.originalAmount || amount.toString());
            const cartItemIds = paymentIntent.metadata.cartItemIds?.split(',').map(id => parseInt(id)) || [];
            
            console.log("Multi-item payment metadata:", {
              userId,
              addressId,
              deliveryFee,
              originalAmount,
              cartItemIds
            });
            
            if (!userId || cartItemIds.length === 0) {
              console.error("Missing required metadata for multi-item order creation");
              break;
            }

            // Get cart items
            const cartItems = await storage.getUserCart(userId);
            console.log("All cart items for user:", cartItems.length);
            const relevantCartItems = cartItems.filter(item => cartItemIds.includes(item.id));
            console.log("Relevant cart items found:", relevantCartItems.length);
            
            if (relevantCartItems.length === 0) {
              console.error("No cart items found for multi-item order creation");
              break;
            }

            // Get user address for shipping information
            let shippingAddress = "International Shipping Address";
            if (addressId) {
              try {
                const addresses = await storage.getUserAddresses(userId);
                const address = addresses.find(addr => addr.id === addressId);
                if (address) {
                  shippingAddress = `${address.fullName}, ${address.addressLine}, ${address.city}, ${address.state || ''} ${address.pincode}, ${address.country || 'US'}`;
                }
              } catch (e) {
                console.log("Could not fetch address for shipping information");
              }
            }

            // Create order record for multi-item individual purchase
            const orderData = {
              userId,
              payerId: userId, // For individual purchases, user pays for themselves
              addressId: addressId || null,
              totalPrice: (originalAmount + deliveryFee).toString(),
              finalPrice: (originalAmount + deliveryFee).toString(),
              status: "pending" as const,
              type: "individual" as const,
              shippingAddress
            };

            // Create order items array for multi-item purchase
            const orderItems = relevantCartItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: parseFloat(item.product.originalPrice).toString(),
              totalPrice: (parseFloat(item.product.originalPrice) * item.quantity).toString()
            }));

            // Note: Delivery fee is included in the order's total price, not as a separate line item
            // This prevents issues with product details display

            console.log("Creating order with data:", orderData);
            console.log("Creating order items:", orderItems);
            
            const newOrder = await storage.createOrderWithItems(orderData, orderItems);
            console.log("Multi-item individual order created successfully:", newOrder.id, "Items:", relevantCartItems.length, "Total:", orderData.finalPrice);

            // Clear the cart items that were purchased
            for (const cartItem of relevantCartItems) {
              await storage.removeFromCart(cartItem.id);
            }

            // Create notifications for sellers about payment received
            const sellerNotifications = new Map();
            for (const item of relevantCartItems) {
              if (item.product.sellerId) {
                const sellerId = item.product.sellerId;
                if (!sellerNotifications.has(sellerId)) {
                  sellerNotifications.set(sellerId, []);
                }
                sellerNotifications.get(sellerId).push({
                  name: item.product.name,
                  amount: (parseFloat(item.product.originalPrice) * item.quantity).toFixed(2)
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

          } else {
            // Handle individual payments with delivery fees and address information
            const userId = paymentIntent.metadata.userId;
            const productId = parseInt(paymentIntent.metadata.productId);
            const addressId = parseInt(paymentIntent.metadata.addressId);
            const deliveryFee = parseFloat(paymentIntent.metadata.deliveryFee || "0");
            const originalAmount = parseFloat(paymentIntent.metadata.originalAmount || amount.toString());
            
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

            // Get user address for shipping information
            let shippingAddress = "International Shipping Address";
            if (addressId) {
              try {
                const addresses = await storage.getUserAddresses(userId);
                const address = addresses.find(addr => addr.id === addressId);
                if (address) {
                  shippingAddress = `${address.fullName}, ${address.addressLine}, ${address.city}, ${address.state || ''} ${address.pincode}, ${address.country || 'US'}`;
                }
              } catch (e) {
                console.log("Could not fetch address for shipping information");
              }
            }

            // Create order record for individual purchase with delivery fee
            const orderData = {
              userId,
              payerId: userId, // For individual purchases, user pays for themselves
              addressId: addressId || null,
              totalPrice: (originalAmount + deliveryFee).toString(),
              finalPrice: (originalAmount + deliveryFee).toString(),
              status: "pending" as const,
              type: type as "individual" | "group",
              shippingAddress
            };

            // Create order items array for individual purchase
            const orderItems = [{
              productId: productId,
              quantity: 1,
              unitPrice: originalAmount.toString(),
              totalPrice: originalAmount.toString()
            }];

            // Note: Delivery fee is included in the order's total price, not as a separate line item
            // This prevents issues with product details display

            const newOrder = await storage.createOrderWithItems(orderData, orderItems);
            console.log("Individual order created successfully with delivery fee:", newOrder.id, "Total:", orderData.finalPrice);

            // Create notification for seller about payment received
            if (product.sellerId) {
              await storage.createSellerNotification({
                sellerId: product.sellerId,
                type: "payment_received",
                title: "Payment Received",
                message: `Payment of $${originalAmount.toFixed(2)} received for: ${product.name} (Order #${newOrder.id})`,
                data: { orderId: newOrder.id, amount: originalAmount, productIds: [productId] },
                priority: "high"
              });
            }
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
      
      // Invalidate caches after product deletion
      console.log('🔄 Invalidating caches after product deletion...');
      apiCache.delete('products');
      apiCache.delete('categories');
      apiCache.delete('browse');
      ultraFastStorage.clearCache();
      groupPricingCache.clear();
      console.log('✅ Caches invalidated - deleted product should be immediately removed');
      
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Delivery fee calculation endpoint
  app.post("/api/delivery-fee", isAuthenticated, async (req: any, res) => {
    try {
      const { addressId, orderTotal = 0, orderType = 'individual' } = req.body;
      const userId = req.user.claims.sub;

      console.log("Delivery fee calculation request:", { addressId, userId, orderTotal, orderType });

      if (!addressId) {
        return res.status(400).json({ message: "addressId is required" });
      }

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get user address
      const addresses = await storage.getUserAddresses(userId);
      const address = addresses.find(addr => addr.id === addressId);
      
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }

      console.log("Found address:", address);

      // Format address for delivery calculation
      const buyerAddress = {
        addressLine: address.addressLine,
        city: address.city,
        state: address.state || undefined,
        country: address.country || 'US',
        pincode: address.pincode
      };

      // Calculate delivery charges with actual order total
      console.log("Calculating delivery charges for address:", buyerAddress, "with order total:", orderTotal);
      const deliverySummary = await deliveryService.getDeliverySummary(buyerAddress, orderTotal, orderType);
      console.log("Delivery calculation result:", deliverySummary);

      // Extract delivery info from the first seller
      const firstDelivery = deliverySummary.deliveryDetails[0];
      if (!firstDelivery) {
        return res.status(500).json({ 
          message: "Failed to calculate delivery information" 
        });
      }

      res.json({
        distance: firstDelivery.distance,
        duration: 0, // Duration not available in summary
        deliveryCharge: firstDelivery.deliveryCharge,
        isFreeDelivery: firstDelivery.isFreeDelivery,
        reason: firstDelivery.reason,
        minimumOrderValue: 50.00,
        orderTotal: orderTotal,
        meetsMinimumOrder: firstDelivery.meetsMinimumOrder ?? (orderTotal >= 50.00),
        canDeliver: deliverySummary.isBCAddress
      });
    } catch (error: any) {
      console.error("Error calculating delivery fee:", error);
      
      // Check if it's a BC validation error
      if (error.message?.includes('Delivery not available')) {
        return res.status(400).json({ 
          message: "Delivery not available for this address",
          error: error.message,
          details: "Address must be in British Columbia for delivery"
        });
      }
      
      // Check if it's a geocoding API error
      if (error.message?.includes('Google Geocoding API key not configured')) {
        return res.status(503).json({ 
          message: "Delivery calculation temporarily unavailable",
          error: "Geocoding service not configured",
          details: "Please try again later or contact support"
        });
      }
      
      res.status(500).json({ 
        message: "Failed to calculate delivery fee",
        error: error.message || "Unknown error"
      });
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

        // Check minimum order value requirement ($50 excluding delivery)
        const MINIMUM_ORDER_VALUE = 50.00;
        const orderValueExcludingDelivery = popularGroupValue; // This is the total before delivery
        
        // Only apply discounts if minimum order value is met
        if (orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE) {
          // Calculate final amount using formula: Popular Group Value - Potential Savings
          potentialSavings = popularGroupValue - totalDiscountedAmount;
          memberAmount = popularGroupValue - potentialSavings; // This equals totalDiscountedAmount
          console.log(`Server - Minimum order value met ($${orderValueExcludingDelivery.toFixed(2)} >= $${MINIMUM_ORDER_VALUE}), applying group discounts`);
        } else {
          // No discounts applied - use original prices
          potentialSavings = 0;
          memberAmount = popularGroupValue; // No discount, pay full original amount
          console.log(`Server - Minimum order value not met ($${orderValueExcludingDelivery.toFixed(2)} < $${MINIMUM_ORDER_VALUE}), no group discounts applied`);
        }
        
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
  
  // Initialize WebSocket notification broadcaster
  websocketNotificationBroadcaster.initialize(httpServer);
  
  return httpServer;
}


