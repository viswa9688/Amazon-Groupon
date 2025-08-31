import { db } from "./db";
import { 
  categories, 
  products, 
  discountTiers, 
  users,
  userGroups,
  userGroupItems,
  userGroupParticipants
} from "@shared/schema";
import { nanoid } from "nanoid";

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
      { name: "Books", slug: "books", icon: "Book" },
    ];

    const insertedCategories = await db.insert(categories).values(categoryData).returning();
    console.log("Seeded categories:", insertedCategories.length);

    // Create sample seller users
    const sampleSeller = await db.insert(users).values({
      id: "sample-seller-123",
      email: "seller@oneant.com",
      firstName: "John",
      lastName: "Seller",
      isSeller: true,
    }).returning();

    const johnSeller = await db.insert(users).values({
      id: "john-seller-456",
      email: "john@oneant.com",
      firstName: "John",
      lastName: "Smith",
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
      // John's 20 additional products
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[0].id, // Electronics
        name: "4K Ultra HD Smart TV",
        description: "55-inch 4K Ultra HD Smart TV with HDR and built-in streaming apps. Perfect for entertainment.",
        imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "299.99",
        minimumParticipants: 8,
        maximumParticipants: 50,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[0].id, // Electronics
        name: "Wireless Charging Pad",
        description: "Fast wireless charging pad compatible with all Qi-enabled devices. Sleek and efficient design.",
        imageUrl: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "25.99",
        minimumParticipants: 50,
        maximumParticipants: 200,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[0].id, // Electronics
        name: "USB-C Hub Multi-Port Adapter",
        description: "7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader, and fast charging support.",
        imageUrl: "https://images.unsplash.com/photo-1625842268584-8f3296236761?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "45.99",
        minimumParticipants: 30,
        maximumParticipants: 150,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[0].id, // Electronics
        name: "Smartphone Camera Lens Kit",
        description: "Professional smartphone camera lens kit with wide-angle, macro, and telephoto lenses.",
        imageUrl: "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "89.99",
        minimumParticipants: 25,
        maximumParticipants: 100,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[1].id, // Fashion
        name: "Luxury Leather Handbag",
        description: "Genuine leather handbag with multiple compartments and adjustable strap. Timeless elegance.",
        imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "159.99",
        minimumParticipants: 15,
        maximumParticipants: 75,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[1].id, // Fashion
        name: "Designer Sunglasses",
        description: "UV protection designer sunglasses with polarized lenses and lightweight titanium frame.",
        imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "129.99",
        minimumParticipants: 20,
        maximumParticipants: 80,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[1].id, // Fashion
        name: "Premium Wool Scarf",
        description: "Soft cashmere blend scarf in multiple colors. Perfect for any season and occasion.",
        imageUrl: "https://images.unsplash.com/photo-1601924638867-985629389d5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "39.99",
        minimumParticipants: 40,
        maximumParticipants: 180,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[1].id, // Fashion
        name: "Athletic Performance Sneakers",
        description: "High-performance athletic sneakers with advanced cushioning and breathable mesh design.",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "119.99",
        minimumParticipants: 25,
        maximumParticipants: 120,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[2].id, // Home & Garden
        name: "Smart Home Security Camera",
        description: "1080p HD security camera with night vision, motion detection, and smartphone app control.",
        imageUrl: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "79.99",
        minimumParticipants: 35,
        maximumParticipants: 150,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[2].id, // Home & Garden
        name: "Ceramic Non-Stick Cookware Set",
        description: "10-piece ceramic non-stick cookware set with heat-resistant handles and dishwasher-safe design.",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "199.99",
        minimumParticipants: 12,
        maximumParticipants: 60,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[2].id, // Home & Garden
        name: "LED String Lights",
        description: "50ft waterproof LED string lights with remote control and 8 lighting modes for outdoor decoration.",
        imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "29.99",
        minimumParticipants: 60,
        maximumParticipants: 300,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[2].id, // Home & Garden
        name: "Bamboo Cutting Board Set",
        description: "Set of 3 eco-friendly bamboo cutting boards in different sizes with built-in compartments.",
        imageUrl: "https://images.unsplash.com/photo-1594736797933-d0401ba669ba?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "49.99",
        minimumParticipants: 45,
        maximumParticipants: 200,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[3].id, // Sports & Fitness
        name: "Adjustable Dumbbell Set",
        description: "Space-saving adjustable dumbbell set with weight range from 5-50 lbs per dumbbell.",
        imageUrl: "https://images.unsplash.com/photo-1571019613914-85f342c6a11e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "249.99",
        minimumParticipants: 10,
        maximumParticipants: 40,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[3].id, // Sports & Fitness
        name: "Yoga Mat with Carrying Strap",
        description: "Extra-thick yoga mat with non-slip surface and alignment lines. Includes carrying strap.",
        imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "34.99",
        minimumParticipants: 50,
        maximumParticipants: 250,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[3].id, // Sports & Fitness
        name: "Resistance Bands Set",
        description: "Complete resistance bands set with 5 different resistance levels, handles, and door anchor.",
        imageUrl: "https://images.unsplash.com/photo-1571019613914-85f342c6a11e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "24.99",
        minimumParticipants: 75,
        maximumParticipants: 400,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[3].id, // Sports & Fitness
        name: "Premium Protein Shaker Bottle",
        description: "BPA-free protein shaker bottle with mixing ball and measurement marks. Leak-proof design.",
        imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "19.99",
        minimumParticipants: 100,
        maximumParticipants: 500,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[6].id, // Books
        name: "Personal Development Book Bundle",
        description: "Collection of 5 bestselling personal development books including productivity and mindfulness guides.",
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "79.99",
        minimumParticipants: 30,
        maximumParticipants: 150,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[6].id, // Books
        name: "Business Strategy Masterclass Book",
        description: "Comprehensive business strategy guide with case studies from successful entrepreneurs and companies.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "44.99",
        minimumParticipants: 40,
        maximumParticipants: 200,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[6].id, // Books
        name: "Cookbook Collection - Healthy Meals",
        description: "Set of 3 cookbooks featuring healthy recipes, meal prep ideas, and nutrition guides for families.",
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "59.99",
        minimumParticipants: 35,
        maximumParticipants: 175,
      },
      {
        sellerId: johnSeller[0].id,
        categoryId: insertedCategories[6].id, // Books
        name: "Children's Educational Book Set",
        description: "Interactive educational book set for children ages 3-8 with colorful illustrations and learning activities.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "39.99",
        minimumParticipants: 50,
        maximumParticipants: 250,
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

    // Create buyer users to join collections
    const buyerUsers = [];
    for (let i = 1; i <= 15; i++) {
      const buyer = {
        id: `buyer-${i}`,
        email: `buyer${i}@oneant.com`,
        firstName: `Buyer`,
        lastName: `${i}`,
        isSeller: false,
      };
      buyerUsers.push(buyer);
    }
    
    const insertedBuyers = await db.insert(users).values(buyerUsers).returning();
    console.log("Seeded buyer users:", insertedBuyers.length);

    // Create collections that cover all products (distributed among users)
    const collectionsData = [];
    const allUsers = [sampleSeller[0], johnSeller[0], ...insertedBuyers];
    
    // Helper function to create collections
    const createCollection = (name: string, description: string, ownerId: string, productIds: number[]) => {
      return {
        userId: ownerId,
        name,
        description,
        shareToken: nanoid(32),
        isPublic: true,
      };
    };
    
    // Distribute products across collections (3-4 products per collection)
    const productChunks = [];
    for (let i = 0; i < insertedProducts.length; i += 3) {
      productChunks.push(insertedProducts.slice(i, i + 3));
    }
    
    // Create collections with descriptive names
    const collectionNames = [
      "Tech Essentials Bundle",
      "Home Comfort Collection", 
      "Fitness & Wellness Pack",
      "Fashion Forward Set",
      "Smart Living Bundle",
      "Gaming & Entertainment", 
      "Health & Beauty Kit",
      "Kitchen & Dining Set",
      "Outdoor Adventure Pack",
      "Learning & Development Bundle"
    ];
    
    for (let i = 0; i < productChunks.length; i++) {
      const chunk = productChunks[i];
      const ownerIndex = i % allUsers.length;
      const owner = allUsers[ownerIndex];
      
      const collectionName = collectionNames[i] || `Collection ${i + 1}`;
      const description = `Curated bundle featuring ${chunk.length} amazing products at discounted prices when 5+ people join!`;
      
      collectionsData.push(createCollection(
        collectionName,
        description,
        owner.id,
        chunk.map(p => p.id)
      ));
    }
    
    const insertedCollections = await db.insert(userGroups).values(collectionsData).returning();
    console.log("Seeded collections:", insertedCollections.length);
    
    // Add products to collections
    const collectionItems = [];
    for (let i = 0; i < productChunks.length && i < insertedCollections.length; i++) {
      const chunk = productChunks[i];
      const collection = insertedCollections[i];
      
      for (const product of chunk) {
        collectionItems.push({
          userGroupId: collection.id,
          productId: product.id,
          quantity: 1,
        });
      }
    }
    
    await db.insert(userGroupItems).values(collectionItems);
    console.log("Seeded collection items:", collectionItems.length);
    
    // Add participants to collections (5 people per collection for discounts)
    const participantsData = [];
    for (const collection of insertedCollections) {
      // Add the collection owner as first participant
      participantsData.push({
        userGroupId: collection.id,
        userId: collection.userId,
      });
      
      // Add 4 more random participants from different users
      const otherUsers = allUsers.filter(u => u.id !== collection.userId);
      const shuffled = otherUsers.sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < Math.min(4, shuffled.length); i++) {
        participantsData.push({
          userGroupId: collection.id,
          userId: shuffled[i].id,
        });
      }
    }
    
    await db.insert(userGroupParticipants).values(participantsData);
    console.log("Seeded collection participants:", participantsData.length);

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}