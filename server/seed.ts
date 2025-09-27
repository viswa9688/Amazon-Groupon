import { db } from "./db";
import { eq } from "drizzle-orm";
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
    // Check if data already exists
    const existingCategories = await db.select().from(categories).limit(1);
    const existingProducts = await db.select().from(products).limit(1);
    
    if (existingCategories.length > 0 && existingProducts.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    // Seed categories (handle duplicates)
    const categoryData = [
      { name: "Groceries", slug: "groceries", icon: "ShoppingCart" },
      { name: "Services", slug: "services", icon: "Briefcase" },
      { name: "Pet Essentials", slug: "pet-essentials", icon: "Heart" },
    ];

    let insertedCategories;
    if (existingCategories.length === 0) {
      insertedCategories = await db.insert(categories).values(categoryData).returning();
      console.log("Seeded categories:", insertedCategories.length);
    } else {
      insertedCategories = await db.select().from(categories);
      console.log("Using existing categories:", insertedCategories.length);
    }
    console.log("Seeded categories:", insertedCategories.length);

    // Create sample seller users (handle duplicates)
    let sampleSeller, johnSeller;
    try {
      sampleSeller = await db.insert(users).values({
        id: "sample-seller-123",
        email: "seller@oneant.com",
        firstName: "John",
        lastName: "Seller",
        isSeller: true,
      }).returning();
    } catch (e) {
      sampleSeller = await db.select().from(users).where(eq(users.id, "sample-seller-123"));
    }

    try {
      johnSeller = await db.insert(users).values({
        id: "john-seller-456",
        email: "john@oneant.com",
        firstName: "John",
        lastName: "Smith",
        isSeller: true,
      }).returning();
    } catch (e) {
      johnSeller = await db.select().from(users).where(eq(users.id, "john-seller-456"));
    }

    // Seed sample products
    const productData = [
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[0].id, // Groceries
        name: "Organic Fresh Vegetables Bundle",
        description: "Fresh organic vegetables including carrots, broccoli, spinach, and bell peppers. Perfect for healthy cooking and meal prep.",
        imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "29.99",
        minimumParticipants: 10,
        maximumParticipants: 100,
      },
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Services
        name: "Professional House Cleaning Service",
        description: "Complete house cleaning service including kitchen, bathrooms, living areas, and bedrooms. Professional cleaners with eco-friendly products.",
        imageUrl: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "149.99",
        minimumParticipants: 5,
        maximumParticipants: 20,
      },
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[0].id, // Groceries
        name: "Premium Coffee Beans Selection",
        description: "High-quality coffee beans from different regions. Perfect for coffee enthusiasts who want to try various flavors and brewing methods.",
        imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "39.99",
        minimumParticipants: 15,
        maximumParticipants: 150,
      },
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[1].id, // Services
        name: "Personal Training Session",
        description: "One-on-one personal training session with certified fitness instructor. Customized workout plan and nutrition guidance.",
        imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "79.99",
        minimumParticipants: 1,
        maximumParticipants: 10,
      },
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Services
        name: "Home Tutoring Service",
        description: "Professional tutoring service for students. Subjects include math, science, and language arts. Experienced educators.",
        imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "69.99",
        minimumParticipants: 5,
        maximumParticipants: 20,
      },
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[0].id, // Groceries
        name: "Artisan Bread Selection",
        description: "Fresh artisan breads including sourdough, whole grain, and specialty loaves. Baked daily with premium ingredients.",
        imageUrl: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "19.99",
        minimumParticipants: 20,
        maximumParticipants: 100,
      },
      // John's 20 additional products
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[0].id, // Electronics
        name: "4K Ultra HD Smart TV",
        description: "55-inch 4K Ultra HD Smart TV with HDR and built-in streaming apps. Perfect for entertainment.",
        imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "299.99",
        minimumParticipants: 8,
        maximumParticipants: 50,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[0].id, // Electronics
        name: "Wireless Charging Pad",
        description: "Fast wireless charging pad compatible with all Qi-enabled devices. Sleek and efficient design.",
        imageUrl: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "25.99",
        minimumParticipants: 50,
        maximumParticipants: 200,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[0].id, // Electronics
        name: "USB-C Hub Multi-Port Adapter",
        description: "7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader, and fast charging support.",
        imageUrl: "https://images.unsplash.com/photo-1625842268584-8f3296236761?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "45.99",
        minimumParticipants: 30,
        maximumParticipants: 150,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[0].id, // Electronics
        name: "Smartphone Camera Lens Kit",
        description: "Professional smartphone camera lens kit with wide-angle, macro, and telephoto lenses.",
        imageUrl: "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "89.99",
        minimumParticipants: 25,
        maximumParticipants: 100,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1].id, // Fashion
        name: "Luxury Leather Handbag",
        description: "Genuine leather handbag with multiple compartments and adjustable strap. Timeless elegance.",
        imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "159.99",
        minimumParticipants: 15,
        maximumParticipants: 75,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1].id, // Fashion
        name: "Designer Sunglasses",
        description: "UV protection designer sunglasses with polarized lenses and lightweight titanium frame.",
        imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "129.99",
        minimumParticipants: 20,
        maximumParticipants: 80,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1].id, // Fashion
        name: "Premium Wool Scarf",
        description: "Soft cashmere blend scarf in multiple colors. Perfect for any season and occasion.",
        imageUrl: "https://images.unsplash.com/photo-1601924638867-985629389d5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "39.99",
        minimumParticipants: 40,
        maximumParticipants: 180,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1].id, // Fashion
        name: "Athletic Performance Sneakers",
        description: "High-performance athletic sneakers with advanced cushioning and breathable mesh design.",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "119.99",
        minimumParticipants: 25,
        maximumParticipants: 120,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Home & Garden
        name: "Smart Home Security Camera",
        description: "1080p HD security camera with night vision, motion detection, and smartphone app control.",
        imageUrl: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "79.99",
        minimumParticipants: 35,
        maximumParticipants: 150,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Home & Garden
        name: "Ceramic Non-Stick Cookware Set",
        description: "10-piece ceramic non-stick cookware set with heat-resistant handles and dishwasher-safe design.",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "199.99",
        minimumParticipants: 12,
        maximumParticipants: 60,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Home & Garden
        name: "LED String Lights",
        description: "50ft waterproof LED string lights with remote control and 8 lighting modes for outdoor decoration.",
        imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "29.99",
        minimumParticipants: 60,
        maximumParticipants: 300,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Home & Garden
        name: "Bamboo Cutting Board Set",
        description: "Set of 3 eco-friendly bamboo cutting boards in different sizes with built-in compartments.",
        imageUrl: "https://images.unsplash.com/photo-1594736797933-d0401ba669ba?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "49.99",
        minimumParticipants: 45,
        maximumParticipants: 200,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Sports & Fitness
        name: "Adjustable Dumbbell Set",
        description: "Space-saving adjustable dumbbell set with weight range from 5-50 lbs per dumbbell.",
        imageUrl: "https://images.unsplash.com/photo-1571019613914-85f342c6a11e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "249.99",
        minimumParticipants: 10,
        maximumParticipants: 40,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Sports & Fitness
        name: "Yoga Mat with Carrying Strap",
        description: "Extra-thick yoga mat with non-slip surface and alignment lines. Includes carrying strap.",
        imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "34.99",
        minimumParticipants: 50,
        maximumParticipants: 250,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Sports & Fitness
        name: "Resistance Bands Set",
        description: "Complete resistance bands set with 5 different resistance levels, handles, and door anchor.",
        imageUrl: "https://images.unsplash.com/photo-1571019613914-85f342c6a11e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "24.99",
        minimumParticipants: 75,
        maximumParticipants: 400,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Sports & Fitness
        name: "Premium Protein Shaker Bottle",
        description: "BPA-free protein shaker bottle with mixing ball and measurement marks. Leak-proof design.",
        imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "19.99",
        minimumParticipants: 100,
        maximumParticipants: 500,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Books or fallback
        name: "Personal Development Book Bundle",
        description: "Collection of 5 bestselling personal development books including productivity and mindfulness guides.",
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "79.99",
        minimumParticipants: 30,
        maximumParticipants: 150,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Books or fallback
        name: "Business Strategy Masterclass Book",
        description: "Comprehensive business strategy guide with case studies from successful entrepreneurs and companies.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "44.99",
        minimumParticipants: 40,
        maximumParticipants: 200,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Books or fallback
        name: "Cookbook Collection - Healthy Meals",
        description: "Set of 3 cookbooks featuring healthy recipes, meal prep ideas, and nutrition guides for families.",
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "59.99",
        minimumParticipants: 35,
        maximumParticipants: 175,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Books or fallback
        name: "Children's Educational Book Set",
        description: "Interactive educational book set for children ages 3-8 with colorful illustrations and learning activities.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "39.99",
        minimumParticipants: 50,
        maximumParticipants: 250,
      },
      // Pet Essentials products
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[2]?.id || insertedCategories[0].id, // Pet Essentials
        name: "Professional Pet Grooming Service",
        description: "Complete pet grooming service including bath, brush, nail trimming, and ear cleaning. Professional groomers with pet-friendly products.",
        imageUrl: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "89.99",
        minimumParticipants: 8,
        maximumParticipants: 30,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[2]?.id || insertedCategories[0].id, // Pet Essentials
        name: "Pet Training Session",
        description: "One-on-one pet training session with certified animal behaviorist. Basic obedience, house training, and behavioral issues.",
        imageUrl: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "119.99",
        minimumParticipants: 5,
        maximumParticipants: 20,
      },
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[2]?.id || insertedCategories[0].id, // Pet Essentials
        name: "Pet Sitting & Walking Service",
        description: "Professional pet sitting and walking service for busy pet owners. Experienced caregivers with pet first aid certification.",
        imageUrl: "https://images.unsplash.com/photo-1552053831-71594a27632d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "49.99",
        minimumParticipants: 10,
        maximumParticipants: 50,
      },
      // Car Services products
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Services
        name: "Professional Car Detailing Service",
        description: "Complete car detailing service including exterior wash, wax, interior cleaning, and leather conditioning. Professional detailers with premium products.",
        imageUrl: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "129.99",
        minimumParticipants: 8,
        maximumParticipants: 25,
      },
      {
        sellerId: sampleSeller[0]?.id || "sample-seller-123",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Services
        name: "Mobile Car Oil Change Service",
        description: "Convenient mobile oil change service that comes to your location. Professional mechanics with quality oil and filters. Save time and hassle.",
        imageUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "79.99",
        minimumParticipants: 12,
        maximumParticipants: 40,
      },
      {
        sellerId: johnSeller[0]?.id || "john-seller-456",
        categoryId: insertedCategories[1]?.id || insertedCategories[0].id, // Services
        name: "Car Inspection & Safety Check",
        description: "Comprehensive car inspection and safety check service. Certified mechanics check brakes, tires, lights, and all safety systems.",
        imageUrl: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        originalPrice: "99.99",
        minimumParticipants: 6,
        maximumParticipants: 20,
      },
    ];

    let insertedProducts;
    try {
      insertedProducts = await db.insert(products).values(productData).returning();
      console.log("Seeded products:", insertedProducts.length);
    } catch (e) {
      console.log("Products already exist, fetching existing ones");
      insertedProducts = await db.select().from(products);
      console.log("Using existing products:", insertedProducts.length);
    }

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
    
    let insertedBuyers;
    try {
      insertedBuyers = await db.insert(users).values(buyerUsers).returning();
      console.log("Seeded buyer users:", insertedBuyers.length);
    } catch (e) {
      console.log("Buyer users already exist, fetching existing ones");
      insertedBuyers = await db.select().from(users).where(eq(users.isSeller, false));
      console.log("Using existing buyer users:", insertedBuyers.length);
    }

    // Create collections that cover all products (distributed among users)
    const collectionsData = [];
    const allUsers = [
      sampleSeller[0] || { id: "sample-seller-123" }, 
      johnSeller[0] || { id: "john-seller-456" }, 
      ...insertedBuyers
    ];
    
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
    
    let insertedCollections;
    try {
      insertedCollections = await db.insert(userGroups).values(collectionsData).returning();
      console.log("Seeded collections:", insertedCollections.length);
    } catch (e) {
      console.log("Collections already exist, fetching existing ones");
      insertedCollections = await db.select().from(userGroups);
      console.log("Using existing collections:", insertedCollections.length);
    }
    
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