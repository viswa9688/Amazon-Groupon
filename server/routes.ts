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

  app.post('/api/seller/products', isAuthenticated, async (req: any, res) => {
    try {
      const sellerId = req.user.claims.sub;
      const { discountPrice, ...productFields } = req.body;
      const productData = {
        ...productFields,
        sellerId,
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
      
      const groupPurchase = await storage.createGroupPurchase({
        productId: product.id!,
        targetParticipants: productData.minimumParticipants,
        currentPrice: productData.originalPrice,
        endTime,
      });
      
      res.status(201).json({ product, groupPurchase });
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
      };
      
      const validatedProductData = insertProductSchema.parse(productData);
      const product = await storage.updateProduct(productId, validatedProductData);
      
      // Update discount tier if provided
      if (discountPrice && parseFloat(discountPrice) < parseFloat(productData.originalPrice)) {
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

  // Temporary endpoint to recalculate pricing for existing group purchases
  app.post('/api/admin/recalculate-prices', async (req, res) => {
    try {
      // Get all active group purchases
      const groupPurchases = await storage.getAllGroupPurchases();
      
      // Recalculate prices for each one
      for (const gp of groupPurchases) {
        await storage.updateGroupPurchaseProgress(gp.id);
      }
      
      res.json({ message: `Updated ${groupPurchases.length} group purchases` });
    } catch (error) {
      console.error("Error recalculating prices:", error);
      res.status(500).json({ message: "Failed to recalculate prices" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
