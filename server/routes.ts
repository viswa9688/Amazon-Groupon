import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertProductSchema,
  insertCategorySchema,
  insertDiscountTierSchema,
  insertGroupPurchaseSchema,
  insertGroupParticipantSchema,
  insertOrderSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
  app.get('/api/group-purchases', async (req, res) => {
    try {
      const groupPurchases = await storage.getActiveGroupPurchases();
      res.json(groupPurchases);
    } catch (error) {
      console.error("Error fetching group purchases:", error);
      res.status(500).json({ message: "Failed to fetch group purchases" });
    }
  });

  app.get('/api/group-purchases/:id', async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const groupPurchase = await storage.getGroupPurchase(groupId);
      if (!groupPurchase) {
        return res.status(404).json({ message: "Group purchase not found" });
      }
      res.json(groupPurchase);
    } catch (error) {
      console.error("Error fetching group purchase:", error);
      res.status(500).json({ message: "Failed to fetch group purchase" });
    }
  });

  app.post('/api/group-purchases', isAuthenticated, async (req: any, res) => {
    try {
      const groupPurchaseData = insertGroupPurchaseSchema.parse(req.body);
      const groupPurchase = await storage.createGroupPurchase(groupPurchaseData);
      res.status(201).json(groupPurchase);
    } catch (error) {
      console.error("Error creating group purchase:", error);
      res.status(400).json({ message: "Failed to create group purchase" });
    }
  });

  app.post('/api/group-purchases/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { quantity = 1 } = req.body;

      const participant = await storage.joinGroupPurchase(groupId, userId, quantity);
      res.status(201).json(participant);
    } catch (error) {
      console.error("Error joining group purchase:", error);
      res.status(400).json({ message: "Failed to join group purchase" });
    }
  });

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

  const httpServer = createServer(app);
  return httpServer;
}
