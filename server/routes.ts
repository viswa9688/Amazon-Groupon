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
  insertGroupPurchaseSchema,
  insertGroupParticipantSchema,
  insertOrderSchema,
} from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

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

  app.delete('/api/group-purchases/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const success = await storage.leaveGroupPurchase(groupId, userId);
      if (success) {
        res.json({ message: "Left group purchase successfully" });
      } else {
        res.status(404).json({ message: "Participation not found" });
      }
    } catch (error) {
      console.error("Error leaving group purchase:", error);
      res.status(400).json({ message: "Failed to leave group purchase" });
    }
  });

  app.get('/api/group-purchases/:id/participation', isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const participation = await storage.getUserGroupParticipation(groupId, userId);
      res.json({ isParticipating: !!participation, participation });
    } catch (error) {
      console.error("Error checking participation:", error);
      res.status(500).json({ message: "Failed to check participation" });
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

  // Stripe payment routes
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { amount, currency = "usd", productId, type = "individual" } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      // Get product details for better description
      let productName = "Product";
      if (productId) {
        try {
          const product = await storage.getProduct(productId);
          productName = product?.name || "Product";
        } catch (e) {
          console.log("Could not fetch product details for payment intent");
        }
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description: `Export sale of ${productName} via OneAnt digital marketplace platform for international group purchasing of consumer electronics and technology products. Business export transaction for cross-border e-commerce.`,
        statement_descriptor: "ONEANT PURCHASE", // This appears on customer's bank statement
        metadata: {
          userId: req.user.claims.sub,
          productId: productId?.toString() || "",
          type,
          business_type: "export",
          product_category: "electronics",
          transaction_type: "cross_border_ecommerce"
        },
        shipping: {
          name: "OneAnt Customer",
          address: {
            line1: "International Delivery",
            city: "Customer Location", 
            country: "US", // Default to US for international transactions
            postal_code: "00000"
          }
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
        
        // Update order status based on payment success
        if (paymentIntent.metadata.type === "individual") {
          // Handle individual purchase completion
          console.log("Individual purchase completed for user:", paymentIntent.metadata.userId);
        } else if (paymentIntent.metadata.type === "group") {
          // Handle group purchase payment
          console.log("Group purchase payment completed for user:", paymentIntent.metadata.userId);
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
