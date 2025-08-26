import { db } from "./db";
import { 
  categories, 
  products, 
  discountTiers, 
  groupPurchases,
  users
} from "@shared/schema";

export async function seedDatabase() {
  try {
    // Seed categories
    const categoryData = [
      { name: "Electronics", slug: "electronics", icon: "Laptop" },
      { name: "Fashion", slug: "fashion", icon: "Shirt" },
      { name: "Home & Garden", slug: "home-garden", icon: "Home" },
      { name: "Sports & Fitness", slug: "sports-fitness", icon: "Dumbbell" },
      { name: "Gaming", slug: "gaming", icon: "Gamepad" },
      { name: "Baby & Kids", slug: "baby-kids", icon: "Baby" },
    ];

    const insertedCategories = await db.insert(categories).values(categoryData).returning();
    console.log("Seeded categories:", insertedCategories.length);

    // Create a sample seller user
    const sampleSeller = await db.insert(users).values({
      id: "sample-seller-123",
      email: "seller@oneant.com",
      firstName: "John",
      lastName: "Seller",
      isSeller: true,
    }).returning();

    // Seed sample products
    const productData = [
      {
        sellerId: sampleSeller[0].id,
        categoryId: insertedCategories[0].id,
        name: "Premium Wireless Headphones",
        description: "High-quality wireless headphones with noise cancellation and premium sound quality. Perfect for music lovers and professionals.",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "199.99",
        minimumParticipants: 10,
        maximumParticipants: 100,
      },
      {
        sellerId: sampleSeller[0].id,
        categoryId: insertedCategories[3].id,
        name: "Smart Fitness Tracker",
        description: "Advanced fitness tracker with heart rate monitoring, GPS, and 7-day battery life. Track your health and fitness goals.",
        imageUrl: "https://images.unsplash.com/photo-1544117519-31a4b719223d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "149.99",
        minimumParticipants: 15,
        maximumParticipants: 200,
      },
      {
        sellerId: sampleSeller[0].id,
        categoryId: insertedCategories[0].id,
        name: "Portable Bluetooth Speaker",
        description: "Waterproof portable speaker with 360-degree sound and 12-hour battery life. Perfect for outdoor adventures.",
        imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "89.99",
        minimumParticipants: 20,
        maximumParticipants: 300,
      },
      {
        sellerId: sampleSeller[0].id,
        categoryId: insertedCategories[1].id,
        name: "Premium Cotton T-Shirt Set",
        description: "Set of 3 premium cotton t-shirts in different colors. Comfortable, durable, and stylish for everyday wear.",
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "79.99",
        minimumParticipants: 25,
        maximumParticipants: 250,
      },
      {
        sellerId: sampleSeller[0].id,
        categoryId: insertedCategories[4].id,
        name: "Wireless Gaming Mouse",
        description: "High-precision wireless gaming mouse with customizable RGB lighting and ultra-fast response time.",
        imageUrl: "https://images.unsplash.com/photo-1527814050087-3793815479db?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "69.99",
        minimumParticipants: 30,
        maximumParticipants: 150,
      },
      {
        sellerId: sampleSeller[0].id,
        categoryId: insertedCategories[2].id,
        name: "Smart Plant Monitoring System",
        description: "Monitor your plants' health with smart sensors that track moisture, light, and temperature. Includes mobile app.",
        imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "59.99",
        minimumParticipants: 20,
        maximumParticipants: 100,
      },
    ];

    const insertedProducts = await db.insert(products).values(productData).returning();
    console.log("Seeded products:", insertedProducts.length);

    // Seed discount tiers for each product
    const discountTierData = [];
    for (const product of insertedProducts) {
      const originalPrice = parseFloat(product.originalPrice.toString());
      discountTierData.push(
        {
          productId: product.id,
          participantCount: Math.floor(product.minimumParticipants / 2),
          discountPercentage: "10.00",
          finalPrice: (originalPrice * 0.9).toFixed(2),
        },
        {
          productId: product.id,
          participantCount: product.minimumParticipants,
          discountPercentage: "20.00",
          finalPrice: (originalPrice * 0.8).toFixed(2),
        },
        {
          productId: product.id,
          participantCount: product.minimumParticipants * 2,
          discountPercentage: "35.00",
          finalPrice: (originalPrice * 0.65).toFixed(2),
        },
        {
          productId: product.id,
          participantCount: product.minimumParticipants * 3,
          discountPercentage: "50.00",
          finalPrice: (originalPrice * 0.5).toFixed(2),
        }
      );
    }

    await db.insert(discountTiers).values(discountTierData);
    console.log("Seeded discount tiers:", discountTierData.length);

    // Seed group purchases
    const groupPurchaseData = insertedProducts.map((product, index) => {
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + Math.floor(Math.random() * 7) + 1); // 1-7 days from now
      
      const currentParticipants = Math.floor(Math.random() * product.minimumParticipants * 1.5);
      const originalPrice = parseFloat(product.originalPrice.toString());
      
      // Calculate current price based on participants
      let currentPrice = originalPrice;
      if (currentParticipants >= product.minimumParticipants * 3) {
        currentPrice = originalPrice * 0.5; // 50% off
      } else if (currentParticipants >= product.minimumParticipants * 2) {
        currentPrice = originalPrice * 0.65; // 35% off
      } else if (currentParticipants >= product.minimumParticipants) {
        currentPrice = originalPrice * 0.8; // 20% off
      } else if (currentParticipants >= Math.floor(product.minimumParticipants / 2)) {
        currentPrice = originalPrice * 0.9; // 10% off
      }

      return {
        productId: product.id,
        currentParticipants,
        targetParticipants: product.minimumParticipants * 3,
        currentPrice: currentPrice.toFixed(2),
        endTime,
        status: "active" as const,
      };
    });

    await db.insert(groupPurchases).values(groupPurchaseData);
    console.log("Seeded group purchases:", groupPurchaseData.length);

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}